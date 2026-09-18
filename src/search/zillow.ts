import { requestedSearchCriteria } from './normalize';
import type { RentalSearch, SearchCriterion } from './types';

export const ZILLOW_ORIGIN = 'https://www.zillow.com';
export const ZILLOW_HOST_PERMISSION = `${ZILLOW_ORIGIN}/*`;

export const ZILLOW_SUPPORTED_CRITERIA = [
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

export function zillowAppliedCriteria(search: RentalSearch): SearchCriterion[] {
  const supported = new Set<SearchCriterion>(ZILLOW_SUPPORTED_CRITERIA);
  return requestedSearchCriteria(search).filter((criterion) =>
    supported.has(criterion),
  );
}

export function zillowNeedsPageFill(search: RentalSearch): boolean {
  return zillowAppliedCriteria(search).some(
    (criterion) => criterion !== 'location',
  );
}
