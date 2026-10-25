import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fillZillowSearchPage, launchZillowSearch } from '../src/search';

function chromeForZillow({ granted }: { granted: boolean }) {
  const permissionRequest = vi.fn().mockResolvedValue(granted);
  const create = vi.fn().mockResolvedValue({ id: 42, status: 'loading' });
  const get = vi.fn().mockResolvedValue({ id: 42, status: 'complete' });
  const executeScript = vi.fn().mockResolvedValue([
    {
      result: {
        applied: ['maxListedRent', 'smallDogsAllowed', 'largeDogsAllowed'],
        failed: [],
      },
    },
  ]);
  const addUpdated = vi.fn();
  const removeUpdated = vi.fn();
  const addRemoved = vi.fn();
  const removeRemoved = vi.fn();
  vi.stubGlobal('chrome', {
    permissions: { request: permissionRequest },
    tabs: {
      create,
      get,
      onUpdated: { addListener: addUpdated, removeListener: removeUpdated },
      onRemoved: { addListener: addRemoved, removeListener: removeRemoved },
    },
    scripting: { executeScript },
  });
  return { permissionRequest, create, get, executeScript };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Zillow assisted search launch', () => {
  it('fills Zillow price controls and submits through the page UI', async () => {
    const dom = new JSDOM(
      '<button data-testid="price-filters-button">Price</button>',
      { url: 'https://www.zillow.com/santa-barbara-ca/rentals/' },
    );
    const { window } = dom;
    Object.defineProperty(window.Element.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({ length: 1 }),
    });
    for (const [name, value] of [
      ['document', window.document],
      ['location', window.location],
      ['Element', window.Element],
      ['HTMLElement', window.HTMLElement],
      ['HTMLInputElement', window.HTMLInputElement],
      ['HTMLLabelElement', window.HTMLLabelElement],
      ['Event', window.Event],
      ['InputEvent', window.InputEvent],
    ] as const) {
      vi.stubGlobal(name, value);
    }
    let maxInput: HTMLInputElement | undefined;
    let submitted = false;
    window.document
      .querySelector<HTMLButtonElement>('[data-testid="price-filters-button"]')!
      .addEventListener('click', () => {
        const dialog = window.document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.innerHTML = `
          <input id="price-input-min" data-testid="price-input-min" />
          <input id="price-input-max" data-testid="price-input-max" />
          <button>See 12 rentals available</button>
        `;
        maxInput = dialog.querySelector('#price-input-max')!;
        dialog.querySelector('button')!.addEventListener('click', () => {
          submitted = true;
          dialog.remove();
        });
        window.document.body.append(dialog);
      });

    await expect(
      fillZillowSearchPage({ maxListedRent: 3500 }),
    ).resolves.toEqual({ applied: ['maxListedRent'], failed: [] });
    expect(maxInput?.value).toBe('3500');
    expect(submitted).toBe(true);
    dom.window.close();
  });

  it('waits for Zillow to commit bedroom and bathroom choices before submitting', async () => {
    const dom = new JSDOM(
      '<button data-testid="beds-filters-button">Beds & baths</button>',
      { url: 'https://www.zillow.com/chicago-il/rentals/' },
    );
    const { window } = dom;
    Object.defineProperty(window.Element.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({ length: 1 }),
    });
    for (const [name, value] of [
      ['document', window.document],
      ['location', window.location],
      ['Element', window.Element],
      ['HTMLElement', window.HTMLElement],
      ['HTMLInputElement', window.HTMLInputElement],
      ['HTMLLabelElement', window.HTMLLabelElement],
      ['Event', window.Event],
      ['InputEvent', window.InputEvent],
    ] as const) {
      vi.stubGlobal(name, value);
    }
    let submitted: { bedrooms?: string; bathrooms?: string } = {};
    window.document
      .querySelector<HTMLButtonElement>('[data-testid="beds-filters-button"]')!
      .addEventListener('click', () => {
        const dialog = window.document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.innerHTML = `
          <h3>Number of Bedrooms</h3>
          <fieldset>
            <legend>Bedrooms</legend>
            <div role="group" aria-label="Beds Select">
              <button aria-pressed="true">Any</button>
              <button aria-pressed="false">1+</button>
              <button aria-pressed="false">2+</button>
              <button aria-pressed="false">3+</button>
            </div>
          </fieldset>
          <h3>Number of Bathrooms</h3>
          <fieldset>
            <legend>Bathrooms</legend>
            <div role="group" aria-label="Baths Select">
              <button aria-pressed="true">Any</button>
              <button aria-pressed="false">1+</button>
              <button aria-pressed="false">2+</button>
              <button aria-pressed="false">3+</button>
            </div>
          </fieldset>
          <button>See 9 rentals available</button>
        `;
        for (const group of dialog.querySelectorAll<HTMLElement>(
          '[role="group"]',
        )) {
          for (const button of group.querySelectorAll<HTMLButtonElement>(
            'button',
          )) {
            button.addEventListener('click', () => {
              window.setTimeout(() => {
                for (const sibling of group.querySelectorAll('button'))
                  sibling.setAttribute('aria-pressed', 'false');
                button.setAttribute('aria-pressed', 'true');
              }, 25);
            });
          }
        }
        dialog.lastElementChild!.addEventListener('click', () => {
          const selected = (label: string) =>
            dialog
              .querySelector(
                `[role="group"][aria-label="${label}"] button[aria-pressed="true"]`,
              )
              ?.textContent?.trim();
          submitted = {
            bedrooms: selected('Beds Select'),
            bathrooms: selected('Baths Select'),
          };
          dialog.remove();
        });
        window.document.body.append(dialog);
      });

    await expect(
      fillZillowSearchPage({ minBedrooms: 2, minBathrooms: 3 }),
    ).resolves.toEqual({
      applied: ['minBedrooms', 'minBathrooms'],
      failed: [],
    });
    expect(submitted).toEqual({ bedrooms: '2+', bathrooms: '3+' });
    dom.window.close();
  });

  it('selects Zillow small dogs through the card accessibility label', async () => {
    const dom = new JSDOM(
      '<button data-testid="more-filters-button">Filters</button>',
      { url: 'https://www.zillow.com/santa-barbara-ca/rentals/' },
    );
    const { window } = dom;
    Object.defineProperty(window.Element.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({ length: 1 }),
    });
    for (const [name, value] of [
      ['document', window.document],
      ['location', window.location],
      ['Element', window.Element],
      ['HTMLElement', window.HTMLElement],
      ['HTMLInputElement', window.HTMLInputElement],
      ['HTMLLabelElement', window.HTMLLabelElement],
      ['Event', window.Event],
      ['InputEvent', window.InputEvent],
    ] as const) {
      vi.stubGlobal(name, value);
    }
    let smallDogsButton: HTMLButtonElement | undefined;
    let submitted = false;
    window.document
      .querySelector<HTMLButtonElement>('[data-testid="more-filters-button"]')!
      .addEventListener('click', () => {
        const dialog = window.document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.innerHTML = `
          <button aria-label="Allows small dogs" aria-pressed="false"></button>
          <button>See 12 rentals available</button>
        `;
        smallDogsButton = dialog.querySelector(
          'button[aria-label="Allows small dogs"]',
        )!;
        smallDogsButton.addEventListener('click', () => {
          smallDogsButton?.setAttribute('aria-pressed', 'true');
        });
        dialog.lastElementChild!.addEventListener('click', () => {
          submitted = true;
          dialog.remove();
        });
        window.document.body.append(dialog);
      });

    await expect(
      fillZillowSearchPage({ smallDogsAllowed: true }),
    ).resolves.toEqual({ applied: ['smallDogsAllowed'], failed: [] });
    expect(smallDogsButton?.getAttribute('aria-pressed')).toBe('true');
    expect(submitted).toBe(true);
    dom.window.close();
  });

  it('selects each requested Zillow home type through its accessibility label', async () => {
    const dom = new JSDOM('<button>Property type</button>', {
      url: 'https://www.zillow.com/santa-barbara-ca/rentals/',
    });
    const { window } = dom;
    Object.defineProperty(window.Element.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({ length: 1 }),
    });
    for (const [name, value] of [
      ['document', window.document],
      ['location', window.location],
      ['Element', window.Element],
      ['HTMLElement', window.HTMLElement],
      ['HTMLInputElement', window.HTMLInputElement],
      ['HTMLSelectElement', window.HTMLSelectElement],
      ['HTMLLabelElement', window.HTMLLabelElement],
      ['Event', window.Event],
      ['InputEvent', window.InputEvent],
    ] as const) {
      vi.stubGlobal(name, value);
    }
    let dialog: HTMLElement | undefined;
    window.document
      .querySelector<HTMLButtonElement>('button')!
      .addEventListener('click', () => {
        dialog = window.document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.innerHTML = `
          <section>
            <h3>Home type</h3>
            <button aria-label="Any" aria-pressed="true"></button>
            <button aria-label="Houses" aria-pressed="false"></button>
            <button aria-label="Apartments/Condos" aria-pressed="false"></button>
            <button aria-label="Townhomes" aria-pressed="false"></button>
          </section>
          <button>See 12 rentals available</button>
        `;
        for (const button of dialog.querySelectorAll<HTMLButtonElement>(
          'button[aria-label]',
        )) {
          button.addEventListener('click', () => {
            button.setAttribute('aria-pressed', 'true');
          });
        }
        dialog.lastElementChild!.addEventListener('click', () =>
          dialog?.remove(),
        );
        window.document.body.append(dialog);
      });

    await expect(
      fillZillowSearchPage({
        propertyTypes: ['apartment_condo', 'townhouse'],
      }),
    ).resolves.toEqual({ applied: ['propertyTypes'], failed: [] });
    expect(
      dialog
        ?.querySelector('[aria-label="Apartments/Condos"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      dialog
        ?.querySelector('[aria-label="Townhomes"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    dom.window.close();
  });

  it("rounds minimum square feet up to Zillow's closest available option", async () => {
    const dom = new JSDOM(
      '<button data-testid="more-filters-button">Filters</button>',
      { url: 'https://www.zillow.com/santa-barbara-ca/rentals/' },
    );
    const { window } = dom;
    Object.defineProperty(window.Element.prototype, 'getClientRects', {
      configurable: true,
      value: () => ({ length: 1 }),
    });
    for (const [name, value] of [
      ['document', window.document],
      ['location', window.location],
      ['Element', window.Element],
      ['HTMLElement', window.HTMLElement],
      ['HTMLInputElement', window.HTMLInputElement],
      ['HTMLSelectElement', window.HTMLSelectElement],
      ['HTMLLabelElement', window.HTMLLabelElement],
      ['Event', window.Event],
      ['InputEvent', window.InputEvent],
    ] as const) {
      vi.stubGlobal(name, value);
    }
    let minimum: HTMLSelectElement | undefined;
    window.document
      .querySelector<HTMLButtonElement>('[data-testid="more-filters-button"]')!
      .addEventListener('click', () => {
        const dialog = window.document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.innerHTML = `
          <select id="sqft-min" aria-label="Home size min">
            <option value="-1">No Min</option>
            <option value="500">500</option>
            <option value="750">750</option>
            <option value="1000">1,000</option>
            <option value="1250">1,250</option>
          </select>
          <select aria-label="Home size max"><option value="-1">No Max</option></select>
          <button>See 12 rentals available</button>
        `;
        minimum = dialog.querySelector('#sqft-min')!;
        dialog.lastElementChild!.addEventListener('click', () =>
          dialog.remove(),
        );
        window.document.body.append(dialog);
      });

    await expect(fillZillowSearchPage({ minSquareFeet: 800 })).resolves.toEqual(
      { applied: ['minSquareFeet'], failed: [] },
    );
    expect(minimum?.value).toBe('1000');
    dom.window.close();
  });

  it.each([
    ['text', '<input placeholder="MM/DD/YYYY" />', '09/24/2026'],
    [
      'native date',
      '<input type="date" aria-label="Move in date" />',
      '2026-09-24',
    ],
    ['labeled text', '<input aria-label="Move-in date" />', '09/24/2026'],
  ])(
    "commits Zillow's %s move-in date before submitting",
    async (_name, inputMarkup, expected) => {
      const dom = new JSDOM(
        '<button data-testid="more-filters-button">Filters</button>',
        { url: 'https://www.zillow.com/santa-barbara-ca/rentals/' },
      );
      const { window } = dom;
      Object.defineProperty(window.Element.prototype, 'getClientRects', {
        configurable: true,
        value: () => ({ length: 1 }),
      });
      for (const [name, value] of [
        ['document', window.document],
        ['location', window.location],
        ['Element', window.Element],
        ['HTMLElement', window.HTMLElement],
        ['HTMLInputElement', window.HTMLInputElement],
        ['HTMLSelectElement', window.HTMLSelectElement],
        ['HTMLLabelElement', window.HTMLLabelElement],
        ['Event', window.Event],
        ['InputEvent', window.InputEvent],
      ] as const) {
        vi.stubGlobal(name, value);
      }
      let moveInDate: HTMLInputElement | undefined;
      let committedDate = '';
      let submittedDate = '';
      let submitted = false;
      window.document
        .querySelector<HTMLButtonElement>(
          '[data-testid="more-filters-button"]',
        )!
        .addEventListener('click', () => {
          const dialog = window.document.createElement('div');
          dialog.setAttribute('role', 'dialog');
          dialog.innerHTML = `
          <fieldset>
            <legend>Move in date</legend>
            ${inputMarkup}
            <button type="button" aria-label="Open date picker"></button>
          </fieldset>
          <button>See 12 rentals available</button>
        `;
          moveInDate = dialog.querySelector('input')!;
          moveInDate.addEventListener('change', () => {
            committedDate = moveInDate!.value;
            // A controlled field can be replaced during the site's render.
            const updated = moveInDate!.cloneNode(true) as HTMLInputElement;
            updated.value = committedDate;
            moveInDate!.replaceWith(updated);
            moveInDate = updated;
          });
          dialog.lastElementChild!.addEventListener('click', () => {
            submitted = true;
            submittedDate = committedDate;
            dialog.remove();
          });
          window.document.body.append(dialog);
        });

      await expect(
        fillZillowSearchPage({ moveInDate: '2026-09-24' }),
      ).resolves.toEqual({ applied: ['moveInDate'], failed: [] });
      expect(moveInDate?.value).toBe(expected);
      expect(submittedDate).toBe(expected);
      expect(submitted).toBe(true);
      dom.window.close();
    },
  );

  it.each(['minimum', 'reset'])(
    'reports a %s-rejected Zillow date while applying other filters',
    async (rejection) => {
      const dom = new JSDOM(
        `
      <button data-testid="more-filters-button">Filters</button>
    `,
        { url: 'https://www.zillow.com/cupertino-ca/rentals/' },
      );
      const { window } = dom;
      Object.defineProperty(window.Element.prototype, 'getClientRects', {
        configurable: true,
        value: () => ({ length: 1 }),
      });
      for (const [name, value] of [
        ['document', window.document],
        ['location', window.location],
        ['Element', window.Element],
        ['HTMLElement', window.HTMLElement],
        ['HTMLInputElement', window.HTMLInputElement],
        ['HTMLLabelElement', window.HTMLLabelElement],
        ['Event', window.Event],
        ['InputEvent', window.InputEvent],
      ] as const)
        vi.stubGlobal(name, value);
      let submitted = false;
      window.document.querySelector('button')!.addEventListener('click', () => {
        const dialog = window.document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.innerHTML = `
        <input type="date" ${rejection === 'minimum' ? 'min="2026-10-24"' : ''} />
        <button aria-label="On-site parking" aria-pressed="false">On-site parking</button>
        <button>See 12 rentals available</button>
      `;
        if (rejection === 'reset')
          dialog.querySelector('input')!.addEventListener('change', () => {
            window.setTimeout(() => {
              dialog.querySelector('input')!.value = '';
            }, 0);
          });
        dialog.lastElementChild!.addEventListener('click', () => {
          submitted = true;
          dialog.remove();
        });
        window.document.body.append(dialog);
      });
      await expect(
        fillZillowSearchPage({
          moveInDate: '2026-10-22',
          parkingAvailable: true,
        }),
      ).resolves.toEqual({
        applied: ['parkingAvailable'],
        failed: ['moveInDate'],
      });
      expect(submitted).toBe(true);
      dom.window.close();
    },
  );

  it.each([
    ['2000-01-01', 'your move-in date is in the past'],
    ['2099-12-01', 'could not apply your move-in date'],
  ])('explains an unapplied Zillow date (%s)', async (moveInDate, message) => {
    const chromeMock = chromeForZillow({ granted: true });
    chromeMock.executeScript.mockResolvedValue([
      { result: { applied: [], failed: ['moveInDate'] } },
    ]);
    const search = { location: 'Cupertino, CA', moveInDate };
    const outcome = await launchZillowSearch(
      search,
      'https://www.zillow.com/cupertino-ca/rentals/',
    );
    expect(outcome.automated).toBe(false);
    expect(outcome.message).toContain(message);
    expect(search.moveInDate).toBe(moveInDate);
  });

  it('opens the clean location page and fills Zillow controls', async () => {
    const chromeMock = chromeForZillow({ granted: true });
    const outcome = await launchZillowSearch(
      {
        location: 'Santa Barbara, CA',
        maxListedRent: 3500,
        smallDogsAllowed: true,
        largeDogsAllowed: true,
      },
      'https://www.zillow.com/santa-barbara-ca/rentals/',
    );

    expect(outcome).toEqual({ automated: true });
    expect(chromeMock.permissionRequest).toHaveBeenCalledWith({
      origins: ['https://www.zillow.com/*'],
    });
    expect(chromeMock.create).toHaveBeenCalledWith({
      url: 'https://www.zillow.com/santa-barbara-ca/rentals/',
    });
    expect(chromeMock.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      func: expect.any(Function),
      args: [
        {
          location: 'Santa Barbara, CA',
          maxListedRent: 3500,
          smallDogsAllowed: true,
          largeDogsAllowed: true,
        },
      ],
    });
  });

  it('leaves a useful location page open when optional access is declined', async () => {
    const chromeMock = chromeForZillow({ granted: false });
    const outcome = await launchZillowSearch(
      { location: 'Santa Barbara, CA', maxListedRent: 3500 },
      'https://www.zillow.com/santa-barbara-ca/rentals/',
    );

    expect(outcome.automated).toBe(false);
    expect(outcome.message).toContain('Site access is needed');
    expect(chromeMock.create).toHaveBeenCalledOnce();
    expect(chromeMock.executeScript).not.toHaveBeenCalled();
  });

  it('does not request site access for a location-only Zillow launch', async () => {
    const chromeMock = chromeForZillow({ granted: true });
    expect(
      await launchZillowSearch(
        { location: 'Santa Barbara, CA' },
        'https://www.zillow.com/santa-barbara-ca/rentals/',
      ),
    ).toEqual({ automated: false });
    expect(chromeMock.permissionRequest).not.toHaveBeenCalled();
    expect(chromeMock.create).toHaveBeenCalledOnce();
  });
});
