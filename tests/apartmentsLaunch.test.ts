import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apartmentsAppliedCriteria,
  fillApartmentsSearchPage,
  launchApartmentsSearch,
  type RentalSearch,
} from '../src/search';

function installDom(dom: JSDOM) {
  const { window } = dom;
  for (const [name, value] of [
    ['document', window.document],
    ['window', window],
    ['location', window.location],
    ['Element', window.Element],
    ['HTMLElement', window.HTMLElement],
    ['HTMLInputElement', window.HTMLInputElement],
    ['Event', window.Event],
    ['InputEvent', window.InputEvent],
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

describe('Apartments.com assisted search launch', () => {
  it('fills the results-page controls and applies detailed filters', async () => {
    const dom = new JSDOM(
      `
        <div class="rentRangeSelector">
          <button id="rentRangeLink">Price</button>
          <input id="min-input" placeholder="Min Price" />
          <input id="max-input" placeholder="Max Price" />
          <button class="done-btn">Done</button>
        </div>
        <div class="bedsRangeSelector">
          <button id="bedRangeLink">Beds/Baths</button>
          <button class="bed-filter-button" data-value="1">1+</button>
          <button class="bath-filter-button" data-value="2">2+</button>
          <button class="done-btn">Done</button>
        </div>
        <button id="typeSelect">Home Type</button>
        <button id="PropertyType-1" aria-pressed="false">Apartments</button>
        <button id="PropertyType-2" aria-pressed="false">Houses</button>
        <button id="PropertyType-4" aria-pressed="false">Condos</button>
        <button id="PropertyType-16" aria-pressed="false">Townhomes</button>
        <button id="advancedFiltersIcon">All Filters</button>
        <div class="advancedFilters">
        <button class="bath-filter-button" data-value="2">2+</button>
        <button id="adv-petPolicy-select-button"><span class="ui-selectmenu-text">Select One</span></button>
        <div id="adv-petPolicy-select-menu">
          <li class="ui-menu-item"><div role="option">Dog and Cat Allowed</div></li>
        </div>
        <input class="advancedFilterMoveInDate" readonly />
        <select id="minSF"><option value="">No Min</option><option value="400">400</option><option value="500">500</option></select>
        <button id="minSF-button"><span class="ui-selectmenu-text">No Min</span></button>
        <div id="minSF-menu"><li class="ui-menu-item"><div role="option">400</div></li><li class="ui-menu-item"><div role="option">500</div></li></div>
        <button>Parking</button>
        <button>In Unit Washer & Dryer</button>
        <button>Air Conditioning</button>
        <button id="seeResultBtn">See Results</button>
        </div>
      `,
      {
        url: 'https://www.apartments.com/springfield-mo/?mid=20260924',
      },
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
    dom.window.document
      .querySelector('#adv-petPolicy-select-menu [role="option"]')
      ?.addEventListener('click', () => {
        dom.window.document.querySelector(
          '#adv-petPolicy-select-button .ui-selectmenu-text',
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
        minBathrooms: 2,
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
        'moveInDate',
        'minListedRent',
        'maxListedRent',
        'minBedrooms',
        'propertyTypes',
        'minBathrooms',
        'catsAllowed',
        'smallDogsAllowed',
        'minSquareFeet',
        'parkingAvailable',
        'inUnitLaundry',
        'airConditioning',
      ],
      failed: [],
    });
    expect(
      dom.window.document.querySelector<HTMLInputElement>('#min-input')?.value,
    ).toBe('1000');
    expect(
      dom.window.document.querySelector<HTMLInputElement>('#max-input')?.value,
    ).toBe('6000');
    expect(
      dom.window.document.querySelector<HTMLInputElement>(
        '.advancedFilterMoveInDate',
      )?.value,
    ).toBe('');
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
    expect(seeResults).toHaveBeenCalledOnce();
    dom.window.close();
  });

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
        parkingAvailable: true,
      }),
    ).resolves.toEqual({
      applied: ['location', 'parkingAvailable'],
      failed: ['catsAllowed'],
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
      launchApartmentsSearch(
        search,
        'https://www.apartments.com/springfield/min-1-bedrooms-1000-to-6000/',
      ),
    ).resolves.toEqual({ automated: true });
    expect(chromeMock.permissionRequest).toHaveBeenCalledWith({
      origins: ['https://www.apartments.com/*'],
    });
    expect(chromeMock.create).toHaveBeenCalledWith({
      url: 'https://www.apartments.com/springfield/min-1-bedrooms-1000-to-6000/',
    });
    expect(chromeMock.executeScript).toHaveBeenLastCalledWith({
      target: { tabId: 51 },
      func: fillApartmentsSearchPage,
      args: [search],
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
  });
});
