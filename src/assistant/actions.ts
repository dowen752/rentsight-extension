import type { RecurringCosts, UpfrontCosts } from '../calculations';
import {
  setRecurringValue,
  setUpfrontValue,
  type RentalAnalysis,
} from '../shared/analysis';
import { ASSISTANT_COST_FREQUENCIES, type SetCostProposal } from './types';

export function applyCostProposal(
  analysis: RentalAnalysis,
  proposal: SetCostProposal,
): RentalAnalysis {
  const { category, amount, frequency } = proposal.arguments;
  if (ASSISTANT_COST_FREQUENCIES[category] !== frequency)
    throw new Error('Cost proposal frequency does not match its category.');
  return frequency === 'monthly'
    ? setRecurringValue(analysis, category as keyof RecurringCosts, amount)
    : setUpfrontValue(analysis, category as keyof UpfrontCosts, amount);
}

export function addAssistantPropertyNote(
  analysis: RentalAnalysis,
  proposalId: string,
  text: string,
): RentalAnalysis {
  const next = structuredClone(analysis);
  next.propertyNotes = [
    ...next.propertyNotes.filter((note) => note.sourceId !== proposalId),
    {
      id: `assistant-${proposalId}`,
      text,
      source: 'ai',
      sourceId: proposalId,
    },
  ];
  next.updatedAt = new Date().toISOString();
  return next;
}
