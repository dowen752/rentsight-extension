import validateAiResponse from '../ai/contracts/response.validator.js';
import { createInitialAnalysis, type RentalAnalysis } from '../shared/analysis';
import { SAVED_LISTING_SCHEMA_VERSION, type SavedListingRecord } from './types';
import { compactAnalysisForStorage } from './repository';

interface LegacyRecord {
  id?: unknown;
  url?: unknown;
  analysis?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  schemaVersion?: unknown;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const SOURCES = new Set(['listing', 'user', 'location_estimate', 'default']);

function isSourcedValue(
  value: unknown,
  valueType: 'string' | 'number',
): boolean {
  if (!isObject(value)) return false;
  return (
    'value' in value &&
    typeof value.value === valueType &&
    (valueType !== 'number' || Number.isFinite(value.value)) &&
    typeof value.source === 'string' &&
    SOURCES.has(value.source) &&
    typeof value.confidence === 'number' &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    (value.note === undefined || typeof value.note === 'string')
  );
}

function isSourcedGroup(
  value: unknown,
  fields: Readonly<Record<string, 'string' | 'number'>>,
): boolean {
  return (
    isObject(value) &&
    Object.entries(value).every(
      ([key, field]) =>
        key in fields &&
        (field === undefined || isSourcedValue(field, fields[key])),
    )
  );
}

const IDENTITY_FIELDS = {
  url: 'string',
  listingTitle: 'string',
  fullAddress: 'string',
  city: 'string',
  state: 'string',
  zipCode: 'string',
  latitude: 'number',
  longitude: 'number',
  bedrooms: 'number',
  bathrooms: 'number',
  squareFootage: 'number',
} as const;

const RECURRING_FIELDS = {
  advertisedRent: 'number',
  electricity: 'number',
  naturalGas: 'number',
  water: 'number',
  sewer: 'number',
  trash: 'number',
  internet: 'number',
  parking: 'number',
  laundry: 'number',
  petRent: 'number',
  rentersInsurance: 'number',
  amenityFees: 'number',
  otherRequiredMonthlyFees: 'number',
} as const;

const UPFRONT_FIELDS = {
  applicationFee: 'number',
  securityDeposit: 'number',
  firstMonthsRent: 'number',
  lastMonthsRent: 'number',
  petDeposit: 'number',
  petFee: 'number',
  administrativeFee: 'number',
  utilityDeposits: 'number',
  otherMoveInFees: 'number',
} as const;

const CONCESSION_FIELDS = {
  monthsFree: 'number',
  oneTimeCredit: 'number',
  leaseMonths: 'number',
  // Accepted only so the short-lived minimum-stay field can be removed from
  // saved records without making those records unimportable.
  minimumStayDays: 'number',
} as const;

function isListing(value: unknown): boolean {
  return (
    isObject(value) &&
    isSourcedGroup(value.identity, IDENTITY_FIELDS) &&
    isSourcedGroup(value.recurring, RECURRING_FIELDS) &&
    isSourcedGroup(value.upfront, UPFRONT_FIELDS) &&
    (value.concessions === undefined ||
      isSourcedGroup(value.concessions, CONCESSION_FIELDS))
  );
}

function isBooleanRecord(value: unknown): boolean {
  return (
    isObject(value) &&
    Object.values(value).every((item) => typeof item === 'boolean')
  );
}

function isCustomFee(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    value.amount >= 0
  );
}

function isPropertyNote(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    (value.source === 'user' || value.source === 'ai') &&
    (value.sourceId === undefined || typeof value.sourceId === 'string')
  );
}

export function isRentalAnalysis(value: unknown): value is RentalAnalysis {
  if (!isObject(value)) return false;
  return (
    (value.aiExtraction === undefined ||
      (validateAiResponse(value.aiExtraction) &&
        isObject(value.aiExtraction) &&
        value.aiExtraction.status === 'succeeded')) &&
    (value.aiReviewDecisions === undefined ||
      (isObject(value.aiReviewDecisions) &&
        Object.values(value.aiReviewDecisions).every(
          (decision) =>
            decision === 'entered' ||
            decision === 'excluded' ||
            decision === 'noted',
        ))) &&
    isListing(value.listing) &&
    isListing(value.baseline) &&
    isBooleanRecord(value.utilityIncluded) &&
    Array.isArray(value.customRecurringFees) &&
    value.customRecurringFees.every(isCustomFee) &&
    Array.isArray(value.customOneTimeFees) &&
    value.customOneTimeFees.every(isCustomFee) &&
    (value.propertyNotes === undefined ||
      (Array.isArray(value.propertyNotes) &&
        value.propertyNotes.every(isPropertyNote)))
  );
}

function normalizeAnalysis(
  analysis: RentalAnalysis,
  url: string,
): RentalAnalysis {
  const defaults = createInitialAnalysis(url, 'Saved listing');
  const normalized = {
    ...defaults,
    ...analysis,
    listing: analysis.listing,
    baseline: analysis.baseline,
    utilityIncluded: {
      ...defaults.utilityIncluded,
      ...analysis.utilityIncluded,
    },
    baselineUtilityIncluded: {
      ...defaults.baselineUtilityIncluded,
      ...analysis.baselineUtilityIncluded,
    },
    utilityIncludedSource: {
      ...defaults.utilityIncludedSource,
      ...analysis.utilityIncludedSource,
    },
    userClearedFields: Array.isArray(analysis.userClearedFields)
      ? analysis.userClearedFields.filter(
          (path): path is string => typeof path === 'string',
        )
      : [],
    propertyNotes: Array.isArray(analysis.propertyNotes)
      ? analysis.propertyNotes.filter(isPropertyNote)
      : [],
  };
  for (const listing of [normalized.listing, normalized.baseline]) {
    if (listing.concessions)
      delete (listing.concessions as Record<string, unknown>).minimumStayDays;
  }
  return normalized;
}

export function migrateSavedRecord(value: unknown): SavedListingRecord {
  if (!isObject(value)) throw new Error('Saved listing must be an object.');
  const legacy = value as LegacyRecord;
  if (
    legacy.schemaVersion !== undefined &&
    legacy.schemaVersion !== 0 &&
    legacy.schemaVersion !== 1
  ) {
    throw new Error(
      `Unsupported saved listing schema version: ${String(legacy.schemaVersion)}.`,
    );
  }
  if (typeof legacy.url !== 'string' || !/^https?:\/\//.test(legacy.url)) {
    throw new Error('Saved listing URL must be a valid HTTP or HTTPS URL.');
  }
  if (!isRentalAnalysis(legacy.analysis)) {
    throw new Error('Saved listing analysis is missing or invalid.');
  }
  const now = new Date().toISOString();
  return {
    schemaVersion: SAVED_LISTING_SCHEMA_VERSION,
    id:
      typeof legacy.id === 'string' && legacy.id
        ? legacy.id
        : crypto.randomUUID(),
    url: legacy.url,
    analysis: compactAnalysisForStorage(
      normalizeAnalysis(legacy.analysis, legacy.url),
    ),
    createdAt: typeof legacy.createdAt === 'string' ? legacy.createdAt : now,
    updatedAt: typeof legacy.updatedAt === 'string' ? legacy.updatedAt : now,
  };
}

export function migrateSavedRecords(value: unknown): SavedListingRecord[] {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new Error('Saved listings storage must be an array.');
  return value.map(migrateSavedRecord);
}
