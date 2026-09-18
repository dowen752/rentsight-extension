import type { RentalSearch, SearchCriterion } from './types';
import {
  ZILLOW_HOST_PERMISSION,
  ZILLOW_ORIGIN,
  zillowAppliedCriteria,
  zillowNeedsPageFill,
} from './zillow';

const ZILLOW_LOAD_TIMEOUT_MS = 20_000;

export interface ZillowLaunchOutcome {
  automated: boolean;
  message?: string;
}

export interface ZillowPageFillResult {
  applied: SearchCriterion[];
  failed: SearchCriterion[];
}

function waitForTabComplete(tabId: number): Promise<void> {
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
        fail('The Zillow tab was closed before its search was ready.');
    };
    const timeout = setTimeout(
      () => fail('Zillow took too long to prepare the search.'),
      ZILLOW_LOAD_TIMEOUT_MS,
    );
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    void chrome.tabs.get(tabId).then(
      (tab) => {
        if (tab.status === 'complete') finish();
      },
      () => fail('The Zillow search tab is no longer available.'),
    );
  });
}

/** Runs in Zillow's isolated extension world and uses Zillow's own controls. */
export async function fillZillowSearchPage(
  search: RentalSearch,
): Promise<ZillowPageFillResult> {
  const applied: SearchCriterion[] = [];
  const failed: SearchCriterion[] = [];
  const sleep = (milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  const isVisible = (element: Element): boolean =>
    element.getClientRects().length > 0;
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
    throw new Error('A Zillow filter control did not become available.');
  };
  const visibleDialog = (): HTMLElement | undefined =>
    Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
      isVisible,
    );
  const openDialog = async (testId: string): Promise<HTMLElement> => {
    const button = await waitFor(() => {
      const candidate = document.querySelector<HTMLButtonElement>(
        `[data-testid="${testId}"]`,
      );
      return candidate && isVisible(candidate) ? candidate : undefined;
    });
    button.click();
    return waitFor(visibleDialog);
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
    await sleep(100);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    await sleep(100);
  };
  const normalizedText = (element: Element) =>
    (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const clickDone = async (dialog: HTMLElement) => {
    const button = await waitFor(() =>
      Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidate) =>
          isVisible(candidate) &&
          /^(?:see\s+.*\s+rentals?\s+available|apply(?:\s+filters?)?|done)$/i.test(
            normalizedText(candidate),
          ),
      ),
    );
    button.click();
    const deadline = Date.now() + 3_000;
    while (dialog.isConnected && isVisible(dialog) && Date.now() < deadline)
      await sleep(100);
    if (dialog.isConnected && isVisible(dialog))
      throw new Error('Zillow did not finish applying a filter group.');
    await sleep(250);
  };
  const recordFailure = (criteria: SearchCriterion[]) => {
    for (const criterion of criteria) {
      if (!failed.includes(criterion)) failed.push(criterion);
    }
  };
  const recordApplied = (criteria: SearchCriterion[]) => {
    for (const criterion of criteria) {
      if (!applied.includes(criterion)) applied.push(criterion);
    }
  };
  const groupFor = (
    root: HTMLElement,
    label: RegExp,
  ): HTMLElement | undefined => {
    const labelElement = Array.from(
      root.querySelectorAll<HTMLElement>('*'),
    ).find(
      (element) =>
        element.children.length === 0 && label.test(normalizedText(element)),
    );
    if (!labelElement) return undefined;
    let container = labelElement.parentElement;
    while (container && container !== root) {
      if (container.querySelectorAll('button,input,select').length >= 2)
        return container;
      container = container.parentElement;
    }
    return labelElement.parentElement ?? undefined;
  };
  const clickChoice = (
    group: HTMLElement,
    labels: readonly string[],
  ): boolean => {
    const choice = Array.from(
      group.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) =>
      labels.some(
        (label) => normalizedText(button).toLowerCase() === label.toLowerCase(),
      ),
    );
    if (!choice) return false;
    if (choice.getAttribute('aria-pressed') !== 'true') choice.click();
    return true;
  };
  const labeledChoice = (
    root: HTMLElement,
    label: string,
  ): HTMLElement | undefined => {
    const accessible = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button[aria-label], [role="button"][aria-label]',
      ),
    ).find(
      (element) =>
        isVisible(element) &&
        element.getAttribute('aria-label')?.toLowerCase() ===
          label.toLowerCase(),
    );
    return (
      accessible ??
      Array.from(root.querySelectorAll<HTMLElement>('button,label')).find(
        (element) =>
          isVisible(element) &&
          normalizedText(element).toLowerCase() === label.toLowerCase(),
      )
    );
  };
  const enableLabeledChoice = (root: HTMLElement, label: string): boolean => {
    const exact = labeledChoice(root, label);
    if (!exact) return false;
    if (exact instanceof HTMLLabelElement) {
      const input = exact.querySelector<HTMLInputElement>(
        'input[type="checkbox"], input[type="radio"]',
      );
      if (!input) return false;
      if (!input.checked) exact.click();
      return true;
    }
    if (exact.getAttribute('aria-pressed') !== 'true') exact.click();
    return true;
  };
  const propertyTypeLabels = {
    apartment_condo: 'Apartments/Condos',
    house: 'Houses',
    townhouse: 'Townhomes',
  } as const;
  const selectPropertyTypes = async (root: HTMLElement): Promise<boolean> => {
    if (!search.propertyTypes?.length) return true;
    for (const propertyType of search.propertyTypes) {
      const label = propertyTypeLabels[propertyType];
      const choice = labeledChoice(root, label);
      if (!choice) return false;
      if (choice.getAttribute('aria-pressed') !== 'true') choice.click();
      try {
        await waitFor(() => {
          const updated = labeledChoice(root, label);
          return updated?.getAttribute('aria-pressed') === 'true'
            ? updated
            : undefined;
        }, 2_000);
      } catch {
        return false;
      }
    }
    return true;
  };
  const propertyTypePanel = (): HTMLElement | undefined => {
    const heading = Array.from(
      document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,p,span'),
    ).find(
      (element) =>
        isVisible(element) && /^home type$/i.test(normalizedText(element)),
    );
    let container = heading?.parentElement;
    while (container && container !== document.body) {
      const labels = Array.from(
        container.querySelectorAll<HTMLElement>('[aria-label]'),
      ).map((element) => element.getAttribute('aria-label'));
      const hasPropertyTypes = Object.values(propertyTypeLabels).some((label) =>
        labels.includes(label),
      );
      const hasApplyAction = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button'),
      ).some((button) =>
        /^(?:see\s+.*\s+rentals?\s+available|apply(?:\s+filters?)?|done)$/i.test(
          normalizedText(button),
        ),
      );
      if (hasPropertyTypes && hasApplyAction) return container;
      container = container.parentElement;
    }
    return undefined;
  };
  const minimumInput = (
    root: HTMLElement,
    label: RegExp,
  ): HTMLInputElement | undefined => {
    const group = groupFor(root, label);
    if (!group) return undefined;
    return (
      Array.from(group.querySelectorAll<HTMLInputElement>('input')).find(
        (input) =>
          /minimum|min|no min/i.test(
            `${input.getAttribute('aria-label') ?? ''} ${
              input.getAttribute('placeholder') ?? ''
            }`,
          ),
      ) ??
      group.querySelector<HTMLInputElement>('input') ??
      undefined
    );
  };
  const setSelect = async (select: HTMLSelectElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      'value',
    )?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(100);
  };
  const minimumSquareFeetSelect = (
    root: HTMLElement,
  ): HTMLSelectElement | undefined =>
    root.querySelector<HTMLSelectElement>(
      '#sqft-min, select[aria-label="Home size min"], select[aria-label*="square" i][aria-label*="min" i]',
    ) ?? undefined;
  const closestSquareFeetOption = (
    select: HTMLSelectElement,
    requested: number,
  ): string | undefined =>
    Array.from(select.options)
      .map((option) => ({ option, value: Number(option.value) }))
      .filter(({ value }) => Number.isFinite(value) && value >= requested)
      .sort((left, right) => left.value - right.value)[0]?.option.value;
  const zillowMoveInDate = (date: string): string => {
    const [year, month, day] = date.split('-');
    return `${month}/${day}/${year}`;
  };

  if (location.origin !== 'https://www.zillow.com') {
    return {
      applied,
      failed: Object.keys(search) as SearchCriterion[],
    };
  }

  const rentCriteria = [
    ...(search.minListedRent !== undefined ? (['minListedRent'] as const) : []),
    ...(search.maxListedRent !== undefined ? (['maxListedRent'] as const) : []),
  ];
  if (rentCriteria.length) {
    try {
      const dialog = await openDialog('price-filters-button');
      if (search.minListedRent !== undefined) {
        const input = dialog.querySelector<HTMLInputElement>(
          '#price-input-min, input[data-testid="price-input-min"], input[aria-label="price min"]',
        );
        if (!input) throw new Error('Minimum rent control is unavailable.');
        await setInput(input, String(search.minListedRent));
      }
      if (search.maxListedRent !== undefined) {
        const input = dialog.querySelector<HTMLInputElement>(
          '#price-input-max, input[data-testid="price-input-max"], input[aria-label="price max"]',
        );
        if (!input) throw new Error('Maximum rent control is unavailable.');
        await setInput(input, String(search.maxListedRent));
      }
      await clickDone(dialog);
      recordApplied([...rentCriteria]);
    } catch {
      recordFailure([...rentCriteria]);
    }
  }

  const roomCriteria = [
    ...(search.minBedrooms !== undefined ? (['minBedrooms'] as const) : []),
    ...(search.minBathrooms !== undefined ? (['minBathrooms'] as const) : []),
  ];
  if (roomCriteria.length) {
    try {
      const dialog = await openDialog('beds-filters-button');
      if (search.minBedrooms !== undefined && search.minBedrooms > 0) {
        const group = groupFor(dialog, /^bedrooms?$/i);
        if (
          !group ||
          !clickChoice(group, [
            `${search.minBedrooms}+`,
            String(search.minBedrooms),
          ])
        )
          throw new Error('Bedroom control is unavailable.');
      }
      if (search.minBathrooms !== undefined && search.minBathrooms > 0) {
        const group = groupFor(dialog, /^bathrooms?$/i);
        if (
          !group ||
          !clickChoice(group, [
            `${search.minBathrooms}+`,
            String(search.minBathrooms),
          ])
        )
          throw new Error('Bathroom control is unavailable.');
      }
      await clickDone(dialog);
      recordApplied([...roomCriteria]);
    } catch {
      recordFailure([...roomCriteria]);
    }
  }

  let propertyTypesHandled = false;
  if (search.propertyTypes?.length) {
    const propertyTypeButton = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button'),
    ).find(
      (button) =>
        isVisible(button) &&
        /^property types?(?:\s|$)/i.test(normalizedText(button)),
    );
    if (propertyTypeButton) {
      propertyTypesHandled = true;
      try {
        propertyTypeButton.click();
        const panel = await waitFor(propertyTypePanel);
        if (!(await selectPropertyTypes(panel)))
          throw new Error(
            'Property type controls did not accept the selection.',
          );
        await clickDone(panel);
        recordApplied(['propertyTypes']);
      } catch {
        recordFailure(['propertyTypes']);
      }
    }
  }

  const moreChoices = [
    ['catsAllowed', 'Allows cats'],
    ['smallDogsAllowed', 'Allows small dogs'],
    ['largeDogsAllowed', 'Allows large dogs'],
    ['parkingAvailable', 'On-site parking'],
    ['inUnitLaundry', 'In-unit laundry'],
    ['airConditioning', 'Must have A/C'],
  ] as const satisfies readonly [SearchCriterion, string][];
  const requestedMore: SearchCriterion[] = moreChoices
    .filter(([criterion]) => search[criterion] === true)
    .map(([criterion]) => criterion);
  if (search.propertyTypes?.length && !propertyTypesHandled)
    requestedMore.push('propertyTypes');
  if (search.moveInDate !== undefined) requestedMore.push('moveInDate');
  if (search.minSquareFeet !== undefined) requestedMore.push('minSquareFeet');
  if (requestedMore.length) {
    try {
      const dialog = await openDialog('more-filters-button');
      const appliedHere: SearchCriterion[] = [];
      for (const [criterion, label] of moreChoices) {
        if (search[criterion] !== true) continue;
        if (enableLabeledChoice(dialog, label)) appliedHere.push(criterion);
        else recordFailure([criterion]);
      }
      if (search.propertyTypes?.length && !propertyTypesHandled) {
        const group = groupFor(dialog, /^home type$/i) ?? dialog;
        if (await selectPropertyTypes(group)) appliedHere.push('propertyTypes');
        else recordFailure(['propertyTypes']);
      }
      if (search.moveInDate !== undefined) {
        const moveInGroup = groupFor(dialog, /^move in date$/i);
        const input =
          moveInGroup?.querySelector<HTMLInputElement>(
            'input[placeholder="MM/DD/YYYY" i]',
          ) ??
          dialog.querySelector<HTMLInputElement>(
            'input[placeholder="MM/DD/YYYY" i]',
          );
        if (input) {
          await setInput(input, zillowMoveInDate(search.moveInDate));
          appliedHere.push('moveInDate');
        } else {
          recordFailure(['moveInDate']);
        }
      }
      if (search.minSquareFeet !== undefined) {
        const select = minimumSquareFeetSelect(dialog);
        const roundedValue = select
          ? closestSquareFeetOption(select, search.minSquareFeet)
          : undefined;
        if (select && roundedValue !== undefined) {
          await setSelect(select, roundedValue);
          appliedHere.push('minSquareFeet');
        } else {
          const input = minimumInput(
            dialog,
            /square\s*(?:feet|foot|footage|ft)/i,
          );
          if (input) {
            await setInput(input, String(search.minSquareFeet));
            appliedHere.push('minSquareFeet');
          } else {
            recordFailure(['minSquareFeet']);
          }
        }
      }
      await clickDone(dialog);
      recordApplied(appliedHere);
    } catch {
      recordFailure(
        requestedMore.filter((criterion) => !applied.includes(criterion)),
      );
    }
  }

  return { applied, failed };
}

