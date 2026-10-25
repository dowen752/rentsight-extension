import type { RentalSearch, SearchCriterion } from './types';
import {
  REDFIN_HOST_PERMISSION,
  REDFIN_ORIGIN,
  redfinAppliedCriteria,
} from './redfin';

export interface RedfinLaunchOutcome {
  automated: boolean;
  message?: string;
}
export interface RedfinPageResult {
  applied: SearchCriterion[];
  failed: SearchCriterion[];
  submitted?: boolean;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Executed in Redfin's page. Never infer an opaque city ID from the user's text. */
export async function resolveRedfinLocationPage(
  requested: string,
): Promise<boolean> {
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));
  if (location.origin !== 'https://www.redfin.com') return false;
  const match = /^\s*([^,]+?)(?:,\s*([a-z]{2}))?\s*$/i.exec(requested);
  if (!match) return false;
  const [, city, state] = match;
  const deadline = Date.now() + 8_000;
  let input: HTMLInputElement | null = null;
  while (Date.now() < deadline) {
    input =
      Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input[type="search"][aria-label="Search for properties"]',
        ),
      ).find((el) => !el.disabled && el.getClientRects().length > 0) ?? null;
    if (input) break;
    await sleep(100);
  }
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  input.focus();
  setter?.call(input, requested);
  input.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      data: requested,
      inputType: 'insertText',
    }),
  );
  const targetCity = city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const targetState = state?.toUpperCase();
  while (Date.now() < deadline) {
    const suggestion = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-rf-test-name^="item-row"][role="link"]',
      ),
    ).find((el) => {
      const href =
        el.querySelector<HTMLAnchorElement>('a[href]')?.getAttribute('href') ??
        '';
      const route = /^\/city\/\d+\/([a-z]{2})\/([^/?#]+)$/i.exec(href);
      return Boolean(
        route &&
        route[2].toLowerCase() === targetCity &&
        (!targetState || route[1].toUpperCase() === targetState) &&
        el.getClientRects().length > 0,
      );
    });
    if (suggestion) {
      suggestion.click();
      return true;
    }
    await sleep(100);
  }
  return false;
}

