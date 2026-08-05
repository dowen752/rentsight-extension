import { describe, expect, it } from 'vitest';
import {
  calculateEstimatedTrueMonthlyCost,
  validateRentalListing,
  validateUtilityEstimationInput,
  type RentalListing,
} from '../src/calculations';

describe('calculation validation', () => {
  it('returns understandable errors for negative costs', () => {
    const listing: RentalListing = {
      identity: {},
      recurring: {
        advertisedRent: { value: -1, source: 'listing', confidence: 1 },
      },
      upfront: {},
    };
    const result = validateRentalListing(listing);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toEqual({
      path: 'recurring.advertisedRent.value',
      message: 'Value must be a finite, non-negative number.',
    });
    expect(() => calculateEstimatedTrueMonthlyCost(listing)).toThrow(
      'recurring.advertisedRent.value',
    );
  });

  it('rejects impossible confidence and coordinates', () => {
    const result = validateRentalListing({
      identity: {
        latitude: { value: 91, source: 'listing', confidence: 2 },
        longitude: { value: 181, source: 'listing', confidence: 1 },
      },
      recurring: {},
      upfront: {},
    });
    expect(result.errors).toHaveLength(3);
  });

  it('rejects impossible utility estimation inputs', () => {
    const result = validateUtilityEstimationInput({
      occupants: 0,
      bedrooms: -1,
      squareFootage: 0,
      housingType: 'apartment',
      includedUtilities: [],
    });
    expect(result.errors.map(({ path }) => path)).toEqual([
      'occupants',
      'bedrooms',
      'squareFootage',
    ]);
  });

  it('rejects concessions longer than the lease', () => {
    const listing: RentalListing = {
      identity: {},
      recurring: {},
      upfront: {},
      concessions: {
        leaseMonths: { value: 6, source: 'user', confidence: 1 },
        monthsFree: { value: 7, source: 'user', confidence: 1 },
      },
    };
    const result = validateRentalListing(listing);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: 'concessions.monthsFree.value',
      message: 'Free months cannot exceed the lease duration.',
    });
  });
});
