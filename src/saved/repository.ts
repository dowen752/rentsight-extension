import type { RentalAnalysis } from '../shared/analysis';
import { SAVED_LISTING_SCHEMA_VERSION, type SavedListingRecord } from './types';

export function compactAnalysisForStorage(
  analysis: RentalAnalysis,
): RentalAnalysis {
  const compact = structuredClone(analysis);
  delete compact.extraction;
  for (const listing of [compact.listing, compact.baseline]) {
    for (const group of [
      listing.identity,
      listing.recurring,
      listing.upfront,
      listing.concessions,
    ]) {
      if (!group) continue;
      for (const field of Object.values(group)) {
        if (field?.note && field.note.length > 600)
          field.note = `${field.note.slice(0, 597)}…`;
      }
    }
  }
  return compact;
}

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
  const persistedAnalysis = compactAnalysisForStorage(analysis);
  const record: SavedListingRecord = existing
    ? { ...existing, analysis: persistedAnalysis, updatedAt: now }
    : {
        schemaVersion: SAVED_LISTING_SCHEMA_VERSION,
        id: crypto.randomUUID(),
        url,
        analysis: persistedAnalysis,
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
