import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { extractListing } from '../src/extractors';
import { parseLabeledMoney } from '../src/extractors/parsers';
import {
  applyExtraction,
  createInitialAnalysis,
  materializeListing,
  setRecurringValue,
} from '../src/shared/analysis';
import {
  calculateEstimatedTrueMonthlyCost,
  calculateRequiredMoveInCash,
  calculateFirstYearHousingCost,
} from '../src/calculations';
import { createComparison } from '../src/saved/comparison';
import { exportListingsJson, importListingsJson } from '../src/saved/transfer';
import { AnalysisEditor } from '../src/sidepanel/App';
import type { SavedListingRecord } from '../src/saved/types';

const extract = (
  html: string,
  url = 'https://www.zillow.com/homedetails/example/1_zpid/',
) => extractListing(new JSDOM(html).window.document, new URL(url));
const calculator = (
  rows: string,
  section = 'Monthly costs',
  group = 'Required',
) =>
  `<main><h1>100 Example Ave, Sampletown, CA 90000</h1><span data-testid="price">$2,000/mo</span><div><h2>${section}</h2><div><span>${group}</span>${rows}</div></div></main>`;
const row = (label: string, amount: string, markup = 'span') =>
  `<div class="custom-fee fee-row"><${markup}>${label}</${markup}><span data-testid="fee-total">${amount}</span></div>`;

describe('required calculator fee layout matrix', () => {
  const cases = [
    'Monthly Utility Admin Fee',
    'Utility Billing Fee',
    'Resident Services Fee',
    'Package handling fee',
  ].flatMap((label) =>
    ['span', 'div', 'p'].flatMap((markup) =>
      ['$0', '$10', '$12.50', '$1,250'].map((amount) => ({
        label,
        markup,
        amount,
      })),
    ),
  );
  it.each(cases)(
    'reads $label / $markup / $amount',
    ({ label, markup, amount }) => {
      const result = extract(calculator(row(label, amount, markup)));
      expect(result.listing.recurring.otherRequiredMonthlyFees?.value).toBe(
        Number(amount.replace(/[$,]/g, '')),
      );
      expect(result.listing.recurring.otherRequiredMonthlyFees?.source).toBe(
        'listing',
      );
      expect(result.listing.recurring.otherRequiredMonthlyFees?.note).toContain(
        label,
      );
      expect(result.listing.upfront.administrativeFee).toBeUndefined();
    },
  );
  it.each(['Application costs', 'Move-in costs'])(
    'assigns a required setup charge to %s',
    (section) => {
      const result = extract(
        calculator(row('Account setup fee', '$25'), section),
      );
      expect(result.listing.upfront.otherMoveInFees?.value).toBe(25);
      expect(result.listing.recurring.otherRequiredMonthlyFees).toBeUndefined();
    },
  );
  it.each(['Varies', 'Contact property', 'Included', ''])(
    'does not invent a dollar amount from %s',
    (amount) => {
      expect(
        extract(calculator(row('Utility service fee', amount))).listing
          .recurring.otherRequiredMonthlyFees,
      ).toBeUndefined();
    },
  );
  it.each(['Optional', ''])(
    'does not apply a charge with applicability %s',
    (group) => {
      expect(
        extract(calculator(row('Storage fee', '$50'), 'Monthly costs', group))
          .listing.recurring.otherRequiredMonthlyFees,
      ).toBeUndefined();
    },
  );
  it('adds distinct required rows, deduplicates repeated rows, and ignores section totals', () => {
    const rows =
      row('Utility billing fee', '$10') +
      row('Resident service fee', '$5') +
      row('Utility billing fee', '$10');
    const result = extract(
      calculator(rows) +
        '<p>Estimated total monthly cost $2,015</p><p>Utility billing fee: $10.</p>',
    );
    expect(result.listing.recurring.otherRequiredMonthlyFees?.value).toBe(15);
  });
  it('uses the row total instead of an amount in its explanatory label', () => {
    expect(
      extract(calculator(row('Service fee (normally $20)', '$10'))).listing
        .recurring.otherRequiredMonthlyFees?.value,
    ).toBe(10);
  });
  it('keeps required and optional sibling groups separate', () => {
    const html = `<div><h2>Monthly costs</h2><div><span>Required</span>${row('Billing fee', '$10')}</div><div><span>Optional</span>${row('Storage fee', '$40')}</div></div>`;
    expect(
      extract(html).listing.recurring.otherRequiredMonthlyFees?.value,
    ).toBe(10);
  });
});

describe('fee evidence boundaries', () => {
  it.each([
    'Application fee: $65; Administrative fee: $100',
    '$65 application fee; $100 administrative fee',
    'Application fee: $65\nAdministrative fee: $100',
    'Application fee: $65. Administrative fee: $100',
  ])('does not borrow neighboring amounts: %s', (text) => {
    expect(parseLabeledMoney(text, /application fee/i)?.amount).toBe(65);
    expect(parseLabeledMoney(text, /administrative fee/i)?.amount).toBe(100);
  });
  it.each(['$0', '$65.50', '$1,250'])(
    'parses a stated application charge %s',
    (amount) => {
      expect(
        parseLabeledMoney(`Application fee: ${amount}`, /application fee/i)
          ?.amount,
      ).toBe(Number(amount.replace(/[$,]/g, '')));
    },
  );
});

