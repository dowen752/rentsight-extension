import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fillRentSearchPage,
  launchRentSearch,
  resolveRentLocationPage,
} from '../src/search';

function installDom(markup: string, url: string) {
  const dom = new JSDOM(markup, { url, pretendToBeVisual: true });
  for (const name of [
    'document',
    'location',
    'HTMLInputElement',
    'Event',
    'InputEvent',
  ] as const)
    vi.stubGlobal(name, dom.window[name]);
  return dom;
}
afterEach(() => vi.unstubAllGlobals());

describe('Rent.com assisted search', () => {
  it('uses its exact place suggestion, not a similarly named filter', async () => {
    const dom = installDom(
      `
      <input data-tid="search-input-field" role="combobox" value="Chicago, IL" />
      <ul role="listbox"><li role="option">Springfield, MO</li><li role="option">1 bed apartments in Springfield, MO</li></ul>
    `,
      'https://www.rent.com/',
    );
    const input = dom.window.document.querySelector('input')!;
    vi.spyOn(input, 'getClientRects').mockReturnValue({
      length: 1,
    } as DOMRectList);
    const options =
      dom.window.document.querySelectorAll<HTMLElement>('[role="option"]');
    for (const option of options)
      vi.spyOn(option, 'getClientRects').mockReturnValue({
        length: 1,
      } as DOMRectList);
    const selected = vi.fn();
    options[0].addEventListener('click', selected);
    expect(await resolveRentLocationPage('Springfield, MO')).toBe(true);
    expect(input.value).toBe('Springfield, MO');
    expect(selected).toHaveBeenCalledOnce();
    dom.window.close();
  });

  it('applies a minimum range, mapped controls and rounded-up square feet before submitting', async () => {
    const dom = installDom(
      `
      <input data-tid="search-input-field" /> <button>Filters</button>
      <dialog id="all-filters-modal"><input data-tid="min-price-input" />
      <input type="checkbox" value="1-bedroom" /><input type="checkbox" value="2-bedroom" /><input type="checkbox" value="3-bedroom" /><input type="checkbox" value="4-bedroom" />
      <input type="checkbox" value="apartments" /><input type="checkbox" value="condos" />
      <input type="checkbox" value="cat-friendly" /><input type="checkbox" value="dog-friendly" /><input type="checkbox" value="pet-friendly" /><input type="checkbox" value="air-conditioning" />
      <div data-tid="min-sqft-dropdown"><div role="combobox">No Min</div><div role="option" data-tag_item="sqft-min-600">600+ Sqft</div></div>
      <button data-tid="show-results">Show Homes</button></dialog>
    `,
      'https://www.rent.com/missouri/springfield/apartments_townhouses_condos_houses',
    );
    const dialog =
      dom.window.document.querySelector<HTMLDialogElement>('dialog')!;
    dom.window.document
      .querySelector('button')!
      .addEventListener('click', () => dialog.setAttribute('open', ''));
    const option = dialog.querySelector<HTMLElement>('[role="option"]')!;
    option.addEventListener('click', () => {
      dialog.querySelector<HTMLElement>('[role="combobox"]')!.textContent =
        '600+ Sqft';
    });
    dialog
      .querySelector<HTMLInputElement>('input[value="4-bedroom"]')!
      .addEventListener('click', () => {
        dialog.querySelector<HTMLInputElement>(
          'input[value="2-bedroom"]',
        )!.checked = true;
        dialog.querySelector<HTMLInputElement>(
          'input[value="3-bedroom"]',
        )!.checked = true;
      });
    const submit = vi.fn();
    dialog
      .querySelector('[data-tid="show-results"]')!
      .addEventListener('click', submit);
    const result = await fillRentSearchPage({
      location: 'Springfield, MO',
      minListedRent: 1000,
      minBedrooms: 1,
      propertyTypes: ['apartment_condo'],
      catsAllowed: true,
      smallDogsAllowed: true,
      largeDogsAllowed: true,
      airConditioning: true,
      minSquareFeet: 537,
    });
    expect(result).toEqual({
      applied: [
        'location',
        'minListedRent',
        'minBedrooms',
        'propertyTypes',
        'catsAllowed',
        'smallDogsAllowed',
        'largeDogsAllowed',
        'airConditioning',
        'minSquareFeet',
      ],
      failed: [],
      submitted: true,
    });
    expect(
      dialog.querySelector<HTMLInputElement>('input[value="3-bedroom"]')
        ?.checked,
    ).toBe(true);
    expect(
      dialog.querySelector<HTMLInputElement>('input[value="condos"]')?.checked,
    ).toBe(true);
    expect(
      dialog.querySelector<HTMLInputElement>('input[value="pet-friendly"]')
        ?.checked,
    ).toBe(true);
    expect(submit).toHaveBeenCalledOnce();
    dom.window.close();
  });

  it('selects a calendar day and verifies the site-owned date value', async () => {
    const dom = installDom(
      `
      <input data-tid="search-input-field" /> <button>Filters</button>
      <dialog id="all-filters-modal"><input name="move-in-date" type="date" />
      <div data-tid="calendar"><div><button type="button">←</button><div>September 2026</div><button type="button">→</button></div>
        <button type="button" data-tid="calendar-day-option" data-dt="2026-09-24">24</button></div>
      <button data-tid="show-results">Show Homes</button></dialog>
    `,
      'https://www.rent.com/missouri/springfield/apartments',
    );
    const dialog =
      dom.window.document.querySelector<HTMLDialogElement>('dialog')!;
    dom.window.document
      .querySelector('button')!
      .addEventListener('click', () => dialog.setAttribute('open', ''));
    dialog
      .querySelector<HTMLButtonElement>('[data-dt]')!
      .addEventListener('click', () => {
        dialog.querySelector<HTMLInputElement>(
          'input[name="move-in-date"]',
        )!.value = '2026-09-24';
      });
    expect(
      await fillRentSearchPage({
        location: 'Springfield, MO',
        moveInDate: '2026-09-24',
      }),
    ).toEqual({
      applied: ['location', 'moveInDate'],
      failed: [],
      submitted: true,
    });
    dom.window.close();
  });

  it.each([
    [{ catsAllowed: true }, 'cat-friendly'],
    [{ smallDogsAllowed: true }, 'dog-friendly'],
    [
      { catsAllowed: true, smallDogsAllowed: true, largeDogsAllowed: true },
      'pet-friendly',
    ],
  ] as const)(
    'maps the requested pets to the exclusive %s policy',
    async (pets, expected) => {
      const dom = installDom(
        `<input data-tid="search-input-field" /> <button>Filters</button>
       <dialog id="all-filters-modal">
         <input type="checkbox" value="cat-friendly" />
         <input type="checkbox" value="dog-friendly" />
         <input type="checkbox" value="pet-friendly" />
         <button data-tid="show-results">Show Homes</button>
       </dialog>`,
        'https://www.rent.com/illinois/chicago/apartments',
      );
      const dialog = dom.window.document.querySelector('dialog')!;
      dom.window.document
        .querySelector('button')!
        .addEventListener('click', () => dialog.setAttribute('open', ''));
      const policies = Array.from(
        dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
      for (const input of policies)
        input.addEventListener('click', () => {
          for (const candidate of policies)
            candidate.checked = candidate === input;
        });

      const result = await fillRentSearchPage({
        location: 'Chicago, IL',
        ...pets,
      });
      expect(result.failed).toEqual([]);
      expect(
        policies.filter((input) => input.checked).map((input) => input.value),
      ).toEqual([expected]);
      dom.window.close();
    },
  );

  it('waits for controlled price and pet updates before the next action and submission', async () => {
    const dom = installDom(
      `<input data-tid="search-input-field" /> <button>Filters</button>
       <dialog id="all-filters-modal">
         <input data-tid="min-price-input" /><input data-tid="max-price-input" />
         <input type="checkbox" value="cat-friendly" />
         <input type="checkbox" value="dog-friendly" />
         <input type="checkbox" value="pet-friendly" />
         <button data-tid="show-results">Show Homes</button>
       </dialog>`,
      'https://www.rent.com/illinois/chicago/apartments',
    );
    const dialog = dom.window.document.querySelector('dialog')!;
    dom.window.document
      .querySelector('button')!
      .addEventListener('click', () => {
        dialog.setAttribute('open', '');
      });
    const prices = ['min-price-input', 'max-price-input'];
    for (const id of prices) {
      const input = dialog.querySelector<HTMLInputElement>(
        `[data-tid="${id}"]`,
      )!;
      let committed = '';
      input.addEventListener('input', () => {
        const next = input.value;
        setTimeout(() => {
          committed = next;
          input.value = next;
        }, 25);
      });
      input.addEventListener('blur', () => {
        input.value = committed;
      });
    }
    const cat = dialog.querySelector<HTMLInputElement>(
      '[value="cat-friendly"]',
    )!;
    const dog = dialog.querySelector<HTMLInputElement>(
      '[value="dog-friendly"]',
    )!;
    const pet = dialog.querySelector<HTMLInputElement>(
      '[value="pet-friendly"]',
    )!;
    let committedPet = '';
    for (const input of [cat, dog, pet])
      input.addEventListener('click', () => {
        const next = input.value;
        setTimeout(() => {
          committedPet = next;
          for (const candidate of [cat, dog, pet])
            candidate.checked = candidate.value === committedPet;
        }, 25);
      });
    const submitted = vi.fn(() => {
      expect(
        prices.map(
          (id) =>
            dialog.querySelector<HTMLInputElement>(`[data-tid="${id}"]`)!.value,
        ),
      ).toEqual(['2500', '7000']);
      expect([cat.checked, dog.checked, pet.checked]).toEqual([
        false,
        false,
        true,
      ]);
    });
    dialog
      .querySelector('[data-tid="show-results"]')!
      .addEventListener('click', submitted);

    expect(
      await fillRentSearchPage({
        location: 'Chicago, IL',
        minListedRent: 2500,
        maxListedRent: 7000,
        catsAllowed: true,
        smallDogsAllowed: true,
        largeDogsAllowed: true,
      }),
    ).toEqual({
      applied: [
        'location',
        'minListedRent',
        'maxListedRent',
        'catsAllowed',
        'smallDogsAllowed',
        'largeDogsAllowed',
      ],
      failed: [],
      submitted: true,
    });
    expect(submitted).toHaveBeenCalledOnce();
    dom.window.close();
  });

  it('continues from the landing page to filters after site navigation', async () => {
    const create = vi.fn().mockResolvedValue({ id: 52 });
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        id: 52,
        status: 'complete',
        url: 'https://www.rent.com/',
      })
      .mockResolvedValue({
        id: 52,
        status: 'complete',
        url: 'https://www.rent.com/missouri/springfield/apartments',
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
      await launchRentSearch(
        { location: 'Springfield, MO', catsAllowed: true },
        'https://www.rent.com/',
      ),
    ).toEqual({ automated: true });
    expect(executeScript).toHaveBeenCalledTimes(2);
  });
});
