import type {
  LaundryType,
  ListingIdentity,
  RecurringCosts,
  RentalListing,
  RentConcessions,
  SourcedValue,
  UpfrontCosts,
  UtilityCategory,
  ValueSource,
} from '../calculations';
import { estimateUtilities } from '../calculations';
import type { ListingExtraction } from '../extractors';
import type { LocationEstimate } from '../location';
import {
  DEFAULT_HOUSEHOLD_PROFILE,
  householdHasPets,
  normalizeHouseholdProfile,
  type HouseholdProfile,
} from './household';

export interface CustomFee {
  id: string;
  label: string;
  amount: number;
}

export interface PaidLaundryDetails {
  washPrice: number;
  dryPrice: number;
  loadsPerWeek: number;
}

export interface RentalAnalysis {
  listing: RentalListing;
  baseline: RentalListing;
  utilityIncluded: Record<UtilityCategory, boolean>;
  baselineUtilityIncluded: Record<UtilityCategory, boolean>;
  utilityIncludedSource: Record<UtilityCategory, ValueSource>;
  occupants: number;
  householdProfile: HouseholdProfile;
  laundryType: LaundryType;
  paidLaundry: PaidLaundryDetails;
  customRecurringFees: CustomFee[];
  customOneTimeFees: CustomFee[];
  userClearedFields: string[];
  updatedAt: string;
  extraction?: ListingExtraction;
  locationEstimate?: LocationEstimate;
}

export type RentalAnalysisMap = Record<string, RentalAnalysis>;

export const UTILITY_CATEGORIES: readonly UtilityCategory[] = [
  'electricity',
  'naturalGas',
  'water',
  'sewer',
  'trash',
  'internet',
];

const estimated = (value: number, note: string): SourcedValue<number> => ({
  value,
  source: 'default',
  confidence: 0.35,
  note,
});

export function createInitialAnalysis(
  url: string,
  title?: string,
): RentalAnalysis {
  void title;
  const listing: RentalListing = {
    identity: {
      url: { value: url, source: 'listing', confidence: 1 },
    },
    recurring: {
      electricity: estimated(90, 'National placeholder estimate.'),
      naturalGas: estimated(45, 'National placeholder estimate.'),
      water: estimated(35, 'National placeholder estimate.'),
      sewer: estimated(25, 'National placeholder estimate.'),
      trash: estimated(25, 'National placeholder estimate.'),
      rentersInsurance: estimated(15, 'Default renters-insurance assumption.'),
    },
    upfront: {},
    concessions: {
      leaseMonths: { value: 12, source: 'default', confidence: 0.7 },
    },
  };
  return {
    listing,
    baseline: structuredClone(listing),
    utilityIncluded: {
      electricity: false,
      naturalGas: false,
      water: false,
      sewer: false,
      trash: false,
      internet: false,
    },
    baselineUtilityIncluded: {
      electricity: false,
      naturalGas: false,
      water: false,
      sewer: false,
      trash: false,
      internet: false,
    },
    utilityIncludedSource: {
      electricity: 'default',
      naturalGas: 'default',
      water: 'default',
      sewer: 'default',
      trash: 'default',
      internet: 'default',
    },
    occupants: 1,
    householdProfile: { ...DEFAULT_HOUSEHOLD_PROFILE },
    laundryType: 'unknown',
    paidLaundry: { washPrice: 2, dryPrice: 2, loadsPerWeek: 2 },
    customRecurringFees: [],
    customOneTimeFees: [],
    userClearedFields: [],
    updatedAt: new Date().toISOString(),
  };
}

