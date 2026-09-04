import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { observeListingNavigation } from '../src/content/navigation';
import {
  appearsToBeHomesRental,
  appearsToBeSupportedSiteRental,
  requiresRedfinUnitSelection,
  requiresHomesUnitSelection,
  requiresZillowUnitSelection,
  selectedHomesUnitId,
  selectedRedfinUnitId,
  selectedZillowUnitId,
} from '../src/content/pageState';
import { extractListing } from '../src/extractors';

describe('SPA listing navigation', () => {
  it('uses Chromium navigation events without starting a permanent poll', async () => {
    const dom = new JSDOM('<html><body></body></html>', {
      url: 'https://example.com/listing/one',
    });
    const navigation = new dom.window.EventTarget();
    Object.defineProperty(dom.window, 'navigation', { value: navigation });
    const interval = vi.spyOn(dom.window, 'setInterval');
    const callback = vi.fn();
    const observer = observeListingNavigation(
      dom.window as unknown as Window,
      dom.window.document,
      callback,
      5,
    );

    dom.window.history.pushState({}, '', '/listing/two');
    navigation.dispatchEvent(new dom.window.Event('navigatesuccess'));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(interval).not.toHaveBeenCalled();
    observer.disconnect();
  });

  it('debounces DOM changes and reruns only after the URL changes', async () => {
    const dom = new JSDOM('<html><body><main></main></body></html>', {
      url: 'https://example.com/listing/one',
    });
    const callback = vi.fn();
    const observer = observeListingNavigation(
      dom.window as unknown as Window,
      dom.window.document,
      callback,
      5,
      5,
    );
    dom.window.document.querySelector('main')?.append('ordinary mutation');
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(callback).not.toHaveBeenCalled();

    dom.window.history.pushState({}, '', '/listing/two');
    dom.window.document
      .querySelector('main')
      ?.append('rerender 1', 'rerender 2');
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(callback).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });

  it('does not let continuous DOM mutations starve a URL update', async () => {
    const dom = new JSDOM('<html><body><main></main></body></html>', {
      url: 'https://example.com/search',
    });
    const callback = vi.fn();
    const observer = observeListingNavigation(
      dom.window as unknown as Window,
      dom.window.document,
      callback,
      10,
      5,
    );

    dom.window.history.pushState({}, '', '/homedetails/selected');
    const churn = setInterval(() => {
      dom.window.document.querySelector('main')?.append('mutation');
    }, 2);
    await new Promise((resolve) => setTimeout(resolve, 30));
    clearInterval(churn);

    expect(callback).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });
});

describe('Zillow unit selection', () => {
  it('requires an explicit choice when several community units are listed', () => {
    const dom = new JSDOM(`
      <html><body>
        <div role="dialog">
          <h2>Available units</h2>
          <div>Unit 2-2401 · 1 bd · 725 sqft · $4,406</div>
          <div>Unit 2-2802 · 1 bd · 725 sqft · $4,493</div>
        </div>
      </body></html>
    `);
    expect(
      requiresZillowUnitSelection(
        dom.window.document,
        new URL('https://www.zillow.com/apartments/example/abc/'),
      ),
    ).toBe(true);
  });

  it('recognizes a selected unit from its heading', () => {
    const dom = new JSDOM(`
      <html><body>
        <h2>Available units</h2>
        <div>Unit 2-2401 · $4,406</div>
        <div>Unit 2-2802 · $4,493</div>
        <div role="dialog"><h1>Unit 2-2401</h1>Base rent $4,406</div>
      </body></html>
    `);
    expect(
      requiresZillowUnitSelection(
        dom.window.document,
        new URL('https://www.zillow.com/apartments/example/abc/'),
      ),
    ).toBe(false);
    expect(
      selectedZillowUnitId(
        dom.window.document,
        new URL('https://www.zillow.com/apartments/example/abc/'),
      ),
    ).toBe('2-2401');
  });

  it('recognizes Zillow selected-unit routes without scanning the modal', () => {
    const dom = new JSDOM('<html><body><h1>308</h1></body></html>');
    expect(
      selectedZillowUnitId(
        dom.window.document,
        new URL(
          'https://www.zillow.com/apartments/cupertino-ca/example/#uap-206287/5631',
        ),
      ),
    ).toBe('uap-206287/5631');
  });

  it('classifies Zillow communities without reading the page DOM', () => {
    const dom = new JSDOM('<html><body>Huge community page</body></html>');
    Object.defineProperty(dom.window.document.body, 'textContent', {
      get: () => {
        throw new Error('Community DOM should not be scanned');
      },
    });
    expect(
      requiresZillowUnitSelection(
        dom.window.document,
        new URL('https://www.zillow.com/apartments/example/abc/'),
      ),
    ).toBe(true);
  });

  it('allows ordinary Zillow home-detail extraction', () => {
    const dom = new JSDOM('<html><body>Individual rental</body></html>');
    expect(
      requiresZillowUnitSelection(
        dom.window.document,
        new URL('https://www.zillow.com/homedetails/example/1_zpid/'),
      ),
    ).toBe(false);
  });
});

