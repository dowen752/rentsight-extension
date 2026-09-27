import type { RentalSearch, SearchCriterion } from './types';
import { ZUMPER_HOST_PERMISSION, zumperAppliedCriteria } from './zumper';

export interface ZumperLaunchOutcome {
  automated: boolean;
  message?: string;
}
export interface ZumperPageResult {
  applied: SearchCriterion[];
  failed: SearchCriterion[];
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function resolveZumperLocationPage(
  requested: string,
): Promise<boolean> {
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));
  const waitFor = async <T extends Element>(
    find: () => T | null | undefined,
    ms = 6_000,
  ): Promise<T | undefined> => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const value = find();
      if (value) return value;
      await sleep(100);
    }
  };
  if (location.origin !== 'https://www.zumper.com') return false;
  const input = await waitFor(() =>
    document.querySelector<HTMLInputElement>(
      'input[role="combobox"][aria-label="Search by location or property name"]',
    ),
  );
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  input.focus();
  setter?.call(input, requested);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const normalized = requested.trim().toLowerCase();
  const precise = /^.+,\s*[a-z]{2}$/i.test(requested);
  const option = await waitFor(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (candidate) => {
        const label = (candidate.textContent ?? '')
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase();
        return precise || /^\d{5}$/.test(normalized)
          ? label === normalized
          : label.startsWith(`${normalized}, `);
      },
    ),
  );
  if (!option) return false;
  option.click();
  return true;
}

