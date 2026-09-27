import type { RentalSearch, SearchCriterion } from './types';

export const RENT_ORIGIN = 'https://www.rent.com';
export const RENT_HOST_PERMISSION = `${RENT_ORIGIN}/*`;
export const RENT_SUPPORTED_CRITERIA = [
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
  'inUnitLaundry',
  'airConditioning',
] as const satisfies readonly SearchCriterion[];

export function rentAppliedCriteria(search: RentalSearch): SearchCriterion[] {
  if (!search.location) return [];
  const applied: SearchCriterion[] = ['location'];
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
    search.minBathrooms >= 0 &&
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
    Number.isInteger(search.minSquareFeet) &&
    search.minSquareFeet >= 0 &&
    search.minSquareFeet <= 1600
  )
    applied.push('minSquareFeet');
  if (search.inUnitLaundry) applied.push('inUnitLaundry');
  if (search.airConditioning) applied.push('airConditioning');
  return applied;
}
