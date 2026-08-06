import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { extractListing } from '../src/extractors';
import { extractJsonLd } from '../src/extractors/jsonLd';
import {
  classifyIncludedUtilities,
  classifyLaundry,
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
