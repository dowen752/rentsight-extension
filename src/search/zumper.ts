import type { RentalSearch, SearchCriterion } from './types';

export const ZUMPER_ORIGIN = 'https://www.zumper.com';
export const ZUMPER_HOST_PERMISSION = `${ZUMPER_ORIGIN}/*`;

export const ZUMPER_SUPPORTED_CRITERIA = [
  'location',
  'minListedRent',
  'maxListedRent',
  'minBedrooms',
  'minBathrooms',
  'propertyTypes',
  'catsAllowed',
  'smallDogsAllowed',
  'largeDogsAllowed',
  'minSquareFeet',
  'inUnitLaundry',
  'airConditioning',
] as const satisfies readonly SearchCriterion[];

export function zumperAppliedCriteria(search: RentalSearch): SearchCriterion[] {
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
    search.minBathrooms >= 1 &&
    search.minBathrooms <= 5
  )
    applied.push('minBathrooms');
  if (search.propertyTypes?.length) applied.push('propertyTypes');
  if (search.catsAllowed) applied.push('catsAllowed');
  if (search.smallDogsAllowed) applied.push('smallDogsAllowed');
  if (search.largeDogsAllowed) applied.push('largeDogsAllowed');
  if (search.minSquareFeet !== undefined && search.minSquareFeet >= 0)
    applied.push('minSquareFeet');
  if (search.inUnitLaundry) applied.push('inUnitLaundry');
  if (search.airConditioning) applied.push('airConditioning');
  return applied;
}
