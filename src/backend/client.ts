import { RENT_SIGHT_API_ORIGIN } from './config';
import {
  isAccountEntitlements,
  isBillingLink,
  type AccountEntitlements,
  type BackendErrorBody,
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

  private async request<T>(
    path: string,
    init: RequestInit,
    validate: (value: unknown) => value is T,
  ): Promise<T> {
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
      throw new BackendNetworkError({ cause: error });
    }
    if (!response.ok) {
      let body: BackendErrorBody = {};
      try {
        body = (await response.json()) as BackendErrorBody;
      } catch {
        // Non-JSON responses still produce a useful status-based error.
      }
      throw new BackendRequestError(
        body.message ?? body.error ?? statusMessage(response.status),
        response.status,
      );
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new UnexpectedBackendResponseError();
    }
    if (!validate(value)) throw new UnexpectedBackendResponseError();
    return value;
  }
}

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
