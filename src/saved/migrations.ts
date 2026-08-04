import { createInitialAnalysis, type RentalAnalysis } from '../shared/analysis';
import { SAVED_LISTING_SCHEMA_VERSION, type SavedListingRecord } from './types';

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

export function isRentalAnalysis(value: unknown): value is RentalAnalysis {
  if (!isObject(value)) return false;
  return (
    isObject(value.listing) &&
    isObject(value.baseline) &&
    isObject(value.utilityIncluded) &&
    Array.isArray(value.customRecurringFees) &&
    Array.isArray(value.customOneTimeFees)
  );
}

function normalizeAnalysis(
  analysis: RentalAnalysis,
  url: string,
): RentalAnalysis {
  const defaults = createInitialAnalysis(url, 'Saved listing');
  return {
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
  };
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
    analysis: normalizeAnalysis(legacy.analysis, legacy.url),
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
