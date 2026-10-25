import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { extractListing } from '../src/extractors';
import {
  applyExtraction,
  createInitialAnalysis,
  decidePropertyNote,
  materializeListing,
} from '../src/shared/analysis';
import { calculateEstimatedTrueMonthlyCost } from '../src/calculations';
import { applyAiExtraction } from '../src/ai/adapter';
import type { ExtractionSuccess } from '../src/ai/types';
import { AiSourceReview } from '../src/sidepanel/AiExtractionCard';
import { AnalysisEditor } from '../src/sidepanel/App';
import { exportListingsJson, importListingsJson } from '../src/saved/transfer';
import { createComparison } from '../src/saved/comparison';
import type { SavedListingRecord } from '../src/saved/types';

const url = 'https://hotpads.com/100-example-ave';
const extraction = (text: string) =>
  extractListing(
    new JSDOM(`<main><p>$2,000/mo</p>${text}</main>`).window.document,
    new URL(url),
  );
const analysis = (text: string) =>
  applyExtraction(createInitialAnalysis(url, 'Example'), extraction(text));

describe('named fee and property note workflow', () => {
  it.each([
    '<section><h2>Fees</h2><ul><li>Garage Parking</li></ul></section>',
    '<section aria-label="Fees"><p>Garage Parking</p></section>',
    '<section class="fees"><p>Garage Parking</p></section>',
    '<section><h2>Fees</h2><table><tbody><tr><td>Garage Parking</td><td></td></tr></tbody></table></section>',
    '<p>Garage Parking</p>',
    '<section><h2>Fees and amenities</h2><p>Garage Parking</p></section>',
  ])(
    'preserves an unpriced potential charge in fee or ambiguous context: %s',
    (html) => {
      const a = analysis(html);
      expect(a.extraction?.feeNoteSuggestions).toHaveLength(1);
      expect(a.extraction?.feeNoteSuggestions![0].label).toBe('Garage Parking');
      expect(a.extraction?.feeNoteSuggestions![0].detail).toContain(
        'amount not listed',
      );
      expect(materializeListing(a).recurring.parking).toBeUndefined();
    },
  );
  it('only filters bare amenities in a recognizable amenity section', () => {
    const a = analysis(
      '<section><h2>Amenities</h2><p>Garage Parking</p><p>Valet Trash</p></section>',
    );
    expect(a.extraction?.feeNoteSuggestions).toEqual([]);
  });

  it('ignores unpriced amenities without erasing priced fees or hiding explicit unknown charges', () => {
    const a = analysis(`<p>Required monthly parking fee: $75.</p>
      <h2>More about this unit</h2><ul>
      <li>Valet Trash</li><li>Valet Trash pick-up</li>
      <li>Private Resident Garage Parking</li><li>Pest Control</li>
      <li>Resident Benefits</li></ul>
      <p>Storage fee: contact property for pricing.</p>
      <p>Optional carport: $40/month.</p>`);
    expect(a.listing.recurring.parking?.value).toBe(75);
    expect(a.extraction?.feeNoteSuggestions).toHaveLength(2);
    expect(a.extraction?.feeNoteSuggestions?.map((note) => note.label)).toEqual(
      ['Storage fee', 'carport'],
    );
    const kept = decidePropertyNote(
      a,
      a.extraction!.feeNoteSuggestions![0],
      true,
      'listing',
    );
    const record = importListingsJson(
      exportListingsJson([
        {
          schemaVersion: 1,
          id: 'amenities',
          url,
          analysis: kept,
          createdAt: kept.updatedAt,
          updatedAt: kept.updatedAt,
        },
      ]),
    ).records[0];
    expect(createComparison(record).parking).toBe(75);
    expect(record.analysis.propertyNotes).toHaveLength(1);
  });

  it.each([
    'utility billing fee',
    'resident services fee',
    'pest control charge',
    'valet trash charge',
    'mandatory service package',
  ])('adds a required monthly %s as a named editable input', (label) => {
    const a = analysis(`<p>Required monthly ${label}: $25.</p>`);
    expect(a.customRecurringFees).toHaveLength(1);
    expect(a.customRecurringFees[0]).toMatchObject({
      label: `${label.replace(/^mandatory /, '')} (required)`,
      amount: 25,
      source: 'listing',
    });
    expect(a.listing.recurring.otherRequiredMonthlyFees).toBeUndefined();
    expect(
      materializeListing(a).recurring.otherRequiredMonthlyFees?.value,
    ).toBe(25);
    const markup = renderToStaticMarkup(
      <AnalysisEditor analysis={a} update={() => undefined} />,
    );
    expect(markup).toContain(`${label.replace(/^mandatory /, '')} (required)`);
    expect(markup).toContain('value="25"');
  });
  it.each([
    'Required monthly resident services fee; contact property for amount.',
    'Optional monthly storage fee: $40.',
    'Late payment penalty fee: $50 per occurrence.',
    'Utility billing fee: $10.',
    'Monthly service fee: $10.',
    'Monthly service fee: $10, not required.',
    'Required monthly service fee: varies.',
  ])('suggests a note without increasing costs: %s', (text) => {
    const a = analysis(`<p>${text}</p>`);
    expect(a.customRecurringFees).toEqual([]);
    expect(a.extraction?.feeNoteSuggestions).toHaveLength(1);
    const before = calculateEstimatedTrueMonthlyCost(materializeListing(a));
    const note = a.extraction!.feeNoteSuggestions![0];
    const kept = decidePropertyNote(a, note, true, 'listing');
    expect(note.evidence).toContain(text.split(';')[0].replace(/\.$/, ''));
    expect(kept.propertyNotes[0].text.length).toBeLessThan(240);
    expect(calculateEstimatedTrueMonthlyCost(materializeListing(kept))).toBe(
      before,
    );
    const html = renderToStaticMarkup(
      <AiSourceReview analysis={kept} update={() => undefined} />,
    );
    expect(html).toContain('checked');
    expect(html).toContain('Dismiss');
  });
  it('preserves named-fee edits and removals across repeated local and AI extraction', () => {
    const e = extraction('<p>Required monthly Resident service fee: $25.</p>');
    const a = applyExtraction(createInitialAnalysis(url, 'Example'), e);
    const fee = a.customRecurringFees[0];
    const edited = {
      ...a,
      customRecurringFees: [
        {
          ...fee,
          label: 'My service fee',
          amount: 20,
          source: 'user' as const,
        },
      ],
    };
    expect(applyExtraction(edited, e).customRecurringFees[0].amount).toBe(20);
    const response = JSON.parse(
      readFileSync('tests/fixtures/ai/normal.response.json', 'utf8'),
    ) as ExtractionSuccess;
    const wireFee = response.result.property.fees.value![0];
    wireFee.label = 'Resident service fee';
    wireFee.category = 'service';
    wireFee.amount.value!.frequency = 'monthly';
    wireFee.amount.value!.minMinor = wireFee.amount.value!.maxMinor = 2500;
    wireFee.refundable.value = false;
    const enriched = applyAiExtraction(a, response);
    expect(enriched.customRecurringFees).toHaveLength(1);
    expect(
      materializeListing(enriched).recurring.otherRequiredMonthlyFees?.value,
    ).toBe(25);
    expect(
      applyAiExtraction(edited, response).customRecurringFees[0].amount,
    ).toBe(20);
    const removed = {
      ...a,
      customRecurringFees: [],
      userClearedFields: [`fee.${fee.id}`],
    };
    expect(applyExtraction(removed, e).customRecurringFees).toEqual([]);
    expect(applyAiExtraction(removed, response).customRecurringFees).toEqual(
      [],
    );
    expect(
      materializeListing(applyAiExtraction(removed, response)).recurring
        .otherRequiredMonthlyFees,
    ).toBeUndefined();
  });
  it('reads individual fee rows instead of a calculator wrapper and produces one concise note', () => {
    const e = extraction(
      `<div class="fee-row"><h2>Monthly costs</h2><div><span>Required</span><div class="fee-row">Rent $2,595 Based on a 6-month lease and includes fixed required monthly fees</div></div><div><span>Optional</span><div class="fee-row"><span>Carport parking fee ($125)</span><span data-testid="fee-total">$0</span></div><div class="fee-row"><span>Carport parking fee ($125)</span><span data-testid="fee-total">$0</span></div></div><p>Est. total monthly cost $2,595</p></div>`,
    );
    expect(e.feeNoteSuggestions).toHaveLength(1);
    const note = e.feeNoteSuggestions![0];
    expect(note.label).toBe('Carport parking fee');
    expect(note.detail).toBe(
      'Optional · $125/month · not included in the estimate.',
    );
    expect(note.evidence).toContain('($125)');
    expect(note.detail).not.toContain('6-month');
    expect(note.label).not.toContain('Rent');
  });
  it('keeps an explicitly free required service as a known zero cost', () => {
    const a = analysis('<p>Required monthly Service fee: $0.</p>');
    expect(a.customRecurringFees[0].amount).toBe(0);
    expect(
      materializeListing(a).recurring.otherRequiredMonthlyFees?.value,
    ).toBe(0);
  });
  it('retains a local fee when AI has no information about it', () => {
    const a = analysis('<p>Required monthly Resident service fee: $25.</p>');
    const response = JSON.parse(
      readFileSync('tests/fixtures/ai/normal.response.json', 'utf8'),
    ) as ExtractionSuccess;
    response.result.property.fees.status = 'unknown';
    response.result.property.fees.value = null;
    const enriched = applyAiExtraction(a, response);
    expect(enriched.customRecurringFees[0].amount).toBe(25);
    expect(
      materializeListing(enriched).recurring.otherRequiredMonthlyFees?.value,
    ).toBe(25);
  });
  it('keeps optional parking as a note rather than a recurring cost', () => {
    const a = analysis('<p>Optional parking fee: $50/month.</p>');
    expect(a.listing.recurring.parking).toBeUndefined();
    expect(a.extraction?.feeNoteSuggestions).toHaveLength(1);
  });
  it('preserves the sum of separate AI charges with the same display name', () => {
    const response = JSON.parse(
      readFileSync('tests/fixtures/ai/normal.response.json', 'utf8'),
    ) as ExtractionSuccess;
    const fee = response.result.property.fees.value![0];
    fee.category = 'service';
    fee.label = 'Resident service fee';
    fee.refundable.value = false;
    fee.amount.value!.frequency = 'monthly';
    fee.amount.value!.minMinor = fee.amount.value!.maxMinor = 1000;
    const second = structuredClone(fee);
    second.id = 'second-service';
    second.amount.value!.minMinor = second.amount.value!.maxMinor = 500;
    response.result.property.fees.value!.push(second);
    const enriched = applyAiExtraction(
      createInitialAnalysis(url, 'Example'),
      response,
    );
    expect(enriched.customRecurringFees).toHaveLength(1);
    expect(
      materializeListing(enriched).recurring.otherRequiredMonthlyFees?.value,
    ).toBe(15);
  });
  it('persists note decisions, edited notes, and named fees through transfer and comparison', () => {
    const e = extraction(
      '<p>Required monthly Resident service fee: $25.</p><p>Optional monthly Storage fee: $40.</p><p>Late payment penalty fee: $50.</p>',
    );
    const a = applyExtraction(createInitialAnalysis(url, 'Example'), e);
    const [storage, penalty] = a.extraction!.feeNoteSuggestions!;
    let kept = decidePropertyNote(a, storage, true, 'listing');
    kept.propertyNotes[0].text = 'Ask whether storage is available.';
    kept = decidePropertyNote(kept, penalty, false, 'listing');
    const refreshed = applyExtraction(kept, e);
    expect(refreshed.propertyNotes[0].text).toBe(
      'Ask whether storage is available.',
    );
    const html = renderToStaticMarkup(
      <AiSourceReview analysis={refreshed} update={() => undefined} />,
    );
    expect(html).not.toContain('Late payment penalty');
    const record: SavedListingRecord = {
      schemaVersion: 1,
      id: 'notes',
      url,
      analysis: refreshed,
      createdAt: refreshed.updatedAt,
      updatedAt: refreshed.updatedAt,
    };
    const imported = importListingsJson(exportListingsJson([record]));
    expect(imported.errors).toEqual([]);
    const comparison = createComparison(imported.records[0]);
    expect(comparison.notes[0].text).toBe('Ask whether storage is available.');
    expect(comparison.trueMonthlyCost).toBe(
      calculateEstimatedTrueMonthlyCost(materializeListing(refreshed)),
    );
    expect(imported.records[0].analysis.aiReviewDecisions?.[penalty.id]).toBe(
      'excluded',
    );
  });
});