describe('Homes.com unit selection', () => {
  const url = new URL(
    'https://www.homes.com/property/nexen-los-angeles-ca/example/',
  );

  it('recognizes apartment communities and asks for a floor-plan unit', () => {
    const dom = new JSDOM(`
      <html><body><h1>NEXEN</h1><h2>Pricing and Floor Plans</h2></body></html>
    `);
    expect(appearsToBeHomesRental(dom.window.document, url)).toBe(true);
    expect(requiresHomesUnitSelection(dom.window.document, url)).toBe(true);
  });

  it('recognizes a Homes.com unit modal route', () => {
    const dom = new JSDOM(`
      <html><body>
        <h2>Pricing and Floor Plans</h2>
        <section class="unit-floorplan-modal">
          <header class="unit-floorplan-modal-header">535 Change</header>
        </section>
      </body></html>
    `);
    const selectedUrl = new URL(`${url.href}#kj4v719-2-unit`);
    expect(selectedHomesUnitId(dom.window.document, selectedUrl)).toBe(
      'kj4v719-2',
    );
    expect(requiresHomesUnitSelection(dom.window.document, selectedUrl)).toBe(
      false,
    );
  });

  it('does not classify an ordinary Homes.com sale property as a rental', () => {
    const dom = new JSDOM(
      '<html><body><h1>123 Main Street</h1><h2>Property Details</h2></body></html>',
    );
    expect(appearsToBeHomesRental(dom.window.document, url)).toBe(false);
    expect(requiresHomesUnitSelection(dom.window.document, url)).toBe(false);
  });

  it('recognizes an individual Homes.com per-month rental', () => {
    const dom = new JSDOM(`
      <html><body>
        <div><strong>$2,695</strong> <span>Per Month</span></div>
        <h1>700 E Gonzales Rd Unit A</h1>
      </body></html>
    `);
    expect(appearsToBeHomesRental(dom.window.document, url)).toBe(true);
    expect(requiresHomesUnitSelection(dom.window.document, url)).toBe(false);
  });

  it('recognizes an individual Homes.com total-monthly-price rental', () => {
    const dom = new JSDOM(`
      <html><body>
        <div><strong>$2,265</strong> <span>Total Monthly Price</span></div>
        <h1>9184 Cazador St</h1>
      </body></html>
    `);
    expect(appearsToBeHomesRental(dom.window.document, url)).toBe(true);
    expect(requiresHomesUnitSelection(dom.window.document, url)).toBe(false);
  });
});