/** Use Redfin's own controls; each missing control fails independently. */
export async function fillRedfinSearchPage(
  search: RentalSearch,
): Promise<RedfinPageResult> {
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));
  const applied: SearchCriterion[] = [];
  const failed: SearchCriterion[] = [];
  const requested: SearchCriterion[] = [
    ...(search.location ? ['location' as const] : []),
    ...(search.minListedRent !== undefined ? ['minListedRent' as const] : []),
    ...(search.maxListedRent !== undefined ? ['maxListedRent' as const] : []),
    ...(search.minBedrooms !== undefined &&
    Number.isInteger(search.minBedrooms) &&
    search.minBedrooms >= 0 &&
    search.minBedrooms <= 5
      ? ['minBedrooms' as const]
      : []),
    ...(search.minBathrooms !== undefined &&
    Number.isInteger(search.minBathrooms * 2) &&
    search.minBathrooms >= 0 &&
    search.minBathrooms <= 4
      ? ['minBathrooms' as const]
      : []),
    ...(search.propertyTypes?.length ? ['propertyTypes' as const] : []),
    ...(search.catsAllowed ? ['catsAllowed' as const] : []),
    ...(search.smallDogsAllowed ? ['smallDogsAllowed' as const] : []),
    ...(search.largeDogsAllowed ? ['largeDogsAllowed' as const] : []),
    ...(search.moveInDate ? ['moveInDate' as const] : []),
    ...(search.minSquareFeet !== undefined &&
    Number.isInteger(search.minSquareFeet) &&
    search.minSquareFeet >= 0 &&
    search.minSquareFeet <= 4500
      ? ['minSquareFeet' as const]
      : []),
    ...(search.parkingAvailable ? ['parkingAvailable' as const] : []),
    ...(search.inUnitLaundry ? ['inUnitLaundry' as const] : []),
    ...(search.airConditioning ? ['airConditioning' as const] : []),
  ];
  const waitFor = async <T extends Element>(
    find: () => T | null | undefined,
    ms = 3_000,
  ): Promise<T> => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const item = find();
      if (item) return item;
      await sleep(100);
    }
    throw new Error('Redfin control unavailable');
  };
  const apply = async (
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
  if (
    location.origin !== 'https://www.redfin.com' ||
    !/\/rentals\/?$/.test(location.pathname)
  )
    return { applied, failed: requested };
  if (search.location) applied.push('location');
  const filterButton = await waitFor(() =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (el) => el.textContent?.trim() === 'Filters' && !el.disabled,
    ),
  );
  filterButton.click();
  const dialog = await waitFor(() =>
    document.querySelector<HTMLElement>(
      '#bp-dialog-container.AllFiltersDialog',
    ),
  );
  const checkbox = async (selector: string) => {
    const input = await waitFor(() =>
      dialog.querySelector<HTMLInputElement>(selector),
    );
    if (!input.checked) input.click();
    await waitFor(
      () =>
        dialog.querySelector<HTMLInputElement>(selector)?.checked
          ? input
          : null,
      1_000,
    );
  };
  const text = async (placeholder: string, value: number) => {
    const input = await waitFor(() =>
      dialog.querySelector<HTMLInputElement>(
        `input[placeholder="${placeholder}"]`,
      ),
    );
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    input.focus();
    setter?.call(input, String(value));
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: String(value),
        inputType: 'insertText',
      }),
    );
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    await waitFor(
      () =>
        Number(input.value.replace(/[^0-9]/g, '')) === value ? input : null,
      1_000,
    );
  };
  if (search.minListedRent !== undefined)
    await apply(['minListedRent'], () =>
      text('Enter min', search.minListedRent!),
    );
  if (search.maxListedRent !== undefined)
    await apply(['maxListedRent'], () =>
      text('Enter max', search.maxListedRent!),
    );
  const chooseCell = async (rowName: string, label: string) => {
    const row = await waitFor(() =>
      dialog.querySelector<HTMLElement>(
        `[role="row"][aria-label="${rowName}"]`,
      ),
    );
    const cell = Array.from(
      row.querySelectorAll<HTMLElement>('[role="cell"]'),
    ).find((el) => el.dataset.text === label);
    if (!cell) throw new Error('Redfin range unavailable');
    cell.click();
    await waitFor(
      () =>
        cell.classList.contains('ItemPickerGroup__option--selected')
          ? cell
          : null,
      1_000,
    );
  };
  if (requested.includes('minBedrooms'))
    await apply(['minBedrooms'], () =>
      chooseCell(
        'Number of bedrooms',
        search.minBedrooms === 0
          ? 'Any'
          : search.minBedrooms === 5
            ? '5+'
            : String(search.minBedrooms),
      ),
    );
  if (requested.includes('minBathrooms'))
    await apply(['minBathrooms'], () =>
      chooseCell(
        'Number of bathrooms',
        search.minBathrooms === 0 ? 'Any' : `${search.minBathrooms}+`,
      ),
    );
  if (search.propertyTypes?.length)
    await apply(['propertyTypes'], async () => {
      const ids = search.propertyTypes!.flatMap((type) =>
        type === 'apartment_condo'
          ? ['Apartment', 'Condo']
          : type === 'house'
            ? ['House']
            : ['Townhouse'],
      );
      for (const id of ids) await checkbox(`[id="${id}"]`);
    });
  if (search.catsAllowed) await apply(['catsAllowed'], () => checkbox('#cats'));
  const dogs: SearchCriterion[] = [
    ...(search.smallDogsAllowed ? ['smallDogsAllowed' as const] : []),
    ...(search.largeDogsAllowed ? ['largeDogsAllowed' as const] : []),
  ];
  if (dogs.length) await apply(dogs, () => checkbox('#dogs'));
  if (search.airConditioning)
    await apply(['airConditioning'], () => checkbox('#ac'));
  if (search.inUnitLaundry)
    await apply(['inUnitLaundry'], () => checkbox('#washerDryer'));
  if (search.parkingAvailable)
    await apply(['parkingAvailable'], () => checkbox('#hasParking'));
  if (requested.includes('minSquareFeet'))
    await apply(['minSquareFeet'], async () => {
      const select = await waitFor(() =>
        dialog.querySelector<HTMLSelectElement>('select[name="sqFtMin"]'),
      );
      const value =
        search.minSquareFeet === 0
          ? 'default'
          : Array.from(select.options)
              .map((o) => Number(o.value))
              .filter((n) => Number.isFinite(n) && n >= search.minSquareFeet!)
              .sort((a, b) => a - b)[0]
              ?.toString();
      if (!value) throw new Error('Redfin square footage unavailable');
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => (select.value === value ? select : null), 1_000);
    });
  if (search.moveInDate)
    await apply(['moveInDate'], async () => {
      const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(search.moveInDate!);
      if (!parts) throw new Error('Invalid date');
      const [, yy, mm, dd] = parts;
      const year = +yy,
        month = +mm,
        day = +dd;
      const date = new Date(year, month - 1, day);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      )
        throw new Error('Invalid date');
      const input = await waitFor(() =>
        dialog.querySelector<HTMLInputElement>('input[name="moveInDate"]'),
      );
      input.click();
      const calendar = await waitFor(
        () => dialog.querySelector<HTMLElement>('#DatepickerCalendarFlyout'),
        2_000,
      );
      for (let i = 0; i < 25; i++) {
        const heading = calendar
          .querySelector('.DayPicker-Caption')
          ?.textContent?.trim();
        const displayed = new Date(`${heading} 1`);
        if (!heading || Number.isNaN(displayed.getTime()))
          throw new Error('Calendar heading unavailable');
        const offset =
          (year - displayed.getFullYear()) * 12 +
          month -
          1 -
          displayed.getMonth();
        if (!offset) {
          const cell = Array.from(
            calendar.querySelectorAll<HTMLElement>(
              '[role="gridcell"][aria-label]',
            ),
          ).find((el) => {
            const value = new Date(el.getAttribute('aria-label') ?? '');
            return (
              value.getFullYear() === year &&
              value.getMonth() === month - 1 &&
              value.getDate() === day &&
              el.getAttribute('aria-disabled') !== 'true'
            );
          });
          if (!cell) throw new Error('Date unavailable');
          cell.click();
          await waitFor(
            () => (input.value && !calendar.isConnected ? input : null),
            2_000,
          );
          return;
        }
        const next = calendar.querySelector<HTMLButtonElement>(
          offset > 0 ? '.NavArrow--next' : '.NavArrow--prev',
        );
        if (!next || next.disabled)
          throw new Error('Calendar navigation unavailable');
        next.click();
        await waitFor(
          () =>
            calendar
              .querySelector('.DayPicker-Caption')
              ?.textContent?.trim() !== heading
              ? calendar
              : null,
          2_000,
        );
      }
      throw new Error('Date outside calendar range');
    });
  if (failed.includes('moveInDate')) {
    const input = dialog.querySelector<HTMLInputElement>(
      'input[name="moveInDate"]',
    );
    if (input?.getAttribute('aria-expanded') === 'true') input.click();
  }
  const submit =
    dialog.querySelector<HTMLButtonElement>('button[type="submit"]') ??
    Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
      (el) => /^See [\d,]+ homes$/.test(el.textContent?.trim() ?? ''),
    );
  if (!submit) return { applied: [], failed: requested };
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

