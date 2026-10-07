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
      'Element',
      'HTMLElement',
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

  it('selects exact room minimum controls and continues through later panels', async () => {
    const dom = new JSDOM(
      `
      <button id="rooms-trigger" aria-controls="rooms-panel">Beds/Baths</button>
      <section id="rooms-panel" hidden>
        <h2>Bedrooms</h2>
        <button aria-label="studio" aria-pressed="false">Studio</button>
        <button aria-label="1 bedroom" aria-pressed="false">1</button>
        <button aria-label="2 bedrooms" aria-pressed="false">2</button>
        <button aria-label="3 bedrooms" aria-pressed="false">3</button>
        <button aria-label="4 bedrooms or more" aria-pressed="false">4+</button>
        <h2>Bathrooms</h2>
        <button aria-label="1 bathroom" aria-pressed="false">1</button>
        <button aria-label="2 bathrooms" aria-pressed="false">2</button>
        <button aria-label="3 bathrooms" aria-pressed="false">3</button>
        <button aria-label="4 bathrooms" aria-pressed="false">4</button>
        <button aria-label="5 bathrooms or more" aria-pressed="false">5+</button>
        <button id="rooms-apply">View 100 results</button>
      </section>
      <button id="price-trigger" aria-controls="price-panel">Price</button>
      <section id="price-panel" hidden>
        <input aria-label="Min price" />
        <input aria-label="Max price" />
        <button id="price-apply">View results</button>
      </section>
      <button id="pets-trigger" aria-controls="pets-panel">Pets</button>
      <section id="pets-panel" hidden>
        <input type="checkbox" aria-label="Dogs allowed" />
        <input type="checkbox" aria-label="Cats allowed" />
        <button id="pets-apply">View 25 results</button>
      </section>
      <button id="more-trigger" aria-controls="more-panel">More</button>
      <section id="more-panel" hidden>
        <input aria-label="minimum square feet" />
        <label><input type="checkbox" />In unit laundry</label>
        <label><input type="checkbox" />A/C</label>
        <label><input type="checkbox" />Garage parking</label>
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
      'Element',
      'HTMLElement',
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
    const rooms =
      dom.window.document.querySelector<HTMLElement>('#rooms-panel')!;
    const price =
      dom.window.document.querySelector<HTMLElement>('#price-panel')!;
    const pets = dom.window.document.querySelector<HTMLElement>('#pets-panel')!;
    const more = dom.window.document.querySelector<HTMLElement>('#more-panel')!;
    const saveSearch =
      dom.window.document.querySelector<HTMLElement>('#save-search')!;
    const closeSaveSearch = vi.fn(() => {
      saveSearch.hidden = true;
    });
    dom.window.document
      .querySelector('button[aria-label="Close save search"]')!
      .addEventListener('click', closeSaveSearch);
    dom.window.document
      .querySelector('#rooms-trigger')!
      .addEventListener('click', () => {
        rooms.hidden = false;
      });
    for (const choice of rooms.querySelectorAll<HTMLButtonElement>(
      'button[aria-label]',
    )) {
      choice.addEventListener('click', () => {
        const label = choice.getAttribute('aria-label') ?? '';
        const group = label.includes('bedroom') ? 'bedroom' : 'bathroom';
        for (const peer of rooms.querySelectorAll<HTMLButtonElement>(
          `button[aria-label*="${group}"]`,
        ))
          peer.setAttribute('aria-pressed', String(peer === choice));
      });
    }
    dom.window.document
      .querySelector('#rooms-apply')!
      .addEventListener('click', () => {
        rooms.hidden = true;
        dom.window.history.pushState({}, '', '?rooms=3');
      });
    dom.window.document
      .querySelector('#price-trigger')!
      .addEventListener('click', () => {
        price.hidden = false;
      });
    dom.window.document
      .querySelector('#price-apply')!
      .addEventListener('click', () => {
        price.hidden = true;
        dom.window.history.pushState({}, '', '?rooms=3&price=2500-7000');
      });
    dom.window.document
      .querySelector('#pets-trigger')!
      .addEventListener('click', () => {
        pets.hidden = false;
      });
    dom.window.document
      .querySelector('#pets-apply')!
      .addEventListener('click', () => {
        pets.hidden = true;
        dom.window.history.pushState(
          {},
          '',
          '?rooms=3&price=2500-7000&pets=true',
        );
      });
    dom.window.document
      .querySelector('#more-trigger')!
      .addEventListener('click', () => {
        dom.window.document.querySelector<HTMLElement>('#more-panel')!.hidden =
          false;
      });
    const attachMoreApply = (panel: HTMLElement) => {
      panel.querySelector('#more-apply')!.addEventListener('click', () => {
        panel.hidden = true;
        dom.window.history.pushState(
          {},
          '',
          '?rooms=3&price=2500-7000&pets=true&amenities=true',
        );
      });
    };
    attachMoreApply(more);
    more
      .querySelector('input[aria-label="minimum square feet"]')!
      .addEventListener('input', () => {
        const replacement = more.cloneNode(true) as HTMLElement;
        replacement.hidden = false;
        attachMoreApply(replacement);
        more.replaceWith(replacement);
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
        minSquareFeet: 537,
        inUnitLaundry: true,
        airConditioning: true,
        parkingAvailable: true,
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
        'minSquareFeet',
        'inUnitLaundry',
        'parkingAvailable',
        'airConditioning',
      ],
      failed: [],
    });
    for (const label of ['3 bedrooms', '3 bathrooms'])
      expect(
        dom.window.document
          .querySelector(`button[aria-label="${label}"]`)
          ?.getAttribute('aria-pressed'),
      ).toBe('true');
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
    for (const label of ['In unit laundry', 'A/C', 'Garage parking'])
      expect(
        Array.from(dom.window.document.querySelectorAll('label'))
          .find((candidate) => candidate.textContent === label)
          ?.querySelector('input')?.checked,
      ).toBe(true);
    expect(closeSaveSearch).toHaveBeenCalledOnce();
    dom.window.close();
  }, 15_000);
});