describe('supported-site rental classification', () => {
  it('recognizes Rent.com individual rental routes', () => {
    const url = new URL(
      'https://www.rent.com/r/177-juniper-trail-sedona-az-lv3247079672',
    );
    const dom = new JSDOM(
      '<html><body><h1>177 Juniper Trail</h1></body></html>',
    );

    expect(appearsToBeSupportedSiteRental(dom.window.document, url)).toBe(true);
  });

  it('recognizes an Apartment List community with a marketing-only title', () => {
    const url = new URL(
      'https://www.apartmentlist.com/ca/camarillo/mission-hills',
    );
    const dom = new JSDOM(
      '<html><head><title>Mission Hills</title></head><body><h1>Mission Hills</h1></body></html>',
    );

    expect(appearsToBeSupportedSiteRental(dom.window.document, url)).toBe(true);
  });

  it('recognizes a Zillow homedetails rental without rental URL or title hints', () => {
    const url = new URL(
      'https://www.zillow.com/homedetails/10744-Deep-Cliffe-Dr-Cupertino-CA-95014/19632536_zpid/',
    );
    const dom = new JSDOM(`
      <html><head><title>10744 Deep Cliffe Dr, Cupertino, CA 95014 | Zillow</title></head><body>
        <span>House for rent</span>
        <h1>10744 Deep Cliffe Dr, Cupertino, CA 95014</h1>
        <span data-testid="price">$6,999/mo</span>
        <div data-testid="bed-bath-sqft-facts">5 beds 3 baths 2,548 sqft</div>
        <button>Request to apply</button>
      </body></html>
    `);

    expect(appearsToBeSupportedSiteRental(dom.window.document, url)).toBe(true);
  });

  it('does not treat Zillow sale-only monthly estimates as rental evidence', () => {
    const url = new URL(
      'https://www.zillow.com/homedetails/123-Main-St/123_zpid/',
    );
    const dom = new JSDOM(`
      <html><body>
        <h1>123 Main St, Fresno, CA 93701</h1>
        <span data-testid="price">$825,000</span>
        <p>Estimated payment $4,900/mo</p>
        <p>Rent Zestimate $3,200/mo</p>
      </body></html>
    `);

    expect(appearsToBeSupportedSiteRental(dom.window.document, url)).toBe(
      false,
    );
  });

  it('recognizes a Redfin rental on its sale-style home URL', () => {
    const url = new URL(
      'https://www.redfin.com/CA/Redwood-City/88-Southgate-St-94062/home/1397579',
    );
    const dom = new JSDOM(`
      <html><head><title>88 Southgate St, Redwood City, CA 94062 | Redfin</title></head><body>
        <span>FOR RENT</span>
        <div>$6,250/mo</div>
        <div>3 bd · 2 ba · 1,850 sq ft</div>
        <div>88 Southgate St, Redwood City, CA 94062</div>
        <p>Rare opportunity to lease an entire property.</p>
      </body></html>
    `);
    const extraction = extractListing(dom.window.document, url);

    expect(
      appearsToBeSupportedSiteRental(dom.window.document, url, extraction),
    ).toBe(true);
    expect(extraction.listing.recurring.advertisedRent?.value).toBe(6_250);
  });
});

describe('Redfin unit selection', () => {
  const url = new URL(
    'https://www.redfin.com/CA/Belmont/Belmont-Glen-Residences/apartment/123',
  );

  it('requires a selection on a community with available units', () => {
    const dom = new JSDOM(
      '<html><body><h1>Belmont Glen Residences</h1><h2>Available Units</h2></body></html>',
    );

    expect(requiresRedfinUnitSelection(dom.window.document, url)).toBe(true);
  });

  it('identifies and extracts the selected Redfin floor-plan dialog', () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>200 Davey Glen Rd, Belmont, CA 94002</h1>
        <h2>Available Units</h2>
        <div>Background unit: 1 bd · 540 sq ft · $3,200/mo</div>
        <div id="bp-dialog-container" role="dialog" data-rf-test-name="dialogGutsNode">
          <div class="dialog-title">
            <div class="name-and-rent">2X1 · $4,033/mo</div>
            <div class="details">1 Bath · 1,030 Sqft.</div>
          </div>
        </div>
      </body></html>
    `);
    const id = selectedRedfinUnitId(dom.window.document, url);

    expect(id).toBe('2X1 · $4,033/mo');
    expect(requiresRedfinUnitSelection(dom.window.document, url)).toBe(false);

    const selectedUrl = new URL(url);
    selectedUrl.hash = `rentsight-unit=${encodeURIComponent(id!)}`;
    const extraction = extractListing(dom.window.document, selectedUrl);
    expect(extraction.listing.recurring.advertisedRent?.value).toBe(4_033);
    expect(extraction.listing.identity.bedrooms?.value).toBe(2);
    expect(extraction.listing.identity.bathrooms?.value).toBe(1);
    expect(extraction.listing.identity.squareFootage?.value).toBe(1_030);
  });

  it('reads Redfin bed and bath counts from a dialog without square footage', () => {
    const dom = new JSDOM(`
      <html><body>
        <h1>2382 Camino Capitan Unit D, Santa Fe, NM 87505</h1>
        <h2>Available Units</h2>
        <div id="bp-dialog-container" role="dialog" data-rf-test-name="dialogGutsNode">
          <div class="dialog-title">
            <div class="name-and-rent">2 bed 1 bath · $1,900/mo</div>
            <div class="details">1 Bath</div>
          </div>
        </div>
      </body></html>
    `);
    const id = selectedRedfinUnitId(dom.window.document, url);
    const selectedUrl = new URL(url);
    selectedUrl.hash = `rentsight-unit=${encodeURIComponent(id!)}`;

    const extraction = extractListing(dom.window.document, selectedUrl);

    expect(extraction.listing.identity.bedrooms?.value).toBe(2);
    expect(extraction.listing.identity.bathrooms?.value).toBe(1);
    expect(extraction.listing.identity.squareFootage).toBeUndefined();
  });
});
