import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { extractListing } from '../src/extractors';
import { applyAiExtraction } from '../src/ai/adapter';
import { acceptResponse } from '../src/ai/validation';
import {
  applyExtraction,
  applyHouseholdProfile,
  createInitialAnalysis,
  materializeListing,
  setRecurringValue,
} from '../src/shared/analysis';
import {
  calculateEstimatedTrueMonthlyCost,
  calculateFirstYearHousingCost,
  calculateRefundableDeposits,
  calculateRequiredMoveInCash,
} from '../src/calculations';
import { saveListing } from '../src/saved/repository';
import { exportListingsJson, importListingsJson } from '../src/saved/transfer';
import { createComparison } from '../src/saved/comparison';
import { captureListing } from '../src/ai/capture';
import { feeContract } from './helpers/feeContract';

const url = 'https://example.com/rental';
const extract = (html: string, site = url) =>
  extractListing(
    new JSDOM(`<main>${html}</main>`).window.document,
    new URL(site),
  );
const budget = (html: string) =>
  materializeListing(
    setRecurringValue(
      applyExtraction(createInitialAnalysis(url), extract(html)),
      'advertisedRent',
      2000,
    ),
  );
const analyze = (charges: Parameters<typeof feeContract>[0]) => {
  const { request, response } = feeContract(charges);
  acceptResponse(response, request);
  return applyAiExtraction(
    createInitialAnalysis(request.identity.listingUrl),
    response,
  );
};
const security = {
  id: 'security',
  category: 'security_deposit' as const,
  label: 'Security deposit',
  quote: 'Required refundable Security deposit: $2,000 once.',
  amountMinor: 200000,
  frequency: 'one_time' as const,
  refundable: true,
};
const holding = {
  id: 'holding',
  category: 'holding_deposit' as const,
  label: 'Holding deposit applied to security deposit',
  quote:
    'Required refundable Holding deposit: $350 once, credited toward security deposit.',
  amountMinor: 35000,
  frequency: 'one_time' as const,
  refundable: true,
};

