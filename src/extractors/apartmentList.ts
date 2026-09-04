import {
  classifyIncludedUtilities,
  classifyLaundry,
  classifyNoPetsPolicy,
  listingValue,
  parseMoney,
  parseNumberNear,
  parseUsAddress,
} from './parsers';
import { emptyExtraction, type ListingExtractor } from './types';

function activeUnitText(document: Document): string | undefined {
  for (const dialog of document.querySelectorAll('[role="dialog"]')) {
    const text = dialog.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (
      /\bUnit\s+\S+/i.test(text) &&
      /\bTotal price\b/i.test(text) &&
      /\bBed\b/i.test(text) &&
      /\bBath\b/i.test(text) &&
      /\bsqft\b/i.test(text)
    )
      return text;
  }
  return undefined;
}

export const apartmentListExtractor: ListingExtractor = {
  siteName: 'Apartment List',
  version: '1.0.0',
  matches(url) {
    return /(^|\.)apartmentlist\.com$/i.test(url.hostname);
  },
  extract(document) {
    const result = emptyExtraction(this.siteName, this.version);
    const body = document.body.textContent ?? '';
    result.rawPetPolicyText = classifyNoPetsPolicy(body);
    if (result.rawPetPolicyText) result.petPolicy = 'none';
    const unit = activeUnitText(document);
    const title =
      document.querySelector('h1')?.textContent?.trim() ||
      document.title.split(/[|–-]/)[0]?.trim();
    if (title)
      result.listing.identity.listingTitle = listingValue(title, 0.82, title);
    const address = parseUsAddress(body);
    if (address) {
      result.listing.identity.fullAddress = listingValue(
        address.fullAddress,
        0.8,
        address.fullAddress,
      );
      result.listing.identity.city = listingValue(address.city, 0.8);
      result.listing.identity.state = listingValue(address.state, 0.8);
      result.listing.identity.zipCode = listingValue(address.zipCode, 0.8);
    }
    if (unit) {
      const rentText =
        unit.match(/Base rent\s*\$[\d,]+(?:\.\d{2})?/i)?.[0] ??
        unit.match(/Total price\s*\$[\d,]+(?:\.\d{2})?/i)?.[0];
      const rent = rentText ? parseMoney(rentText) : undefined;
      if (rent !== undefined)
        result.listing.recurring.advertisedRent = listingValue(
          rent,
          0.9,
          rentText,
        );
      const beds = parseNumberNear(unit, /(\d+(?:\.\d+)?)\s*Beds?\b/i);
      const baths = parseNumberNear(unit, /(\d+(?:\.\d+)?)\s*Baths?\b/i);
      const sqft = parseNumberNear(unit, /([\d,]+)\s*sqft\b/i);
      if (beds !== undefined)
        result.listing.identity.bedrooms = listingValue(beds, 0.9, unit);
      if (baths !== undefined)
        result.listing.identity.bathrooms = listingValue(baths, 0.9, unit);
      if (sqft !== undefined)
        result.listing.identity.squareFootage = listingValue(sqft, 0.9, unit);
      const depositText = unit.match(
        /Deposit\s*\(refundable\)[^$]{0,80}\$[\d,]+/i,
      )?.[0];
      const deposit = depositText ? parseMoney(depositText) : undefined;
      if (deposit !== undefined)
        result.listing.upfront.securityDeposit = listingValue(
          deposit,
          0.85,
          depositText,
        );
      const petRentText = unit.match(/(?:Cat|Dog) Rent\s*\$[\d,]+/i)?.[0];
      const petRent = petRentText ? parseMoney(petRentText) : undefined;
      if (petRent !== undefined)
        result.listing.recurring.petRent = listingValue(
          petRent,
          0.8,
          petRentText,
        );
    } else {
      result.warnings.push(
        'Select a specific available unit to extract its rent and dimensions.',
      );
    }
    result.includedUtilities = classifyIncludedUtilities(body);
    result.laundryType = classifyLaundry(body);
    return result;
  },
};
