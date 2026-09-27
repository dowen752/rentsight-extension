import { migrateSavedRecord } from './migrations';
import {
  SAVED_LISTING_SCHEMA_VERSION,
  type ImportResult,
  type RentSightExport,
  type SavedListingRecord,
} from './types';
import { createComparison } from './comparison';
import type { HouseholdProfile } from '../shared/household';

export function exportListingsJson(
  records: readonly SavedListingRecord[],
): string {
  const data: RentSightExport = {
    format: 'rentsight-saved-listings',
    schemaVersion: SAVED_LISTING_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    listings: [...records],
  };
  return JSON.stringify(data, null, 2);
}

const csvCell = (value: string | number | undefined): string => {
  const text = value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

export function exportListingsCsv(
  records: readonly SavedListingRecord[],
  householdProfile?: HouseholdProfile,
): string {
  const headers = [
    'Address',
    'URL',
    'Advertised rent',
    'True monthly cost',
    'Move-in cash',
    'First-year total',
    'Bedrooms',
    'Bathrooms',
    'Square feet',
    'Cost per square foot',
    'Completeness',
  ];
  const rows = records.map((record) => {
    const item = createComparison(record, householdProfile);
    return [
      item.address,
      record.url,
      item.advertisedRent,
      item.trueMonthlyCost,
      item.moveInCash,
      item.firstYearTotal,
      item.bedrooms,
      item.bathrooms,
      item.squareFootage,
      item.costPerSquareFoot,
      item.completeness.score,
    ]
      .map(csvCell)
      .join(',');
  });
  return [headers.map(csvCell).join(','), ...rows].join('\n');
}

export function importListingsJson(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { records: [], errors: ['File is not valid JSON.'] };
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('format' in parsed) ||
    parsed.format !== 'rentsight-saved-listings' ||
    !('listings' in parsed) ||
    !Array.isArray(parsed.listings)
  ) {
    return {
      records: [],
      errors: ['File is not a RentSight saved-listings export.'],
    };
  }
  const records: SavedListingRecord[] = [];
  const errors: string[] = [];
  parsed.listings.forEach((value, index) => {
    try {
      records.push(migrateSavedRecord(value));
    } catch (error: unknown) {
      errors.push(
        `Listing ${index + 1}: ${error instanceof Error ? error.message : 'Invalid record.'}`,
      );
    }
  });
  return { records, errors };
}

export function mergeImportedListings(
  current: readonly SavedListingRecord[],
  imported: readonly SavedListingRecord[],
): SavedListingRecord[] {
  const byUrl = new Map(current.map((record) => [record.url, record]));
  for (const record of imported) byUrl.set(record.url, record);
  return [...byUrl.values()];
}
