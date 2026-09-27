import type { RentalSearch, SearchCriterion } from './types';
import { RENT_HOST_PERMISSION, RENT_ORIGIN, rentAppliedCriteria } from './rent';

export interface RentLaunchOutcome {
  automated: boolean;
  message?: string;
}
export interface RentPageResult {
  applied: SearchCriterion[];
  failed: SearchCriterion[];
  submitted?: boolean;
}
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Injected into Rent.com's landing page; use its place suggestion, not a guessed route. */
export async function resolveRentLocationPage(
  requested: string,
): Promise<boolean> {
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));
  if (location.origin !== 'https://www.rent.com') return false;
  const waitFor = async <T extends Element>(
    find: () => T | undefined | null,
    ms = 6_000,
  ): Promise<T | undefined> => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const el = find();
      if (el) return el;
      await sleep(100);
    }
  };
  const input = await waitFor(() =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input[data-tid="search-input-field"]',
      ),
    ).find((el) => !el.disabled && el.getClientRects().length > 0),
  );
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  input.focus();
  setter?.call(input, requested);
  input.dispatchEvent(
    typeof InputEvent === 'function'
      ? new InputEvent('input', {
          bubbles: true,
          data: requested,
          inputType: 'insertText',
        })
      : new Event('input', { bubbles: true }),
  );
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const normalized = requested.trim().toLowerCase();
  const precise = /^.+,\s*[a-z]{2}$/i.test(requested);
  const suggestion = await waitFor(
    () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="listbox"] [role="option"]',
        ),
      ).find((option) => {
        const label = (option.textContent ?? '')
          .trim()
          .replace(/\s+/g, ' ')
          .toLowerCase();
        return (
          option.getClientRects().length > 0 &&
          (precise
            ? label === normalized
            : /^\d{5}$/.test(normalized)
              ? label.startsWith(normalized)
              : label.startsWith(`${normalized}, `))
        );
      }),
    6_000,
  );
  if (!suggestion) return false;
  suggestion.click();
  return true;
}

