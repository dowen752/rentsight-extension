import { describe, expect, it } from 'vitest';
import {
  estimateLocation,
  MemoryLocationCache,
  MockGeocodingProvider,
  MockRegionalUtilityProvider,
  MockRentBenchmarkProvider,
} from '../src/location';
import {
  applyLocationEstimate,
  createInitialAnalysis,
} from '../src/shared/analysis';

describe('location estimates', () => {
  it('fails gracefully when a location cannot be resolved', async () => {
    const result = await estimateLocation(
      { address: 'Unresolvable address' },
      1,
      {
        geocoding: new MockGeocodingProvider(undefined),
        utilities: new MockRegionalUtilityProvider(),
        rentBenchmarks: new MockRentBenchmarkProvider(),
        cache: new MemoryLocationCache(),
      },
    );
    expect(result).toBeUndefined();
  });

  it('surfaces provider failures to the caller for graceful handling', async () => {
    await expect(
      estimateLocation({ address: 'Failure' }, 1, {
        geocoding: new MockGeocodingProvider(undefined, true),
        utilities: new MockRegionalUtilityProvider(),
        rentBenchmarks: new MockRentBenchmarkProvider(),
        cache: new MemoryLocationCache(),
      }),
    ).rejects.toThrow('Mock geocoding failure');
  });

  it('returns cached results without calling geocoding twice', async () => {
    const geocoding = new MockGeocodingProvider({
      city: 'Seattle',
      state: 'WA',
      zipCode: '98101',
    });
    const cache = new MemoryLocationCache();
    const providers = {
      geocoding,
      utilities: new MockRegionalUtilityProvider(0.92),
      rentBenchmarks: new MockRentBenchmarkProvider(2_100),
      cache,
    };
    const query = { address: '100 Test Ave, Seattle, WA 98101' };
    const first = await estimateLocation(query, 1, providers);
    const second = await estimateLocation(query, 1, providers);
    expect(first).toEqual(second);
    expect(geocoding.calls).toBe(1);
    expect(first?.utilityAdjustmentFactor).toBe(0.92);
  });

  it('applies transparent regional estimates without replacing user values', () => {
    const analysis = createInitialAnalysis('https://example.com/1', 'Rental');
    const adjusted = applyLocationEstimate(analysis, {
      location: { city: 'Seattle', state: 'WA', zipCode: '98101' },
      utilityAdjustmentFactor: 0.92,
      providerNotes: ['Test'],
      resolvedAt: new Date().toISOString(),
    });
    expect(adjusted.listing.recurring.electricity).toMatchObject({
      value: 83,
      source: 'location_estimate',
    });
    expect(adjusted.listing.identity.city?.value).toBe('Seattle');
  });
});
