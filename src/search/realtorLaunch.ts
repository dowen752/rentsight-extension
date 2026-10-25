import type { RentalSearch, SearchCriterion } from './types';
import {
  REALTOR_HOST_PERMISSION,
  REALTOR_ORIGIN,
  realtorAppliedCriteria,
  realtorNeedsPageFill,
} from './realtor';

const REALTOR_LOAD_TIMEOUT_MS = 20_000;

export interface RealtorLaunchOutcome {
  automated: boolean;
  message?: string;
}

export interface RealtorPageFillResult {
  applied: SearchCriterion[];
  failed: SearchCriterion[];
}

export interface RealtorLocationResult {
  ready: boolean;
  submitted: boolean;
}

export function withRealtorPriceRange(
  sourceUrl: string,
  minimum: number | undefined,
  maximum: number | undefined,
): string {
  if (minimum === undefined && maximum === undefined) return sourceUrl;
  const url = new URL(sourceUrl);
  const segments = url.pathname.split('/').filter(Boolean);
  const withoutPrice = segments.filter(
    (segment) => !segment.startsWith('price-'),
  );
  const price = `price-${minimum ?? 'na'}-${maximum ?? 'na'}`;
  const squareFeetIndex = withoutPrice.findIndex((segment) =>
    segment.startsWith('sqft-'),
  );
  const insertAt =
    squareFeetIndex >= 0 ? squareFeetIndex + 1 : withoutPrice.length;
  withoutPrice.splice(insertAt, 0, price);
  url.pathname = `/${withoutPrice.join('/')}`;
  return url.toString();
}

function waitForRealtorTab(tabId: number): Promise<void> {
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
        fail('The Realtor.com tab was closed before its search was ready.');
    };
    const timeout = setTimeout(
      () => fail('Realtor.com took too long to prepare the search.'),
      REALTOR_LOAD_TIMEOUT_MS,
    );
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    void chrome.tabs.get(tabId).then(
      (tab) => {
        if (tab.status === 'complete') finish();
      },
      () => fail('The Realtor.com search tab is no longer available.'),
    );
  });
}

function waitForRealtorNavigation(
  tabId: number,
  previousUrl: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      clearInterval(poll);
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
      if (tab.url && tab.url !== previousUrl && tab.status === 'complete')
        finish();
    };
    const onUpdated = (
      updatedTabId: number,
      _changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (updatedTabId === tabId) inspect(tab);
    };
    const onRemoved = (removedTabId: number) => {
      if (removedTabId === tabId)
        fail('The Realtor.com tab was closed during location search.');
    };
    const poll = setInterval(() => {
      void chrome.tabs
        .get(tabId)
        .then(inspect, () =>
          fail('The Realtor.com search tab is no longer available.'),
        );
    }, 100);
    const timeout = setTimeout(
      () => fail('Realtor.com did not finish resolving the location.'),
      REALTOR_LOAD_TIMEOUT_MS,
    );
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    void chrome.tabs
      .get(tabId)
      .then(inspect, () =>
        fail('The Realtor.com search tab is no longer available.'),
      );
  });
}

