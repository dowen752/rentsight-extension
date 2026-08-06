import type { RentalAnalysisMap } from '../shared/analysis';
import type { SavedListingRecord } from '../saved';
import type { LocationEstimate } from '../location';

export interface StorageSchema {
  lastInspectedUrl: string;
  estimatedMonthlyCost: number;
  rentalAnalyses: RentalAnalysisMap;
  savedListings: SavedListingRecord[];
  savedListingsSchemaVersion: number;
  locationCache: Record<string, LocationEstimate>;
}

type StorageKey = keyof StorageSchema;

export const extensionStorage = {
  async get<K extends StorageKey>(
    key: K,
  ): Promise<StorageSchema[K] | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] as StorageSchema[K] | undefined;
  },

  async set<K extends StorageKey>(
    key: K,
    value: StorageSchema[K],
  ): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },

  async remove(key: StorageKey): Promise<void> {
    await chrome.storage.local.remove(key);
  },
};

const isQuotaError = (error: unknown): boolean =>
  error instanceof Error && /quota.*exceed/i.test(error.message);

export async function persistSavedListings(
  records: SavedListingRecord[],
): Promise<void> {
  try {
    await extensionStorage.set('savedListings', records);
  } catch (error: unknown) {
    if (!isQuotaError(error)) throw error;

    // Location estimates are regenerable. Draft analyses may contain manual
    // edits that do not exist on the listing page, so never evict them here.
    await extensionStorage.remove('locationCache');
    await extensionStorage.set('savedListings', records);
  }
  await extensionStorage.set('savedListingsSchemaVersion', 1);
}
