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

export const genericExtractor: ListingExtractor = {
  siteName: 'Generic listing page',
  version: '1.0.0',
  matches: () => true,
  extract(document) {
    const result = emptyExtraction(this.siteName, this.version);
    const body = document.body?.innerText || document.body?.textContent || '';
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
    const visibleFragments = [
      ...document.querySelectorAll('h1, h2, p, li, [data-testid*="rent"]'),
    ].map((node) => node.textContent?.trim() ?? '');
    const rentLines = visibleFragments.filter(
      (line) =>
        /^\s*(?:(?:the|advertised)\s+)?(?:monthly\s+)?rent\s*(?::|is|from)?\s*\$[\d,]+/i.test(
          line,
        ) || /^\s*\$[\d,]+\s*(?:\/|per)\s*(?:mo|month)/i.test(line),
    );
    result.rent = parseRentEvidence(rentLines, 0.55);
    if (result.rent?.kind === 'single')
      result.listing.recurring.advertisedRent = result.rent.amount;
    const bedrooms = parseNumberNear(
      body,
      /(\d+(?:\.\d+)?)\s*(?:bed(?:room)?s?|bd)\b/i,
    );
    const bathrooms = parseNumberNear(
      body,
      /(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?|ba)\b/i,
    );
    const squareFeet = parseNumberNear(
      body,
      /([\d,]+)\s*(?:sq\.?\s*ft|square feet)\b/i,
    );
    if (bedrooms !== undefined)
      result.listing.identity.bedrooms = listingValue(bedrooms, 0.58);
    if (bathrooms !== undefined)
      result.listing.identity.bathrooms = listingValue(bathrooms, 0.58);
    if (squareFeet !== undefined)
      result.listing.identity.squareFootage = listingValue(squareFeet, 0.58);
    const depositText = body.match(/security deposit[^\n.]*\$[\d,]+/i)?.[0];
    const applicationText = body.match(/application fee[^\n.]*\$[\d,]+/i)?.[0];
    const parkingText = body.match(
      /parking[^\n.]*\$[\d,]+(?:\s*\/\s*(?:mo|month))?/i,
    )?.[0];
    const petText = body.match(/pet rent[^\n.]*\$[\d,]+/i)?.[0];
    const petFeeText = body.match(/pet fee[^\n.]*\$[\d,]+/i)?.[0];
    if (depositText)
      result.listing.upfront.securityDeposit = listingValue(
        parseMoney(depositText)!,
        0.6,
        depositText,
      );
    if (applicationText)
      result.listing.upfront.applicationFee = listingValue(
        parseMoney(applicationText)!,
        0.6,
        applicationText,
      );
    if (parkingText)
      result.listing.recurring.parking = listingValue(
        parseMoney(parkingText)!,
        0.55,
        parkingText,
      );
    if (petText)
      result.listing.recurring.petRent = listingValue(
        parseMoney(petText)!,
        0.5,
        petText,
      );
    if (petFeeText)
      result.listing.upfront.otherMoveInFees = listingValue(
        parseMoney(petFeeText)!,
        0.5,
        petFeeText,
      );
    const adminText = body.match(/administrative fee[^\n.]*\$[\d,]+/i)?.[0];
    const amenityText = body.match(
      /(?:required )?amenity fee[^\n.]*\$[\d,]+/i,
    )?.[0];
    if (adminText)
      result.listing.upfront.administrativeFee = listingValue(
        parseMoney(adminText)!,
        0.55,
        adminText,
      );
    if (amenityText)
      result.listing.recurring.amenityFees = listingValue(
        parseMoney(amenityText)!,
        0.5,
        amenityText,
      );
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
    return result;
  },
};
