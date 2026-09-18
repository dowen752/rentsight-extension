import {
  SEARCH_PROPERTY_TYPES,
  type RentalSearch,
  type SearchCriterion,
  type SearchValidationIssue,
} from './types';

const FLAGS = [
  'catsAllowed',
  'smallDogsAllowed',
  'largeDogsAllowed',
  'parkingAvailable',
  'inUnitLaundry',
  'airConditioning',
] as const;

/** Canonicalizes untrusted stored data without silently coercing numeric values.
 * Callers must surface issues before using the result to launch a search.
 */
export function normalizeRentalSearch(value: unknown): {
  search: RentalSearch;
  issues: SearchValidationIssue[];
} {
  const search: RentalSearch = {};
  const issues: SearchValidationIssue[] = [];
  if (value === undefined) return { search, issues };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      search,
      issues: [{ criterion: 'location', message: 'Search must be an object.' }],
    };
  }
  const input = value as Record<string, unknown>;
  const issue = (criterion: SearchCriterion, message: string) => {
    issues.push({ criterion, message });
  };
  if (input.location !== undefined && input.location !== '') {
    if (typeof input.location === 'string') {
      const location = input.location.trim().replace(/\s+/g, ' ');
      if (location) search.location = location;
    } else issue('location', 'Enter a location as text.');
  }
  for (const key of [
    'minListedRent',
    'maxListedRent',
    'minBedrooms',
    'minBathrooms',
    'minSquareFeet',
  ] as const) {
    const candidate = input[key];
    if (candidate === undefined) continue;
    if (
      typeof candidate !== 'number' ||
      !Number.isFinite(candidate) ||
      candidate < 0
    ) {
      issue(key, 'Enter a finite, nonnegative number.');
    } else if (
      (key === 'minBedrooms' || key === 'minSquareFeet') &&
      !Number.isInteger(candidate)
    ) {
      issue(key, 'Enter a whole number.');
    } else if (key === 'minBathrooms' && !Number.isInteger(candidate * 2)) {
      issue(key, 'Enter bathrooms in half-bath increments.');
    } else search[key] = candidate;
  }
  if (
    search.minListedRent !== undefined &&
    search.maxListedRent !== undefined &&
    search.minListedRent > search.maxListedRent
  ) {
    issue('maxListedRent', 'Maximum listed rent must be at least the minimum.');
  }
  if (input.propertyTypes !== undefined) {
    if (!Array.isArray(input.propertyTypes))
      issue('propertyTypes', 'Choose supported property types.');
    else {
      if (
        input.propertyTypes.some(
          (type) => !SEARCH_PROPERTY_TYPES.includes(type),
        )
      ) {
        issue('propertyTypes', 'Choose supported property types.');
      }
      const types = SEARCH_PROPERTY_TYPES.filter(
        (type) =>
          input.propertyTypes instanceof Array &&
          input.propertyTypes.includes(type),
      );
      if (types.length) search.propertyTypes = [...types];
    }
  }
  for (const key of FLAGS) {
    if (input[key] === true) search[key] = true;
    else if (input[key] !== undefined && input[key] !== false)
      issue(key, 'Preference must be a checkbox value.');
  }
  if (input.moveInDate !== undefined && input.moveInDate !== '') {
    const date = input.moveInDate;
    if (
      typeof date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date
    ) {
      search.moveInDate = date;
    } else issue('moveInDate', 'Enter a valid date in YYYY-MM-DD format.');
  }
  return { search, issues };
}

export function requestedSearchCriteria(
  search: RentalSearch,
): SearchCriterion[] {
  return (Object.keys(search) as SearchCriterion[]).filter(
    (key) =>
      search[key] !== undefined &&
      (key !== 'propertyTypes' || search.propertyTypes!.length > 0),
  );
}
