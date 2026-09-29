import { useEffect, useState, useSyncExternalStore } from 'react';
import { signInWithGoogle, signOut } from '../auth';
import { openBillingPortal, openCheckout } from '../backend';
import { accountSession, rentSightApi } from '../backend/services';

const displayExpiration = (
  expiresAt: string | undefined,
): string | undefined => {
  if (!expiresAt) return undefined;
  const value = new Date(expiresAt);
  if (Number.isNaN(value.valueOf())) return undefined;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    value,
  );
};

export function MembershipBadge() {
  const account = useSyncExternalStore(
    accountSession.subscribe,
    accountSession.getSnapshot,
    accountSession.getSnapshot,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [checkoutPending, setCheckoutPending] = useState(false);

  useEffect(() => {
    if (!checkoutPending) return;
    const refreshAfterReturn = () => {
      if (document.visibilityState !== 'visible') return;
      setCheckoutPending(false);
      void accountSession.refresh();
    };
    window.addEventListener('focus', refreshAfterReturn);
    document.addEventListener('visibilitychange', refreshAfterReturn);
    return () => {
      window.removeEventListener('focus', refreshAfterReturn);
      document.removeEventListener('visibilitychange', refreshAfterReturn);
    };
  }, [checkoutPending]);

  const user = account.user;
  const isPlus = account.status === 'plus';
  const expiration = isPlus
    ? displayExpiration(account.entitlement.expiresAt)
    : undefined;

  const toggleSignIn = async () => {
    setBusy(true);
    setNotice('');
    try {
      if (user) {
        await signOut();
      } else {
        await signInWithGoogle();
      }
    } catch (error: unknown) {
      setNotice(
        error instanceof Error ? error.message : 'Authentication failed.',
      );
    } finally {
      setBusy(false);
    }
  };

  const openBilling = async () => {
    if (!user) {
      setNotice('Sign in with Google before managing RentSight+.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      if (isPlus) await openBillingPortal(rentSightApi);
      else {
        await openCheckout(rentSightApi);
        setCheckoutPending(true);
      }
    } catch (error: unknown) {
      setNotice(
        error instanceof Error ? error.message : 'Could not open billing.',
      );
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setNotice('');
    await accountSession.refresh();
  };

  const detail = (() => {
    if (account.status === 'loading') return 'Checking your account…';
    if (account.status === 'signed-out') return 'Sign in to use cloud features';
    if (account.status === 'backend-error') return account.message;
    if (isPlus) return 'Cloud features active';
    return account.user.email ?? `Account ${account.user.uid}`;
  })();
  return (
    <aside className="membership-bar">
      <div>
        <img
          className="membership-logo"
          src="/icons/rentsight-mark.svg"
          alt=""
          aria-hidden="true"
        />
        <span>
          <strong>{isPlus ? 'RentSight+ Pass' : 'Free'}</strong>
          <small>{detail}</small>
          {expiration && (
            <small className="membership-expiration">
              Expires {expiration}
            </small>
          )}
        </span>
      </div>
      <button
        type="button"
        disabled={busy || (Boolean(user) && account.status === 'loading')}
        onClick={() => (user ? void openBilling() : void toggleSignIn())}
      >
        {busy
          ? 'Opening…'
          : user
            ? isPlus
              ? 'Manage'
              : 'Get RentSight+'
            : 'Sign in with Google'}
      </button>
      {user && (
        <>
          <button
            type="button"
            disabled={busy || account.status === 'loading'}
            onClick={() => void refresh()}
          >
            Refresh plan
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleSignIn()}
          >
            Sign out
          </button>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </aside>
  );
}
