import {
  classifyIncludedUtilities,
  classifyLaundry,
  classifyNoPetsPolicy,
  listingValue,
  parseBedBathShorthand,
  parseNumberNear,
  parseRentEvidence,
  parseUsAddress,
} from './parsers';
import { emptyExtraction, type ListingExtractor } from './types';
import { FEE_NOISE, feeRoot } from './feeRows';

const MAX_PAGE_TEXT = 300_000;
const MAX_VISIBLE_FRAGMENTS = 2_000;

export const genericExtractor: ListingExtractor = {
  siteName: 'Generic listing page',
  version: '1.0.0',
  matches: () => true,
  extract(document) {
    const result = emptyExtraction(this.siteName, this.version);
    // textContent avoids a forced layout. Bound all generic work because this
    // code executes on the host page's main thread.
    const content = feeRoot(document).cloneNode(true) as Element;
    content.querySelectorAll(FEE_NOISE).forEach((node) => node.remove());
    const body = (content.textContent ?? '').slice(0, MAX_PAGE_TEXT);
    result.listing.identity.listingTitle = document.title
      ? listingValue(document.title, 0.55)
      : undefined;
    const address = parseUsAddress(body);
    if (address) {
      result.listing.identity.fullAddress = listingValue(
        address.fullAddress,
        0.6,
        address.fullAddress,
      );
      result.listing.identity.city = listingValue(
        address.city,
        0.6,
        address.fullAddress,
      );
      result.listing.identity.state = listingValue(
        address.state,
        0.6,
        address.fullAddress,
      );
      result.listing.identity.zipCode = listingValue(
        address.zipCode,
        0.6,
        address.fullAddress,
      );
    }
    const visibleFragments: string[] = [];
    for (const node of content.querySelectorAll(
      'h1, h2, p, li, [data-testid*="rent"]',
    )) {
      visibleFragments.push((node.textContent ?? '').trim().slice(0, 2_000));
      if (visibleFragments.length >= MAX_VISIBLE_FRAGMENTS) break;
    }
    const rentLines = visibleFragments.filter(
      (line) =>
        /^\s*(?:(?:the|advertised)\s+)?(?:monthly\s+)?rent\s*(?::|is|from)?\s*\$[\d,]+/i.test(
          line,
        ) || /^\s*\$[\d,]+\s*(?:\/|per)\s*(?:mo|month)/i.test(line),
    );
    result.rent = parseRentEvidence(rentLines, 0.55);
    if (result.rent?.kind === 'single')
      result.listing.recurring.advertisedRent = result.rent.amount;
    const shorthand = parseBedBathShorthand(body);
    const bedrooms =
      (shorthand?.bedrooms ??
      /\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?\s*(?:bed(?:room)?s?|bd)\b/i.test(
        body,
      ))
        ? undefined
        : parseNumberNear(body, /(\d+(?:\.\d+)?)\s*(?:bed(?:room)?s?|bd)\b/i);
    const bathrooms =
      (shorthand?.bathrooms ??
      /\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?\s*(?:bath(?:room)?s?|ba)\b/i.test(
        body,
      ))
        ? undefined
        : parseNumberNear(body, /(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?|ba)\b/i);
    const squareFeet =
      /[\d,]+\s*(?:-|–|—|to)\s*[\d,]+\s*(?:sq\.?\s*ft|square feet)\b/i.test(
        body,
      )
        ? undefined
        : parseNumberNear(body, /([\d,]+)\s*(?:sq\.?\s*ft|square feet)\b/i);
    if (bedrooms !== undefined)
      result.listing.identity.bedrooms = listingValue(
        bedrooms,
        shorthand ? 0.82 : 0.58,
        shorthand?.rawText,
      );
    if (bathrooms !== undefined)
      result.listing.identity.bathrooms = listingValue(
        bathrooms,
        shorthand ? 0.82 : 0.58,
        shorthand?.rawText,
      );
    if (squareFeet !== undefined)
      result.listing.identity.squareFootage = listingValue(squareFeet, 0.58);
    const lease = parseNumberNear(body, /(\d+)\s*(?:-\s*)?month lease/i);
    const freeMonths = parseNumberNear(body, /(\d+(?:\.\d+)?)\s*months? free/i);
    if (lease !== undefined || freeMonths !== undefined) {
      result.listing.concessions = {};
      if (lease !== undefined)
        result.listing.concessions.leaseMonths = listingValue(lease, 0.58);
      if (freeMonths !== undefined)
        result.listing.concessions.monthsFree = listingValue(freeMonths, 0.55);
    }
    result.includedUtilities = classifyIncludedUtilities(body);
    result.rawUtilityText = body.match(
      /[^\n.]*(?:utilities|water|sewer|trash|electric|gas|internet)[^\n.]*(?:included)[^\n.]*/i,
    )?.[0];
    result.laundryType = classifyLaundry(body);
    result.rawLaundryText = body.match(
      /[^\n.]*(?:laundry|washer|dryer)[^\n.]*/i,
    )?.[0];
    result.rawPetPolicyText = classifyNoPetsPolicy(body);
    if (result.rawPetPolicyText) result.petPolicy = 'none';
    return result;
  },
};
