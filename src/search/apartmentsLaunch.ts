import type { RentalSearch, SearchCriterion } from './types';
import {
  APARTMENTS_HOST_PERMISSION,
  APARTMENTS_ORIGIN,
  apartmentsAppliedCriteria,
  apartmentsNeedsPageFill,
} from './apartments';

const APARTMENTS_LOAD_TIMEOUT_MS = 20_000;

export interface ApartmentsLaunchOutcome {
  automated: boolean;
  message?: string;
}

export interface ApartmentsPageFillResult {
  applied: SearchCriterion[];
  failed: SearchCriterion[];
}

export interface ApartmentsLocationResult {
  ready: boolean;
  submitted: boolean;
}

function waitForApartmentsTab(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      clearTimeout(timeout);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    const onUpdated = (
      updatedTabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
    ) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') finish();
    };
    const onRemoved = (removedTabId: number) => {
      if (removedTabId === tabId)
        fail('The Apartments.com tab was closed before its search was ready.');
    };
    const timeout = setTimeout(
      () => fail('Apartments.com took too long to prepare the search.'),
      APARTMENTS_LOAD_TIMEOUT_MS,
    );
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    void chrome.tabs.get(tabId).then(
      (tab) => {
        if (tab.status === 'complete') finish();
      },
      () => fail('The Apartments.com search tab is no longer available.'),
    );
  });
}

function waitForApartmentsNavigation(
  tabId: number,
  previousUrl: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let navigated = false;
    let settled = false;
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      clearTimeout(timeout);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };
    const onUpdated = (
      updatedTabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.url && changeInfo.url !== previousUrl) navigated = true;
      if (navigated && changeInfo.status === 'complete') finish();
      if (tab.url && tab.url !== previousUrl) navigated = true;
    };
    const onRemoved = (removedTabId: number) => {
      if (removedTabId === tabId)
        fail('The Apartments.com tab was closed during location search.');
    };
    const timeout = setTimeout(
      () => fail('Apartments.com did not finish resolving the location.'),
      APARTMENTS_LOAD_TIMEOUT_MS,
    );
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    void chrome.tabs.get(tabId).then(
      (tab) => {
        if (tab.url && tab.url !== previousUrl) navigated = true;
        if (navigated && tab.status === 'complete') finish();
      },
      () => fail('The Apartments.com search tab is no longer available.'),
    );
  });
}

/** Uses Apartments.com's own location lookup when a plain slug is ambiguous. */
export async function resolveApartmentsLocationPage(
  requestedLocation: string,
): Promise<ApartmentsLocationResult> {
  if (document.querySelector('#advancedFiltersIcon'))
    return { ready: true, submitted: false };
  const sleep = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  const deadline = Date.now() + 5_000;
  let input: HTMLInputElement | null = null;
  while (Date.now() < deadline && !input) {
    input = document.querySelector<HTMLInputElement>('#quickSearchLookup');
    if (!input) await sleep(100);
  }
  if (!input) return { ready: false, submitted: false };
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  input.focus();
  setter?.call(input, requestedLocation);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(250);
  const searchButton = Array.from(
    document.querySelectorAll<HTMLElement>('button,a,input[type="submit"]'),
  ).find((element) => /^search$/i.test((element.textContent ?? '').trim()));
  if (!searchButton) return { ready: false, submitted: false };
  searchButton.click();
  return { ready: false, submitted: true };
}

