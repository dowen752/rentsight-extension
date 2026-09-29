import { extensionStorage } from '../storage';
import type { HouseholdProfile } from '../shared/household';
import { normalizeRentalSearch } from './normalize';
import type { RentalSearch, SearchProfile } from './types';

export function searchPreferencesOnly(search: RentalSearch): RentalSearch {
  const preferences = { ...search };
  delete preferences.catsAllowed;
  delete preferences.smallDogsAllowed;
  delete preferences.largeDogsAllowed;
  return preferences;
}

export function applyHouseholdPetFilters(
  search: RentalSearch,
  household: HouseholdProfile,
): RentalSearch {
  return {
    ...searchPreferencesOnly(search),
    ...(household.cats > 0 ? { catsAllowed: true as const } : {}),
    ...(household.smallDogs > 0 ? { smallDogsAllowed: true as const } : {}),
    ...(household.largeDogs > 0 ? { largeDogsAllowed: true as const } : {}),
  };
}

export function createSearchProfile(search: RentalSearch): SearchProfile {
  const normalized = normalizeRentalSearch(searchPreferencesOnly(search));
  if (normalized.issues.length) {
    throw new Error(normalized.issues.map((issue) => issue.message).join(' '));
  }
  return { schemaVersion: 2, search: normalized.search };
}

export async function getSearchProfile(): Promise<SearchProfile> {
  const stored = await extensionStorage.get('searchProfile');
  if (stored === undefined) return createSearchProfile({});
  if (!stored || typeof stored !== 'object')
    throw new Error('Unsupported search profile version.');
  if (stored.schemaVersion === 1) {
    if (!stored.search || typeof stored.search !== 'object')
      throw new Error('Search profile is missing its search preferences.');
    const search: RentalSearch & { dogsAllowed?: true } = { ...stored.search };
    delete search.dogsAllowed;
    return createSearchProfile(search);
  }
  if (stored.schemaVersion !== 2)
    throw new Error('Unsupported search profile version.');
  if (stored.search === undefined)
    throw new Error('Search profile is missing its search preferences.');
  return createSearchProfile(stored.search);
}

export async function setSearchProfile(search: RentalSearch): Promise<void> {
  await extensionStorage.set('searchProfile', createSearchProfile(search));
}
