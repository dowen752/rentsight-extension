import { describe, it, expect, vi } from 'vitest';
import { build } from 'vite';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import type { ExtensionResponse } from '../src/shared/messages';

describe('classic content-script inspection', () => {
  it('returns standard extraction before capture and retains it when capture fails', async () => {
    const built = await build({
      configFile: false,
      logLevel: 'silent',
      build: {
        write: false,
        lib: {
          entry: 'src/content/index.ts',
          name: 'RentSightContent',
          formats: ['iife'],
        },
      },
    });
    const output = (Array.isArray(built) ? built[0] : built) as {
      output: { type: string; code?: string }[];
    };
    const script = output.output.find((item) => item.type === 'chunk')!.code!;
    const dom = new JSDOM(
      readFileSync(
        new URL('./fixtures/zillow-listing.html', import.meta.url),
        'utf8',
      ),
      {
        url: 'https://www.zillow.com/homedetails/example/123_zpid/',
        runScripts: 'outside-only',
      },
    );
    let listener: (
      message: unknown,
      sender: unknown,
      respond: (value: ExtensionResponse) => void,
    ) => void;
    Object.assign(dom.window, {
      chrome: {
        runtime: {
          onMessage: {
            addListener: (fn: typeof listener) => {
              listener = fn;
            },
          },
          sendMessage: vi.fn().mockResolvedValue(undefined),
        },
      },
      TextEncoder,
    });
    const capture = vi
      .spyOn(dom.window.document.body, 'cloneNode')
      .mockImplementation(() => {
        throw new Error('capture unavailable');
      });
    dom.window.console.warn = vi.fn();
    try {
      dom.window.eval(script);
      const respond = vi.fn();
      listener!({ type: 'GET_PAGE_INFO' }, {}, respond);
      const preliminary = respond.mock.calls[0][0] as ExtensionResponse;
      expect(preliminary.type).toBe('PAGE_INFO_RESPONSE');
      if (preliminary.type !== 'PAGE_INFO_RESPONSE')
        throw new Error('Missing preliminary response');
      expect(
        preliminary.payload.extraction?.listing.recurring.advertisedRent?.value,
      ).toBe(2650);
      expect(preliminary.payload.aiCapture).toBeUndefined();
      expect(capture).not.toHaveBeenCalled();
      listener!({ type: 'GET_AI_CAPTURE' }, {}, respond);
      expect(capture).toHaveBeenCalledOnce();
      expect(respond.mock.calls[1][0].payload.extraction).toEqual(
        preliminary.payload.extraction,
      );
      capture.mockRestore();
      listener!({ type: 'GET_AI_CAPTURE' }, {}, respond);
      expect(
        respond.mock.calls[2][0].payload.aiCapture.capture.blocks.length,
      ).toBeGreaterThan(0);
    } finally {
      dom.window.close();
    }
  });
});
