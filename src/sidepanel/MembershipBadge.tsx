import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
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

interface RentSightPlusOverlayProps {
  checkoutPending: boolean;
  notice: string;
  onCheckout: () => Promise<void>;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function RentSightPlusOverlay({
  checkoutPending,
  notice,
  onCheckout,
  onClose,
  returnFocusRef,
}: RentSightPlusOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const checkoutInFlight = useRef(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    const returnFocusTarget = returnFocusRef.current;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected
      )
        previouslyFocused.focus();
      else returnFocusTarget?.focus();
    };
  }, [onClose, returnFocusRef]);

  const continueToCheckout = async () => {
    if (checkoutInFlight.current || checkoutPending) return;
    checkoutInFlight.current = true;
    try {
      await onCheckout();
    } finally {
      checkoutInFlight.current = false;
    }
  };

  return (
    <div
      className="plus-purchase-dialog"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="plus-purchase-title"
      aria-describedby="plus-purchase-summary"
    >
      <div className="plus-purchase-header">
        <div>
          <img src="/icons/rentsight-mark.svg" alt="" aria-hidden="true" />
          <h2 id="plus-purchase-title">RentSight+</h2>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="plus-purchase-close"
          aria-label="Close RentSight+ information"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="plus-purchase-content">
        <div className="plus-purchase-hero">
          <span className="eyebrow">Extra help for your rental search</span>
          <h3>More help while you’re searching.</h3>
          <p id="plus-purchase-summary">
            Get AI-powered listing extraction and access to the RentSight
            Assistant while you search for your next rental.
          </p>
        </div>

        <div className="plus-feature-list" aria-label="RentSight+ features">
          <article className="plus-feature">
            <span className="plus-feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 10h8M8 14h5" />
              </svg>
            </span>
            <div>
              <h4>AI-powered extraction</h4>
              <p>
                Find more of the details that matter across a wider range of
                rental sites, including smaller or niche sites where standard
                extraction can fall short.
              </p>
            </div>
          </article>
          <article className="plus-feature">
            <span className="plus-feature-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M5 5h14v10H9l-4 4V5ZM9 9h6M9 12h4" />
              </svg>
            </span>
            <div>
              <h4>RentSight Assistant</h4>
              <p>
                Ask about the listing you’re viewing or properties you’ve saved.
                The Assistant can also prefill your rental search, suggest cost
                and note updates for the current listing, and help revise saved
                property details—all with your approval.
              </p>
            </div>
          </article>
        </div>

        <div className="plus-pricing-card">
          <span>30 days of RentSight+</span>
          <strong>$7.99</strong>
          <p>One payment. No subscription. No automatic renewal.</p>
        </div>

        <div className="plus-duration-message">
          <h4>
            Rental searches don’t last forever. RentSight+ doesn’t need to
            either.
          </h4>
          <p>
            Get the extra help while you’re searching, without signing up for
            another recurring subscription.
          </p>
        </div>
      </div>

      <div className="plus-purchase-footer">
        {notice && <p role="alert">{notice}</p>}
        <button
          type="button"
          className="plus-checkout-action"
          disabled={checkoutPending}
          onClick={() => void continueToCheckout()}
        >
          {checkoutPending
            ? 'Opening secure checkout…'
            : 'Continue to checkout — $7.99'}
        </button>
        <small>Secure checkout with Stripe</small>
      </div>
    </div>
  );
}

export function MembershipBadge() {
  const account = useSyncExternalStore(
    accountSession.subscribe,
    accountSession.getSnapshot,
    accountSession.getSnapshot,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [showPlusInformation, setShowPlusInformation] = useState(false);
  const billingRequestInFlight = useRef(false);
  const upgradeButtonRef = useRef<HTMLButtonElement>(null);
  const closePlusInformation = useCallback(
    () => setShowPlusInformation(false),
    [],
  );

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
    if (billingRequestInFlight.current) return;
    billingRequestInFlight.current = true;
    setBusy(true);
    setNotice('');
    try {
      await openBillingPortal(rentSightApi);
    } catch (error: unknown) {
      setNotice(
        error instanceof Error ? error.message : 'Could not open billing.',
      );
    } finally {
      billingRequestInFlight.current = false;
      setBusy(false);
    }
  };

  const beginCheckout = async () => {
    if (billingRequestInFlight.current) return;
    billingRequestInFlight.current = true;
    setBusy(true);
    setNotice('');
    try {
      await openCheckout(rentSightApi);
      setCheckoutPending(true);
      setShowPlusInformation(false);
    } catch (error: unknown) {
      setNotice(
        error instanceof Error ? error.message : 'Could not open billing.',
      );
    } finally {
      billingRequestInFlight.current = false;
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
    <>
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
          ref={upgradeButtonRef}
          type="button"
          disabled={busy || (Boolean(user) && account.status === 'loading')}
          onClick={() => {
            if (!user) void toggleSignIn();
            else if (isPlus) void openBilling();
            else {
              setNotice('');
              setShowPlusInformation(true);
            }
          }}
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
        {notice && !showPlusInformation && <p role="status">{notice}</p>}
      </aside>
      {showPlusInformation && !isPlus && (
        <RentSightPlusOverlay
          checkoutPending={busy}
          notice={notice}
          onCheckout={beginCheckout}
          onClose={closePlusInformation}
          returnFocusRef={upgradeButtonRef}
        />
      )}
    </>
  );
}
