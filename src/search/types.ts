export const SEARCH_PROPERTY_TYPES = [
  'apartment_condo',
  'house',
  'townhouse',
] as const;

export type SearchPropertyType = (typeof SEARCH_PROPERTY_TYPES)[number];

/** Renter preferences, not extracted listing facts or calculation inputs.
 * Omission always means no preference. Every criterion, including location,
 * is optional; a marketplace may require a location even though RentSight does not.
 */
export interface RentalSearch {
  location?: string;
  minListedRent?: number;
  maxListedRent?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  propertyTypes?: SearchPropertyType[];
  catsAllowed?: true;
  smallDogsAllowed?: true;
  largeDogsAllowed?: true;
  moveInDate?: string;
  minSquareFeet?: number;
  /** Available at the property; not necessarily free, reserved, or covered. */
  parkingAvailable?: true;
  /** Washer AND dryer provided inside the unit; not shared laundry or hookups. */
  inUnitLaundry?: true;
  /** Any provided air conditioning; central AC is not required. */
  airConditioning?: true;
}

export type SearchCriterion = keyof RentalSearch;

export interface SearchValidationIssue {
  criterion: SearchCriterion;
  message: string;
}

export interface SearchProfile {
  schemaVersion: 2;
  search: RentalSearch;
}

/** Stored only long enough to migrate the original generic dog preference. */
export interface LegacySearchProfileV1 {
  schemaVersion: 1;
  search: Omit<RentalSearch, 'smallDogsAllowed' | 'largeDogsAllowed'> & {
    dogsAllowed?: true;
  };
}

export type StoredSearchProfile = SearchProfile | LegacySearchProfileV1;

export interface SearchLink {
  url: string;
  transferMode: 'url' | 'page';
  applied: SearchCriterion[];
  omitted: SearchCriterion[];
}

export type SearchLinkResult =
  | { status: 'ready'; link: SearchLink }
  | { status: 'unavailable'; reason: string };

/** Capabilities describe exact contract semantics, not merely similar controls.
 * Builders must report what the complete launch strategy actually transfers.
 * For example, an exact-bedroom filter cannot be reported as applying
 * minBedrooms.
 */
export interface SearchSiteAdapter {
  id: string;
  name: string;
  version: number;
  allowedOrigins: readonly string[];
  supportedCriteria: readonly SearchCriterion[];
  buildLink(search: RentalSearch): SearchLinkResult;
}
