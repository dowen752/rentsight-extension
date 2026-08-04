export interface LocationQuery {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface ResolvedLocation {
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
}

export interface LocationEstimate {
  location: ResolvedLocation;
  utilityAdjustmentFactor: number;
  localMedianRent?: number;
  providerNotes: string[];
  resolvedAt: string;
}

export interface GeocodingProvider {
  readonly name: string;
  geocode(query: LocationQuery): Promise<ResolvedLocation | undefined>;
}

export interface RegionalUtilityProvider {
  readonly name: string;
  getAdjustment(location: ResolvedLocation): Promise<number>;
}

export interface LocalRentBenchmarkProvider {
  readonly name: string;
  getMonthlyBenchmark(
    location: ResolvedLocation,
    bedrooms?: number,
  ): Promise<number | undefined>;
}

export interface LocationCache {
  get(key: string): Promise<LocationEstimate | undefined>;
  set(key: string, value: LocationEstimate): Promise<void>;
}
