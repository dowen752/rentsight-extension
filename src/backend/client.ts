import { acceptResponse, assertRequest } from '../ai/validation';
import type { ExtractionRequest, ExtractionResponse } from '../ai/types';
import {
  acceptAssistantResponse,
  isAssistantConversationPage,
  isAssistantConversationTurnsPage,
  type AssistantConversationPage,
  type AssistantConversationTurnsPage,
  type AssistantRequest,
  type AssistantResponse,
} from '../assistant';
import { RENT_SIGHT_API_ORIGIN } from './config';
import {
  isAccountEntitlements,
  isBillingLink,
  parseBackendError,
  type AccountEntitlements,
  type BillingLink,
} from './types';

export class BackendNotConfiguredError extends Error {
  constructor() {
    super('RentSight cloud services are not configured in this build.');
  }
}

export class BackendRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly retryable?: boolean,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export class SignedOutError extends Error {
  constructor() {
    super('Sign in with Google to use RentSight cloud services.');
  }
}

export class BackendNetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super(
      'Could not reach RentSight cloud services. Check your connection and try again.',
      options,
    );
  }
}

export class BackendTimeoutError extends Error {
  constructor(options?: ErrorOptions) {
    super('RentSight took too long to respond. Please try again.', options);
  }
}

export class UnexpectedBackendResponseError extends Error {
  constructor() {
    super('RentSight cloud services returned an unexpected response.');
  }
}

export interface BackendClientOptions {
  apiOrigin?: string;
  getAccessToken: () => Promise<string | undefined>;
  fetch?: typeof globalThis.fetch;
}

const utf8Bytes = (value: string) => new TextEncoder().encode(value).length;

export function summarizeExtractionRequest(request: ExtractionRequest) {
  const blockKinds: Record<
    ExtractionRequest['capture']['blocks'][number]['kind'],
    { blocks: number; textCharacters: number; textBytes: number }
  > = {
    heading: { blocks: 0, textCharacters: 0, textBytes: 0 },
    paragraph: { blocks: 0, textCharacters: 0, textBytes: 0 },
    table: { blocks: 0, textCharacters: 0, textBytes: 0 },
    json_ld: { blocks: 0, textCharacters: 0, textBytes: 0 },
    footnote: { blocks: 0, textCharacters: 0, textBytes: 0 },
    other: { blocks: 0, textCharacters: 0, textBytes: 0 },
  };
  for (const block of request.capture.blocks) {
    const summary = blockKinds[block.kind];
    summary.blocks++;
    summary.textCharacters += Array.from(block.text).length;
    summary.textBytes += utf8Bytes(block.text);
  }
  const serializedRequest = JSON.stringify(request);
  return {
    serializedRequest,
    requestBytes: utf8Bytes(serializedRequest),
    captureBytes: utf8Bytes(JSON.stringify(request.capture)),
    preliminaryValuesBytes: utf8Bytes(
      JSON.stringify(request.preliminaryValues),
    ),
    blockCount: request.capture.blocks.length,
    captureTextCharacters: Object.values(blockKinds).reduce(
      (sum, item) => sum + item.textCharacters,
      0,
    ),
    captureTextBytes: Object.values(blockKinds).reduce(
      (sum, item) => sum + item.textBytes,
      0,
    ),
    unavailableSectionCount: request.capture.unavailableSections.length,
    preliminaryValueCount: request.preliminaryValues.length,
    truncated: request.capture.truncated,
    blockKinds,
  };
}