/** Runs inside Zumper and applies each independent filter panel in sequence. */
export async function fillZumperSearchPage(
  search: RentalSearch,
): Promise<ZumperPageResult> {
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));
  const applied: SearchCriterion[] = search.location ? ['location'] : [];
  const failed: SearchCriterion[] = [];
  const waitFor = async <T extends Element>(
    find: () => T | null | undefined,
    ms = 4_000,
  ): Promise<T> => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const value = find();
      if (value) return value;
      await sleep(100);
    }
    throw new Error('Zumper filter control unavailable');
  };
  const text = (element: Element) =>
    (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const visible = (element: Element) => element.getClientRects().length > 0;
  const record = async (
    criteria: SearchCriterion[],
    action: () => Promise<void>,
  ) => {
    try {
      await action();
      for (const criterion of criteria)
        if (!applied.includes(criterion)) applied.push(criterion);
    } catch {
      for (const criterion of criteria)
        if (!failed.includes(criterion)) failed.push(criterion);
    }
  };
  if (location.origin !== 'https://www.zumper.com')
    return { applied: [], failed: [] };
  const button = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => visible(candidate) && text(candidate) === label,
    );
  const dismissSaveSearch = async (graceMs = 0) => {
    const deadline = Date.now() + graceMs;
    do {
      const dialog = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"]'),
      ).find(
        (candidate) =>
          visible(candidate) &&
          /save\s+search/i.test(text(candidate)) &&
          Boolean(
            candidate.querySelector(
              'input[type="email"], input[placeholder*="email" i]',
            ),
          ),
      );
      if (dialog) {
        const close = Array.from(
          dialog.querySelectorAll<HTMLButtonElement>('button'),
        ).find((candidate) => {
          const label = `${candidate.getAttribute('aria-label') ?? ''} ${
            candidate.getAttribute('title') ?? ''
          } ${text(candidate)}`.trim();
          if (/close|dismiss/i.test(label)) return true;
          return Array.from(candidate.querySelectorAll('[data-testid]')).some(
            (icon) => /close|dismiss/i.test(icon.getAttribute('data-testid') ?? ''),
          );
        });
        if (close) {
          close.click();
          await waitFor(
            () => (!visible(dialog) ? document.body : undefined),
            1_500,
          ).catch(() => undefined);
          return true;
        }
      }
      if (Date.now() < deadline) await sleep(100);
    } while (Date.now() < deadline);
    return false;
  };
  const openPanel = async (label: string) => {
    await dismissSaveSearch(750);
    const trigger = await waitFor(() => button(label));
    trigger.click();
    return waitFor(() => {
      const id = trigger.getAttribute('aria-controls');
      const controlled = id ? document.getElementById(id) : undefined;
      if (controlled && visible(controlled)) return controlled;
      return Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"]'),
      ).find(visible);
    });
  };
  const applyPanel = async (panel: HTMLElement) => {
    await dismissSaveSearch();
    const startingUrl = location.href;
    const apply = await waitFor(() =>
      Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidate) => /^View .+ results$/i.test(text(candidate)),
      ),
    );
    apply.click();
    await waitFor(
      () => (!visible(panel) ? document.body : undefined),
      2_000,
    ).catch(() => undefined);
    await waitFor(
      () => (location.href !== startingUrl ? document.body : undefined),
      2_000,
    ).catch(() => undefined);
    await sleep(400);
  };
  const setInput = async (input: HTMLInputElement, value: string) => {
    await dismissSaveSearch();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    input.focus();
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(100);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    await sleep(100);
  };
  const choose = async (root: ParentNode, label: string) => {
    await dismissSaveSearch();
    const input =
      root.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`) ??
      Array.from(root.querySelectorAll<HTMLInputElement>('input')).find(
        (candidate) =>
          Array.from(candidate.labels ?? []).some(
            (candidateLabel) => text(candidateLabel) === label,
          ),
      );
    if (input) {
      if (!input.checked) input.click();
      await sleep(100);
      if (!input.checked) throw new Error('Choice not retained');
      return;
    }
    const choice = Array.from(
      root.querySelectorAll<HTMLButtonElement>('button'),
    ).find((candidate) => text(candidate) === label);
    if (!choice) throw new Error('Choice unavailable');
    choice.click();
    await sleep(100);
  };
  const chooseRoom = async (
    panel: HTMLElement,
    section: 'Bedrooms' | 'Bathrooms',
    minimum: number,
  ) => {
    const options =
      section === 'Bedrooms'
        ? [
            { value: 0, label: 'studio' },
            { value: 1, label: '1 bedroom' },
            { value: 2, label: '2 bedrooms' },
            { value: 3, label: '3 bedrooms' },
            { value: 4, label: '4 bedrooms or more' },
          ]
        : [
            { value: 1, label: '1 bathroom' },
            { value: 2, label: '2 bathrooms' },
            { value: 3, label: '3 bathrooms' },
            { value: 4, label: '4 bathrooms' },
            { value: 5, label: '5 bathrooms or more' },
          ];
    const desired = options.filter(({ value }) => value >= minimum);
    if (!desired.length) throw new Error(`${section} choice unavailable`);
    for (const { label } of desired) {
      await dismissSaveSearch();
      const choice = panel.querySelector<HTMLInputElement>(
        `input[type="checkbox"][aria-label="${label}"]`,
      );
      if (!choice) throw new Error(`${section} choice unavailable`);
      if (!choice.checked) choice.click();
      await sleep(100);
      if (!choice.checked) throw new Error(`${section} choice not retained`);
    }
  };
  const needsRooms =
    search.minBedrooms !== undefined || search.minBathrooms !== undefined;
  if (needsRooms) {
    const panel = await openPanel('Beds/Baths');
    if (search.minBedrooms !== undefined)
      await record(['minBedrooms'], () =>
        chooseRoom(panel, 'Bedrooms', search.minBedrooms!),
      );
    if (search.minBathrooms !== undefined)
      await record(['minBathrooms'], () =>
        chooseRoom(panel, 'Bathrooms', search.minBathrooms!),
      );
    await applyPanel(panel);
  }
  if (
    search.minListedRent !== undefined ||
    search.maxListedRent !== undefined
  ) {
    const panel = await openPanel('Price');
    if (search.minListedRent !== undefined)
      await record(['minListedRent'], async () => {
        const input = await waitFor(() =>
          panel.querySelector<HTMLInputElement>(
            'input[aria-label="Min price"]',
          ),
        );
        await setInput(input, String(search.minListedRent));
        if (Number(input.value.replace(/\D/g, '')) !== search.minListedRent)
          throw new Error('Minimum price not retained');
      });
    if (search.maxListedRent !== undefined)
      await record(['maxListedRent'], async () => {
        const input = await waitFor(() =>
          panel.querySelector<HTMLInputElement>(
            'input[aria-label="Max price"]',
          ),
        );
        await setInput(input, String(search.maxListedRent));
        if (Number(input.value.replace(/\D/g, '')) !== search.maxListedRent)
          throw new Error('Maximum price not retained');
      });
    await applyPanel(panel);
  }
  if (search.propertyTypes?.length) {
    const panel = await openPanel('Type');
    await record(['propertyTypes'], async () => {
      const labels = search.propertyTypes!.flatMap((type) =>
        type === 'apartment_condo'
          ? ['Apartment', 'Condo']
          : type === 'house'
            ? ['House']
            : ['Townhouse'],
      );
      for (const label of labels) await choose(panel, label);
    });
    await applyPanel(panel);
  }
  const dogCriteria: SearchCriterion[] = [
    ...(search.smallDogsAllowed ? ['smallDogsAllowed' as const] : []),
    ...(search.largeDogsAllowed ? ['largeDogsAllowed' as const] : []),
  ];
  if (search.catsAllowed || dogCriteria.length) {
    const panel = await openPanel('Pets');
    if (search.catsAllowed)
      await record(['catsAllowed'], () => choose(panel, 'Cats allowed'));
    if (dogCriteria.length)
      await record(dogCriteria, () => choose(panel, 'Dogs allowed'));
    await applyPanel(panel);
  }
  if (
    search.minSquareFeet !== undefined ||
    search.inUnitLaundry ||
    search.airConditioning
  ) {
    const panel = await openPanel('More');
    if (search.minSquareFeet !== undefined)
      await record(['minSquareFeet'], async () => {
        const input = await waitFor(() =>
          panel.querySelector<HTMLInputElement>(
            'input[aria-label="minimum square feet"]',
          ),
        );
        await setInput(input, String(search.minSquareFeet));
        if (Number(input.value.replace(/\D/g, '')) !== search.minSquareFeet)
          throw new Error('Square footage not retained');
      });
    if (search.inUnitLaundry)
      await record(['inUnitLaundry'], () => choose(panel, 'In unit laundry'));
    if (search.airConditioning)
      await record(['airConditioning'], () => choose(panel, 'A/C'));
    await applyPanel(panel);
  }
  return { applied, failed };
}

async function waitForTab(
  tabId: number,
  predicate: (tab: chrome.tabs.Tab) => boolean,
): Promise<boolean> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId).catch(() => undefined);
    if (!tab) return false;
    if (predicate(tab)) return true;
    await sleep(150);
  }
  return false;
}

export async function launchZumperSearch(
  search: RentalSearch,
  bootstrapUrl: string,
): Promise<ZumperLaunchOutcome> {
  if (!search.location) {
    await chrome.tabs.create({ url: bootstrapUrl });
    return { automated: true };
  }
  const granted = await chrome.permissions.request({
    origins: [ZUMPER_HOST_PERMISSION],
  });
  if (!granted) {
    await chrome.tabs.create({ url: bootstrapUrl });
    return {
      automated: false,
      message:
        'Zumper opened without site access. Search and review its filters on site.',
    };
  }
  const tab = await chrome.tabs.create({ url: bootstrapUrl });
  if (!tab.id) throw new Error('Zumper opened without a usable tab.');
  try {
    if (
      !(await waitForTab(
        tab.id,
        (candidate) => candidate.status === 'complete',
      ))
    )
      throw new Error('Zumper landing page unavailable');
    const [locationResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: resolveZumperLocationPage,
      args: [search.location],
    });
    if (!locationResult?.result) throw new Error('Zumper location unavailable');
    if (
      !(await waitForTab(
        tab.id,
        (candidate) =>
          candidate.status === 'complete' &&
          Boolean(candidate.url?.includes('/apartments-for-rent/')),
      ))
    )
      throw new Error('Zumper results unavailable');
    const requested = zumperAppliedCriteria(search).filter(
      (criterion) => criterion !== 'location',
    );
    if (!requested.length) return { automated: true };
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillZumperSearchPage,
      args: [search],
    });
    const result = injection?.result as ZumperPageResult | undefined;
    if (
      !result ||
      requested.some((criterion) => !result.applied.includes(criterion))
    )
      return {
        automated: false,
        message:
          'Zumper opened and applied the available filters. Review the remaining preferences on site.',
      };
    return { automated: true };
  } catch (error: unknown) {
    console.error('[RentSight] Zumper assisted search failed', error);
    return {
      automated: false,
      message:
        'Zumper opened, but its search could not be completed automatically. Review the location and filters on site.',
    };
  }
}
