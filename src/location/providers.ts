import {
  DEFAULT_REGIONAL_UTILITY_FACTOR,
  REGIONAL_UTILITY_FACTORS,
} from './config';
import type {
  GeocodingProvider,
  LocalRentBenchmarkProvider,
  LocationQuery,
  RegionalUtilityProvider,
  ResolvedLocation,
} from './types';

const ADDRESS_PATTERN =
  /(?:^|,\s*)([A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/;

export class LocalGeocodingProvider implements GeocodingProvider {
  readonly name = 'Local address parser';
  async geocode(query: LocationQuery): Promise<ResolvedLocation | undefined> {
    if (query.city && query.state && query.zipCode)
      return {
        city: query.city,
        state: query.state.toUpperCase(),
        zipCode: query.zipCode,
      };
    const match = query.address?.match(ADDRESS_PATTERN);
    return match
      ? { city: match[1].trim(), state: match[2], zipCode: match[3] }
      : undefined;
  }
}

export class LocalRegionalUtilityProvider implements RegionalUtilityProvider {
  readonly name = 'Local regional utility factors';
  async getAdjustment(location: ResolvedLocation): Promise<number> {
    return (
      REGIONAL_UTILITY_FACTORS[location.state.toUpperCase()] ??
      DEFAULT_REGIONAL_UTILITY_FACTOR
    );
  }
}

export class MockGeocodingProvider implements GeocodingProvider {
  readonly name = 'Mock geocoder';
  calls = 0;
  constructor(
    private readonly result?: ResolvedLocation,
    private readonly shouldFail = false,
  ) {}
  async geocode(): Promise<ResolvedLocation | undefined> {
    this.calls += 1;
    if (this.shouldFail) throw new Error('Mock geocoding failure.');
    return this.result;
  }
}

export class MockRegionalUtilityProvider implements RegionalUtilityProvider {
  readonly name = 'Mock regional utilities';
  constructor(private readonly factor = 1) {}
  async getAdjustment(): Promise<number> {
    return this.factor;
  }
}

export class MockRentBenchmarkProvider implements LocalRentBenchmarkProvider {
  readonly name = 'Mock local rent benchmark';
  constructor(private readonly monthlyRent?: number) {}
  async getMonthlyBenchmark(): Promise<number | undefined> {
    return this.monthlyRent;
  }
}

/** Developer-only adapter. Do not point this at APIs requiring browser-held secrets. */
export class MockBackendGeocodingProvider implements GeocodingProvider {
  readonly name = 'Developer mock backend';
  constructor(private readonly endpoint: string) {}
  async geocode(query: LocationQuery): Promise<ResolvedLocation | undefined> {
    const response = await fetch(
      `${this.endpoint.replace(/\/$/, '')}/geocode`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(query),
      },
    );
    if (!response.ok)
      throw new Error(`Mock backend returned ${response.status}.`);
    return (await response.json()) as ResolvedLocation;
  }
}
