import type { RentalAnalysisMap } from '../shared/analysis';
import type { SavedListingRecord } from '../saved';
import type { LocationEstimate } from '../location';
import type { HouseholdProfile } from '../shared/household';
import type { StoredSearchProfile } from '../search/types';
import type { StoredAssistantConversation } from '../assistant';

export interface StorageSchema {
  lastInspectedUrl: string;
  estimatedMonthlyCost: number;
  rentalAnalyses: RentalAnalysisMap;
  savedListings: SavedListingRecord[];
  savedListingsSchemaVersion: number;
  locationCache: Record<string, LocationEstimate>;
  internetMonthlyCost: number;
  householdProfile: HouseholdProfile;
  onboardingCompleted: boolean;
  searchProfile: StoredSearchProfile;
  assistantConversation: StoredAssistantConversation;
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

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  },
};

export async function clearAllRentSightData(): Promise<void> {
  await extensionStorage.clear();
}

const analysisStorageKey = (url: string): string =>
  `rentalAnalysis:${encodeURIComponent(url)}`;

export async function getRentalAnalysis(
  url: string,
): Promise<RentalAnalysisMap[string] | undefined> {
  const key = analysisStorageKey(url);
  const result = await chrome.storage.local.get(key);
  const current = result[key] as RentalAnalysisMap[string] | undefined;
  if (current) return current;
  return (await extensionStorage.get('rentalAnalyses'))?.[url];
}

export async function setRentalAnalysis(
  url: string,
  analysis: RentalAnalysisMap[string],
): Promise<void> {
  await chrome.storage.local.set({ [analysisStorageKey(url)]: analysis });
}

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
