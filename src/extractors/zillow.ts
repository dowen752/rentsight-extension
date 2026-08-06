import {
  classifyIncludedUtilities,
  classifyLaundry,
  listingValue,
  parseMoney,
  parseNumberNear,
  parseRentEvidence,
  parseUsAddress,
} from './parsers';
import { emptyExtraction, type ListingExtractor } from './types';

export const zillowExtractor: ListingExtractor = {
  siteName: 'Zillow',
  version: '1.1.0',
  matches(url) {
    return (
      /(^|\.)zillow\.com$/i.test(url.hostname) &&
      /\/(?:homedetails|apartments)\//i.test(url.pathname)
    );
  },
  extract(document, url) {
    const result = emptyExtraction(this.siteName, this.version);
    const pick = (selectors: string) =>
      document.querySelector(selectors)?.textContent?.trim();
    const body = document.body.textContent ?? '';
    const isApartmentCommunity = /\/apartments\//i.test(url.pathname);
    const heading = pick('h1');
    const explicitAddress = pick(
      '[data-testid="bdp-building-address"], [data-testid="building-address"], [data-testid="property-address"], .property-address',
    );
    const addressText =
      explicitAddress ?? (!isApartmentCommunity ? heading : undefined);
    const parsedAddress = addressText ? parseUsAddress(addressText) : undefined;
    const rentTexts = [
      ...document.querySelectorAll(
        '[data-testid="price"], [data-testid="rent"], [data-testid*="rent-price"], [data-testid="rent-zestimate"], .ds-price',
      ),
    ].map((node) => node.textContent ?? '');
    if (isApartmentCommunity && heading) {
      result.listing.identity.listingTitle = listingValue(
        heading,
        0.88,
        heading,
      );
    }
    if (parsedAddress) {
      result.listing.identity.fullAddress = listingValue(
        parsedAddress.fullAddress,
        0.88,
        addressText,
      );
      result.listing.identity.city = listingValue(
        parsedAddress.city,
        0.88,
        addressText,
      );
      result.listing.identity.state = listingValue(
        parsedAddress.state,
        0.88,
        addressText,
      );
      result.listing.identity.zipCode = listingValue(
        parsedAddress.zipCode,
        0.88,
        addressText,
      );
    } else if (explicitAddress ?? heading) {
      const address = explicitAddress ?? heading!;
      result.listing.identity.fullAddress = listingValue(
        address,
        0.72,
        address,
      );
    }
    result.rent = parseRentEvidence(rentTexts, 0.86);
    if (result.rent?.kind === 'single')
      result.listing.recurring.advertisedRent = result.rent.amount;
    const facts =
      pick(
        '[data-testid="bed-bath-sqft-facts"], [aria-label="Bed bath sqft facts"], [data-testid="bed-bath-beyond"], [data-testid="facts-and-features"]',
      ) ?? '';
    const beds =
      /\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?\s*(?:beds?|bd)(?=\s|\d|$)/i.test(
        facts,
      )
        ? undefined
        : parseNumberNear(facts, /(\d+(?:\.\d+)?)\s*(?:beds?|bd)(?=\s|\d|$)/i);
    const baths = parseNumberNear(
      facts,
      /(\d+(?:\.\d+)?)\s*(?:baths?|ba)(?=\s|\d|$)/i,
    );
    const sqft = parseNumberNear(
      facts,
      /([\d,]+)\s*(?:sq\.?\s*ft|sqft)(?=\s|\d|$)/i,
    );
    if (beds !== undefined)
      result.listing.identity.bedrooms = listingValue(beds, 0.84, facts);
    if (baths !== undefined)
      result.listing.identity.bathrooms = listingValue(baths, 0.84, facts);
    if (sqft !== undefined)
      result.listing.identity.squareFootage = listingValue(sqft, 0.84, facts);
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