export async function launchZillowSearch(
  search: RentalSearch,
  bootstrapUrl: string,
): Promise<ZillowLaunchOutcome> {
  const destination = new URL(bootstrapUrl);
  if (destination.origin !== ZILLOW_ORIGIN)
    throw new Error('RentSight blocked an unexpected Zillow destination.');
  destination.search = '';

  if (!zillowNeedsPageFill(search)) {
    await chrome.tabs.create({ url: destination.toString() });
    return { automated: false };
  }

  let granted = false;
  try {
    granted = await chrome.permissions.request({
      origins: [ZILLOW_HOST_PERMISSION],
    });
  } catch (error: unknown) {
    console.error('[RentSight] Zillow site access request failed', error);
  }
  const tab = await chrome.tabs.create({ url: destination.toString() });
  if (!granted) {
    return {
      automated: false,
      message:
        'Zillow opened at the requested location. Site access is needed to apply the remaining filters automatically.',
    };
  }
  if (tab.id === undefined)
    throw new Error('Zillow opened, but its tab could not be prepared.');

  try {
    await waitForTabComplete(tab.id);
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillZillowSearchPage,
      args: [search],
    });
    const result = injection?.result as ZillowPageFillResult | undefined;
    if (!result) throw new Error('Zillow did not return filter results.');
    const requested = zillowAppliedCriteria(search).filter(
      (criterion) => criterion !== 'location',
    );
    const unapplied = requested.filter(
      (criterion) => !result.applied.includes(criterion),
    );
    if (unapplied.length) {
      return {
        automated: false,
        message:
          'Zillow opened and applied the available filters. Review the remaining preferences on Zillow.',
      };
    }
    return { automated: true };
  } catch (error: unknown) {
    console.error('[RentSight] Zillow assisted search failed', error);
    return {
      automated: false,
      message:
        'Zillow opened at the requested location, but its filters could not be applied automatically. Review them on Zillow.',
    };
  }
}