/** Uses Realtor.com's own first autocomplete result for ambiguous locations. */
export async function resolveRealtorLocationPage(
  requestedLocation: string,
): Promise<RealtorLocationResult> {
  const sleep = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  const visible = (element: Element) => {
    if ((element as HTMLElement).hidden) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  const deadline = Date.now() + 5_000;
  let input: HTMLInputElement | null = null;
  while (Date.now() < deadline && !input) {
    input = document.querySelector<HTMLInputElement>(
      'input[data-testid="freeTypeInput"][role="combobox"]',
    );
    if (!input) await sleep(100);
  }
  if (!input) return { ready: false, submitted: false };

  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  input.focus();
  setter?.call(input, requestedLocation);
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

  // Realtor.com redirects /rentals to the browser's most recent market. Do
  // not accept that restored results page as resolved. Prefer the site's own
  // autocomplete result because it carries Realtor's canonical place data,
  // rather than merely submitting text against the previously loaded market.
  let firstSuggestion: HTMLElement | undefined;
  const suggestionDeadline = Date.now() + 4_000;
  while (Date.now() < suggestionDeadline && !firstSuggestion) {
    firstSuggestion = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]'),
    ).find(
      (option) =>
        visible(option) &&
        !option.hasAttribute('disabled') &&
        option.getAttribute('aria-disabled') !== 'true' &&
        Boolean((option.textContent ?? '').trim()),
    );
    if (!firstSuggestion) await sleep(100);
  }
  if (firstSuggestion) {
    firstSuggestion.click();
    return { ready: false, submitted: true };
  }

  // Some Realtor variants do not expose suggestions. Their submit control is
  // currently an icon-only button, so match its accessible label as well as
  // legacy visible text and prefer the control associated with this input.
  const searchButton = Array.from(
    (
      input.closest('form') ??
      input.parentElement ??
      document
    ).querySelectorAll<HTMLButtonElement>('button'),
  ).find((button) => {
    if (!visible(button) || button.disabled) return false;
    const label = [
      button.textContent,
      button.getAttribute('aria-label'),
      button.getAttribute('title'),
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    return /search/i.test(label);
  });
  if (!searchButton) return { ready: false, submitted: false };
  searchButton.click();
  return { ready: false, submitted: true };
}