export async function launchRedfinSearch(
  search: RentalSearch,
  bootstrapUrl: string,
  siteAccess?: Promise<boolean>,
): Promise<RedfinLaunchOutcome> {
  const destination = new URL(bootstrapUrl);
  if (destination.origin !== REDFIN_ORIGIN)
    throw new Error('RentSight blocked an unexpected Redfin destination.');
  if (!search.location) {
    await chrome.tabs.create({ url: destination.toString() });
    return { automated: false };
  }
  if (!redfinAppliedCriteria(search).includes('location')) {
    await chrome.tabs.create({ url: destination.toString() });
    return {
      automated: false,
      message:
        'Redfin opened. Enter a city (ideally with a state) to apply filters automatically.',
    };
  }
  let granted = false;
  try {
    granted = siteAccess
      ? await siteAccess
      : await chrome.permissions.request({
          origins: [REDFIN_HOST_PERMISSION],
        });
  } catch (error) {
    console.error('[RentSight] Redfin site access request failed', error);
  }
  const tab = await chrome.tabs.create({ url: destination.toString() });
  if (!granted || tab.id === undefined)
    return {
      automated: false,
      message:
        'Redfin opened. Site access is needed to resolve the location and apply filters automatically.',
    };
  try {
    if (!(await waitForTab(tab.id, (t) => t.status === 'complete')))
      throw new Error('Landing page unavailable');
    const [locationResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: resolveRedfinLocationPage,
      args: [search.location],
    });
    if (
      !locationResult?.result ||
      !(await waitForTab(
        tab.id,
        (t) =>
          t.status === 'complete' &&
          Boolean(
            t.url &&
            new URL(t.url).origin === REDFIN_ORIGIN &&
            /\/rentals\/?$/.test(new URL(t.url).pathname) &&
            new URL(t.url).pathname !== '/rentals',
          ),
      ))
    )
      throw new Error('Location unavailable');
    const requested = redfinAppliedCriteria(search).filter(
      (item) => item !== 'location',
    );
    const ambiguousLocation = !/^\s*[^,]+,\s*[a-z]{2}\s*$/i.test(
      search.location,
    );
    if (!requested.length)
      return ambiguousLocation
        ? {
            automated: true,
            message:
              'Redfin used its first matching city suggestion. Check the city and state before browsing.',
          }
        : { automated: true };
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillRedfinSearchPage,
      args: [search],
    });
    const result = injection?.result as RedfinPageResult | undefined;
    if (
      !result?.submitted ||
      requested.some((item) => !result.applied.includes(item))
    )
      return {
        automated: false,
        message:
          'Redfin opened and applied the available filters. Review the remaining preferences on site.',
      };
    return ambiguousLocation
      ? {
          automated: true,
          message:
            'Redfin applied the filters using its first matching city suggestion. Check the city and state before browsing.',
        }
      : { automated: true };
  } catch (error) {
    console.error('[RentSight] Redfin assisted search failed', error);
    return {
      automated: false,
      message:
        'Redfin opened, but its location or filters could not be fully applied. Use a city and state (for example Springfield, MO) and review the search on site.',
    };
  }
}
