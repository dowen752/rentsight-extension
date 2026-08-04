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
