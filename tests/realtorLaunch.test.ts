import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fillRealtorSearchPage,
  launchRealtorSearch,
  realtorAppliedCriteria,
  resolveRealtorLocationPage,
  type RentalSearch,
} from '../src/search';

function installDom(dom: JSDOM) {
  const { window } = dom;
  for (const [name, value] of [
    ['document', window.document],
    ['window', window],
    ['location', window.location],
    ['getComputedStyle', window.getComputedStyle.bind(window)],
    ['Element', window.Element],
    ['HTMLElement', window.HTMLElement],
    ['HTMLInputElement', window.HTMLInputElement],
    ['HTMLSelectElement', window.HTMLSelectElement],
    ['Event', window.Event],
    ['InputEvent', window.InputEvent],
  ] as const) {
    vi.stubGlobal(name, value);
  }
}

function chromeForRealtor({ granted }: { granted: boolean }) {
  const permissionRequest = vi.fn().mockResolvedValue(granted);
  const create = vi.fn().mockResolvedValue({ id: 71, status: 'loading' });
  const get = vi.fn().mockResolvedValue({ id: 71, status: 'complete' });
  const executeScript = vi
    .fn()
    .mockResolvedValueOnce([{ result: { ready: true, submitted: false } }])
    .mockResolvedValueOnce([
      {
        result: {
          applied: [
            'location',
            'minListedRent',
            'maxListedRent',
            'minBedrooms',
            'minBathrooms',
            'propertyTypes',
          ],
          failed: [],
        },
      },
    ]);
  vi.stubGlobal('chrome', {
    permissions: { request: permissionRequest },
    tabs: {
      create,
      get,
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    scripting: { executeScript },
  });
  return { permissionRequest, create, executeScript };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Realtor.com assisted search launch', () => {
  it('uses Realtor.com autocomplete and clicks the first location suggestion', async () => {
    const dom = new JSDOM(
      `
        <input data-testid="freeTypeInput" role="combobox" />
        <div role="listbox">
          <div role="option">Springfield, MO</div>
          <div role="option">Springfield, IL</div>
        </div>
      `,
      { url: 'https://www.realtor.com/rentals' },
    );
    installDom(dom);
    const suggestions =
      dom.window.document.querySelectorAll<HTMLElement>('[role="option"]');
    const firstClick = vi.fn();
    const secondClick = vi.fn();
    suggestions[0].addEventListener('click', firstClick);
    suggestions[1].addEventListener('click', secondClick);

    await expect(resolveRealtorLocationPage('Springfield')).resolves.toEqual({
      ready: false,
      submitted: true,
    });
    expect(
      dom.window.document.querySelector<HTMLInputElement>(
        '[data-testid="freeTypeInput"]',
      )?.value,
    ).toBe('Springfield');
    expect(firstClick).toHaveBeenCalledOnce();
    expect(secondClick).not.toHaveBeenCalled();
    dom.window.close();
  });

  it('fills the unified filter drawer, rounds square feet up, and submits once', async () => {
    const numberOptions = (prefix: 'bed' | 'bath') =>
      ['Any', ...(prefix === 'bed' ? ['Studio'] : []), '1', '2', '3', '4', '5+']
        .map(
          (value) =>
            `<input type="checkbox" id="${prefix}-checkbox-group-${value}" ${value === 'Any' ? 'checked' : ''} />`,
        )
        .join('');
    const dom = new JSDOM(
      `
        <button>Filters</button>
        <div data-testid="accordion-price" aria-expanded="true">Price <span class="status"></span></div>
        <div class="input-dropdown">
          <input id="min-price-dropdown" />
          <ul role="listbox"><li role="option">$1000</li></ul>
        </div>
        <div class="input-dropdown"><input id="max-price-dropdown" /></div>
        <input id="propertyType-any" type="checkbox" checked />
        <input id="propertyType-apartments" type="checkbox" />
        <input id="propertyType-townhome" type="checkbox" />
        <input id="propertyType-condo" type="checkbox" />
        <input id="propertyType-single-family-home" type="checkbox" />
        ${numberOptions('bed')}
        ${numberOptions('bath')}
        <div><div data-name="input-group"><input id="start-date" /></div><button aria-label="Open calendar">Calendar</button></div>
        <label data-testid="option-cats"><input type="checkbox" /></label>
        <label data-testid="option-dogs"><input type="checkbox" /></label>
        <select id="home-size-from-options">
          <option value="Any sqft">Any sqft</option>
          <option value="500">500 sqft</option>
          <option value="750">750 sqft</option>
          <option value="1000">1,000 sqft</option>
        </select>
        <label data-testid="option-garage1OrMore"><input type="checkbox" /></label>
        <label data-testid="option-washerDryer"><input type="checkbox" /></label>
        <button data-testid="view-more-filters-results">View 433 homes</button>
      `,
      { url: 'https://www.realtor.com/apartments/springfield_MO' },
    );
    installDom(dom);
    const { document } = dom.window;
    const heading = document.querySelector<HTMLElement>(
      '[data-testid="accordion-price"]',
    )!;
    const minInput = document.querySelector<HTMLInputElement>(
      '#min-price-dropdown',
    )!;
    const maxInput = document.querySelector<HTMLInputElement>(
      '#max-price-dropdown',
    )!;
    const draft = { min: '', max: '' };
    const committed = { min: '', max: '' };
    minInput.addEventListener('input', () => {
      draft.min = minInput.value;
    });
    maxInput.addEventListener('input', () => {
      draft.max = maxInput.value;
    });
    document.querySelector('[role="option"]')?.addEventListener('click', () => {
      committed.min = '1,000';
      minInput.value = committed.min;
      heading.querySelector('.status')!.textContent = 'Min $1K';
    });
    heading.addEventListener('click', () => {
      const expanded = heading.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        committed.min = draft.min || committed.min;
        committed.max = draft.max || committed.max;
      }
      heading.setAttribute('aria-expanded', String(!expanded));
      minInput.value = committed.min;
      maxInput.value = committed.max;
      heading.querySelector('.status')!.textContent =
        committed.min && committed.max
          ? '$1K - $6K'
          : committed.min
            ? 'Min $1K'
            : '';
    });
    document
      .querySelector('button[aria-label="Open calendar"]')
      ?.addEventListener('click', () => {
        const calendar = document.createElement('div');
        calendar.setAttribute('role', 'application');
        calendar.setAttribute('aria-label', 'Calendar');
        calendar.innerHTML = `
        <span class="month-display">September 2026</span>
        <button aria-label="Next month">Next</button>
        <button class="date" id="09/24/26" aria-disabled="false">24</button>
        <button class="date" id="09/18/26" aria-disabled="true">18</button>
      `;
        calendar
          .querySelector('button.date[id="09/24/26"]')
          ?.addEventListener('click', () => {
            document.querySelector<HTMLInputElement>('#start-date')!.value =
              '09/24/26';
            calendar.remove();
          });
        document.body.append(calendar);
      });
    const submit = vi.fn();
    dom.window.document
      .querySelector('[data-testid="view-more-filters-results"]')
      ?.addEventListener('click', submit);

    await expect(
      fillRealtorSearchPage({
        location: 'Springfield, MO',
        minListedRent: 1_000,
        maxListedRent: 6_000,
        minBedrooms: 2,
        minBathrooms: 2,
        propertyTypes: ['apartment_condo', 'townhouse'],
        catsAllowed: true,
        smallDogsAllowed: true,
        largeDogsAllowed: true,
        moveInDate: '2026-09-24',
        minSquareFeet: 600,
        parkingAvailable: true,
        inUnitLaundry: true,
      }),
    ).resolves.toEqual({
      applied: [
        'location',
        'minListedRent',
        'maxListedRent',
        'propertyTypes',
        'minBedrooms',
        'minBathrooms',
        'moveInDate',
        'catsAllowed',
        'smallDogsAllowed',
        'largeDogsAllowed',
        'minSquareFeet',
        'parkingAvailable',
        'inUnitLaundry',
      ],
      failed: [],
    });
    expect(
      dom.window.document.querySelector<HTMLInputElement>('#min-price-dropdown')
        ?.value,
    ).toBe('1,000');
    expect(
      dom.window.document.querySelector<HTMLInputElement>('#max-price-dropdown')
        ?.value,
    ).toBe('6000');
    expect(heading.querySelector('.status')?.textContent).toBe('$1K - $6K');
    for (const id of [
      'propertyType-apartments',
      'propertyType-condo',
      'propertyType-townhome',
      'bed-checkbox-group-2',
      'bed-checkbox-group-3',
      'bed-checkbox-group-4',
      'bed-checkbox-group-5+',
      'bath-checkbox-group-2',
      'bath-checkbox-group-3',
      'bath-checkbox-group-4',
      'bath-checkbox-group-5+',
    ]) {
      expect(
        dom.window.document.getElementById(id) as HTMLInputElement,
      ).toHaveProperty('checked', true);
    }
    expect(
      dom.window.document.querySelector<HTMLInputElement>('#start-date')?.value,
    ).toBe('09/24/26');
    expect(
      dom.window.document.querySelector<HTMLSelectElement>(
        '#home-size-from-options',
      )?.value,
    ).toBe('750');
    expect(submit).toHaveBeenCalledOnce();
    dom.window.close();
  });

  it('navigates the datepicker and reports a disabled date without losing other filters', async () => {
    const dom = new JSDOM(
      `
        <button>Filters</button>
        <div>
          <div data-name="input-group"><input id="start-date" placeholder="mm/dd/yy" /></div>
          <button aria-label="Open calendar">Open calendar</button>
          <button aria-label="Close calendar">Close calendar</button>
        </div>
        <label data-testid="option-cats"><input type="checkbox" /></label>
        <button data-testid="view-more-filters-results">View homes</button>
      `,
      { url: 'https://www.realtor.com/apartments/Springfield_MO' },
    );
    installDom(dom);
    const { document } = dom.window;
    const submit = vi.fn();
    document
      .querySelector('[data-testid="view-more-filters-results"]')
      ?.addEventListener('click', submit);
    document
      .querySelector('button[aria-label="Close calendar"]')
      ?.addEventListener('click', () =>
        document.querySelector('[role="application"]')?.remove(),
      );
    document
      .querySelector('button[aria-label="Open calendar"]')
      ?.addEventListener('click', () => {
        const calendar = document.createElement('div');
        calendar.setAttribute('role', 'application');
        calendar.setAttribute('aria-label', 'Calendar');
        calendar.innerHTML = `
          <span class="month-display">September 2026</span>
          <button aria-label="Previous month" aria-disabled="true">Previous</button>
          <button aria-label="Next month">Next</button>
          <button class="date" id="09/18/26" aria-disabled="true">18</button>
        `;
        calendar
          .querySelector('button[aria-label="Next month"]')
          ?.addEventListener('click', () => {
            calendar.querySelector('.month-display')!.textContent =
              'October 2026';
            const day = document.createElement('button');
            day.className = 'date';
            day.id = '10/03/26';
            day.textContent = '3';
            day.addEventListener('click', () => {
              document.querySelector<HTMLInputElement>('#start-date')!.value =
                '10/03/26';
              calendar.remove();
            });
            calendar.append(day);
          });
        document.body.append(calendar);
      });

    await expect(
      fillRealtorSearchPage({
        location: 'Springfield, MO',
        moveInDate: '2026-10-03',
        catsAllowed: true,
      }),
    ).resolves.toEqual({
      applied: ['location', 'moveInDate', 'catsAllowed'],
      failed: [],
    });
    expect(document.querySelector<HTMLInputElement>('#start-date')?.value).toBe(
      '10/03/26',
    );

    await expect(
      fillRealtorSearchPage({
        location: 'Springfield, MO',
        moveInDate: '2026-09-18',
        catsAllowed: true,
      }),
    ).resolves.toEqual({
      applied: ['location', 'catsAllowed'],
      failed: ['moveInDate'],
    });
    expect(document.querySelector('[role="application"]')).toBeNull();
    expect(submit).toHaveBeenCalledTimes(2);
    dom.window.close();
  });

  it('does not count a transient price textbox value as an applied bound', async () => {
    const dom = new JSDOM(
      `
        <button>Filters</button>
        <div data-testid="accordion-price" aria-expanded="true">Price <span class="status"></span></div>
        <div class="input-dropdown"><input id="min-price-dropdown" /></div>
        <label data-testid="option-cats"><input type="checkbox" /></label>
        <button data-testid="view-more-filters-results">View homes</button>
      `,
      { url: 'https://www.realtor.com/apartments/Springfield_MO' },
    );
    installDom(dom);
    const { document } = dom.window;
    const nativeEdit = vi.fn(() => {
      document.querySelector<HTMLInputElement>('#min-price-dropdown')!.value +=
        '1300';
      return true;
    });
    Object.defineProperty(document, 'execCommand', { value: nativeEdit });
    const heading = document.querySelector<HTMLElement>(
      '[data-testid="accordion-price"]',
    )!;
    heading.addEventListener('click', () => {
      heading.setAttribute(
        'aria-expanded',
        String(heading.getAttribute('aria-expanded') !== 'true'),
      );
      document.querySelector<HTMLInputElement>('#min-price-dropdown')!.value =
        '';
    });
    const submit = vi.fn();
    document
      .querySelector('[data-testid="view-more-filters-results"]')
      ?.addEventListener('click', submit);

    await expect(
      fillRealtorSearchPage({
        location: 'Springfield, MO',
        minListedRent: 1_300,
        catsAllowed: true,
      }),
    ).resolves.toEqual({
      applied: ['location', 'catsAllowed'],
      failed: ['minListedRent'],
    });
    expect(submit).toHaveBeenCalledOnce();
    expect(nativeEdit).not.toHaveBeenCalled();
    dom.window.close();
  });

  it('waits for a custom price to commit instead of appending it a second time', async () => {
    const dom = new JSDOM(
      `
        <button>Filters</button>
        <div data-testid="accordion-price" aria-expanded="true">Price <span class="status"></span></div>
        <div class="input-dropdown"><input id="max-price-dropdown" /></div>
        <button data-testid="view-more-filters-results">View homes</button>
      `,
      { url: 'https://www.realtor.com/apartments/Springfield_MO' },
    );
    installDom(dom);
    const { document } = dom.window;
    const input = document.querySelector<HTMLInputElement>(
      '#max-price-dropdown',
    )!;
    const heading = document.querySelector<HTMLElement>(
      '[data-testid="accordion-price"]',
    )!;
    let draft = '';
    input.addEventListener('input', () => {
      draft = input.value;
    });
    heading.addEventListener('click', () => {
      const expanded = heading.getAttribute('aria-expanded') === 'true';
      heading.setAttribute('aria-expanded', String(!expanded));
      if (expanded) {
        setTimeout(() => {
          input.value = Number(draft).toLocaleString('en-US');
          heading.querySelector('.status')!.textContent = 'Max $6K';
        }, 250);
      }
    });
    const nativeEdit = vi.fn(() => {
      input.value += '6000';
      return true;
    });
    Object.defineProperty(document, 'execCommand', { value: nativeEdit });

    await expect(
      fillRealtorSearchPage({
        location: 'Springfield, MO',
        maxListedRent: 6_000,
      }),
    ).resolves.toEqual({
      applied: ['location', 'maxListedRent'],
      failed: [],
    });
    expect(input.value).toBe('6,000');
    expect(nativeEdit).not.toHaveBeenCalled();
    dom.window.close();
  });

  it('opens a clean page and requests only Realtor.com access', async () => {
    const chromeMock = chromeForRealtor({ granted: true });
    const search = {
      location: 'Springfield, MO',
      minListedRent: 1_000,
      maxListedRent: 6_000,
      minBedrooms: 1,
      minBathrooms: 2,
      propertyTypes: ['townhouse'],
    } satisfies RentalSearch;

    await expect(
      launchRealtorSearch(
        search,
        'https://www.realtor.com/apartments/springfield_MO',
      ),
    ).resolves.toEqual({ automated: true });
    expect(chromeMock.permissionRequest).toHaveBeenCalledWith({
      origins: ['https://www.realtor.com/*'],
    });
    expect(chromeMock.create).toHaveBeenCalledWith({
      url: 'https://www.realtor.com/apartments/springfield_MO',
    });
    expect(chromeMock.executeScript).toHaveBeenLastCalledWith({
      target: { tabId: 71 },
      func: fillRealtorSearchPage,
      args: [search],
    });
  });

  it('explains when Realtor rejects an already-past move-in date', async () => {
    const chromeMock = chromeForRealtor({ granted: true });
    chromeMock.executeScript
      .mockReset()
      .mockResolvedValueOnce([{ result: { ready: true, submitted: false } }])
      .mockResolvedValueOnce([
        { result: { applied: ['location'], failed: ['moveInDate'] } },
      ]);

    await expect(
      launchRealtorSearch(
        { location: 'Springfield, MO', moveInDate: '2000-01-01' },
        'https://www.realtor.com/apartments/Springfield_MO',
      ),
    ).resolves.toEqual({
      automated: false,
      message:
        'Realtor.com applied the available filters, but it does not accept a past move-in date. Choose today or a later date and try again.',
    });
  });

  it('reports only the criteria Realtor can transfer without changing meaning', () => {
    expect(
      realtorAppliedCriteria({
        location: 'Springfield, MO',
        minBathrooms: 1.5,
        minSquareFeet: 600,
        airConditioning: true,
      }),
    ).toEqual(['location', 'minSquareFeet']);
  });
});