/** Runs in Apartments.com's isolated extension world using visible search controls. */
export async function fillApartmentsSearchPage(
  search: RentalSearch,
): Promise<ApartmentsPageFillResult> {
  const applied: SearchCriterion[] = [];
  const failed: SearchCriterion[] = [];
  const sleep = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  const waitFor = async <T extends Element>(
    find: () => T | undefined,
    timeoutMs = 5_000,
  ): Promise<T> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const element = find();
      if (element) return element;
      await sleep(100);
    }
    throw new Error(
      'An Apartments.com search control did not become available.',
    );
  };
  const setInput = async (input: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    input.focus();
    setter?.call(input, value);
    input.dispatchEvent(
      typeof InputEvent === 'function'
        ? new InputEvent('input', {
            bubbles: true,
            data: value,
            inputType: 'insertText',
          })
        : new Event('input', { bubbles: true }),
    );
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    await sleep(100);
  };
  const activateCustomControl = (element: HTMLElement) => {
    element.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    for (const type of ['mousedown', 'mouseup', 'click']) {
      element.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    }
  };
  const record = (
    destination: SearchCriterion[],
    criterion: SearchCriterion,
  ) => {
    if (!destination.includes(criterion)) destination.push(criterion);
  };
  const canApplyBedrooms =
    search.minBedrooms !== undefined &&
    Number.isInteger(search.minBedrooms) &&
    search.minBedrooms >= 0 &&
    search.minBedrooms <= 4;
  const canApplyBathrooms =
    search.minBathrooms !== undefined &&
    Number.isInteger(search.minBathrooms) &&
    search.minBathrooms >= 1 &&
    search.minBathrooms <= 3;
  const canApplyPropertyType = Boolean(search.propertyTypes?.length);

  if (location.origin !== 'https://www.apartments.com') {
    return {
      applied,
      failed: [
        ...(search.location ? (['location'] as const) : []),
        ...(search.minListedRent !== undefined
          ? (['minListedRent'] as const)
          : []),
        ...(search.maxListedRent !== undefined
          ? (['maxListedRent'] as const)
          : []),
        ...(canApplyBedrooms ? (['minBedrooms'] as const) : []),
        ...(canApplyBathrooms ? (['minBathrooms'] as const) : []),
        ...(canApplyPropertyType ? (['propertyTypes'] as const) : []),
      ],
    };
  }

  // The location is encoded in the results-page route before this script runs.
  if (search.location) record(applied, 'location');
  if (search.moveInDate) {
    const compactDate = /^\d{4}-\d{2}-\d{2}$/.test(search.moveInDate)
      ? search.moveInDate.replaceAll('-', '')
      : undefined;
    if (
      compactDate &&
      new URL(location.href).searchParams.get('mid') === compactDate
    )
      record(applied, 'moveInDate');
  }

  const rentCriteria = [
    ...(search.minListedRent !== undefined ? (['minListedRent'] as const) : []),
    ...(search.maxListedRent !== undefined ? (['maxListedRent'] as const) : []),
  ];
  if (rentCriteria.length) {
    try {
      document.querySelector<HTMLElement>('#rentRangeLink')?.click();
      const minimum =
        search.minListedRent !== undefined
          ? await waitFor(
              () =>
                document.querySelector<HTMLInputElement>(
                  '#min-input, input.min-rent-select, input[placeholder="Min Price"]',
                ) ?? undefined,
            )
          : undefined;
      const maximum =
        search.maxListedRent !== undefined
          ? await waitFor(
              () =>
                document.querySelector<HTMLInputElement>(
                  '#max-input, input.max-rent-select, input[placeholder="Max Price"]',
                ) ?? undefined,
            )
          : undefined;
      if (minimum) await setInput(minimum, String(search.minListedRent));
      if (maximum) await setInput(maximum, String(search.maxListedRent));
      document
        .querySelector<HTMLElement>(
          '#rentRangeLink ~ .dropdownContent .done-btn, .rentRangeSelector .done-btn',
        )
        ?.click();
      for (const criterion of rentCriteria) record(applied, criterion);
    } catch {
      for (const criterion of rentCriteria) record(failed, criterion);
    }
  }

  const chooseRangeButton = async (
    selector: string,
    value: number,
  ): Promise<boolean> => {
    const button = await waitFor(
      () =>
        document.querySelector<HTMLButtonElement>(
          `${selector}[data-value="${value}"]`,
        ) ?? undefined,
    );
    if (!button.classList.contains('highlighted')) button.click();
    await sleep(100);
    return button.classList.contains('highlighted');
  };
  const roomCriteria: SearchCriterion[] = [
    ...(canApplyBedrooms ? (['minBedrooms'] as const) : []),
  ];
  if (roomCriteria.length) {
    try {
      document.querySelector<HTMLElement>('#bedRangeLink')?.click();
      if (
        search.minBedrooms !== undefined &&
        search.minBedrooms > 0 &&
        roomCriteria.includes('minBedrooms') &&
        !(await chooseRangeButton('.bed-filter-button', search.minBedrooms))
      )
        throw new Error('Bedroom selection was not accepted.');
      document
        .querySelector<HTMLElement>('.bedsRangeSelector .done-btn')
        ?.click();
      for (const criterion of roomCriteria) record(applied, criterion);
    } catch {
      for (const criterion of roomCriteria) record(failed, criterion);
    }
  }

  if (canApplyPropertyType) {
    try {
      document.querySelector<HTMLElement>('#typeSelect')?.click();
      const desired = new Set(
        search.propertyTypes?.flatMap((propertyType) =>
          propertyType === 'apartment_condo'
            ? ['1', '4']
            : propertyType === 'house'
              ? ['2']
              : ['16'],
        ),
      );
      for (const value of ['1', '2', '4', '16']) {
        const choice = await waitFor(
          () =>
            document.querySelector<HTMLButtonElement>(
              `#PropertyType-${value}`,
            ) ?? undefined,
        );
        const selected =
          choice.classList.contains('selected') ||
          choice.classList.contains('highlighted') ||
          choice.getAttribute('aria-pressed') === 'true';
        if (selected !== desired.has(value)) choice.click();
      }
      document
        .querySelector<HTMLElement>(
          '.propertyTypeSelector .done-btn, #typeSelect ~ .dropdownContent .done-btn',
        )
        ?.click();
      record(applied, 'propertyTypes');
    } catch {
      record(failed, 'propertyTypes');
    }
  }

  const detailedOptions: Array<{
    criterion: SearchCriterion;
    enabled: boolean;
    label?: string;
  }> = [
    { criterion: 'minBathrooms', enabled: canApplyBathrooms },
    { criterion: 'catsAllowed', enabled: Boolean(search.catsAllowed) },
    {
      criterion: 'smallDogsAllowed',
      enabled: Boolean(search.smallDogsAllowed),
    },
    {
      criterion: 'largeDogsAllowed',
      enabled: Boolean(search.largeDogsAllowed),
    },
    {
      criterion: 'minSquareFeet',
      enabled:
        search.minSquareFeet !== undefined &&
        Number.isFinite(search.minSquareFeet) &&
        search.minSquareFeet >= 0 &&
        search.minSquareFeet <= 4_500,
    },
    {
      criterion: 'parkingAvailable',
      enabled: Boolean(search.parkingAvailable),
      label: 'Parking',
    },
    {
      criterion: 'inUnitLaundry',
      enabled: Boolean(search.inUnitLaundry),
      label: 'In Unit Washer & Dryer',
    },
    {
      criterion: 'airConditioning',
      enabled: Boolean(search.airConditioning),
      label: 'Air Conditioning',
    },
  ];
  const detailedCriteria = detailedOptions.filter(({ enabled }) => enabled);
  if (detailedCriteria.length) {
    let detailedModalOpened = false;
    const applyDetailed = async (
      criteria: SearchCriterion[],
      action: () => Promise<void>,
    ) => {
      try {
        await action();
        for (const criterion of criteria) record(applied, criterion);
      } catch {
        for (const criterion of criteria) record(failed, criterion);
      }
    };
    try {
      document.querySelector<HTMLElement>('#advancedFiltersIcon')?.click();
      await waitFor(
        () => document.querySelector<HTMLElement>('#seeResultBtn') ?? undefined,
      );
      detailedModalOpened = true;
      if (canApplyBathrooms && search.minBathrooms !== undefined) {
        await applyDetailed(['minBathrooms'], async () => {
          if (
            !(await chooseRangeButton(
              '.advancedFilters .bath-filter-button, .bath-filter-container .bath-filter-button',
              search.minBathrooms!,
            ))
          )
            throw new Error('Bathroom selection was not accepted.');
        });
      }
      const petCriteria = detailedCriteria.filter(({ criterion }) =>
        ['catsAllowed', 'smallDogsAllowed', 'largeDogsAllowed'].includes(
          criterion,
        ),
      );
      if (petCriteria.length) {
        const petLabel =
          search.catsAllowed &&
          (search.smallDogsAllowed || search.largeDogsAllowed)
            ? 'Dog and Cat Allowed'
            : search.catsAllowed
              ? 'Cat Friendly'
              : 'Dog Friendly';
        await applyDetailed(
          petCriteria.map(({ criterion }) => criterion),
          async () => {
            const petButton = await waitFor(
              () =>
                document.querySelector<HTMLElement>(
                  '#adv-petPolicy-select-button',
                ) ?? undefined,
              1_500,
            );
            petButton.click();
            const option = await waitFor(
              () =>
                Array.from(
                  document.querySelectorAll<HTMLElement>(
                    '#adv-petPolicy-select-menu [role="option"]',
                  ),
                ).find(
                  (candidate) =>
                    (candidate.textContent ?? '').trim() === petLabel,
                ),
              1_500,
            );
            activateCustomControl(option);
            await waitFor(() => {
              const selected = (
                document.querySelector<HTMLElement>(
                  '#adv-petPolicy-select-button .ui-selectmenu-text',
                )?.textContent ??
                petButton.textContent ??
                ''
              ).trim();
              return selected === petLabel ? petButton : undefined;
            }, 1_500);
          },
        );
      }
      if (search.minSquareFeet !== undefined) {
        await applyDetailed(['minSquareFeet'], async () => {
          const select = await waitFor(
            () =>
              document.querySelector<HTMLSelectElement>('#minSF') ?? undefined,
          );
          const available = Array.from(select.options)
            .map((option) => Number(option.value))
            .filter((value) => Number.isFinite(value) && value > 0)
            .sort((a, b) => a - b);
          const rounded = available.find(
            (value) => value >= search.minSquareFeet!,
          );
          if (rounded === undefined)
            throw new Error('Square-footage options were unavailable.');
          const squareFootageButton = await waitFor(
            () =>
              document.querySelector<HTMLElement>('#minSF-button') ?? undefined,
          );
          squareFootageButton.click();
          const squareFootageOption = await waitFor(
            () =>
              Array.from(
                document.querySelectorAll<HTMLElement>(
                  '#minSF-menu [role="option"]',
                ),
              ).find(
                (candidate) =>
                  Number(
                    (candidate.textContent ?? '').replace(/[^0-9]/g, ''),
                  ) === rounded,
              ),
            1_500,
          );
          activateCustomControl(squareFootageOption);
          await waitFor(() => {
            const selected = (
              document.querySelector<HTMLElement>(
                '#minSF-button .ui-selectmenu-text',
              )?.textContent ??
              squareFootageButton.textContent ??
              ''
            ).replace(/[^0-9]/g, '');
            return Number(selected) === rounded
              ? squareFootageButton
              : undefined;
          }, 1_500);
        });
      }
      for (const item of detailedCriteria) {
        if (!item.label) continue;
        await applyDetailed([item.criterion], async () => {
          const button = await waitFor(() =>
            Array.from(
              document.querySelectorAll<HTMLButtonElement>('button'),
            ).find(
              (candidate) =>
                (candidate.textContent ?? '').trim() === item.label,
            ),
          );
          const selected =
            button.classList.contains('selected') ||
            button.classList.contains('highlighted') ||
            button.getAttribute('aria-pressed') === 'true';
          if (!selected) button.click();
        });
      }
    } catch {
      for (const { criterion } of detailedCriteria) {
        if (!applied.includes(criterion)) record(failed, criterion);
      }
    } finally {
      if (detailedModalOpened)
        document.querySelector<HTMLElement>('#seeResultBtn')?.click();
    }
  }

  return { applied, failed };
}

