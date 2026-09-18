import {
  listingValue,
  parseMoney,
  parseNumberNear,
  parseUsAddress,
} from './parsers';
import { emptyExtraction, type ListingExtractor } from './types';

const clean = (value: string | null | undefined) =>
  value?.trim().replace(/\s+/g, ' ') ?? '';

const uniqueNumbers = (values: Array<number | undefined>) => [
  ...new Set(values.filter((value): value is number => value !== undefined)),
];

/**
 * Realtor's available-unit dialog is rendered in a portal outside the page's
 * main element. Treat the floor-plan heading and one representative table row
 * as authoritative; repeated rows describe inventory, not extra rooms or area.
 */
export const realtorExtractor: ListingExtractor = {
  siteName: 'Realtor.com',
  version: '1.0.0',
  matches: (url) => /(?:^|\.)realtor\.com$/i.test(url.hostname),
  extract(document, url) {
    const result = emptyExtraction(this.siteName, this.version);
    result.listing.identity.url = listingValue(url.toString(), 1);

    const pageText = clean(document.body?.textContent);
    const address = parseUsAddress(pageText);
    if (address) {
      result.listing.identity.fullAddress = listingValue(
        address.fullAddress,
        0.94,
        address.fullAddress,
      );
      result.listing.identity.city = listingValue(address.city, 0.94);
      result.listing.identity.state = listingValue(address.state, 0.94);
      result.listing.identity.zipCode = listingValue(address.zipCode, 0.94);
    }

    const modal = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="dialog"][aria-modal="true"]',
      ),
    ).find((element) =>
      element.querySelector('[data-testid="modal-body"] table'),
    );
    if (!modal) return result;

    const heading = clean(modal.querySelector('h1,h2,h3,h4')?.textContent);
    const plan = heading.match(
      /(^|\b)(\d+(?:\.\d+)?)\s*BR\s*\/\s*(\d+(?:\.\d+)?)\s*BA\b/i,
    );
    if (plan) {
      result.listing.identity.bedrooms = listingValue(
        Number(plan[2]),
        0.99,
        heading,
      );
      result.listing.identity.bathrooms = listingValue(
        Number(plan[3]),
        0.99,
        heading,
      );
    }

    const rows = Array.from(modal.querySelectorAll('tbody tr')).map((row) => {
      const cells = Array.from(row.querySelectorAll('td')).map((cell) =>
        clean(cell.textContent),
      );
      return {
        rent: cells.map(parseMoney).find((value) => value !== undefined),
        squareFeet: cells
          .map((cell) =>
            parseNumberNear(
              cell,
              /([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)\b/i,
            ),
          )
          .find((value) => value !== undefined),
      };
    });
    const rents = uniqueNumbers(rows.map((row) => row.rent));
    const areas = uniqueNumbers(rows.map((row) => row.squareFeet));
    const tableText = clean(modal.querySelector('table')?.textContent);

    if (rents.length === 1) {
      const amount = listingValue(rents[0], 0.99, tableText);
      result.listing.recurring.advertisedRent = amount;
      result.rent = { kind: 'single', amount, rawText: tableText };
    }
    if (areas.length === 1)
      result.listing.identity.squareFootage = listingValue(
        areas[0],
        0.99,
        tableText,
      );

    if (rents.length > 1)
      result.warnings.push(
        'The selected floor plan has multiple rents. Select a specific unit or enter the applicable rent.',
      );
    if (areas.length > 1)
      result.warnings.push(
        'The selected floor plan has multiple square-footage values. Select a specific unit or enter the applicable size.',
      );
    return result;
  },
};
