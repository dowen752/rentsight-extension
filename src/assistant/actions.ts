import type { RecurringCosts, UpfrontCosts } from '../calculations';
import {
  setRecurringValue,
  setUpfrontValue,
  type RentalAnalysis,
} from '../shared/analysis';
import { compactAnalysisForStorage } from '../saved/repository';
import type { SavedListingRecord } from '../saved/types';
import {
  ASSISTANT_COST_FREQUENCIES,
  type SavedListingProposal,
  type SetCostProposal,
} from './types';

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

export function applySavedListingProposalToAnalysis(
  analysis: RentalAnalysis,
  proposal: SavedListingProposal,
): RentalAnalysis {
  if (proposal.type === 'saved_listing.set_cost') {
    return applyCostProposal(analysis, {
      id: proposal.id,
      type: 'analysis.set_cost',
      explanation: proposal.explanation,
      arguments: {
        category: proposal.arguments.category,
        amount: proposal.arguments.amount,
        currency: proposal.arguments.currency,
        frequency: proposal.arguments.frequency,
      },
    } as SetCostProposal);
  }
  return addAssistantPropertyNote(
    analysis,
    proposal.id,
    proposal.arguments.text,
  );
}

export function applySavedListingProposal(
  records: readonly SavedListingRecord[],
  proposal: SavedListingProposal,
): { records: SavedListingRecord[]; record: SavedListingRecord } {
  const listingId = proposal.arguments.listingId;
  const existing = records.find((record) => record.id === listingId);
  if (!existing) throw new Error('The saved listing is no longer available.');

  const parsedUpdatedAt = Date.parse(existing.updatedAt);
  const updatedAt = new Date(
    Math.max(
      Date.now(),
      Number.isFinite(parsedUpdatedAt) ? parsedUpdatedAt + 1 : 0,
    ),
  ).toISOString();
  const record: SavedListingRecord = {
    ...existing,
    analysis: compactAnalysisForStorage(
      applySavedListingProposalToAnalysis(existing.analysis, proposal),
    ),
    updatedAt,
  };
  return {
    records: records.map((item) => (item.id === listingId ? record : item)),
    record,
  };
}
