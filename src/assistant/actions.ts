import type { RecurringCosts, UpfrontCosts } from '../calculations';
import {
  clearField,
  setConcessionValue,
  setIdentityValue,
  setRecurringValue,
  setUpfrontValue,
  setUtilityIncluded,
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
  if (proposal.type === 'saved_listing.set_field') {
    const { field, value } = proposal.arguments;
    const [group, key] = field.split('.');
    if (group === 'identity')
      return setIdentityValue(
        analysis,
        key as Parameters<typeof setIdentityValue>[1],
        value as never,
      );
    if (group === 'recurring')
      return setRecurringValue(analysis, 'advertisedRent', value as number);
    if (group === 'concessions')
      return setConcessionValue(
        analysis,
        key as Parameters<typeof setConcessionValue>[1],
        value as number,
      );
    if (group === 'utilityIncluded')
      return setUtilityIncluded(
        analysis,
        key as Parameters<typeof setUtilityIncluded>[1],
        value as boolean,
      );
    const next = structuredClone(analysis);
    if (field === 'laundryType')
      next.laundryType = value as typeof next.laundryType;
    else if (group === 'paidLaundry')
      next.paidLaundry[key as keyof typeof next.paidLaundry] = value as number;
    else throw new Error('Unsupported saved-listing field.');
    next.updatedAt = new Date().toISOString();
    return next;
  }
  if (proposal.type === 'saved_listing.clear_field') {
    const [group, key] = proposal.arguments.field.split('.');
    return clearField(
      analysis,
      group as 'identity' | 'recurring' | 'upfront' | 'concessions',
      key,
    );
  }
  if (
    proposal.type === 'saved_listing.add_custom_fee' ||
    proposal.type === 'saved_listing.update_custom_fee' ||
    proposal.type === 'saved_listing.remove_custom_fee'
  ) {
    const next = structuredClone(analysis);
    const key =
      proposal.arguments.cadence === 'monthly'
        ? 'customRecurringFees'
        : 'customOneTimeFees';
    const fees = next[key];
    if (proposal.type === 'saved_listing.add_custom_fee') {
      const id = `assistant-${proposal.id}`;
      next[key] = [
        ...fees.filter((fee) => fee.id !== id),
        {
          id,
          label: proposal.arguments.label,
          amount: proposal.arguments.amount,
        },
      ];
    } else {
      const index = fees.findIndex(
        (fee) => fee.id === proposal.arguments.feeId,
      );
      if (index < 0) throw new Error('The custom fee is no longer available.');
      next[key] =
        proposal.type === 'saved_listing.remove_custom_fee'
          ? fees.filter((fee) => fee.id !== proposal.arguments.feeId)
          : fees.map((fee) =>
              fee.id === proposal.arguments.feeId
                ? {
                    ...fee,
                    label: proposal.arguments.label,
                    amount: proposal.arguments.amount,
                  }
                : fee,
            );
    }
    next.updatedAt = new Date().toISOString();
    return next;
  }
  if (proposal.type === 'saved_listing.remove_note') {
    if (
      !analysis.propertyNotes.some(
        (note) => note.id === proposal.arguments.noteId,
      )
    )
      throw new Error('The property note is no longer available.');
    const next = structuredClone(analysis);
    next.propertyNotes = next.propertyNotes.filter(
      (note) => note.id !== proposal.arguments.noteId,
    );
    next.updatedAt = new Date().toISOString();
    return next;
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
  const analysis = compactAnalysisForStorage(
    applySavedListingProposalToAnalysis(existing.analysis, proposal),
  );
  const nextUrl = analysis.listing.identity.url?.value ?? existing.url;
  if (
    nextUrl !== existing.url &&
    records.some((record) => record.id !== listingId && record.url === nextUrl)
  )
    throw new Error('Another saved listing already uses this URL.');
  const record: SavedListingRecord = {
    ...existing,
    analysis,
    url: nextUrl,
    updatedAt,
  };
  return {
    records: records.map((item) => (item.id === listingId ? record : item)),
    record,
  };
}
