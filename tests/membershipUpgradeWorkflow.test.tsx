// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MembershipBadge,
  RentSightPlusOverlay,
} from '../src/sidepanel/MembershipBadge';

const billingMocks = vi.hoisted(() => ({
  account: {
    status: 'free' as const,
    user: {
      uid: 'customer-1',
      displayName: 'Customer',
      email: 'customer@example.com',
      photoURL: null,
    },
  },
  openBillingPortal: vi.fn(async () => undefined),
  openCheckout: vi.fn(async () => undefined),
  refresh: vi.fn(async () => undefined),
}));

vi.mock('../src/auth', () => ({
  signInWithGoogle: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
}));

vi.mock('../src/backend', () => ({
  openBillingPortal: billingMocks.openBillingPortal,
  openCheckout: billingMocks.openCheckout,
}));

vi.mock('../src/backend/services', () => ({
  accountSession: {
    getSnapshot: () => billingMocks.account,
    refresh: billingMocks.refresh,
    subscribe: () => () => undefined,
  },
  rentSightApi: {},
}));

describe('RentSight+ purchase information overlay', () => {
  let container: HTMLDivElement;
  let returnFocusButton: HTMLButtonElement;

  beforeEach(() => {
    billingMocks.openBillingPortal.mockClear();
    billingMocks.openCheckout.mockClear();
    billingMocks.refresh.mockClear();
    container = document.createElement('div');
    returnFocusButton = document.createElement('button');
    returnFocusButton.textContent = 'Get RentSight+';
    document.body.append(returnFocusButton, container);
    returnFocusButton.focus();
  });

  it('opens from Get RentSight+ without creating a checkout session', async () => {
    const root = createRoot(container);
    await act(async () => root.render(<MembershipBadge />));

    const upgrade = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Get RentSight+',
    );
    await act(async () => upgrade?.click());

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(billingMocks.openCheckout).not.toHaveBeenCalled();

    const checkout = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Continue to checkout — $7.99',
    );
    await act(async () => checkout?.click());

    expect(billingMocks.openCheckout).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  afterEach(() => {
    container.remove();
    returnFocusButton.remove();
  });

  it('shows purchase terms without starting checkout and restores focus on close', async () => {
    const onCheckout = vi.fn(async () => undefined);
    const onClose = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <RentSightPlusOverlay
          checkoutPending={false}
          notice=""
          onCheckout={onCheckout}
          onClose={onClose}
          returnFocusRef={{ current: returnFocusButton }}
        />,
      );
    });

    expect(onCheckout).not.toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain('30 days of RentSight+');
    expect(container.textContent).toContain('$7.99');
    expect(container.textContent).toContain(
      'One payment. No subscription. No automatic renewal.',
    );
    expect(container.textContent).toContain(
      'across a wider range of rental sites, including smaller or niche sites where standard extraction can fall short',
    );
    expect(container.textContent).toContain(
      'prefill your rental search, suggest cost and note updates for the current listing, and help revise saved property details—all with your approval',
    );
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Close RentSight+ information',
    );

    await act(async () => root.unmount());
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(returnFocusButton);
  });

  it('supports keyboard dismissal', async () => {
    const onClose = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <RentSightPlusOverlay
          checkoutPending={false}
          notice=""
          onCheckout={vi.fn(async () => undefined)}
          onClose={onClose}
          returnFocusRef={{ current: returnFocusButton }}
        />,
      );
    });

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it('starts checkout only from the final CTA and ignores duplicate clicks', async () => {
    let finishCheckout: (() => void) | undefined;
    const onCheckout = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCheckout = resolve;
        }),
    );
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <RentSightPlusOverlay
          checkoutPending={false}
          notice=""
          onCheckout={onCheckout}
          onClose={() => undefined}
          returnFocusRef={{ current: returnFocusButton }}
        />,
      );
    });

    const checkout = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Continue to checkout — $7.99',
    );
    await act(async () => {
      checkout?.click();
      checkout?.click();
      await Promise.resolve();
    });
    expect(onCheckout).toHaveBeenCalledOnce();

    await act(async () => finishCheckout?.());
    await act(async () => root.unmount());
  });
});
