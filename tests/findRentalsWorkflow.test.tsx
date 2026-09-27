// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FindRentalsView } from '../src/sidepanel/FindRentalsView';
import { extensionStorage } from '../src/storage';

function enter(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Find rentals workflow', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(extensionStorage, 'get').mockResolvedValue(undefined);
    vi.spyOn(extensionStorage, 'set').mockResolvedValue();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('saves optional preferences, shows all sites, and opens a routed search', async () => {
    const openUrl = vi.fn().mockResolvedValue(undefined);
    const openApartments = vi.fn().mockResolvedValue({ automated: true });
    const openRealtor = vi.fn().mockResolvedValue({ automated: true });
    const openRedfin = vi.fn().mockResolvedValue({ automated: true });
    const openRent = vi.fn().mockResolvedValue({ automated: true });
    const openHotpads = vi.fn().mockResolvedValue({ automated: true });
    const openZumper = vi.fn().mockResolvedValue({ automated: true });
    const openZillow = vi.fn().mockResolvedValue({ automated: true });
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FindRentalsView
          openUrl={openUrl}
          openApartments={openApartments}
          openRealtor={openRealtor}
          openRedfin={openRedfin}
          openRent={openRent}
          openHotpads={openHotpads}
          openZumper={openZumper}
          openZillow={openZillow}
        />,
      );
    });

    const location = container.querySelector<HTMLInputElement>(
      'input[placeholder="City, state or ZIP"]',
    )!;
    const maxRent = container.querySelectorAll<HTMLInputElement>(
      'input[type="number"]',
    )[1];
    const parkingLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent?.includes('Parking available'),
    )!;

    await act(async () => {
      enter(location, 'Seattle, WA');
      enter(maxRent, '2000');
      parkingLabel.querySelector<HTMLInputElement>('input')!.click();
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Show rental sites'))!
        .click();
    });

    expect(extensionStorage.set).toHaveBeenCalledWith('searchProfile', {
      schemaVersion: 2,
      search: {
        location: 'Seattle, WA',
        maxListedRent: 2000,
        parkingAvailable: true,
      },
    });
    expect(container.querySelectorAll('.search-site-card')).toHaveLength(7);
    expect(container.textContent).toContain(
      'Will apply: location, maximum rent, parking',
    );
    expect(container.textContent).toContain('Check on site: parking');
    expect(container.textContent).toContain('Small dogs allowed');
    expect(container.textContent).toContain('Large dogs allowed');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Open Zillow'))!
        .click();
    });
    expect(openZillow).toHaveBeenCalledOnce();
    expect(new URL(openZillow.mock.calls[0][1]).origin).toBe(
      'https://www.zillow.com',
    );

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Open Apartments.com'))!
        .click();
    });
    expect(openApartments).toHaveBeenCalledOnce();
    expect(new URL(openApartments.mock.calls[0][1]).href).toBe(
      'https://www.apartments.com/seattle-wa/',
    );

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Open Realtor.com'))!
        .click();
    });
    expect(openRealtor).toHaveBeenCalledOnce();
    expect(new URL(openRealtor.mock.calls[0][1]).href).toBe(
      'https://www.realtor.com/apartments/seattle_WA',
    );

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Open Redfin'))!
        .click();
    });
    expect(openRedfin).toHaveBeenCalledOnce();
    expect(openRedfin.mock.calls[0][1]).toBe('https://www.redfin.com/rentals');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Open Rent.com'))!
        .click();
    });
    expect(openRent).toHaveBeenCalledOnce();
    expect(openRent.mock.calls[0][1]).toBe('https://www.rent.com/');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Open HotPads'))!
        .click();
    });
    expect(openHotpads).toHaveBeenCalledOnce();
    expect(openHotpads.mock.calls[0][1]).toBe('https://hotpads.com/');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Open Zumper'))!
        .click();
    });
    expect(openZumper).toHaveBeenCalledOnce();
    expect(openZumper.mock.calls[0][1]).toBe('https://www.zumper.com/');

    await act(async () => root.unmount());
  });
});
