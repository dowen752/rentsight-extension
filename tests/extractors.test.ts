import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { extractListing } from '../src/extractors';
import { extractJsonLd } from '../src/extractors/jsonLd';
import {
  classifyIncludedUtilities,
  classifyLaundry,
  classifyNoPetsPolicy,
} from '../src/extractors/parsers';

const fixture = (name: string, url = 'https://example.com/rental') => {
  const html = readFileSync(resolve('tests/fixtures', name), 'utf8');
  const dom = new JSDOM(html, { url });
  return dom.window.document;
};

describe('listing extraction', () => {
  it('extracts normalized fields from JSON-LD', () => {
    const result = extractJsonLd(fixture('jsonld-listing.html'));
    expect(result.listing.identity.city?.value).toBe('Sampletown');
    expect(result.listing.recurring.advertisedRent?.value).toBe(2_400);
    expect(result.listing.identity.squareFootage?.source).toBe('listing');
  });

  it('uses Zillow-specific selectors', () => {
    const result = extractListing(
      fixture(
        'zillow-listing.html',
        'https://www.zillow.com/homedetails/example/1_zpid/',
      ),
      new URL('https://www.zillow.com/homedetails/example/1_zpid/'),
    );
    expect(result.siteName).toBe('Zillow');
    expect(result.listing.identity.fullAddress?.value).toBe('200 Sample Road');
    expect(result.listing.identity.city?.value).toBe('Testville');
    expect(result.listing.identity.bedrooms?.value).toBe(3);
    expect(result.listing.identity.bathrooms?.value).toBe(2);
    expect(result.listing.identity.squareFootage?.value).toBe(1_250);
    expect(result.listing.recurring.advertisedRent?.value).toBe(2_650);
    expect(result.listing.upfront.securityDeposit?.value).toBe(2_000);
  });

  it('does not fill missing Zillow detail facts from background cards', () => {
    const url = new URL(
      'https://www.zillow.com/homedetails/selected-home/1_zpid/',
    );
    const document = new JSDOM(`
      <html><body>
        <h1>123 Selected St, Belmont, CA 94002</h1>
        <div data-testid="property-card-details">
          <span>6 bd</span><span>10 ba</span><span>4,000 sqft</span>
          <address>1050 Ralston Ave APT 16, Belmont, CA 94002</address>
        </div>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.listing.identity.fullAddress?.value).toBe('123 Selected St');
    expect(result.listing.identity.bedrooms).toBeUndefined();
    expect(result.listing.identity.bathrooms).toBeUndefined();
    expect(result.listing.identity.squareFootage).toBeUndefined();
  });

  it('reads all-inclusive utility language from the Zillow description', () => {
    const url = new URL(
      'https://www.zillow.com/homedetails/77-Cougar-Dr-Sedona-AZ/1_zpid/',
    );
    const document = new JSDOM(`
      <html><body>
        <h1>77 Cougar Dr, Sedona, AZ 86336</h1>
        <span data-testid="price">$6,000/mo</span>
        <span>6 beds</span><span>4.5 baths</span><span>3,211 sqft</span>
        <div data-testid="description">
          With wifi and utilities included. All utilities and hot tub included.
        </div>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.includedUtilities).toHaveLength(6);
    expect(result.rawUtilityText).toContain(
      'All utilities and hot tub included',
    );
  });

  it('supports Zillow apartment-community pages without choosing ranges', () => {
    const url = new URL(
      'https://www.zillow.com/apartments/redwood-city-ca/example/5XkJhC/',
    );
    const result = extractListing(
      fixture('zillow-apartments-listing.html', url.href),
      url,
    );
    expect(result.siteName).toBe('Zillow');
    expect(result.listing.identity.listingTitle?.value).toBe(
      'Cirrus Redwood City',
    );
    expect(result.listing.identity.fullAddress?.value).toBe(
      '2580 El Camino Real',
    );
    expect(result.listing.identity.city?.value).toBe('Redwood City');
    expect(result.listing.identity.zipCode?.value).toBe('94061');
    expect(result.rent).toMatchObject({
      kind: 'range',
      minimum: { value: 2_905 },
      maximum: { value: 4_995 },
    });
    expect(result.listing.recurring.advertisedRent).toBeUndefined();
    expect(result.listing.identity.bedrooms).toBeUndefined();
  });

  it('scopes Zillow extraction to an opened community unit', () => {
    const url = new URL(
      'https://www.zillow.com/apartments/san-francisco-ca/example/abc/',
    );
    const document = new JSDOM(`
      <html><body>
        <div>Available units: Unit 1 $1,000 · Unit 2 $9,000</div>
        <section role="dialog">
          <div>
            <h1>Unit 42</h1>
            <p>1 bed, 1.5 baths | $2,550 Fees may apply</p>
            <div>1,023 sqft</div>
          </div>
        </section>
      </body></html>
    `).window.document;
    const result = extractListing(document, url);

    expect(result.listing.recurring.advertisedRent?.value).toBe(2_550);
    expect(result.listing.identity.bedrooms?.value).toBe(1);
    expect(result.listing.identity.bathrooms?.value).toBe(1.5);
    expect(result.listing.identity.squareFootage?.value).toBe(1_023);
  });

  it('combines a route-backed Zillow unit with its community details', () => {
    const url = new URL(
      'https://www.zillow.com/apartments/cupertino-ca/the-markham/example/#rentsight-unit=uap-60A',
    );
    const description =
      'Your adventure starts here—welcome to The Markham apartments in Cupertino. The application fee is $50. Monthly pet rent is $35.';
    const document = new JSDOM(`
      <html><body>
        <main>
          <h1 data-test-id="bdp-building-title">The Markham</h1>
          <h2 data-test-id="bdp-building-address">20800 Homestead Rd, Cupertino, CA 95014</h2>
          <article>
            <h2>What's special</h2>
            <div data-c11n-component="Text">${description}</div>
          </article>
          <section><h2>Utilities</h2><p>Water, sewer, and trash are included.</p></section>
          <div>Other available units: 2 beds · 2 baths · 1,400 sqft · $9,999</div>
        </main>
        <aside class="unit-panel">
          <header>
            <h2>Unit 60A</h2>
            <span>1 bed, 1 bath | $3,385 Fees may apply</span>
          </header>
          <div>Available Aug 29 2026</div>
          <div>660 sqft</div>
          <div>Floor plan: Plan 1AR</div>
        </aside>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.listing.identity.listingTitle?.value).toBe(
      'The Markham · Unit 60A',
    );
    expect(result.listing.identity.fullAddress?.value).toBe(
      '20800 Homestead Rd',
    );
    expect(result.listing.identity.city?.value).toBe('Cupertino');
    expect(result.listing.identity.state?.value).toBe('CA');
    expect(result.listing.identity.zipCode?.value).toBe('95014');
    expect(result.listing.recurring.advertisedRent?.value).toBe(3_385);
    expect(result.listing.identity.bedrooms?.value).toBe(1);
    expect(result.listing.identity.bathrooms?.value).toBe(1);
    expect(result.listing.identity.squareFootage?.value).toBe(660);
    expect(result.listing.upfront.applicationFee?.value).toBe(50);
    expect(result.listing.recurring.petRent?.value).toBe(35);
    expect(result.includedUtilities).toEqual(['water', 'sewer', 'trash']);
  });

  it('preserves Zillow community details when an unfamiliar unit panel cannot be read', () => {
    const url = new URL(
      'https://www.zillow.com/apartments/cupertino-ca/the-markham/example/#rentsight-unit=uap-unfamiliar',
    );
    const document = new JSDOM(`
      <html><body>
        <h1 data-test-id="bdp-building-title">The Markham</h1>
        <h2 data-test-id="bdp-building-address">20800 Homestead Rd, Cupertino, CA 95014</h2>
        <div class="new-unit-layout">Details load in an unfamiliar format.</div>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.listing.identity.listingTitle?.value).toBe('The Markham');
    expect(result.listing.identity.fullAddress?.value).toBe(
      '20800 Homestead Rd',
    );
    expect(result.listing.recurring.advertisedRent).toBeUndefined();
    expect(result.warnings).toContain(
      'The selected Zillow unit layout could not be read safely. Enter its values manually.',
    );
  });

  it('extracts a Zillow child unit from its visible split summary', () => {
    const url = new URL(
      'https://www.zillow.com/homedetails/22639-Oakcrest-Ct-B-Cupertino-CA-95014/example/',
    );
    const document = new JSDOM(`
      <html><body>
        <main>
          <h1>22639 Oakcrest Ct</h1>
          <p>22639 Oakcrest Ct, # B, Cupertino, CA 95014</p>
          <div><span>$3,000/mo</span><span>Fees may apply</span></div>
          <div><span>Studio</span></div>
          <div><span>1 baths</span></div>
          <div><span>300 sqft</span></div>
          <div>In unit laundry</div>
        </main>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.listing.identity.fullAddress?.value).toBe(
      '22639 Oakcrest Ct, # B',
    );
    expect(result.listing.identity.city?.value).toBe('Cupertino');
    expect(result.listing.identity.state?.value).toBe('CA');
    expect(result.listing.identity.zipCode?.value).toBe('95014');
    expect(result.listing.recurring.advertisedRent?.value).toBe(3_000);
    expect(result.listing.identity.bedrooms?.value).toBe(0);
    expect(result.listing.identity.bathrooms?.value).toBe(1);
    expect(result.listing.identity.squareFootage?.value).toBe(300);
    expect(result.laundryType).toBe('in_unit');
  });

  it('ignores Zillow background cards and a full-page dialog wrapper', () => {
    const url = new URL(
      'https://www.zillow.com/homedetails/18645-Loree-Ave-ROOM-1-Cupertino-CA-95014/example/',
    );
    const document = new JSDOM(`
      <html><body>
        <div role="dialog">
          <aside>
            <div>$3,200/mo</div>
            <div>2 beds 1 bath 900 sqft</div>
            <div>10162 Alpine Dr APT B, Cupertino, CA 95014</div>
          </aside>
          <main>
            <span data-testid="price">$4,900/mo</span>
            <div data-testid="bed-bath-sqft-facts" aria-label="Bed bath sqft facts">
              <span>4</span><span>beds</span>
              <span>2</span><span>baths</span>
              <span>1,600</span><span>sqft</span>
            </div>
            <span>18645 Loree Ave Room 1, Cupertino, CA 95014</span>
          </main>
        </div>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.listing.identity.fullAddress?.value).toBe(
      '18645 Loree Ave Room 1',
    );
    expect(result.listing.recurring.advertisedRent?.value).toBe(4_900);
    expect(result.listing.identity.bedrooms?.value).toBe(4);
    expect(result.listing.identity.bathrooms?.value).toBe(2);
    expect(result.listing.identity.squareFootage?.value).toBe(1_600);
  });

  it('preserves an Apartments.com rent range explicitly', () => {
    const url = new URL('https://www.apartments.com/sample/abc/');
    const result = extractListing(
      fixture('apartments-listing.html', url.href),
      url,
    );
    expect(result.rent).toMatchObject({
      kind: 'range',
      minimum: { value: 1_800 },
      maximum: { value: 2_250 },
    });
    expect(result.listing.recurring.advertisedRent).toBeUndefined();
    expect(result.listing.identity.fullAddress?.value).toBe(
      '300 Fixture Street',
    );
    expect(result.listing.identity.city?.value).toBe('Demoville');
    expect(result.listing.identity.bedrooms).toBeUndefined();
  });

  it('does not mistake Apartments.com monthly rent for a parking fee', () => {
    const url = new URL('https://www.apartments.com/jasper/example/');
    const document = new JSDOM(`
      <html><body>
        <section><h2>Fees and Policies</h2><button>Parking</button><p>Garage Lot</p></section>
        <section><p class="rentInfoLabel">Monthly Rent</p><p class="rentInfoDetail">$2,072 - $4,646</p></section>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.listing.recurring.parking).toBeUndefined();
  });

  it('extracts an explicitly priced Apartments.com parking fee', () => {
    const url = new URL('https://www.apartments.com/sample/example/');
    const document = new JSDOM(`
      <html><body>
        <div class="rentRange">$1,850 Total Monthly Price</div>
        <section><h2>Parking</h2><p>Garage parking fee: $125 per month</p></section>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.listing.recurring.parking).toMatchObject({ value: 125 });
  });

  it('extracts Apartments.com single-home address and labeled facts', () => {
    const url = new URL(
      'https://www.apartments.com/2520-bottle-palm-ct-las-vegas-nv/example/',
    );
    const document = new JSDOM(`
      <html><head><title>2520 Bottle Palm Ct</title></head><body>
        <div id="propertyHeader">
          <div id="propertyAddressRow">
            <div class="propertyAddressContainer">
              <div class="delivery-address"><h1>2520 Bottle Palm Ct</h1>,</div>
              <div>Las Vegas, NV 89106</div>
            </div>
        </div>
        <div class="rentRange">$1,850 Total Monthly Price</div>
        <ul class="priceBedRangeInfo">
          <li><div><p class="rentInfoLabel">Bedrooms</p><p class="rentInfoDetail">2</p></div></li>
          <li><div><p class="rentInfoLabel">Bathrooms</p><p class="rentInfoDetail">2</p></div></li>
          <li><div><p class="rentInfoLabel">Square Feet</p><p class="rentInfoDetail">1,183 sq ft</p></div></li>
        </ul>
        <section class="feature-section highlights-section"><ul><li>Washer and Dryer</li></ul></section>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.siteName).toBe('Apartments.com');
    expect(result.listing.identity.fullAddress?.value).toBe(
      '2520 Bottle Palm Ct',
    );
    expect(result.listing.identity.city?.value).toBe('Las Vegas');
    expect(result.listing.identity.state?.value).toBe('NV');
    expect(result.listing.identity.zipCode?.value).toBe('89106');
    expect(result.listing.recurring.advertisedRent?.value).toBe(1_850);
    expect(result.listing.identity.bedrooms?.value).toBe(2);
    expect(result.listing.identity.bathrooms?.value).toBe(2);
    expect(result.listing.identity.squareFootage?.value).toBe(1_183);
    expect(result.laundryType).toBe('in_unit');
  });

  it('prefers the selected Apartments.com unit modal over community facts', () => {
    const url = new URL(
      'https://www.apartments.com/jasper-los-angeles-ca/c74061e/#j0qgsy5-2-unit',
    );
    const document = new JSDOM(`
      <html><body>
        <h1 class="propertyName">Jasper</h1>
        <div id="propertyAddressRow">2528 S Grand Ave, Los Angeles, CA 90007</div>
        <div class="rentRange">$2,072 - $4,500</div>
        <div>Studio · 1 Bath · 486 Sq Ft</div>
        <div id="rentalDetailContainer">
          <div id="rentalDetailModalContentContainer">
            <div class="unit-detail-wrapper">
              <div class="specs-header">735</div>
              <div class="specs-header no-wrap pricing">Base Price: $2,272</div>
              <ul class="unit-specs"><li>Studio</li><li>1 Bath</li><li>517 Sq Ft</li></ul>
            </div>
          </div>
        </div>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.rent).toMatchObject({
      kind: 'single',
      amount: { value: 2_272 },
    });
    expect(result.listing.recurring.advertisedRent?.value).toBe(2_272);
    expect(result.listing.identity.bedrooms?.value).toBe(0);
    expect(result.listing.identity.bathrooms?.value).toBe(1);
    expect(result.listing.identity.squareFootage?.value).toBe(517);
  });

  it('extracts a one-bedroom Apartments.com unit modal', () => {
    const url = new URL(
      'https://www.apartments.com/jasper-los-angeles-ca/c74061e/#kqdtedb-2-unit',
    );
    const document = new JSDOM(`
      <html><body><h1>Jasper</h1>
        <div id="rentalDetailContainer">
          <div class="unit-detail-wrapper">
            <div class="specs-header">602</div>
            <div class="specs-header pricing">Base Price: $2,932</div>
            <ul class="unit-specs"><li>1 Bed</li><li>1 Bath</li><li>773 Sq Ft</li></ul>
          </div>
        </div>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);
    expect(result.listing.recurring.advertisedRent?.value).toBe(2_932);
    expect(result.listing.identity.bedrooms?.value).toBe(1);
    expect(result.listing.identity.bathrooms?.value).toBe(1);
    expect(result.listing.identity.squareFootage?.value).toBe(773);
  });

  it('extracts the selected Apartment List unit instead of community facts', () => {
    const url = new URL(
      'https://www.apartmentlist.com/ca/camarillo/mission-hills',
    );
    const result = extractListing(
      fixture('apartmentlist-listing.html', url.href),
      url,
    );
    expect(result.siteName).toBe('Apartment List');
    expect(result.listing.identity.fullAddress?.value).toBe(
      '45 Rincon Dr #104A',
    );
    expect(result.listing.recurring.advertisedRent?.value).toBe(2_441);
    expect(result.listing.identity.bedrooms?.value).toBe(1);
    expect(result.listing.identity.bathrooms?.value).toBe(1);
    expect(result.listing.identity.squareFootage?.value).toBe(723);
    expect(result.listing.upfront.securityDeposit?.value).toBe(600);
    expect(result.listing.recurring.petRent?.value).toBe(55);
  });

  it('uses the selected Redfin rental summary instead of nearby numbers', () => {
    const url = new URL(
      'https://www.redfin.com/CA/Palo-Alto/4140-Old-Adobe-Rd-94306/home/1',
    );
    const result = extractListing(
      fixture('redfin-listing.html', url.href),
      url,
    );
    expect(result.siteName).toBe('Redfin');
    expect(result.listing.recurring.advertisedRent?.value).toBe(25_750);
    expect(result.listing.identity.bedrooms?.value).toBe(5);
    expect(result.listing.identity.bathrooms?.value).toBe(5.5);
    expect(result.listing.identity.squareFootage?.value).toBe(5_552);
    expect(result.listing.identity.fullAddress?.value).toBe(
      '4140 Old Adobe Rd',
    );
    expect(result.laundryType).toBe('in_unit');
  });

  it('reads Redfin labeled stats independently and preserves unavailable values', () => {
    const url = new URL(
      'https://www.redfin.com/NM/Santa-Fe/1450-Santiago-Loop-87507/home/137888201',
    );
    const document = new JSDOM(
      `
      <html><body>
        <main>
          <div class="home-main-stats">
            <div data-rf-test-name="stat-price"><div class="statsValue price"><span>$2,850</span>/mo</div></div>
            <div data-rf-test-name="stat-beds"><div class="statsValue">3</div><span>bd</span></div>
            <div data-rf-test-name="stat-baths"><div class="statsValue">2</div><span>ba</span></div>
            <div data-rf-test-name="stat-sqft"><span class="statsValue">—</span><span>sq ft</span></div>
            <header class="address">1450 Santiago Loop, Santa Fe, NM 87507</header>
          </div>
        </main>
        <script type="application/ld+json">{
          "@type":"Residence",
          "numberOfBedrooms":0,
          "numberOfBathroomsTotal":9,
          "floorSize":{"value":861}
        }</script>
      </body></html>
    `,
      { url: url.href },
    ).window.document;

    const result = extractListing(document, url);

    expect(result.listing.recurring.advertisedRent?.value).toBe(2_850);
    expect(result.rent).toMatchObject({
      kind: 'single',
      amount: { value: 2_850 },
    });
    expect(result.listing.identity.bedrooms?.value).toBe(3);
    expect(result.listing.identity.bathrooms?.value).toBe(2);
    expect(result.listing.identity.squareFootage).toBeUndefined();
    expect(result.listing.identity.fullAddress?.value).toBe(
      '1450 Santiago Loop',
    );
    expect(result.listing.identity.city?.value).toBe('Santa Fe');
  });

  it('scopes Homes.com apartment extraction to the opened unit modal', () => {
    const url = new URL(
      'https://www.homes.com/property/nexen-los-angeles-ca/example/#rentsight-unit=535',
    );
    const document = new JSDOM(`
      <html><body>
        <h1>NEXEN</h1>
        <div>Other floor plans from $2,095 to $3,400</div>
        <section class="unit-floorplan-modal" role="dialog">
          <header class="unit-floorplan-modal-header">
            <strong>535</strong><span>Studio · 1 Bath · 535 Sq Ft</span>
          </header>
          <section class="pricing-section">
            <span class="price-range">$2,145</span>
            <div class="deposit-amount">$1,000 Deposit</div>
            <div class="mf-rent-specials">
              <span class="mf-rent-specials__title">Select Homes - $1000 in Free Rent!</span>
            </div>
          </section>
          <ul><li class="amenity-item">Air Conditioning</li><li class="amenity-item">Washer/Dryer</li></ul>
        </section>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);
    expect(result.siteName).toBe('Homes.com');
    expect(result.listing.recurring.advertisedRent?.value).toBe(2_145);
    expect(result.listing.upfront.securityDeposit?.value).toBe(1_000);
    expect(result.listing.identity.bedrooms?.value).toBe(0);
    expect(result.listing.identity.bathrooms?.value).toBe(1);
    expect(result.listing.identity.squareFootage?.value).toBe(535);
    expect(result.listing.concessions?.oneTimeCredit?.value).toBe(1_000);
    expect(result.laundryType).toBe('in_unit');
  });

  it('preserves extraction for an individual Homes.com rental', () => {
    const url = new URL(
      'https://www.homes.com/property/700-e-gonzales-rd-unit-a/example/',
    );
    const document = new JSDOM(`
      <html><head><title>700 E Gonzales Rd Unit A</title></head><body>
        <div><strong>$2,695</strong> <span>Per Month</span></div>
        <h1>700 E Gonzales Rd Unit A</h1>
        <div>Oxnard, CA 93030</div>
        <section>
          <span>2 Beds</span><span>1.5 Baths</span><span>1,000 Sq Ft</span>
        </section>
        <p>Additional amenities include laundry room hook-ups.</p>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.siteName).toBe('Homes.com');
    expect(result.listing.recurring.advertisedRent?.value).toBe(2_695);
    expect(result.listing.identity.fullAddress?.value).toBe(
      '700 E Gonzales Rd Unit A',
    );
    expect(result.listing.identity.city?.value).toBe('Oxnard');
    expect(result.listing.identity.state?.value).toBe('CA');
    expect(result.listing.identity.zipCode?.value).toBe('93030');
    expect(result.listing.identity.bedrooms?.value).toBe(2);
    expect(result.listing.identity.bathrooms?.value).toBe(1.5);
    expect(result.listing.identity.squareFootage?.value).toBe(1_000);
    expect(result.laundryType).toBe('hookups_only');
  });

  it('extracts Homes.com total monthly price and an explicit pet deposit', () => {
    const url = new URL(
      'https://www.homes.com/property/1045-grammy-dr-las-vegas-nv/example/',
    );
    const document = new JSDOM(`
      <html><body>
        <div><strong>$2,265</strong> <span>Total Monthly Price</span></div>
        <h1>1045 Grammy Dr</h1>
        <div>Las Vegas, NV 89108</div>
        <section class="subcategory">
          <h3 class="amenity-name">Pet Policy</h3>
          <ul class="amenities-list">
            <li class="amenities-detail">Pets allowed on a case-by-case basis</li>
            <li class="amenities-detail">Pet Deposit $400</li>
          </ul>
        </section>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.listing.recurring.advertisedRent?.value).toBe(2_265);
    expect(result.listing.upfront.petDeposit).toMatchObject({ value: 400 });
  });

  it('extracts a Rent.com individual rental from stable listing fields', () => {
    const url = new URL(
      'https://www.rent.com/r/177-juniper-trail-sedona-az-lv3247079672',
    );
    const document = new JSDOM(`
      <html><body>
        <div data-tid="pdpKeyInfo_price">$30,598</div>
        <ul>
          <li data-tid="pdpKeyInfo_bedText">4 Beds</li>
          <li data-tid="pdpKeyInfo_bathText">3.5 Baths</li>
          <li data-tid="pdpKeyInfo_sqFt">3,250 Sqft</li>
        </ul>
        <h1 data-tid="property_title">177 Juniper Trail unit 1590584P</h1>
        <span data-tid="pdpKeyInfo_address">Sedona, AZ 86336</span>
        <ul>
          <li data-tid="amenity-highlight">Pet Friendly</li>
          <li data-tid="amenity-highlight">Washer &amp; Dryer</li>
          <li data-tid="amenity-highlight">High speed internet access</li>
        </ul>
        <section>The advertised rate of $30,598/month is the lowest available price.</section>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.siteName).toBe('Rent.com');
    expect(result.listing.recurring.advertisedRent?.value).toBe(30_598);
    expect(result.listing.identity.fullAddress?.value).toBe(
      '177 Juniper Trail unit 1590584P',
    );
    expect(result.listing.identity.city?.value).toBe('Sedona');
    expect(result.listing.identity.state?.value).toBe('AZ');
    expect(result.listing.identity.zipCode?.value).toBe('86336');
    expect(result.listing.identity.bedrooms?.value).toBe(4);
    expect(result.listing.identity.bathrooms?.value).toBe(3.5);
    expect(result.listing.identity.squareFootage?.value).toBe(3_250);
    expect(result.laundryType).toBe('in_unit');
    expect(result.includedUtilities).not.toContain('internet');
  });

  it('extracts Rent.com apartment facts, policies, and fees from stable sections', () => {
    const url = new URL(
      'https://www.rent.com/apartment/s-1031-villa-cortez-apartments-sedona-az-lc5929900',
    );
    const document = new JSDOM(`
      <html><body>
        <div data-tid="pdpKeyInfo_price">$1,675</div>
        <li data-tid="pdpKeyInfo_bedText">2 Beds</li>
        <li data-tid="pdpKeyInfo_bathText">2 Baths</li>
        <li data-tid="pdpKeyInfo_sqFt">1,008 Sqft</li>
        <h1 data-tid="property_title">S-1031 Villa Cortez Apartments</h1>
        <span data-tid="pdpKeyInfo_address">200 E Cortez Dr, Sedona, AZ 86351</span>
        <section id="listing-section-body-Pet-Policy"><div>Pets Allowed</div><div>Cats</div></section>
        <section id="listing-section-body-Amenities-and-Features"><div>Laundry</div><div>Off Street</div></section>
        <section id="listing-section-body-About-This-Property">
          Upstairs unit Security Deposit $1675.00 $100.00 placement fee
          1.5% administration fee= $25.12 $200 non-refundable painting and
          redecorating fee $250.00 refundable pet deposit (if applicable)
        </section>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.siteName).toBe('Rent.com');
    expect(result.listing.identity.bedrooms?.value).toBe(2);
    expect(result.listing.identity.bathrooms?.value).toBe(2);
    expect(result.listing.identity.squareFootage?.value).toBe(1_008);
    expect(result.listing.upfront.securityDeposit?.value).toBe(1_675);
    expect(result.listing.upfront.administrativeFee?.value).toBe(25.12);
    expect(result.listing.upfront.petDeposit?.value).toBe(250);
    expect(result.rawPetPolicyText).toContain('Pets Allowed');
    expect(result.laundryType).toBeUndefined();
  });

  it('combines a Rent.com floor-plan modal with property data underneath it', () => {
    const url = new URL(
      'https://www.rent.com/apartment/villa-veneto-at-palm-valley-san-jose-ca-lc5924120?fpld=lc5924120_2207019_1_1_0',
    );
    const document = new JSDOM(`
      <html><body>
        <div data-tid="pdpKeyInfo_price">$3,149+</div>
        <li data-tid="pdpKeyInfo_bedText">1–3 Beds</li>
        <li data-tid="pdpKeyInfo_bathText">1–2.5 Baths</li>
        <li data-tid="pdpKeyInfo_sqFt">833–1,406 Sqft</li>
        <h1 data-tid="property-title">Villa Veneto at Palm Valley</h1>
        <span data-tid="pdpKeyInfo_address">350 La Strada Dr, San Jose, CA 95123</span>
        <ul id="amenitiesHighlighted">
          <li data-tid="amenity-highlight">Pet Friendly</li>
          <li data-tid="amenity-highlight">Washer &amp; Dryer</li>
        </ul>
        <section id="listing-section-body-Pet-Policy">
          <div>Pets Allowed</div><div>Cats, Dogs</div>
          <div>Cat Rent</div><div>$50/mo</div>
          <div>Dog Rent</div><div>$75/mo</div>
          <div>Deposit</div><div>$500</div>
        </section>
        <dialog id="floor-plan-modal" data-tid="floorplan-modal" open>
          <div><h2>Il Palermo</h2><p>1 Bd, 1 Ba, 833 Sqft</p></div>
          <section data-tag_section="availability">
            <p>2 Units Available</p>
            <div>39823</div><div>$3,177</div>
            <div>39623</div><div>$3,149</div>
          </section>
          <section><h3>Special Offer</h3><p>Save up to $1,100</p></section>
        </dialog>
      </body></html>
    `).window.document;

    const result = extractListing(document, url);

    expect(result.listing.identity.listingTitle?.value).toBe(
      'Villa Veneto at Palm Valley',
    );
    expect(result.listing.identity.fullAddress?.value).toBe('350 La Strada Dr');
    expect(result.listing.identity.city?.value).toBe('San Jose');
    expect(result.listing.identity.state?.value).toBe('CA');
    expect(result.listing.identity.zipCode?.value).toBe('95123');
    expect(result.listing.identity.bedrooms?.value).toBe(1);
    expect(result.listing.identity.bathrooms?.value).toBe(1);
    expect(result.listing.identity.squareFootage?.value).toBe(833);
    expect(result.listing.recurring.advertisedRent?.value).toBe(3_149);
    expect(result.listing.recurring.petRent?.value).toBe(50);
    expect(result.listing.upfront.petDeposit?.value).toBe(500);
    expect(result.laundryType).toBe('in_unit');
  });

  it('extracts generic visible text and supporting classifications', () => {
    const result = extractListing(
      fixture('generic-listing.html'),
      new URL('https://example.com/rental'),
    );
    expect(result.listing.recurring.advertisedRent?.value).toBe(1_950);
    expect(result.listing.identity.zipCode?.value).toBe('98000');
    expect(result.laundryType).toBe('hookups_only');
    expect(result.includedUtilities).toEqual(
      expect.arrayContaining(['naturalGas', 'water']),
    );
  });

  it('returns missing fields without throwing', () => {
    const document = new JSDOM(
      '<html><head><title>Blank</title></head><body></body></html>',
    ).window.document;
    const result = extractListing(document, new URL('https://example.com'));
    expect(result.listing.recurring.advertisedRent).toBeUndefined();
  });

  it('does not choose between conflicting prices', () => {
    const url = new URL('https://www.zillow.com/homedetails/example/2_zpid/');
    const result = extractListing(
      fixture('conflicting-rent.html', url.href),
      url,
    );
    expect(result.rent?.kind).toBe('conflict');
    expect(result.listing.recurring.advertisedRent).toBeUndefined();
  });
});

