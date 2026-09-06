import { isRentalAnalysis } from '../src/saved/migrations';
import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { captureListing } from '../src/ai/capture';
import { acceptResponse, assertRequest } from '../src/ai/validation';
import { applyAiExtraction, adaptExtraction } from '../src/ai/adapter';
import { ExtractionSession } from '../src/ai/session';
import { RentSightBackendClient } from '../src/backend/client';
import { AiExtractionCard } from '../src/sidepanel/AiExtractionCard';
import { formatReviewIssue } from '../src/sidepanel/reviewIssueLabels';
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
  it('replaces all preliminary facts while preserving latest overrides and deletions', () => {
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
    expect(next.listing.upfront.applicationFee).toBeUndefined();
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
    expect(client.extractListing.mock.calls[0][0]).toEqual(
      client.extractListing.mock.calls[1][0],
    );
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
    expect(html).toContain('Reviewing the listing details');
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
    expect(html).toContain('Preparing the listing review');
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
            retryAt: 0,
          },
          retry: vi.fn(),
          continueWithPreliminary: vi.fn(),
        }}
      />,
    );
    expect(html).toContain('Continue with preliminary values');
    expect(html).toContain('Retry AI extraction');
  });
});

describe('failure regression coverage', () => {
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
      expect(html).toContain('AI review couldn’t finish');
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
        requestId: req.identity.requestId,
        captureRevision: req.identity.captureRevision,
        httpStatus: 409,
        errorCode: 'EXTRACTION_IN_PROGRESS',
        retryMode: 'same_request',
        elapsedMs: expect.any(Number),
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_TOKEN');
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        req.capture.blocks[0].text,
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