export class RentSightBackendClient {
  private readonly apiOrigin: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: BackendClientOptions) {
    this.apiOrigin = (options.apiOrigin ?? RENT_SIGHT_API_ORIGIN).replace(
      /\/$/,
      '',
    );
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  get configured(): boolean {
    return this.apiOrigin.length > 0;
  }

  getEntitlements(): Promise<AccountEntitlements> {
    return this.request(
      '/v1/account/entitlements',
      { method: 'GET' },
      isAccountEntitlements,
    );
  }

  createCheckout(): Promise<BillingLink> {
    return this.request(
      '/v1/billing/checkout',
      { method: 'POST' },
      isBillingLink,
    );
  }

  createBillingPortal(): Promise<BillingLink> {
    return this.request(
      '/v1/billing/portal',
      { method: 'POST' },
      isBillingLink,
    );
  }

  sendAssistantMessage(request: AssistantRequest): Promise<AssistantResponse> {
    return this.request(
      '/v1/listings/chat',
      {
        method: 'POST',
        headers: { 'Idempotency-Key': request.clientRequestId },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(90_000),
      },
      (value): value is AssistantResponse =>
        acceptAssistantResponse(value) !== undefined,
      acceptAssistantResponse,
    );
  }

  listAssistantConversations(options: {
    limit: number;
    cursor?: string;
  }): Promise<AssistantConversationPage> {
    return this.request(
      `/v1/listings/chat/conversations?${paginationQuery(options)}`,
      { method: 'GET' },
      isAssistantConversationPage,
    );
  }

  getAssistantConversationTurns(
    conversationId: string,
    options: { limit: number; cursor?: string },
  ): Promise<AssistantConversationTurnsPage> {
    return this.request(
      `/v1/listings/chat/conversations/${encodeURIComponent(conversationId)}/turns?${paginationQuery(options)}`,
      { method: 'GET' },
      isAssistantConversationTurnsPage,
    );
  }

  async deleteAssistantConversation(conversationId: string): Promise<void> {
    await this.requestNoContent(
      `/v1/listings/chat/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'DELETE' },
    );
  }

  async extractListing(
    request: ExtractionRequest,
  ): Promise<ExtractionResponse> {
    const started = Date.now();
    const requestSummary = summarizeExtractionRequest(request);
    let httpStatus: number | null = null;
    let code = 'NETWORK_OUTCOME_UNKNOWN';
    let retryMode = 'same_request';
    try {
      try {
        assertRequest(request);
      } catch {
        code = 'INVALID_REQUEST';
        retryMode = 'none';
        return {
          schemaVersion: '1.1.0',
          status: 'failed',
          identity: null,
          error: {
            code: 'INVALID_REQUEST',
            message: '',
            retryable: false,
            retryMode: 'none',
            retryAfterSeconds: null,
          },
        };
      }
      if (!this.configured) throw new BackendNotConfiguredError();
      const token = await this.options.getAccessToken();
      if (!token) {
        code = 'UNAUTHENTICATED';
        retryMode = 'none';
        return {
          schemaVersion: '1.1.0',
          status: 'failed',
          identity: null,
          error: {
            code: 'UNAUTHENTICATED',
            message: '',
            retryable: false,
            retryMode: 'none',
            retryAfterSeconds: null,
          },
        };
      }
      const response = await this.fetcher(
        `${this.apiOrigin}/v1/listings/extract`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': request.identity.requestId,
          },
          body: requestSummary.serializedRequest,
          // Longer than the provider deadline and backend reservation lifecycle.
          // Abort is an uncertain outcome: the session retains the same body/key.
          signal: AbortSignal.timeout(150000),
        },
      );
      httpStatus = response.status;
      const accepted = acceptResponse(await response.json(), request);
      if (response.ok !== (accepted.status === 'succeeded'))
        throw new UnexpectedBackendResponseError();
      code = accepted.status === 'failed' ? accepted.error.code : 'SUCCEEDED';
      retryMode =
        accepted.status === 'failed' ? accepted.error.retryMode : 'none';
      if (accepted.status === 'failed') {
        const header = response.headers.get('Retry-After');
        const seconds =
          header === null
            ? 0
            : /^\d+$/.test(header)
              ? Number(header)
              : Math.max(
                  0,
                  Math.ceil((Date.parse(header) - Date.now()) / 1000),
                );
        if (Number.isFinite(seconds))
          accepted.error.retryAfterSeconds = Math.max(
            seconds,
            accepted.error.retryAfterSeconds ?? 0,
          );
      }
      return accepted;
    } finally {
      if (import.meta.env.DEV)
        console.debug('[RentSight] AI extraction', {
          httpStatus,
          errorCode: code,
          retryMode,
          elapsedMs: Date.now() - started,
          requestBytes: requestSummary.requestBytes,
          captureBytes: requestSummary.captureBytes,
          preliminaryValuesBytes: requestSummary.preliminaryValuesBytes,
          blockCount: requestSummary.blockCount,
          captureTextCharacters: requestSummary.captureTextCharacters,
          captureTextBytes: requestSummary.captureTextBytes,
          unavailableSectionCount: requestSummary.unavailableSectionCount,
          preliminaryValueCount: requestSummary.preliminaryValueCount,
          truncated: requestSummary.truncated,
          blockKinds: requestSummary.blockKinds,
        });
    }
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    validate: (value: unknown) => value is T,
    normalize?: (value: unknown) => T | undefined,
  ): Promise<T> {
    const response = await this.fetchResponse(path, init);
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new UnexpectedBackendResponseError();
    }
    if (!validate(value)) throw new UnexpectedBackendResponseError();
    return normalize?.(value) ?? value;
  }

  private async requestNoContent(
    path: string,
    init: RequestInit,
  ): Promise<void> {
    const response = await this.fetchResponse(path, init);
    if (response.status !== 204) throw new UnexpectedBackendResponseError();
  }

  private async fetchResponse(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    if (!this.configured) throw new BackendNotConfiguredError();
    const token = await this.options.getAccessToken();
    if (!token) throw new SignedOutError();
    let response: Response;
    try {
      response = await this.fetcher(`${this.apiOrigin}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.method === 'POST'
            ? { 'Content-Type': 'application/json' }
            : {}),
          Authorization: `Bearer ${token}`,
          ...init.headers,
        },
      });
    } catch (error: unknown) {
      if (isTimeoutError(error))
        throw new BackendTimeoutError({ cause: error });
      throw new BackendNetworkError({ cause: error });
    }
    if (!response.ok) await this.throwResponseError(response);
    return response;
  }

  private async throwResponseError(response: Response): Promise<never> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Non-JSON responses still produce a useful status-based error.
    }
    const parsed = parseBackendError(body);
    const retryValues = [
      parsed.retryAfterSeconds,
      parseRetryAfter(response.headers.get('Retry-After')),
    ].filter((value): value is number => value !== undefined);
    const retryAfterSeconds = retryValues.length
      ? Math.max(...retryValues)
      : undefined;
    throw new BackendRequestError(
      parsed.message ?? statusMessage(response.status),
      response.status,
      parsed.code,
      parsed.retryable,
      retryAfterSeconds,
    );
  }
}

const paginationQuery = (options: { limit: number; cursor?: string }) => {
  const query = new URLSearchParams({ limit: String(options.limit) });
  if (options.cursor) query.set('cursor', options.cursor);
  return query.toString();
};

const isTimeoutError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'AbortError' ||
    error.name === 'TimeoutError' ||
    /\b(?:abort|timed?\s*out|timeout)\b/i.test(error.message)
  );
};

const parseRetryAfter = (value: string | null): number | undefined => {
  if (value === null) return undefined;
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : Math.max(0, Math.ceil((Date.parse(value) - Date.now()) / 1_000));
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
};

const statusMessage = (status: number): string => {
  if (status === 401)
    return 'Your session is no longer authorized. Sign in again.';
  if (status === 403)
    return 'Your account does not have permission for this action.';
  if (status === 404) return 'The requested RentSight service was not found.';
  if (status >= 500)
    return 'RentSight cloud services are temporarily unavailable.';
  return `RentSight cloud request failed (${status}).`;
};
