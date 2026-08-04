import { describe, expect, it } from 'vitest';
import {
  calculateEstimatedTrueMonthlyCost,
  calculateRequiredMoveInCash,
} from '../src/calculations';
import {
  applyExtraction,
  createInitialAnalysis,
  materializeListing,
  setIdentityValue,
  setRecurringValue,
  setUpfrontValue,
  setUtilityIncluded,
} from '../src/shared/analysis';
import { emptyExtraction } from '../src/extractors/types';

describe('manual listing analysis integration', () => {
  it('connects side-panel edits, custom fees, laundry, and calculations', () => {
    let analysis = createInitialAnalysis(
      'https://example.com/rental/1',
      'Manual listing',
    );
    analysis = setIdentityValue(analysis, 'fullAddress', '123 Main St');
    analysis = setRecurringValue(analysis, 'advertisedRent', 2_000);
    analysis = setRecurringValue(analysis, 'parking', 100);
    analysis = setUpfrontValue(analysis, 'securityDeposit', 2_000);
    analysis = setUtilityIncluded(analysis, 'water', true);
    analysis = setUtilityIncluded(analysis, 'sewer', true);
    analysis.laundryType = 'shared_paid';
    analysis.paidLaundry = { washPrice: 2, dryPrice: 2, loadsPerWeek: 2 };
    analysis.customRecurringFees = [
      { id: 'monthly', label: 'Package service', amount: 10 },
    ];
    analysis.customOneTimeFees = [{ id: 'once', label: 'Key fee', amount: 25 }];

    const listing = materializeListing(analysis);
    expect(calculateEstimatedTrueMonthlyCost(listing)).toBeCloseTo(2_379.67, 2);
    expect(calculateRequiredMoveInCash(listing)).toBe(2_025);
    expect(listing.identity.fullAddress?.source).toBe('user');
    expect(listing.recurring.water?.value).toBe(0);
  });

  it('updates untouched estimates for occupants but preserves user edits', () => {
    let analysis = createInitialAnalysis(
      'https://example.com/rental/2',
      'Occupancy test',
    );
    analysis.occupants = 2;
    analysis = setRecurringValue(analysis, 'internet', 40);
    const listing = materializeListing(analysis);
    expect(listing.recurring.electricity?.value).toBe(104);
    expect(listing.recurring.internet?.value).toBe(40);
    expect(listing.recurring.internet?.source).toBe('user');
  });

  it('never overwrites a user-edited value during re-extraction', () => {
    let analysis = createInitialAnalysis(
      'https://example.com/rental/3',
      'Override test',
    );
    analysis = setRecurringValue(analysis, 'advertisedRent', 2_200);
    const extraction = emptyExtraction('Test extractor', '1.0.0');
    extraction.listing.recurring.advertisedRent = {
      value: 1_900,
      source: 'listing',
      confidence: 0.9,
      note: 'Supporting text: $1,900',
    };
    analysis = applyExtraction(analysis, extraction);
    expect(analysis.listing.recurring.advertisedRent?.value).toBe(2_200);
    expect(analysis.listing.recurring.advertisedRent?.source).toBe('user');
    expect(analysis.baseline.recurring.advertisedRent?.value).toBe(1_900);
  });

  it('preserves a user utility override when extraction says it is included', () => {
    let analysis = createInitialAnalysis(
      'https://example.com/rental/4',
      'Utilities',
    );
    analysis = setUtilityIncluded(analysis, 'water', false);
    const extraction = emptyExtraction('Test extractor', '1.0.0');
    extraction.includedUtilities = ['water'];
    extraction.rawUtilityText = 'Water included';
    analysis = applyExtraction(analysis, extraction);
    expect(analysis.utilityIncluded.water).toBe(false);
    expect(analysis.utilityIncludedSource.water).toBe('user');
    expect(analysis.baseline.recurring.water?.value).toBe(0);
  });
});
