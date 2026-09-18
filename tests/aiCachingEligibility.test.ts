import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  canonicalizeListingUrl,
  listingCacheIdentity,
  listingCacheKey,
} from '../src/ai/identity';
import { relevantContentFingerprint } from '../src/ai/fingerprint';
import { scoreListingPage } from '../src/ai/eligibility';
import { captureListing } from '../src/ai/capture';
import { emptyExtraction } from '../src/extractors/types';

const capture = (html: string) => {
  const document = new JSDOM(`<main>${html}</main>`).window.document;
  return captureListing(document, emptyExtraction('test', '1'));
};

describe('AI cache identity and fingerprint', () => {
  it('groups adjacent dynamic text fragments into one evidence block', () => {
    const result = capture(
      '<div><span>$3,845</span><span>3 Beds</span><span>1,511 sqft</span></div>',
    );
    expect(
      result.capture.blocks.some(
        (block) => block.text === '$3,845\n3 Beds\n1,511 sqft',
      ),
    ).toBe(true);
  });

  it('drops tracking parameters while preserving listing identifiers', () => {
    expect(
      canonicalizeListingUrl(
        'https://EXAMPLE.com/listing?utm_source=x&id=42&unit=7#photos',
      ),
    ).toBe('https://example.com/listing?id=42&unit=7');
    expect(
      listingCacheKey(
        listingCacheIdentity({
          url: 'https://example.com/a',
          selectedUnit: '1',
        }),
      ),
    ).not.toBe(
      listingCacheKey(
        listingCacheIdentity({
          url: 'https://example.com/a',
          selectedUnit: '2',
        }),
      ),
    );
    expect(
      listingCacheKey(
        listingCacheIdentity({
          url: 'https://example.com/a',
          selectedLeaseTermMonths: 12,
        }),
      ),
    ).not.toBe(
      listingCacheKey(
        listingCacheIdentity({
          url: 'https://example.com/a',
          selectedLeaseTermMonths: 18,
        }),
      ),
    );
  });
  it('changes for rent but ignores navigation and relative timestamps', () => {
    const original = relevantContentFingerprint(
      capture(
        '<nav>Buy Sell</nav><h1>Pine Court</h1><p>Rent $2,400 per month</p><p>Updated today</p>',
      ),
    );
    const chromeChange = relevantContentFingerprint(
      capture(
        '<nav>New navigation</nav><h1>Pine Court</h1><p>Rent $2,400 per month</p><p>Updated 2 hours ago</p>',
      ),
    );
    const rentChange = relevantContentFingerprint(
      capture('<h1>Pine Court</h1><p>Rent $2,550 per month</p>'),
    );
    expect(chromeChange).toBe(original);
    expect(rentChange).not.toBe(original);
  });
});