/** Runs in Realtor.com's isolated extension world using its Filters drawer. */
export async function fillRealtorSearchPage(
  search: RentalSearch,
): Promise<RealtorPageFillResult> {
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
    throw new Error('A Realtor.com filter control did not become available.');
  };
  const record = (
    destination: SearchCriterion[],
    criterion: SearchCriterion,
  ) => {
    if (!destination.includes(criterion)) destination.push(criterion);
  };
  const apply = async (
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
  const priceHeading = () =>
    document.querySelector<HTMLElement>('[data-testid="accordion-price"]');
  const setPrice = async (selector: string, requested: number) => {
    const heading = priceHeading();
    if (!heading) throw new Error('Realtor.com price filter was unavailable.');
    if (heading.getAttribute('aria-expanded') !== 'true') {
      heading.click();
      await waitFor(() =>
        heading.getAttribute('aria-expanded') === 'true' ? heading : undefined,
      );
    }
    const input = await waitFor(
      () => document.querySelector<HTMLInputElement>(selector) ?? undefined,
    );
    input.focus();
    input.select();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, String(requested));
    input.dispatchEvent(
      typeof InputEvent === 'function'
        ? new InputEvent('input', {
            bubbles: true,
            data: String(requested),
            inputType: 'insertText',
          })
        : new Event('input', { bubbles: true }),
    );
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Each bound is its own controlled draft. Commit and verify it before
    // editing the other bound, otherwise Realtor may discard the first draft
    // when the second input causes the price controls to re-render.
    for (const type of ['keydown', 'keypress', 'keyup']) {
      input.dispatchEvent(
        new KeyboardEvent(type, {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      );
    }
    input.blur();
    await waitFor(() => {
      const summary = heading.querySelector('.status')?.textContent ?? '';
      const summaryAmounts = Array.from(
        summary.matchAll(/\$\s*([\d,.]+)\s*([km]?)/gi),
        ([, number, unit]) =>
          Math.round(
            Number(number.replace(/,/g, '')) *
              (unit.toLowerCase() === 'k'
                ? 1_000
                : unit.toLowerCase() === 'm'
                  ? 1_000_000
                  : 1),
          ),
      );
      const committed = document.querySelector<HTMLInputElement>(selector);
      return Number(committed?.value.replace(/[^0-9]/g, '')) === requested &&
        summaryAmounts.includes(requested)
        ? (committed ?? undefined)
        : undefined;
    }, 2_000);
  };
  const setMoveInDate = async (requested: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(requested);
    if (!match) throw new Error('Move-in date was unavailable.');
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    )
      throw new Error('Move-in date was invalid.');

    const input = await waitFor(
      () =>
        document.querySelector<HTMLInputElement>('#start-date') ?? undefined,
    );
    const calendarButton =
      input.parentElement?.parentElement?.querySelector<HTMLButtonElement>(
        'button[aria-label="Open calendar"]',
      );
    if (!calendarButton)
      throw new Error('Realtor.com calendar was unavailable.');
    calendarButton.click();
    const calendar = await waitFor(
      () =>
        document.querySelector<HTMLElement>(
          '[role="application"][aria-label="Calendar"]',
        ) ?? undefined,
      2_000,
    );
    const expectedMonth = year * 12 + month - 1;
    try {
      for (let step = 0; step <= 24; step++) {
        const label = calendar
          .querySelector('.month-display')
          ?.textContent?.trim();
        const displayed = label ? new Date(`${label} 1`) : new Date(NaN);
        if (Number.isNaN(displayed.getTime()))
          throw new Error('Realtor.com calendar month was unavailable.');
        const currentMonth =
          displayed.getFullYear() * 12 + displayed.getMonth();
        if (currentMonth === expectedMonth) {
          const dayButton = Array.from(
            calendar.querySelectorAll<HTMLButtonElement>('button.date[id]'),
          ).find((button) => {
            const [buttonMonth, buttonDay, buttonYear] = button.id
              .split('/')
              .map(Number);
            return (
              buttonMonth === month &&
              buttonDay === day &&
              buttonYear === year % 100
            );
          });
          if (
            !dayButton ||
            dayButton.disabled ||
            dayButton.getAttribute('aria-disabled') === 'true'
          )
            throw new Error('Realtor.com does not offer that move-in date.');
          dayButton.click();
          await waitFor(() => {
            const current =
              document.querySelector<HTMLInputElement>('#start-date');
            return current?.value ===
              `${monthText}/${dayText}/${yearText.slice(-2)}`
              ? current
              : undefined;
          }, 2_000);
          return;
        }
        const direction = currentMonth < expectedMonth ? 'Next' : 'Previous';
        const navigation = calendar.querySelector<HTMLButtonElement>(
          `button[aria-label="${direction} month"]`,
        );
        if (
          !navigation ||
          navigation.disabled ||
          navigation.getAttribute('aria-disabled') === 'true'
        )
          throw new Error('Realtor.com does not offer that move-in date.');
        navigation.click();
        await waitFor(() =>
          calendar.querySelector('.month-display')?.textContent?.trim() !==
          label
            ? calendar
            : undefined,
        );
      }
      throw new Error('Realtor.com date is outside its calendar range.');
    } catch (error) {
      if (calendar.isConnected)
        document
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Close calendar"]',
          )
          ?.click();
      throw error;
    }
  };
  const clickCheckbox = async (selector: string) => {
    const input = await waitFor(
      () => document.querySelector<HTMLInputElement>(selector) ?? undefined,
    );
    if (!input.checked) input.click();
    await waitFor(() => {
      const current = document.querySelector<HTMLInputElement>(selector);
      return current?.checked ? current : undefined;
    }, 1_500);
  };
  const clickLabeledCheckbox = async (
    testId: string,
    accordionName?: RegExp,
  ) => {
    const selector = `label[data-testid="${testId}"] input[type="checkbox"]`;
    let input = document.querySelector<HTMLInputElement>(selector);
    if (!input && accordionName) {
      const accordion = Array.from(
        document.querySelectorAll<HTMLButtonElement>('button'),
      ).find((button) => accordionName.test((button.textContent ?? '').trim()));
      if (accordion?.getAttribute('aria-expanded') !== 'true')
        accordion?.click();
      input = await waitFor(
        () => document.querySelector<HTMLInputElement>(selector) ?? undefined,
      );
    }
    if (!input) throw new Error('Realtor.com amenity control was unavailable.');
    if (!input.checked) input.click();
    await waitFor(() => {
      const current = document.querySelector<HTMLInputElement>(selector);
      return current?.checked ? current : undefined;
    }, 1_500);
  };
  const setSelect = async (selector: string, value: string) => {
    const select = await waitFor(
      () => document.querySelector<HTMLSelectElement>(selector) ?? undefined,
    );
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value',
    )?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => {
      const current = document.querySelector<HTMLSelectElement>(selector);
      return current?.value === value ? current : undefined;
    }, 1_500);
  };

  const supportedRequested: SearchCriterion[] = [
    ...(search.location ? (['location'] as const) : []),
    ...(search.minListedRent !== undefined ? (['minListedRent'] as const) : []),
    ...(search.maxListedRent !== undefined ? (['maxListedRent'] as const) : []),
    ...(search.minBedrooms !== undefined &&
    Number.isInteger(search.minBedrooms) &&
    search.minBedrooms >= 0 &&
    search.minBedrooms <= 5
      ? (['minBedrooms'] as const)
      : []),
    ...(search.minBathrooms !== undefined &&
    Number.isInteger(search.minBathrooms) &&
    search.minBathrooms >= 0 &&
    search.minBathrooms <= 5
      ? (['minBathrooms'] as const)
      : []),
    ...(search.propertyTypes?.length ? (['propertyTypes'] as const) : []),
    ...(search.catsAllowed ? (['catsAllowed'] as const) : []),
    ...(search.smallDogsAllowed ? (['smallDogsAllowed'] as const) : []),
    ...(search.largeDogsAllowed ? (['largeDogsAllowed'] as const) : []),
    ...(search.moveInDate ? (['moveInDate'] as const) : []),
    ...(search.minSquareFeet !== undefined &&
    Number.isInteger(search.minSquareFeet) &&
    search.minSquareFeet >= 0 &&
    search.minSquareFeet <= 2_500
      ? (['minSquareFeet'] as const)
      : []),
    ...(search.parkingAvailable ? (['parkingAvailable'] as const) : []),
    ...(search.inUnitLaundry ? (['inUnitLaundry'] as const) : []),
    ...(search.airConditioning ? (['airConditioning'] as const) : []),
  ];
  if (
    location.origin !== 'https://www.realtor.com' ||
    !location.pathname.startsWith('/apartments/')
  ) {
    return { applied, failed: supportedRequested };
  }
  if (search.location) record(applied, 'location');

  // Realtor.com changes the URL before its client-rendered results tree has
  // finished replacing the prior market. Clicking controls from that stale
  // tree makes the drawer disappear midway through automation.
  const initialHeading = document.querySelector<HTMLElement>('h1');
  if (initialHeading && search.location) {
    const requestedPlace = search.location
      .split(',')[0]
      .trim()
      .toLocaleLowerCase();
    await waitFor(() => {
      const heading = document.querySelector<HTMLElement>('h1');
      return heading?.textContent?.toLocaleLowerCase().includes(requestedPlace)
        ? heading
        : undefined;
    });
  }

  const filterButton = await waitFor(() =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => (button.textContent ?? '').trim() === 'Filters',
    ),
  );
  filterButton.click();
  const submitButton = await waitFor(
    () =>
      document.querySelector<HTMLButtonElement>(
        'button[data-testid="view-more-filters-results"]',
      ) ?? undefined,
  );

  if (search.propertyTypes?.length) {
    const propertyTypes = search.propertyTypes;
    await apply(['propertyTypes'], async () => {
      const selectors = propertyTypes.flatMap((propertyType) => {
        if (propertyType === 'apartment_condo')
          return ['#propertyType-apartments', '#propertyType-condo'];
        if (propertyType === 'house')
          return ['#propertyType-single-family-home'];
        return ['#propertyType-townhome'];
      });
      for (const selector of [...new Set(selectors)])
        await clickCheckbox(selector);
    });
  }

  if (
    search.minBedrooms !== undefined &&
    Number.isInteger(search.minBedrooms) &&
    search.minBedrooms >= 0 &&
    search.minBedrooms <= 5
  ) {
    await apply(['minBedrooms'], async () => {
      const values =
        search.minBedrooms === 0
          ? ['Any']
          : [1, 2, 3, 4, 5]
              .filter((value) => value >= search.minBedrooms!)
              .map((value) => (value === 5 ? '5+' : String(value)));
      for (const value of values)
        await clickCheckbox(`[id="bed-checkbox-group-${value}"]`);
    });
  }
  if (
    search.minBathrooms !== undefined &&
    Number.isInteger(search.minBathrooms) &&
    search.minBathrooms >= 0 &&
    search.minBathrooms <= 5
  ) {
    await apply(['minBathrooms'], async () => {
      const values =
        search.minBathrooms === 0
          ? ['Any']
          : [1, 2, 3, 4, 5]
              .filter((value) => value >= search.minBathrooms!)
              .map((value) => (value === 5 ? '5+' : String(value)));
      for (const value of values)
        await clickCheckbox(`[id="bath-checkbox-group-${value}"]`);
    });
  }

  if (search.moveInDate) {
    await apply(['moveInDate'], () => setMoveInDate(search.moveInDate!));
  }

  if (search.catsAllowed) {
    await apply(['catsAllowed'], () =>
      clickLabeledCheckbox('option-cats', /^pet friendly/i),
    );
  }
  const dogCriteria: SearchCriterion[] = [
    ...(search.smallDogsAllowed ? (['smallDogsAllowed'] as const) : []),
    ...(search.largeDogsAllowed ? (['largeDogsAllowed'] as const) : []),
  ];
  if (dogCriteria.length) {
    await apply(dogCriteria, () =>
      clickLabeledCheckbox('option-dogs', /^pet friendly/i),
    );
  }

  if (
    search.minSquareFeet !== undefined &&
    Number.isInteger(search.minSquareFeet) &&
    search.minSquareFeet >= 0 &&
    search.minSquareFeet <= 2_500
  ) {
    await apply(['minSquareFeet'], async () => {
      const select = await waitFor(
        () =>
          document.querySelector<HTMLSelectElement>(
            '#home-size-from-options',
          ) ?? undefined,
      );
      const requested = search.minSquareFeet!;
      if (requested === 0) {
        await setSelect('#home-size-from-options', select.options[0].value);
        return;
      }
      const rounded = Array.from(select.options)
        .map((option) => Number(option.value))
        .filter((value) => Number.isFinite(value) && value >= requested)
        .sort((left, right) => left - right)[0];
      if (rounded === undefined)
        throw new Error('Minimum square footage was unavailable.');
      await setSelect('#home-size-from-options', String(rounded));
    });
  }
  if (search.parkingAvailable) {
    await apply(['parkingAvailable'], () =>
      clickLabeledCheckbox('option-garage1OrMore', /^community features/i),
    );
  }
  if (search.inUnitLaundry) {
    await apply(['inUnitLaundry'], () =>
      clickLabeledCheckbox('option-washerDryer', /^unit features/i),
    );
  }
  if (search.airConditioning) {
    await apply(['airConditioning'], () =>
      clickLabeledCheckbox('option-centralAir', /^unit features/i),
    );
  }

  // Realtor can restore an older price-range snapshot when another filter
  // updates its shared drawer state. Apply price last, then commit each bound
  // independently so no later control can overwrite the accepted range.
  if (search.maxListedRent !== undefined) {
    await apply(['maxListedRent'], () =>
      setPrice('#max-price-dropdown', search.maxListedRent!),
    );
  }
  if (search.minListedRent !== undefined) {
    await apply(['minListedRent'], () =>
      setPrice('#min-price-dropdown', search.minListedRent!),
    );
  }

  // Committing the drawer once preserves every successful filter even if an
  // unrelated optional control was missing.
  submitButton.click();
  return { applied, failed };
}

