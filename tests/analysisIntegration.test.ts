import { describe, expect, it } from 'vitest';
import {
  calculateEstimatedTrueMonthlyCost,
  calculateRequiredMoveInCash,
} from '../src/calculations';
import {
  applyExtraction,
  applyHouseholdProfile,
  clearField,
  createInitialAnalysis,
  materializeListing,
  setIdentityValue,
  setRecurringValue,
  setUpfrontValue,
  setUtilityIncluded,
  resetField,
} from '../src/shared/analysis';
import { emptyExtraction } from '../src/extractors/types';
import { normalizeHouseholdProfile } from '../src/shared/household';

describe('manual listing analysis integration', () => {
  it('migrates the legacy pet flag to one cat and drops internet preference', () => {
    expect(
      normalizeHouseholdProfile({
        occupants: 2,
        smallDogs: 0,
        largeDogs: 0,
        otherPets: true,
        internetMonthlyCost: 85,
      }),
    ).toEqual({ occupants: 2, cats: 1, smallDogs: 0, largeDogs: 0 });
  });

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

  it('uses a fixed default internet estimate', () => {
    const analysis = createInitialAnalysis(
      'https://example.com/rental/default-internet',
      'Internet estimate',
    );
    analysis.occupants = 3;
    expect(analysis.listing.recurring.internet?.value).toBe(60);
    expect(materializeListing(analysis).recurring.internet?.value).toBe(60);
  });

  it('lets listing-included internet override the default estimate', () => {
    let analysis = createInitialAnalysis(
      'https://example.com/rental/internet-included',
      'Included internet',
    );
    const extraction = emptyExtraction('Test extractor', '1.0.0');
    extraction.includedUtilities = ['internet'];
    extraction.rawUtilityText = 'Internet included in rent';
    analysis = applyExtraction(analysis, extraction);

    expect(analysis.utilityIncluded.internet).toBe(true);
    expect(analysis.listing.recurring.internet?.value).toBe(0);
    expect(analysis.listing.recurring.internet?.source).toBe('listing');
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

  it('reuses household details and applies pet costs only to pet owners', () => {
    let analysis = createInitialAnalysis('https://example.com/pets', 'Pets');
    analysis = setRecurringValue(analysis, 'petRent', 50);
    analysis = setUpfrontValue(analysis, 'petDeposit', 300);

    const withoutPets = materializeListing(
      applyHouseholdProfile(analysis, {
        occupants: 2,
        cats: 0,
        smallDogs: 0,
        largeDogs: 0,
      }),
    );
    expect(withoutPets.recurring.petRent?.value).toBe(0);
    expect(withoutPets.upfront.petDeposit?.value).toBe(0);
    expect(withoutPets.recurring.internet?.value).toBe(60);
    expect(withoutPets.recurring.electricity?.value).toBe(104);

    const withLargeDog = materializeListing(
      applyHouseholdProfile(analysis, {
        occupants: 2,
        cats: 0,
        smallDogs: 0,
        largeDogs: 1,
      }),
    );
    expect(withLargeDog.recurring.petRent?.value).toBe(50);
    expect(withLargeDog.upfront.petDeposit?.value).toBe(300);
  });

  it('multiplies listing per-pet rates by the household pet count', () => {
    const analysis = createInitialAnalysis('https://example.com/per-pet');
    analysis.listing.recurring.petRent = {
      value: 30,
      source: 'listing',
      confidence: 0.9,
      note: 'Supporting text: Pet Rent ($30 per pet)',
    };
    analysis.listing.upfront.petFee = {
      value: 300,
      source: 'listing',
      confidence: 0.9,
      note: 'Supporting text: Pet Fee ($300 per each pet)',
    };
    const listing = materializeListing(
      applyHouseholdProfile(analysis, {
        occupants: 2,
        cats: 0,
        smallDogs: 1,
        largeDogs: 1,
      }),
    );
    expect(listing.recurring.petRent?.value).toBe(60);
    expect(listing.upfront.petFee?.value).toBe(600);
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

  it('removes stale listing facts while preserving user edits', () => {
    let analysis = createInitialAnalysis(
      'https://example.com/rental/stale',
      'Stale extraction',
    );
    const first = emptyExtraction('Test extractor', '1.0.0');
    first.listing.recurring.advertisedRent = {
      value: 1_900,
      source: 'listing',
      confidence: 0.9,
    };
    first.listing.upfront.securityDeposit = {
      value: 1_000,
      source: 'listing',
      confidence: 0.8,
    };
    analysis = applyExtraction(analysis, first);
    analysis = setUpfrontValue(analysis, 'securityDeposit', 1_500);
    analysis = applyExtraction(
      analysis,
      emptyExtraction('Test extractor', '1.0.1'),
    );

    expect(analysis.listing.recurring.advertisedRent).toBeUndefined();
    expect(analysis.baseline.recurring.advertisedRent).toBeUndefined();
    expect(analysis.listing.upfront.securityDeposit?.value).toBe(1_500);
  });

  it('removes stale listing-derived utility inclusion', () => {
    let analysis = createInitialAnalysis(
      'https://example.com/rental/utilities',
      'Utilities',
    );
    const first = emptyExtraction('Test extractor', '1.0.0');
    first.includedUtilities = ['water'];
    analysis = applyExtraction(analysis, first);
    analysis = applyExtraction(
      analysis,
      emptyExtraction('Test extractor', '1.0.1'),
    );

    expect(analysis.utilityIncluded.water).toBe(false);
    expect(analysis.utilityIncludedSource.water).toBe('default');
    expect(analysis.listing.recurring.water?.source).not.toBe('listing');
  });

  it('uses an extracted listing title unless the user supplied one', () => {
    let analysis = createInitialAnalysis(
      'https://example.com/apartments/community',
      'Page title',
    );
    const extraction = emptyExtraction('Test extractor', '1.0.0');
    extraction.listing.identity.listingTitle = {
      value: 'Pine Court Apartments',
      source: 'listing',
      confidence: 0.9,
    };
    analysis = applyExtraction(analysis, extraction);
    expect(analysis.listing.identity.listingTitle?.value).toBe(
      'Pine Court Apartments',
    );

    analysis = setIdentityValue(analysis, 'listingTitle', 'My favorite');
    extraction.listing.identity.listingTitle.value = 'New extracted name';
    analysis = applyExtraction(analysis, extraction);
    expect(analysis.listing.identity.listingTitle?.value).toBe('My favorite');
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

  it('keeps a user-cleared number unknown during extraction and can reset it', () => {
    let analysis = createInitialAnalysis(
      'https://example.com/rental/5',
      'Clear extracted value',
    );
    const extraction = emptyExtraction('Test extractor', '1.0.0');
    extraction.listing.recurring.advertisedRent = {
      value: 2_400,
      source: 'listing',
      confidence: 0.9,
    };
    analysis = applyExtraction(analysis, extraction);
    analysis = clearField(analysis, 'recurring', 'advertisedRent');
    analysis = applyExtraction(analysis, extraction);
    expect(analysis.listing.recurring.advertisedRent).toBeUndefined();
    expect(analysis.userClearedFields).toContain('recurring.advertisedRent');

    analysis = resetField(analysis, 'recurring', 'advertisedRent');
    expect(analysis.listing.recurring.advertisedRent?.value).toBe(2_400);
    expect(analysis.userClearedFields).not.toContain(
      'recurring.advertisedRent',
    );
  });
});
