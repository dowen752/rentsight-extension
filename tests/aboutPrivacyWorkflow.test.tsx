// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AboutPrivacy } from '../src/sidepanel/App';

describe('AboutPrivacy deletion workflow', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('requires confirmation before running the single signed-in deletion action', async () => {
    const deleteAllData = vi.fn(async () => undefined);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AboutPrivacy
          signedIn
          deleteAllData={deleteAllData}
          replayTour={() => undefined}
        />,
      );
    });

    const initialDelete = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Delete all data',
    );
    await act(async () => initialDelete?.click());

    expect(deleteAllData).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Delete all RentSight data?');
    expect(container.textContent).toContain(
      'Some payment records may be retained',
    );

    const confirmedDelete = Array.from(
      container.querySelectorAll('button'),
    ).find((button) => button.textContent === 'Delete account and all data');
    await act(async () => confirmedDelete?.click());

    expect(deleteAllData).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it('keeps a retryable deletion failure visible', async () => {
    const deleteAllData = vi.fn(async () => {
      throw new Error('Account deletion is temporarily unavailable.');
    });
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AboutPrivacy
          signedIn
          deleteAllData={deleteAllData}
          replayTour={() => undefined}
        />,
      );
    });

    const initialDelete = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Delete all data',
    );
    await act(async () => initialDelete?.click());
    const confirmedDelete = Array.from(
      container.querySelectorAll('button'),
    ).find((button) => button.textContent === 'Delete account and all data');
    await act(async () => confirmedDelete?.click());

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe(
      'Account deletion is temporarily unavailable.',
    );
    expect(container.textContent).toContain('Delete all data');
    await act(async () => root.unmount());
  });
});
