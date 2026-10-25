import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adaptExtraction } from '../src/ai/adapter';
import type { ExtractionSuccess } from '../src/ai/types';
import type { Money } from '../src/ai/contracts/response';

const response = () =>
  JSON.parse(
    readFileSync('tests/fixtures/ai/normal.response.json', 'utf8'),
  ) as ExtractionSuccess;
const charge = (
  category: 'service' | 'other' | 'application' | 'administration',
  frequency: Money['frequency'],
  minor = 1000,
) => {
  const result = response();
  const fee = result.result.property.fees.value![0];
  fee.category = category;
  fee.id = 'fee-probe';
  fee.label = 'Fee probe';
  fee.amount.value = {
    ...fee.amount.value!,
    kind: 'exact',
    minMinor: minor,
    maxMinor: minor,
    frequency,
    basis: 'per_unit',
  };
  fee.refundable = { ...fee.refundable, status: 'known', value: false };
  return result;
};

describe('AI fee mapping into existing calculation inputs', () => {
  it.each(['service', 'other'] as const)(
    'maps required monthly %s charges',
    (category) => {
      const result = adaptExtraction(charge(category, 'monthly', 1250));
      expect(
        result.extraction.listing.recurring.otherRequiredMonthlyFees?.value,
      ).toBe(12.5);
      expect(result.manualCharges).toEqual([]);
    },
  );
  it.each(['application', 'administration'] as const)(
    'maps required one-time %s charges',
    (category) => {
      const result = adaptExtraction(charge(category, 'one_time', 6550));
      const key =
        category === 'application' ? 'applicationFee' : 'administrativeFee';
      expect(result.extraction.listing.upfront[key]?.value).toBe(65.5);
      expect(result.manualCharges).toEqual([]);
    },
  );
  it.each([0, 1, 1000, 125000])(
    'preserves exact minor-unit amount %s',
    (minor) => {
      expect(
        adaptExtraction(charge('service', 'monthly', minor)).extraction.listing
          .recurring.otherRequiredMonthlyFees?.value,
      ).toBe(minor / 100);
    },
  );
  it('adds separate service charges sharing the same input', () => {
    const r = charge('service', 'monthly');
    const fee = structuredClone(r.result.property.fees.value![0]);
    fee.id = 'second-charge';
    fee.amount.value!.minMinor = fee.amount.value!.maxMinor = 500;
    r.result.property.fees.value!.push(fee);
    expect(
      adaptExtraction(r).extraction.listing.recurring.otherRequiredMonthlyFees
        ?.value,
    ).toBe(15);
  });
  it.each(['optional', 'conditional', 'unknown'] as const)(
    'does not silently apply %s service fees',
    (kind) => {
      const r = charge('service', 'monthly');
      r.result.property.fees.value![0].applicability.kind = kind;
      const result = adaptExtraction(r);
      expect(
        result.extraction.listing.recurring.otherRequiredMonthlyFees,
      ).toBeUndefined();
      expect(result.manualCharges).toHaveLength(1);
    },
  );
  it.each(['yearly', 'daily', 'per_occurrence', 'unknown'] as const)(
    'does not treat %s charges as monthly',
    (frequency) => {
      const result = adaptExtraction(charge('service', frequency));
      expect(
        result.extraction.listing.recurring.otherRequiredMonthlyFees,
      ).toBeUndefined();
      expect(result.manualCharges).toHaveLength(1);
    },
  );
  it.each(['per_person', 'per_pet', 'per_vehicle', 'unknown'] as const)(
    'does not treat %s service fees as per unit',
    (basis) => {
      const r = charge('service', 'monthly');
      r.result.property.fees.value![0].amount.value!.basis = basis;
      const result = adaptExtraction(r);
      expect(
        result.extraction.listing.recurring.otherRequiredMonthlyFees,
      ).toBeUndefined();
      expect(result.manualCharges).toHaveLength(1);
    },
  );
  it('does not silently interpret a foreign-currency charge as dollars', () => {
    const r = charge('service', 'monthly');
    r.result.property.fees.value![0].amount.value!.currency = 'CAD';
    expect(
      adaptExtraction(r).extraction.listing.recurring.otherRequiredMonthlyFees,
    ).toBeUndefined();
  });
});

describe('unpriced fees in AI responses', () => {
  it.each(['Valet Trash', 'Private Resident Garage Parking'])(
    'keeps %s reviewable when the backend classifies it as a fee',
    (label) => {
      const r = charge('service', 'monthly');
      const fee = r.result.property.fees.value![0];
      fee.label = label;
      fee.amount = {
        ...fee.amount,
        status: 'unknown',
        value: null,
        candidates: [],
        evidenceIds: [],
      };
      fee.applicability = { kind: 'unknown', conditions: [], evidenceIds: [] };
      expect(adaptExtraction(r).manualCharges).toHaveLength(1);
      fee.label += ' fee';
      expect(adaptExtraction(r).manualCharges).toHaveLength(1);
    },
  );
});
