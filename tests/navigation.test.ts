import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { observeListingNavigation } from '../src/content/navigation';
import {
  requiresZillowUnitSelection,
  selectedZillowUnitId,
} from '../src/content/pageState';

describe('SPA listing navigation', () => {
  it('uses Chromium navigation events without starting a permanent poll', async () => {
    const dom = new JSDOM('<html><body></body></html>', {
      url: 'https://example.com/listing/one',
    });
    const navigation = new dom.window.EventTarget();
    Object.defineProperty(dom.window, 'navigation', { value: navigation });
    const interval = vi.spyOn(dom.window, 'setInterval');
    const callback = vi.fn();
    const observer = observeListingNavigation(
      dom.window as unknown as Window,
      dom.window.document,
      callback,
      5,
    );

    dom.window.history.pushState({}, '', '/listing/two');
    navigation.dispatchEvent(new dom.window.Event('navigatesuccess'));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(interval).not.toHaveBeenCalled();
    observer.disconnect();
  });

  it('debounces DOM changes and reruns only after the URL changes', async () => {
    const dom = new JSDOM('<html><body><main></main></body></html>', {
      url: 'https://example.com/listing/one',
    });
    const callback = vi.fn();
    const observer = observeListingNavigation(
      dom.window as unknown as Window,
      dom.window.document,
      callback,
      5,
      5,
    );
    dom.window.document.querySelector('main')?.append('ordinary mutation');
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(callback).not.toHaveBeenCalled();

    dom.window.history.pushState({}, '', '/listing/two');
    dom.window.document
      .querySelector('main')
      ?.append('rerender 1', 'rerender 2');
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(callback).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });

  it('does not let continuous DOM mutations starve a URL update', async () => {
    const dom = new JSDOM('<html><body><main></main></body></html>', {
      url: 'https://example.com/search',
    });
    const callback = vi.fn();
    const observer = observeListingNavigation(
      dom.window as unknown as Window,
      dom.window.document,
      callback,
      10,
      5,
    );

    dom.window.history.pushState({}, '', '/homedetails/selected');
    const churn = setInterval(() => {
      dom.window.document.querySelector('main')?.append('mutation');
    }, 2);
    await new Promise((resolve) => setTimeout(resolve, 30));
    clearInterval(churn);

    expect(callback).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });
});

describe('Zillow unit selection', () => {
  it('requires an explicit choice when several community units are listed', () => {
    const dom = new JSDOM(`
      <html><body>
        <div role="dialog">
          <h2>Available units</h2>
          <div>Unit 2-2401 · 1 bd · 725 sqft · $4,406</div>
          <div>Unit 2-2802 · 1 bd · 725 sqft · $4,493</div>
        </div>
      </body></html>
    `);
    expect(
      requiresZillowUnitSelection(
        dom.window.document,
        new URL('https://www.zillow.com/apartments/example/abc/'),
      ),
    ).toBe(true);
  });

  it('recognizes a selected unit from its heading', () => {
    const dom = new JSDOM(`
      <html><body>
        <h2>Available units</h2>
        <div>Unit 2-2401 · $4,406</div>
        <div>Unit 2-2802 · $4,493</div>
        <div role="dialog"><h1>Unit 2-2401</h1>Base rent $4,406</div>
      </body></html>
    `);
    expect(
      requiresZillowUnitSelection(
        dom.window.document,
        new URL('https://www.zillow.com/apartments/example/abc/'),
      ),
    ).toBe(false);
    expect(
      selectedZillowUnitId(
        dom.window.document,
        new URL('https://www.zillow.com/apartments/example/abc/'),
      ),
    ).toBe('2-2401');
  });

  it('recognizes Zillow selected-unit routes without scanning the modal', () => {
    const dom = new JSDOM('<html><body><h1>308</h1></body></html>');
    expect(
      selectedZillowUnitId(
        dom.window.document,
        new URL(
          'https://www.zillow.com/apartments/cupertino-ca/example/#uap-206287/5631',
        ),
      ),
    ).toBe('uap-206287/5631');
  });

  it('classifies Zillow communities without reading the page DOM', () => {
    const dom = new JSDOM('<html><body>Huge community page</body></html>');
    Object.defineProperty(dom.window.document.body, 'textContent', {
      get: () => {
        throw new Error('Community DOM should not be scanned');
      },
    });
    expect(
      requiresZillowUnitSelection(
        dom.window.document,
        new URL('https://www.zillow.com/apartments/example/abc/'),
      ),
    ).toBe(true);
  });

  it('allows ordinary Zillow home-detail extraction', () => {
    const dom = new JSDOM('<html><body>Individual rental</body></html>');
    expect(
      requiresZillowUnitSelection(
        dom.window.document,
        new URL('https://www.zillow.com/homedetails/example/1_zpid/'),
      ),
    ).toBe(false);
  });
});
