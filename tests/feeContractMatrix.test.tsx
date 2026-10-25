import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { acceptResponse, assertRequest } from '../src/ai/validation';
import { applyAiExtraction, adaptExtraction } from '../src/ai/adapter';
import {
  createInitialAnalysis,
  decidePropertyNote,
  materializeListing,
  applyHouseholdProfile,
} from '../src/shared/analysis';
import {
  calculateEstimatedTrueMonthlyCost,
  calculateRequiredMoveInCash,
  calculateFirstYearHousingCost,
  calculateRefundableDeposits,
  calculateNonrefundableMoveInExpenses,
} from '../src/calculations';
import { AiSourceReview } from '../src/sidepanel/AiExtractionCard';
import { exportListingsJson, importListingsJson } from '../src/saved/transfer';
import { createComparison } from '../src/saved/comparison';
import type { SavedListingRecord } from '../src/saved/types';
import { feeContract, type ChargeScenario } from './helpers/feeContract';

const charge: ChargeScenario = {
  id: 'service',
  category: 'service',
  label: 'Connectivity fee',
  quote: 'Required Connectivity fee: $27 per unit monthly, nonrefundable.',
  amountMinor: 2700,
  frequency: 'monthly',
};
const analyze = (charges: ChargeScenario[]) => {
  const { request, response } = feeContract(charges);
  assertRequest(request);
  expect(acceptResponse(response, request)).toEqual(response);
  return applyAiExtraction(
    createInitialAnalysis(request.identity.listingUrl),
    response,
  );
};

const deferred: ChargeScenario[] = [
  {
    ...charge,
    id: 'range',
    quote: 'Required Connectivity fee: $27 to $40 monthly.',
    rangeMaximumMinor: 4000,
  },
  {
    ...charge,
    id: 'cad',
    quote: 'Required Connectivity fee: CAD 27 monthly.',
    currency: 'CAD',
  },
  {
    ...charge,
    id: 'weekly',
    quote: 'Required Connectivity fee: $27 per week.',
    frequency: 'weekly',
  },
  {
    ...charge,
    id: 'yearly',
    quote: 'Required Connectivity fee: $27 yearly.',
    frequency: 'yearly',
  },
  {
    ...charge,
    id: 'per-person',
    quote: 'Required Connectivity fee: $27 monthly per person.',
    basis: 'per_person',
  },
  {
    ...charge,
    id: 'per-vehicle',
    quote: 'Required Connectivity fee: $27 monthly per vehicle.',
    basis: 'per_vehicle',
  },
  {
    ...charge,
    id: 'optional',
    quote: 'Optional Connectivity fee: $27 monthly.',
    applicability: 'optional',
  },
  {
    ...charge,
    id: 'conditional',
    quote: 'Connectivity fee: $27 monthly only if selected.',
    applicability: 'conditional',
  },
  {
    ...charge,
    id: 'building',
    quote:
      'Building-wide Connectivity fee: $27 monthly; applicability to the selected unit unstated.',
    scope: 'building',
  },
  {
    ...charge,
    id: 'refundable-monthly',
    quote: 'Required refundable Connectivity payment: $27 monthly.',
    refundable: true,
  },
];

