import { requestedSearchCriteria } from './normalize';
import type { RentalSearch, SearchCriterion } from './types';

export const REALTOR_ORIGIN = 'https://www.realtor.com';
export const REALTOR_HOST_PERMISSION = `${REALTOR_ORIGIN}/*`;

export const REALTOR_SUPPORTED_CRITERIA = [
  'location',
  'minListedRent',
  'maxListedRent',
  'minBedrooms',
  'minBathrooms',
  'propertyTypes',
  'catsAllowed',
  'smallDogsAllowed',
  'largeDogsAllowed',
  'moveInDate',
  'minSquareFeet',
  'parkingAvailable',
  'inUnitLaundry',
  'airConditioning',
] as const satisfies readonly SearchCriterion[];

function locationSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Returns a safe direct route only when Realtor's city/state format is known. */
export function realtorLocationPath(location: string): string | undefined {
  const pieces = location.split(',').map((piece) => piece.trim());
  if (pieces.length !== 2 || !pieces[0] || !/^[a-z]{2}$/i.test(pieces[1]))
    return undefined;
  return `/apartments/${locationSlug(pieces[0])}_${pieces[1].toUpperCase()}`;
}

export function realtorAppliedCriteria(
  search: RentalSearch,
): SearchCriterion[] {
  // Realtor's filter drawer is attached to a resolved location results page.
  if (!search.location) return [];
  const applied: SearchCriterion[] = ['location'];
  if (search.minListedRent !== undefined) applied.push('minListedRent');
  if (search.maxListedRent !== undefined) applied.push('maxListedRent');
  if (
    search.minBedrooms !== undefined &&
    Number.isInteger(search.minBedrooms) &&
    search.minBedrooms >= 0 &&
    search.minBedrooms <= 5
  )
    applied.push('minBedrooms');
  if (
    search.minBathrooms !== undefined &&
    Number.isInteger(search.minBathrooms) &&
    search.minBathrooms >= 0 &&
    search.minBathrooms <= 5
  )
    applied.push('minBathrooms');
  if (search.propertyTypes?.length) applied.push('propertyTypes');
  if (search.catsAllowed) applied.push('catsAllowed');
  if (search.smallDogsAllowed) applied.push('smallDogsAllowed');
  if (search.largeDogsAllowed) applied.push('largeDogsAllowed');
  if (search.moveInDate) applied.push('moveInDate');
  if (
    search.minSquareFeet !== undefined &&
    Number.isInteger(search.minSquareFeet) &&
    search.minSquareFeet >= 0 &&
    search.minSquareFeet <= 2_500
  )
    applied.push('minSquareFeet');
  if (search.parkingAvailable) applied.push('parkingAvailable');
  if (search.inUnitLaundry) applied.push('inUnitLaundry');
  if (search.airConditioning) applied.push('airConditioning');
  return applied;
}

export function realtorNeedsPageFill(search: RentalSearch): boolean {
  if (!search.location?.trim()) return false;
  const requested = new Set(requestedSearchCriteria(search));
  return realtorAppliedCriteria(search).some((criterion) =>
    requested.has(criterion),
  );
}
