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
import { DEFAULT_COST_ASSUMPTIONS, estimateUtilities } from '../calculations';
import type { ListingExtraction } from '../extractors';
import type { LocationEstimate } from '../location';
import {
  DEFAULT_HOUSEHOLD_PROFILE,
  normalizeHouseholdProfile,
  type HouseholdProfile,
} from './household';

export interface CustomFee {
  source?: 'listing' | 'user';
  evidence?: string;
  id: string;
  label: string;
  amount: number;
}

export interface PaidLaundryDetails {
  washPrice: number;
  dryPrice: number;
  loadsPerWeek: number;
}

export interface PropertyNote {
  id: string;
  text: string;
  source: 'user' | 'ai' | 'listing';
  sourceId?: string;
}

export interface RentalAnalysis {
  aiExtraction?: import('../ai/types').ExtractionSuccess;
  aiReviewDecisions?: Record<string, 'entered' | 'excluded' | 'noted'>;
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
  propertyNotes: PropertyNote[];
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
      internet: estimated(
        DEFAULT_COST_ASSUMPTIONS.utilities.internet,
        'Default monthly internet assumption.',
      ),
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
    propertyNotes: [],
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
    housingType: listing.identity.housingType?.value ?? 'apartment',
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
    if (
      listing.recurring[category]?.source !== 'user' &&
      listing.recurring[category]?.source !== 'listing' &&
      !analysis.userClearedFields?.includes(`recurring.${category}`)
    ) {
      const estimate = utilityEstimates[category];
      if (
        category !== 'internet' &&
        estimate &&
        analysis.locationEstimate &&
        estimate.value > 0
      ) {
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
  if (analysis.customRecurringFees.length > 0) {
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
  const petCount = household.cats + household.smallDogs + household.largeDogs;
  if (petCount > 0) {
    for (const field of [
      listing.recurring.petRent,
      listing.upfront.petDeposit,
      listing.upfront.petFee,
    ]) {
      if (
        field?.source === 'listing' &&
        (field.billingBasis === 'per_pet' ||
          (field.billingBasis === undefined &&
            /\bper (?:each )?pet\b/i.test(field.note ?? '')))
      )
        field.value *= petCount;
    }
  } else {
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
    listing.upfront.petFee = {
      value: 0,
      source: 'user',
      confidence: 1,
      note: 'Listing pet fee does not apply because the household profile has no pets.',
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
  if (
    !next.listing.recurring.internet &&
    !next.userClearedFields?.includes('recurring.internet')
  )
    next.listing.recurring.internet = estimated(
      DEFAULT_COST_ASSUMPTIONS.utilities.internet,
      'Default monthly internet assumption.',
    );
  if (!next.baseline.recurring.internet)
    next.baseline.recurring.internet = estimated(
      DEFAULT_COST_ASSUMPTIONS.utilities.internet,
      'Default monthly internet assumption.',
    );
  next.updatedAt = new Date().toISOString();
  return next;
}

export function applyLocationEstimate(
  analysis: RentalAnalysis,
  estimate: LocationEstimate,
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.locationEstimate = estimate;
  const utilityEstimates = estimateUtilities({
    occupants: next.occupants,
    housingType: next.listing.identity.housingType?.value ?? 'apartment',
    bedrooms: next.listing.identity.bedrooms?.value,
    squareFootage: next.listing.identity.squareFootage?.value,
    includedUtilities: UTILITY_CATEGORIES.filter(
      (category) => next.utilityIncluded[category],
    ),
    laundryType: next.laundryType,
  });
  for (const category of UTILITY_CATEGORIES) {
    const current = next.listing.recurring[category];
    const base = utilityEstimates[category];
    if (
      base &&
      base.value > 0 &&
      current?.source !== 'user' &&
      current?.source !== 'listing' &&
      !next.userClearedFields?.includes(`recurring.${category}`) &&
      next.utilityIncludedSource[category] !== 'listing'
    ) {
      const adjusted: SourcedValue<number> =
        category === 'internet'
          ? base
          : {
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
  extraction = structuredClone(extraction);
  const incoming = extraction.namedRecurringFees ?? [];
  next.customRecurringFees = next.customRecurringFees.filter(
    (f) => f.source !== 'listing' || incoming.some((i) => i.id === f.id),
  );
  for (const fee of incoming) {
    if (next.userClearedFields.includes(`fee.${fee.id}`)) continue;
    const current = next.customRecurringFees.find((f) => f.id === fee.id);
    if (current && current.source !== 'listing') continue;
    if (current) Object.assign(current, fee);
    else next.customRecurringFees.push(structuredClone(fee));
  }
  if (incoming.length) {
    const aggregate = extraction.listing.recurring.otherRequiredMonthlyFees;
    if (aggregate) {
      const remainder =
        aggregate.value - incoming.reduce((sum, fee) => sum + fee.amount, 0);
      if (remainder > 0) aggregate.value = remainder;
      else delete extraction.listing.recurring.otherRequiredMonthlyFees;
    }
  }
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
  delete next.aiExtraction;
  next.extraction = structuredClone(extraction);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function decidePropertyNote(
  analysis: RentalAnalysis,
  suggestion: { id: string; label: string; detail: string },
  keep: boolean,
  source: 'ai' | 'listing',
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.aiReviewDecisions ??= {};
  next.aiReviewDecisions[suggestion.id] = keep ? 'noted' : 'excluded';
  const existing = next.propertyNotes.find(
    (note) => note.sourceId === suggestion.id,
  );
  if (keep && !existing)
    next.propertyNotes.push({
      id: crypto.randomUUID(),
      text: `${suggestion.label}: ${suggestion.detail}`,
      source,
      sourceId: suggestion.id,
    });
  if (!keep)
    next.propertyNotes = next.propertyNotes.filter(
      (note) => note.sourceId !== suggestion.id,
    );
  next.updatedAt = new Date().toISOString();
  return next;
}
