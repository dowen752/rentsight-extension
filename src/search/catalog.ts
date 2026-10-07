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
import {
  REALTOR_ORIGIN,
  REALTOR_SUPPORTED_CRITERIA,
  realtorAppliedCriteria,
} from './realtor';
import {
  REDFIN_ORIGIN,
  REDFIN_SUPPORTED_CRITERIA,
  redfinAppliedCriteria,
} from './redfin';
import {
  RENT_ORIGIN,
  RENT_SUPPORTED_CRITERIA,
  rentAppliedCriteria,
} from './rent';
import {
  HOTPADS_ORIGIN,
  HOTPADS_SUPPORTED_CRITERIA,
  hotpadsAppliedCriteria,
} from './hotpads';
import {
  ZUMPER_ORIGIN,
  ZUMPER_SUPPORTED_CRITERIA,
  zumperAppliedCriteria,
} from './zumper';

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
    return readyLink(
      this,
      search,
      new URL('/', APARTMENTS_ORIGIN),
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
  description:
    'Mixed apartments and homes with a detailed assisted filter search.',
  version: 2,
  allowedOrigins: [REALTOR_ORIGIN],
  supportedCriteria: REALTOR_SUPPORTED_CRITERIA,
  buildLink(search) {
    return readyLink(
      this,
      search,
      new URL('/rentals', REALTOR_ORIGIN),
      realtorAppliedCriteria(search),
      'page',
    );
  },
};

const hotpads: SearchSiteDefinition = {
  id: 'hotpads',
  name: 'HotPads',
  description: 'Map-first rental search with assisted location and filters.',
  version: 2,
  allowedOrigins: [HOTPADS_ORIGIN],
  supportedCriteria: HOTPADS_SUPPORTED_CRITERIA,
  buildLink(search) {
    return readyLink(
      this,
      search,
      new URL('/', HOTPADS_ORIGIN),
      hotpadsAppliedCriteria(search),
      'page',
    );
  },
};

const rent: SearchSiteDefinition = {
  id: 'rent',
  name: 'Rent.com',
  description: 'Rental search with assisted location and detailed filters.',
  version: 2,
  allowedOrigins: [RENT_ORIGIN],
  supportedCriteria: RENT_SUPPORTED_CRITERIA,
  buildLink(search) {
    return readyLink(
      this,
      search,
      new URL('/', RENT_ORIGIN),
      rentAppliedCriteria(search),
      'page',
    );
  },
};

const zumper: SearchSiteDefinition = {
  id: 'zumper',
  name: 'Zumper',
  description: 'Broad rental search with staged assisted filters.',
  version: 2,
  allowedOrigins: [ZUMPER_ORIGIN],
  supportedCriteria: ZUMPER_SUPPORTED_CRITERIA,
  buildLink(search) {
    return readyLink(
      this,
      search,
      new URL('/', ZUMPER_ORIGIN),
      zumperAppliedCriteria(search),
      'page',
    );
  },
};

const redfin: SearchSiteDefinition = {
  id: 'redfin',
  name: 'Redfin',
  description: 'Map-first rental search with assisted location and filters.',
  version: 2,
  allowedOrigins: [REDFIN_ORIGIN],
  supportedCriteria: REDFIN_SUPPORTED_CRITERIA,
  buildLink(search) {
    return readyLink(
      this,
      search,
      new URL('/rentals', REDFIN_ORIGIN),
      redfinAppliedCriteria(search),
      'page',
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
];

export function buildSearchLinks(search: RentalSearch) {
  return SEARCH_SITE_ADAPTERS.map((site) => ({
    site,
    result: site.buildLink(search),
  }));
}
