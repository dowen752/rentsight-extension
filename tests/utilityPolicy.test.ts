import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { extractListing } from '../src/extractors';
import { estimateUtilities } from '../src/calculations';
import {
  applyExtraction,
  applyHouseholdProfile,
  applyLocationEstimate,
  createInitialAnalysis,
  materializeListing,
  setRecurringValue,
  setUtilityIncluded,
} from '../src/shared/analysis';
import {
  saveListing,
  migrateSavedRecord,
  createComparison,
} from '../src/saved';
import { applyAiExtraction } from '../src/ai/adapter';
import { readFileSync } from 'node:fs';
import type { ExtractionSuccess } from '../src/ai/types';

describe('utility policy across the listing workflow', () => {
  it('scales energy with the home, water/sewer with occupants, and leaves trash fixed', () => {
    const base = {
      occupants: 1,
      housingType: 'apartment' as const,
      includedUtilities: [],
    };
    const apartment = estimateUtilities(base);
    const larger = estimateUtilities({
      ...base,
      bedrooms: 3,
      squareFootage: 1800,
      housingType: 'single_family',
    });
    expect(larger.electricity!.value).toBeGreaterThan(
      apartment.electricity!.value,
    );
    expect(larger.naturalGas!.value).toBeGreaterThan(
      apartment.naturalGas!.value,
    );
    for (const key of ['water', 'sewer', 'trash', 'internet'] as const)
      expect(larger[key]!.value).toBe(apartment[key]!.value);
    const roommate = estimateUtilities({ ...base, occupants: 2 });
    expect(roommate.water!.value).toBe(40);
    expect(roommate.sewer!.value).toBe(29);
    expect(roommate.trash!.value).toBe(25);
  });

  it.each(['Townhouse', 'Single-family home'])(
    'carries %s from extraction through AI enrichment, saving, and comparison',
    (type) => {
      const url = 'https://example.com/rental';
      const document = new JSDOM(
        `<main><h1>Rental</h1><p>Property type: ${type}</p><p>Rent: $2000</p></main>`,
      ).window.document;
      let analysis = applyExtraction(
        createInitialAnalysis(url),
        extractListing(document, new URL(url)),
      );
      const expectedType = type === 'Townhouse' ? 'townhouse' : 'single_family';
      expect(analysis.listing.identity.housingType?.value).toBe(expectedType);
      expect(materializeListing(analysis).recurring.electricity?.value).toBe(
        type === 'Townhouse' ? 99 : 108,
      );
      const response = JSON.parse(
        readFileSync('tests/fixtures/ai/normal.response.json', 'utf8'),
      ) as ExtractionSuccess;
      analysis = applyAiExtraction(analysis, response);
      expect(analysis.listing.identity.housingType?.value).toBe(expectedType);
      analysis = applyHouseholdProfile(analysis, {
        occupants: 2,
        cats: 0,
        smallDogs: 0,
        largeDogs: 0,
      });
      analysis = applyLocationEstimate(analysis, {
        location: { city: 'Dallas', state: 'TX', zipCode: '75204' },
        utilityAdjustmentFactor: 1.05,
        providerNotes: [],
        resolvedAt: new Date().toISOString(),
      });
      // Actual listing amounts and inclusion must take precedence over estimates.
      analysis = setRecurringValue(analysis, 'electricity', 125);
      analysis = setUtilityIncluded(analysis, 'water', true);
      const listing = materializeListing(analysis);
      expect(listing.recurring.electricity?.value).toBe(125);
      expect(listing.recurring.water?.value).toBe(0);
      expect(listing.recurring.trash?.value).toBe(26);
      const saved = saveListing([], analysis).records[0];
      const restored = migrateSavedRecord(JSON.parse(JSON.stringify(saved)))!;
      expect(restored.analysis.listing.identity.housingType?.value).toBe(
        expectedType,
      );
      expect(createComparison(restored).utilities).toBe(
        createComparison(saved).utilities,
      );
    },
  );

  it('does not infer type from nearby cards or descriptive prose', () => {
    const document = new JSDOM(
      '<main><p>Close to single-family homes and townhouse communities.</p><aside><p>Property type: Townhouse</p></aside></main>',
    ).window.document;
    expect(
      extractListing(document, new URL('https://example.com/rental')).listing
        .identity.housingType,
    ).toBeUndefined();
  });
});
