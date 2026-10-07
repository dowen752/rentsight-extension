import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fillHotpadsSearchPage,
  launchHotpadsSearch,
  resolveHotpadsLocationPage,
} from '../src/search';

function installDom(markup: string, url = 'https://hotpads.com/') {
  const dom = new JSDOM(markup, { url, pretendToBeVisual: true });
  for (const name of [
    'document',
    'location',
    'HTMLInputElement',
    'Event',
  ] as const)
    vi.stubGlobal(name, dom.window[name]);
  return dom;
}

afterEach(() => vi.unstubAllGlobals());

describe('HotPads assisted search', () => {
  it('selects HotPads own precise location suggestion and searches', async () => {
    const dom = installDom(`
      <input data-testid="AutocompleteV2Input" />
      <div role="option">Chicago, IL Cook County, IL</div>
      <div role="option">Chicago Heights, IL Cook County, IL</div>
      <button>Search</button>
    `);
    const exact =
      dom.window.document.querySelector<HTMLElement>('[role="option"]')!;
    const selected = vi.fn();
    const searched = vi.fn();
    exact.addEventListener('click', selected);
    dom.window.document
      .querySelector('button')!
      .addEventListener('click', searched);
    expect(await resolveHotpadsLocationPage('Chicago, IL')).toBe(true);
    expect(selected).toHaveBeenCalledOnce();
    expect(searched).toHaveBeenCalledOnce();
    dom.window.close();
  });

  it('applies supported result controls and submits once', async () => {
    const dom = installDom(
      `<input data-testid="AutocompleteV2Input" />
       <button aria-expanded="false">Any rooms</button>
       <div role="dialog" id="rooms">Bedrooms
         <div aria-label="Number of bedrooms">
         <button aria-pressed="false">1</button><button aria-pressed="false">2</button><button aria-pressed="false">3</button><button aria-pressed="false">4+</button>
         </div>
         Bathrooms <div aria-label="Number of bathrooms"><button aria-pressed="false">1+</button><button aria-pressed="false">2+</button><button aria-pressed="false">3+</button><button aria-pressed="false">4+</button></div>
         <button>Done</button>
       </div>
       <button aria-expanded="false">Any price</button>
       <div role="dialog" id="price">Price range
         <input aria-label="Minimum price" /><input aria-label="Maximum price" />
         <button id="price-done">Done</button>
       </div>
       <button data-testid="button-all-filters">Filters</button>
       <div role="dialog" id="filters">Property type Square feet
         <button role="checkbox" aria-checked="false">Apartment</button>
         <button role="checkbox" aria-checked="false">Condo</button>
         <button role="checkbox" aria-checked="false">House</button>
         <button role="checkbox" aria-checked="false">Townhome</button>
         <input aria-label="Minimum square feet" />
         <input type="date" aria-label="Move-in by" />
         <button role="checkbox" aria-checked="false">Cats</button>
         <button role="checkbox" aria-checked="false">Dogs</button>
         <button role="checkbox" aria-checked="false">Parking</button>
         <button role="checkbox" aria-checked="false">In-unit laundry</button>
         <button role="checkbox" aria-checked="false">A/C</button>
         <button id="filter-apply">Apply filters</button>
       </div>`,
      'https://hotpads.com/chicago-il/apartments-for-rent',
    );
    for (const button of dom.window.document.querySelectorAll<HTMLButtonElement>(
      'button',
    ))
      button.addEventListener('click', () => {
        if (button.hasAttribute('aria-pressed'))
          button.setAttribute('aria-pressed', 'true');
        if (button.hasAttribute('aria-checked'))
          button.setAttribute('aria-checked', 'true');
      });
    const submit = vi.fn();
    dom.window.document
      .querySelector('#filter-apply')!
      .addEventListener('click', submit);
    const priceDone = vi.fn();
    dom.window.document
      .querySelector('#price-done')!
      .addEventListener('click', priceDone);

    await expect(
      fillHotpadsSearchPage({
        location: 'Chicago, IL',
        minListedRent: 2500,
        maxListedRent: 7000,
        minBedrooms: 3,
        minBathrooms: 3,
        propertyTypes: ['apartment_condo', 'house'],
        catsAllowed: true,
        smallDogsAllowed: true,
        largeDogsAllowed: true,
        moveInDate: '2026-10-18',
        minSquareFeet: 600,
        parkingAvailable: true,
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
        'propertyTypes',
        'minSquareFeet',
        'moveInDate',
        'catsAllowed',
        'smallDogsAllowed',
        'largeDogsAllowed',
        'parkingAvailable',
        'inUnitLaundry',
        'airConditioning',
      ],
      failed: [],
      submitted: true,
    });
    expect(submit).toHaveBeenCalledOnce();
    expect(priceDone).toHaveBeenCalledOnce();
    expect(
      Array.from(
        dom.window.document.querySelectorAll<HTMLButtonElement>(
          '#rooms [aria-label="Number of bedrooms"] button',
        ),
      )
        .find((button) => button.textContent === '3')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      Array.from(
        dom.window.document.querySelectorAll<HTMLButtonElement>(
          '#rooms [aria-label="Number of bedrooms"] button',
        ),
      )
        .find((button) => button.textContent === '4+')
        ?.getAttribute('aria-pressed'),
    ).toBe('false');
    dom.window.close();
  });

  it('continues from location resolution to page filters', async () => {
    const create = vi.fn().mockResolvedValue({ id: 71 });
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        id: 71,
        status: 'complete',
        url: 'https://hotpads.com/',
      })
      .mockResolvedValue({
        id: 71,
        status: 'complete',
        url: 'https://hotpads.com/chicago-il/apartments-for-rent',
      });
    const executeScript = vi
      .fn()
      .mockResolvedValueOnce([{ result: true }])
      .mockResolvedValueOnce([
        {
          result: {
            applied: ['location', 'catsAllowed'],
            failed: [],
            submitted: true,
          },
        },
      ]);
    vi.stubGlobal('chrome', {
      permissions: { request: vi.fn().mockResolvedValue(true) },
      tabs: { create, get },
      scripting: { executeScript },
    });
    expect(
      await launchHotpadsSearch(
        { location: 'Chicago, IL', catsAllowed: true },
        'https://hotpads.com/',
      ),
    ).toEqual({ automated: true });
    expect(executeScript).toHaveBeenCalledTimes(2);
  });
});
