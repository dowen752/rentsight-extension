import type { RentalSearch, SearchCriterion } from './types';
import { HOTPADS_HOST_PERMISSION, hotpadsAppliedCriteria } from './hotpads';

export interface HotpadsLaunchOutcome {
  automated: boolean;
  message?: string;
}
export interface HotpadsPageResult {
  applied: SearchCriterion[];
  failed: SearchCriterion[];
  submitted?: boolean;
}
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Use HotPads' own location resolver instead of guessing its route slug. */
export async function resolveHotpadsLocationPage(
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
  if (location.origin !== 'https://hotpads.com') return false;
  const input = await waitFor(() =>
    document.querySelector<HTMLInputElement>(
      'input[data-testid="AutocompleteV2Input"]',
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
        return precise
          ? label.startsWith(normalized)
          : /^\d{5}$/.test(normalized)
            ? label.startsWith(normalized)
            : label.startsWith(`${normalized}, `);
      },
    ),
  );
  if (!option) return false;
  option.click();
  const searchButton = await waitFor(() =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Search' && !button.disabled,
    ),
  );
  if (!searchButton) return false;
  searchButton.click();
  return true;
}

/** Apply each HotPads criterion independently, verify it, then submit once. */
export async function fillHotpadsSearchPage(
  search: RentalSearch,
): Promise<HotpadsPageResult> {
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));
  const requestedWithLocation: SearchCriterion[] = [
    ...(search.location ? ['location' as const] : []),
    ...(search.minListedRent !== undefined ? ['minListedRent' as const] : []),
    ...(search.maxListedRent !== undefined ? ['maxListedRent' as const] : []),
    ...(search.minBedrooms !== undefined &&
    Number.isInteger(search.minBedrooms) &&
    search.minBedrooms >= 0 &&
    search.minBedrooms <= 4
      ? ['minBedrooms' as const]
      : []),
    ...(search.minBathrooms !== undefined &&
    Number.isInteger(search.minBathrooms) &&
    search.minBathrooms >= 0 &&
    search.minBathrooms <= 4
      ? ['minBathrooms' as const]
      : []),
    ...(search.propertyTypes?.length ? ['propertyTypes' as const] : []),
    ...(search.catsAllowed ? ['catsAllowed' as const] : []),
    ...(search.smallDogsAllowed ? ['smallDogsAllowed' as const] : []),
    ...(search.largeDogsAllowed ? ['largeDogsAllowed' as const] : []),
    ...(search.moveInDate ? ['moveInDate' as const] : []),
    ...(search.minSquareFeet !== undefined && search.minSquareFeet >= 0
      ? ['minSquareFeet' as const]
      : []),
    ...(search.parkingAvailable ? ['parkingAvailable' as const] : []),
    ...(search.inUnitLaundry ? ['inUnitLaundry' as const] : []),
    ...(search.airConditioning ? ['airConditioning' as const] : []),
  ];
  const applied: SearchCriterion[] = search.location ? ['location'] : [];
  const failed: SearchCriterion[] = [];
  const requested = requestedWithLocation.filter(
    (criterion) => criterion !== 'location',
  );
  const waitFor = async <T extends Element>(
    find: () => T | null | undefined,
    ms = 3_000,
  ): Promise<T> => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const value = find();
      if (value) return value;
      await sleep(100);
    }
    throw new Error('HotPads filter control unavailable');
  };
  const record = async (
    criteria: SearchCriterion[],
    action: () => Promise<void>,
  ) => {
    try {
      await action();
      applied.push(...criteria);
    } catch {
      failed.push(...criteria);
    }
  };
  if (location.origin !== 'https://hotpads.com')
    return { applied: [], failed: requestedWithLocation };

  const buttonByText = (root: ParentNode, label: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === label,
    );
  const needsRooms =
    requested.includes('minBedrooms') || requested.includes('minBathrooms');
  if (needsRooms) {
    const roomButton = await waitFor(() =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) =>
          button.getAttribute('aria-expanded') === 'false' &&
          (/rooms/i.test(button.textContent ?? '') ||
            /^.+\s\/\s.+$/.test(button.textContent?.trim() ?? '')),
      ),
    );
    roomButton.click();
    const roomDialog = await waitFor(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"]'),
      ).find((dialog) => dialog.textContent?.includes('Bedrooms')),
    );
    if (requested.includes('minBedrooms'))
      await record(['minBedrooms'], async () => {
        const minimum = search.minBedrooms!;
        if (minimum === 0) return;
        const bedrooms = roomDialog.querySelector<HTMLElement>(
          '[aria-label="Number of bedrooms"]',
        );
        if (!bedrooms) throw new Error('Bedroom controls unavailable');
        const minimumLabel = minimum === 4 ? '4+' : String(minimum);
        const start = buttonByText(bedrooms, minimumLabel);
        if (!start) throw new Error('Bedroom option unavailable');
        start.click();
        if (minimum < 4) buttonByText(bedrooms, '4+')?.click();
        await sleep(100);
        if (start.getAttribute('aria-pressed') !== 'true')
          throw new Error('Bedroom option was not retained');
      });
    if (requested.includes('minBathrooms'))
      await record(['minBathrooms'], async () => {
        const minimum = search.minBathrooms!;
        if (minimum === 0) return;
        const bathrooms = roomDialog.querySelector<HTMLElement>(
          '[aria-label="Number of bathrooms"]',
        );
        if (!bathrooms) throw new Error('Bathroom controls unavailable');
        const option = buttonByText(bathrooms, `${minimum}+`);
        if (!option) throw new Error('Bathroom option unavailable');
        option.click();
        await sleep(100);
        if (option.getAttribute('aria-pressed') !== 'true')
          throw new Error('Bathroom option was not retained');
      });
    buttonByText(roomDialog, 'Done')?.click();
  }

  const filterButton = await waitFor(() =>
    document.querySelector<HTMLButtonElement>(
      '[data-testid="button-all-filters"]',
    ),
  );
  filterButton.click();
  const dialog = await waitFor(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
      (candidate) => candidate.textContent?.includes('Price range'),
    ),
  );
  const setInput = async (input: HTMLInputElement, value: string) => {
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
  const numeric = (input: HTMLInputElement) =>
    Number(input.value.replace(/[^\d]/g, ''));
  const setNumeric = async (selector: string, value: number) => {
    const input = await waitFor(() =>
      dialog.querySelector<HTMLInputElement>(selector),
    );
    await setInput(input, String(value));
    if (numeric(input) !== value) throw new Error('Value was not retained');
  };
  const toggle = async (testId: string) => {
    const button = await waitFor(() =>
      dialog.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`),
    );
    if (button.getAttribute('aria-pressed') !== 'true') button.click();
    await sleep(100);
    if (button.getAttribute('aria-pressed') !== 'true')
      throw new Error('Toggle was not retained');
  };

  if (search.minListedRent !== undefined)
    await record(['minListedRent'], () =>
      setNumeric('[data-testid="filter-price-min"]', search.minListedRent!),
    );
  if (search.maxListedRent !== undefined)
    await record(['maxListedRent'], () =>
      setNumeric('[data-testid="filter-price-max"]', search.maxListedRent!),
    );
  if (search.propertyTypes?.length)
    await record(['propertyTypes'], async () => {
      const ids = search.propertyTypes!.flatMap((type) =>
        type === 'apartment_condo'
          ? ['filter-type-apartment', 'filter-type-condo']
          : type === 'house'
            ? ['filter-type-house']
            : ['filter-type-townhouse'],
      );
      for (const id of ids) await toggle(id);
    });
  if (search.minSquareFeet !== undefined)
    await record(['minSquareFeet'], () =>
      setNumeric(
        'input[aria-label="Minimum square feet"]',
        search.minSquareFeet!,
      ),
    );
  if (search.moveInDate)
    await record(['moveInDate'], async () => {
      const input = await waitFor(() =>
        dialog.querySelector<HTMLInputElement>('input[type="date"]'),
      );
      await setInput(input, search.moveInDate!);
      if (input.value !== search.moveInDate)
        throw new Error('Move-in date was not retained');
    });
  if (search.catsAllowed)
    await record(['catsAllowed'], () => toggle('filter-pet-cats'));
  const dogCriteria: SearchCriterion[] = [
    ...(search.smallDogsAllowed ? ['smallDogsAllowed' as const] : []),
    ...(search.largeDogsAllowed ? ['largeDogsAllowed' as const] : []),
  ];
  if (dogCriteria.length)
    await record(dogCriteria, () => toggle('filter-pet-dogs'));
  if (search.parkingAvailable)
    await record(['parkingAvailable'], () => toggle('filter-amenity-parking'));
  if (search.inUnitLaundry)
    await record(['inUnitLaundry'], () =>
      toggle('filter-amenity-in-unit-laundry'),
    );
  if (search.airConditioning)
    await record(['airConditioning'], () => toggle('filter-amenity-ac'));

  const submit = dialog.querySelector<HTMLButtonElement>(
    '[data-testid="filter-apply"]',
  );
  if (!submit) return { applied, failed: requested };
  submit.click();
  return { applied, failed, submitted: true };
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

export async function launchHotpadsSearch(
  search: RentalSearch,
  bootstrapUrl: string,
): Promise<HotpadsLaunchOutcome> {
  if (!search.location) {
    await chrome.tabs.create({ url: bootstrapUrl });
    return { automated: true };
  }
  const granted = await chrome.permissions.request({
    origins: [HOTPADS_HOST_PERMISSION],
  });
  if (!granted) {
    await chrome.tabs.create({ url: bootstrapUrl });
    return {
      automated: false,
      message:
        'HotPads opened without site access. Search and review its filters on site.',
    };
  }
  const tab = await chrome.tabs.create({ url: bootstrapUrl });
  if (!tab.id) throw new Error('HotPads opened without a usable tab.');
  try {
    if (
      !(await waitForTab(
        tab.id,
        (candidate) => candidate.status === 'complete',
      ))
    )
      throw new Error('HotPads landing page unavailable');
    const [locationInjection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: resolveHotpadsLocationPage,
      args: [search.location],
    });
    if (!locationInjection?.result)
      throw new Error('HotPads location unavailable');
    if (
      !(await waitForTab(
        tab.id,
        (candidate) =>
          candidate.status === 'complete' &&
          Boolean(candidate.url && new URL(candidate.url).pathname !== '/'),
      ))
    )
      throw new Error('HotPads results page unavailable');
    const requested = hotpadsAppliedCriteria(search).filter(
      (criterion) => criterion !== 'location',
    );
    if (!requested.length) return { automated: true };
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillHotpadsSearchPage,
      args: [search],
    });
    const result = injection?.result as HotpadsPageResult | undefined;
    if (
      !result?.submitted ||
      requested.some((criterion) => !result.applied.includes(criterion))
    )
      return {
        automated: false,
        message:
          'HotPads opened and applied the available filters. Review the remaining preferences on site.',
      };
    return { automated: true };
  } catch (error: unknown) {
    console.error('[RentSight] HotPads assisted search failed', error);
    return {
      automated: false,
      message:
        'HotPads opened, but its search could not be completed automatically. Review the location and filters on site.',
    };
  }
}