export function materializeListing(analysis: RentalAnalysis): RentalListing {
  const listing = structuredClone(analysis.listing);
  const household = normalizeHouseholdProfile(
    analysis.householdProfile
      ? { ...analysis.householdProfile, occupants: analysis.occupants }
      : { occupants: analysis.occupants },
  );
  const utilityEstimates = estimateUtilities({
    occupants: household.occupants,
    housingType: 'apartment',
    bedrooms: listing.identity.bedrooms?.value,
    squareFootage: listing.identity.squareFootage?.value,
    includedUtilities: UTILITY_CATEGORIES.filter(
      (category) => analysis.utilityIncluded[category],
    ),
    laundryType: analysis.laundryType,
    location: {
      city: listing.identity.city?.value,
      state: listing.identity.state?.value,
      zipCode: listing.identity.zipCode?.value,
    },
  });
  for (const category of UTILITY_CATEGORIES) {
    if (category === 'internet' && !listing.recurring.internet) continue;
    if (listing.recurring[category]?.source !== 'user') {
      const estimate = utilityEstimates[category];
      if (estimate && analysis.locationEstimate && estimate.value > 0) {
        listing.recurring[category] = {
          ...estimate,
          value: Math.round(
            estimate.value * analysis.locationEstimate.utilityAdjustmentFactor,
          ),
          source: 'location_estimate',
          confidence: 0.5,
          note: `Adjusted ${analysis.locationEstimate.utilityAdjustmentFactor.toFixed(2)}× for ${analysis.locationEstimate.location.state}.`,
        };
      } else listing.recurring[category] = estimate;
    }
  }
  const recurringCustom = analysis.customRecurringFees.reduce(
    (sum, fee) => sum + fee.amount,
    0,
  );
  const oneTimeCustom = analysis.customOneTimeFees.reduce(
    (sum, fee) => sum + fee.amount,
    0,
  );
  if (recurringCustom > 0) {
    listing.recurring.otherRequiredMonthlyFees = {
      value:
        (listing.recurring.otherRequiredMonthlyFees?.value ?? 0) +
        recurringCustom,
      source: 'user',
      confidence: 1,
      note: 'Includes custom recurring fees.',
    };
  }
  if (oneTimeCustom > 0) {
    listing.upfront.otherMoveInFees = {
      value: (listing.upfront.otherMoveInFees?.value ?? 0) + oneTimeCustom,
      source: 'user',
      confidence: 1,
      note: 'Includes custom one-time fees.',
    };
  }
  if (!householdHasPets(household)) {
    listing.recurring.petRent = {
      value: 0,
      source: 'user',
      confidence: 1,
      note: 'Listing pet rent does not apply because the household profile has no pets.',
    };
    listing.upfront.petDeposit = {
      value: 0,
      source: 'user',
      confidence: 1,
      note: 'Listing pet deposit does not apply because the household profile has no pets.',
    };
  }
  if (analysis.laundryType === 'shared_paid') {
    const monthlyLaundry =
      ((analysis.paidLaundry.washPrice + analysis.paidLaundry.dryPrice) *
        analysis.paidLaundry.loadsPerWeek *
        52) /
      12;
    listing.recurring.laundry = {
      value: monthlyLaundry,
      source: 'user',
      confidence: 0.8,
      note: 'Calculated from entered paid-laundry usage.',
    };
  } else if (
    ['in_unit', 'shared_free', 'hookups_only', 'none'].includes(
      analysis.laundryType,
    )
  ) {
    listing.recurring.laundry = {
      value: 0,
      source: 'user',
      confidence: 0.9,
    };
  }
  return listing;
}

export function applyHouseholdProfile(
  analysis: RentalAnalysis,
  profile: HouseholdProfile,
): RentalAnalysis {
  const next = structuredClone(analysis);
  const household = normalizeHouseholdProfile(profile);
  next.householdProfile = household;
  next.occupants = household.occupants;
  const applied = applyInternetPreference(next, household.internetMonthlyCost);
  applied.updatedAt = new Date().toISOString();
  return applied;
}

