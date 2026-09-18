import type { ListingExtraction } from '../extractors';

export type EligibilityClassification = 'high' | 'medium' | 'low';
export type ListingPageShape = 'detail' | 'collection' | 'non-listing';
export type ListingTransaction = 'rental' | 'sale' | 'ambiguous';
export interface ListingEligibility {
  classification: EligibilityClassification;
  pageShape: ListingPageShape;
  transaction: ListingTransaction;
  isRentalListing: boolean;
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
  const extractedRent = extraction?.listing.recurring.advertisedRent?.value;
  const hasPlausibleExtractedRent =
    typeof extractedRent === 'number' &&
    Number.isFinite(extractedRent) &&
    extractedRent > 0;
  const positives: [boolean, number, string][] = [
    [document.querySelectorAll('h1').length === 1, 2, 'single-heading'],
    [
      /\d{1,6}\s+[A-Za-z0-9.' -]+\s(?:st|street|ave|avenue|rd|road|blvd|boulevard|drive|dr|lane|ln|way|court|ct|circle|terrace|parkway|place|pl)\b/i.test(
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
      /\b(?:beds?|baths?|sq\.?\s*ft|square feet|available)\b/i.test(text),
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
    [hasPlausibleExtractedRent, 3, 'extracted-rent'],
    [
      Boolean(
        extraction?.listing.identity.bedrooms ||
        extraction?.listing.identity.bathrooms ||
        extraction?.listing.identity.squareFootage,
      ),
      2,
      'extracted-property-facts',
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
  const hasCollectionEvidence =
    negativeSignals.includes('many-listing-cards') ||
    negativeSignals.includes('result-count') ||
    negativeSignals.includes('search-filters');
  const hasPropertyIdentity =
    positiveSignals.includes('street-address') ||
    positiveSignals.includes('extracted-identity');
  const hasPropertyFacts = positiveSignals.includes('property-facts');
  const hasExtractedPropertyFacts =
    positiveSignals.includes('extracted-rent') ||
    positiveSignals.includes('extracted-property-facts');
  const hasDetailAction = positiveSignals.includes('listing-action');
  const rentalSignalCount = [
    /\b(?:house|home|apartment|condo|townhouse)?\s*for rent\b/i.test(text),
    /\bmonthly rent\b/i.test(text),
    /(?:\brent\s*[:-]?\s*\$\s?[\d,]+|\$\s?[\d,]+(?:\.\d{2})?\s*rent\b)/i.test(
      text,
    ),
    /\$\s?[\d,]+(?:\.\d{2})?\s*(?:\/\s*(?:mo|month)|per month)\b/i.test(text),
    /\b(?:lease term|security deposit|move[- ]in date|request to apply)\b/i.test(
      text,
    ),
    positiveSignals.includes('extracted-rent'),
  ].filter(Boolean).length;
  const saleSignalCount = [
    /\bfor sale\b/i.test(text),
    /\b(?:mortgage|down payment|purchase price|open house|MLS)\b/i.test(text),
  ].filter(Boolean).length;
  // Explicit sale language wins over inferred rental evidence. This prevents a
  // mortgage estimate or another monthly amount from promoting a sale page.
  const transaction: ListingTransaction =
    saleSignalCount > 0
      ? 'sale'
      : rentalSignalCount > 0
        ? 'rental'
        : 'ambiguous';
  const pageShape: ListingPageShape = hasCollectionEvidence
    ? 'collection'
    : hasPropertyIdentity &&
        (hasPropertyFacts || hasExtractedPropertyFacts || hasDetailAction)
      ? 'detail'
      : 'non-listing';
  const isRentalListing = pageShape === 'detail' && transaction === 'rental';
  const classification: EligibilityClassification =
    isRentalListing && score >= 5
      ? 'high'
      : pageShape === 'collection' || score <= 0
        ? 'low'
        : 'medium';
  return {
    classification,
    pageShape,
    transaction,
    isRentalListing,
    score,
    positiveSignals,
    negativeSignals,
  };
}
