import {
  applyExtraction,
  createInitialAnalysis,
  materializeListing,
  setRecurringValue,
} from '../src/shared/analysis';
import { calculateEstimatedTrueMonthlyCost } from '../src/calculations';
import { describe, it, expect, vi } from 'vitest';
import { build } from 'vite';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import type { ExtensionResponse } from '../src/shared/messages';

describe('classic content-script inspection', () => {
  it('opens review for a floor-plan detail and keeps its values and identity separate from the community', async () => {
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
    const dom = new JSDOM(
      `<main>
      <h1 data-test-id="bdp-building-title">Example community</h1>
      <div>Available units: 1 bed, 1 bath $1,100; 3 beds, 2 baths $2,900</div>
      <section><header><h1>Two Bedroom Two Bath</h1><p>2 beds, 2 baths | $1,850 Fees may apply</p></header>
      <div>900 sqft</div><p>About the unit</p></section>
    </main>`,
      {
        url: 'https://www.zillow.com/apartments/example/abc/#udp-401905007',
        runScripts: 'outside-only',
      },
    );
    let listener: (
      message: unknown,
      sender: unknown,
      respond: (value: ExtensionResponse) => void,
    ) => void;
    Object.assign(dom.window, {
      TextEncoder,
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
    });
    try {
      dom.window.eval(
        output.output.find((item) => item.type === 'chunk')!.code!,
      );
      const respond = vi.fn();
      listener!({ type: 'GET_AI_CAPTURE' }, {}, respond);
      const payload = respond.mock.calls[0][0].payload;
      expect(payload.requiresUnitSelection).toBe(false);
      expect(payload.selectedUnitId).toBe('udp-401905007');
      expect(payload.url).toBe(
        'https://www.zillow.com/apartments/example/abc/#rentsight-unit=udp-401905007',
      );
      expect(payload.appearsToBeRentalListing).toBe(true);
      expect(payload.extraction.listing.recurring.advertisedRent.value).toBe(
        1850,
      );
      expect(payload.extraction.listing.identity.bedrooms.value).toBe(2);
      expect(payload.extraction.listing.identity.bathrooms.value).toBe(2);
      expect(payload.extraction.listing.identity.squareFootage.value).toBe(900);
      expect(payload.aiCapture.capture.blocks.length).toBeGreaterThan(0);
      const analysis = applyExtraction(
        createInitialAnalysis(payload.url, payload.title),
        payload.extraction,
      );
      expect(analysis.listing.recurring.advertisedRent?.value).toBe(1850);
      const saved = JSON.parse(JSON.stringify(analysis));
      expect(materializeListing(saved).identity.squareFootage?.value).toBe(900);
      const originalCost = calculateEstimatedTrueMonthlyCost(
        materializeListing(saved),
      );
      const edited = setRecurringValue(saved, 'advertisedRent', 1950);
      expect(
        calculateEstimatedTrueMonthlyCost(materializeListing(edited)) -
          originalCost,
      ).toBeCloseTo(100);

      dom.window.history.replaceState({}, '', '#udp-401905008');
      listener!({ type: 'GET_PAGE_INFO' }, {}, respond);
      expect(respond.mock.calls[1][0].payload.url).not.toBe(payload.url);
      dom.window.history.replaceState({}, '', dom.window.location.pathname);
      dom.window.document.querySelector('section')!.remove();
      listener!({ type: 'GET_PAGE_INFO' }, {}, respond);
      expect(respond.mock.calls[2][0].payload.requiresUnitSelection).toBe(true);
    } finally {
      dom.window.close();
    }
  });

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
