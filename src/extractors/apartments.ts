import {
  classifyIncludedUtilities,
  classifyLaundry,
  classifyNoPetsPolicy,
  listingValue,
  parseMoney,
  parseNumberNear,
  parseRentEvidence,
  parseUsAddress,
} from './parsers';
import { emptyExtraction, type ListingExtractor } from './types';
import { selectedApartmentsUnitDialog } from '../content/pageState';

export const apartmentsExtractor: ListingExtractor = {
  siteName: 'Apartments.com',
  version: '1.2.1',
  matches(url) {
    return /(^|\.)apartments\.com$/i.test(url.hostname);
  },
  extract(document) {
    const result = emptyExtraction(this.siteName, this.version);
    const selectedUnit = selectedApartmentsUnitDialog(document);
    const pick = (selectors: string) =>
      document
        .querySelector(selectors)
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();
    const title = pick('h1.propertyName, h1');
    const addressText = pick(
      '#propertyAddressRow, .propertyAddressContainer, .propertyAddress, [data-testid="property-address"]',
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
    const unitText = selectedUnit
      ? [...selectedUnit.querySelectorAll('.specs-header, .unit-specs li')]
          .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join(' ')
      : undefined;
    const unitRentText = unitText?.match(
      /\bBase Price:\s*\$[\d,]+(?:\.\d{2})?/i,
    )?.[0];
    const unitRent = unitRentText ? parseMoney(unitRentText) : undefined;
    const rentTexts = [
      ...document.querySelectorAll(
        '.rentInfoDetail, .rentRange, [data-testid="rent"]',
      ),
    ].map((node) => node.textContent ?? '');
    result.rent =
      unitRent !== undefined
        ? {
            kind: 'single',
            amount: listingValue(unitRent, 0.96, unitRentText),
            rawText: unitRentText!,
          }
        : parseRentEvidence(rentTexts, 0.88);
    if (result.rent?.kind === 'single')
      result.listing.recurring.advertisedRent = result.rent.amount;
    const body = document.body.textContent ?? '';
    result.rawPetPolicyText = classifyNoPetsPolicy(body);
    if (result.rawPetPolicyText) result.petPolicy = 'none';
    const labeledFacts = new Map<string, string>();
    for (const label of document.querySelectorAll('.rentInfoLabel')) {
      const name = label.textContent?.replace(/\s+/g, ' ').trim().toLowerCase();
      const detail =
        label.parentElement?.querySelector('.rentInfoDetail')?.textContent;
      if (name && detail) labeledFacts.set(name, detail.trim());
    }
    const unitBeds = unitText
      ? /\bStudio\b/i.test(unitText)
        ? 0
        : parseNumberNear(unitText, /(\d+(?:\.\d+)?)\s*Beds?\b/i)
      : undefined;
    const unitBaths = unitText
      ? parseNumberNear(unitText, /(\d+(?:\.\d+)?)\s*Baths?\b/i)
      : undefined;
    const unitSqft = unitText
      ? parseNumberNear(unitText, /([\d,]+)\s*Sq\s*Ft\b/i)
      : undefined;
    const bedDetail = labeledFacts.get('bedrooms');
    const bathDetail = labeledFacts.get('bathrooms');
    const sqftDetail = labeledFacts.get('square feet');
    const structuredBeds = /studio/i.test(bedDetail ?? '')
      ? 0
      : bedDetail
        ? parseNumberNear(bedDetail, /([\d,.]+)/)
        : undefined;
    const structuredBaths = bathDetail
      ? parseNumberNear(bathDetail, /([\d,.]+)/)
      : undefined;
    const structuredSqft = sqftDetail
      ? parseNumberNear(sqftDetail, /([\d,]+)/)
      : undefined;
    const fallbackBeds =
      /(?:studio|\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?\s*(?:beds?|bedrooms?|bd)\b/i.test(
        body,
      )
        ? undefined
        : parseNumberNear(body, /(\d+(?:\.\d+)?)\s*(?:beds?|bedrooms?)\b/i);
    const fallbackBaths =
      /\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?\s*(?:baths?|ba)\b/i.test(
        body,
      )
        ? undefined
        : parseNumberNear(body, /(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?)\b/i);
    const fallbackSqft =
      /[\d,]+\s*(?:-|–|—|to)\s*[\d,]+\s*(?:sq\.?\s*ft|square feet)/i.test(body)
        ? undefined
        : parseNumberNear(body, /([\d,]+)\s*(?:sq\.?\s*ft|square feet)/i);
    const beds = unitBeds ?? structuredBeds ?? fallbackBeds;
    const baths = unitBaths ?? structuredBaths ?? fallbackBaths;
    const sqft = unitSqft ?? structuredSqft ?? fallbackSqft;
    if (beds !== undefined)
      result.listing.identity.bedrooms = listingValue(
        beds,
        selectedUnit ? 0.96 : 0.8,
        selectedUnit ? unitText : undefined,
      );
    if (baths !== undefined)
      result.listing.identity.bathrooms = listingValue(
        baths,
        selectedUnit ? 0.96 : 0.8,
        selectedUnit ? unitText : undefined,
      );
    if (sqft !== undefined)
      result.listing.identity.squareFootage = listingValue(
        sqft,
        selectedUnit ? 0.96 : 0.8,
        selectedUnit ? unitText : undefined,
      );
    for (const [pattern, group, key] of [
      [/application fee[^.\n]*\$[\d,]+/i, 'upfront', 'applicationFee'],
      [/security deposit[^.\n]*\$[\d,]+/i, 'upfront', 'securityDeposit'],
      [/administrative fee[^.\n]*\$[\d,]+/i, 'upfront', 'administrativeFee'],
      [/amenity fee[^.\n]*\$[\d,]+/i, 'recurring', 'amenityFees'],
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
    const parkingText = body.match(
      /\b(?:parking|garage|carport)(?:\s+(?:fee|rent|cost))?\s*(?::|-)?\s*\$[\d,]+(?:\.\d{2})?/i,
    )?.[0];
    if (parkingText)
      result.listing.recurring.parking = listingValue(
        parseMoney(parkingText)!,
        0.72,
        parkingText,
      );
    result.includedUtilities = classifyIncludedUtilities(body);
    result.rawUtilityText = body.match(
      /[^.\n]*(?:utilities|water|sewer|trash)[^.\n]*included[^.\n]*/i,
    )?.[0];
    const hasWasherDryerHighlight = [
      ...document.querySelectorAll(
        '.feature-section li, .amenity, [class*="highlight"] li',
      ),
    ].some((node) =>
      /^washer\s*(?:\/|and|&)\s*dryer$/i.test(
        node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ),
    );
    result.laundryType = hasWasherDryerHighlight
      ? 'in_unit'
      : classifyLaundry(body);
    result.rawLaundryText = body.match(
      /[^.\n]*(?:laundry|washer|dryer)[^.\n]*/i,
    )?.[0];
    const lease = parseNumberNear(body, /(\d+)\s*month lease/i);
    if (lease !== undefined) {
      result.listing.concessions ??= {};
      result.listing.concessions.leaseMonths = listingValue(lease, 0.7);
    }
    return result;
  },
};
