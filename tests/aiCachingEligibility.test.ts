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
    expect(
      scoreListingPage(document, new URL('https://example.com/listing/42'))
        .classification,
    ).toBe('high');
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
