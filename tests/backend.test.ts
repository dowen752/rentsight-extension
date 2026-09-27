import { describe, expect, it, vi } from 'vitest';
import {
  BackendNotConfiguredError,
  BackendNetworkError,
  BackendRequestError,
  BackendTimeoutError,
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

  it('sends authenticated assistant turns with an idempotency key', async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({
          schemaVersion: '1.0',
          conversationId: 'conversation-1',
          messageId: 'message-1',
          message: {
            format: 'markdown',
            text: 'The calculation includes parking.',
          },
          proposals: [],
        }),
    );
    const client = new RentSightBackendClient({
      apiOrigin: 'https://api.rentsight.test',
      getAccessToken: async () => 'firebase-id-token',
      fetch: fetcher,
    });
    const request = {
      schemaVersion: '1.0' as const,
      clientRequestId: 'request-1',
      message: 'Why is the total higher?',
      capabilities: {
        actions: {
          'search.patch': '1.0' as const,
          'analysis.set_cost': '1.0' as const,
          'property_note.add': '1.0' as const,
          'workspace.navigate': '1.0' as const,
        },
      },
    };

    await expect(client.sendAssistantMessage(request)).resolves.toMatchObject({
      conversationId: 'conversation-1',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.rentsight.test/v1/listings/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer firebase-id-token',
          'Idempotency-Key': 'request-1',
        }),
        body: JSON.stringify(request),
      }),
    );
    const [, init] = fetcher.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as {
      clientRequestId: string;
    };
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
      body.clientRequestId,
    );
  });

  it('surfaces aborted assistant requests as a clear timeout', async () => {
    const timeout = new Error('The operation timed out');
    timeout.name = 'TimeoutError';
    const client = new RentSightBackendClient({
      apiOrigin: 'https://api.rentsight.test',
      getAccessToken: async () => 'firebase-id-token',
      fetch: async () => {
        throw timeout;
      },
    });
    await expect(
      client.sendAssistantMessage({
        schemaVersion: '1.0',
        clientRequestId: 'request-timeout',
        message: 'Explain this listing.',
        capabilities: {
          actions: {
            'search.patch': '1.0',
            'analysis.set_cost': '1.0',
            'property_note.add': '1.0',
            'workspace.navigate': '1.0',
          },
        },
      }),
    ).rejects.toEqual(new BackendTimeoutError({ cause: timeout }));
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

  it('parses structured assistant errors and combines retry timing', async () => {
    const client = new RentSightBackendClient({
      apiOrigin: 'https://api.rentsight.test',
      getAccessToken: async () => 'firebase-token',
      fetch: async () =>
        Response.json(
          {
            schemaVersion: '1.0',
            error: {
              code: 'RATE_LIMITED',
              message: 'The assistant is temporarily rate limited.',
              retryable: true,
              retryAfterSeconds: 60,
            },
          },
          { status: 429, headers: { 'Retry-After': '120' } },
        ),
    });
    const request = {
      schemaVersion: '1.0' as const,
      clientRequestId: 'request-rate-limited',
      message: 'Explain this listing.',
      capabilities: {
        actions: {
          'search.patch': '1.0' as const,
          'analysis.set_cost': '1.0' as const,
          'property_note.add': '1.0' as const,
          'workspace.navigate': '1.0' as const,
        },
      },
    };

    await expect(client.sendAssistantMessage(request)).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'The assistant is temporarily rate limited.',
      retryable: true,
      retryAfterSeconds: 120,
    });
  });

  it('preserves retryAfterSeconds when no Retry-After header is present', async () => {
    const client = new RentSightBackendClient({
      apiOrigin: 'https://api.rentsight.test',
      getAccessToken: async () => 'firebase-token',
      fetch: async () =>
        Response.json(
          {
            schemaVersion: '1.0',
            error: {
              code: 'UPSTREAM_UNAVAILABLE',
              message: 'The assistant is temporarily unavailable.',
              retryable: true,
              retryAfterSeconds: 45,
            },
          },
          { status: 503 },
        ),
    });

    await expect(
      client.sendAssistantMessage({
        schemaVersion: '1.0',
        clientRequestId: 'request-unavailable',
        message: 'Explain this listing.',
        capabilities: {
          actions: {
            'search.patch': '1.0',
            'analysis.set_cost': '1.0',
            'property_note.add': '1.0',
            'workspace.navigate': '1.0',
          },
        },
      }),
    ).rejects.toMatchObject({ retryAfterSeconds: 45 });
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
