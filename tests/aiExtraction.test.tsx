import { isRentalAnalysis } from '../src/saved/migrations';
import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { captureListing } from '../src/ai/capture';
import { acceptResponse, assertRequest } from '../src/ai/validation';
import {
  applyAiExtraction,
  adaptExtraction,
  retainPreliminaryAfterAiFailure,
} from '../src/ai/adapter';
import { ExtractionSession } from '../src/ai/session';
import {
  ChromeExtractionCache,
  EXTRACTION_TERMINAL_MAX_ENTRIES,
  EXTRACTION_TERMINAL_TTL_MS,
  type ExtractionCache,
  type TerminalExtractionState,
} from '../src/ai/cache';
import { listingCacheIdentity, listingCacheKey } from '../src/ai/identity';
import { RentSightBackendClient } from '../src/backend/client';
import {
  AiExtractionCard,
  AiSourceReview,
} from '../src/sidepanel/AiExtractionCard';
import {
  formatReviewIssue,
  shouldShowReviewIssue,
  shouldSuggestPropertyNote,
} from '../src/sidepanel/reviewIssueLabels';
import { AnalysisEditor } from '../src/sidepanel/App';
import {
  createInitialAnalysis,
  applyExtraction,
  setRecurringValue,
  clearField,
  setUtilityIncluded,
  materializeListing,
  applyHouseholdProfile,
  setIdentityValue,
} from '../src/shared/analysis';
import { emptyExtraction } from '../src/extractors/types';
import { compactAnalysisForStorage } from '../src/saved/repository';
import type { ExtractionRequest, ExtractionSuccess } from '../src/ai/types';
import type { PageInfo } from '../src/shared/messages';
const fixture = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/ai/${name}.json`, import.meta.url),
      'utf8',
    ),
  );
const normal = () => fixture('normal.response') as ExtractionSuccess;
const request = () => fixture('normal.request') as ExtractionRequest;
const page = (): PageInfo => ({
  url: request().identity.listingUrl,
  title: 'Pine Court',
  appearsToBeRentalListing: true,
  selectedUnitId: '204',
  aiCapture: {
    capture: request().capture,
    preliminaryValues: request().preliminaryValues,
    captureRevision: 'capture-1',
    selectedLeaseTermMonths: 12,
  },
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('shared extraction contract', () => {
  for (const name of readdirSync(
    new URL('./fixtures/ai/', import.meta.url),
  ).filter((name) => name.endsWith('.response.json'))) {
    it(`accepts the backend fixture ${name}`, () => {
      const base = name.replace('.response.json', '');
      const req = fixture(`${base}.request`);
      assertRequest(req);
      expect(acceptResponse(fixture(`${base}.response`), req)).toEqual(
        fixture(`${base}.response`),
      );
    });
  }
  it('rejects missing fields, fabricated evidence, invalid money, and stale identity', () => {
    for (const mutate of [
      (r: ExtractionSuccess) => {
        Reflect.deleteProperty(r.result.property, 'fees');
      },
      (r: ExtractionSuccess) => {
        r.result.evidence[0].quote = 'Invented source';
      },
      (r: ExtractionSuccess) => {
        r.result.property.baseRent.value!.maxMinor = 1;
      },
      (r: ExtractionSuccess) => {
        r.identity.captureRevision = 'old';
      },
      (r: ExtractionSuccess) => {
        r.identity.selectedLeaseTermMonths = 18;
      },
      (r: ExtractionSuccess) => {
        r.result.property.fees.status = 'unknown';
      },
      (r: ExtractionSuccess) => {
        r.result.notes[0].fieldPaths = ['/property/missing'];
      },
    ]) {
      const response = normal();
      mutate(response);
      expect(() => acceptResponse(response, request())).toThrow();
    }
  });
  it('requires the 1.1.0 component contract and rejects the removed address field', () => {
    expect(request().schemaVersion).toBe('1.1.0');
    expect(normal().schemaVersion).toBe('1.1.0');
    const response = normal() as ExtractionSuccess & {
      result: { property: Record<string, unknown> };
    };
    response.result.property.address = response.result.property.streetAddress;
    expect(() => acceptResponse(response, request())).toThrow();
  });
});

describe('capture and adapter', () => {
  it('preserves JSON-LD, tables, conditions, and omits forms and navigation', () => {
    const document = new JSDOM(
      '<script type="application/ld+json">{"priceCurrency":"USD"}</script><main><nav>Unrelated rent</nav><h1>Pine Court</h1><p>Monthly rent $2400</p><table><tr><th>Fee</th><th>Amount</th></tr><tr><td>Deposit</td><td>$1000</td></tr></table><small>Promotion requires 14 months.</small><form><input value="secret"><p>Private account</p></form></main>',
    ).window.document;
    const capture = captureListing(document, emptyExtraction('Test', '1'));
    const text = capture.capture.blocks.map((block) => block.text).join('\n');
    expect(text).toContain('priceCurrency');
    expect(text).toContain('| Deposit | $1000 |');
    expect(text).toContain('14 months');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('Private account');
    expect(text).not.toContain('Unrelated');
  });
  it('captures Zillow calculator rows atomically with applicability context', () => {
    const document = new JSDOM(`
      <main><div id="monthly-section"><div class="optional-group">
        <div class="pet-rent-fee fee-row">
          <span>Pet Rent ($30 per pet)</span><button>Help</button><span>$0</span>
        </div>
      </div></div></main>
    `).window.document;
    const capture = captureListing(document, emptyExtraction('Zillow', '1'));
    const row = capture.capture.blocks.find((block) =>
      block.text.includes('Pet Rent'),
    );
    expect(row).toMatchObject({
      text: 'Pet Rent ($30 per pet) $0',
      sectionPath: ['Cost calculator', 'Monthly costs', 'Optional'],
    });
    expect(row?.text).not.toContain('Help');
  });
  it('prunes noisy JSON-LD while preserving extraction fields', () => {
    const document = new JSDOM(
      `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Apartment',
        name: 'Pine Court',
        address: { streetAddress: '100 Main St' },
        offers: { price: 2400, priceCurrency: 'USD' },
        image: ['large-photo-url', 'another-photo-url'],
        aggregateRating: { ratingValue: 4.8 },
        review: [{ reviewBody: 'long review copy' }],
        sameAs: ['social-profile'],
      })}</script><main><p>Deposit $1,000. Promotion requires 14 months.</p></main>`,
    ).window.document;
    const text = captureListing(
      document,
      emptyExtraction('Test', '1'),
    ).capture.blocks.find((block) => block.kind === 'json_ld')!.text;
    expect(text).toContain('Pine Court');
    expect(text).toContain('streetAddress');
    expect(text).toContain('priceCurrency');
    expect(text).not.toContain('large-photo-url');
    expect(text).not.toContain('long review copy');
    expect(text).not.toContain('social-profile');
  });
  it('deduplicates normalized blocks only within the same evidence context', () => {
    const document = new JSDOM(
      '<main><h2>Unit A</h2><p>Rent $2,400 monthly</p><p> Rent   $2,400 monthly </p><h2>Unit B</h2><p>Rent $2,400 monthly</p></main>',
    ).window.document;
    const paragraphs = captureListing(
      document,
      emptyExtraction('Test', '1'),
    ).capture.blocks.filter((block) => block.kind === 'paragraph');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.map((block) => block.sectionPath.at(-1))).toEqual([
      'Unit A',
      'Unit B',
    ]);
  });
  it('captures a portaled unit table without contact-form dates', () => {
    const document = new JSDOM(`
      <main><p>Property details</p></main>
      <div role="dialog" aria-modal="true">
        <h3>2BR/1BA</h3>
        <div data-testid="modal-body">
          <table><tr><th>Price</th><th>Sqft</th></tr><tr><td>$845</td><td>660 sqft</td></tr></table>
        </div>
        <form><span>Date: 10/01/26</span><input value="10/01/2026"></form>
      </div>
    `).window.document;

    const blocks = captureListing(document, emptyExtraction('Test', '1'))
      .capture.blocks;
    expect(blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '2BR/1BA' }),
        expect.objectContaining({
          text: '| Price | Sqft |\n| $845 | 660 sqft |',
        }),
      ]),
    );
    expect(blocks.map((block) => block.text).join(' ')).not.toContain(
      '10/01/26',
    );
  });
  it('deduplicates whitespace and dash variants while preserving the first text and ID', () => {
    const document = new JSDOM(
      '<main><h2>Pricing</h2><p>Rent  $2,400 – 12 months</p><p>Rent $2,400 - 12 months</p><p>Deposit $500</p></main>',
    ).window.document;
    const blocks = captureListing(document, emptyExtraction('Test', '1'))
      .capture.blocks;
    const rent = blocks.filter((block) => block.text.startsWith('Rent'));
    expect(rent).toEqual([
      expect.objectContaining({
        id: 'block-2',
        kind: 'paragraph',
        text: 'Rent  $2,400 – 12 months',
      }),
    ]);
    expect(blocks.at(-1)).toMatchObject({
      id: 'block-4',
      text: 'Deposit $500',
    });
    expect(new Set(blocks.map((block) => block.id)).size).toBe(blocks.length);
  });
  it('keeps equivalent text in structurally distinct block kinds and is deterministic', () => {
    const html =
      '<main><h2>Fees</h2><p>Deposit $500</p><small>Deposit $500</small><table><tr><td>Deposit $500</td></tr></table></main>';
    const first = captureListing(
      new JSDOM(html).window.document,
      emptyExtraction('Test', '1'),
    ).capture.blocks;
    const second = captureListing(
      new JSDOM(html).window.document,
      emptyExtraction('Test', '1'),
    ).capture.blocks;
    expect(
      first.map(({ id, kind, sectionPath, text }) => ({
        id,
        kind,
        sectionPath,
        text,
      })),
    ).toEqual(
      second.map(({ id, kind, sectionPath, text }) => ({
        id,
        kind,
        sectionPath,
        text,
      })),
    );
    expect(
      first.filter((block) => block.text.includes('Deposit $500')),
    ).toHaveLength(3);
  });
  it('removes structural boilerplate without removing listing disclosures', () => {
    const document = new JSDOM(
      '<header>Site header rent links</header><aside>Related homes</aside><div class="cookie-banner">Cookie preferences</div><div class="chat-widget">Chat with us</div><main><h1>Pine Court</h1><p>Rent $2,400 monthly</p><small>Promotion requires a 14-month lease.</small></main><footer>Copyright and privacy</footer>',
    ).window.document;
    const text = captureListing(document, emptyExtraction('Test', '1'))
      .capture.blocks.map((block) => block.text)
      .join('\n');
    expect(text).toContain('Rent $2,400 monthly');
    expect(text).toContain('14-month lease');
    expect(text).not.toContain('Cookie preferences');
    expect(text).not.toContain('Chat with us');
    expect(text).not.toContain('Related homes');
  });
  it('preserves semantic listing facts inside buttons without capturing CTAs or duplicates', () => {
    const document = new JSDOM(`
      <main>
        <button>
          <div data-testid="bed-bath-sqft-facts">
            <span>4</span><span>beds</span><span>3</span><span>baths</span><span>2,986</span><span>sqft</span>
          </div>
        </button>
        <div aria-label="Bed bath sqft facts">
          <span>4</span><span>beds</span><span>3</span><span>baths</span><span>2,986</span><span>sqft</span>
        </div>
        <button>Apply now</button>
      </main>
    `).window.document;

    const blocks = captureListing(document, emptyExtraction('Test', '1'))
      .capture.blocks;
    expect(
      blocks.filter((block) => block.text === '4 beds 3 baths 2,986 sqft'),
    ).toHaveLength(1);
    expect(blocks.map((block) => block.text).join('\n')).not.toContain(
      'Apply now',
    );
  });
  it('marks oversized captures as truncated and remains below request limits', () => {
    const document = new JSDOM(
      `<main>${'<p>🏠'.repeat(210)}${'x'.repeat(210000)}</p></main>`,
    ).window.document;
    const context = captureListing(document, emptyExtraction('Test', '1'));
    expect(context.capture.truncated).toBe(true);
    assertRequest({
      ...request(),
      capture: context.capture,
      preliminaryValues: context.preliminaryValues,
    });
  });
  it('enriches preliminary facts while preserving unknowns, overrides, and deletions', () => {
    const local = emptyExtraction('Local', '1');
    local.listing.recurring.advertisedRent = {
      value: 2200,
      source: 'listing',
      confidence: 0.7,
    };
    local.listing.upfront.applicationFee = {
      value: 99,
      source: 'listing',
      confidence: 0.7,
    };
    let current = applyExtraction(createInitialAnalysis(page().url), local);
    current = setRecurringValue(current, 'advertisedRent', 2500);
    current = clearField(current, 'upfront', 'securityDeposit');
    current = setUtilityIncluded(current, 'water', false);
    const next = applyAiExtraction(current, normal());
    expect(next.baseline.recurring.advertisedRent?.value).toBe(2400);
    expect(next.listing.recurring.advertisedRent).toEqual({
      value: 2500,
      source: 'user',
      confidence: 1,
    });
    expect(next.listing.upfront.applicationFee).toMatchObject({
      value: 99,
      source: 'location_estimate',
    });
    expect(next.baseline.upfront.securityDeposit?.value).toBe(1000);
    expect(next.listing.upfront.securityDeposit).toBeUndefined();
    expect(next.utilityIncluded.water).toBe(false);
    expect(compactAnalysisForStorage(next).aiExtraction).toEqual(normal());
    expect(JSON.stringify(next)).not.toContain('"blocks"');
  });
  it('maps known address components independently and preserves component edits', () => {
    const response = normal();
    response.result.property.country = {
      status: 'unknown',
      value: null,
      candidates: [],
      scope: 'unknown',
      evidenceIds: [],
    };
    response.result.property.streetAddress = {
      status: 'conflict',
      value: null,
      candidates: ['100 Example Avenue', '102 Example Avenue'],
      scope: 'building',
      evidenceIds: ['e2'],
    };
    let current = createInitialAnalysis(page().url);
    current = setIdentityValue(current, 'city', 'Customer City');
    const next = applyAiExtraction(current, response);
    expect(next.listing.identity.fullAddress).toBeUndefined();
    expect(next.listing.identity.city).toMatchObject({
      value: 'Customer City',
      source: 'user',
    });
    expect(next.listing.identity.state?.value).toBe('CA');
    expect(next.listing.identity.zipCode?.value).toBe('90000');
  });
  it('replaces known rent while preserving an AI-unknown local bathroom', () => {
    const local = emptyExtraction('Local', '1');
    local.listing.recurring.advertisedRent = {
      value: 2200,
      source: 'listing',
      confidence: 0.7,
    };
    local.listing.identity.bathrooms = {
      value: 1,
      source: 'listing',
      confidence: 0.7,
    };
    const response = normal();
    response.result.property.bathrooms = {
      status: 'unknown',
      value: null,
      candidates: [],
      scope: 'unknown',
      evidenceIds: [],
    };
    const current = applyExtraction(createInitialAnalysis(page().url), local);
    const next = applyAiExtraction(current, response);
    expect(next.listing.recurring.advertisedRent).toMatchObject({
      value: 2400,
      source: 'listing',
    });
    expect(next.listing.identity.bathrooms).toMatchObject({
      value: 1,
      source: 'location_estimate',
    });
  });
  it('keeps failed-extraction preliminary values as local estimates', () => {
    const local = emptyExtraction('Local', '1');
    local.listing.identity.bathrooms = {
      value: 1,
      source: 'listing',
      confidence: 0.7,
    };
    const current = applyExtraction(createInitialAnalysis(page().url), local);
    const next = retainPreliminaryAfterAiFailure(current);
    expect(next.listing.identity.bathrooms).toMatchObject({
      value: 1,
      source: 'location_estimate',
    });
  });
  it('emits preliminary address hints at component paths', () => {
    const extraction = emptyExtraction('Test', '1');
    extraction.listing.identity.fullAddress = {
      value: '100 Example Avenue',
      source: 'listing',
      confidence: 1,
    };
    extraction.listing.identity.city = {
      value: 'Example City',
      source: 'listing',
      confidence: 1,
    };
    extraction.listing.identity.state = {
      value: 'CA',
      source: 'listing',
      confidence: 1,
    };
    extraction.listing.identity.zipCode = {
      value: '90000',
      source: 'listing',
      confidence: 1,
    };
    const document = new JSDOM('<main><h1>Example</h1></main>').window.document;
    const paths = captureListing(document, extraction).preliminaryValues.map(
      (hint) => hint.fieldPath,
    );
    expect(paths).toEqual([
      '/property/streetAddress',
      '/property/city',
      '/property/region',
      '/property/postalCode',
    ]);
    expect(paths).not.toContain('/property/address');
  });
  it('preserves extracted utility amounts through household setup and calculations', () => {
    const response = normal();
    const utility = response.result.property.utilities.value![1];
    utility.amount = {
      ...response.result.property.baseRent,
      value: {
        ...response.result.property.baseRent.value!,
        minMinor: 7500,
        maxMinor: 7500,
      },
    };
    let next = applyAiExtraction(createInitialAnalysis(page().url), response);
    next = applyHouseholdProfile(next, next.householdProfile);
    expect(materializeListing(next).recurring.electricity?.value).toBe(75);
    next = clearField(next, 'recurring', 'electricity');
    expect(materializeListing(next).recurring.electricity).toBeUndefined();
  });
  it('rejects malformed AI snapshots during saved-listing import', () => {
    const next = applyAiExtraction(createInitialAnalysis(page().url), normal());
    expect(isRentalAnalysis(compactAnalysisForStorage(next))).toBe(true);
    Reflect.deleteProperty(next.aiExtraction!.result.property, 'utilities');
    expect(isRentalAnalysis(next)).toBe(false);
  });
  it('requires review when deposit refundability is unknown', () => {
    const response = normal();
    response.result.property.fees.value![0].refundable = {
      status: 'unknown',
      value: null,
      candidates: [],
      scope: 'unknown',
      evidenceIds: [],
    };
    expect(
      adaptExtraction(response).extraction.listing.upfront.securityDeposit,
    ).toBeUndefined();
    expect(adaptExtraction(response).manualCharges[0].id).toBe(
      'fee:security-deposit',
    );
  });
  it('maps per-pet fees and per-applicant charges into distinct inputs', () => {
    const response = normal();
    const template = response.result.property.fees.value![0];
    response.result.property.fees.value = [
      {
        ...structuredClone(template),
        id: 'application',
        label: 'Application fee',
        category: 'application',
        amount: {
          ...structuredClone(template.amount),
          value: {
            ...template.amount.value!,
            minMinor: 5_500,
            maxMinor: 5_500,
            basis: 'per_person',
          },
        },
        refundable: { ...structuredClone(template.refundable), value: false },
      },
      {
        ...structuredClone(template),
        id: 'pet-rent',
        label: 'Pet rent',
        category: 'pet_rent',
        amount: {
          ...structuredClone(template.amount),
          value: {
            ...template.amount.value!,
            minMinor: 3_000,
            maxMinor: 3_000,
            frequency: 'monthly',
            basis: 'per_pet',
          },
        },
        refundable: { ...structuredClone(template.refundable), value: false },
        applicability: {
          ...structuredClone(template.applicability),
          kind: 'optional',
          conditions: ['Applies when the household has a qualifying pet.'],
        },
      },
      {
        ...structuredClone(template),
        id: 'pet-fee',
        label: 'Pet fee',
        category: 'pet_fee',
        amount: {
          ...structuredClone(template.amount),
          value: {
            ...template.amount.value!,
            minMinor: 30_000,
            maxMinor: 30_000,
            basis: 'per_pet',
          },
        },
        refundable: { ...structuredClone(template.refundable), value: false },
        applicability: {
          ...structuredClone(template.applicability),
          kind: 'conditional',
          conditions: ['Applies when the household has a qualifying pet.'],
        },
      },
    ];

    const adapted = adaptExtraction(response).extraction.listing;
    expect(adapted.upfront.applicationFee?.value).toBe(55);
    expect(adapted.recurring.petRent?.value).toBe(30);
    expect(adapted.upfront.petFee?.value).toBe(300);
    expect(adaptExtraction(response).manualCharges).toHaveLength(0);
  });
  it('keeps unknowns and ranges out of fixed amounts and defers conditional promotions', () => {
    expect(
      adaptExtraction(fixture('rent-range.response')).extraction.listing
        .recurring.advertisedRent,
    ).toBeUndefined();
    expect(
      adaptExtraction(fixture('unknown-fees.response')).extraction.listing
        .upfront,
    ).toEqual({});
    const promotion = adaptExtraction(
      fixture('conditional-promotion.response'),
    );
    expect(promotion.manualCharges.length).toBeGreaterThan(0);
    expect(
      promotion.extraction.listing.concessions?.monthsFree,
    ).toBeUndefined();
    const response = normal();
    response.result.property.baseRent.scope = 'building';
    expect(
      adaptExtraction(response).extraction.listing.recurring.advertisedRent,
    ).toBeUndefined();
  });
});

describe('transport and session', () => {
  it('uses Firebase bearer authentication and the frozen idempotency key', async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(normal()), { status: 200 }),
    );
    const client = new RentSightBackendClient({
      apiOrigin: 'https://api.example.com',
      getAccessToken: async () => 'test-token',
      fetch: fetcher,
    });
    await client.extractListing(request());
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.com/v1/listings/extract',
      expect.objectContaining({
        body: JSON.stringify(request()),
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'Idempotency-Key': request().identity.requestId,
        }),
      }),
    );
  });
  it('does not spend another request on repeated account refreshes for the same capture', async () => {
    const client = {
      extractListing: vi.fn(async (req: ExtractionRequest) => ({
        ...normal(),
        identity: req.identity,
      })),
    };
    const session = new ExtractionSession(client, vi.fn());
    session.activate(page(), 'account-1');
    await tick();
    session.activate(page(), 'account-1');
    expect(client.extractListing).toHaveBeenCalledTimes(1);
    session.activate(page(), 'account-2');
    await tick();
    expect(client.extractListing).toHaveBeenCalledTimes(2);
  });
  it('allows only one active request for rapid repeated submissions', async () => {
    const client = {
      extractListing: vi.fn(
        () => new Promise<ExtractionSuccess>(() => undefined),
      ),
    };
    const session = new ExtractionSession(client, vi.fn());
    session.start(page());
    session.start(page());
    session.start(page());
    expect(client.extractListing).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().status).toBe('extracting');
  });
  it('does not apply late responses, even on the same URL', async () => {
    const resolvers: ((response: ExtractionSuccess) => void)[] = [];
    const requests: ExtractionRequest[] = [];
    const apply = vi.fn();
    const session = new ExtractionSession(
      {
        extractListing: (req) => {
          requests.push(req);
          return new Promise((resolve) => resolvers.push(resolve));
        },
      },
      apply,
    );
    session.start(page());
    session.start({
      ...page(),
      aiCapture: { ...page().aiCapture!, captureRevision: 'capture-2' },
    });
    resolvers[0]({ ...normal(), identity: requests[0].identity });
    await tick();
    expect(apply).not.toHaveBeenCalled();
    resolvers[1]({ ...normal(), identity: requests[1].identity });
    await tick();
    expect(apply).toHaveBeenCalledTimes(1);
  });
  it('retries unknown outcomes with identical bodies and keys', async () => {
    const client = {
      extractListing: vi.fn().mockRejectedValue(new Error('offline')),
    };
    const session = new ExtractionSession(client, vi.fn(), async () => ({
      ...page(),
      aiCapture: { ...page().aiCapture!, captureRevision: 'fresh-capture' },
    }));
    session.start(page());
    await tick();
    session.retry();
    await tick();
    expect(client.extractListing.mock.calls[0][0]).toBe(
      client.extractListing.mock.calls[1][0],
    );
    expect(JSON.stringify(client.extractListing.mock.calls[0][0])).toBe(
      JSON.stringify(client.extractListing.mock.calls[1][0]),
    );
    expect(client.extractListing.mock.calls[0][0]).toEqual(
      client.extractListing.mock.calls[1][0],
    );
    expect(session.getSnapshot()).toMatchObject({
      status: 'failed',
      retryAction: 'exact',
    });
    session.continueWithPreliminary();
    expect(session.getSnapshot()).toMatchObject({
      status: 'failed',
      continued: true,
    });
  });
  it('respects typed retry delays and allocates a new key only for terminal retry', async () => {
    const client = {
      extractListing: vi.fn(async (req: ExtractionRequest) => ({
        ...fixture('failure-model-output-truncated.response'),
        identity: req.identity,
      })),
    };
    const session = new ExtractionSession(client, vi.fn(), async () => ({
      ...page(),
      aiCapture: { ...page().aiCapture!, captureRevision: 'fresh-capture' },
    }));
    session.start(page());
    await tick();
    session.retry();
    await tick();
    expect(client.extractListing.mock.calls[0][0].identity.requestId).not.toBe(
      client.extractListing.mock.calls[1][0].identity.requestId,
    );
    expect(
      client.extractListing.mock.calls[1][0].identity.captureRevision,
    ).toBe('fresh-capture');
    const delayed = {
      extractListing: vi.fn(async (req: ExtractionRequest) => ({
        ...fixture('failure-extraction-in-progress.response'),
        identity: req.identity,
      })),
    };
    const second = new ExtractionSession(delayed, vi.fn());
    second.start(page());
    await tick();
    second.retry();
    expect(delayed.extractListing).toHaveBeenCalledTimes(1);
  });
});

describe('AI review UI', () => {
  it('keeps internal unknowns out of the customer review list', () => {
    const response = normal();
    const issue = response.result.reviewIssues[0];
    expect(
      shouldShowReviewIssue({
        ...issue,
        code: 'UNKNOWN_VALUE',
        fieldPaths: ['/property/country', '/property/unitLabel'],
      }),
    ).toBe(false);
    expect(
      shouldShowReviewIssue({
        ...issue,
        code: 'UNIT_SCOPE_UNCERTAIN',
        fieldPaths: ['/property/baseRent'],
      }),
    ).toBe(false);
    expect(
      shouldShowReviewIssue({
        ...issue,
        code: 'RENT_RANGE',
        fieldPaths: ['/property/baseRent'],
      }),
    ).toBe(true);
  });

  it('suggests qualified charges and promotions, not restated input values', () => {
    const response = fixture(
      'conditional-promotion.response',
    ) as ExtractionSuccess;
    expect(shouldSuggestPropertyNote(response.result.notes[0])).toBe(false);
    expect(shouldSuggestPropertyNote(response.result.notes[1])).toBe(true);
    const analysis = applyAiExtraction(
      createInitialAnalysis(page().url),
      response,
    );
    const html = renderToStaticMarkup(
      <AiSourceReview analysis={analysis} update={vi.fn()} />,
    );
    expect(html).toContain('Suggested property details');
    expect(html).toContain('Keep note');
    expect(html).toContain('Dismiss');
    expect(html).toContain('advertised $2,200 effective rent');
  });

  it.each([
    {
      name: 'a single field path',
      fieldPaths: ['/property/baseRent'],
      expected: 'Base rent: This value is not stated clearly in the capture.',
    },
    {
      name: 'multiple field paths',
      fieldPaths: ['/property/fees', '/property/promotions'],
      expected:
        'Fees and promotions: Some listing content was unavailable during capture.',
    },
    {
      name: 'a nested field path',
      fieldPaths: ['/property/fees/value/0/amount/minMinor'],
      expected: 'Fees: This value is not stated clearly in the capture.',
    },
    {
      name: 'an unknown field path',
      fieldPaths: ['/property/futureDetail/value/0'],
      expected:
        'Listing detail: This value is not stated clearly in the capture.',
    },
  ])(
    'labels $name without exposing its JSON pointer',
    ({ fieldPaths, expected }) => {
      const message = expected.slice(expected.indexOf(': ') + 2);
      const rendered = formatReviewIssue({ fieldPaths, message });
      expect(rendered).toBe(expected);
      expect(rendered).not.toContain('/property/');
    },
  );

  it('distinguishes repeated generic messages by their affected fields', () => {
    const message = 'This value is not stated clearly in the capture.';
    expect([
      formatReviewIssue({ fieldPaths: ['/property/baseRent'], message }),
      formatReviewIssue({ fieldPaths: ['/property/availableOn'], message }),
    ]).toEqual([`Base rent: ${message}`, `Availability date: ${message}`]);
  });

  it('shows accessible progress and gates Confirm while fields remain available', () => {
    const controls = {
      state: { status: 'extracting', requestId: 'test' } as const,
      retry: vi.fn(),
      continueWithPreliminary: vi.fn(),
    };
    const analysis = applyAiExtraction(
      createInitialAnalysis(page().url),
      normal(),
    );
    const html = renderToStaticMarkup(
      <AnalysisEditor
        analysis={analysis}
        update={vi.fn()}
        aiControls={controls}
      />,
    );
    expect(html).toContain('AI review in progress');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Waiting for AI review');
    expect(html).toMatch(/class="primary-action confirm-action" disabled=""/);
    expect(html).toContain('aria-label="Monthly rent"');
  });
  it('shows progress while the listing capture is being prepared', () => {
    const html = renderToStaticMarkup(
      <AiExtractionCard
        controls={{
          state: { status: 'preparing' },
          retry: vi.fn(),
          continueWithPreliminary: vi.fn(),
        }}
      />,
    );
    expect(html).toContain('AI review in progress');
    expect(html).toContain('class="ai-scan-track"');
    expect(html).toContain('aria-busy="true"');
  });
  it('offers an explicit fallback after failure', () => {
    const html = renderToStaticMarkup(
      <AiExtractionCard
        controls={{
          state: {
            status: 'failed',
            requestId: 'id',
            message: 'Unavailable',
            retryMode: 'same_request',
            retryAction: 'exact',
            retryAt: 0,
          },
          retry: vi.fn(),
          continueWithPreliminary: vi.fn(),
        }}
      />,
    );
    expect(html).toContain('Review preliminary details');
    expect(html).toContain('Retry AI extraction');
  });
  it('always renders terminal completion feedback after success', () => {
    const html = renderToStaticMarkup(
      <AiExtractionCard
        controls={{
          state: { status: 'succeeded', requestId: 'id' },
          retry: vi.fn(),
          continueWithPreliminary: vi.fn(),
        }}
      />,
    );
    expect(html).toContain('AI review complete');
    expect(html).toContain('listing baseline has been updated');
    expect(html).toContain('role="status"');
  });
});

describe('terminal extraction storage', () => {
  it('removes expired terminal states and bounds retained entries', async () => {
    const originalChrome = globalThis.chrome;
    const stored: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: stored[key] }),
          set: async (values: Record<string, unknown>) =>
            Object.assign(stored, values),
        },
      },
    });
    try {
      const expiredIdentity = listingCacheIdentity({
        url: 'https://example.com/expired',
      });
      const expiredKey = listingCacheKey(expiredIdentity);
      stored.aiExtractionCacheV1 = {
        entries: {},
        inFlight: {},
        failures: {},
        terminalStates: {
          [expiredKey]: {
            status: 'failed',
            requestId: 'expired',
            message: 'Expired',
            retryMode: 'same_request',
            retryAt: 0,
            fingerprint: 'old',
            completedAt: Date.now() - EXTRACTION_TERMINAL_TTL_MS - 1,
          },
        },
      };
      const cache = new ChromeExtractionCache();
      expect(await cache.getTerminal(expiredIdentity)).toBeUndefined();
      expect(
        (
          stored.aiExtractionCacheV1 as {
            terminalStates: Record<string, unknown>;
          }
        ).terminalStates[expiredKey],
      ).toBeUndefined();

      for (
        let index = 0;
        index < EXTRACTION_TERMINAL_MAX_ENTRIES + 5;
        index++
      ) {
        await cache.putTerminal(
          listingCacheIdentity({ url: `https://example.com/${index}` }),
          {
            status: 'failed',
            requestId: String(index),
            message: 'Temporary failure',
            retryMode: 'new_request',
            retryAt: 0,
            fingerprint: String(index),
            completedAt: Date.now() + index,
          },
        );
      }
      expect(
        Object.keys(
          (
            stored.aiExtractionCacheV1 as {
              terminalStates: Record<string, unknown>;
            }
          ).terminalStates,
        ),
      ).toHaveLength(EXTRACTION_TERMINAL_MAX_ENTRIES);
    } finally {
      vi.stubGlobal('chrome', originalChrome);
    }
  });
});