/** Injected into the results page. Each criterion fails independently. */
export async function fillRentSearchPage(
  search: RentalSearch,
): Promise<RentPageResult> {
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
    search.minBedrooms <= 4
      ? ['minBedrooms' as const]
      : []),
    ...(search.minBathrooms !== undefined &&
    Number.isInteger(search.minBathrooms) &&
    search.minBathrooms >= 0 &&
    search.minBathrooms <= 3
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
    search.minSquareFeet <= 1600
      ? ['minSquareFeet' as const]
      : []),
    ...(search.inUnitLaundry ? ['inUnitLaundry' as const] : []),
    ...(search.airConditioning ? ['airConditioning' as const] : []),
  ];
  const waitFor = async <T extends Element>(
    find: () => T | undefined | null,
    ms = 3_000,
  ): Promise<T> => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const el = find();
      if (el) return el;
      await sleep(100);
    }
    throw new Error('Rent.com filter control unavailable');
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
    location.origin !== 'https://www.rent.com' ||
    !document.querySelector('[data-tid="search-input-field"]')
  )
    return { applied, failed: requested };
  if (search.location) applied.push('location');
  const filters = await waitFor(() =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (el) => el.textContent?.trim() === 'Filters' && !el.disabled,
    ),
  );
  filters.click();
  const dialog = await waitFor(() =>
    document.querySelector<HTMLElement>('#all-filters-modal[open]'),
  );
  const checkbox = (value: string) =>
    Array.from(
      dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).find((el) => el.value === value);
  const toggle = async (value: string) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const input = await waitFor(() => checkbox(value));
      if (!input.checked) (input.labels?.[0] ?? input).click();
      // The native checkbox changes immediately; Rent.com's controlled state
      // commits on a later render. Re-read the mounted control after that turn.
      await sleep(150);
      if (checkbox(value)?.checked) return;
    }
    throw new Error(`Rent.com did not retain ${value}`);
  };
  const priceValue = (testId: string) => {
    const value = dialog.querySelector<HTMLInputElement>(
      `input[data-tid="${testId}"]`,
    )?.value;
    return value ? Number(value.replace(/[^\d]/g, '')) : undefined;
  };
  const setPrice = async (testId: string, amount: number) => {
    const input = await waitFor(() =>
      dialog.querySelector<HTMLInputElement>(`input[data-tid="${testId}"]`),
    );
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    input.focus();
    setter?.call(input, String(amount));
    input.dispatchEvent(
      typeof InputEvent === 'function'
        ? new InputEvent('input', {
            bubbles: true,
            data: String(amount),
            inputType: 'insertText',
          })
        : new Event('input', { bubbles: true }),
    );
    // Blurring in the same task can make Rent.com's blur handler read its old
    // React value and clear the field. Give the input event a render turn.
    await sleep(150);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    await sleep(150);
    if (priceValue(testId) !== amount)
      throw new Error(`Rent.com did not retain ${testId}`);
  };
  if (search.minListedRent !== undefined)
    await apply(['minListedRent'], () =>
      setPrice('min-price-input', search.minListedRent!),
    );
  if (search.maxListedRent !== undefined)
    await apply(['maxListedRent'], () =>
      setPrice('max-price-input', search.maxListedRent!),
    );
  if (requested.includes('minBedrooms'))
    await apply(['minBedrooms'], async () => {
      const minimum = search.minBedrooms!;
      if (minimum === 0) return;
      await toggle(`${minimum}-bedroom`);
      if (minimum < 4) await toggle('4-bedroom');
      for (let n = minimum; n <= 4; n++)
        await waitFor(
          () =>
            dialog.querySelector<HTMLInputElement>(
              `input[value="${n}-bedroom"]`,
            )?.checked
              ? dialog
              : null,
          1_000,
        );
    });
  if (requested.includes('minBathrooms'))
    await apply(['minBathrooms'], async () => {
      const minimum = search.minBathrooms!;
      if (minimum === 0) return;
      await toggle(`${minimum}-bathroom`);
      if (minimum < 3) await toggle('3-bathroom');
      for (let n = minimum; n <= 3; n++)
        await waitFor(
          () =>
            dialog.querySelector<HTMLInputElement>(
              `input[value="${n}-bathroom"]`,
            )?.checked
              ? dialog
              : null,
          1_000,
        );
    });
  if (search.propertyTypes?.length)
    await apply(['propertyTypes'], async () => {
      const values = search.propertyTypes!.flatMap((type) =>
        type === 'apartment_condo'
          ? ['apartments', 'condos']
          : type === 'house'
            ? ['houses']
            : ['townhouses'],
      );
      for (const value of values) await toggle(value);
    });
  const dogCriteria: SearchCriterion[] = [
    ...(search.smallDogsAllowed ? ['smallDogsAllowed' as const] : []),
    ...(search.largeDogsAllowed ? ['largeDogsAllowed' as const] : []),
  ];
  const petCriteria: SearchCriterion[] = [
    ...(search.catsAllowed ? ['catsAllowed' as const] : []),
    ...dogCriteria,
  ];
  const petValue =
    search.catsAllowed && dogCriteria.length
      ? 'pet-friendly'
      : search.catsAllowed
        ? 'cat-friendly'
        : dogCriteria.length
          ? 'dog-friendly'
          : undefined;
  if (petValue) await apply(petCriteria, () => toggle(petValue));
  if (search.airConditioning)
    await apply(['airConditioning'], () => toggle('air-conditioning'));
  if (search.inUnitLaundry)
    await apply(['inUnitLaundry'], () => toggle('washer-dryer-in-unit'));
  if (requested.includes('minSquareFeet'))
    await apply(['minSquareFeet'], async () => {
      const combo = await waitFor(() =>
        dialog.querySelector<HTMLElement>(
          '[data-tid="min-sqft-dropdown"] [role="combobox"]',
        ),
      );
      if (search.minSquareFeet === 0) return;
      const rounded = Math.ceil(search.minSquareFeet! / 100) * 100;
      combo.click();
      const option = await waitFor(() =>
        dialog.querySelector<HTMLElement>(
          `[data-tag_item="sqft-min-${rounded}"][role="option"]`,
        ),
      );
      option.click();
      await waitFor(
        () =>
          combo.textContent?.replace(/,/g, '').includes(`${rounded}+`)
            ? combo
            : null,
        1_500,
      );
    });
  if (search.moveInDate)
    await apply(['moveInDate'], async () => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(search.moveInDate!);
      if (!match) throw new Error('Invalid date');
      const [, yy, mm, dd] = match;
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
        dialog.querySelector<HTMLInputElement>('input[name="move-in-date"]'),
      );
      input.click();
      await waitFor(
        () => dialog.querySelector<HTMLElement>('[data-tid="calendar"]'),
        2_000,
      );
      const calendarHeading = () =>
        dialog
          .querySelector<HTMLElement>('[data-tid="calendar"]')
          ?.querySelector<HTMLElement>(':scope > div > div')
          ?.textContent?.trim();
      for (let step = 0; step < 25; step++) {
        const calendar = await waitFor(() =>
          dialog.querySelector<HTMLElement>('[data-tid="calendar"]'),
        );
        const heading = calendarHeading();
        const displayed = heading ? new Date(`${heading} 1`) : new Date(NaN);
        if (Number.isNaN(displayed.getTime()))
          throw new Error('Calendar month unavailable');
        const offset =
          (year - displayed.getFullYear()) * 12 +
          month -
          1 -
          displayed.getMonth();
        if (!offset) {
          const cell = calendar.querySelector<HTMLButtonElement>(
            `button[data-tid="calendar-day-option"][data-dt="${search.moveInDate}"]`,
          );
          if (!cell || cell.disabled) throw new Error('Date unavailable');
          cell.click();
          await waitFor(
            () => (input.value === search.moveInDate ? input : null),
            2_000,
          );
          return;
        }
        const buttons = Array.from(
          calendar.querySelectorAll<HTMLButtonElement>('button[type="button"]'),
        );
        const navigation = buttons.find(
          (button) => button.textContent?.trim() === (offset > 0 ? '→' : '←'),
        );
        if (!navigation || navigation.disabled)
          throw new Error('Calendar navigation unavailable');
        navigation.click();
        await waitFor(
          () =>
            calendarHeading() && calendarHeading() !== heading
              ? dialog.querySelector<HTMLElement>('[data-tid="calendar"]')
              : null,
          2_000,
        );
      }
      throw new Error('Date outside calendar range');
    });
  // Later filters can replace a pending price or pet update. Reconcile these
  // controls together before the site snapshots the dialog on submission.
  const reconcile = async (
    criteria: SearchCriterion[],
    retained: (criterion: SearchCriterion) => boolean,
    restore: () => Promise<void>,
  ) => {
    for (let attempt = 0; attempt < 2 && !criteria.every(retained); attempt++) {
      try {
        await restore();
        await sleep(150);
      } catch {
        // Report the criterion as unapplied below, without blocking others.
      }
    }
    for (const criterion of criteria) {
      const wasApplied = applied.indexOf(criterion);
      const wasFailed = failed.indexOf(criterion);
      if (retained(criterion)) {
        if (wasFailed >= 0) failed.splice(wasFailed, 1);
        if (wasApplied < 0) applied.push(criterion);
      } else {
        if (wasApplied >= 0) applied.splice(wasApplied, 1);
        if (wasFailed < 0) failed.push(criterion);
      }
    }
  };
  if (search.minListedRent !== undefined)
    await reconcile(
      ['minListedRent'],
      () => priceValue('min-price-input') === search.minListedRent,
      () => setPrice('min-price-input', search.minListedRent!),
    );
  if (search.maxListedRent !== undefined)
    await reconcile(
      ['maxListedRent'],
      () => priceValue('max-price-input') === search.maxListedRent,
      () => setPrice('max-price-input', search.maxListedRent!),
    );
  if (petValue) {
    await reconcile(
      petCriteria,
      () => Boolean(checkbox(petValue)?.checked),
      () => toggle(petValue),
    );
  }
  const submit = dialog.querySelector<HTMLButtonElement>(
    '[data-tid="show-results"]',
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

export async function launchRentSearch(
  search: RentalSearch,
  bootstrapUrl: string,
): Promise<RentLaunchOutcome> {
  const destination = new URL(bootstrapUrl);
  if (destination.origin !== RENT_ORIGIN)
    throw new Error('RentSight blocked an unexpected Rent.com destination.');
  if (!search.location) {
    await chrome.tabs.create({ url: destination.toString() });
    return { automated: false };
  }
  let granted = false;
  try {
    granted = await chrome.permissions.request({
      origins: [RENT_HOST_PERMISSION],
    });
  } catch (error) {
    console.error('[RentSight] Rent.com site access request failed', error);
  }
  const tab = await chrome.tabs.create({ url: destination.toString() });
  if (!granted || tab.id === undefined)
    return {
      automated: false,
      message:
        'Rent.com opened. Site access is needed to resolve the location and apply filters automatically.',
    };
  try {
    if (!(await waitForTab(tab.id, (t) => t.status === 'complete')))
      throw new Error('Landing page unavailable');
    const [locationResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: resolveRentLocationPage,
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
            new URL(t.url).origin === RENT_ORIGIN &&
            new URL(t.url).pathname !== '/',
          ),
      ))
    )
      throw new Error('Location unavailable');
    const requested = rentAppliedCriteria(search).filter(
      (item) => item !== 'location',
    );
    const ambiguous =
      !/^.+,\s*[a-z]{2}$/i.test(search.location) &&
      !/^\d{5}$/.test(search.location);
    if (!requested.length)
      return ambiguous
        ? {
            automated: true,
            message:
              'Rent.com selected its first matching place. Verify the city and state before browsing.',
          }
        : { automated: true };
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillRentSearchPage,
      args: [search],
    });
    const result = injection?.result as RentPageResult | undefined;
    if (
      !result?.submitted ||
      requested.some((item) => !result.applied.includes(item))
    )
      return {
        automated: false,
        message:
          'Rent.com opened and applied the available filters. Review the remaining preferences on site.',
      };
    return ambiguous
      ? {
          automated: true,
          message:
            'Rent.com applied filters to its first matching place. Verify the city and state before browsing.',
        }
      : { automated: true };
  } catch (error) {
    console.error('[RentSight] Rent.com assisted search failed', error);
    return {
      automated: false,
      message:
        'Rent.com opened, but its location or filters could not be fully applied. Review the search on site.',
    };
  }
}
