import {
  classifyIncludedUtilities,
  classifyLaundry,
  listingValue,
  parseMoney,
  parseNumberNear,
  parseUsAddress,
} from './parsers';
import { emptyExtraction, type ListingExtractor } from './types';

export const redfinExtractor: ListingExtractor = {
  siteName: 'Redfin',
  version: '1.0.0',
  matches(url) {
    return /(^|\.)redfin\.com$/i.test(url.hostname);
  },
  extract(document) {
    const result = emptyExtraction(this.siteName, this.version);
    const body = document.body.textContent?.replace(/\s+/g, ' ') ?? '';
    const summary = body.match(
      /(\$[\d,]+\s*\/\s*mo\b)[\s\S]{0,240}?(\d+(?:\.\d+)?)\s*bd\b[\s\S]{0,80}?(\d+(?:\.\d+)?)\s*ba\b[\s\S]{0,80}?([\d,]+)\s*sq\s*ft\b/i,
    );
    const address = parseUsAddress(
      summary?.index !== undefined
        ? body.slice(summary.index + summary[0].length)
        : body,
    );
    if (address) {
      result.listing.identity.listingTitle = listingValue(
        address.fullAddress,
        0.88,
      );
      result.listing.identity.fullAddress = listingValue(
        address.fullAddress,
        0.9,
      );
      result.listing.identity.city = listingValue(address.city, 0.9);
      result.listing.identity.state = listingValue(address.state, 0.9);
      result.listing.identity.zipCode = listingValue(address.zipCode, 0.9);
    }
    if (summary) {
      result.listing.recurring.advertisedRent = listingValue(
        parseMoney(summary[1])!,
        0.9,
        summary[0],
      );
      result.listing.identity.bedrooms = listingValue(
        parseNumberNear(summary[2], /(\d+(?:\.\d+)?)/)!,
        0.9,
        summary[0],
      );
      result.listing.identity.bathrooms = listingValue(
        parseNumberNear(summary[3], /(\d+(?:\.\d+)?)/)!,
        0.9,
        summary[0],
      );
      result.listing.identity.squareFootage = listingValue(
        parseNumberNear(summary[4], /([\d,]+)/)!,
        0.9,
        summary[0],
      );
    }
    result.includedUtilities = classifyIncludedUtilities(body);
    result.laundryType = classifyLaundry(body);
    return result;
  },
};
