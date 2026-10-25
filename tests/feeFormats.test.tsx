import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { extractListing, type ListingExtraction } from '../src/extractors';
import { captureListing } from '../src/ai/capture';
import { assertRequest } from '../src/ai/validation';
import { buildExtractionRequest } from '../src/ai/request';
import { AnalysisEditor } from '../src/sidepanel/App';
import { AiSourceReview } from '../src/sidepanel/AiExtractionCard';
import {
  applyExtraction,
  createInitialAnalysis,
  decidePropertyNote,
  materializeListing,
} from '../src/shared/analysis';
import {
  calculateEstimatedTrueMonthlyCost,
  calculateFirstYearHousingCost,
  calculateRequiredMoveInCash,
} from '../src/calculations';
import { exportListingsJson, importListingsJson } from '../src/saved/transfer';
import { createComparison } from '../src/saved/comparison';
import type { SavedListingRecord } from '../src/saved/types';
import { feeFormats, type FeeFormatCase } from './fixtures/fees/formats/cases';
import { feeGap } from './helpers/feeGap';

const read = (scenario: FeeFormatCase) => {
  const document = new JSDOM(
    readFileSync(
      new URL(`./fixtures/fees/formats/${scenario.id}.html`, import.meta.url),
      'utf8',
    ),
    { url: scenario.url },
  ).window.document;
  return {
    document,
    extraction: extractListing(document, new URL(scenario.url)),
  };
};
// These are renter-facing expectations, independent of parser IDs/selectors.
const expectedCharges = [
  ['Connectivity fee', 27],
  ['Utility billing fee', 5.95],
];
const chargePairs = (extraction: ListingExtraction) =>
  extraction.namedRecurringFees?.map((f) => [
    f.label.replace(/ \(required\)$/, ''),
    f.amount,
  ]);
const supported = feeFormats.filter((s) => !s.gap);
const gaps = feeFormats.filter((s) => s.gap);

describe('supported fee format corpus: equivalent listing obligations', () => {
  it('pairs native-table charge amounts', () => {
    expect(
      chargePairs(read(feeFormats.find((s) => s.id === 'table')!).extraction),
    ).toEqual(expectedCharges);
  });
  it.each(supported)(
    '$id: repeating the same evidence does not multiply the monthly bill',
    (scenario) => {
      const { document } = read(scenario);
      const root = document.querySelector('#left-column-container, main')!;
      root.append(...[...root.childNodes].map((node) => node.cloneNode(true)));
      const repeated = extractListing(document, new URL(scenario.url));
      const a = applyExtraction(createInitialAnalysis(scenario.url), repeated);
      expect(
        materializeListing(a).recurring.otherRequiredMonthlyFees?.value,
      ).toBeCloseTo(32.95);
      expect(a.customRecurringFees).toHaveLength(2);
    },
  );
  it.each(supported)(
    '$id: $title — separate inputs, priced optional note, and no duplicate aggregate',
    (scenario) => {
      const { extraction: e } = read(scenario);
      expect(chargePairs(e)).toEqual(expectedCharges);
      expect(e.feeNoteSuggestions).toHaveLength(1);
      expect(e.feeNoteSuggestions![0].label).toContain('Storage fee');
      expect(e.feeNoteSuggestions![0].detail).toContain('$40');
      const a = applyExtraction(createInitialAnalysis(scenario.url), e);
      expect(a.customRecurringFees.map((f) => f.amount)).toEqual([27, 5.95]);
      expect(a.listing.recurring.otherRequiredMonthlyFees).toBeUndefined();
      expect(
        materializeListing(a).recurring.otherRequiredMonthlyFees?.value,
      ).toBeCloseTo(32.95);
      const markup = renderToStaticMarkup(
        <AnalysisEditor analysis={a} update={() => undefined} />,
      );
      expect(markup).toContain('Connectivity fee (required)');
      expect(markup).toContain('value="27"');
      expect(markup).toContain('value="5.95"');
      expect(
        renderToStaticMarkup(
          <AiSourceReview analysis={a} update={() => undefined} />,
        ),
      ).toContain('$40');
    },
  );

  it.each(supported)(
    '$id: annual cost impact, note decisions, corrections, and saved comparison',
    (scenario) => {
      const { extraction: e } = read(scenario);
      const a = applyExtraction(createInitialAnalysis(scenario.url), e);
      const without = materializeListing({ ...a, customRecurringFees: [] });
      const listing = materializeListing(a);
      expect(
        calculateEstimatedTrueMonthlyCost(listing) -
          calculateEstimatedTrueMonthlyCost(without),
      ).toBeCloseTo(32.95);
      expect(
        calculateFirstYearHousingCost(listing) -
          calculateFirstYearHousingCost(without),
      ).toBeCloseTo(395.4);
      expect(calculateRequiredMoveInCash(listing)).toBe(
        calculateRequiredMoveInCash(without),
      );
      const note = e.feeNoteSuggestions![0];
      const kept = decidePropertyNote(a, note, true, 'listing');
      expect(calculateEstimatedTrueMonthlyCost(materializeListing(kept))).toBe(
        calculateEstimatedTrueMonthlyCost(listing),
      );
      kept.customRecurringFees[0] = {
        ...kept.customRecurringFees[0],
        amount: 30,
        source: 'user',
      };
      const refreshed = applyExtraction(kept, e);
      expect(refreshed.customRecurringFees[0].amount).toBe(30);
      const record: SavedListingRecord = {
        schemaVersion: 1,
        id: scenario.id,
        url: scenario.url,
        analysis: refreshed,
        createdAt: a.updatedAt,
        updatedAt: a.updatedAt,
      };
      const transfer = importListingsJson(exportListingsJson([record]));
      expect(transfer.errors).toEqual([]);
      const comparison = createComparison(transfer.records[0]);
      expect(comparison.trueMonthlyCost).toBe(
        calculateEstimatedTrueMonthlyCost(materializeListing(refreshed)),
      );
      expect(comparison.notes[0].text).toContain('$40');
      const dismissed = decidePropertyNote(refreshed, note, false, 'listing');
      expect(applyExtraction(dismissed, e).propertyNotes).toEqual([]);
      expect(dismissed.aiReviewDecisions?.[note.id]).toBe('excluded');
    },
  );
});

