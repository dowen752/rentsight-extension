import type {
  GeocodingProvider,
  LocalRentBenchmarkProvider,
  LocationCache,
  LocationEstimate,
  LocationQuery,
  RegionalUtilityProvider,
} from './types';

export const locationCacheKey = (query: LocationQuery): string =>
  [query.address, query.city, query.state, query.zipCode]
    .filter(Boolean)
    .join('|')
    .trim()
    .toLowerCase();

export async function estimateLocation(
  query: LocationQuery,
  bedrooms: number | undefined,
  providers: {
    geocoding: GeocodingProvider;
    utilities: RegionalUtilityProvider;
    rentBenchmarks: LocalRentBenchmarkProvider;
    cache: LocationCache;
  },
): Promise<LocationEstimate | undefined> {
  const key = locationCacheKey(query);
  if (!key) return undefined;
  const cached = await providers.cache.get(key);
  if (cached) return cached;
  const location = await providers.geocoding.geocode(query);
  if (!location) return undefined;
  const [utilityAdjustmentFactor, localMedianRent] = await Promise.all([
    providers.utilities.getAdjustment(location),
    providers.rentBenchmarks.getMonthlyBenchmark(location, bedrooms),
  ]);
  const estimate: LocationEstimate = {
    location,
    utilityAdjustmentFactor,
    localMedianRent,
    providerNotes: [
      providers.geocoding.name,
      providers.utilities.name,
      providers.rentBenchmarks.name,
    ],
    resolvedAt: new Date().toISOString(),
  };
  await providers.cache.set(key, estimate);
  return estimate;
}

export class MemoryLocationCache implements LocationCache {
  private readonly values = new Map<string, LocationEstimate>();
  async get(key: string): Promise<LocationEstimate | undefined> {
    return this.values.get(key);
  }
  async set(key: string, value: LocationEstimate): Promise<void> {
    this.values.set(key, value);
  }
}
