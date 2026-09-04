import { describe, expect, it, vi } from 'vitest';
import {
  BackendNotConfiguredError,
  BackendNetworkError,
  BackendRequestError,
  RentSightBackendClient,
  SignedOutError,
  UnexpectedBackendResponseError,
} from '../src/backend';

describe('RentSightBackendClient', () => {
  it('does not make a request without a configured origin', async () => {
    const fetcher = vi.fn();
    const client = new RentSightBackendClient({
      apiOrigin: '',
      getAccessToken: async () => undefined,
      fetch: fetcher,
    });
    await expect(client.getEntitlements()).rejects.toBeInstanceOf(
      BackendNotConfiguredError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('asks for a fresh Firebase ID token for each authenticated request', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ entitlements: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const client = new RentSightBackendClient({
      apiOrigin: 'https://api.rentsight.test/',
      getAccessToken: async () => 'firebase-id-token',
      fetch: fetcher,
    });
    await expect(client.getEntitlements()).resolves.toEqual({
      entitlements: [],
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.rentsight.test/v1/account/entitlements',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer firebase-id-token',
        }),
      }),
    );
  });

  it('uses the billing portal endpoint', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ url: 'https://billing.stripe.com/session' }),
    );
    const client = new RentSightBackendClient({
      apiOrigin: 'https://api.rentsight.test',
      getAccessToken: async () => 'firebase-id-token',
      fetch: fetcher,
    });
    await client.createBillingPortal();
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.rentsight.test/v1/billing/portal',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('surfaces a safe backend error message and status', async () => {
    const client = new RentSightBackendClient({
      apiOrigin: 'https://api.rentsight.test',
      getAccessToken: async () => 'firebase-token',
      fetch: async () =>
        new Response(JSON.stringify({ message: 'Sign in required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    await expect(client.createCheckout()).rejects.toEqual(
      new BackendRequestError('Sign in required.', 401),
    );
  });

  it('rejects signed-out calls before fetch', async () => {
    const fetcher = vi.fn();
    const client = new RentSightBackendClient({
      apiOrigin: 'https://api.rentsight.test',
      getAccessToken: async () => undefined,
      fetch: fetcher,
    });
    await expect(client.createCheckout()).rejects.toBeInstanceOf(
      SignedOutError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('validates entitlement response data', async () => {
    const client = new RentSightBackendClient({
      apiOrigin: 'https://api.rentsight.test',
      getAccessToken: async () => 'firebase-token',
      fetch: async () => Response.json({ entitlements: [{ key: 'plus' }] }),
    });
    await expect(client.getEntitlements()).rejects.toBeInstanceOf(
      UnexpectedBackendResponseError,
    );
  });

  it('handles malformed JSON and network failures', async () => {
    const malformed = new RentSightBackendClient({
      apiOrigin: 'https://api.rentsight.test',
      getAccessToken: async () => 'firebase-token',
      fetch: async () => new Response('not json'),
    });
    await expect(malformed.createCheckout()).rejects.toBeInstanceOf(
      UnexpectedBackendResponseError,
    );

    const offline = new RentSightBackendClient({
      apiOrigin: 'https://api.rentsight.test',
      getAccessToken: async () => 'firebase-token',
      fetch: async () => {
        throw new TypeError('offline');
      },
    });
    await expect(offline.getEntitlements()).rejects.toBeInstanceOf(
      BackendNetworkError,
    );
  });
});