describe('failure regression coverage', () => {
  it.each([
    {
      name: 'malformed JSON',
      fetcher: vi.fn(async () => new Response('{', { status: 200 })),
    },
    {
      name: 'a network exception',
      fetcher: vi.fn(async () => {
        throw new Error('private network details');
      }),
    },
  ])('leaves loading and shows failure after $name', async ({ fetcher }) => {
    const client = new RentSightBackendClient({
      apiOrigin: 'https://api.example.com',
      getAccessToken: async () => 'token',
      fetch: fetcher,
    });
    const session = new ExtractionSession(client, vi.fn());
    session.start(page());
    await tick();
    await tick();
    expect(session.getSnapshot()).toMatchObject({ status: 'failed' });
    const html = renderToStaticMarkup(
      <AiExtractionCard
        controls={{
          state: session.getSnapshot(),
          retry: vi.fn(),
          continueWithPreliminary: vi.fn(),
        }}
      />,
    );
    expect(html).toContain('Your listing details are ready');
    expect(html).not.toContain('private network details');
  });

  it('turns a restored same-request failure into an explicit fresh capture', async () => {
    let terminal: TerminalExtractionState | undefined;
    const cache: ExtractionCache = {
      get: async () => undefined,
      put: async () => undefined,
      claim: async () => true,
      release: async () => undefined,
      suppress: async () => undefined,
      isSuppressed: async () => false,
      getTerminal: async () => terminal,
      putTerminal: async (_identity, state) => {
        terminal = state;
      },
    };
    const client = {
      extractListing: vi
        .fn()
        .mockImplementationOnce(async (req: ExtractionRequest) => ({
          schemaVersion: '1.1.0' as const,
          status: 'failed' as const,
          identity: req.identity,
          error: {
            code: 'UPSTREAM_TIMEOUT' as const,
            message: '',
            retryable: true,
            retryMode: 'same_request' as const,
            retryAfterSeconds: null,
          },
        }))
        .mockImplementationOnce(async (req: ExtractionRequest) => ({
          ...normal(),
          identity: req.identity,
        })),
    };
    const first = new ExtractionSession(client, vi.fn(), undefined, cache);
    first.start(page());
    await tick();
    await tick();
    expect(first.getSnapshot().status).toBe('failed');
    first.dispose();

    const fresh = {
      ...page(),
      aiCapture: { ...page().aiCapture!, captureRevision: 'fresh-capture' },
    };
    const recapture = vi.fn(async () => fresh);
    const reopened = new ExtractionSession(client, vi.fn(), recapture, cache);
    reopened.start(page());
    await tick();
    expect(reopened.getSnapshot()).toMatchObject({
      status: 'failed',
      retryMode: 'same_request',
      retryAction: 'refresh',
    });
    const html = renderToStaticMarkup(
      <AiExtractionCard
        controls={{
          state: reopened.getSnapshot(),
          retry: () => reopened.retry(),
          continueWithPreliminary: () => reopened.continueWithPreliminary(),
        }}
      />,
    );
    expect(html).toContain('Load listing and try again');
    expect(client.extractListing).toHaveBeenCalledTimes(1);
    const original = client.extractListing.mock.calls[0][0];
    await reopened.retry();
    await tick();
    await tick();
    expect(recapture).toHaveBeenCalledTimes(1);
    const refreshed = client.extractListing.mock.calls[1][0];
    expect(refreshed.identity.requestId).not.toBe(original.identity.requestId);
    expect(refreshed.identity.captureRevision).toBe('fresh-capture');
    expect(refreshed.identity.requestId).not.toBe(terminal?.requestId);
  });

  it('clears obsolete terminal failures after success', async () => {
    const clearTerminal = vi.fn(async () => undefined);
    const cache: ExtractionCache = {
      get: async () => undefined,
      put: async () => undefined,
      claim: async () => true,
      release: async () => undefined,
      suppress: async () => undefined,
      isSuppressed: async () => false,
      clearTerminal,
    };
    const session = new ExtractionSession(
      {
        extractListing: async (req) => ({
          ...normal(),
          identity: req.identity,
        }),
      },
      vi.fn(),
      undefined,
      cache,
    );
    session.start(page());
    await tick();
    expect(session.getSnapshot().status).toBe('succeeded');
    expect(clearTerminal).toHaveBeenCalledTimes(1);
  });

  it.each([
    'MODEL_EVIDENCE_INVALID',
    'UNAUTHENTICATED',
    'ENTITLEMENT_REQUIRED',
    'RATE_LIMITED',
    'EXTRACTION_IN_PROGRESS',
    'INVALID_REQUEST',
    'USAGE_LIMIT_EXCEEDED',
    'IDEMPOTENCY_CONFLICT',
    'UNUSABLE_CAPTURE',
    'MODEL_REFUSAL',
    'MODEL_OUTPUT_TRUNCATED',
    'MODEL_OUTPUT_INVALID',
    'UPSTREAM_TIMEOUT',
    'UPSTREAM_UNAVAILABLE',
    'INTERNAL_ERROR',
  ] as const)(
    'keeps the baseline and resolves loading for %s',
    async (code) => {
      const apply = vi.fn();
      const session = new ExtractionSession(
        {
          extractListing: async (req) => ({
            schemaVersion: '1.1.0',
            status: 'failed',
            identity: req.identity,
            error: {
              code,
              message: 'sensitive provider details',
              retryable: false,
              retryMode: 'none',
              retryAfterSeconds: null,
            },
          }),
        },
        apply,
      );
      session.start(page());
      await tick();
      const state = session.getSnapshot();
      expect(state.status).toBe('failed');
      expect(apply).not.toHaveBeenCalled();
      const html = renderToStaticMarkup(
        <AiExtractionCard
          controls={{ state, retry: vi.fn(), continueWithPreliminary: vi.fn() }}
        />,
      );
      expect(html).toContain('Your listing details are ready');
      expect(html).not.toContain('sensitive provider');
      if (code === 'MODEL_EVIDENCE_INVALID')
        expect(html).toContain('supporting details could not be verified');
      session.continueWithPreliminary();
      const editor = renderToStaticMarkup(
        <AnalysisEditor
          analysis={setRecurringValue(
            createInitialAnalysis(page().url),
            'advertisedRent',
            2400,
          )}
          update={vi.fn()}
          aiControls={{
            state: session.getSnapshot(),
            retry: vi.fn(),
            continueWithPreliminary: vi.fn(),
          }}
        />,
      );
      expect(editor).not.toContain(
        'class="primary-action confirm-action" disabled=""',
      );
    },
  );

  it('rejects every mismatched identity at the session boundary', async () => {
    for (const mismatch of [
      { requestId: crypto.randomUUID() },
      { captureRevision: 'old' },
      { listingUrl: 'https://other.example' },
      { selectedUnit: null },
      { selectedLeaseTermMonths: 18 },
    ]) {
      const apply = vi.fn();
      const session = new ExtractionSession(
        {
          extractListing: async (req) => ({
            ...normal(),
            identity: { ...req.identity, ...mismatch },
          }),
        },
        apply,
      );
      session.start(page());
      await tick();
      expect(apply).not.toHaveBeenCalled();
      expect(session.getSnapshot().status).toBe('failed');
      session.invalidate();
      expect(session.getSnapshot().status).toBe('idle');
    }
  });

  it('respects Retry-After and only logs allowlisted diagnostics', async () => {
    const log = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    try {
      const req = request();
      const response = {
        ...fixture('failure-extraction-in-progress.response'),
        identity: req.identity,
      };
      const client = new RentSightBackendClient({
        apiOrigin: 'https://api.example.com',
        getAccessToken: async () => 'PRIVATE_TOKEN',
        fetch: vi.fn(
          async () =>
            new Response(JSON.stringify(response), {
              status: 409,
              headers: { 'Retry-After': '60' },
            }),
        ),
      });
      const result = await client.extractListing(req);
      expect(result.status === 'failed' && result.error.retryAfterSeconds).toBe(
        60,
      );
      expect(log.mock.calls[0][1]).toEqual({
        httpStatus: 409,
        errorCode: 'EXTRACTION_IN_PROGRESS',
        retryMode: 'same_request',
        elapsedMs: expect.any(Number),
        requestBytes: expect.any(Number),
        captureBytes: expect.any(Number),
        preliminaryValuesBytes: expect.any(Number),
        blockCount: req.capture.blocks.length,
        captureTextCharacters: expect.any(Number),
        captureTextBytes: expect.any(Number),
        unavailableSectionCount: req.capture.unavailableSections.length,
        preliminaryValueCount: req.preliminaryValues.length,
        truncated: req.capture.truncated,
        blockKinds: expect.objectContaining({
          json_ld: expect.objectContaining({
            blocks: expect.any(Number),
            textBytes: expect.any(Number),
          }),
        }),
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_TOKEN');
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        req.identity.requestId,
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        req.identity.captureRevision,
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        req.capture.blocks[0].text,
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        req.identity.listingUrl,
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        JSON.stringify(req.preliminaryValues),
      );
    } finally {
      log.mockRestore();
    }
  });

  it('prevents concurrent retries and ignores completion after unmount', async () => {
    let resolve!: (value: ExtractionSuccess) => void;
    let sent!: ExtractionRequest;
    const client = {
      extractListing: vi.fn((req: ExtractionRequest) => {
        sent = req;
        return new Promise<ExtractionSuccess>((r) => {
          resolve = r;
        });
      }),
    };
    const apply = vi.fn();
    const session = new ExtractionSession(client, apply);
    session.start(page());
    await session.retry();
    await session.retry();
    expect(client.extractListing).toHaveBeenCalledTimes(1);
    session.invalidate();
    resolve({ ...normal(), identity: sent.identity });
    await tick();
    expect(apply).not.toHaveBeenCalled();
    expect(session.getSnapshot().status).toBe('idle');
  });

  it('includes selected floor-plan context in the request', async () => {
    let sent!: ExtractionRequest;
    const session = new ExtractionSession(
      {
        extractListing: vi.fn(async (request: ExtractionRequest) => {
          sent = request;
          return { ...normal(), identity: request.identity };
        }),
      },
      vi.fn(),
    );
    session.start({
      ...page(),
      selectedUnitId: '2BR/1BA',
      selectedUnit: { id: null, label: '2BR/1BA' },
    });
    await tick();
    expect(sent.identity.selectedUnit).toEqual({
      id: null,
      label: '2BR/1BA',
    });
  });
});

it('applies edits and deletions made during the pending request after full replacement', async () => {
  let current = setRecurringValue(
    createInitialAnalysis(page().url),
    'advertisedRent',
    2100,
  );
  let resolve!: (response: ExtractionSuccess) => void;
  let sent!: ExtractionRequest;
  const session = new ExtractionSession(
    {
      extractListing: (req) => {
        sent = req;
        return new Promise<ExtractionSuccess>((done) => {
          resolve = done;
        });
      },
    },
    (response) => {
      current = applyAiExtraction(current, response);
    },
  );
  session.start(page());
  expect(session.getSnapshot().status).toBe('extracting');
  current = setRecurringValue(current, 'advertisedRent', 2700);
  current = clearField(current, 'upfront', 'securityDeposit');
  resolve({ ...normal(), identity: sent.identity });
  await tick();
  expect(current.baseline.recurring.advertisedRent?.value).toBe(2400);
  expect(current.listing.recurring.advertisedRent).toEqual({
    value: 2700,
    source: 'user',
    confidence: 1,
  });
  expect(current.listing.upfront.securityDeposit).toBeUndefined();
  expect(session.getSnapshot().status).toBe('succeeded');
});

it('resolves recapture failures without sending another provider request', async () => {
  const client = {
    extractListing: vi.fn(async (req: ExtractionRequest) => ({
      ...fixture('failure-model-output-truncated.response'),
      identity: req.identity,
    })),
  };
  const session = new ExtractionSession(client, vi.fn(), async () => {
    throw new Error('private details');
  });
  session.start(page());
  await tick();
  await session.retry();
  expect(client.extractListing).toHaveBeenCalledTimes(1);
  expect(session.getSnapshot()).toMatchObject({
    status: 'failed',
    retryMode: 'new_request',
  });
  expect(JSON.stringify(session.getSnapshot())).not.toContain(
    'private details',
  );
  session.continueWithPreliminary();
  expect(session.getSnapshot()).toMatchObject({ continued: true });
});
