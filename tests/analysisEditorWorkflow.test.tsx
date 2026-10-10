// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAiExtraction } from '../src/ai/adapter';
import type { ExtractionSuccess } from '../src/ai/types';
import { AiSourceReview } from '../src/sidepanel/AiExtractionCard';
import { AnalysisEditor } from '../src/sidepanel/App';
import {
  createInitialAnalysis,
  setRecurringValue,
} from '../src/shared/analysis';

describe('analysis editor workflow', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
  });

  it('allows correcting housing type from review inputs', async () => {
    const analysis = createInitialAnalysis('https://example.com/rental/type');
    const update = vi.fn();
    const root = createRoot(container);
    await act(async () =>
      root.render(<AnalysisEditor analysis={analysis} update={update} />),
    );
    const select = [
      ...container.querySelectorAll<HTMLSelectElement>('select'),
    ].find((node) =>
      node.parentElement?.textContent?.includes('Housing type'),
    )!;
    expect(select.value).toBe('');
    await act(async () => {
      select.value = 'townhouse';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const next = update.mock.calls[0][0](analysis);
    expect(next.listing.identity.housingType).toMatchObject({
      value: 'townhouse',
      source: 'user',
    });
    await act(async () =>
      root.render(<AnalysisEditor analysis={next} update={update} />),
    );
    const electricity = container.querySelector<HTMLInputElement>(
      'input[aria-label="Electricity"]',
    );
    // Utility review must display the same recomputed amount used in results.
    expect(electricity?.value).toBe('99');
    await act(async () => root.unmount());
  });

  it('removes completed AI review feedback after inputs are confirmed', async () => {
    const analysis = setRecurringValue(
      createInitialAnalysis('https://example.com/rental/confirmed'),
      'advertisedRent',
      1_800,
    );
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnalysisEditor
          analysis={analysis}
          update={vi.fn()}
          aiControls={{
            state: { status: 'succeeded', requestId: 'completed-review' },
            retry: vi.fn(),
            continueWithPreliminary: vi.fn(),
          }}
        />,
      );
    });

    expect(container.textContent).toContain('AI review complete');

    const confirm =
      container.querySelector<HTMLButtonElement>('.confirm-action');
    expect(confirm?.disabled).toBe(false);
    await act(async () => confirm?.click());

    expect(container.textContent).toContain('Step 2 · Results');
    expect(container.textContent).not.toContain('AI review complete');

    await act(async () => root.unmount());
  });

  it('keeps a flagged extraction as a complete property note when selected', async () => {
    const response = JSON.parse(
      readFileSync('tests/fixtures/ai/normal.response.json', 'utf8'),
    ) as ExtractionSuccess;
    response.result.property.fees.value![0].refundable = {
      status: 'unknown',
      value: null,
      candidates: [],
      scope: 'unknown',
      evidenceIds: [],
    };
    const analysis = applyAiExtraction(
      createInitialAnalysis('https://example.com/rental/flagged'),
      response,
    );
    const update = vi.fn();
    const root = createRoot(container);

    await act(async () => {
      root.render(<AiSourceReview analysis={analysis} update={update} />);
    });

    const checkbox = container.querySelector<HTMLInputElement>(
      '.ai-charge-note-toggle input',
    );
    expect(checkbox?.checked).toBe(false);
    await act(async () => checkbox?.click());

    const transform = update.mock.calls[0]?.[0] as
      ((current: typeof analysis) => typeof analysis) | undefined;
    expect(transform).toBeTypeOf('function');
    const updated = transform!(analysis);
    expect(updated.propertyNotes).toEqual([
      expect.objectContaining({
        source: 'ai',
        sourceId: 'fee:security-deposit',
        text: 'Security deposit: $1,000 · one time · per unit · required · refundability not stated',
      }),
    ]);

    await act(async () => root.unmount());
  });
});
