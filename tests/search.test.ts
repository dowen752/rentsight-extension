import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  SEARCH_SITE_ADAPTERS,
  buildSearchLinks,
  createSearchProfile,
  getSearchProfile,
  normalizeRentalSearch,
  requestedSearchCriteria,
  setSearchProfile,
} from '../src/search';
import { extensionStorage } from '../src/storage';

afterEach(() => vi.restoreAllMocks());

describe('rental search contract', () => {
  it('supports empty searches and budget-plus-parking without location', () => {
    expect(normalizeRentalSearch({})).toEqual({ search: {}, issues: [] });
    const result = normalizeRentalSearch({
      maxListedRent: 2000,
      parkingAvailable: true,
    });
    expect(result).toEqual({
      search: { maxListedRent: 2000, parkingAvailable: true },
      issues: [],
    });
    expect(requestedSearchCriteria(result.search)).toEqual([
      'maxListedRent',
      'parkingAvailable',
    ]);
  });

  it('preserves zero and half bathrooms without rounding or coercion', () => {
    expect(
      normalizeRentalSearch({
        minBedrooms: 0,
        minBathrooms: 1.5,
        minListedRent: 0,
      }).search,
    ).toEqual({ minBedrooms: 0, minBathrooms: 1.5, minListedRent: 0 });
    expect(
      normalizeRentalSearch({
        minBedrooms: 1.5,
        minBathrooms: 1.2,
        maxListedRent: '2000',
        minSquareFeet: Infinity,
      }).issues,
    ).toHaveLength(4);
  });

  it('does not invent negative amenity or pet requirements', () => {
    expect(
      normalizeRentalSearch({
        catsAllowed: false,
        smallDogsAllowed: true,
        largeDogsAllowed: false,
        parkingAvailable: false,
        inUnitLaundry: false,
        airConditioning: false,
      }).search,
    ).toEqual({ smallDogsAllowed: true });
  });

  it('trims locations, deduplicates types, and removes empty selections', () => {
    expect(
      normalizeRentalSearch({
        location: '  Seattle,   WA ',
        propertyTypes: ['house', 'house', 'apartment_condo'],
      }).search,
    ).toEqual({
      location: 'Seattle, WA',
      propertyTypes: ['apartment_condo', 'house'],
    });
    expect(
      normalizeRentalSearch({
        location: ' ',
        propertyTypes: [],
        moveInDate: '',
      }).search,
    ).toEqual({});
  });

  it('reports invalid ranges, types, dates, and checkbox values', () => {
    const result = normalizeRentalSearch({
      minListedRent: 2500,
      maxListedRent: 2000,
      propertyTypes: ['castle'],
      moveInDate: '2026-02-30',
      catsAllowed: 'yes',
      minSquareFeet: -1,
    });
    expect(result.issues).toHaveLength(5);
    expect(result.search.minListedRent).toBe(2500);
    expect(result.search.maxListedRent).toBe(2000);
    expect(normalizeRentalSearch({ moveInDate: '2028-02-29' }).issues).toEqual(
      [],
    );
    expect(normalizeRentalSearch(null).issues).toHaveLength(1);
  });

  it('persists a versioned profile without touching listing or household data', async () => {
    const write = vi.spyOn(extensionStorage, 'set').mockResolvedValue();
    await setSearchProfile({ maxListedRent: 2000, parkingAvailable: true });
    expect(write).toHaveBeenCalledExactlyOnceWith('searchProfile', {
      schemaVersion: 2,
      search: { maxListedRent: 2000, parkingAvailable: true },
    });
    vi.spyOn(extensionStorage, 'get').mockResolvedValue({
      schemaVersion: 2,
      search: { maxListedRent: 2000 },
    });
    expect(await getSearchProfile()).toEqual(
      createSearchProfile({ maxListedRent: 2000 }),
    );
  });

  it('rejects invalid profiles instead of silently broadening searches', async () => {
    const write = vi.spyOn(extensionStorage, 'set').mockResolvedValue();
    await expect(
      setSearchProfile({ minListedRent: 2500, maxListedRent: 2000 }),
    ).rejects.toThrow('Maximum');
    expect(write).not.toHaveBeenCalled();
    vi.spyOn(extensionStorage, 'get').mockResolvedValue(undefined);
    expect(await getSearchProfile()).toEqual({ schemaVersion: 2, search: {} });
  });

  it('migrates a version-one dog preference to both supported dog sizes', async () => {
    vi.spyOn(extensionStorage, 'get').mockResolvedValue({
      schemaVersion: 1,
      search: { location: 'Seattle, WA', dogsAllowed: true },
    });
    expect(await getSearchProfile()).toEqual({
      schemaVersion: 2,
      search: {
        location: 'Seattle, WA',
        smallDogsAllowed: true,
        largeDogsAllowed: true,
      },
    });
  });
});

