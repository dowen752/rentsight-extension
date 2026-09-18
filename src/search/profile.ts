import { extensionStorage } from '../storage';
import { normalizeRentalSearch } from './normalize';
import type { RentalSearch, SearchProfile } from './types';

export function createSearchProfile(search: RentalSearch): SearchProfile {
  const normalized = normalizeRentalSearch(search);
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
    const { dogsAllowed, ...search } = stored.search;
    return createSearchProfile({
      ...search,
      ...(dogsAllowed === true
        ? { smallDogsAllowed: true, largeDogsAllowed: true }
        : {}),
    });
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
