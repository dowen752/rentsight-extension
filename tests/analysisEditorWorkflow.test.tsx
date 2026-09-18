// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
});