describe('rental search site adapters', () => {
  it('prepares Rent.com search and reports only filters with matching semantics', () => {
    const rent = SEARCH_SITE_ADAPTERS.find((site) => site.id === 'rent')!;
    expect(
      rent.buildLink({
        location: 'Springfield, MO',
        minListedRent: 1000,
        maxListedRent: 6000,
        minBedrooms: 1,
        minBathrooms: 2,
        propertyTypes: ['apartment_condo', 'house'],
        catsAllowed: true,
        smallDogsAllowed: true,
        largeDogsAllowed: true,
        parkingAvailable: true,
        moveInDate: '2026-09-24',
        minSquareFeet: 537,
        inUnitLaundry: true,
        airConditioning: true,
      }),
    ).toEqual({
      status: 'ready',
      link: {
        url: 'https://www.rent.com/',
        transferMode: 'page',
        applied: [
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
        ],
        omitted: ['parkingAvailable'],
      },
    });
    expect(rent.buildLink({ maxListedRent: 2000 })).toEqual({
      status: 'ready',
      link: {
        url: 'https://www.rent.com/',
        transferMode: 'page',
        applied: [],
        omitted: ['maxListedRent'],
      },
    });
  });
  it('prepares Redfin assistance without guessing opaque city IDs', () => {
    const redfin = SEARCH_SITE_ADAPTERS.find((site) => site.id === 'redfin')!;
    expect(
      redfin.buildLink({
        location: 'Springfield, MO',
        minListedRent: 1000,
        maxListedRent: 6000,
        minBedrooms: 1,
        minBathrooms: 2,
        propertyTypes: ['house'],
        catsAllowed: true,
        moveInDate: '2026-09-24',
        minSquareFeet: 537,
        parkingAvailable: true,
        inUnitLaundry: true,
        airConditioning: true,
      }),
    ).toEqual({
      status: 'ready',
      link: {
        url: 'https://www.redfin.com/rentals',
        transferMode: 'page',
        applied: [
          'location',
          'minListedRent',
          'maxListedRent',
          'minBedrooms',
          'minBathrooms',
          'propertyTypes',
          'catsAllowed',
          'moveInDate',
          'minSquareFeet',
          'parkingAvailable',
          'inUnitLaundry',
          'airConditioning',
        ],
        omitted: [],
      },
    });
    expect(redfin.buildLink({ minListedRent: 1000 })).toEqual({
      status: 'ready',
      link: {
        url: 'https://www.redfin.com/rentals',
        transferMode: 'page',
        applied: [],
        omitted: ['minListedRent'],
      },
    });
    const ambiguous = redfin.buildLink({
      location: 'Springfield',
      minBedrooms: 1,
    });
    expect(ambiguous.status).toBe('ready');
    if (ambiguous.status === 'ready') {
      expect(ambiguous.link.applied).toEqual(['location', 'minBedrooms']);
      expect(ambiguous.link.omitted).toEqual([]);
    }
  });
  it('offers the seven supported marketplaces in product order', () => {
    expect(SEARCH_SITE_ADAPTERS.map((site) => site.name)).toEqual([
      'Zillow',
      'Apartments.com',
      'Realtor.com',
      'Redfin',
      'Rent.com',
      'HotPads',
      'Zumper',
    ]);
  });

  it('prepares HotPads for assisted location and filter application', () => {
    const hotpads = SEARCH_SITE_ADAPTERS.find((site) => site.id === 'hotpads')!;
    expect(
      hotpads.buildLink({
        location: 'Chicago',
        minListedRent: 2500,
        maxListedRent: 7000,
        minBedrooms: 3,
        minBathrooms: 3,
        propertyTypes: ['house', 'townhouse'],
        catsAllowed: true,
        largeDogsAllowed: true,
        moveInDate: '2026-10-18',
        minSquareFeet: 600,
        parkingAvailable: true,
        inUnitLaundry: true,
        airConditioning: true,
      }),
    ).toEqual({
      status: 'ready',
      link: {
        url: 'https://hotpads.com/',
        transferMode: 'page',
        applied: [
          'location',
          'minListedRent',
          'maxListedRent',
          'minBedrooms',
          'minBathrooms',
          'propertyTypes',
          'catsAllowed',
          'largeDogsAllowed',
          'moveInDate',
          'minSquareFeet',
          'parkingAvailable',
          'inUnitLaundry',
          'airConditioning',
        ],
        omitted: [],
      },
    });
  });

  it('prepares Zumper for staged assisted filters without overpromising', () => {
    const zumper = SEARCH_SITE_ADAPTERS.find((site) => site.id === 'zumper')!;
    expect(
      zumper.buildLink({
        location: 'Springfield',
        minListedRent: 1000,
        maxListedRent: 6000,
        minBedrooms: 2,
        minBathrooms: 2,
        propertyTypes: ['apartment_condo', 'house'],
        catsAllowed: true,
        smallDogsAllowed: true,
        moveInDate: '2026-10-18',
        minSquareFeet: 700,
        parkingAvailable: true,
        inUnitLaundry: true,
        airConditioning: true,
      }),
    ).toEqual({
      status: 'ready',
      link: {
        url: 'https://www.zumper.com/',
        transferMode: 'page',
        applied: [
          'location',
          'minListedRent',
          'maxListedRent',
          'minBedrooms',
          'minBathrooms',
          'propertyTypes',
          'catsAllowed',
          'smallDogsAllowed',
          'minSquareFeet',
          'inUnitLaundry',
          'airConditioning',
        ],
        omitted: ['moveInDate', 'parkingAvailable'],
      },
    });
  });

  it('opens Apartments.com cleanly and reports page-assisted filters', () => {
    const result = SEARCH_SITE_ADAPTERS.find(
      (site) => site.id === 'apartments',
    )!.buildLink({
      location: 'Seattle, WA',
      minListedRent: 1500,
      maxListedRent: 2500,
      minBedrooms: 2,
      minBathrooms: 2,
      propertyTypes: ['house'],
      parkingAvailable: true,
    });
    expect(result).toEqual({
      status: 'ready',
      link: {
        url: 'https://www.apartments.com/seattle-wa/',
        transferMode: 'page',
        applied: [
          'location',
          'minListedRent',
          'maxListedRent',
          'minBedrooms',
          'minBathrooms',
          'propertyTypes',
          'parkingAvailable',
        ],
        omitted: [],
      },
    });
  });

  it('opens Zillow at the canonical location before applying filters', () => {
    const result = SEARCH_SITE_ADAPTERS.find(
      (site) => site.id === 'zillow',
    )!.buildLink({
      location: 'Seattle, WA',
      maxListedRent: 2500,
      minBedrooms: 2,
      minBathrooms: 1.5,
      propertyTypes: ['apartment_condo', 'townhouse'],
      moveInDate: '2026-09-24',
      minSquareFeet: 800,
      catsAllowed: true,
      smallDogsAllowed: true,
      largeDogsAllowed: true,
      parkingAvailable: true,
      inUnitLaundry: true,
      airConditioning: true,
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    const url = new URL(result.link.url);
    expect(url.origin).toBe('https://www.zillow.com');
    expect(url.pathname).toBe('/seattle-wa/rentals/');
    expect(url.search).toBe('');
    expect(result.link.applied).toEqual([
      'location',
      'maxListedRent',
      'minBedrooms',
      'minBathrooms',
      'propertyTypes',
      'moveInDate',
      'minSquareFeet',
      'catsAllowed',
      'smallDogsAllowed',
      'largeDogsAllowed',
      'parkingAvailable',
      'inUnitLaundry',
      'airConditioning',
    ]);
    expect(result.link.omitted).toEqual([]);
  });

  it('uses Realtor.com direct routes when known and its own lookup when ambiguous', () => {
    const realtor = SEARCH_SITE_ADAPTERS.find((site) => site.id === 'realtor')!;
    const direct = realtor.buildLink({
      location: 'Springfield, MO',
      maxListedRent: 2_500,
      minBedrooms: 2,
      minBathrooms: 2,
      propertyTypes: ['apartment_condo', 'townhouse'],
      catsAllowed: true,
      largeDogsAllowed: true,
      moveInDate: '2026-09-24',
      minSquareFeet: 600,
      parkingAvailable: true,
      inUnitLaundry: true,
      airConditioning: true,
    });
    expect(direct).toEqual({
      status: 'ready',
      link: {
        url: 'https://www.realtor.com/apartments/springfield_MO',
        transferMode: 'page',
        applied: [
          'location',
          'maxListedRent',
          'minBedrooms',
          'minBathrooms',
          'propertyTypes',
          'catsAllowed',
          'largeDogsAllowed',
          'moveInDate',
          'minSquareFeet',
          'parkingAvailable',
          'inUnitLaundry',
        ],
        omitted: ['airConditioning'],
      },
    });
    expect(realtor.buildLink({ location: 'Springfield' })).toEqual({
      status: 'ready',
      link: {
        url: 'https://www.realtor.com/rentals',
        transferMode: 'page',
        applied: ['location'],
        omitted: [],
      },
    });
  });

  it('keeps broad searches valid and reports unapplied preferences per site', () => {
    const results = buildSearchLinks({
      maxListedRent: 2000,
      parkingAvailable: true,
    });
    expect(results).toHaveLength(7);
    const apartments = results.find(({ site }) => site.id === 'apartments')!;
    expect(apartments.result).toMatchObject({
      status: 'ready',
      link: {
        applied: [],
        omitted: ['maxListedRent', 'parkingAvailable'],
      },
    });
    const zillow = results.find(({ site }) => site.id === 'zillow')!;
    expect(zillow.result).toMatchObject({
      status: 'ready',
      link: {
        applied: ['maxListedRent', 'parkingAvailable'],
        omitted: [],
      },
    });
  });

  it('uses only each adapter’s allowlisted HTTPS destination', () => {
    for (const { site, result } of buildSearchLinks({
      location: '98101',
      minBedrooms: 2,
    })) {
      expect(result.status).toBe('ready');
      if (result.status !== 'ready') continue;
      const url = new URL(result.link.url);
      expect(url.protocol).toBe('https:');
      expect(site.allowedOrigins).toContain(url.origin);
    }
  });
});
