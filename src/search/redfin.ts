import type { RentalSearch, SearchCriterion } from './types';

export const REDFIN_ORIGIN = 'https://www.redfin.com';
export const REDFIN_HOST_PERMISSION = `${REDFIN_ORIGIN}/*`;
export const REDFIN_SUPPORTED_CRITERIA = [
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

export function redfinAppliedCriteria(search: RentalSearch): SearchCriterion[] {
  // Bare cities are resolved using Redfin's own first city suggestion, with
  // an explicit location-review message after launch.
  if (!search.location || /^\d{5}$/.test(search.location.trim())) return [];
  const applied: SearchCriterion[] = ['location'];
  for (const criterion of REDFIN_SUPPORTED_CRITERIA) {
    if (criterion === 'location') continue;
    if (
      criterion === 'minBedrooms' &&
      (search.minBedrooms === undefined ||
        !Number.isInteger(search.minBedrooms) ||
        search.minBedrooms < 0 ||
        search.minBedrooms > 5)
    )
      continue;
    if (
      criterion === 'minBathrooms' &&
      (search.minBathrooms === undefined ||
        !Number.isInteger(search.minBathrooms * 2) ||
        search.minBathrooms < 0 ||
        search.minBathrooms > 4)
    )
      continue;
    if (
      criterion === 'minSquareFeet' &&
      (search.minSquareFeet === undefined ||
        !Number.isInteger(search.minSquareFeet) ||
        search.minSquareFeet < 0 ||
        search.minSquareFeet > 4500)
    )
      continue;
    if (
      criterion === 'propertyTypes'
        ? Boolean(search.propertyTypes?.length)
        : Boolean(search[criterion])
    )
      applied.push(criterion);
  }
  return applied;
}
