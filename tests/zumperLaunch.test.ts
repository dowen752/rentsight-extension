import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fillZumperSearchPage, resolveZumperLocationPage } from '../src/search';

afterEach(() => vi.unstubAllGlobals());

describe('Zumper assisted search', () => {
  it('uses Zumper autocomplete and picks the precise place', async () => {
    const dom = new JSDOM(
      `
      <input role="combobox" aria-label="Search by location or property name" />
      <div role="option">Springfield, MO</div>
      <div role="option">Springfield, IL</div>
    `,
      { url: 'https://www.zumper.com/' },
    );
    for (const name of [
      'document',
      'location',
      'HTMLInputElement',
      'Event',
    ] as const)
      vi.stubGlobal(name, dom.window[name]);
    const selected = vi.fn();
    dom.window.document
      .querySelector('[role="option"]')!
      .addEventListener('click', selected);
    expect(await resolveZumperLocationPage('Springfield, MO')).toBe(true);
    expect(selected).toHaveBeenCalledOnce();
    dom.window.close();
  });

  it('continues from place resolution into staged page filtering', async () => {
    const create = vi.fn().mockResolvedValue({ id: 91 });
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        id: 91,
        status: 'complete',
        url: 'https://www.zumper.com/',
      })
      .mockResolvedValue({
        id: 91,
        status: 'complete',
        url: 'https://www.zumper.com/apartments-for-rent/springfield-mo',
      });
    const executeScript = vi
      .fn()
      .mockResolvedValueOnce([{ result: true }])
      .mockResolvedValueOnce([
        { result: { applied: ['location', 'catsAllowed'], failed: [] } },
      ]);
    vi.stubGlobal('chrome', {
      permissions: { request: vi.fn().mockResolvedValue(true) },
      tabs: { create, get },
      scripting: { executeScript },
    });
    const { launchZumperSearch } = await import('../src/search');
    await expect(
      launchZumperSearch(
        { location: 'Springfield, MO', catsAllowed: true },
        'https://www.zumper.com/',
      ),
    ).resolves.toEqual({ automated: true });
    expect(executeScript).toHaveBeenCalledTimes(2);
  });

  it('selects inclusive room minimums and continues through later panels', async () => {
    const dom = new JSDOM(
      `
      <button id="rooms-trigger" aria-controls="rooms-panel">Beds/Baths</button>
      <section id="rooms-panel" hidden>
        <h2>Bedrooms</h2>
        <input type="checkbox" aria-label="studio" />
        <input type="checkbox" aria-label="1 bedroom" />
        <input type="checkbox" aria-label="2 bedrooms" />
        <input type="checkbox" aria-label="3 bedrooms" />
        <input type="checkbox" aria-label="4 bedrooms or more" />
        <h2>Bathrooms</h2>
        <input type="checkbox" aria-label="1 bathroom" />
        <input type="checkbox" aria-label="2 bathrooms" />
        <input type="checkbox" aria-label="3 bathrooms" />
        <input type="checkbox" aria-label="4 bathrooms" />
        <input type="checkbox" aria-label="5 bathrooms or more" />
        <button id="rooms-apply">View 100 results</button>
      </section>
      <button id="price-trigger" aria-controls="price-panel">Price</button>
      <section id="price-panel" hidden>
        <input aria-label="Min price" />
        <input aria-label="Max price" />
        <button id="price-apply">View 50 results</button>
      </section>
      <button id="pets-trigger" aria-controls="pets-panel">Pets</button>
      <section id="pets-panel" hidden>
        <input type="checkbox" aria-label="Dogs allowed" />
        <input type="checkbox" aria-label="Cats allowed" />
        <button id="pets-apply">View 25 results</button>
      </section>
      <button id="more-trigger" aria-controls="more-panel">More</button>
      <section id="more-panel" hidden>
        <label><input type="checkbox" />In unit laundry</label>
        <label><input type="checkbox" />A/C</label>
        <button id="more-apply">View 10 results</button>
      </section>
      <section id="save-search" role="dialog">
        <h2>Save Search</h2>
        <p>Save your search to save time.</p>
        <input placeholder="Email" />
        <button aria-label="Close save search">×</button>
        <button>Save Search</button>
      </section>
    `,
      { url: 'https://www.zumper.com/apartments-for-rent/chicago-il' },
    );
    for (const name of [
      'document',
      'location',
      'HTMLInputElement',
      'Event',
    ] as const)
      vi.stubGlobal(name, dom.window[name]);
    Object.defineProperty(dom.window.Element.prototype, 'getClientRects', {
      configurable: true,
      value() {
        return this.closest('[hidden]') ? [] : [{ width: 1, height: 1 }];
      },
    });
    const rooms = dom.window.document.querySelector<HTMLElement>('#rooms-panel')!;
    const price = dom.window.document.querySelector<HTMLElement>('#price-panel')!;
    const pets = dom.window.document.querySelector<HTMLElement>('#pets-panel')!;
    const more = dom.window.document.querySelector<HTMLElement>('#more-panel')!;
    const saveSearch = dom.window.document.querySelector<HTMLElement>('#save-search')!;
    const closeSaveSearch = vi.fn(() => {
      saveSearch.hidden = true;
    });
    dom.window.document
      .querySelector('button[aria-label="Close save search"]')!
      .addEventListener('click', closeSaveSearch);
    dom.window.document.querySelector('#rooms-trigger')!.addEventListener('click', () => {
      rooms.hidden = false;
    });
    dom.window.document.querySelector('#rooms-apply')!.addEventListener('click', () => {
      rooms.hidden = true;
      dom.window.history.pushState({}, '', '?rooms=3');
    });
    dom.window.document.querySelector('#price-trigger')!.addEventListener('click', () => {
      price.hidden = false;
    });
    dom.window.document.querySelector('#price-apply')!.addEventListener('click', () => {
      price.hidden = true;
      dom.window.history.pushState({}, '', '?rooms=3&price=2500-7000');
    });
    dom.window.document.querySelector('#pets-trigger')!.addEventListener('click', () => {
      pets.hidden = false;
    });
    dom.window.document.querySelector('#pets-apply')!.addEventListener('click', () => {
      pets.hidden = true;
      dom.window.history.pushState({}, '', '?rooms=3&price=2500-7000&pets=true');
    });
    dom.window.document.querySelector('#more-trigger')!.addEventListener('click', () => {
      more.hidden = false;
    });
    dom.window.document.querySelector('#more-apply')!.addEventListener('click', () => {
      more.hidden = true;
      dom.window.history.pushState({}, '', '?rooms=3&price=2500-7000&pets=true&amenities=true');
    });

    await expect(
      fillZumperSearchPage({
        location: 'Chicago, IL',
        minBedrooms: 3,
        minBathrooms: 3,
        minListedRent: 2500,
        maxListedRent: 7000,
        catsAllowed: true,
        smallDogsAllowed: true,
        inUnitLaundry: true,
        airConditioning: true,
      }),
    ).resolves.toEqual({
      applied: [
        'location',
        'minBedrooms',
        'minBathrooms',
        'minListedRent',
        'maxListedRent',
        'catsAllowed',
        'smallDogsAllowed',
        'inUnitLaundry',
        'airConditioning',
      ],
      failed: [],
    });
    for (const label of [
      '3 bedrooms',
      '4 bedrooms or more',
      '3 bathrooms',
      '4 bathrooms',
      '5 bathrooms or more',
    ])
      expect(
        dom.window.document.querySelector<HTMLInputElement>(
          `input[aria-label="${label}"]`,
        )?.checked,
      ).toBe(true);
    expect(
      dom.window.document.querySelector<HTMLInputElement>(
        'input[aria-label="Min price"]',
      )?.value,
    ).toBe('2500');
    expect(
      dom.window.document.querySelector<HTMLInputElement>(
        'input[aria-label="Max price"]',
      )?.value,
    ).toBe('7000');
    for (const label of ['Dogs allowed', 'Cats allowed'])
      expect(
        dom.window.document.querySelector<HTMLInputElement>(
          `input[aria-label="${label}"]`,
        )?.checked,
      ).toBe(true);
    for (const label of ['In unit laundry', 'A/C'])
      expect(
        Array.from(dom.window.document.querySelectorAll('label')).find(
          (candidate) => candidate.textContent === label,
        )?.querySelector('input')?.checked,
      ).toBe(true);
    expect(closeSaveSearch).toHaveBeenCalledOnce();
    dom.window.close();
  }, 15_000);
});
