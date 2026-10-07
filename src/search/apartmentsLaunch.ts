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
    const inspect = (tab: chrome.tabs.Tab) => {
      if (tab.url && tab.url !== previousUrl) navigated = true;
      if (navigated && tab.status === 'complete') finish();
    };
    const onUpdated = (
      updatedTabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.url && changeInfo.url !== previousUrl) navigated = true;
      inspect(tab);
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
    void chrome.tabs
      .get(tabId)
      .then(inspect, () =>
        fail('The Apartments.com search tab is no longer available.'),
      );
  });
}

/** Gives the raw location to Apartments.com's own smart search. */
export async function resolveApartmentsLocationPage(
  requestedLocation: string,
): Promise<ApartmentsLocationResult> {
  if (document.querySelector('#advancedFiltersIcon'))
    return { ready: true, submitted: false };

  const sleep = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  const deadline = Date.now() + 5_000;
  let input: HTMLElement | null = null;
  let searchButton: HTMLButtonElement | null = null;
  while (Date.now() < deadline && (!input || !searchButton)) {
    input = document.querySelector<HTMLElement>(
      '#homepage-smart-search .smart-search-input[contenteditable]',
    );
    searchButton = document.querySelector<HTMLButtonElement>(
      '#homepage-smart-search .smart-search-btn-search',
    );
    if (!input || !searchButton) await sleep(100);
  }
  if (!input || !searchButton || !requestedLocation.trim())
    return { ready: false, submitted: false };

  input.focus();
  input.textContent = requestedLocation;
  input.dispatchEvent(
    typeof InputEvent === 'function'
      ? new InputEvent('input', {
          bubbles: true,
          data: requestedLocation,
          inputType: 'insertText',
        })
      : new Event('input', { bubbles: true }),
  );
  input.dispatchEvent(new Event('change', { bubbles: true }));
  // Apartments.com resolves autocomplete options asynchronously. Submitting
  // immediately after the input event leaves the populated menu open without
  // actually choosing its highlighted result.
  await sleep(600);
  input.focus();
  let enterHandled = false;
  for (const type of ['keydown', 'keypress', 'keyup']) {
    const dispatched = input.dispatchEvent(
      new KeyboardEvent(type, {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );
    if (type === 'keydown' && !dispatched) enterHandled = true;
  }
  // Keep the visible search control as a fallback for page variants that do
  // not submit from Enter. Re-query it in case autocomplete re-rendered.
  searchButton = document.querySelector<HTMLButtonElement>(
    '#homepage-smart-search .smart-search-btn-search',
  );
  if (searchButton && !enterHandled) {
    for (const type of ['mousedown', 'mouseup', 'click']) {
      searchButton.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    }
  }
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

  const rentCriteria = [
    ...(search.minListedRent !== undefined ? (['minListedRent'] as const) : []),
    ...(search.maxListedRent !== undefined ? (['maxListedRent'] as const) : []),
  ];
  const hasDetailedRequest = Boolean(
    canApplyBathrooms ||
    search.catsAllowed ||
    search.smallDogsAllowed ||
    search.largeDogsAllowed ||
    search.moveInDate ||
    search.minSquareFeet !== undefined ||
    search.parkingAvailable ||
    search.inUnitLaundry ||
    search.airConditioning,
  );
  let advancedModalOpened = false;
  if (
    rentCriteria.length ||
    canApplyBedrooms ||
    canApplyPropertyType ||
    hasDetailedRequest
  ) {
    try {
      const allFilters = await waitFor(
        () =>
          document.querySelector<HTMLElement>('#advancedFiltersIcon') ??
          undefined,
      );
      activateCustomControl(allFilters);
      await waitFor(
        () => document.querySelector<HTMLElement>('#seeResultBtn') ?? undefined,
      );
      advancedModalOpened = true;
    } catch {
      // Individual filter groups below will report exactly what could not be
      // applied if the responsive All Filters dialog is unavailable.
    }
  }
  if (rentCriteria.length) {
    try {
      if (!advancedModalOpened)
        activateCustomControl(
          await waitFor(
            () =>
              document.querySelector<HTMLElement>(
                '#rentRangeLink, .rentselector',
              ) ?? undefined,
          ),
        );
      const minimum =
        search.minListedRent !== undefined
          ? await waitFor(
              () =>
                document.querySelector<HTMLInputElement>(
                  '.advancedFilters input.min-rent-select, #min-input, input.min-rent-select, input[placeholder="Min Price"]',
                ) ?? undefined,
            )
          : undefined;
      const maximum =
        search.maxListedRent !== undefined
          ? await waitFor(
              () =>
                document.querySelector<HTMLInputElement>(
                  '.advancedFilters input.max-rent-select, #max-input, input.max-rent-select, input[placeholder="Max Price"]',
                ) ?? undefined,
            )
          : undefined;
      if (minimum) await setInput(minimum, String(search.minListedRent));
      if (maximum) await setInput(maximum, String(search.maxListedRent));
      if (!advancedModalOpened)
        document
          .querySelector<HTMLElement>(
            '#rentRangeLink ~ .dropdownContent .done-btn, .rentRangeSelector .done-btn, .priceRangeSelector .done-btn',
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
  const rangeControlSelected = (control: HTMLElement) =>
    control.classList.contains('highlighted') ||
    control.classList.contains('selected') ||
    control.getAttribute('aria-pressed') === 'true' ||
    control.getAttribute('aria-checked') === 'true' ||
    (control instanceof HTMLInputElement && control.checked) ||
    Boolean(
      control.querySelector<HTMLInputElement>(
        'input[type="checkbox"]:checked, input[type="radio"]:checked',
      ),
    );
  const chooseBathroomRange = async (value: number): Promise<boolean> => {
    const requestedLabel = `${value}+`;
    const control = await waitFor(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '.advancedFilters .bath-filter-button, .bath-filter-container .bath-filter-button',
        ),
      ).find(
        (candidate) =>
          (candidate.textContent ?? '').trim() === requestedLabel ||
          candidate.getAttribute('aria-label') === requestedLabel,
      ),
    );
    if (!rangeControlSelected(control)) control.click();
    await sleep(100);
    if (rangeControlSelected(control)) return true;
    return Array.from(
      document.querySelectorAll<HTMLElement>('li, [role="listitem"]'),
    ).some((item) =>
      (item.textContent ?? '').trim().startsWith(`${requestedLabel} Baths`),
    );
  };
  const roomCriteria: SearchCriterion[] = [
    ...(canApplyBedrooms ? (['minBedrooms'] as const) : []),
  ];
  if (roomCriteria.length) {
    try {
      if (!advancedModalOpened)
        activateCustomControl(
          await waitFor(
            () =>
              document.querySelector<HTMLElement>(
                '#bedRangeLink, .bedselector',
              ) ?? undefined,
          ),
        );
      if (
        search.minBedrooms !== undefined &&
        search.minBedrooms > 0 &&
        roomCriteria.includes('minBedrooms') &&
        !(await chooseRangeButton('.bed-filter-button', search.minBedrooms))
      )
        throw new Error('Bedroom selection was not accepted.');
      if (!advancedModalOpened)
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
      if (!advancedModalOpened)
        activateCustomControl(
          await waitFor(
            () =>
              document.querySelector<HTMLElement>(
                '#typeSelect, .homeselector',
              ) ?? undefined,
          ),
        );
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
              advancedModalOpened
                ? `.advancedFilters .home-type-filter button[data-value="${value}"]`
                : `#PropertyType-${value}`,
            ) ?? undefined,
        );
        const selected =
          choice.classList.contains('selected') ||
          choice.classList.contains('highlighted') ||
          choice.getAttribute('aria-pressed') === 'true';
        if (selected !== desired.has(value)) choice.click();
      }
      if (!advancedModalOpened)
        document
          .querySelector<HTMLElement>(
            '.propertyTypeSelector .done-btn, .homeRangeSelector .done-btn, #typeSelect ~ .dropdownContent .done-btn',
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
    { criterion: 'moveInDate', enabled: Boolean(search.moveInDate) },
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
      if (!advancedModalOpened) {
        activateCustomControl(
          await waitFor(
            () =>
              document.querySelector<HTMLElement>('#advancedFiltersIcon') ??
              undefined,
          ),
        );
        await waitFor(
          () =>
            document.querySelector<HTMLElement>('#seeResultBtn') ?? undefined,
        );
        advancedModalOpened = true;
      }
      if (canApplyBathrooms && search.minBathrooms !== undefined) {
        await applyDetailed(['minBathrooms'], async () => {
          if (!(await chooseBathroomRange(search.minBathrooms!)))
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
        const petValue =
          search.catsAllowed &&
          (search.smallDogsAllowed || search.largeDogsAllowed)
            ? '3'
            : search.catsAllowed
              ? '2'
              : '1';
        await applyDetailed(
          petCriteria.map(({ criterion }) => criterion),
          async () => {
            const petButton = await waitFor(
              () =>
                document.querySelector<HTMLElement>(
                  '#adv-petPolicy-select-button, .advancedFilters .petPolicy-select',
                ) ?? undefined,
              1_500,
            );
            activateCustomControl(petButton);
            const menuId = petButton.getAttribute('aria-controls');
            const option = await waitFor(() => {
              const menu = menuId ? document.getElementById(menuId) : null;
              const candidates = Array.from(
                (menu ?? document).querySelectorAll<HTMLElement>(
                  '[role="option"]',
                ),
              );
              return (
                candidates.find(
                  (candidate) => candidate.dataset.value === petValue,
                ) ??
                candidates.find(
                  (candidate) =>
                    (candidate.textContent ?? '').trim() === petLabel,
                )
              );
            }, 1_500);
            // Apartments.com's current listbox renders the ARIA option on an
            // `li`, but wires selection to its inner dropdown item. Clicking
            // the ARIA wrapper leaves the visible value unchanged.
            const optionTarget =
              option.querySelector<HTMLElement>('.dropdown-select-item') ??
              option;
            activateCustomControl(optionTarget);
            await waitFor(() => {
              const selected = (
                document.querySelector<HTMLElement>(
                  '#adv-petPolicy-select-button .ui-selectmenu-text, .advancedFilters .petPolicy-select .dropdown-select-text',
                )?.textContent ??
                petButton.textContent ??
                ''
              ).trim();
              return selected === petLabel ? petButton : undefined;
            }, 1_500);
          },
        );
      }
      if (search.moveInDate) {
        await applyDetailed(['moveInDate'], async () => {
          const input = await waitFor(
            () =>
              document.querySelector<HTMLInputElement>(
                '.advancedFilterMoveInDate',
              ) ?? undefined,
            1_500,
          );
          const parts = search.moveInDate!.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!parts) throw new Error('Move-in date format was invalid.');
          const targetYear = Number(parts[1]);
          const targetMonth = Number(parts[2]) - 1;
          const targetDay = Number(parts[3]);
          input.click();

          const monthNames = [
            'JANUARY',
            'FEBRUARY',
            'MARCH',
            'APRIL',
            'MAY',
            'JUNE',
            'JULY',
            'AUGUST',
            'SEPTEMBER',
            'OCTOBER',
            'NOVEMBER',
            'DECEMBER',
          ];
          const readVisibleMonth = () => {
            const label = document.querySelector<HTMLElement>(
              '.datepicker-days .datepicker-switch',
            );
            if (!label) return undefined;
            const match = (label.textContent ?? '')
              .trim()
              .toUpperCase()
              .match(/^([A-Z]+)\s+(\d{4})$/);
            if (!match) return undefined;
            const month = monthNames.indexOf(match[1]);
            const year = Number(match[2]);
            return month >= 0 && Number.isFinite(year)
              ? { label, month, year }
              : undefined;
          };

          let visible = await waitFor(
            () => readVisibleMonth()?.label,
            1_500,
          ).then(() => readVisibleMonth());
          if (!visible)
            throw new Error('Move-in calendar month was unavailable.');
          for (let attempts = 0; attempts < 36; attempts += 1) {
            const delta =
              (targetYear - visible.year) * 12 + (targetMonth - visible.month);
            if (delta === 0) break;
            const previousLabel = visible.label.textContent;
            const navigation = document.querySelector<HTMLElement>(
              `.datepicker-days .${delta > 0 ? 'next' : 'prev'}`,
            );
            if (!navigation || navigation.classList.contains('disabled'))
              throw new Error('Move-in calendar navigation was unavailable.');
            navigation.click();
            await waitFor(() => {
              const nextVisible = readVisibleMonth();
              return nextVisible &&
                nextVisible.label.textContent !== previousLabel
                ? nextVisible.label
                : undefined;
            }, 1_500);
            visible = readVisibleMonth();
            if (!visible)
              throw new Error('Move-in calendar month was unavailable.');
          }
          if (visible.year !== targetYear || visible.month !== targetMonth)
            throw new Error('Move-in calendar could not reach the date.');

          const targetCell = Array.from(
            document.querySelectorAll<HTMLElement>(
              '.datepicker-days td.day[data-date]',
            ),
          ).find((cell) => {
            if (cell.classList.contains('disabled')) return false;
            const timestamp = Number(cell.dataset.date);
            if (!Number.isFinite(timestamp)) return false;
            const candidate = new Date(timestamp);
            return (
              candidate.getFullYear() === targetYear &&
              candidate.getMonth() === targetMonth &&
              candidate.getDate() === targetDay
            );
          });
          if (!targetCell) throw new Error('Move-in date was not available.');
          targetCell.click();
          await waitFor(() => {
            const [selectedMonth, selectedDay, selectedYear] = input.value
              .split('/')
              .map(Number);
            return selectedMonth === targetMonth + 1 &&
              selectedDay === targetDay &&
              selectedYear === targetYear
              ? input
              : undefined;
          }, 1_500);
        });
      }
      if (search.minSquareFeet !== undefined) {
        await applyDetailed(['minSquareFeet'], async () => {
          const squareFootageButton = await waitFor(
            () =>
              document.querySelector<HTMLElement>(
                '#minSF-button, .advancedFilters .minSF',
              ) ?? undefined,
          );
          activateCustomControl(squareFootageButton);
          const options = await waitFor(() => {
            const candidates = Array.from(
              document.querySelectorAll<HTMLElement>(
                '#minSF-menu [role="option"], [role="option"]',
              ),
            ).filter((candidate) => {
              const value = Number(
                (candidate.textContent ?? '').replace(/[^0-9]/g, ''),
              );
              return Number.isFinite(value) && value > 0;
            });
            return candidates.length ? candidates[0] : undefined;
          }, 1_500).then(() =>
            Array.from(
              document.querySelectorAll<HTMLElement>(
                '#minSF-menu [role="option"], [role="option"]',
              ),
            ),
          );
          const squareFootageOption = options
            .map((option) => ({
              option,
              value: Number((option.textContent ?? '').replace(/[^0-9]/g, '')),
            }))
            .filter(
              ({ value }) =>
                Number.isFinite(value) && value >= search.minSquareFeet!,
            )
            .sort((left, right) => left.value - right.value)[0];
          if (!squareFootageOption)
            throw new Error('Square-footage options were unavailable.');
          const rounded = squareFootageOption.value;
          activateCustomControl(squareFootageOption.option);
          await waitFor(() => {
            const selected = (
              document.querySelector<HTMLElement>(
                '#minSF-button .ui-selectmenu-text, .advancedFilters .minSF .dropdown-select-text',
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
    }
  }

  if (advancedModalOpened)
    document.querySelector<HTMLElement>('#seeResultBtn')?.click();

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
