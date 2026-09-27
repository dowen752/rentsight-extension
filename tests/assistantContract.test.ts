import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_COST_FREQUENCIES,
  acceptAssistantProposal,
  acceptAssistantResponse,
  applyCostProposal,
  type EditableCostCategory,
  type SetCostProposal,
} from '../src/assistant';
import { createInitialAnalysis } from '../src/shared/analysis';

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
