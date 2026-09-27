// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantMarkdown } from '../src/sidepanel/AssistantMarkdown';

describe('assistant response reveal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    container.remove();
    vi.useRealTimers();
  });

  it('progressively reveals a response and then renders its complete markdown', async () => {
    const complete = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AssistantMarkdown
          text="**Total:** $2,953 per month"
          animate
          onRevealComplete={complete}
        />,
      );
    });

    expect(container.querySelector('.assistant-stream-cursor')).not.toBeNull();
    expect(container.textContent).not.toContain('$2,953 per month');

    await act(async () => vi.advanceTimersByTimeAsync(10_000));

    expect(container.textContent).toBe('Total: $2,953 per month');
    expect(container.querySelector('strong')?.textContent).toBe('Total:');
    expect(container.querySelector('.assistant-stream-cursor')).toBeNull();
    expect(complete).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });
});
