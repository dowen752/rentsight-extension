import { sameIdentity } from './validation';
import { extractionErrorMessage } from './errors';
import type { PageInfo } from '../shared/messages';
import type {
  ExtractionRequest,
  ExtractionResponse,
  ExtractionSuccess,
} from './types';
import {
  ChromeExtractionCache,
  EXTRACTION_CACHE_TTL_MS,
  EXTRACTION_FAILURE_COOLDOWN_MS,
  developmentDiagnostic,
  type ExtractionCache,
  type ExtractionCacheEntry,
} from './cache';
import { relevantContentFingerprint } from './fingerprint';
import {
  EXTRACTION_SCHEMA_VERSION,
  listingCacheIdentity,
  type ListingCacheIdentity,
} from './identity';

export type AiState =
  | { status: 'idle' }
  | { status: 'preparing' }
  | { status: 'extracting'; requestId: string }
  | { status: 'succeeded'; requestId: string }
  | {
      status: 'failed';
      requestId: string;
      message: string;
      retryMode: 'none' | 'same_request' | 'new_request';
      retryAt: number;
      continued?: boolean;
    };

export class ExtractionSession {
  private state: AiState = { status: 'idle' };
  private listeners = new Set<() => void>();
  private request?: ExtractionRequest;
  private generation = 0;
  private activationKey?: string;
  private startedAt = 0;
  private cache: ExtractionCache | undefined;
  private cacheContext?: {
    identity: ListingCacheIdentity;
    fingerprint: string;
    previous?: ExtractionCacheEntry;
    owner: string;
  };
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  constructor(
    private client: {
      extractListing(request: ExtractionRequest): Promise<ExtractionResponse>;
    },
    private apply: (response: ExtractionSuccess) => void,
    private recapture?: () => Promise<PageInfo>,
    cache?: ExtractionCache,
  ) {
    this.cache =
      cache ??
      (typeof chrome !== 'undefined' ? new ChromeExtractionCache() : undefined);
  }
  private publish(state: AiState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  activate(page: PageInfo, accountId: string) {
    const key = JSON.stringify([
      accountId,
      page.url,
      page.selectedUnitId,
      page.aiCapture?.captureRevision,
      page.aiCapture?.selectedLeaseTermMonths,
    ]);
    if (this.activationKey === key) return;
    this.activationKey = key;
    if (page.eligibility && page.eligibility.classification !== 'high') {
      developmentDiagnostic('automatic-suppressed', {
        reason: `eligibility-${page.eligibility.classification}`,
        score: page.eligibility.score,
      });
      this.publish({ status: 'idle' });
      return;
    }
    void this.start(page);
  }
  invalidate() {
    this.activationKey = undefined;
    this.generation++;
    this.request = undefined;
    this.publish({ status: 'idle' });
  }
  captureFailed() {
    this.generation++;
    this.request = undefined;
    this.publish({
      status: 'failed',
      requestId: crypto.randomUUID(),
      retryMode: 'none',
      retryAt: 0,
      message:
        'The listing capture could not be prepared for AI review. Your preliminary values were kept. Refresh the listing to try again.',
    });
  }
  prepareCapture() {
    this.publish({ status: 'preparing' });
  }
  start(page: PageInfo, options: { bypassCache?: boolean } = {}) {
    if (!page.aiCapture) {
      this.invalidate();
      return;
    }
    this.prepareCapture();
    const generation = ++this.generation;
    void this.prepare(page, generation, options.bypassCache === true);
  }
  refresh(page: PageInfo) {
    this.activationKey = undefined;
    this.start(page, { bypassCache: true });
  }
  private async prepare(
    page: PageInfo,
    generation: number,
    bypassCache: boolean,
  ) {
    const { aiCapture } = page;
    if (!aiCapture) return;
    const identity = listingCacheIdentity({
      url: page.url,
      selectedUnit: page.selectedUnitId,
      selectedLeaseTermMonths: aiCapture.selectedLeaseTermMonths,
    });
    const fingerprint = relevantContentFingerprint(aiCapture);
    const previous = this.cache ? await this.cache.get(identity) : undefined;
    if (generation !== this.generation) return;
    const age = previous ? Date.now() - previous.completedAt : Infinity;
    if (
      !bypassCache &&
      previous &&
      age < EXTRACTION_CACHE_TTL_MS &&
      previous.fingerprint === fingerprint
    ) {
      developmentDiagnostic('cache-hit', { ageMs: age });
      this.apply(previous.response);
      this.publish({
        status: 'succeeded',
        requestId: previous.response.identity.requestId,
      });
      return;
    }
    developmentDiagnostic(
      previous
        ? age >= EXTRACTION_CACHE_TTL_MS
          ? 'cache-stale'
          : 'fingerprint-change'
        : 'cache-miss',
      {},
    );
    if (
      !bypassCache &&
      this.cache &&
      (await this.cache.isSuppressed(identity, fingerprint, Date.now()))
    ) {
      developmentDiagnostic('automatic-suppressed', {
        reason: 'failure-cooldown',
      });
      this.publish({ status: 'idle' });
      return;
    }
    const owner = crypto.randomUUID();
    if (
      !bypassCache &&
      this.cache &&
      !(await this.cache.claim(identity, owner, Date.now()))
    ) {
      developmentDiagnostic('automatic-suppressed', { reason: 'in-flight' });
      this.publish({ status: 'idle' });
      return;
    }
    if (generation !== this.generation) return;
    this.cacheContext = { identity, fingerprint, previous, owner };
    this.request = structuredClone({
      schemaVersion: EXTRACTION_SCHEMA_VERSION,
      identity: {
        requestId: crypto.randomUUID(),
        captureRevision: aiCapture.captureRevision,
        listingUrl: page.url,
        selectedUnit: page.selectedUnitId
          ? { id: page.selectedUnitId, label: page.selectedUnitId }
          : null,
        selectedLeaseTermMonths: aiCapture.selectedLeaseTermMonths,
      },
      capture: aiCapture.capture,
      preliminaryValues: aiCapture.preliminaryValues,
    });
    freeze(this.request);
    this.startedAt = Date.now();
    void this.run();
  }
  async retry() {
    if (
      !this.request ||
      this.state.status !== 'failed' ||
      this.state.retryMode === 'none' ||
      Date.now() < this.state.retryAt
    )
      return;
    if (Date.now() - this.startedAt >= 24 * 60 * 60 * 1000) {
      this.publish({
        ...this.state,
        retryMode: 'none',
        message:
          'This request has expired. Refresh the listing to capture it again.',
      });
      return;
    }
    if (this.state.retryMode === 'new_request') {
      const generation = ++this.generation;
      const previous = this.state;
      this.publish({ status: 'extracting', requestId: previous.requestId });
      try {
        if (!this.recapture) throw new Error();
        const page = await this.recapture();
        if (generation !== this.generation) return;
        if (
          !page.aiCapture ||
          page.url !== this.request?.identity.listingUrl ||
          (page.selectedUnitId ?? null) !==
            (this.request.identity.selectedUnit?.id ?? null) ||
          page.aiCapture.selectedLeaseTermMonths !==
            this.request.identity.selectedLeaseTermMonths
        )
          throw new Error();
        this.start(page);
      } catch {
        if (generation === this.generation)
          this.publish({
            ...previous,
            continued: false,
            message:
              'A fresh listing capture could not be obtained. Your preliminary values were kept.',
          });
      }
      return;
    }
    this.generation++;
    void this.run();
  }
  continueWithPreliminary() {
    if (this.state.status !== 'failed') return;
    this.generation++;
    this.publish({ ...this.state, continued: true });
  }
  private async run() {
    const request = this.request!;
    const generation = this.generation;
    this.publish({
      status: 'extracting',
      requestId: request.identity.requestId,
    });
    try {
      const response = await this.client.extractListing(request);
      if (generation !== this.generation) return;
      if (
        response.identity &&
        !sameIdentity(response.identity, request.identity)
      )
        throw new Error();
      if (response.status === 'succeeded') {
        this.apply(response);
        if (this.cacheContext)
          await this.cache?.put({
            identity: this.cacheContext.identity,
            fingerprint: this.cacheContext.fingerprint,
            completedAt: Date.now(),
            response: structuredClone(response),
          });
        this.publish({
          status: 'succeeded',
          requestId: request.identity.requestId,
        });
        this.request = undefined; // Drop the full capture after accepted success.
      } else {
        if (response.error.code === 'UNUSABLE_CAPTURE' && this.cacheContext)
          await this.cache?.suppress(
            this.cacheContext.identity,
            this.cacheContext.fingerprint,
            Date.now() + EXTRACTION_FAILURE_COOLDOWN_MS,
          );
        const staleSuffix = this.cacheContext?.previous
          ? ' The last successful listing data was kept and may be stale.'
          : '';
        this.publish({
          status: 'failed',
          requestId: request.identity.requestId,
          message: extractionErrorMessage(response.error.code) + staleSuffix,
          retryMode: response.error.retryMode,
          retryAt: Date.now() + (response.error.retryAfterSeconds ?? 0) * 1000,
        });
      }
    } catch {
      if (generation !== this.generation) return;
      // Unknown outcome: preserve the exact body/key, including for invalid legacy envelopes.
      const staleSuffix = this.cacheContext?.previous
        ? ' The last successful listing data was kept and may be stale.'
        : '';
      this.publish({
        status: 'failed',
        requestId: request.identity.requestId,
        message:
          'AI review could not finish. Your preliminary values were kept. Retry to check the original request.' +
          staleSuffix,
        retryMode: 'same_request',
        retryAt: Date.now(),
      });
    } finally {
      if (this.cacheContext)
        await this.cache?.release(
          this.cacheContext.identity,
          this.cacheContext.owner,
        );
    }
  }
}

// Freeze every nested capture string/container and hint; retries cannot drift.
function freeze(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}
