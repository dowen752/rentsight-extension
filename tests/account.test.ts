import { describe, expect, it, vi } from 'vitest';
import { AccountSession, type AccountAuthSource } from '../src/backend/account';
import type { AuthUser } from '../src/auth';

const user: AuthUser = {
  uid: 'firebase-uid',
  displayName: 'Test User',
  email: 'test@example.com',
  photoURL: null,
};

const authSource = () => {
  let listener: (value: AuthUser | null) => void = () => undefined;
  return {
    source: {
      subscribe(next) {
        listener = next;
        return () => undefined;
      },
    } satisfies AccountAuthSource,
    emit(value: AuthUser | null) {
      listener(value);
    },
  };
};

describe('AccountSession', () => {
  it('loads on login, clears on logout, and restores on a later login', async () => {
    const auth = authSource();
    const getEntitlements = vi.fn(async () => ({
      entitlements: [
        { key: 'plus' as const, status: 'active' as const, active: true },
      ],
    }));
    const session = new AccountSession(auth.source, {
      configured: true,
      getEntitlements,
    });

    auth.emit(user);
    expect(session.getSnapshot().status).toBe('loading');
    await vi.waitFor(() => expect(session.getSnapshot().status).toBe('plus'));
    auth.emit(null);
    expect(session.getSnapshot()).toEqual({ status: 'signed-out', user: null });
    auth.emit(user);
    await vi.waitFor(() => expect(getEntitlements).toHaveBeenCalledTimes(2));
    session.dispose();
  });

  it('supports refresh and exposes backend errors without granting access', async () => {
    const auth = authSource();
    const getEntitlements = vi
      .fn()
      .mockResolvedValueOnce({ entitlements: [] })
      .mockRejectedValueOnce(new Error('Backend unavailable'));
    const session = new AccountSession(auth.source, {
      configured: true,
      getEntitlements,
    });
    auth.emit(user);
    await vi.waitFor(() => expect(session.getSnapshot().status).toBe('free'));
    await session.refresh();
    expect(session.getSnapshot()).toEqual({
      status: 'backend-error',
      user,
      message: 'Backend unavailable',
    });
    session.dispose();
  });
});