export function applyLocationEstimate(
  analysis: RentalAnalysis,
  estimate: LocationEstimate,
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.locationEstimate = estimate;
  const utilityEstimates = estimateUtilities({
    occupants: next.occupants,
    housingType: 'apartment',
    bedrooms: next.listing.identity.bedrooms?.value,
    squareFootage: next.listing.identity.squareFootage?.value,
    includedUtilities: UTILITY_CATEGORIES.filter(
      (category) => next.utilityIncluded[category],
    ),
    laundryType: next.laundryType,
  });
  for (const category of UTILITY_CATEGORIES) {
    const current = next.listing.recurring[category];
    if (category === 'internet' && !current) continue;
    const base = utilityEstimates[category];
    if (
      base &&
      base.value > 0 &&
      current?.source !== 'user' &&
      next.utilityIncludedSource[category] !== 'listing'
    ) {
      const adjusted: SourcedValue<number> = {
        value: Math.round(base.value * estimate.utilityAdjustmentFactor),
        source: 'location_estimate',
        confidence: 0.5,
        note: `Adjusted ${estimate.utilityAdjustmentFactor.toFixed(2)}× for ${estimate.location.state} using local configuration.`,
      };
      next.listing.recurring[category] = adjusted;
      next.baseline.recurring[category] = structuredClone(adjusted);
    }
  }
  const values = {
    city: estimate.location.city,
    state: estimate.location.state,
    zipCode: estimate.location.zipCode,
  } as const;
  for (const [key, value] of Object.entries(values) as [
    keyof typeof values,
    string,
  ][]) {
    const current = next.listing.identity[key];
    if (
      (!current || current.source === 'default') &&
      !next.userClearedFields?.includes(`identity.${key}`)
    ) {
      next.listing.identity[key] = {
        value,
        source: 'location_estimate',
        confidence: 0.75,
        note: 'Resolved locally from the listing address.',
      };
    }
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function applyInternetPreference(
  analysis: RentalAnalysis,
  monthlyCost: number | undefined,
): RentalAnalysis {
  const next = structuredClone(analysis);
  const listingIncludesInternet =
    next.utilityIncluded.internet &&
    next.utilityIncludedSource.internet === 'listing';
  if (listingIncludesInternet) return next;
  if (monthlyCost === undefined) {
    delete next.listing.recurring.internet;
  } else {
    next.listing.recurring.internet = userValue(monthlyCost);
  }
  return next;
}

function userValue<T>(value: T): SourcedValue<T> {
  return { value, source: 'user', confidence: 1 };
}

export function setIdentityValue<K extends keyof ListingIdentity>(
  analysis: RentalAnalysis,
  key: K,
  value: NonNullable<ListingIdentity[K]>['value'],
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.userClearedFields ??= [];
  next.listing.identity[key] = userValue(value) as ListingIdentity[K];
  next.userClearedFields = next.userClearedFields.filter(
    (path) => path !== `identity.${String(key)}`,
  );
  next.updatedAt = new Date().toISOString();
  return next;
}

export function setRecurringValue<K extends keyof RecurringCosts>(
  analysis: RentalAnalysis,
  key: K,
  value: number,
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.userClearedFields ??= [];
  next.listing.recurring[key] = userValue(value);
  next.userClearedFields = next.userClearedFields.filter(
    (path) => path !== `recurring.${String(key)}`,
  );
  next.updatedAt = new Date().toISOString();
  return next;
}

export function setUpfrontValue<K extends keyof UpfrontCosts>(
  analysis: RentalAnalysis,
  key: K,
  value: number,
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.userClearedFields ??= [];
  next.listing.upfront[key] = userValue(value);
  next.userClearedFields = next.userClearedFields.filter(
    (path) => path !== `upfront.${String(key)}`,
  );
  next.updatedAt = new Date().toISOString();
  return next;
}

export function setConcessionValue<K extends keyof RentConcessions>(
  analysis: RentalAnalysis,
  key: K,
  value: number,
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.userClearedFields ??= [];
  next.listing.concessions ??= {};
  next.listing.concessions[key] = userValue(value);
  next.userClearedFields = next.userClearedFields.filter(
    (path) => path !== `concessions.${String(key)}`,
  );
  next.updatedAt = new Date().toISOString();
  return next;
}

export function resetField(
  analysis: RentalAnalysis,
  group: 'identity' | 'recurring' | 'upfront' | 'concessions',
  key: string,
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.userClearedFields ??= [];
  const currentGroup = next.listing[group] as
    Record<string, unknown> | undefined;
  const baselineGroup = next.baseline[group] as
    Record<string, unknown> | undefined;
  if (!currentGroup) return next;
  next.userClearedFields = next.userClearedFields.filter(
    (path) => path !== `${group}.${key}`,
  );
  if (baselineGroup?.[key] === undefined) delete currentGroup[key];
  else currentGroup[key] = structuredClone(baselineGroup[key]);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function clearField(
  analysis: RentalAnalysis,
  group: 'identity' | 'recurring' | 'upfront' | 'concessions',
  key: string,
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.userClearedFields ??= [];
  const currentGroup = next.listing[group] as
    Record<string, unknown> | undefined;
  if (currentGroup) delete currentGroup[key];
  const path = `${group}.${key}`;
  if (!next.userClearedFields.includes(path)) next.userClearedFields.push(path);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function setUtilityIncluded(
  analysis: RentalAnalysis,
  category: UtilityCategory,
  included: boolean,
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.userClearedFields ??= [];
  next.userClearedFields = next.userClearedFields.filter(
    (path) => path !== `recurring.${category}`,
  );
  next.utilityIncludedSource ??= Object.fromEntries(
    UTILITY_CATEGORIES.map((item) => [item, 'default']),
  ) as Record<UtilityCategory, ValueSource>;
  next.utilityIncluded[category] = included;
  next.utilityIncludedSource[category] = 'user';
  if (included) {
    next.listing.recurring[category] = {
      value: 0,
      source: 'user',
      confidence: 1,
      note: 'Marked as included by user.',
    };
  } else {
    next.listing.recurring[category] =
      structuredClone(next.baseline.recurring[category]) ??
      ({ value: 0, source: 'user', confidence: 1 } as SourcedValue<number>);
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function resetUtility(
  analysis: RentalAnalysis,
  category: UtilityCategory,
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.userClearedFields ??= [];
  next.userClearedFields = next.userClearedFields.filter(
    (path) => path !== `recurring.${category}`,
  );
  next.utilityIncludedSource ??= Object.fromEntries(
    UTILITY_CATEGORIES.map((item) => [item, 'default']),
  ) as Record<UtilityCategory, ValueSource>;
  next.utilityIncluded[category] = next.baselineUtilityIncluded[category];
  next.utilityIncludedSource[category] = next.baselineUtilityIncluded[category]
    ? 'listing'
    : 'default';
  const baseline = next.baseline.recurring[category];
  if (baseline) next.listing.recurring[category] = structuredClone(baseline);
  else delete next.listing.recurring[category];
  next.updatedAt = new Date().toISOString();
  return next;
}

function mergeExtractedGroup(
  current: Record<string, SourcedValue<unknown> | undefined>,
  baseline: Record<string, SourcedValue<unknown> | undefined>,
  extracted: Record<string, SourcedValue<unknown> | undefined>,
  group: 'identity' | 'recurring' | 'upfront' | 'concessions',
  userClearedFields: readonly string[],
): void {
  for (const [key, field] of Object.entries(extracted)) {
    if (!field) continue;
    baseline[key] = structuredClone(field);
    if (
      current[key]?.source !== 'user' &&
      !userClearedFields.includes(`${group}.${key}`)
    )
      current[key] = structuredClone(field);
  }
}

function removeStaleExtractedGroup(
  current: Record<string, SourcedValue<unknown> | undefined>,
  baseline: Record<string, SourcedValue<unknown> | undefined>,
  previous: Record<string, SourcedValue<unknown> | undefined> | undefined,
  extracted: Record<string, SourcedValue<unknown> | undefined>,
): void {
  if (!previous) return;
  for (const key of Object.keys(previous)) {
    if (extracted[key] !== undefined) continue;
    if (baseline[key]?.source === 'listing') delete baseline[key];
    if (current[key]?.source === 'listing') delete current[key];
  }
}

export function applyExtraction(
  analysis: RentalAnalysis,
  extraction: ListingExtraction,
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.userClearedFields ??= [];
  next.utilityIncludedSource ??= Object.fromEntries(
    UTILITY_CATEGORIES.map((item) => [item, 'default']),
  ) as Record<UtilityCategory, ValueSource>;
  const extractedIdentity = { ...extraction.listing.identity };
  removeStaleExtractedGroup(
    next.listing.identity as Record<string, SourcedValue<unknown> | undefined>,
    next.baseline.identity as Record<string, SourcedValue<unknown> | undefined>,
    next.extraction?.listing.identity as
      Record<string, SourcedValue<unknown> | undefined> | undefined,
    extractedIdentity as Record<string, SourcedValue<unknown> | undefined>,
  );
  removeStaleExtractedGroup(
    next.listing.recurring as Record<string, SourcedValue<unknown> | undefined>,
    next.baseline.recurring as Record<
      string,
      SourcedValue<unknown> | undefined
    >,
    next.extraction?.listing.recurring as
      Record<string, SourcedValue<unknown> | undefined> | undefined,
    extraction.listing.recurring as Record<
      string,
      SourcedValue<unknown> | undefined
    >,
  );
  removeStaleExtractedGroup(
    next.listing.upfront as Record<string, SourcedValue<unknown> | undefined>,
    next.baseline.upfront as Record<string, SourcedValue<unknown> | undefined>,
    next.extraction?.listing.upfront as
      Record<string, SourcedValue<unknown> | undefined> | undefined,
    extraction.listing.upfront as Record<
      string,
      SourcedValue<unknown> | undefined
    >,
  );
  if (next.extraction?.listing.concessions) {
    next.listing.concessions ??= {};
    next.baseline.concessions ??= {};
    removeStaleExtractedGroup(
      next.listing.concessions as Record<
        string,
        SourcedValue<unknown> | undefined
      >,
      next.baseline.concessions as Record<
        string,
        SourcedValue<unknown> | undefined
      >,
      next.extraction.listing.concessions as Record<
        string,
        SourcedValue<unknown> | undefined
      >,
      (extraction.listing.concessions ?? {}) as Record<
        string,
        SourcedValue<unknown> | undefined
      >,
    );
  }
  mergeExtractedGroup(
    next.listing.identity as Record<string, SourcedValue<unknown> | undefined>,
    next.baseline.identity as Record<string, SourcedValue<unknown> | undefined>,
    extractedIdentity as Record<string, SourcedValue<unknown> | undefined>,
    'identity',
    next.userClearedFields,
  );
  mergeExtractedGroup(
    next.listing.recurring as Record<string, SourcedValue<unknown> | undefined>,
    next.baseline.recurring as Record<
      string,
      SourcedValue<unknown> | undefined
    >,
    extraction.listing.recurring as Record<
      string,
      SourcedValue<unknown> | undefined
    >,
    'recurring',
    next.userClearedFields,
  );
  mergeExtractedGroup(
    next.listing.upfront as Record<string, SourcedValue<unknown> | undefined>,
    next.baseline.upfront as Record<string, SourcedValue<unknown> | undefined>,
    extraction.listing.upfront as Record<
      string,
      SourcedValue<unknown> | undefined
    >,
    'upfront',
    next.userClearedFields,
  );
  if (extraction.listing.concessions) {
    next.listing.concessions ??= {};
    next.baseline.concessions ??= {};
    mergeExtractedGroup(
      next.listing.concessions as Record<
        string,
        SourcedValue<unknown> | undefined
      >,
      next.baseline.concessions as Record<
        string,
        SourcedValue<unknown> | undefined
      >,
      extraction.listing.concessions as Record<
        string,
        SourcedValue<unknown> | undefined
      >,
      'concessions',
      next.userClearedFields,
    );
  }
  const includedUtilities = new Set(extraction.includedUtilities);
  for (const utility of next.extraction?.includedUtilities ?? []) {
    if (
      includedUtilities.has(utility) ||
      next.utilityIncludedSource[utility] === 'user'
    )
      continue;
    next.utilityIncluded[utility] = false;
    next.utilityIncludedSource[utility] = 'default';
    next.baselineUtilityIncluded[utility] = false;
    if (next.listing.recurring[utility]?.source === 'listing')
      delete next.listing.recurring[utility];
    if (next.baseline.recurring[utility]?.source === 'listing')
      delete next.baseline.recurring[utility];
  }
  for (const utility of extraction.includedUtilities) {
    const extractedValue: SourcedValue<number> = {
      value: 0,
      source: 'listing',
      confidence: 0.72,
      note: extraction.rawUtilityText
        ? `Supporting text: ${extraction.rawUtilityText.trim()}`
        : 'Listing states this utility is included.',
    };
    next.baseline.recurring[utility] = extractedValue;
    if (next.utilityIncludedSource[utility] !== 'user') {
      next.utilityIncluded[utility] = true;
      next.utilityIncludedSource[utility] = 'listing';
      if (next.listing.recurring[utility]?.source !== 'user') {
        next.listing.recurring[utility] = structuredClone(extractedValue);
      }
    }
    next.baselineUtilityIncluded[utility] = true;
  }
  if (extraction.laundryType && next.laundryType === 'unknown') {
    next.laundryType = extraction.laundryType;
  }
  next.extraction = structuredClone(extraction);
  next.updatedAt = new Date().toISOString();
  return next;
}
