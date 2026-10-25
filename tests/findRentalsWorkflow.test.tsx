// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FindRentalsView } from '../src/sidepanel/FindRentalsView';
import { extensionStorage } from '../src/storage';
import type { HouseholdProfile } from '../src/shared/household';

function enter(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Search workflow', () => {
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

  it('allows household counts to be cleared and restores defaults on blur', async () => {
    const updateHouseholdProfile = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FindRentalsView updateHouseholdProfile={updateHouseholdProfile} />,
      );
    });
    const inputFor = (labelText: string) =>
      Array.from(container.querySelectorAll('label'))
        .find((label) => label.textContent?.includes(labelText))!
        .querySelector<HTMLInputElement>('input')!;
    const occupants = inputFor('Occupants');
    const cats = inputFor('Cats');

    await act(async () => {
      enter(occupants, '');
      enter(cats, '');
    });
    expect(occupants.value).toBe('');
    expect(cats.value).toBe('');

    await act(async () => {
      occupants.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      cats.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(occupants.value).toBe('1');
    expect(cats.value).toBe('0');
    expect(updateHouseholdProfile).toHaveBeenCalledWith({
      occupants: 1,
      cats: 0,
      smallDogs: 0,
      largeDogs: 0,
    });
  });

  it('shows styled validation and prevents saving invalid bathroom increments', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<FindRentalsView />);
    });
    const bathrooms = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent?.includes('Minimum bathrooms'))!
      .querySelector<HTMLInputElement>('input')!;
    await act(async () => {
      enter(bathrooms, '3.2');
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Save Preferences')!
        .click();
    });
    expect(container.querySelector('form')?.noValidate).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Enter bathrooms in half-bath increments.',
    );
    expect(container.querySelector('.search-error-icon')).not.toBeNull();
    expect(extensionStorage.set).not.toHaveBeenCalled();
    await act(async () => {
      enter(bathrooms, '3.5');
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Save Preferences')!
        .click();
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(extensionStorage.set).toHaveBeenCalledWith('searchProfile', {
      schemaVersion: 2,
      search: { minBathrooms: 3.5 },
    });
    await act(async () => {
      root.unmount();
    });
  });

  it('saves optional preferences, shows all sites, and opens a routed search', async () => {
    const openUrl = vi.fn().mockResolvedValue(undefined);
    const openApartments = vi.fn().mockResolvedValue({ automated: true });
    const openRealtor = vi.fn().mockResolvedValue({ automated: true });
    const openRedfin = vi.fn().mockResolvedValue({ automated: true });
    const openRent = vi.fn().mockResolvedValue({ automated: true });
    const openHotpads = vi.fn().mockResolvedValue({ automated: true });
    const openZumper = vi.fn().mockResolvedValue({ automated: true });
    let finishZillow: ((outcome: { automated: boolean }) => void) | undefined;
    const openZillow = vi.fn<
      (search: unknown, bootstrapUrl: string) => Promise<{ automated: boolean }>
    >(
      () =>
        new Promise<{ automated: boolean }>((resolve) => {
          finishZillow = resolve;
        }),
    );
    const updateHouseholdProfile = vi.fn();
    const householdProfile: HouseholdProfile = {
      occupants: 1,
      cats: 1,
      smallDogs: 1,
      largeDogs: 1,
    };
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FindRentalsView
          householdProfile={householdProfile}
          updateHouseholdProfile={updateHouseholdProfile}
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
    const maxRent = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent?.includes('Maximum listed rent'))!
      .querySelector<HTMLInputElement>('input')!;
    const occupants = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent?.includes('Occupants'))!
      .querySelector<HTMLInputElement>('input')!;
    const parkingLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent?.includes('Parking available'),
    )!;
    const moveInDate =
      container.querySelector<HTMLInputElement>('input[type="date"]')!;

    await act(async () => {
      enter(occupants, '2');
      enter(location, 'Seattle, WA');
      enter(maxRent, '2000');
      enter(moveInDate, '2026-11-15');
      parkingLabel.querySelector<HTMLInputElement>('input')!.click();
    });
    expect(updateHouseholdProfile).toHaveBeenCalledWith({
      ...householdProfile,
      occupants: 2,
    });
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Save Preferences'))!
        .click();
    });

    expect(extensionStorage.set).toHaveBeenCalledWith('searchProfile', {
      schemaVersion: 2,
      search: {
        location: 'Seattle, WA',
        maxListedRent: 2000,
        parkingAvailable: true,
        moveInDate: '2026-11-15',
      },
    });
    expect(container.querySelectorAll('.search-site-card')).toHaveLength(7);
    expect(container.textContent).not.toContain('Will apply:');
    expect(container.textContent).not.toContain('Applied:');
    expect(container.textContent).toContain('Check on site: parking');
    expect(container.textContent).not.toContain('small dogs allowed');
    expect(container.textContent).not.toContain('large dogs allowed');
    expect(container.textContent).not.toContain('cats allowed');
    expect(container.textContent).not.toContain('Pet-friendly filters');
    expect(container.textContent).not.toContain('Internet / month');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Open Zillow'))!
        .click();
    });
    expect(openZillow).toHaveBeenCalledOnce();
    expect(openZillow.mock.calls[0][0]).toMatchObject({
      catsAllowed: true,
      smallDogsAllowed: true,
      largeDogsAllowed: true,
      moveInDate: '2026-11-15',
    });
    expect(new URL(openZillow.mock.calls[0][1]).origin).toBe(
      'https://www.zillow.com',
    );
    const zillowCard = Array.from(
      container.querySelectorAll<HTMLElement>('.search-site-card'),
    ).find((card) => card.querySelector('h3')?.textContent === 'Zillow')!;
    expect(zillowCard.getAttribute('aria-busy')).toBe('true');
    expect(
      zillowCard
        .querySelector('.site-launch-spinner')
        ?.getAttribute('aria-label'),
    ).toBe('Applying filters to Zillow');
    expect(zillowCard.querySelector('button')?.disabled).toBe(true);

    await act(async () => {
      finishZillow!({ automated: true });
      await Promise.resolve();
    });
    expect(zillowCard.getAttribute('aria-busy')).toBe('false');
    expect(zillowCard.querySelector('.site-launch-spinner')).toBeNull();
    expect(zillowCard.querySelector('button')?.disabled).toBe(false);

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Open Apartments.com'))!
        .click();
    });
    expect(openApartments).toHaveBeenCalledOnce();
    expect(openApartments.mock.calls[0][0]).toMatchObject({
      moveInDate: '2026-11-15',
    });
    expect(new URL(openApartments.mock.calls[0][1]).href).toBe(
      'https://www.apartments.com/',
    );

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Open Realtor.com'))!
        .click();
    });
    expect(openRealtor).toHaveBeenCalledOnce();
    expect(new URL(openRealtor.mock.calls[0][1]).href).toBe(
      'https://www.realtor.com/rentals',
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