describe('fee fixes preserve decisions and costs throughout the workflow', () => {
  it.each([
    'https://example.com/rental',
    'https://www.apartments.com/example/abc/',
  ])(
    'quarantines qualified standard fees as well as additional fees on %s',
    (site) => {
      const e = extract(
        '<p>Required monthly Administrative fee: up to $27.</p><p>Required one-time Application fee: $65 CAD.</p>',
        site,
      );
      expect(e.listing.recurring.otherRequiredMonthlyFees).toBeUndefined();
      expect(e.listing.upfront.administrativeFee).toBeUndefined();
      expect(e.listing.upfront.applicationFee).toBeUndefined();
      expect(e.feeNoteSuggestions?.map((n) => n.detail).join(' ')).toContain(
        'up to $27',
      );
      expect(e.feeNoteSuggestions?.map((n) => n.detail).join(' ')).toContain(
        'CAD',
      );
    },
  );
  it('keeps currency context when it is in a label rather than the amount column', () => {
    const e = extract(
      '<table><tr><td>Connectivity fee (CAD)</td><td>$27</td><td>Required monthly</td></tr></table>',
    );
    expect(e.namedRecurringFees).toEqual([]);
    expect(e.feeNoteSuggestions![0].detail).toContain('CAD');
  });
  it('keeps a bare numeric deposit in an active Realtor panel after background search results', () => {
    const document = new JSDOM(
      '<main><p>Required application fee: $999</p></main><div id="left-column-container"><h2>Rental Info</h2><ul><li>Security Deposit: 3995.0</li><li>Monthly Fees: Resident Benefits Package: $37</li></ul></div>',
    ).window.document;
    const e = extractListing(
      document,
      new URL('https://www.realtor.com/rentals/details/example'),
    );
    expect(e.listing.upfront.securityDeposit?.value).toBe(3995);
    expect(e.listing.upfront.applicationFee).toBeUndefined();
    expect(e.namedRecurringFees?.map((f) => f.amount)).toEqual([37]);
  });
  it.each(['span', 'div', 'p'])(
    'preserves a calculator cap in its %s label without budgeting it as exact',
    (tag) => {
      const e = extract(
        `<section><h2>Required monthly charges</h2><div class="fee-row"><${tag}>Utility Admin Fee - Not to Exceed</${tag}><span data-testid="fee-total">$27</span></div></section>`,
      );
      expect(e.namedRecurringFees).toEqual([]);
      expect(e.feeNoteSuggestions![0].detail).toContain('up to $27');
    },
  );
  it.each([
    ['Connectivity fee', 'up to $27'],
    ['Connectivity fee (CAD)', '$27'],
    ['Connectivity fee', '$27/year'],
    ['Connectivity fee - Not to Exceed', '$27'],
  ])(
    'applies the same price and cadence guards to Realtor cards: %s / %s',
    (label, amount) => {
      const e = extract(
        `<div data-testid="monthly-fees-card"><p>Monthly charges</p><div><p>Required</p><div><div><p>${label}</p></div><div><p>${amount}</p></div></div></div></div>`,
        'https://www.realtor.com/rentals/details/example',
      );
      expect(e.namedRecurringFees).toEqual([]);
      expect(e.feeNoteSuggestions).toHaveLength(1);
      expect(e.feeNoteSuggestions![0].detail).toContain('$27');
    },
  );
  it('keeps calculator rates ahead of overlapping generic prose', () => {
    const e = extract(
      '<section id="monthly-section"><h2>Monthly costs</h2><div class="required-group"><span>Required</span><div class="fee-row"><span>Connectivity fee</span><span data-testid="fee-total">$0</span></div></div></section><p>Required monthly Connectivity fee: $27.</p>',
    );
    expect(e.namedRecurringFees?.map((f) => f.amount)).toEqual([0]);
  });
  it('keeps a refundable utility deposit out of first-year expenses', () => {
    const listing = budget(
      '<p>Required refundable utility deposit: $100 due at signing.</p>',
    );
    expect(calculateRefundableDeposits(listing)).toBe(100);
    expect(calculateRequiredMoveInCash(listing)).toBe(100);
    expect(calculateFirstYearHousingCost(listing)).toBe(
      calculateFirstYearHousingCost(budget('')),
    );
  });
  it('includes prepaid first and last month in cash while annual rent stays counted once', () => {
    const listing = budget(
      '<p>First month rent due at signing: $2,000; Last month rent due at signing: $2,000.</p>',
    );
    expect(calculateRequiredMoveInCash(listing)).toBe(4000);
    expect(calculateFirstYearHousingCost(listing)).toBe(
      calculateFirstYearHousingCost(budget('')),
    );
  });
  it('treats prepaid rent correctly when refundability is unstated', () => {
    const a = analyze([
      {
        id: 'first',
        label: "First month's rent",
        category: 'move_in',
        quote: "Required first month's rent: $2,000 one time.",
        amountMinor: 200000,
        frequency: 'one_time',
        refundable: null,
      },
    ]);
    expect(a.listing.upfront.firstMonthsRent?.value).toBe(2000);
    expect(a.listing.upfront.otherMoveInFees).toBeUndefined();
  });
  it('does not add a holding payment already credited to a full security deposit', () => {
    const listing = materializeListing(analyze([security, holding]));
    expect(calculateRefundableDeposits(listing)).toBe(2000);
    expect(calculateRequiredMoveInCash(listing)).toBe(2000);
  });
  it('combines a credited holding payment with an explicit remaining deposit balance', () => {
    const listing = materializeListing(
      analyze([
        {
          ...security,
          label: 'Security deposit (remaining balance)',
          quote: 'Required refundable remaining Security deposit: $150 once.',
          amountMinor: 15000,
        },
        holding,
      ]),
    );
    expect(listing.upfront.securityDeposit?.value).toBe(500);
    expect(calculateRequiredMoveInCash(listing)).toBe(500);
    expect(listing.upfront.securityDeposit?.note).toContain('$350');
    expect(listing.upfront.securityDeposit?.note).toContain('$150');
  });
  it.each([
    '<p>Rent: $2,027/month including all required monthly fees.</p><p>Required monthly Connectivity fee: $27.</p>',
    '<p>Rent: $2,027/month.</p><p>Required monthly Connectivity fee: $27, included in rent.</p>',
  ])('does not add an included fee again to a headline total', (html) => {
    const e = extract(html);
    expect(e.namedRecurringFees).toEqual([]);
    expect(e.listing.recurring.advertisedRent?.value).toBe(2027);
    expect(e.feeNoteSuggestions![0].detail).toContain('no extra charge added');
  });
  it('also keeps an inclusive Realtor headline from adding its fee card again', () => {
    const e = extract(
      '<div data-testid="rentals-list-price"><div data-rui="Price">$2,027/mo including all required monthly fees</div></div><div data-testid="monthly-fees-card"><p>Monthly charges</p><div><p>Required</p><div><div><p>Connectivity fee</p></div><div><p>$27</p></div></div></div></div>',
      'https://www.realtor.com/rentals/details/example',
    );
    expect(e.listing.recurring.advertisedRent?.value).toBe(2027);
    expect(e.namedRecurringFees).toEqual([]);
    expect(e.feeNoteSuggestions![0].detail).toContain('no extra charge added');
  });
  it('adds the fee when the input is an explicitly separate base rent', () => {
    const e = extract(
      '<p>Rent: $2,027/month including all required fees.</p><section id="monthly-section"><h2>Monthly costs</h2><div class="required-group"><span>Required</span><div class="base-rent-fee fee-row"><span>Monthly base rent</span><span>$2,000</span></div><div class="fee-row"><span>Connectivity fee</span><span data-testid="fee-total">$27</span></div></div></section>',
      'https://www.zillow.com/homedetails/example/1_zpid/',
    );
    expect(e.listing.recurring.advertisedRent?.value).toBe(2000);
    expect(e.namedRecurringFees?.map((f) => f.amount)).toEqual([27]);
  });
  it.each(['per_pet', 'per_unit'] as const)(
    'persists trusted %s pet basis through actual saving, transfer, household changes and comparison',
    (basis) => {
      const a = applyHouseholdProfile(
        analyze([
          {
            id: 'pet',
            category: 'pet_rent',
            label: 'Pet rent',
            quote: 'Optional monthly pet rent: $35 for each animal.',
            amountMinor: 3500,
            frequency: 'monthly',
            basis,
            applicability: 'optional',
          },
        ]),
        { occupants: 1, cats: 2, smallDogs: 0, largeDogs: 0 },
      );
      const saved = saveListing([], a).record;
      expect(saved.analysis.extraction).toBeUndefined();
      expect(saved.analysis.listing.recurring.petRent?.billingBasis).toBe(
        basis,
      );
      const imported = importListingsJson(exportListingsJson([saved]));
      expect(imported.errors).toEqual([]);
      const expected = basis === 'per_pet' ? 70 : 35;
      expect(createComparison(imported.records[0]).petExpenses).toBe(expected);
      const three = applyHouseholdProfile(imported.records[0].analysis, {
        occupants: 1,
        cats: 3,
        smallDogs: 0,
        largeDogs: 0,
      });
      expect(materializeListing(three).recurring.petRent?.value).toBe(
        basis === 'per_pet' ? 105 : 35,
      );
      expect(
        materializeListing(setRecurringValue(three, 'petRent', 80)).recurring
          .petRent?.value,
      ).toBe(80);
    },
  );
  it('keeps unsupported-currency and ranged fees out of the saved monthly budget', () => {
    const a = setRecurringValue(
      applyExtraction(
        createInitialAnalysis(url),
        extract(
          '<p>Required monthly Connectivity fee: $10 - $30.</p><p>Required monthly Utility billing fee: $27 CAD.</p>',
        ),
      ),
      'advertisedRent',
      2000,
    );
    const saved = saveListing([], a).record;
    expect(createComparison(saved).trueMonthlyCost).toBe(
      calculateEstimatedTrueMonthlyCost(budget('')),
    );
    expect(
      a.extraction!.feeNoteSuggestions!.map((n) => n.detail).join(' '),
    ).toContain('$10–$30');
  });
  it('captures a description-list charge atomically with cadence and applicability', () => {
    const d = new JSDOM(
      '<main><h2>Required monthly charges</h2><dl><dt>Connectivity fee</dt><dd>$27</dd></dl></main>',
    ).window.document;
    const e = extractListing(d, new URL(url));
    const capture = captureListing(d, e);
    const block = capture.capture.blocks.find(
      (b) => b.text === 'Connectivity fee: $27',
    );
    expect(block?.sectionPath).toEqual([
      'Cost calculator',
      'Monthly costs',
      'Required',
    ]);
    expect(
      capture.capture.blocks.filter((b) => b.text.includes('Connectivity fee')),
    ).toHaveLength(1);
  });
});
