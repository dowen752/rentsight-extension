import { describe, expect, it } from 'vitest';
import {
  createInitialAnalysis,
  setIdentityValue,
  setRecurringValue,
} from '../src/shared/analysis';
import {
  calculateCompleteness,
  createComparison,
  deleteListing,
  exportListingsCsv,
  exportListingsJson,
  importListingsJson,
  mergeImportedListings,
  migrateSavedRecord,
  saveListing,
} from '../src/saved';

const analysisFor = (url: string, rent = 2_000) => {
  let analysis = createInitialAnalysis(url, 'Saved rental');
  analysis = setIdentityValue(
    analysis,
    'fullAddress',
    '100 Test Ave, Sample, CA 90000',
  );
  analysis = setIdentityValue(analysis, 'bedrooms', 2);
  analysis = setIdentityValue(analysis, 'squareFootage', 1_000);
  return setRecurringValue(analysis, 'advertisedRent', rent);
};

describe('saved listings repository', () => {
  it('saves, updates, and deduplicates by URL', () => {
    const first = saveListing([], analysisFor('https://example.com/1'));
    const second = saveListing(
      first.records,
      analysisFor('https://example.com/1', 2_200),
    );
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.records).toHaveLength(1);
    expect(second.record.id).toBe(first.record.id);
    expect(second.record.analysis.listing.recurring.advertisedRent?.value).toBe(
      2_200,
    );
  });

  it('deletes by saved record id', () => {
    const saved = saveListing([], analysisFor('https://example.com/1'));
    expect(deleteListing(saved.records, saved.record.id)).toEqual([]);
  });
});

describe('comparison and completeness', () => {
  it('calculates comparable totals and cost differences', () => {
    const { record } = saveListing([], analysisFor('https://example.com/1'));
    const result = createComparison(record);
    expect(result.trueMonthlyCost).toBeGreaterThan(2_000);
    expect(result.monthlyDifference).toBe(result.trueMonthlyCost - 2_000);
    expect(result.costPerSquareFoot).toBe(result.trueMonthlyCost / 1_000);
  });

  it('labels a weighted data-completeness score', () => {
    const { record } = saveListing([], analysisFor('https://example.com/1'));
    const result = calculateCompleteness(record);
    expect(result.label).toBe('Data completeness');
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.estimated).toBeGreaterThan(0);
  });
});

describe('listing transfer and migration', () => {
  it('round-trips JSON and exports CSV', () => {
    const { record } = saveListing([], analysisFor('https://example.com/1'));
    const imported = importListingsJson(exportListingsJson([record]));
    expect(imported.errors).toEqual([]);
    expect(imported.records[0].url).toBe(record.url);
    expect(exportListingsCsv([record])).toContain('True monthly cost');
  });

  it('rejects invalid imported data', () => {
    expect(importListingsJson('{broken').errors[0]).toContain('valid JSON');
    expect(importListingsJson('{"listings":[]}').errors[0]).toContain(
      'not a RentSight',
    );
    const malformed = JSON.stringify({
      format: 'rentsight-saved-listings',
      schemaVersion: 1,
      listings: [
        {
          schemaVersion: 1,
          url: 'https://example.com/broken',
          analysis: {
            listing: {},
            baseline: {},
            utilityIncluded: {},
            customRecurringFees: [],
            customOneTimeFees: [],
          },
        },
      ],
    });
    expect(importListingsJson(malformed).errors[0]).toContain(
      'analysis is missing or invalid',
    );
  });

  it('migrates a version-zero record and supplies new analysis defaults', () => {
    const analysis = analysisFor('https://example.com/legacy');
    const migrated = migrateSavedRecord({
      schemaVersion: 0,
      url: 'https://example.com/legacy',
      analysis: { ...analysis, utilityIncludedSource: undefined },
    });
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.analysis.utilityIncludedSource.electricity).toBe('default');
  });

  it('merges imported duplicate URLs without duplicates', () => {
    const first = saveListing([], analysisFor('https://example.com/1')).record;
    const replacement = saveListing(
      [],
      analysisFor('https://example.com/1', 2_500),
    ).record;
    const merged = mergeImportedListings([first], [replacement]);
    expect(merged).toHaveLength(1);
    expect(merged[0].analysis.listing.recurring.advertisedRent?.value).toBe(
      2_500,
    );
  });
});
