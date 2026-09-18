import { requestedSearchCriteria } from './normalize';
import type {
  RentalSearch,
  SearchCriterion,
  SearchLinkResult,
  SearchSiteAdapter,
} from './types';
import {
  ZILLOW_ORIGIN,
  ZILLOW_SUPPORTED_CRITERIA,
  zillowAppliedCriteria,
} from './zillow';
import {
  APARTMENTS_ORIGIN,
  APARTMENTS_SUPPORTED_CRITERIA,
  apartmentsAppliedCriteria,
} from './apartments';

export const SEARCH_CRITERION_LABELS: Record<SearchCriterion, string> = {
  location: 'location',
  minListedRent: 'minimum rent',
  maxListedRent: 'maximum rent',
  minBedrooms: 'bedrooms',
  minBathrooms: 'bathrooms',
  propertyTypes: 'property types',
  catsAllowed: 'cats allowed',
  smallDogsAllowed: 'small dogs allowed',
  largeDogsAllowed: 'large dogs allowed',
  moveInDate: 'move-in date',
  minSquareFeet: 'square footage',
  parkingAvailable: 'parking',
  inUnitLaundry: 'in-unit laundry',
  airConditioning: 'air conditioning',
};

export interface SearchSiteDefinition extends SearchSiteAdapter {
  description: string;
}