describe('validated AI fees through review, calculations, transfer, and comparison', () => {
  it('separates monthly costs, nonrefundable expenses, and refundable deposits in the annual budget', () => {
    const a = analyze([
      {
        ...charge,
        refundable: null,
        quote: 'Required Connectivity fee: $27 monthly.',
      },
      {
        ...charge,
        id: 'billing',
        label: 'Utility billing fee',
        quote: 'Required Utility billing fee: $5.95 monthly.',
        amountMinor: 595,
        refundable: null,
      },
      {
        id: 'admin',
        label: 'Administrative fee',
        category: 'administration',
        quote: 'Required nonrefundable Administrative fee: $70 one time.',
        amountMinor: 7000,
        frequency: 'one_time',
      },
      {
        id: 'deposit',
        label: 'Security deposit',
        category: 'security_deposit',
        quote: 'Required refundable Security deposit: $2,000 one time.',
        amountMinor: 200000,
        frequency: 'one_time',
        refundable: true,
      },
    ]);
    const listing = materializeListing(a);
    const baseline = materializeListing(analyze([]));
    expect(a.customRecurringFees.map((f) => [f.label, f.amount])).toEqual([
      ['Connectivity fee (required)', 27],
      ['Utility billing fee (required)', 5.95],
    ]);
    expect(
      calculateEstimatedTrueMonthlyCost(listing) -
        calculateEstimatedTrueMonthlyCost(baseline),
    ).toBeCloseTo(32.95);
    expect(
      calculateRequiredMoveInCash(listing) -
        calculateRequiredMoveInCash(baseline),
    ).toBe(2070);
    expect(calculateRefundableDeposits(listing)).toBe(2000);
    expect(calculateNonrefundableMoveInExpenses(listing)).toBe(70);
    expect(
      calculateFirstYearHousingCost(listing) -
        calculateFirstYearHousingCost(baseline),
    ).toBeCloseTo(465.4);
    expect(
      renderToStaticMarkup(
        <AiSourceReview analysis={a} update={() => undefined} />,
      ),
    ).toBe('');
    const record: SavedListingRecord = {
      schemaVersion: 1,
      id: 'fee-contract',
      url: a.listing.identity.url!.value,
      analysis: a,
      createdAt: a.updatedAt,
      updatedAt: a.updatedAt,
    };
    const restored = importListingsJson(exportListingsJson([record]));
    expect(restored.errors).toEqual([]);
    expect(createComparison(restored.records[0]).firstYearTotal).toBe(
      calculateFirstYearHousingCost(listing),
    );
  });

  it.each(deferred)(
    '$id: preserves exact qualifications as a priced note without increasing costs',
    (scenario) => {
      const a = analyze([scenario]);
      expect(a.customRecurringFees).toEqual([]);
      expect(calculateEstimatedTrueMonthlyCost(materializeListing(a))).toBe(
        calculateEstimatedTrueMonthlyCost(materializeListing(analyze([]))),
      );
      const markup = renderToStaticMarkup(
        <AiSourceReview analysis={a} update={() => undefined} />,
      );
      expect(markup).toContain('Connectivity fee');
      expect(markup).toContain('27');
      // A retained note must stay priced, preserve cadence/basis, and not apply a
      // cost just because the renter pressed Keep.
      const details = {
        range: ['$27–$40', 'monthly'],
        cad: ['CA$27', 'monthly'],
        weekly: ['weekly'],
        yearly: ['yearly'],
        'per-person': ['per person'],
        'per-vehicle': ['per vehicle'],
        optional: ['optional'],
        conditional: ['conditional'],
        building: ['monthly'],
        'refundable-monthly': ['refundable'],
      }[scenario.id];
      for (const text of details ?? []) expect(markup).toContain(text);
      const noteId = Object.keys(a.aiReviewDecisions ?? {});
      expect(noteId).toEqual([]);
      const kept = decidePropertyNote(
        a,
        adaptExtraction(a.aiExtraction!).manualCharges[0],
        true,
        'ai',
      );
      expect(kept.propertyNotes[0].text).toContain('27');
      expect(calculateEstimatedTrueMonthlyCost(materializeListing(kept))).toBe(
        calculateEstimatedTrueMonthlyCost(materializeListing(a)),
      );
    },
  );

  it.each(['pet_rent', 'pet_fee', 'pet_deposit'] as const)(
    '%s respects zero, one, and multiple pets when the quote states per pet',
    (category) => {
      const a = analyze([
        {
          id: 'pet',
          label: 'Pet charge',
          category,
          quote: `Optional ${category}: $35 per pet ${category === 'pet_rent' ? 'monthly' : 'one time'}, ${category === 'pet_deposit' ? 'refundable' : 'nonrefundable'}.`,
          amountMinor: 3500,
          frequency: category === 'pet_rent' ? 'monthly' : 'one_time',
          basis: 'per_pet',
          applicability: 'optional',
          refundable: category === 'pet_deposit',
        },
      ]);
      const key =
        category === 'pet_rent'
          ? 'petRent'
          : category === 'pet_fee'
            ? 'petFee'
            : 'petDeposit';
      for (const count of [0, 1, 3]) {
        const listing = materializeListing(
          applyHouseholdProfile(a, {
            occupants: 1,
            cats: count,
            smallDogs: 0,
            largeDogs: 0,
          }),
        );
        expect(
          (category === 'pet_rent'
            ? listing.recurring.petRent
            : listing.upfront[key as 'petFee' | 'petDeposit']
          )?.value,
        ).toBe(35 * count);
      }
    },
  );

  it('rejects a fee quote forged across different capture blocks', () => {
    const { request, response } = feeContract([
      charge,
      {
        ...charge,
        id: 'billing',
        label: 'Utility billing fee',
        quote: 'Required Utility billing fee: $5.95 monthly.',
        amountMinor: 595,
      },
    ]);
    response.result.evidence.find((e) => e.blockId === 'service')!.quote =
      'Connectivity fee: $5.95';
    expect(() => acceptResponse(response, request)).toThrow();
  });
});