export async function launchRealtorSearch(
  search: RentalSearch,
  bootstrapUrl: string,
  siteAccess?: Promise<boolean>,
): Promise<RealtorLaunchOutcome> {
  const destination = new URL(bootstrapUrl);
  if (destination.origin !== REALTOR_ORIGIN)
    throw new Error('RentSight blocked an unexpected Realtor.com destination.');
  destination.hash = '';
  destination.pathname = '/rentals';
  destination.search = '';

  if (!realtorNeedsPageFill(search)) {
    await chrome.tabs.create({ url: destination.toString() });
    return { automated: false };
  }

  let granted = false;
  try {
    granted = siteAccess
      ? await siteAccess
      : await chrome.permissions.request({
          origins: [REALTOR_HOST_PERMISSION],
        });
  } catch (error: unknown) {
    console.error('[RentSight] Realtor.com site access request failed', error);
  }
  const tab = await chrome.tabs.create({ url: destination.toString() });
  if (!granted) {
    return {
      automated: false,
      message:
        'Realtor.com opened. Site access is needed to resolve the location and apply supported filters automatically.',
    };
  }
  if (tab.id === undefined)
    throw new Error('Realtor.com opened, but its tab could not be prepared.');

  try {
    await waitForRealtorTab(tab.id);
    const locationPage = await chrome.tabs.get(tab.id);
    const previousLocationUrl = locationPage.url ?? destination.toString();
    const [locationInjection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: resolveRealtorLocationPage,
      args: [search.location ?? ''],
    });
    const locationResult = locationInjection?.result as
      RealtorLocationResult | undefined;
    if (locationResult?.submitted) {
      await waitForRealtorNavigation(tab.id, previousLocationUrl);
    } else if (!locationResult?.ready) {
      throw new Error('Realtor.com could not resolve the requested location.');
    }

    const requestedFilters = realtorAppliedCriteria(search).filter(
      (criterion) => criterion !== 'location',
    );
    if (!requestedFilters.length) return { automated: true };
    const filterPage = await chrome.tabs.get(tab.id);
    const previousFilterUrl = filterPage.url ?? previousLocationUrl;
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillRealtorSearchPage,
      args: [search],
    });
    const result = injection?.result as RealtorPageFillResult | undefined;
    if (!result) throw new Error('Realtor.com did not return filter results.');
    const hasNonPriceFilters = requestedFilters.some(
      (criterion) =>
        criterion !== 'minListedRent' && criterion !== 'maxListedRent',
    );
    if (hasNonPriceFilters)
      await waitForRealtorNavigation(tab.id, previousFilterUrl);
    if (
      search.minListedRent !== undefined ||
      search.maxListedRent !== undefined
    ) {
      const filteredTab = await chrome.tabs.get(tab.id);
      const filteredUrl = filteredTab.url ?? previousLocationUrl;
      const pricedUrl = withRealtorPriceRange(
        filteredUrl,
        search.minListedRent,
        search.maxListedRent,
      );
      if (pricedUrl !== filteredUrl) {
        await chrome.tabs.update(tab.id, { url: pricedUrl });
        await waitForRealtorTab(tab.id);
      }
    }
    const unapplied = requestedFilters.filter(
      (criterion) => !result.applied.includes(criterion),
    );
    if (unapplied.length) {
      const today = new Date();
      const localToday = [
        String(today.getFullYear()).padStart(4, '0'),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-');
      const pastMoveInDate =
        unapplied.includes('moveInDate') &&
        /^\d{4}-\d{2}-\d{2}$/.test(search.moveInDate ?? '') &&
        search.moveInDate! < localToday;
      return {
        automated: false,
        message: pastMoveInDate
          ? 'Realtor.com applied the available filters, but it does not accept a past move-in date. Choose today or a later date and try again.'
          : 'Realtor.com opened and applied the available filters. Review the remaining preferences on site.',
      };
    }
    return { automated: true };
  } catch (error: unknown) {
    console.error('[RentSight] Realtor.com assisted search failed', error);
    return {
      automated: false,
      message:
        'Realtor.com opened, but its location or filters could not be applied automatically. Review them on site.',
    };
  }
}
