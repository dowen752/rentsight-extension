import { requestedSearchCriteria } from './normalize';
import type { RentalSearch, SearchCriterion } from './types';

export const APARTMENTS_ORIGIN = 'https://www.apartments.com';
export const APARTMENTS_HOST_PERMISSION = `${APARTMENTS_ORIGIN}/*`;

export const APARTMENTS_SUPPORTED_CRITERIA: readonly SearchCriterion[] = [
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
];

export function apartmentsAppliedCriteria(
  search: RentalSearch,
): SearchCriterion[] {
  // Apartments.com resolves the raw location before RentSight applies the
  // structured controls that exist on its results page.
  if (!search.location?.trim()) return [];
  const applied: SearchCriterion[] = [];
  applied.push('location');
  if (search.minListedRent !== undefined) applied.push('minListedRent');
  if (search.maxListedRent !== undefined) applied.push('maxListedRent');
  if (
    search.minBedrooms !== undefined &&
    Number.isInteger(search.minBedrooms) &&
    search.minBedrooms >= 0 &&
    search.minBedrooms <= 4
  )
    applied.push('minBedrooms');
  if (
    search.minBathrooms !== undefined &&
    Number.isInteger(search.minBathrooms) &&
    search.minBathrooms >= 1 &&
    search.minBathrooms <= 3
  )
    applied.push('minBathrooms');
  if (search.propertyTypes?.length) applied.push('propertyTypes');
  if (search.catsAllowed) applied.push('catsAllowed');
  if (search.smallDogsAllowed) applied.push('smallDogsAllowed');
  if (search.largeDogsAllowed) applied.push('largeDogsAllowed');
  if (search.moveInDate) applied.push('moveInDate');
  if (
    search.minSquareFeet !== undefined &&
    Number.isFinite(search.minSquareFeet) &&
    search.minSquareFeet >= 0 &&
    search.minSquareFeet <= 4_500
  )
    applied.push('minSquareFeet');
  if (search.parkingAvailable) applied.push('parkingAvailable');
  if (search.inUnitLaundry) applied.push('inUnitLaundry');
  if (search.airConditioning) applied.push('airConditioning');
  return applied;
}

export function apartmentsNeedsPageFill(search: RentalSearch): boolean {
  const requested = new Set(requestedSearchCriteria(search));
  return apartmentsAppliedCriteria(search).some((criterion) =>
    requested.has(criterion),
  );
}
