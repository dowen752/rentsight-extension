import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { observeListingNavigation } from '../src/content/navigation';

describe('SPA listing navigation', () => {
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
});
