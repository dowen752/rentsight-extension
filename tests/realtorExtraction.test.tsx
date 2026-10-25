// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { extractListing } from '../src/extractors';
import { captureListing } from '../src/ai/capture';
import { applyAiExtraction, adaptExtraction } from '../src/ai/adapter';
import type { ExtractionSuccess } from '../src/ai/types';
import {
  applyExtraction,
  createInitialAnalysis,
  materializeListing,
  setRecurringValue,
} from '../src/shared/analysis';
import {
  calculateEstimatedTrueMonthlyCost,
  calculateRequiredMoveInCash,
} from '../src/calculations';
import { AnalysisEditor } from '../src/sidepanel/App';
import { AiSourceReview } from '../src/sidepanel/AiExtractionCard';
import { exportListingsJson, importListingsJson } from '../src/saved/transfer';
import { createComparison } from '../src/saved/comparison';
import type { SavedListingRecord } from '../src/saved/types';

const urls = {
  slick:
    'https://www.realtor.com/rentals/details/5740-Slick-Rock-Ct_Boulder_CO_80301_M13999-22785',
  pearl:
    'https://www.realtor.com/rentals/details/3100-Pearl-Pkwy_Boulder_CO_80301_M22343-08275',
};
const fixture = (name: keyof typeof urls) =>
  new JSDOM(readFileSync(`tests/fixtures/realtor/${name}-live.html`, 'utf8'), {
    url: urls[name],
  }).window.document;
const extract = (html: string) =>
  extractListing(
    new JSDOM(`<div id="left-column-container">${html}</div>`).window.document,
    new URL(urls.slick),
  );
const row = (label: string, amount: string) =>
  `<div><div><div><p>${label}</p></div></div><div><p>${amount}</p></div></div>`;
const card = (required: string, optional = '', cadence = 'monthly') =>
  `<div data-testid="${cadence === 'monthly' ? 'monthly' : 'move-in'}-fees-card"><p>Fees</p><div><p>Required</p>${required}</div><div><p>Optional</p>${optional}</div><div><p>Estimated total</p><p>$9,999</p></div></div>`;
const aiResponse = () =>
  JSON.parse(
    readFileSync('tests/fixtures/ai/normal.response.json', 'utf8'),
  ) as ExtractionSuccess;