describe('soft listing eligibility', () => {
  it('classifies a detail page as high confidence', () => {
    const document = new JSDOM(
      '<main><h1>Pine Court</h1><p>123 Main Street</p><p>$2,400 rent · 2 beds · 2 baths · 900 sq ft</p><button>Request a tour</button></main>',
    ).window.document;
    const result = scoreListingPage(
      document,
      new URL('https://example.com/listing/42'),
    );
    expect(result, JSON.stringify(result)).toMatchObject({
      classification: 'high',
    });
  });
  it('uses a coherent local extraction when the visible page shell is sparse', () => {
    const document = new JSDOM(
      '<main><div>Photos</div></main><aside>Listing details loaded elsewhere</aside>',
    ).window.document;
    const extraction = emptyExtraction('Zillow', '1');
    extraction.listing.identity.fullAddress = {
      value: '3212 Altman Dr, Dallas, TX 75229',
      source: 'listing',
      confidence: 0.95,
    };
    extraction.listing.recurring.advertisedRent = {
      value: 4_125,
      source: 'listing',
      confidence: 0.95,
    };

    const result = scoreListingPage(
      document,
      new URL(
        'https://www.zillow.com/homedetails/3212-Altman-Dr/26808017_zpid/',
      ),
      extraction,
    );

    expect(result).toMatchObject({
      classification: 'high',
      pageShape: 'detail',
      transaction: 'rental',
      isRentalListing: true,
    });
    expect(result.positiveSignals).toEqual(
      expect.arrayContaining(['extracted-identity', 'extracted-rent']),
    );
  });
  it('does not let extracted rent override explicit sale evidence', () => {
    const document = new JSDOM(
      '<main><h1>123 Main Street</h1><p>For sale · $825,000</p><p>Estimated mortgage $4,900/mo</p></main>',
    ).window.document;
    const extraction = emptyExtraction('Test', '1');
    extraction.listing.identity.fullAddress = {
      value: '123 Main Street',
      source: 'listing',
      confidence: 0.9,
    };
    extraction.listing.recurring.advertisedRent = {
      value: 4_900,
      source: 'listing',
      confidence: 0.5,
    };

    const result = scoreListingPage(
      document,
      new URL('https://example.com/property/123'),
      extraction,
    );

    expect(result.transaction).toBe('sale');
    expect(result.isRentalListing).toBe(false);
  });
  it('does not let one extracted record promote a collection page', () => {
    const cards = Array.from(
      { length: 8 },
      (_, i) =>
        `<article class="listing-card"><p>${i} Main St</p><p>$${2000 + i}</p></article>`,
    ).join('');
    const document = new JSDOM(
      `<main><p>681 rentals available</p>${cards}</main>`,
    ).window.document;
    const extraction = emptyExtraction('Test', '1');
    extraction.listing.identity.fullAddress = {
      value: '1 Main St',
      source: 'listing',
      confidence: 0.9,
    };
    extraction.listing.recurring.advertisedRent = {
      value: 2_000,
      source: 'listing',
      confidence: 0.9,
    };

    const result = scoreListingPage(
      document,
      new URL('https://example.com/search'),
      extraction,
    );

    expect(result.pageShape).toBe('collection');
    expect(result.isRentalListing).toBe(false);
    expect(result.classification).toBe('low');
  });
  it('classifies repeated search cards as low confidence', () => {
    const cards = Array.from(
      { length: 8 },
      (_, i) =>
        `<article class="listing-card"><p>${i} Main St</p><p>$${2000 + i}</p></article>`,
    ).join('');
    const document = new JSDOM(
      `<main><p>681 rentals available</p>${cards}</main>`,
    ).window.document;
    expect(
      scoreListingPage(document, new URL('https://example.com/search'))
        .classification,
    ).toBe('low');
  });
  it('recognizes an unknown-site rental detail page without URL hints', () => {
    const document = new JSDOM(`
      <main>
        <h1>3047 Bridgehampton Way</h1>
        <p>Camarillo, CA 93012</p>
        <p>$7,000/mo</p>
        <p>4 beds · 3 baths · 2,800 sq ft</p>
        <button>Apply</button><button>Message</button>
      </main>
    `).window.document;
    const result = scoreListingPage(
      document,
      new URL('https://unknown.example/property/abc123'),
    );
    expect(result.pageShape).toBe('detail');
    expect(result.transaction).toBe('rental');
    expect(result.isRentalListing).toBe(true);
    expect(result.classification).toBe('high');
  });
  it('does not treat a sale listing with a monthly mortgage estimate as rental', () => {
    const document = new JSDOM(`
      <main>
        <h1>123 Main Street</h1>
        <p>For sale · $825,000</p>
        <p>Estimated mortgage $4,900/mo with 20% down payment</p>
        <p>4 beds · 3 baths · 2,100 sq ft</p>
        <button>Schedule a tour</button>
      </main>
    `).window.document;
    const result = scoreListingPage(
      document,
      new URL('https://unknown.example/property/abc123'),
    );
    expect(result.pageShape).toBe('detail');
    expect(result.transaction).toBe('sale');
    expect(result.isRentalListing).toBe(false);
  });
  it('allows an ambiguous shell to be promoted when a detail drawer appears', () => {
    const dom = new JSDOM('<main><h1>Rentals</h1></main>');
    expect(
      scoreListingPage(
        dom.window.document,
        new URL('https://example.com/rentals'),
      ).classification,
    ).not.toBe('high');
    dom.window.document
      .querySelector('main')!
      .insertAdjacentHTML(
        'beforeend',
        '<section><p>123 Main Street</p><p>$2,400 rent, 2 beds, 900 sq ft</p><button>Apply</button></section>',
      );
    expect(
      scoreListingPage(
        dom.window.document,
        new URL('https://example.com/rentals'),
      ).classification,
    ).toBe('high');
  });
});
