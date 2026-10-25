// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AssistantConversationPage,
  AssistantConversationTurnsPage,
  AssistantRequest,
  AssistantResponse,
  StoredAssistantConversation,
} from '../src/assistant';
import { BackendRequestError } from '../src/backend';
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
    vi.unstubAllGlobals();
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
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(captured?.context?.currentCalculation).toMatchObject({
      advertisedRent: 2_300,
    });
    expect(captured?.context?.currentListing).toMatchObject({
      address: '123 Main St',
    });
    expect(captured?.capabilities.actions['search.launch']).toBe('2.0');
    expect(
      vi
        .mocked(extensionStorage.set)
        .mock.calls.some(
          ([key, value]) =>
            key === 'assistantConversation' &&
            (value as StoredAssistantConversation).conversationId ===
              'conversation-1' &&
            (value as StoredAssistantConversation).messages.length === 2,
        ),
    ).toBe(true);

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Save search preferences')!
        .click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(extensionStorage.set).toHaveBeenCalledWith('searchProfile', {
      schemaVersion: 2,
      search: { location: 'Pasadena, CA', maxListedRent: 2_800 },
    });
    expect(navigate).toHaveBeenCalledWith('find');
    await act(async () => root.unmount());
  });

  it('answers from a rich saved-listing snapshot without exposing current-listing mutations', async () => {
    const currentAnalysis = setRecurringValue(
      createInitialAnalysis('https://example.com/current'),
      'advertisedRent',
      3_100,
    );
    const savedAnalysis = setRecurringValue(
      createInitialAnalysis('https://example.com/saved'),
      'advertisedRent',
      2_200,
    );
    savedAnalysis.listing.identity.fullAddress = {
      value: '500 Saved Ave',
      source: 'user',
      confidence: 1,
    };
    savedAnalysis.propertyNotes = [
      {
        id: 'saved-note',
        text: 'Parking is assigned.',
        source: 'user',
      },
    ];
    const savedRecord = {
      schemaVersion: 1 as const,
      id: 'saved-1',
      url: 'https://example.com/saved',
      analysis: savedAnalysis,
      createdAt: '2026-09-20T12:00:00.000Z',
      updatedAt: '2026-09-21T12:00:00.000Z',
    };
    let captured: AssistantRequest | undefined;
    const updateAnalysis = vi.fn();
    const setSelectedSavedListingIds = vi.fn();
    const sendMessage = vi.fn(async (request: AssistantRequest) => {
      captured = request;
      return {
        schemaVersion: '1.0',
        conversationId: 'conversation-saved',
        messageId: 'message-saved',
        contextRevision: request.contextRevision,
        message: { format: 'markdown', text: 'The saved rent is $2,200.' },
        proposals: [
          {
            id: 'unsafe-saved-cost',
            type: 'analysis.set_cost',
            explanation: 'Change parking.',
            arguments: {
              category: 'parking',
              amount: 100,
              currency: 'USD',
              frequency: 'monthly',
            },
          },
        ],
      } satisfies AssistantResponse;
    });
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AssistantView
          analysis={currentAnalysis}
          savedListings={[savedRecord]}
          selectedSavedListingIds={['saved-1']}
          setSelectedSavedListingIds={setSelectedSavedListingIds}
          navigate={vi.fn()}
          updateAnalysis={updateAnalysis}
          sendMessage={sendMessage}
          animateResponses={false}
        />,
      );
    });

    expect(container.textContent).toContain('Ask about this saved rental');
    expect(container.textContent).toContain(
      'Using saved rental: 500 Saved Ave',
    );
    await act(async () => {
      container
        .querySelector<HTMLDetailsElement>('.assistant-context-picker')!
        .setAttribute('open', '');
    });
    expect(
      container.querySelector('.assistant-context-options input'),
    ).toBeNull();
    const contextOptions = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '.assistant-context-option',
      ),
    );
    expect(contextOptions).toHaveLength(2);
    expect(contextOptions[0].getAttribute('aria-pressed')).toBe('false');
    expect(contextOptions[1].getAttribute('aria-pressed')).toBe('true');
    await act(async () => contextOptions[0].click());
    expect(setSelectedSavedListingIds).toHaveBeenCalledWith([]);
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.assistant-starters button')!
        .click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(captured?.context?.activeView).toBe('saved');
    expect(captured?.context).not.toHaveProperty('currentListing');
    expect(captured?.context?.selectedListings?.[0]).toMatchObject({
      id: 'saved-1',
      listing: {
        address: '500 Saved Ave',
        recurring: { advertisedRent: { value: 2_200, source: 'user' } },
      },
      calculation: { advertisedRent: 2_200 },
      userNotes: [{ id: 'saved-note', text: 'Parking is assigned.' }],
    });
    expect(captured?.contextRevision).toContain('saved-listings:saved-1:');
    expect(captured?.capabilities.actions).toEqual({
      'search.patch': '2.0',
      'search.launch': '2.0',
      'saved_listing.set_cost': '1.0',
      'saved_listing.set_field': '1.0',
      'saved_listing.clear_field': '1.0',
      'saved_listing.add_custom_fee': '1.0',
      'saved_listing.update_custom_fee': '1.0',
      'saved_listing.remove_custom_fee': '1.0',
      'saved_listing.add_note': '1.0',
      'saved_listing.remove_note': '1.0',
      'workspace.navigate': '1.0',
    });
    expect(container.textContent).toContain('The saved rent is $2,200.');
    expect(container.textContent).not.toContain('Change parking.');
    expect(updateAnalysis).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it('advertises and applies a revision-bound update to the selected saved listing', async () => {
    const savedAnalysis = setRecurringValue(
      createInitialAnalysis('https://example.com/saved'),
      'advertisedRent',
      2_200,
    );
    savedAnalysis.listing.identity.fullAddress = {
      value: '500 Saved Ave',
      source: 'user',
      confidence: 1,
    };
    const savedRecord = {
      schemaVersion: 1 as const,
      id: 'saved-1',
      url: 'https://example.com/saved',
      analysis: savedAnalysis,
      createdAt: '2026-09-20T12:00:00.000Z',
      updatedAt: '2026-09-21T12:00:00.000Z',
    };
    let captured: AssistantRequest | undefined;
    const resultRevision = 'saved-listings:saved-1:2026-09-29T12:00:00.000Z';
    const updateSavedListing = vi.fn(async () => resultRevision);
    const sendMessage = vi.fn(async (request: AssistantRequest) => {
      captured = request;
      return {
        schemaVersion: '1.0',
        conversationId: 'conversation-saved-update',
        messageId: 'message-saved-update',
        contextRevision: request.contextRevision,
        message: { format: 'markdown', text: 'I can suggest that update.' },
        proposals: [
          {
            id: 'saved-cost-1',
            type: 'saved_listing.set_cost',
            explanation: 'Update a different property.',
            contextRevision: request.contextRevision!,
            arguments: {
              listingId: 'saved-1',
              category: 'parking',
              amount: 100,
              currency: 'USD',
              frequency: 'monthly',
            },
          },
        ],
      } satisfies AssistantResponse;
    });
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AssistantView
          savedListings={[savedRecord]}
          selectedSavedListingIds={['saved-1']}
          setSelectedSavedListingIds={vi.fn()}
          navigate={vi.fn()}
          updateSavedListing={updateSavedListing}
          sendMessage={sendMessage}
          animateResponses={false}
        />,
      );
    });

    const composer = container.querySelector<HTMLTextAreaElement>('textarea')!;
    await act(async () => enter(composer, 'Set parking to $100 per month'));
    await act(async () => {
      container
        .querySelector<HTMLFormElement>('.assistant-composer')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(captured?.capabilities.actions).toEqual({
      'search.patch': '2.0',
      'search.launch': '2.0',
      'saved_listing.set_cost': '1.0',
      'saved_listing.set_field': '1.0',
      'saved_listing.clear_field': '1.0',
      'saved_listing.add_custom_fee': '1.0',
      'saved_listing.update_custom_fee': '1.0',
      'saved_listing.remove_custom_fee': '1.0',
      'saved_listing.add_note': '1.0',
      'saved_listing.remove_note': '1.0',
      'workspace.navigate': '1.0',
    });
    expect(container.textContent).toContain('Update 500 Saved Ave');
    expect(container.textContent).not.toContain('Update a different property.');

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Apply')!
        .click();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await Promise.resolve();
    });
    expect(updateSavedListing).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'saved_listing.set_cost',
        arguments: expect.objectContaining({ listingId: 'saved-1' }),
      }),
    );
    expect(container.textContent).toContain('Applied');
    await vi.waitFor(() =>
      expect(extensionStorage.set).toHaveBeenCalledWith(
        'assistantConversation',
        expect.objectContaining({
          outcomes: expect.arrayContaining([
            {
              proposalId: 'saved-cost-1',
              status: 'applied',
              resultRevision,
            },
          ]),
        }),
      ),
    );
    await act(async () => root.unmount());
  });

  it('rejects stale revisions and does not expose unselected saved targets', async () => {
    const savedAnalysis = createInitialAnalysis('https://example.com/saved');
    savedAnalysis.listing.identity.fullAddress = {
      value: '500 Saved Ave',
      source: 'user',
      confidence: 1,
    };
    const savedRecord = {
      schemaVersion: 1 as const,
      id: 'saved-1',
      url: 'https://example.com/saved',
      analysis: savedAnalysis,
      createdAt: '2026-09-20T12:00:00.000Z',
      updatedAt: '2026-09-21T12:00:00.000Z',
    };
    const updateSavedListing = vi.fn(async () => 'next-revision');
    const sendMessage = vi.fn(async (request: AssistantRequest) => ({
      schemaVersion: '1.0' as const,
      conversationId: 'conversation-saved-stale',
      messageId: 'message-saved-stale',
      contextRevision: request.contextRevision,
      message: { format: 'markdown' as const, text: 'Review these changes.' },
      proposals: [
        {
          id: 'stale-note',
          type: 'saved_listing.add_note' as const,
          explanation: 'Add a note.',
          contextRevision: 'saved-listings:older-context',
          arguments: { listingId: 'saved-1', text: 'Assigned parking.' },
        },
        {
          id: 'wrong-target',
          type: 'saved_listing.add_note' as const,
          explanation: 'Change an unselected listing.',
          contextRevision: request.contextRevision!,
          arguments: { listingId: 'saved-2', text: 'Unselected note.' },
        },
      ],
    }));
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AssistantView
          savedListings={[savedRecord]}
          selectedSavedListingIds={['saved-1']}
          navigate={vi.fn()}
          updateSavedListing={updateSavedListing}
          sendMessage={sendMessage}
          animateResponses={false}
        />,
      );
    });

    const composer = container.querySelector<HTMLTextAreaElement>('textarea')!;
    await act(async () => enter(composer, 'Keep a parking note'));
    await act(async () => {
      container
        .querySelector<HTMLFormElement>('.assistant-composer')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const applyButtons = Array.from(
      container.querySelectorAll('button'),
    ).filter((button) => button.textContent === 'Apply');
    expect(applyButtons).toHaveLength(1);
    expect(container.textContent).not.toContain('Unselected note.');
    await act(async () => {
      applyButtons[0].click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(updateSavedListing).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Stale');
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
      await new Promise((resolve) => setTimeout(resolve, 10));
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
      await new Promise((resolve) => setTimeout(resolve, 10));
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

  it('restores chat history until New chat clears it and starts a fresh backend conversation', async () => {
    const restoredResponse = {
      schemaVersion: '1.0',
      conversationId: 'conversation-old',
      messageId: 'assistant-old',
      message: {
        format: 'markdown',
        text: 'The **security deposit** may be refundable.',
      },
      proposals: [
        {
          id: 'search-old',
          type: 'search.patch',
          explanation: 'Use the saved search preference.',
          arguments: {
            set: { maxListedRent: 2_800 },
            clear: [],
          },
        },
      ],
    } satisfies AssistantResponse;
    let stored: StoredAssistantConversation = {
      schemaVersion: '1.0',
      conversationId: 'conversation-old',
      messages: [
        { id: 'user-old', role: 'user', text: 'What is the deposit?' },
        {
          id: 'assistant-old',
          role: 'assistant',
          text: restoredResponse.message.text,
          response: restoredResponse,
        },
      ],
      outcomes: [{ proposalId: 'search-old', status: 'applied' }],
      pendingOutcomes: [],
    };
    vi.mocked(extensionStorage.get).mockImplementation(async (key) =>
      key === 'assistantConversation' ? stored : undefined,
    );
    vi.mocked(extensionStorage.set).mockImplementation(async (key, value) => {
      if (key === 'assistantConversation')
        stored = value as StoredAssistantConversation;
    });
    let nextRequest: AssistantRequest | undefined;
    const sendMessage = vi.fn(async (request: AssistantRequest) => {
      nextRequest = request;
      return {
        schemaVersion: '1.0',
        conversationId: 'conversation-new',
        messageId: 'assistant-new',
        message: { format: 'markdown', text: 'Starting fresh.' },
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
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(container.textContent).toContain('What is the deposit?');
    expect(container.textContent).toContain(
      'The security deposit may be refundable.',
    );
    expect(container.textContent).toContain('Applied');
    expect(container.querySelector('.assistant-stream-cursor')).toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.new-chat')!.click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(stored).toEqual({
      schemaVersion: '1.0',
      messages: [],
      outcomes: [],
      pendingOutcomes: [],
    });
    expect(container.textContent).not.toContain('What is the deposit?');
    expect(container.querySelector('.assistant-starters')).not.toBeNull();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.assistant-starters button')!
        .click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(nextRequest).not.toHaveProperty('conversationId');
    await act(async () => root.unmount());
  });

  it('opens retained history as display-only and continues it with the current context', async () => {
    const analysis = setRecurringValue(
      createInitialAnalysis('https://example.com/current'),
      'advertisedRent',
      2_450,
    );
    analysis.propertyNotes.push({
      id: 'user-note-1',
      text: 'Ask whether parking is assigned.',
      source: 'user',
    });
    const listConversations = vi.fn(
      async () =>
        ({
          schemaVersion: '1.0',
          conversations: [
            {
              conversationId: 'conversation-history',
              title: 'Hidden fees',
              preview: 'The listing discloses a move-in fee.',
              createdAt: '2026-09-20T12:00:00.000Z',
              updatedAt: '2026-09-21T12:00:00.000Z',
              turnCount: 1,
            },
          ],
          nextCursor: null,
        }) satisfies AssistantConversationPage,
    );
    const getTurns = vi.fn(
      async () =>
        ({
          schemaVersion: '1.0',
          conversation: {
            conversationId: 'conversation-history',
            title: 'Hidden fees',
            createdAt: '2026-09-20T12:00:00.000Z',
            updatedAt: '2026-09-21T12:00:00.000Z',
          },
          turns: [
            {
              clientRequestId: 'request-history',
              createdAt: '2026-09-20T12:00:00.000Z',
              completedAt: '2026-09-20T12:00:01.000Z',
              userMessage: { text: 'Are there hidden fees?' },
              assistantMessage: {
                messageId: 'message-history',
                format: 'markdown',
                text: 'The listing shows a **$250 move-in fee**.',
              },
            },
          ],
          nextCursor: null,
        }) satisfies AssistantConversationTurnsPage,
    );
    let continuedRequest: AssistantRequest | undefined;
    const sendMessage = vi.fn(async (request: AssistantRequest) => {
      continuedRequest = request;
      return {
        schemaVersion: '1.0',
        conversationId: 'conversation-history',
        messageId: 'message-live',
        message: { format: 'markdown', text: 'Using the current inputs.' },
        proposals: [],
      } satisfies AssistantResponse;
    });
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AssistantView
          analysis={analysis}
          savedListings={[]}
          navigate={vi.fn()}
          sendMessage={sendMessage}
          historyApi={{
            listConversations,
            getTurns,
            deleteConversation: vi.fn(async () => undefined),
          }}
          animateResponses={false}
        />,
      );
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.chat-history-toggle')!
        .click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(container.textContent).toContain(
      'The listing discloses a move-in fee.',
    );
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.assistant-history-open')!
        .click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(container.textContent).toContain('Are there hidden fees?');
    expect(
      container.querySelector('.assistant-message.assistant strong')
        ?.textContent,
    ).toBe('$250 move-in fee');
    expect(container.textContent).not.toContain('Apply');
    expect(container.textContent).toContain(
      'Opening history does not restore old listing inputs.',
    );

    const composer = container.querySelector<HTMLTextAreaElement>('textarea')!;
    await act(async () => enter(composer, 'What about parking?'));
    await act(async () => {
      container
        .querySelector<HTMLFormElement>('.assistant-composer')!
        .dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(continuedRequest?.conversationId).toBe('conversation-history');
    expect(continuedRequest?.context?.currentCalculation).toMatchObject({
      advertisedRent: 2_450,
    });
    expect(continuedRequest?.context?.userNotes).toEqual([
      { id: 'user-note-1', text: 'Ask whether parking is assigned.' },
    ]);
    expect(continuedRequest?.context).toMatchObject({
      extractionNotes: [],
      reviewIssues: [],
    });
    expect(listConversations).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount());
  });

  it('paginates the conversation list and prepends older retained turns', async () => {
    const firstConversation = {
      conversationId: 'conversation-paged',
      title: 'Application costs',
      preview: 'The application fee is…',
      createdAt: '2026-09-20T12:00:00.000Z',
      updatedAt: '2026-09-27T12:00:00.000Z',
      turnCount: 2,
    };
    const listConversations = vi.fn(
      async ({ cursor }: { limit: number; cursor?: string }) =>
        ({
          schemaVersion: '1.0',
          conversations: cursor
            ? [
                {
                  ...firstConversation,
                  conversationId: 'conversation-older',
                  title: 'Older chat',
                },
              ]
            : [firstConversation],
          nextCursor: cursor ? null : 'conversation-cursor-2',
        }) satisfies AssistantConversationPage,
    );
    let threadHeight = 100;
    const getTurns = vi.fn(
      async (
        _conversationId: string,
        { cursor }: { limit: number; cursor?: string },
      ) => {
        if (cursor) threadHeight = 200;
        return {
          schemaVersion: '1.0',
          conversation: {
            conversationId: 'conversation-paged',
            title: 'Application costs',
            createdAt: '2026-09-20T12:00:00.000Z',
            updatedAt: '2026-09-27T12:00:00.000Z',
          },
          turns: cursor
            ? [
                {
                  clientRequestId: 'request-old',
                  createdAt: '2026-09-20T12:00:00.000Z',
                  completedAt: '2026-09-20T12:00:01.000Z',
                  userMessage: { text: 'What is the application fee?' },
                  assistantMessage: {
                    messageId: 'message-old',
                    format: 'markdown',
                    text: 'It is $40.',
                  },
                },
              ]
            : [
                {
                  clientRequestId: 'request-new',
                  createdAt: '2026-09-27T12:00:00.000Z',
                  completedAt: '2026-09-27T12:00:01.000Z',
                  userMessage: { text: 'Is there an admin fee?' },
                  assistantMessage: {
                    messageId: 'message-new',
                    format: 'markdown',
                    text: 'No admin fee is disclosed.',
                  },
                },
              ],
          nextCursor: cursor ? null : 'turn-cursor-2',
        } satisfies AssistantConversationTurnsPage;
      },
    );
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AssistantView
          savedListings={[]}
          navigate={vi.fn()}
          historyApi={{
            listConversations,
            getTurns,
            deleteConversation: vi.fn(async () => undefined),
          }}
          animateResponses={false}
        />,
      );
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.chat-history-toggle')!
        .click();
      await Promise.resolve();
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.assistant-history-more')!
        .click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Older chat');
    expect(listConversations).toHaveBeenLastCalledWith({
      limit: 20,
      cursor: 'conversation-cursor-2',
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.assistant-history-open')!
        .click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Is there an admin fee?');
    const thread = container.querySelector<HTMLElement>('.assistant-thread')!;
    Object.defineProperty(thread, 'scrollHeight', {
      configurable: true,
      get: () => threadHeight,
    });
    thread.scrollTop = 35;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.assistant-older-turns')!
        .click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const userMessages = Array.from(
      container.querySelectorAll('.assistant-message.user'),
    ).map((message) => message.textContent);
    expect(userMessages).toEqual([
      expect.stringContaining('What is the application fee?'),
      expect.stringContaining('Is there an admin fee?'),
    ]);
    expect(getTurns).toHaveBeenLastCalledWith('conversation-paged', {
      limit: 20,
      cursor: 'turn-cursor-2',
    });
    expect(thread.scrollTop).toBe(135);
    await act(async () => root.unmount());
  });

  it('removes expired conversations and confirms deletion before clearing the active chat', async () => {
    const summaries: AssistantConversationPage = {
      schemaVersion: '1.0',
      conversations: [
        {
          conversationId: 'conversation-delete',
          title: 'Delete me',
          preview: 'Temporary chat',
          createdAt: '2026-09-20T12:00:00.000Z',
          updatedAt: '2026-09-20T12:00:00.000Z',
          turnCount: 1,
        },
        {
          conversationId: 'conversation-expired',
          title: 'Expired chat',
          preview: 'Old chat',
          createdAt: '2026-08-01T12:00:00.000Z',
          updatedAt: '2026-08-01T12:00:00.000Z',
          turnCount: 1,
        },
      ],
      nextCursor: null,
    };
    const getTurns = vi.fn(async (conversationId: string) => {
      if (conversationId === 'conversation-expired')
        throw new BackendRequestError('Not found.', 404);
      return {
        schemaVersion: '1.0',
        conversation: {
          conversationId,
          title: 'Delete me',
          createdAt: '2026-09-20T12:00:00.000Z',
          updatedAt: '2026-09-20T12:00:00.000Z',
        },
        turns: [
          {
            clientRequestId: 'request-delete',
            createdAt: '2026-09-20T12:00:00.000Z',
            completedAt: '2026-09-20T12:00:01.000Z',
            userMessage: { text: 'Can I delete this?' },
            assistantMessage: {
              messageId: 'message-delete',
              format: 'markdown',
              text: 'Yes.',
            },
          },
        ],
        nextCursor: null,
      } satisfies AssistantConversationTurnsPage;
    });
    const deleteConversation = vi.fn(async () => undefined);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AssistantView
          savedListings={[]}
          navigate={vi.fn()}
          historyApi={{
            listConversations: vi.fn(async () => summaries),
            getTurns,
            deleteConversation,
          }}
          animateResponses={false}
        />,
      );
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.chat-history-toggle')!
        .click();
      await Promise.resolve();
    });
    const expiredOpen = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.assistant-history-open'),
    ).find((button) => button.textContent?.includes('Expired chat'))!;
    await act(async () => {
      expiredOpen.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('may have expired after 30 days');
    expect(container.textContent).not.toContain('Expired chat');

    const deleteOpen = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.assistant-history-open'),
    ).find((button) => button.textContent?.includes('Delete me'))!;
    await act(async () => {
      deleteOpen.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Can I delete this?');
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.chat-history-toggle')!
        .click();
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('.assistant-history-delete')!
        .click();
    });
    expect(container.textContent).toContain('Delete this conversation?');
    expect(deleteConversation).not.toHaveBeenCalled();
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '.assistant-delete-confirmation button',
        )!
        .click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(deleteConversation).toHaveBeenCalledWith('conversation-delete');
    expect(container.textContent).not.toContain('Can I delete this?');
    expect(container.querySelector('.assistant-starters')).not.toBeNull();
    await act(async () => root.unmount());
  });
});