describe('Realtor listing extraction from live DOM recorded October 13, 2026', () => {
  it('reads the active house instead of background search results and splits monthly obligations', () => {
    const e = extractListing(fixture('slick'), new URL(urls.slick));
    expect(e.listing.identity.fullAddress?.value).toBe('5740 Slick Rock Ct');
    expect(e.listing.identity).toMatchObject({
      bedrooms: { value: 5 },
      bathrooms: { value: 3 },
      squareFootage: { value: 2184 },
    });
    expect(e.listing.recurring.advertisedRent?.value).toBe(3995);
    expect(e.listing.upfront.securityDeposit?.value).toBe(3995);
    expect(e.listing.recurring.petRent?.value).toBe(150);
    expect(e.namedRecurringFees?.map((f) => [f.label, f.amount])).toEqual([
      ['Resident Benefits Package (required)', 37],
      ['Utilities Admin Fee (required)', 10],
    ]);
    expect(e.feeNoteSuggestions).toEqual([]);
    const a = applyExtraction(createInitialAnalysis(urls.slick), e);
    const listing = materializeListing(a);
    expect(listing.recurring.otherRequiredMonthlyFees?.value).toBe(47);
    expect(
      calculateEstimatedTrueMonthlyCost(listing) -
        calculateEstimatedTrueMonthlyCost({
          ...listing,
          recurring: {
            ...listing.recurring,
            otherRequiredMonthlyFees: undefined,
          },
        }),
    ).toBe(47);
    expect(
      calculateRequiredMoveInCash(listing) -
        calculateRequiredMoveInCash({
          ...listing,
          upfront: { ...listing.upfront, securityDeposit: undefined },
        }),
    ).toBe(3995);
    const markup = renderToStaticMarkup(
      <AnalysisEditor analysis={a} update={() => undefined} />,
    );
    expect(markup).toContain('value="3995"');
    expect(markup).toContain('value="150"');
    expect(markup).toContain('Resident Benefits Package (required)');
    expect(
      renderToStaticMarkup(
        <AiSourceReview analysis={a} update={() => undefined} />,
      ),
    ).toBe('');
  });

  it('pairs card labels with amounts and keeps optional costs separate from required charges', () => {
    const e = extractListing(fixture('pearl'), new URL(urls.pearl));
    expect(e.namedRecurringFees?.map((f) => [f.label, f.amount])).toEqual([
      ['DWP (required)', 15],
      ['Utility Admin Fee (required)', 5.95],
      ['Valet Trash Service (required)', 21],
    ]);
    expect(e.rent).toMatchObject({
      kind: 'range',
      minimum: { value: 1858 },
      maximum: { value: 3960 },
    });
    expect(e.listing.recurring.advertisedRent).toBeUndefined();
    expect(e.listing.identity.bathrooms).toBeUndefined();
    expect(e.listing.recurring.petRent?.value).toBe(35);
    expect(e.listing.recurring.parking).toBeUndefined();
    expect(e.listing.upfront.applicationFee?.value).toBe(22);
    expect(e.listing.upfront.administrativeFee?.value).toBe(225);
    expect(e.listing.upfront.securityDeposit?.value).toBe(500);
    expect(e.feeNoteSuggestions?.map((n) => n.label)).toEqual([
      'Storage Unit',
      'Parking',
      'Parking Permit (Required for all Vehicles)',
      'Tandem Parking',
      'Package Management Setup Fee',
      'Annual Pet Screening',
    ]);
    expect(
      e.feeNoteSuggestions?.find((n) => n.label === 'Storage Unit')?.detail,
    ).toContain('$40/month');
    expect(
      e.feeNoteSuggestions?.find((n) => n.label === 'Parking')?.detail,
    ).toContain('$125/month');
    expect(
      e.feeNoteSuggestions?.find((n) => n.label === 'Parking')?.detail,
    ).toContain('per vehicle');
    expect(
      e.feeNoteSuggestions?.some((n) => /amount not listed/.test(n.detail)),
    ).toBe(false);
    const a = setRecurringValue(
      applyExtraction(createInitialAnalysis(urls.pearl), e),
      'advertisedRent',
      1858,
    );
    expect(
      materializeListing(a).recurring.otherRequiredMonthlyFees?.value,
    ).toBe(41.95);
  });

  it.each(['slick', 'pearl'] as const)(
    'captures %s coherent evidence without unrelated properties or fragmented facts',
    (name) => {
      const d = fixture(name);
      const e = extractListing(d, new URL(urls[name]));
      const capture = captureListing(d, e);
      const text = capture.capture.blocks.map((b) => b.text).join('\n');
      expect(text).not.toContain('Other Fee');
      expect(text).not.toContain('$999');
      expect(text).not.toContain('3100 Other St');
      const rows = capture.capture.blocks.filter(
        (b) => b.sectionPath[0] === 'Cost calculator',
      );
      if (name === 'slick') {
        expect(rows.map((b) => b.text)).toEqual([
          'Resident Benefits Package: $37',
          'Pet Rent: $150',
          'Utilities Admin Fee: $10',
        ]);
        expect(text).toContain('5 bed 3 bath');
        expect(text).toContain('$3,995 /mo');
        expect(text).not.toContain('$205');
        expect(text).toContain('Security Deposit: 3995.0');
      } else {
        expect(
          rows.find((b) => b.text === 'Utility Admin Fee $5.95')?.sectionPath,
        ).toEqual(['Cost calculator', 'Monthly costs', 'Required']);
        expect(
          rows
            .find((b) => b.text === 'Parking ($125 per vehicle) $125')
            ?.sectionPath.at(-1),
        ).toBe('Optional');
      }
    },
  );
});

