// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantRequest, AssistantResponse } from '../src/assistant';
import { AssistantView } from '../src/sidepanel/AssistantView';
import {
  createInitialAnalysis,
  setRecurringValue,
} from '../src/shared/analysis';
import { extensionStorage } from '../src/storage';

function enter(input: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('assistant workflow', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    vi.spyOn(extensionStorage, 'get').mockResolvedValue(undefined);
    vi.spyOn(extensionStorage, 'set').mockResolvedValue();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it('sends a compact calculation snapshot and applies an approved search patch', async () => {
    const analysis = setRecurringValue(
      createInitialAnalysis('https://example.com/listing'),
      'advertisedRent',
      2_300,
    );
    analysis.listing.identity.fullAddress = {
      value: '123 Main St',
      source: 'listing',
      confidence: 1,
    };
    let captured: AssistantRequest | undefined;
    const sendMessage = vi.fn(async (request: AssistantRequest) => {
      captured = request;
      return {
        schemaVersion: '1.0',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        contextRevision: request.contextRevision,
        message: {
          format: 'markdown',
          text: 'I can put those preferences into Find.',
        },
        proposals: [
          {
            id: 'search-1',
            type: 'search.patch',
            explanation: 'Search in Pasadena.',
            arguments: {
              set: { location: 'Pasadena, CA', maxListedRent: 2_800 },
              clear: [],
            },
          },
        ],
      } satisfies AssistantResponse;
    });
    const navigate = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AssistantView
          analysis={analysis}
          savedListings={[]}
          navigate={navigate}
          updateAnalysis={vi.fn()}
          sendMessage={sendMessage}
          animateResponses={false}
        />,
      );
    });

    const composer = container.querySelector<HTMLTextAreaElement>('textarea')!;
    await act(async () => enter(composer, 'Find me a place in Pasadena'));
    await act(async () => {
      container
        .querySelector<HTMLFormElement>('.assistant-composer')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(captured?.context?.currentCalculation).toMatchObject({
      advertisedRent: 2_300,
    });
    expect(captured?.context?.currentListing).toMatchObject({
      address: '123 Main St',
    });
    expect(captured?.capabilities.actions).not.toHaveProperty('search.launch');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Apply')!
        .click();
    });
    expect(extensionStorage.set).toHaveBeenCalledWith('searchProfile', {
      schemaVersion: 2,
      search: { location: 'Pasadena, CA', maxListedRent: 2_800 },
    });
    expect(navigate).toHaveBeenCalledWith('find');
    await act(async () => root.unmount());
  });

  it('clears pending after a timeout and retries the exact same request', async () => {
    const requests: AssistantRequest[] = [];
    const sendMessage = vi.fn(async (request: AssistantRequest) => {
      requests.push(request);
      if (requests.length === 1)
        throw new Error(
          'RentSight took too long to respond. Please try again.',
        );
      return {
        schemaVersion: '1.0',
        conversationId: 'conversation-1',
        messageId: 'message-1',
        contextRevision: request.contextRevision,
        message: { format: 'markdown', text: 'Here is the answer.' },
        proposals: [],
      } satisfies AssistantResponse;
    });
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AssistantView
          savedListings={[]}
          navigate={vi.fn()}
          sendMessage={sendMessage}
          animateResponses={false}
        />,
      );
    });

    const composer = container.querySelector<HTMLTextAreaElement>('textarea')!;
    await act(async () => enter(composer, 'Explain this listing'));
    await act(async () =>
      container
        .querySelector<HTMLFormElement>('.assistant-composer')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        ),
    );

    expect(container.textContent).toContain(
      'RentSight took too long to respond. Please try again.',
    );
    expect(container.textContent).not.toContain('Thinking about your rental…');
    expect(
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Try again')
        ?.hasAttribute('disabled'),
    ).toBe(false);

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Try again')!
        .click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(requests[1]).toBe(requests[0]);
    expect(container.textContent).toContain('Here is the answer.');
    expect(container.querySelectorAll('.assistant-message.user')).toHaveLength(
      1,
    );
    await act(async () => root.unmount());
  });

  it('renders the assistant markdown contract as formatted, safe content', async () => {
    const sendMessage = vi.fn(
      async (request: AssistantRequest) =>
        ({
          schemaVersion: '1.0',
          conversationId: 'conversation-markdown',
          messageId: 'message-markdown',
          contextRevision: request.contextRevision,
          message: {
            format: 'markdown',
            text: [
              '### Monthly total',
              '',
              '- **Advertised rent:** $2,640',
              '- **Utilities:** $298',
              '',
              '[View source](https://example.com) <script>alert(1)</script>',
              '',
              '![Tracking image](https://example.com/tracker.png)',
            ].join('\n'),
          },
          proposals: [],
        }) satisfies AssistantResponse,
    );
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AssistantView
          savedListings={[]}
          navigate={vi.fn()}
          sendMessage={sendMessage}
          animateResponses={false}
        />,
      );
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.assistant-starters button')!
        .click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const response = container.querySelector('.assistant-message.assistant')!;
    expect(response.querySelector('h3')?.textContent).toBe('Monthly total');
    expect(response.querySelectorAll('li')).toHaveLength(2);
    expect(response.querySelector('strong')?.textContent).toBe(
      'Advertised rent:',
    );
    expect(response.querySelector('script')).toBeNull();
    expect(response.querySelector('img')).toBeNull();
    expect(response.textContent).toContain('[Image: Tracking image]');
    expect(response.textContent).not.toContain('###');
    expect(response.textContent).not.toContain('**');
    expect(response.querySelector('a')).toMatchObject({
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    await act(async () => root.unmount());
  });
});
