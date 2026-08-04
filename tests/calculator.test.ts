import { describe, expect, it } from 'vitest';
import {
  calculateCostPerSquareFoot,
  calculateEffectiveMonthlyRent,
  calculateEstimatedTrueMonthlyCost,
  calculateFirstYearHousingCost,
  calculateNonrefundableMoveInExpenses,
  calculateRefundableDeposits,
  calculateRequiredMoveInCash,
  listMissingCostCategories,
  type RentalListing,
  type SourcedValue,
  type UtilityEstimationInput,
} from '../src/calculations';

const value = <T>(
  input: T,
  source: SourcedValue<T>['source'] = 'listing',
): SourcedValue<T> => ({
  value: input,
  source,
  confidence: 1,
});

const listing = (overrides: Partial<RentalListing> = {}): RentalListing => ({
  identity: { squareFootage: value(1_000) },
  recurring: { advertisedRent: value(2_000) },
  upfront: {},
  ...overrides,
});

const utilityInput = (
  overrides: Partial<UtilityEstimationInput> = {},
): UtilityEstimationInput => ({
  occupants: 1,
  housingType: 'apartment',
  includedUtilities: [],
  bedrooms: 1,
  squareFootage: 800,
  ...overrides,
});

describe('rental calculator', () => {
  it('does not add utilities when all utilities are included', () => {
    const result = calculateEstimatedTrueMonthlyCost(listing(), {
      utilityEstimation: utilityInput({
        includedUtilities: [
          'electricity',
          'naturalGas',
          'water',
          'sewer',
          'trash',
          'internet',
        ],
        laundryType: 'in_unit',
      }),
    });
    expect(result).toBe(2_015); // renters insurance placeholder only
  });

  it('estimates every utility when none are included', () => {
    expect(
      calculateEstimatedTrueMonthlyCost(listing(), {
        utilityEstimation: utilityInput({ laundryType: 'in_unit' }),
      }),
    ).toBe(2_295);
  });

  it('handles missing and partial listing information', () => {
    const partial = listing({ identity: {}, recurring: {}, upfront: {} });
    expect(calculateEstimatedTrueMonthlyCost(partial)).toBe(0);
    expect(calculateCostPerSquareFoot(partial)).toBeUndefined();
    expect(listMissingCostCategories(partial)).toHaveLength(21);
  });

  it('estimates paid shared laundry but not in-unit laundry', () => {
    const shared = calculateEstimatedTrueMonthlyCost(listing(), {
      utilityEstimation: utilityInput({
        includedUtilities: [
          'electricity',
          'naturalGas',
          'water',
          'sewer',
          'trash',
          'internet',
        ],
        laundryType: 'shared_paid',
      }),
    });
    const inUnit = calculateEstimatedTrueMonthlyCost(listing(), {
      utilityEstimation: utilityInput({
        includedUtilities: [
          'electricity',
          'naturalGas',
          'water',
          'sewer',
          'trash',
          'internet',
        ],
        laundryType: 'in_unit',
      }),
    });
    expect(shared - inUnit).toBe(24);
  });

  it('includes monthly pet rent and pet cash requirements', () => {
    const withPet = listing({
      recurring: { advertisedRent: value(2_000), petRent: value(50) },
      upfront: { petDeposit: value(300) },
    });
    expect(calculateEstimatedTrueMonthlyCost(withPet)).toBe(2_050);
    expect(calculateRequiredMoveInCash(withPet)).toBe(300);
    expect(calculateRefundableDeposits(withPet)).toBe(300);
  });

  it('amortizes rent concessions over twelve months', () => {
    const concession = listing({
      concessions: { monthsFree: value(1), oneTimeCredit: value(600) },
    });
    expect(calculateEffectiveMonthlyRent(concession)).toBe(1_783.3333333333333);
  });

  it('separates refundable deposits from expenses and first-year cost', () => {
    const moveIn = listing({
      upfront: {
        applicationFee: value(50),
        administrativeFee: value(100),
        securityDeposit: value(2_000),
        utilityDeposits: value(200),
        firstMonthsRent: value(2_000),
        lastMonthsRent: value(2_000),
      },
    });
    expect(calculateRequiredMoveInCash(moveIn)).toBe(6_350);
    expect(calculateRefundableDeposits(moveIn)).toBe(2_200);
    expect(calculateNonrefundableMoveInExpenses(moveIn)).toBe(150);
    expect(calculateFirstYearHousingCost(moveIn)).toBe(24_150);
  });

  it('preserves explicit zero-value fields', () => {
    const freeParking = listing({
      recurring: { advertisedRent: value(2_000), parking: value(0) },
    });
    expect(calculateEstimatedTrueMonthlyCost(freeParking)).toBe(2_000);
    expect(
      listMissingCostCategories(freeParking).some(
        ({ category }) => category === 'parking',
      ),
    ).toBe(false);
  });

  it('calculates monthly cost per square foot', () => {
    expect(calculateCostPerSquareFoot(listing())).toBe(2);
  });
});
