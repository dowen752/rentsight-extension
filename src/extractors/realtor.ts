import {
  listingValue,
  parseMoney,
  parseNumberNear,
  parseUsAddress,
  parseRentEvidence,
  classifyIncludedUtilities,
  classifyLaundry,
} from './parsers';
import { emptyExtraction, type ListingExtractor } from './types';
import {
  listingText,
  realtorFeeRows,
  realtorListingRoot,
  REALTOR_NOISE,
} from './realtorDom';

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
  version: '1.1.0',
  matches: (url) => /(?:^|\.)realtor\.com$/i.test(url.hostname),
  extract(document, url) {
    const result = emptyExtraction(this.siteName, this.version);
    result.listing.identity.url = listingValue(url.toString(), 1);

    const root = realtorListingRoot(document);
    const heading =
      root.querySelector('[data-testid="address"]') ??
      [...root.querySelectorAll('h1,h2')].find(
        (node) =>
          !node.closest(REALTOR_NOISE) && parseUsAddress(listingText(node)),
      );
    const address = parseUsAddress(listingText(heading));
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

    const price =
      root.querySelector(
        '[data-testid="rentals-list-price"] [data-rui="Price"]',
      ) ?? root.querySelector('[data-testid="rentals-list-price"]');
    const baseRent = realtorFeeRows(root).find((row) =>
      /^monthly base rent$/i.test(row.label),
    );
    result.rent = parseRentEvidence(
      [baseRent?.amountText ?? listingText(price)],
      0.98,
    );
    if (result.rent?.kind === 'single')
      result.listing.recurring.advertisedRent = result.rent.amount;
    for (const [testId, key] of [
      ['property-meta-beds', 'bedrooms'],
      ['property-meta-baths', 'bathrooms'],
      ['property-meta-sqft', 'squareFootage'],
    ] as const) {
      const node = root.querySelector(
        `[data-testid="home-facts"] [data-testid="${testId}"]`,
      );
      const text = listingText(node);
      const valueText = clean(
        node?.querySelector('[data-testid="meta-value"]')?.textContent,
      );
      if (/\d\s*(?:-|–|—|to)\s*\d|studio\s*[-–—]/i.test(valueText || text))
        continue;
      const numericText = valueText || text.match(/^[\d,.]+/)?.[0];
      if (!numericText && !/^studio\b/i.test(text)) continue;
      const value = /^studio\b/i.test(text)
        ? 0
        : Number((numericText ?? '').replaceAll(',', ''));
      if (
        (valueText || text) &&
        Number.isFinite(value) &&
        value >= 0 &&
        (key === 'squareFootage' ? value > 0 : value <= 20)
      )
        result.listing.identity[key] = listingValue(value, 0.98, text);
    }
    for (const node of root.querySelectorAll('li')) {
      if (node.closest(REALTOR_NOISE)) continue;
      const text = listingText(node);
      const deposit = text.match(
        /^Security Deposit:\s*\$?\s*([\d,]+(?:\.\d{1,2})?)\s*$/i,
      );
      if (deposit)
        result.listing.upfront.securityDeposit = listingValue(
          Number(deposit[1].replaceAll(',', '')),
          0.98,
          text,
        );
    }
    const propertyText = listingText(root);
    result.includedUtilities = classifyIncludedUtilities(propertyText);
    result.laundryType = classifyLaundry(propertyText);

    const modal = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[role="dialog"][aria-modal="true"]',
      ),
    ).find((element) =>
      element.querySelector('[data-testid="modal-body"] table'),
    );
    if (!modal) return result;

    const planHeading = clean(modal.querySelector('h1,h2,h3,h4')?.textContent);
    const plan = planHeading.match(
      /(^|\b)(\d+(?:\.\d+)?)\s*BR\s*\/\s*(\d+(?:\.\d+)?)\s*BA\b/i,
    );
    if (plan) {
      result.listing.identity.bedrooms = listingValue(
        Number(plan[2]),
        0.99,
        planHeading,
      );
      result.listing.identity.bathrooms = listingValue(
        Number(plan[3]),
        0.99,
        planHeading,
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