describe('AI prepaid rent, deposits, and pet billing basis', () => {
  it('includes prepaid first-month rent in move-in cash without counting it again as an annual expense', () => {
    const a = analyze([
      {
        ...charge,
        id: 'first-month',
        category: 'move_in',
        label: 'First month rent',
        quote: 'Required First month rent: $2,000 payable once at signing.',
        amountMinor: 200000,
        frequency: 'one_time',
      },
    ]);
    const listing = materializeListing(a);
    expect(calculateRequiredMoveInCash(listing)).toBe(2000);
    expect(calculateFirstYearHousingCost(listing)).toBe(
      calculateFirstYearHousingCost(materializeListing(analyze([]))),
    );
  });
  it('uses structured per-pet basis even when the exact source quote omits the words per pet', () => {
    const a = analyze([
      {
        ...charge,
        id: 'pet',
        category: 'pet_rent',
        label: 'Pet rent',
        quote: 'Optional monthly pet rent: $35.',
        amountMinor: 3500,
        basis: 'per_pet',
        applicability: 'optional',
      },
    ]);
    expect(
      materializeListing(
        applyHouseholdProfile(a, {
          occupants: 1,
          cats: 2,
          smallDogs: 0,
          largeDogs: 0,
        }),
      ).recurring.petRent?.value,
    ).toBe(70);
  });
  it('maps a required refundable holding deposit into refundable move-in cash', () => {
    const a = analyze([
      {
        ...charge,
        id: 'holding',
        label: 'Holding deposit',
        category: 'holding_deposit',
        quote: 'Required refundable Holding deposit: $350 due once.',
        amountMinor: 35000,
        frequency: 'one_time',
        refundable: true,
      },
    ]);
    expect(calculateRefundableDeposits(materializeListing(a))).toBe(350);
  });
});

describe('deposit uncertainty remains reviewable', () => {
  it('retains unknown refundable status as uncertainty instead of labeling it refundable in a note', () => {
    const a = analyze([
      {
        ...charge,
        id: 'uncertain-deposit',
        label: 'Security deposit',
        category: 'security_deposit',
        quote: 'Required Security deposit: $350 due once.',
        amountMinor: 35000,
        frequency: 'one_time',
        refundable: null,
      },
    ]);
    expect(
      renderToStaticMarkup(
        <AiSourceReview analysis={a} update={() => undefined} />,
      ),
    ).toContain('refundability not stated');
  });
});
