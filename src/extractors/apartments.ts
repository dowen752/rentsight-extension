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

export const apartmentsExtractor: ListingExtractor = {
  siteName: 'Apartments.com',
  version: '1.0.0',
  matches(url) {
    return /(^|\.)apartments\.com$/i.test(url.hostname);
  },
  extract(document) {
    const result = emptyExtraction(this.siteName, this.version);
    const pick = (selectors: string) =>
      document.querySelector(selectors)?.textContent?.trim();
    const title = pick('h1.propertyName, h1');
    const addressText = pick(
      '.propertyAddress, [data-testid="property-address"]',
    );
    const address = addressText ? parseUsAddress(addressText) : undefined;
    if (title)
      result.listing.identity.listingTitle = listingValue(title, 0.9, title);
    if (address) {
      result.listing.identity.fullAddress = listingValue(
        address.fullAddress,
        0.9,
        addressText,
      );
      result.listing.identity.city = listingValue(address.city, 0.9);
      result.listing.identity.state = listingValue(address.state, 0.9);
      result.listing.identity.zipCode = listingValue(address.zipCode, 0.9);
    } else if (addressText) {
      result.listing.identity.fullAddress = listingValue(
        addressText,
        0.72,
        addressText,
      );
    }
    const rentTexts = [
      ...document.querySelectorAll(
        '.rentInfoDetail, .rentRange, [data-testid="rent"]',
      ),
    ].map((node) => node.textContent ?? '');
    result.rent = parseRentEvidence(rentTexts, 0.88);
    if (result.rent?.kind === 'single')
      result.listing.recurring.advertisedRent = result.rent.amount;
    const body = document.body.textContent ?? '';
    const beds =
      /(?:studio|\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?\s*(?:beds?|bedrooms?|bd)\b/i.test(
        body,
      )
        ? undefined
        : parseNumberNear(body, /(\d+(?:\.\d+)?)\s*(?:beds?|bedrooms?)\b/i);
    const baths =
      /\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?\s*(?:baths?|ba)\b/i.test(
        body,
      )
        ? undefined
        : parseNumberNear(body, /(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?)\b/i);
    const sqft =
      /[\d,]+\s*(?:-|–|—|to)\s*[\d,]+\s*(?:sq\.?\s*ft|square feet)/i.test(body)
        ? undefined
        : parseNumberNear(body, /([\d,]+)\s*(?:sq\.?\s*ft|square feet)/i);
    if (beds !== undefined)
      result.listing.identity.bedrooms = listingValue(beds, 0.8);
    if (baths !== undefined)
      result.listing.identity.bathrooms = listingValue(baths, 0.8);
    if (sqft !== undefined)
      result.listing.identity.squareFootage = listingValue(sqft, 0.8);
    for (const [pattern, group, key] of [
      [/application fee[^.\n]*\$[\d,]+/i, 'upfront', 'applicationFee'],
      [/security deposit[^.\n]*\$[\d,]+/i, 'upfront', 'securityDeposit'],
      [/administrative fee[^.\n]*\$[\d,]+/i, 'upfront', 'administrativeFee'],
      [/amenity fee[^.\n]*\$[\d,]+/i, 'recurring', 'amenityFees'],
      [/parking[^.\n]*\$[\d,]+/i, 'recurring', 'parking'],
      [/pet rent[^.\n]*\$[\d,]+/i, 'recurring', 'petRent'],
    ] as const) {
      const raw = body.match(pattern)?.[0];
      if (raw)
        (result.listing[group] as Record<string, unknown>)[key] = listingValue(
          parseMoney(raw)!,
          0.72,
          raw,
        );
    }
    result.includedUtilities = classifyIncludedUtilities(body);
    result.rawUtilityText = body.match(
      /[^.\n]*(?:utilities|water|sewer|trash)[^.\n]*included[^.\n]*/i,
    )?.[0];
    result.laundryType = classifyLaundry(body);
    result.rawLaundryText = body.match(
      /[^.\n]*(?:laundry|washer|dryer)[^.\n]*/i,
    )?.[0];
    const lease = parseNumberNear(body, /(\d+)\s*month lease/i);
    if (lease !== undefined) {
      result.listing.concessions = { leaseMonths: listingValue(lease, 0.7) };
    }
    return result;
  },
};
