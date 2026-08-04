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
    expect(result.listing.identity.bedrooms?.value).toBe(3);
    expect(result.listing.upfront.securityDeposit?.value).toBe(2_000);
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
});