if (gaps.length)
  describe('additional fee formats', () => {
    // Unexpected passes fail the run. Promote a fixed scenario by removing its
    // gap in cases.ts; it then receives the full supported workflow tests above.
    feeGap.each(gaps)('$id: $title — $gap', (scenario) => {
      const e = read(scenario).extraction;
      if (scenario.gapAssertion === 'notes')
        expect(e.feeNoteSuggestions?.map((n) => n.label)).toEqual([
          'Storage fee',
        ]);
      else expect(chargePairs(e)).toEqual(expectedCharges);
    });
  });

describe('AI capture readiness for both supported and unsupported local formats', () => {
  it.each(feeFormats)(
    '$id: preserves all original fee evidence in a valid transport request',
    (scenario) => {
      const { document, extraction } = read(scenario);
      const context = captureListing(document, extraction);
      const text = context.capture.blocks.map((b) => b.text).join('\n');
      expect(text).toContain('Connectivity fee');
      expect(text).toContain('Utility billing fee');
      expect(text).toContain('Storage fee');
      for (const amount of scenario.id === 'usd-prefix'
        ? ['27.00', '5.95', '40.00']
        : ['27', '5.95', '40'])
        expect(text).toContain(amount);
      expect(context.capture.truncated).toBe(false);
      const request = buildExtractionRequest({
        url: scenario.url,
        title: 'Synthetic fee corpus',
        appearsToBeRentalListing: true,
        extraction,
        aiCapture: context,
      });
      expect(() => assertRequest(request)).not.toThrow();
    },
  );
});

const prose = (text: string) =>
  extractListing(
    new JSDOM(`<main><p>$2,000/mo</p><p>${text}</p></main>`).window.document,
    new URL('https://example.com/rental'),
  );
const customAmount = (text: string) =>
  prose(text).listing.recurring.otherRequiredMonthlyFees?.value;

describe('ambiguous fee text: conservative supported behavior', () => {
  it.each([
    'Required monthly Connectivity fee: $10 - $30.',
    'Required monthly Connectivity fee: varies with usage.',
    'Required monthly Connectivity fee: 2% of rent.',
    'Required Connectivity fee: $27 per week.',
    'Required Connectivity fee: $270 annually.',
    'Optional monthly Connectivity fee: $27.',
    'Connectivity fee: $27/month, not required.',
    'Connectivity fee: $27/month if selected.',
    'Late payment fee: $27 per occurrence.',
    'Required monthly Connectivity fee: $27 per person.',
  ])('does not turn %s into an exact required monthly charge', (text) => {
    expect(customAmount(text)).toBeUndefined();
  });
  it('does not fill a missing fee with the neighboring fee amount', () => {
    const e = prose(
      'Required monthly Connectivity fee: contact property; Required monthly Utility billing fee: $5.95.',
    );
    expect(e.namedRecurringFees?.map((f) => f.amount)).toEqual([5.95]);
    expect(
      e.feeNoteSuggestions?.find((n) =>
        n.evidence?.includes('Connectivity fee'),
      )?.detail,
    ).toContain('amount not listed');
  });
});

describe('fee qualifications and prepaid rent', () => {
  it('places first and last month rent in upfront rent inputs rather than omitting the cash needed to move in', () => {
    const e = prose(
      'First month rent due at signing: $2,000; Last month rent due at signing: $2,000.',
    );
    expect({
      first: e.listing.upfront.firstMonthsRent?.value,
      last: e.listing.upfront.lastMonthsRent?.value,
    }).toEqual({ first: 2000, last: 2000 });
  });
  it.each([
    'Required monthly Connectivity fee: up to $27.',
    'Required monthly Connectivity fee: starting at $27.',
    'Required monthly Connectivity fee: $27 CAD.',
    'Required monthly Connectivity fee: $27/year.',
  ])('must not automatically budget a qualified amount: %s', (text) => {
    expect(customAmount(text)).toBeUndefined();
  });
  it('keeps both endpoints of a fee range in the review note', () => {
    expect(
      prose('Required monthly Connectivity fee: $10 - $30.')
        .feeNoteSuggestions![0].detail,
    ).toContain('$10–$30');
  });
  it('keeps weekly frequency in the priced note', () => {
    expect(
      prose('Required Connectivity fee: $27 per week.').feeNoteSuggestions![0]
        .detail,
    ).toContain('weekly');
  });
  it('represents an explicitly free required monthly service as a known zero', () => {
    expect(customAmount('Required monthly Connectivity fee: free.')).toBe(0);
  });
  it('does not count a fee twice when the advertised total already includes it', () => {
    const e = extractListing(
      new JSDOM(
        '<main><p>Rent: $2,027/month, including all required monthly fees.</p><p>Required monthly Connectivity fee: $27 (included in the advertised total).</p></main>',
      ).window.document,
      new URL('https://example.com/rental'),
    );
    const a = applyExtraction(
      createInitialAnalysis('https://example.com/rental'),
      e,
    );
    const listing = materializeListing(a);
    expect(
      listing.recurring.advertisedRent!.value +
        (listing.recurring.otherRequiredMonthlyFees?.value ?? 0),
    ).toBe(2027);
  });
});
