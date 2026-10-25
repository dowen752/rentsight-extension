import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apartmentsAppliedCriteria,
  fillApartmentsSearchPage,
  launchApartmentsSearch,
  resolveApartmentsLocationPage,
  type RentalSearch,
} from '../src/search';

function installDom(dom: JSDOM) {
  const { window } = dom;
  Object.defineProperty(window.Element.prototype, 'getClientRects', {
    configurable: true,
    value: function (this: Element) {
      return {
        length: this.closest('[hidden], [style*="display: none"]') ? 0 : 1,
      };
    },
  });
  for (const [name, value] of [
    ['document', window.document],
    ['window', window],
    ['location', window.location],
    ['Element', window.Element],
    ['HTMLElement', window.HTMLElement],
    ['HTMLInputElement', window.HTMLInputElement],
    ['Event', window.Event],
    ['InputEvent', window.InputEvent],
    ['KeyboardEvent', window.KeyboardEvent],
    ['MouseEvent', window.MouseEvent],
  ] as const) {
    vi.stubGlobal(name, value);
  }
}

function chromeForApartments({ granted }: { granted: boolean }) {
  const permissionRequest = vi.fn().mockResolvedValue(granted);
  const create = vi.fn().mockResolvedValue({ id: 51, status: 'loading' });
  const get = vi.fn().mockResolvedValue({ id: 51, status: 'complete' });
  const executeScript = vi
    .fn()
    .mockResolvedValueOnce([{ result: { ready: true } }])
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

describe('Apartments.com assisted search launch', () => {
  it('submits the raw location through Apartments.com smart search', async () => {
    const dom = new JSDOM(
      `
        <div id="homepage-smart-search">
          <div class="smart-search-input" contenteditable="plaintext-only"></div>
          <button class="smart-search-btn-search">Search</button>
        </div>
      `,
      { url: 'https://www.apartments.com/' },
    );
    installDom(dom);
    const searchButton = dom.window.document.querySelector<HTMLButtonElement>(
      '.smart-search-btn-search',
    )!;
    const keydown = vi.fn();
    const click = vi.fn();
    dom.window.document
      .querySelector('.smart-search-input')
      ?.addEventListener('keydown', keydown);
    searchButton.addEventListener('click', click);

    await expect(resolveApartmentsLocationPage('Albany')).resolves.toEqual({
      ready: false,
      submitted: true,
    });
    expect(
      dom.window.document.querySelector('.smart-search-input')?.textContent,
    ).toBe('Albany');
    expect(keydown).toHaveBeenCalledOnce();
    expect(keydown.mock.calls[0][0]).toMatchObject({
      key: 'Enter',
      code: 'Enter',
    });
    expect(click).toHaveBeenCalledOnce();
    dom.window.close();
  });

  it('recognizes an Apartments.com results page as ready', async () => {
    const dom = new JSDOM(
      '<button id="advancedFiltersIcon">All Filters</button>',
      { url: 'https://www.apartments.com/albany-ny/' },
    );
    installDom(dom);

    await expect(resolveApartmentsLocationPage('Albany')).resolves.toEqual({
      ready: true,
      submitted: false,
    });
    dom.window.close();
  });

  it('fills the results-page controls and applies detailed filters', async () => {
    const dom = new JSDOM(
      `
        <button id="advancedFiltersIcon">All Filters</button>
        <div class="advancedFilters">
        <input class="min-rent-select" placeholder="Min Price" />
        <input class="max-rent-select" placeholder="Max Price" />
        <div class="bed-filter-container">
          <button class="bed-filter-button" data-value="1">1+</button>
        </div>
        <div class="bath-filter-container">
          <label class="bath-filter-button" data-value="2"><input type="checkbox" />3+</label>
        </div>
        <div class="home-type-filter">
          <button id="PropertyType-1" data-value="1" aria-pressed="false">Apartments</button>
          <button id="PropertyType-2" data-value="2" aria-pressed="false">Houses</button>
          <button id="PropertyType-4" data-value="4" aria-pressed="false">Condos</button>
          <button id="PropertyType-16" data-value="16" aria-pressed="false">Townhomes</button>
        </div>
        <button class="petPolicy-select" aria-controls="v-2-listbox"><span class="dropdown-select-text">Select One</span></button>
        <div id="v-2-listbox">
          <li role="option" data-value="3"><div class="dropdown-select-item">Dog and Cat Allowed</div></li>
        </div>
        <input class="advancedFilterMoveInDate" readonly />
        <div class="datepicker-days">
          <button class="prev">Previous</button>
          <span class="datepicker-switch">AUGUST 2026</span>
          <button class="next">Next</button>
          <table><tbody><tr>
            <td class="old day" data-date="${new Date(2026, 7, 24).getTime()}">24</td>
            <td class="day" data-date="${new Date(2026, 8, 24).getTime()}">24</td>
          </tr></tbody></table>
        </div>
        <select id="minSF"><option value="">No Min</option><option value="400">400</option><option value="500">500</option></select>
        <button id="minSF-button"><span class="ui-selectmenu-text">No Min</span></button>
        <div id="minSF-menu"><li class="ui-menu-item"><div role="option">400</div></li><li class="ui-menu-item"><div role="option">500</div></li></div>
        <button>Parking</button>
        <button>In Unit Washer & Dryer</button>
        <button>Air Conditioning</button>
        <button id="seeResultBtn">See Results</button>
        </div>
      `,
      { url: 'https://www.apartments.com/springfield-mo/' },
    );
    installDom(dom);
    for (const button of dom.window.document.querySelectorAll('button')) {
      button.addEventListener('click', () => {
        if (button.matches('.bed-filter-button,.bath-filter-button'))
          button.classList.add('highlighted');
        if (button.id.startsWith('PropertyType-'))
          button.setAttribute(
            'aria-pressed',
            button.getAttribute('aria-pressed') === 'true' ? 'false' : 'true',
          );
        if (
          ['Parking', 'In Unit Washer & Dryer', 'Air Conditioning'].includes(
            button.textContent ?? '',
          )
        )
          button.setAttribute('aria-pressed', 'true');
      });
    }
    const nextMonth = vi.fn(() => {
      dom.window.document.querySelector(
        '.datepicker-days .datepicker-switch',
      )!.textContent = 'SEPTEMBER 2026';
    });
    dom.window.document
      .querySelector('.datepicker-days .next')
      ?.addEventListener('click', nextMonth);
    const adjacentDate = vi.fn();
    dom.window.document
      .querySelector('.datepicker-days td.old')
      ?.addEventListener('click', adjacentDate);
    dom.window.document
      .querySelector('.datepicker-days td.day:not(.old)')
      ?.addEventListener('click', () => {
        dom.window.document.querySelector<HTMLInputElement>(
          '.advancedFilterMoveInDate',
        )!.value = '9/24/2026';
      });
    dom.window.document
      .querySelector('#v-2-listbox .dropdown-select-item')
      ?.addEventListener('click', () => {
        dom.window.document.querySelector(
          '.petPolicy-select .dropdown-select-text',
        )!.textContent = 'Dog and Cat Allowed';
      });
    for (const option of dom.window.document.querySelectorAll(
      '#minSF-menu [role="option"]',
    )) {
      option.addEventListener('click', () => {
        dom.window.document.querySelector(
          '#minSF-button .ui-selectmenu-text',
        )!.textContent = option.textContent;
      });
    }
    const seeResults = vi.fn();
    dom.window.document
      .querySelector('#seeResultBtn')
      ?.addEventListener('click', seeResults);

    await expect(
      fillApartmentsSearchPage({
        location: 'Springfield, MO',
        minListedRent: 1_000,
        maxListedRent: 6_000,
        minBedrooms: 1,
        minBathrooms: 3,
        propertyTypes: ['apartment_condo', 'townhouse'],
        catsAllowed: true,
        smallDogsAllowed: true,
        moveInDate: '2026-09-24',
        minSquareFeet: 450,
        parkingAvailable: true,
        inUnitLaundry: true,
        airConditioning: true,
      }),
    ).resolves.toEqual({
      applied: [
        'location',
        'minListedRent',
        'maxListedRent',
        'minBedrooms',
        'propertyTypes',
        'minBathrooms',
        'catsAllowed',
        'smallDogsAllowed',
        'moveInDate',
        'minSquareFeet',
        'parkingAvailable',
        'inUnitLaundry',
        'airConditioning',
      ],
      failed: [],
    });
    expect(
      dom.window.document.querySelector<HTMLInputElement>('.min-rent-select')
        ?.value,
    ).toBe('1000');
    expect(
      dom.window.document.querySelector<HTMLInputElement>('.max-rent-select')
        ?.value,
    ).toBe('6000');
    expect(
      dom.window.document.querySelector<HTMLInputElement>(
        '.advancedFilterMoveInDate',
      )?.value,
    ).toBe('9/24/2026');
    expect(
      dom.window.document.querySelector<HTMLInputElement>(
        '.bath-filter-button input',
      )?.checked,
    ).toBe(true);
    expect(nextMonth).toHaveBeenCalledOnce();
    expect(adjacentDate).not.toHaveBeenCalled();
    expect(
      dom.window.document
        .querySelector('#PropertyType-1')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      dom.window.document
        .querySelector('#PropertyType-4')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      dom.window.document
        .querySelector('#PropertyType-16')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      dom.window.document.querySelector('#minSF-button .ui-selectmenu-text')
        ?.textContent,
    ).toBe('500');
    expect(
      dom.window.document.querySelector(
        '.petPolicy-select .dropdown-select-text',
      )?.textContent,
    ).toBe('Dog and Cat Allowed');
    expect(seeResults).toHaveBeenCalledOnce();
    dom.window.close();
  });

  it('selects Dog Friendly for a household with only a large dog', async () => {
    const dom = new JSDOM(
      `
        <button id="advancedFiltersIcon">All Filters</button>
        <div class="advancedFilters">
          <button class="petPolicy-select" aria-controls="v-3-listbox"><span class="dropdown-select-text">Select One</span></button>
          <button id="seeResultBtn">See Results</button>
        </div>
        <ul id="v-3-listbox">
          <li role="option" data-value="1"><div class="dropdown-select-item">Dog Friendly</div></li>
        </ul>
      `,
      { url: 'https://www.apartments.com/albany-ny/' },
    );
    installDom(dom);
    const petItem = dom.window.document.querySelector<HTMLElement>(
      '#v-3-listbox .dropdown-select-item',
    )!;
    const selected = vi.fn(() => {
      dom.window.document.querySelector(
        '.petPolicy-select .dropdown-select-text',
      )!.textContent = 'Dog Friendly';
    });
    petItem.addEventListener('click', selected);

    await expect(
      fillApartmentsSearchPage({
        location: 'Albany',
        largeDogsAllowed: true,
      }),
    ).resolves.toEqual({
      applied: ['location', 'largeDogsAllowed'],
      failed: [],
    });
    expect(selected).toHaveBeenCalledOnce();
    expect(
      dom.window.document.querySelector(
        '.petPolicy-select .dropdown-select-text',
      )?.textContent,
    ).toBe('Dog Friendly');
    dom.window.close();
  });

  it.each(['selectable', 'disabled', 'aria-disabled', 'reset'])(
    'uses the move-in calendar and verifies a %s date without shifting calendar days',
    async (state) => {
      const dom = new JSDOM(
        `
        <button id="advancedFiltersIcon">All Filters</button>
        <div class="datepicker-days" hidden>
          <span class="datepicker-switch">JANUARY 2000</span>
          <table><tbody><tr><td class="day" data-date="0">24</td></tr></tbody></table>
        </div>
        <div class="advancedFilters">
          <div id="advancedFilterMoveInDateContainer">
            <input class="advancedFilterMoveInDate" readonly />
            <div class="datepicker-days" hidden>
              <span class="datepicker-switch">SEPTEMBER 2026</span>
              <button class="next">Next</button>
              <table><tbody><tr>
                <td class="old day">24</td>
                <td class="day ${state === 'disabled' ? 'disabled' : ''}"
                  ${state === 'aria-disabled' ? 'aria-disabled="true"' : ''}
                  data-date="${Date.UTC(2026, 9, 24)}">24</td>
                <td class="new day">24</td>
              </tr></tbody></table>
            </div>
          </div>
          <button aria-pressed="false">Parking</button>
          <button id="seeResultBtn">See Results</button>
        </div>
      `,
        { url: 'https://www.apartments.com/cupertino-ca/' },
      );
      installDom(dom);
      const { document } = dom.window;
      const input = document.querySelector<HTMLInputElement>(
        '.advancedFilterMoveInDate',
      )!;
      const calendar = document.querySelector<HTMLElement>(
        '#advancedFilterMoveInDateContainer .datepicker-days',
      )!;
      input.addEventListener('mousedown', () => {
        calendar.hidden = false;
      });
      const nextMonth = vi.fn(() => {
        calendar.querySelector('.datepicker-switch')!.textContent =
          'OCTOBER 2026';
      });
      calendar.querySelector('.next')!.addEventListener('click', nextMonth);
      const wrongCalendar = vi.fn();
      document
        .querySelector('.datepicker-days[hidden] td')!
        .addEventListener('click', wrongCalendar);
      const adjacentDate = vi.fn();
      for (const cell of calendar.querySelectorAll('.old,.new'))
        cell.addEventListener('click', adjacentDate);
      const selected = vi.fn(() => {
        input.value = '10/24/2026';
      });
      calendar
        .querySelector('td:not(.old):not(.new)')!
        .addEventListener('click', selected);
      const parking = document.querySelector<HTMLButtonElement>(
        'button[aria-pressed]',
      )!;
      parking.addEventListener('click', () => {
        parking.setAttribute('aria-pressed', 'true');
        if (state === 'reset') input.value = '';
      });
      const submitted = vi.fn();
      document
        .querySelector('#seeResultBtn')!
        .addEventListener('click', submitted);

      const result = await fillApartmentsSearchPage({
        moveInDate: '2026-10-24',
        parkingAvailable: true,
      });
      expect(result).toEqual({
        applied:
          state === 'selectable'
            ? ['moveInDate', 'parkingAvailable']
            : ['parkingAvailable'],
        failed: state === 'selectable' ? [] : ['moveInDate'],
      });
      expect(input.value).toBe(state === 'selectable' ? '10/24/2026' : '');
      expect(selected).toHaveBeenCalledTimes(
        state === 'selectable' || state === 'reset' ? 1 : 0,
      );
      expect(nextMonth).toHaveBeenCalledOnce();
      expect(wrongCalendar).not.toHaveBeenCalled();
      expect(adjacentDate).not.toHaveBeenCalled();
      expect(submitted).toHaveBeenCalledOnce();
      dom.window.close();
    },
  );

  it.each([
    ['2000-01-01', 'your move-in date is in the past'],
    ['2099-12-01', 'could not apply your move-in date'],
  ])(
    'explains an unapplied Apartments.com date (%s)',
    async (moveInDate, message) => {
      const chromeMock = chromeForApartments({ granted: true });
      chromeMock.executeScript
        .mockReset()
        .mockResolvedValueOnce([{ result: { ready: true } }])
        .mockResolvedValueOnce([
          { result: { applied: ['location'], failed: ['moveInDate'] } },
        ]);
      const search = { location: 'Cupertino, CA', moveInDate };
      const outcome = await launchApartmentsSearch(
        search,
        'https://www.apartments.com/cupertino-ca/',
      );
      expect(outcome.automated).toBe(false);
      expect(outcome.message).toContain(message);
      expect(search.moveInDate).toBe(moveInDate);
    },
  );

  it('submits the detailed search even when one optional widget is unavailable', async () => {
    const dom = new JSDOM(
      `
        <button id="advancedFiltersIcon">All Filters</button>
        <div class="advancedFilters">
          <button id="seeResultBtn">See Results</button>
          <button aria-pressed="false">Parking</button>
        </div>
      `,
      { url: 'https://www.apartments.com/springfield-mo/' },
    );
    installDom(dom);
    const parking = dom.window.document.querySelector<HTMLButtonElement>(
      'button[aria-pressed]',
    )!;
    parking.addEventListener('click', () =>
      parking.setAttribute('aria-pressed', 'true'),
    );
    const seeResults = vi.fn();
    dom.window.document
      .querySelector('#seeResultBtn')
      ?.addEventListener('click', seeResults);

    await expect(
      fillApartmentsSearchPage({
        location: 'Springfield, MO',
        catsAllowed: true,
        moveInDate: '2026-09-24',
        parkingAvailable: true,
      }),
    ).resolves.toEqual({
      applied: ['location', 'parkingAvailable'],
      failed: ['catsAllowed', 'moveInDate'],
    });
    expect(seeResults).toHaveBeenCalledOnce();
    dom.window.close();
  });

  it('opens a clean page and requests only Apartments.com access', async () => {
    const chromeMock = chromeForApartments({ granted: true });
    const search = {
      location: 'Springfield, MO',
      minListedRent: 1_000,
      maxListedRent: 6_000,
      minBedrooms: 1,
      minBathrooms: 2,
      propertyTypes: ['townhouse'],
    } satisfies RentalSearch;

    await expect(
      launchApartmentsSearch(search, 'https://www.apartments.com/'),
    ).resolves.toEqual({ automated: true });
    expect(chromeMock.permissionRequest).toHaveBeenCalledWith({
      origins: ['https://www.apartments.com/*'],
    });
    expect(chromeMock.create).toHaveBeenCalledWith({
      url: 'https://www.apartments.com/',
    });
    expect(chromeMock.executeScript).toHaveBeenLastCalledWith({
      target: { tabId: 51 },
      func: fillApartmentsSearchPage,
      args: [search],
    });
  });

  it('passes a city-only search to Apartments.com unchanged', async () => {
    const chromeMock = chromeForApartments({ granted: true });
    await expect(
      launchApartmentsSearch(
        { location: 'Albany', maxListedRent: 3_000 },
        'https://www.apartments.com/',
      ),
    ).resolves.toEqual({ automated: true });
    expect(chromeMock.create).toHaveBeenCalledWith({
      url: 'https://www.apartments.com/',
    });
    expect(chromeMock.executeScript).toHaveBeenNthCalledWith(1, {
      target: { tabId: 51 },
      func: resolveApartmentsLocationPage,
      args: ['Albany'],
    });
  });

  it('passes an unfamiliar location to Apartments.com instead of rejecting it', async () => {
    const chromeMock = chromeForApartments({ granted: true });
    await expect(
      launchApartmentsSearch(
        { location: 'Atlantisville', maxListedRent: 3_000 },
        'https://www.apartments.com/',
      ),
    ).resolves.toEqual({ automated: true });
    expect(chromeMock.create).toHaveBeenCalledWith({
      url: 'https://www.apartments.com/',
    });
    expect(chromeMock.permissionRequest).toHaveBeenCalled();
    expect(chromeMock.executeScript).toHaveBeenNthCalledWith(1, {
      target: { tabId: 51 },
      func: resolveApartmentsLocationPage,
      args: ['Atlantisville'],
    });
  });

  it('supports combined property types on the results page', () => {
    expect(
      apartmentsAppliedCriteria({
        location: 'Seattle, WA',
        propertyTypes: ['apartment_condo', 'townhouse'],
        catsAllowed: true,
        smallDogsAllowed: true,
        moveInDate: '2026-09-24',
        minSquareFeet: 200,
      }),
    ).toEqual([
      'location',
      'propertyTypes',
      'catsAllowed',
      'smallDogsAllowed',
      'moveInDate',
      'minSquareFeet',
    ]);
    expect(
      apartmentsAppliedCriteria({
        location: 'Seattle, WA',
        minSquareFeet: 5_000,
      }),
    ).toEqual(['location']);
    expect(
      apartmentsAppliedCriteria({
        location: 'Seattle',
        maxListedRent: 2_500,
      }),
    ).toEqual(['location', 'maxListedRent']);
  });
});
