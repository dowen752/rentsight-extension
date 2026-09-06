import type { ListingExtraction } from '../extractors';

export type EligibilityClassification = 'high' | 'medium' | 'low';
export interface ListingEligibility {
  classification: EligibilityClassification;
  score: number;
  positiveSignals: string[];
  negativeSignals: string[];
}

export function scoreListingPage(
  document: Document,
  url: URL,
  extraction?: ListingExtraction,
): ListingEligibility {
  const text =
    (
      document.querySelector('main, [role="main"]') ?? document.body
    )?.textContent?.replace(/\s+/g, ' ') ?? '';
  const positives: [boolean, number, string][] = [
    [document.querySelectorAll('h1').length === 1, 2, 'single-heading'],
    [
      /\d{1,6}\s+[A-Za-z0-9.' -]+\s(?:st|street|ave|avenue|rd|road|blvd|drive|dr|lane|ln)\b/i.test(
        text,
      ),
      3,
      'street-address',
    ],
    [
      document.querySelectorAll('script[type="application/ld+json"]').length >
        0,
      2,
      'structured-data',
    ],
    [
      /\$\s?[\d,]+/.test(text) && /\b(?:rent|month|mo)\b/i.test(text),
      2,
      'detail-rent',
    ],
    [
      /\b(?:bed|bath|sq\.?\s*ft|square feet|available)\b/i.test(text),
      2,
      'property-facts',
    ],
    [
      /\b(?:apply|request a tour|contact property|schedule a tour)\b/i.test(
        text,
      ),
      2,
      'listing-action',
    ],
    [
      Boolean(
        extraction?.listing.identity.fullAddress ||
        extraction?.listing.identity.listingTitle,
      ),
      2,
      'extracted-identity',
    ],
  ];
  const repeatedCards = document.querySelectorAll(
    '[class*="listing-card" i], [data-testid*="property-card" i], article',
  ).length;
  const moneyCount = (text.match(/\$\s?[\d,]+/g) ?? []).length;
  const negatives: [boolean, number, string][] = [
    [repeatedCards >= 4, 5, 'many-listing-cards'],
    [
      /\b\d+\s+(?:rentals?|results?)\s+(?:available|found)\b/i.test(text),
      5,
      'result-count',
    ],
    [
      document.querySelectorAll(
        'form [type="search"], [aria-label*="filter" i]',
      ).length > 1,
      3,
      'search-filters',
    ],
    [moneyCount >= 8 && repeatedCards >= 2, 3, 'many-unrelated-prices'],
    [
      /\/(search|favorites|account|category)(?:\/|$)/i.test(url.pathname),
      4,
      'non-detail-route',
    ],
  ];
  const positiveSignals = positives
    .filter(([yes]) => yes)
    .map(([, , name]) => name);
  const negativeSignals = negatives
    .filter(([yes]) => yes)
    .map(([, , name]) => name);
  const score =
    positives.reduce((sum, [yes, points]) => sum + (yes ? points : 0), 0) -
    negatives.reduce((sum, [yes, points]) => sum + (yes ? points : 0), 0);
  return {
    classification:
      score >= 5 && !negativeSignals.includes('many-listing-cards')
        ? 'high'
        : score <= 0
          ? 'low'
          : 'medium',
    score,
    positiveSignals,
    negativeSignals,
  };
}