export async function launchApartmentsSearch(
  search: RentalSearch,
  bootstrapUrl: string,
): Promise<ApartmentsLaunchOutcome> {
  const destination = new URL(bootstrapUrl);
  if (destination.origin !== APARTMENTS_ORIGIN)
    throw new Error(
      'RentSight blocked an unexpected Apartments.com destination.',
    );
  destination.hash = '';

  if (!apartmentsNeedsPageFill(search)) {
    await chrome.tabs.create({ url: destination.toString() });
    return { automated: false };
  }

  let granted = false;
  try {
    granted = await chrome.permissions.request({
      origins: [APARTMENTS_HOST_PERMISSION],
    });
  } catch (error: unknown) {
    console.error(
      '[RentSight] Apartments.com site access request failed',
      error,
    );
  }
  const tab = await chrome.tabs.create({ url: destination.toString() });
  if (!granted) {
    return {
      automated: false,
      message:
        'Apartments.com opened. Site access is needed to apply its supported filters automatically.',
    };
  }
  if (tab.id === undefined)
    throw new Error(
      'Apartments.com opened, but its tab could not be prepared.',
    );

  try {
    await waitForApartmentsTab(tab.id);
    const [locationInjection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: resolveApartmentsLocationPage,
      args: [search.location ?? ''],
    });
    const locationResult = locationInjection?.result as
      ApartmentsLocationResult | undefined;
    if (locationResult?.submitted) {
      await waitForApartmentsNavigation(tab.id, destination.toString());
    } else if (!locationResult?.ready) {
      throw new Error(
        'Apartments.com could not resolve the requested location.',
      );
    }
    if (search.moveInDate && /^\d{4}-\d{2}-\d{2}$/.test(search.moveInDate)) {
      const currentTab = await chrome.tabs.get(tab.id);
      if (currentTab.url) {
        const currentUrl = new URL(currentTab.url);
        const compactDate = search.moveInDate.replaceAll('-', '');
        if (
          currentUrl.origin === APARTMENTS_ORIGIN &&
          currentUrl.searchParams.get('mid') !== compactDate
        ) {
          currentUrl.searchParams.set('mid', compactDate);
          await chrome.tabs.update(tab.id, { url: currentUrl.toString() });
          await waitForApartmentsTab(tab.id);
        }
      }
    }
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillApartmentsSearchPage,
      args: [search],
    });
    const result = injection?.result as ApartmentsPageFillResult | undefined;
    if (!result)
      throw new Error('Apartments.com did not return filter results.');
    const requested = apartmentsAppliedCriteria(search);
    const unapplied = requested.filter(
      (criterion) => !result.applied.includes(criterion),
    );
    if (unapplied.length) {
      return {
        automated: false,
        message:
          'Apartments.com opened and applied the available filters. Review the remaining preferences on site.',
      };
    }
    return { automated: true };
  } catch (error: unknown) {
    console.error('[RentSight] Apartments.com assisted search failed', error);
    return {
      automated: false,
      message:
        'Apartments.com opened, but its filters could not be applied automatically. Review them on site.',
    };
  }
}
