import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_COST_FREQUENCIES,
  acceptAssistantProposal,
  acceptAssistantResponse,
  applyCostProposal,
  applySavedListingProposal,
  applySavedListingProposalToAnalysis,
  type EditableCostCategory,
  type SavedListingAddNoteProposal,
  type SavedListingSetCostProposal,
  type SetCostProposal,
} from '../src/assistant';
import {
  createInitialAnalysis,
  setIdentityValue,
} from '../src/shared/analysis';

const proposal = (
  category: EditableCostCategory,
  frequency: 'monthly' | 'one_time',
) => ({
  id: `cost-${category}`,
  type: 'analysis.set_cost',
  explanation: `Set ${category}.`,
  arguments: { category, amount: 125, currency: 'USD', frequency },
});

describe('assistant contract', () => {
  it('accepts and applies every cost category with its shared frequency', () => {
    for (const [category, frequency] of Object.entries(
      ASSISTANT_COST_FREQUENCIES,
    )) {
      const accepted = acceptAssistantProposal(
        proposal(category as EditableCostCategory, frequency),
      );
      expect(accepted?.type).toBe('analysis.set_cost');
      const analysis = applyCostProposal(
        createInitialAnalysis(`https://example.com/${category}`),
        accepted as SetCostProposal,
      );
      const group = frequency === 'monthly' ? 'recurring' : 'upfront';
      expect(analysis.listing[group]).toMatchObject({
        [category]: { value: 125, source: 'user' },
      });
    }
  });

  it('rejects every cost category when paired with the wrong frequency', () => {
    for (const [category, frequency] of Object.entries(
      ASSISTANT_COST_FREQUENCIES,
    )) {
      const wrong = frequency === 'monthly' ? 'one_time' : 'monthly';
      expect(
        acceptAssistantProposal(
          proposal(category as EditableCostCategory, wrong),
        ),
      ).toBeUndefined();
    }
  });

  it('accepts assistant messages above 4,000 and through 20,000 characters', () => {
    for (const length of [4_001, 20_000]) {
      expect(
        acceptAssistantResponse({
          schemaVersion: '1.0',
          conversationId: 'conversation-1',
          messageId: `message-${length}`,
          message: { format: 'markdown', text: 'a'.repeat(length) },
          proposals: [],
        })?.message.text,
      ).toHaveLength(length);
    }
    expect(
      acceptAssistantResponse({
        schemaVersion: '1.0',
        conversationId: 'conversation-1',
        messageId: 'message-too-long',
        message: { format: 'markdown', text: 'a'.repeat(20_001) },
        proposals: [],
      }),
    ).toBeUndefined();
  });

  it('rejects proposal explanations and property notes above 500 characters', () => {
    expect(
      acceptAssistantProposal({
        ...proposal('parking', 'monthly'),
        explanation: 'a'.repeat(501),
      }),
    ).toBeUndefined();
    expect(
      acceptAssistantProposal({
        id: 'note-1',
        type: 'property_note.add',
        explanation: 'Keep this note.',
        arguments: { text: 'a'.repeat(501) },
      }),
    ).toBeUndefined();
    expect(
      acceptAssistantProposal({
        id: 'note-2',
        type: 'property_note.add',
        explanation: 'a'.repeat(500),
        arguments: { text: 'a'.repeat(500) },
      }),
    ).toBeDefined();
  });

  it('accepts closed, revision-bound saved-listing proposals', () => {
    const cost = acceptAssistantProposal({
      id: 'saved-cost-1',
      type: 'saved_listing.set_cost',
      explanation: 'Update parking.',
      contextRevision: 'saved-listings:saved-1:revision-1',
      arguments: {
        listingId: 'saved-1',
        category: 'parking',
        amount: 100,
        currency: 'USD',
        frequency: 'monthly',
      },
    });
    const note = acceptAssistantProposal({
      id: 'saved-note-1',
      type: 'saved_listing.add_note',
      explanation: 'Keep the parking restriction.',
      contextRevision: 'saved-listings:saved-1:revision-1',
      arguments: {
        listingId: 'saved-1',
        text: 'Parking is limited to one assigned space.',
      },
    });

    expect(cost?.type).toBe('saved_listing.set_cost');
    expect(note?.type).toBe('saved_listing.add_note');
  });

  it('rejects malformed or overly broad saved-listing proposals', () => {
    const validCost = {
      id: 'saved-cost-1',
      type: 'saved_listing.set_cost',
      explanation: 'Update parking.',
      contextRevision: 'saved-listings:saved-1:revision-1',
      arguments: {
        listingId: 'saved-1',
        category: 'parking',
        amount: 100,
        currency: 'USD',
        frequency: 'monthly',
      },
    };
    expect(
      acceptAssistantProposal({ ...validCost, contextRevision: undefined }),
    ).toBeUndefined();
    expect(
      acceptAssistantProposal({
        ...validCost,
        arguments: { ...validCost.arguments, amount: 1_000_001 },
      }),
    ).toBeUndefined();
    expect(
      acceptAssistantProposal({
        ...validCost,
        arguments: { ...validCost.arguments, extra: true },
      }),
    ).toBeUndefined();
    expect(
      acceptAssistantProposal({
        id: 'saved-note-1',
        type: 'saved_listing.add_note',
        explanation: 'Keep a note.',
        contextRevision: 'saved-listings:saved-1:revision-1',
        arguments: { listingId: 'saved-1', text: '   ' },
      }),
    ).toBeUndefined();
  });

  it('updates only the targeted saved record and can synchronize its analysis', () => {
    const firstAnalysis = setIdentityValue(
      createInitialAnalysis('https://example.com/saved-1'),
      'fullAddress',
      '100 First Ave',
    );
    const secondAnalysis = createInitialAnalysis('https://example.com/saved-2');
    const records = [
      {
        schemaVersion: 1 as const,
        id: 'saved-1',
        url: 'https://example.com/saved-1',
        analysis: firstAnalysis,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        schemaVersion: 1 as const,
        id: 'saved-2',
        url: 'https://example.com/saved-2',
        analysis: secondAnalysis,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ];
    const proposal: SavedListingSetCostProposal = {
      id: 'saved-cost-1',
      type: 'saved_listing.set_cost',
      explanation: 'Update parking.',
      contextRevision: 'saved-listings:saved-1:revision-1',
      arguments: {
        listingId: 'saved-1',
        category: 'parking',
        amount: 100,
        currency: 'USD',
        frequency: 'monthly',
      },
    };

    const result = applySavedListingProposal(records, proposal);
    expect(result.record.analysis.listing.recurring.parking).toMatchObject({
      value: 100,
      source: 'user',
    });
    expect(result.records[1]).toBe(records[1]);
    expect(result.record.updatedAt).not.toBe(records[0].updatedAt);
    expect(
      applySavedListingProposalToAnalysis(firstAnalysis, proposal).listing
        .recurring.parking,
    ).toMatchObject({ value: 100, source: 'user' });

    const noteProposal: SavedListingAddNoteProposal = {
      id: 'saved-note-1',
      type: 'saved_listing.add_note',
      explanation: 'Keep a note.',
      contextRevision: 'saved-listings:saved-1:revision-2',
      arguments: { listingId: 'saved-1', text: 'One assigned space.' },
    };
    const once = applySavedListingProposal(result.records, noteProposal);
    const twice = applySavedListingProposal(once.records, noteProposal);
    expect(twice.record.analysis.propertyNotes).toHaveLength(1);
  });

  it('ignores unknown proposals without discarding valid assistant text', () => {
    const accepted = acceptAssistantResponse({
      schemaVersion: '1.0',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      message: { format: 'markdown', text: 'The answer remains useful.' },
      proposals: [
        {
          id: 'launch-1',
          type: 'search.launch',
          explanation: 'Open a search.',
          arguments: { siteIds: ['zillow'] },
        },
      ],
    });
    expect(accepted?.message.text).toBe('The answer remains useful.');
    expect(accepted?.proposals).toEqual([]);
  });
});
