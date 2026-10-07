import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fillRealtorSearchPage,
  launchRealtorSearch,
  realtorAppliedCriteria,
  resolveRealtorLocationPage,
  withRealtorPriceRange,
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
    ['KeyboardEvent', window.KeyboardEvent],
  ] as const) {
    vi.stubGlobal(name, value);
  }
}

function chromeForRealtor({ granted }: { granted: boolean }) {
  const permissionRequest = vi.fn().mockResolvedValue(granted);
  const create = vi.fn().mockResolvedValue({ id: 71, status: 'loading' });
  const initialTab = {
    id: 71,
    status: 'complete',
    url: 'https://www.realtor.com/apartments/Springfield_MO',
  };
  const filteredTab = {
    id: 71,
    status: 'complete',
    url: 'https://www.realtor.com/apartments/Springfield_MO/type-townhome/sqft-750/dog-friendly',
  };
  const get = vi
    .fn()
    .mockResolvedValueOnce(initialTab)
    .mockResolvedValueOnce(initialTab)
    .mockResolvedValueOnce(initialTab)
    .mockResolvedValue(filteredTab);
  const update = vi.fn().mockResolvedValue({ id: 71, status: 'loading' });
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
      update,
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    scripting: { executeScript },
  });
  return { permissionRequest, create, update, executeScript };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Realtor.com assisted search launch', () => {
  it('adds or replaces Realtor canonical price routes without losing other filters', () => {
    expect(
      withRealtorPriceRange(
        'https://www.realtor.com/apartments/Palmdale_CA/type-townhome/beds-2/sqft-750/dog-friendly?view=map',
        2_190,
        2_700,
      ),
    ).toBe(
      'https://www.realtor.com/apartments/Palmdale_CA/type-townhome/beds-2/sqft-750/price-2190-2700/dog-friendly?view=map',
    );
    expect(
      withRealtorPriceRange(
        'https://www.realtor.com/apartments/Palmdale_CA/price-na-2500',
        undefined,
        2_700,
      ),
    ).toBe('https://www.realtor.com/apartments/Palmdale_CA/price-na-2700');
  });
  it("selects Realtor.com's first autocomplete match instead of accepting a restored market", async () => {
    const dom = new JSDOM(
      `
        <form>
          <input data-testid="freeTypeInput" role="combobox" />
          <button type="button" aria-label="Search"></button>
        </form>
        <button>Filters</button>
        <div role="listbox">
          <div role="option">Boise, ID</div>
          <div role="option">Boise City, OK</div>
        </div>
      `,
      { url: 'https://www.realtor.com/apartments/Springfield_MO' },
    );
    installDom(dom);
    const submitSearch = vi.fn();
    const suggestions =
      dom.window.document.querySelectorAll<HTMLElement>('[role="option"]');
    const firstClick = vi.fn();
    const secondClick = vi.fn();
    dom.window.document
      .querySelector('button[aria-label="Search"]')
      ?.addEventListener('click', submitSearch);
    suggestions[0].addEventListener('click', firstClick);
    suggestions[1].addEventListener('click', secondClick);

    await expect(resolveRealtorLocationPage('Boise')).resolves.toEqual({
      ready: false,
      submitted: true,
    });
    expect(
      dom.window.document.querySelector<HTMLInputElement>(
        '[data-testid="freeTypeInput"]',
      )?.value,
    ).toBe('Boise');
    expect(firstClick).toHaveBeenCalledOnce();
    expect(secondClick).not.toHaveBeenCalled();
    expect(submitSearch).not.toHaveBeenCalled();
    dom.window.close();
  });

  it('uses an icon-only accessible search button when no autocomplete result appears', async () => {
    vi.useFakeTimers();
    const dom = new JSDOM(
      `
        <form>
          <input data-testid="freeTypeInput" role="combobox" />
          <button type="button" aria-label="Search listings"></button>
        </form>
      `,
      { url: 'https://www.realtor.com/apartments/Springfield_MO' },
    );
    installDom(dom);
    const submitSearch = vi.fn();
    dom.window.document
      .querySelector('button[aria-label="Search listings"]')
      ?.addEventListener('click', submitSearch);

    const resolution = resolveRealtorLocationPage('Boise');
    await vi.advanceTimersByTimeAsync(4_100);

    await expect(resolution).resolves.toEqual({
      ready: false,
      submitted: true,
    });
    expect(submitSearch).toHaveBeenCalledOnce();
    expect(
      dom.window.document.querySelector<HTMLInputElement>(
        '[data-testid="freeTypeInput"]',
      )?.value,
    ).toBe('Boise');
    vi.useRealTimers();
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
        <label data-testid="option-centralAir"><input type="checkbox" /></label>
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
      maxInput.value = committed.max;
    });
    maxInput.addEventListener('input', () => {
      draft.max = maxInput.value;
      minInput.value = committed.min;
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
    const commitPrice = (event: KeyboardEvent, bound: 'min' | 'max') => {
      if (event.key !== 'Enter') return;
      committed[bound] = draft[bound];
      minInput.value = Number(committed.min).toLocaleString('en-US');
      maxInput.value = Number(committed.max).toLocaleString('en-US');
      heading.querySelector('.status')!.textContent =
        committed.min && committed.max
          ? '$1K - $6K'
          : committed.min
            ? 'Min $1K'
            : 'Max $6K';
    };
    minInput.addEventListener('keydown', (event) => commitPrice(event, 'min'));
    maxInput.addEventListener('keydown', (event) => commitPrice(event, 'max'));
    document
      .querySelector('#propertyType-townhome')
      ?.addEventListener('click', () => {
        // Realtor's shared drawer state may restore its previous price
        // snapshot when a later filter causes the controls to re-render.
        committed.min = '';
        committed.max = '';
        minInput.value = '';
        maxInput.value = '';
        heading.querySelector('.status')!.textContent = '';
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
    const submittedPrice = { min: '', max: '' };
    const submit = vi.fn(() => {
      submittedPrice.min = committed.min;
      submittedPrice.max = committed.max;
    });
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
        airConditioning: true,
      }),
    ).resolves.toEqual({
      applied: [
        'location',
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
        'airConditioning',
        'maxListedRent',
        'minListedRent',
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
    ).toBe('6,000');
    expect(heading.querySelector('.status')?.textContent).toBe('$1K - $6K');
    expect(submittedPrice).toEqual({ min: '1000', max: '6000' });
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

  it('waits for the requested market DOM before opening filters', async () => {
    const dom = new JSDOM(
      `
        <h1>Apartments and homes for rent in Springfield, MO</h1>
        <button id="stale-filters">Filters</button>
      `,
      { url: 'https://www.realtor.com/apartments/Boise_ID' },
    );
    installDom(dom);
    const staleClick = vi.fn();
    const freshClick = vi.fn();
    const submit = vi.fn();
    dom.window.document
      .querySelector('#stale-filters')
      ?.addEventListener('click', staleClick);
    setTimeout(() => {
      dom.window.document.querySelector('h1')!.textContent =
        'Apartments and homes for rent in Boise, ID';
      dom.window.document.querySelector('#stale-filters')?.remove();
      const filters = dom.window.document.createElement('button');
      filters.textContent = 'Filters';
      filters.addEventListener('click', freshClick);
      const results = dom.window.document.createElement('button');
      results.dataset.testid = 'view-more-filters-results';
      results.textContent = 'View homes';
      results.addEventListener('click', submit);
      dom.window.document.body.append(filters, results);
    }, 50);

    await expect(fillRealtorSearchPage({ location: 'Boise' })).resolves.toEqual(
      { applied: ['location'], failed: [] },
    );
    expect(staleClick).not.toHaveBeenCalled();
    expect(freshClick).toHaveBeenCalledOnce();
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
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      setTimeout(() => {
        input.value = Number(draft).toLocaleString('en-US');
        heading.querySelector('.status')!.textContent = 'Max $6K';
      }, 250);
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

  it('commits both arbitrary bounds across Realtor controlled-input rerenders', async () => {
    const dom = new JSDOM(
      `
        <button>Filters</button>
        <div data-testid="accordion-price" aria-expanded="true">Price <span class="status"></span></div>
        <div class="input-dropdown"><input id="min-price-dropdown" /></div>
        <div class="input-dropdown"><input id="max-price-dropdown" /></div>
        <button data-testid="view-more-filters-results">View homes</button>
      `,
      { url: 'https://www.realtor.com/apartments/Arlington_TX' },
    );
    installDom(dom);
    const { document } = dom.window;
    const heading = document.querySelector<HTMLElement>(
      '[data-testid="accordion-price"]',
    )!;
    const inputs = {
      min: document.querySelector<HTMLInputElement>('#min-price-dropdown')!,
      max: document.querySelector<HTMLInputElement>('#max-price-dropdown')!,
    };
    const draft = { min: '', max: '' };
    const committed = { min: '', max: '' };
    const render = () => {
      inputs.min.value = committed.min
        ? Number(committed.min).toLocaleString('en-US')
        : '';
      inputs.max.value = committed.max
        ? Number(committed.max).toLocaleString('en-US')
        : '';
      heading.querySelector('.status')!.textContent =
        committed.min && committed.max
          ? `$${Number(committed.min).toLocaleString('en-US')} - $${Number(committed.max).toLocaleString('en-US')}`
          : committed.min
            ? `Min $${Number(committed.min).toLocaleString('en-US')}`
            : committed.max
              ? `Max $${Number(committed.max).toLocaleString('en-US')}`
              : '';
    };
    for (const bound of ['min', 'max'] as const) {
      inputs[bound].addEventListener('input', () => {
        draft[bound] = inputs[bound].value;
        const other = bound === 'min' ? 'max' : 'min';
        inputs[other].value = committed[other];
      });
      inputs[bound].addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        committed[bound] = draft[bound];
        render();
      });
    }

    await expect(
      fillRealtorSearchPage({
        location: 'Arlington',
        minListedRent: 2_190,
        maxListedRent: 2_700,
      }),
    ).resolves.toEqual({
      applied: ['location', 'maxListedRent', 'minListedRent'],
      failed: [],
    });
    expect(inputs.min.value).toBe('2,190');
    expect(inputs.max.value).toBe('2,700');
    expect(heading.querySelector('.status')?.textContent).toBe(
      '$2,190 - $2,700',
    );
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
      url: 'https://www.realtor.com/rentals',
    });
    expect(chromeMock.executeScript).toHaveBeenLastCalledWith({
      target: { tabId: 71 },
      func: fillRealtorSearchPage,
      args: [search],
    });
    expect(chromeMock.update).toHaveBeenCalledWith(71, {
      url: 'https://www.realtor.com/apartments/Springfield_MO/type-townhome/sqft-750/price-1000-6000/dog-friendly',
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

  it('reports the criteria Realtor can transfer to its filter controls', () => {
    expect(
      realtorAppliedCriteria({
        location: 'Springfield, MO',
        minBathrooms: 1.5,
        minSquareFeet: 600,
        airConditioning: true,
      }),
    ).toEqual(['location', 'minSquareFeet', 'airConditioning']);
  });
});
