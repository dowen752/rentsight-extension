import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fillRedfinSearchPage,
  launchRedfinSearch,
  resolveRedfinLocationPage,
} from '../src/search';

function installDom(markup: string, url: string) {
  const dom = new JSDOM(markup, { url, pretendToBeVisual: true });
  for (const name of [
    'document',
    'location',
    'HTMLInputElement',
    'HTMLSelectElement',
    'Event',
    'InputEvent',
  ] as const)
    vi.stubGlobal(name, dom.window[name]);
  return dom;
}

afterEach(() => vi.unstubAllGlobals());

describe('Redfin assisted search', () => {
  it('runs the assisted launch for a bare city instead of stopping at the landing page', async () => {
    const create = vi.fn().mockResolvedValue({ id: 42 });
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        id: 42,
        status: 'complete',
        url: 'https://www.redfin.com/rentals',
      })
      .mockResolvedValue({
        id: 42,
        status: 'complete',
        url: 'https://www.redfin.com/city/26187/VA/Springfield/rentals',
      });
    const executeScript = vi
      .fn()
      .mockResolvedValueOnce([{ result: true }])
      .mockResolvedValueOnce([
        {
          result: {
            applied: ['location', 'minBedrooms'],
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
      await launchRedfinSearch(
        { location: 'Springfield', minBedrooms: 1 },
        'https://www.redfin.com/rentals',
      ),
    ).toEqual({
      automated: true,
      message:
        'Redfin applied the filters using its first matching city suggestion. Check the city and state before browsing.',
    });
    expect(executeScript).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith({
      url: 'https://www.redfin.com/rentals',
    });
  });
  it('selects the exact city/state suggestion instead of another Springfield', async () => {
    const dom = installDom(
      `
      <input type="search" aria-label="Search for properties" />
      <div data-rf-test-name="item-row-active" role="link"><a href="/city/18387/IL/Springfield">Springfield</a></div>
      <div data-rf-test-name="item-row-active" role="link"><a href="/city/17886/MO/Springfield">Springfield</a></div>
    `,
      'https://www.redfin.com/rentals',
    );
    const matching = dom.window.document.querySelectorAll('[role="link"]')[1];
    vi.spyOn(matching, 'getClientRects').mockReturnValue({
      length: 1,
    } as DOMRectList);
    const clicked = vi.fn();
    matching.addEventListener('click', clicked);
    vi.spyOn(
      dom.window.document.querySelector('input')!,
      'getClientRects',
    ).mockReturnValue({ length: 1 } as DOMRectList);
    expect(await resolveRedfinLocationPage('Springfield, MO')).toBe(true);
    expect(clicked).toHaveBeenCalledOnce();
    expect(dom.window.document.querySelector('input')?.value).toBe(
      'Springfield, MO',
    );
    dom.window.close();
  });

  it('uses the first city suggestion when only a city was entered', async () => {
    const dom = installDom(
      `
      <input type="search" aria-label="Search for properties" />
      <div data-rf-test-name="item-row-active" role="link"><a href="/city/26187/VA/Springfield">Springfield</a></div>
      <div data-rf-test-name="item-row-active" role="link"><a href="/city/17886/MO/Springfield">Springfield</a></div>
    `,
      'https://www.redfin.com/rentals',
    );
    const suggestions =
      dom.window.document.querySelectorAll<HTMLElement>('[role="link"]');
    for (const suggestion of suggestions)
      vi.spyOn(suggestion, 'getClientRects').mockReturnValue({
        length: 1,
      } as DOMRectList);
    vi.spyOn(
      dom.window.document.querySelector('input')!,
      'getClientRects',
    ).mockReturnValue({ length: 1 } as DOMRectList);
    const first = vi.fn();
    const second = vi.fn();
    suggestions[0].addEventListener('click', first);
    suggestions[1].addEventListener('click', second);
    expect(await resolveRedfinLocationPage('Springfield')).toBe(true);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    dom.window.close();
  });

  it('rounds square footage up and retains successful filters when date is unavailable', async () => {
    const dom = installDom(
      `
      <button>Filters</button><div id="bp-dialog-container" class="AllFiltersDialog">
      <input id="cats" type="checkbox" /><input id="hasParking" type="checkbox" />
      <select name="sqFtMin"><option value="default">No min</option><option value="500">500</option><option value="600">600</option><option value="700">700</option></select>
      <button class="applyButton">See 10 homes</button></div>
    `,
      'https://www.redfin.com/city/17886/MO/Springfield/rentals',
    );
    const button = dom.window.document.querySelector('button.applyButton')!;
    const clicked = vi.fn();
    button.addEventListener('click', clicked);
    const result = await fillRedfinSearchPage({
      location: 'Springfield, MO',
      catsAllowed: true,
      parkingAvailable: true,
      minSquareFeet: 537,
      moveInDate: '2026-09-24',
    });
    expect(result).toEqual({
      applied: ['location', 'catsAllowed', 'parkingAvailable', 'minSquareFeet'],
      failed: ['moveInDate'],
      submitted: true,
    });
    expect(
      dom.window.document.querySelector<HTMLSelectElement>('select')?.value,
    ).toBe('600');
    expect(clicked).toHaveBeenCalledOnce();
    dom.window.close();
  });
});
