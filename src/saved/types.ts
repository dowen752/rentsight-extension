import type { RentalAnalysis } from '../shared/analysis';

export const SAVED_LISTING_SCHEMA_VERSION = 1 as const;

export interface SavedListingRecord {
  schemaVersion: typeof SAVED_LISTING_SCHEMA_VERSION;
  id: string;
  url: string;
  analysis: RentalAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface RentSightExport {
  format: 'rentsight-saved-listings';
  schemaVersion: typeof SAVED_LISTING_SCHEMA_VERSION;
  exportedAt: string;
  listings: SavedListingRecord[];
}

export interface ImportResult {
  records: SavedListingRecord[];
  errors: string[];
}