describe('fees across review, corrections, calculation, and saved transfer', () => {
  it('shows an extracted monthly fee and preserves its amount and source through save/import/compare', () => {
    const extraction = extract(
      calculator(row('Monthly Utility Admin Fee', '$10')),
    );
    const initial = createInitialAnalysis(
      'https://www.zillow.com/homedetails/example/1_zpid/',
      'Example',
    );
    const analysis = applyExtraction(initial, extraction);
    const withoutFee = materializeListing({
      ...analysis,
      customRecurringFees: [],
      listing: {
        ...analysis.listing,
        recurring: {
          ...analysis.listing.recurring,
          otherRequiredMonthlyFees: undefined,
        },
      },
    });
    const listing = materializeListing(analysis);
    expect(
      calculateEstimatedTrueMonthlyCost(listing) -
        calculateEstimatedTrueMonthlyCost(withoutFee),
    ).toBe(10);
    expect(calculateRequiredMoveInCash(listing)).toBe(
      calculateRequiredMoveInCash(withoutFee),
    );
    expect(
      calculateFirstYearHousingCost(listing) -
        calculateFirstYearHousingCost(withoutFee),
    ).toBe(120);
    const markup = renderToStaticMarkup(
      <AnalysisEditor analysis={analysis} update={() => undefined} />,
    );
    expect(markup).toContain('Utility Admin Fee (required)');
    expect(analysis.customRecurringFees[0].amount).toBe(10);
    expect(markup).toContain('Extracted from listing');
    const record: SavedListingRecord = {
      schemaVersion: 1,
      id: 'fees',
      url: analysis.listing.identity.url!.value,
      analysis,
      createdAt: analysis.updatedAt,
      updatedAt: analysis.updatedAt,
    };
    const imported = importListingsJson(exportListingsJson([record]));
    expect(imported.errors).toEqual([]);
    expect(
      imported.records[0].analysis.listing.recurring.otherRequiredMonthlyFees,
    ).toEqual(analysis.listing.recurring.otherRequiredMonthlyFees);
    expect(createComparison(imported.records[0]).trueMonthlyCost).toBe(
      calculateEstimatedTrueMonthlyCost(listing),
    );
    const corrected = setRecurringValue(
      analysis,
      'otherRequiredMonthlyFees',
      8,
    );
    const refreshed = applyExtraction(corrected, extraction);
    expect(refreshed.listing.recurring.otherRequiredMonthlyFees?.value).toBe(8);
    expect(refreshed.listing.recurring.otherRequiredMonthlyFees?.source).toBe(
      'user',
    );
  });
});

describe('HotPads and Zumper initial synthetic fallback coverage', () => {
  it.each(['hotpads', 'zumper'])(
    '%s reads ordinary prose fees without a dedicated adapter',
    (site) => {
      const html = readFileSync(
        resolve(`tests/fixtures/fees/${site}-synthetic.html`),
        'utf8',
      );
      const result = extract(html, `https://${site}.com/100-example-ave`);
      expect(result.siteName).toBe('Generic listing page');
      expect(result.listing.recurring.advertisedRent?.value).toBe(2000);
      expect(result.listing.identity.bedrooms?.value).toBe(2);
      expect(result.listing.upfront.applicationFee?.value).toBe(65);
      expect(result.listing.upfront.securityDeposit?.value).toBe(2000);
      expect(result.listing.recurring.parking?.value).toBe(50);
      expect(result.listing.recurring.petRent?.value).toBe(25);
    },
  );
  it.each(['hotpads', 'zumper'])(
    '%s recognizes a required utility billing fee',
    (site) => {
      expect(
        extract(
          '<p>Required monthly utility billing fee: $10.</p>',
          `https://${site}.com/example`,
        ).listing.recurring.otherRequiredMonthlyFees?.value,
      ).toBe(10);
    },
  );
  it.each(['hotpads', 'zumper'])(
    '%s reads label/value table rows without concatenating numbers',
    (site) => {
      expect(
        extract(
          '<table><tr><td>Application fee</td><td>$65</td></tr><tr><td>Security deposit</td><td>$2,000</td></tr></table>',
          `https://${site}.com/example`,
        ).listing.upfront.applicationFee?.value,
      ).toBe(65);
    },
  );
});

describe('fee cadence, property scope, and refundable deposits', () => {
  it.each([
    'https://example.com/rental',
    'https://www.apartments.com/example/abc/',
  ])('one-time amenity fee must not become monthly on %s', (url) => {
    const result = extract('<p>One-time amenity fee: $100.</p>', url);
    expect(result.listing.recurring.amenityFees).toBeUndefined();
    expect(result.listing.upfront.otherMoveInFees?.value).toBe(100);
  });
  it.each([
    'https://example.com/rental',
    'https://www.apartments.com/example/abc/',
  ])('monthly administrative fee must not become upfront on %s', (url) => {
    const result = extract('<p>Monthly administrative fee: $10.</p>', url);
    expect(result.listing.upfront.administrativeFee).toBeUndefined();
    expect(result.listing.recurring.otherRequiredMonthlyFees?.value).toBe(10);
  });
  it('generic extraction must not pull a fee from hidden content', () => {
    expect(
      extract(
        '<div hidden>Application fee: $999.</div><p>Application fee: $65.</p>',
        'https://example.com/rental',
      ).listing.upfront.applicationFee?.value,
    ).toBe(65);
  });
  it('generic extraction must not pull a fee from a recommended property', () => {
    expect(
      extract(
        '<aside>Other property: Application fee: $999.</aside><main><p>Application fee: $65.</p></main>',
        'https://example.com/rental',
      ).listing.upfront.applicationFee?.value,
    ).toBe(65);
  });
  it('a refundable custom deposit must affect move-in cash without becoming a nonrefundable fee', () => {
    const result = extract(
      calculator(row('Refundable utility deposit', '$100'), 'Move-in costs'),
    );
    expect(result.listing.upfront.utilityDeposits?.value).toBe(100);
    expect(result.listing.upfront.otherMoveInFees).toBeUndefined();
  });
});