describe('general Realtor fee layouts and workflow', () => {
  it('counts a named local service once when AI maps the same charge to a utility, preserving edits and deletions', () => {
    const local = applyExtraction(
      createInitialAnalysis(urls.slick),
      extract(card(row('Valet Trash Service', '$21'))),
    );
    const response = aiResponse();
    response.result.property.fees.value = [];
    const utility = structuredClone(
      response.result.property.utilities.value![0],
    );
    utility.id = 'valet';
    utility.label = 'Valet Trash Service';
    utility.kind = 'trash';
    utility.responsibility = {
      ...utility.responsibility,
      status: 'known',
      value: 'tenant_pays_landlord',
    };
    utility.applicability.kind = 'required';
    const amount = structuredClone(
      aiResponse().result.property.fees.value![0].amount,
    );
    amount.value = {
      ...amount.value!,
      frequency: 'monthly',
      minMinor: 2100,
      maxMinor: 2100,
    };
    utility.amount = amount;
    response.result.property.utilities.value = [utility];
    const a = applyAiExtraction(local, response);
    expect(a.customRecurringFees).toHaveLength(1);
    expect(a.listing.recurring.trash).toEqual(local.listing.recurring.trash);
    expect(
      materializeListing(a).recurring.otherRequiredMonthlyFees?.value,
    ).toBe(21);
    const edited = structuredClone(local);
    edited.customRecurringFees[0].amount = 25;
    edited.customRecurringFees[0].source = 'user';
    expect(
      applyAiExtraction(edited, response).customRecurringFees[0].amount,
    ).toBe(25);
    const removed = structuredClone(local);
    removed.userClearedFields = [`fee.${removed.customRecurringFees[0].id}`];
    removed.customRecurringFees = [];
    const refreshed = applyAiExtraction(removed, response);
    expect(refreshed.customRecurringFees).toEqual([]);
    expect(refreshed.listing.recurring.trash).toEqual(
      local.listing.recurring.trash,
    );
  });
  it.each([0, 5.95, 29.99])(
    'keeps exact monthly costs including %s and ignores repeated label amounts',
    (amount) => {
      const e = extract(
        card(row(`Connectivity Fee ($${amount})`, `$${amount}`)),
      );
      expect(e.namedRecurringFees?.map((f) => f.amount)).toEqual([amount]);
      expect(e.feeNoteSuggestions).toEqual([]);
    },
  );
  it('maps known utilities and fee categories without guessing variable amounts or charging optional selections', () => {
    const e = extract(
      card(
        row('Electric', '$45') +
          row('Trash Removal', '$20') +
          row('Resident Package', '$19') +
          row('Water/Sewer', 'Varies'),
        row('Storage', '$75') + row('Parking (Required for Vehicles)', '$100'),
      ),
    );
    expect(e.listing.recurring.electricity?.value).toBe(45);
    expect(e.listing.recurring.trash?.value).toBe(20);
    expect(e.namedRecurringFees?.map((f) => f.amount)).toEqual([19]);
    expect(e.feeNoteSuggestions?.map((n) => n.detail)).toEqual([
      'Optional · $75/month · not included in the estimate.',
      'Optional · $100/month · not included in the estimate.',
    ]);
  });
  it('splits inline fees without splitting thousands or decimals and does not mistake a one-time fee for monthly', () => {
    const e = extract(
      '<li>Monthly Fees: Resident Services: $1,250.50, Pet Rent: $45, Utility Billing Fee: $7.25</li>' +
        card(row('Administrative Fee', '$70'), '', 'one_time'),
    );
    expect(e.namedRecurringFees?.map((f) => f.amount)).toEqual([1250.5, 7.25]);
    expect(e.listing.recurring.petRent?.value).toBe(45);
    expect(e.listing.upfront.administrativeFee?.value).toBe(70);
  });
  it('keeps costs, edits, and real Keep/Dismiss decisions through saving and comparison', async () => {
    let a = setRecurringValue(
      applyExtraction(
        createInitialAnalysis(urls.slick),
        extract(
          card(
            row('Community Fee', '$28'),
            row('Storage', '$40') + row('Tandem Parking', '$175'),
          ),
        ),
      ),
      'advertisedRent',
      2000,
    );
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const update = (transform: (current: typeof a) => typeof a) => {
      a = transform(a);
    };
    await act(async () =>
      root.render(<AiSourceReview analysis={a} update={update} />),
    );
    const choices = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    await act(async () => choices[0].click());
    const buttons = container.querySelectorAll<HTMLButtonElement>('button');
    await act(async () => buttons[1].click());
    expect(a.propertyNotes[0].text).toContain('$40/month');
    expect(a.aiReviewDecisions?.['fee:tandem parking']).toBe('excluded');
    a.customRecurringFees[0] = {
      ...a.customRecurringFees[0],
      amount: 30,
      source: 'user',
    };
    const record: SavedListingRecord = {
      schemaVersion: 1,
      id: 'realtor-workflow',
      url: urls.slick,
      analysis: a,
      createdAt: a.updatedAt,
      updatedAt: a.updatedAt,
    };
    const restored = importListingsJson(exportListingsJson([record]))
      .records[0];
    expect(restored.analysis.customRecurringFees[0].amount).toBe(30);
    expect(restored.analysis.propertyNotes).toEqual(a.propertyNotes);
    const comparison = createComparison(restored);
    expect(comparison.trueMonthlyCost).toBe(
      calculateEstimatedTrueMonthlyCost(materializeListing(a)),
    );
    expect(comparison.notes[0].text).toContain('$40/month');
    await act(async () => root.unmount());
    container.remove();
  });
  it('keeps separate required AI monthly fees when refundability is unstated', () => {
    const r = aiResponse();
    const template = r.result.property.fees.value![0];
    r.result.property.fees.value = [
      'Resident Benefits Package',
      'Utilities Admin Fee',
    ].map((label, index) => ({
      ...structuredClone(template),
      id: String(index),
      label,
      category: index ? 'administration' : 'service',
      amount: {
        ...structuredClone(template.amount),
        value: {
          ...template.amount.value!,
          frequency: 'monthly',
          minMinor: index ? 1000 : 3700,
          maxMinor: index ? 1000 : 3700,
        },
      },
      refundable: {
        ...structuredClone(template.refundable),
        status: 'unknown',
        value: null,
      },
    }));
    const adapted = adaptExtraction(r);
    expect(adapted.extraction.namedRecurringFees?.map((f) => f.amount)).toEqual(
      [37, 10],
    );
    expect(adapted.manualCharges).toEqual([]);
    const a = applyAiExtraction(createInitialAnalysis(urls.slick), r);
    expect(
      materializeListing(a).recurring.otherRequiredMonthlyFees?.value,
    ).toBe(47);
  });
});