describe('phrase classification', () => {
  it('classifies only explicit no-pets policy language', () => {
    expect(classifyNoPetsPolicy('Notes: No Pets')).toBe('No Pets');
    expect(classifyNoPetsPolicy('Pets are not permitted.')).toBe(
      'Pets are not permitted',
    );
    expect(classifyNoPetsPolicy('No pet fees are charged.')).toBeUndefined();
  });

  it.each([
    ['In-unit washer and dryer', 'in_unit'],
    ['Card-operated laundry room', 'shared_paid'],
    ['Free shared laundry', 'shared_free'],
    ['Washer/dryer hookups only', 'hookups_only'],
    ['No laundry available', 'none'],
  ] as const)('classifies %s', (phrase, expected) =>
    expect(classifyLaundry(phrase)).toBe(expected),
  );

  it('classifies named and all-inclusive utilities', () => {
    expect(
      classifyIncludedUtilities('Water, sewer and trash included'),
    ).toEqual(expect.arrayContaining(['water', 'trash']));
    expect(classifyIncludedUtilities('All utilities included')).toHaveLength(6);
    expect(
      classifyIncludedUtilities('All utilities and hot tub included.'),
    ).toHaveLength(6);
  });

  it('does not treat a list of available utilities as included in rent', () => {
    expect(
      classifyIncludedUtilities(
        'Utilities include electricity, gas, water/sewer, trash/compost/recycle, and hi-speed wi-fi internet.',
      ),
    ).toEqual([]);
    expect(classifyIncludedUtilities('Electricity is not included.')).toEqual(
      [],
    );
  });

  it('classifies utilities only when payment language is explicit', () => {
    const allUtilities = classifyIncludedUtilities(
      'Rent: $3,995 per month (including all utilities)',
    );
    expect(allUtilities).toHaveLength(6);
    expect(allUtilities).toContain('naturalGas');
    expect(
      classifyIncludedUtilities(
        'Landlord pays for water, sewer, trash, and wi-fi.',
      ),
    ).toEqual(expect.arrayContaining(['water', 'sewer', 'trash', 'internet']));
  });
});