function locationSlug(location: string): string {
  return location
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function realtorLocation(location: string): string {
  const pieces = location.split(',').map((piece) => piece.trim());
  if (pieces.length === 2 && /^[a-z]{2}$/i.test(pieces[1])) {
    return `${locationSlug(pieces[0])}_${pieces[1].toUpperCase()}`;
  }
  return locationSlug(location);
}

function rentLocation(location: string): string | undefined {
  const trimmed = location.trim();
  if (/^\d{5}$/.test(trimmed)) return `zip-${trimmed}-apartments`;
  const pieces = trimmed.split(',').map((piece) => piece.trim());
  if (pieces.length !== 2 || !/^[a-z]{2}$/i.test(pieces[1])) return undefined;
  return `${locationSlug(pieces[1])}/${locationSlug(pieces[0])}-apartments`;
}

function readyLink(
  adapter: Pick<SearchSiteAdapter, 'allowedOrigins'>,
  search: RentalSearch,
  url: URL,
  applied: SearchCriterion[],
  transferMode: 'url' | 'page' = 'url',
): SearchLinkResult {
  if (!adapter.allowedOrigins.includes(url.origin)) {
    return {
      status: 'unavailable',
      reason: 'This destination is not allowed.',
    };
  }
  const requested = requestedSearchCriteria(search);
  const appliedRequested = [...new Set(applied)].filter((criterion) =>
    requested.includes(criterion),
  );
  return {
    status: 'ready',
    link: {
      url: url.toString(),
      transferMode,
      applied: appliedRequested,
      omitted: requested.filter(
        (criterion) => !appliedRequested.includes(criterion),
      ),
    },
  };
}

const apartments: SearchSiteDefinition = {
  id: 'apartments',
  name: 'Apartments.com',
  description: 'Broad apartment inventory and strong structured filters.',
  version: 3,
  allowedOrigins: [APARTMENTS_ORIGIN],
  supportedCriteria: APARTMENTS_SUPPORTED_CRITERIA,
  buildLink(search) {
    const path = search.location ? `/${locationSlug(search.location)}/` : '/';
    const url = new URL(path, APARTMENTS_ORIGIN);
    if (search.moveInDate && /^\d{4}-\d{2}-\d{2}$/.test(search.moveInDate))
      url.searchParams.set('mid', search.moveInDate.replaceAll('-', ''));
    return readyLink(
      this,
      search,
      url,
      apartmentsAppliedCriteria(search),
      'page',
    );
  },
};

const zillow: SearchSiteDefinition = {
  id: 'zillow',
  name: 'Zillow',
  description:
    'Large rental marketplace; optional site access applies supported filters after opening.',
  version: 2,
  allowedOrigins: [ZILLOW_ORIGIN],
  supportedCriteria: ZILLOW_SUPPORTED_CRITERIA,
  buildLink(search) {
    const path = search.location
      ? `/${locationSlug(search.location)}/rentals/`
      : '/homes/for_rent/';
    return readyLink(
      this,
      search,
      new URL(path, ZILLOW_ORIGIN),
      zillowAppliedCriteria(search),
      'page',
    );
  },
};

const realtor: SearchSiteDefinition = {
  id: 'realtor',
  name: 'Realtor.com',
  description: 'Mixed apartments and homes with readable location searches.',
  version: 1,
  allowedOrigins: ['https://www.realtor.com'],
  supportedCriteria: ['location'],
  buildLink(search) {
    const applied: SearchCriterion[] = [];
    const url = search.location
      ? new URL(
          `https://www.realtor.com/apartments/${realtorLocation(search.location)}`,
        )
      : new URL('https://www.realtor.com/rentals');
    if (search.location) applied.push('location');
    return readyLink(this, search, url, applied);
  },
};

const hotpads: SearchSiteDefinition = {
  id: 'hotpads',
  name: 'HotPads',
  description: 'Map-first Zillow network search with useful URL filters.',
  version: 1,
  allowedOrigins: ['https://hotpads.com'],
  supportedCriteria: [
    'location',
    'minListedRent',
    'maxListedRent',
    'minBedrooms',
    'minBathrooms',
  ],
  buildLink(search) {
    const applied: SearchCriterion[] = [];
    const url = search.location
      ? new URL(
          `https://hotpads.com/${locationSlug(search.location)}/apartments-for-rent`,
        )
      : new URL('https://hotpads.com/');
    if (search.location) applied.push('location');
    if (search.location) {
      if (search.maxListedRent !== undefined) {
        url.searchParams.set(
          'price',
          `${search.minListedRent ?? 0}-${search.maxListedRent}`,
        );
        if (search.minListedRent !== undefined) applied.push('minListedRent');
        applied.push('maxListedRent');
      }
      if (search.minBedrooms !== undefined) {
        url.searchParams.set('beds', `${search.minBedrooms}-8plus`);
        applied.push('minBedrooms');
      }
      if (search.minBathrooms !== undefined) {
        url.searchParams.set('baths', `${search.minBathrooms}-8plus`);
        applied.push('minBathrooms');
      }
    }
    return readyLink(this, search, url, applied);
  },
};

function locationOnlySite(
  definition: Omit<SearchSiteDefinition, 'buildLink'> & {
    locationUrl: (location: string) => string | undefined;
    homeUrl: string;
  },
): SearchSiteDefinition {
  return {
    ...definition,
    supportedCriteria: ['location'],
    buildLink(search) {
      const locationUrl = search.location
        ? definition.locationUrl(search.location)
        : undefined;
      const applied: SearchCriterion[] = [];
      if (locationUrl && search.location) applied.push('location');
      return readyLink(
        this,
        search,
        new URL(locationUrl ?? definition.homeUrl),
        applied,
      );
    },
  };
}

const rent = locationOnlySite({
  id: 'rent',
  name: 'Rent.com',
  description: 'Familiar apartment search with detailed property amenities.',
  version: 1,
  allowedOrigins: ['https://www.rent.com'],
  supportedCriteria: ['location'],
  homeUrl: 'https://www.rent.com/',
  locationUrl: (location) => {
    const route = rentLocation(location);
    return route ? `https://www.rent.com/${route}` : undefined;
  },
});

const zumper = locationOnlySite({
  id: 'zumper',
  name: 'Zumper',
  description: 'Broad property types with strong amenity filters.',
  version: 1,
  allowedOrigins: ['https://www.zumper.com'],
  supportedCriteria: ['location'],
  homeUrl: 'https://www.zumper.com/',
  locationUrl: (location) =>
    `https://www.zumper.com/apartments-for-rent/${locationSlug(location)}`,
});

const rentCafe = locationOnlySite({
  id: 'rentcafe',
  name: 'RentCafe',
  description: 'Managed apartment inventory and detailed amenity filters.',
  version: 1,
  allowedOrigins: ['https://www.rentcafe.com'],
  supportedCriteria: ['location'],
  homeUrl: 'https://www.rentcafe.com/',
  locationUrl: (location) =>
    `https://www.rentcafe.com/apartments-for-rent/${locationSlug(location)}/`,
});

const redfin: SearchSiteDefinition = {
  id: 'redfin',
  name: 'Redfin',
  description: 'Popular rental marketplace; location setup continues on site.',
  version: 1,
  allowedOrigins: ['https://www.redfin.com'],
  supportedCriteria: [],
  buildLink(search) {
    return readyLink(
      this,
      search,
      new URL('https://www.redfin.com/rentals'),
      [],
    );
  },
};

export const SEARCH_SITE_ADAPTERS: readonly SearchSiteDefinition[] = [
  zillow,
  apartments,
  realtor,
  redfin,
  rent,
  hotpads,
  zumper,
  rentCafe,
];

export function buildSearchLinks(search: RentalSearch) {
  return SEARCH_SITE_ADAPTERS.map((site) => ({
    site,
    result: site.buildLink(search),
  }));
}
