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
import { selectedRedfinUnitDialog } from '../content/pageState';

export const redfinExtractor: ListingExtractor = {
  siteName: 'Redfin',
  version: '1.1.0',
  matches(url) {
    return /(^|\.)redfin\.com$/i.test(url.hostname);
  },
  extract(document, url) {
    const result = emptyExtraction(this.siteName, this.version);
    const pageBody = document.body.textContent?.replace(/\s+/g, ' ') ?? '';
    const selectedUnitRequested = /(?:^|#)rentsight-unit=/i.test(url.hash);
    const unitDialog = selectedRedfinUnitDialog(document);
    if (selectedUnitRequested && !unitDialog) {
      result.warnings.push(
        'The selected Redfin unit dialog could not be read. Reopen the unit and try again.',
      );
      return result;
    }
    const body = unitDialog?.textContent?.replace(/\s+/g, ' ') ?? pageBody;
    result.rawPetPolicyText = classifyNoPetsPolicy(body);
    if (result.rawPetPolicyText) result.petPolicy = 'none';
    const summary = body.match(
      /(\$[\d,]+\s*\/\s*mo\b)[\s\S]{0,240}?(\d+(?:\.\d+)?)\s*bd\b[\s\S]{0,80}?(\d+(?:\.\d+)?)\s*ba\b[\s\S]{0,80}?([\d,]+)\s*sq\s*ft\b/i,
    );
    const statText = (name: string) =>
      document
        .querySelector(`[data-rf-test-name="${name}"] .statsValue`)
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();
    const visibleRent = unitDialog ? undefined : statText('stat-price');
    const visibleBedrooms = unitDialog ? undefined : statText('stat-beds');
    const visibleBathrooms = unitDialog ? undefined : statText('stat-baths');
    const visibleSquareFeet = unitDialog ? undefined : statText('stat-sqft');
    const headingAddress = [...document.querySelectorAll('h1')]
      .map((heading) => parseUsAddress(heading.textContent ?? ''))
      .find(Boolean);
    const address =
      headingAddress ??
      parseUsAddress(
        document.querySelector('header.address')?.textContent ?? '',
      ) ??
      parseUsAddress(
        unitDialog
          ? pageBody
          : summary?.index !== undefined
            ? pageBody.slice(summary.index + summary[0].length)
            : pageBody,
      );
    const unitHeader = unitDialog
      ?.querySelector('.name-and-rent, [class*="name-and-rent"]')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
    const unitDetails = unitDialog
      ?.querySelector('.details, [class*="dialog-title"] .details')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
    const unitRent = unitHeader?.match(/\$[\d,]+(?:\.\d{2})?\s*\/\s*mo\b/i);
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
    const visibleRentAmount = visibleRent ? parseMoney(visibleRent) : undefined;
    const visibleBeds = visibleBedrooms
      ? parseNumberNear(visibleBedrooms, /(\d+(?:\.\d+)?)/)
      : undefined;
    const visibleBaths = visibleBathrooms
      ? parseNumberNear(visibleBathrooms, /(\d+(?:\.\d+)?)/)
      : undefined;
    const visibleSqft = visibleSquareFeet
      ? parseNumberNear(visibleSquareFeet, /([\d,]+)/)
      : undefined;
    if (visibleRentAmount !== undefined) {
      const amount = listingValue(visibleRentAmount, 0.96, visibleRent);
      result.listing.recurring.advertisedRent = amount;
      result.rent = { kind: 'single', amount, rawText: visibleRent! };
    }
    if (visibleBeds !== undefined)
      result.listing.identity.bedrooms = listingValue(
        visibleBeds,
        0.96,
        visibleBedrooms,
      );
    if (visibleBaths !== undefined)
      result.listing.identity.bathrooms = listingValue(
        visibleBaths,
        0.96,
        visibleBathrooms,
      );
    if (visibleSqft !== undefined)
      result.listing.identity.squareFootage = listingValue(
        visibleSqft,
        0.96,
        visibleSquareFeet,
      );
    const hasVisibleStats = Boolean(
      visibleRent || visibleBedrooms || visibleBathrooms || visibleSquareFeet,
    );
    if (!hasVisibleStats && summary) {
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
      result.rent = {
        kind: 'single',
        amount: result.listing.recurring.advertisedRent,
        rawText: summary[1],
      };
    } else if (unitHeader && unitRent) {
      const beds =
        parseNumberNear(unitHeader, /(\d+(?:\.\d+)?)\s*beds?\b/i) ??
        parseNumberNear(unitHeader, /\b(\d+)\s*[xX]\s*\d+\b/);
      const baths =
        parseNumberNear(unitHeader, /(\d+(?:\.\d+)?)\s*baths?\b/i) ??
        (unitDetails
          ? parseNumberNear(unitDetails, /(\d+(?:\.\d+)?)\s*baths?\b/i)
          : undefined);
      const sqft = unitDetails
        ? parseNumberNear(unitDetails, /([\d,]+)\s*(?:sqft|sq\s*ft)\b/i)
        : undefined;
      result.listing.recurring.advertisedRent = listingValue(
        parseMoney(unitRent[0])!,
        0.94,
        unitHeader,
      );
      result.rent = {
        kind: 'single',
        amount: result.listing.recurring.advertisedRent,
        rawText: unitRent[0],
      };
      if (beds !== undefined)
        result.listing.identity.bedrooms = listingValue(beds, 0.92, unitHeader);
      if (baths !== undefined)
        result.listing.identity.bathrooms = listingValue(
          baths,
          0.92,
          /\bbaths?\b/i.test(unitHeader) ? unitHeader : unitDetails,
        );
      if (sqft !== undefined)
        result.listing.identity.squareFootage = listingValue(
          sqft,
          0.92,
          unitDetails,
        );
    }
    result.includedUtilities = classifyIncludedUtilities(body);
    result.laundryType = classifyLaundry(body);
    return result;
  },
};
