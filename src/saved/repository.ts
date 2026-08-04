import type { RentalAnalysis } from '../shared/analysis';
import { SAVED_LISTING_SCHEMA_VERSION, type SavedListingRecord } from './types';

export function saveListing(
  records: readonly SavedListingRecord[],
  analysis: RentalAnalysis,
): {
  records: SavedListingRecord[];
  record: SavedListingRecord;
  created: boolean;
} {
  const url = analysis.listing.identity.url?.value;
  if (!url) throw new Error('A listing URL is required before saving.');
  const now = new Date().toISOString();
  const existing = records.find((record) => record.url === url);
  const record: SavedListingRecord = existing
    ? { ...existing, analysis: structuredClone(analysis), updatedAt: now }
    : {
        schemaVersion: SAVED_LISTING_SCHEMA_VERSION,
        id: crypto.randomUUID(),
        url,
        analysis: structuredClone(analysis),
        createdAt: now,
        updatedAt: now,
      };
  return {
    records: existing
      ? records.map((item) => (item.id === existing.id ? record : item))
      : [...records, record],
    record,
    created: !existing,
  };
}

export function deleteListing(
  records: readonly SavedListingRecord[],
  id: string,
): SavedListingRecord[] {
  return records.filter((record) => record.id !== id);
}
