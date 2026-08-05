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
  version: '1.0.0',
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
      '[data-testid="bdp-building-address"], [data-testid="building-address"], address, .property-address',
    );
    const parsedAddress = parseUsAddress(explicitAddress ?? body);
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
        explicitAddress ?? parsedAddress.fullAddress,
      );
      result.listing.identity.city = listingValue(
        parsedAddress.city,
        0.88,
        explicitAddress ?? parsedAddress.fullAddress,
      );
      result.listing.identity.state = listingValue(
        parsedAddress.state,
        0.88,
        explicitAddress ?? parsedAddress.fullAddress,
      );
      result.listing.identity.zipCode = listingValue(
        parsedAddress.zipCode,
        0.88,
        explicitAddress ?? parsedAddress.fullAddress,
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
        '[data-testid="bed-bath-beyond"], [data-testid="facts-and-features"]',
      ) ??
      document.body.textContent ??
      '';
    const beds =
      /\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?\s*(?:beds?|bd)\b/i.test(
        facts,
      )
        ? undefined
        : parseNumberNear(facts, /(\d+(?:\.\d+)?)\s*(?:beds?|bd)\b/i);
    const baths = parseNumberNear(facts, /(\d+(?:\.\d+)?)\s*(?:baths?|ba)\b/i);
    const sqft = parseNumberNear(facts, /([\d,]+)\s*(?:sq\.?\s*ft|sqft)/i);
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
