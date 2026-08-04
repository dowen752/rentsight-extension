import {
  classifyIncludedUtilities,
  classifyLaundry,
  listingValue,
  parseMoney,
  parseNumberNear,
  parseRentEvidence,
} from './parsers';
import { emptyExtraction, type ListingExtractor } from './types';

export const zillowExtractor: ListingExtractor = {
  siteName: 'Zillow',
  version: '1.0.0',
  matches(url) {
    return (
      /(^|\.)zillow\.com$/i.test(url.hostname) &&
      /\/homedetails\//i.test(url.pathname)
    );
  },
  extract(document) {
    const result = emptyExtraction(this.siteName, this.version);
    const pick = (selectors: string) =>
      document.querySelector(selectors)?.textContent?.trim();
    const address = pick('[data-testid="bdp-building-address"], h1');
    const rentTexts = [
      ...document.querySelectorAll(
        '[data-testid="price"], [data-testid="rent-zestimate"], .ds-price',
      ),
    ].map((node) => node.textContent ?? '');
    if (address)
      result.listing.identity.fullAddress = listingValue(
        address,
        0.88,
        address,
      );
    result.rent = parseRentEvidence(rentTexts, 0.86);
    if (result.rent?.kind === 'single')
      result.listing.recurring.advertisedRent = result.rent.amount;
    const facts =
      pick(
        '[data-testid="bed-bath-beyond"], [data-testid="facts-and-features"]',
      ) ??
      document.body.textContent ??
      '';
    const beds = parseNumberNear(facts, /(\d+(?:\.\d+)?)\s*(?:beds?|bd)\b/i);
    const baths = parseNumberNear(facts, /(\d+(?:\.\d+)?)\s*(?:baths?|ba)\b/i);
    const sqft = parseNumberNear(facts, /([\d,]+)\s*(?:sq\.?\s*ft|sqft)/i);
    if (beds !== undefined)
      result.listing.identity.bedrooms = listingValue(beds, 0.84, facts);
    if (baths !== undefined)
      result.listing.identity.bathrooms = listingValue(baths, 0.84, facts);
    if (sqft !== undefined)
      result.listing.identity.squareFootage = listingValue(sqft, 0.84, facts);
    const body = document.body.textContent ?? '';
    const deposit = body.match(/security deposit[^.\n]*\$[\d,]+/i)?.[0];
    if (deposit)
      result.listing.upfront.securityDeposit = listingValue(
        parseMoney(deposit)!,
        0.72,
        deposit,
      );
    result.includedUtilities = classifyIncludedUtilities(body);
    result.laundryType = classifyLaundry(body);
    return result;
  },
};
