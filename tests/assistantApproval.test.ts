import { describe, expect, it } from 'vitest';
import {
  approvalFingerprint,
  approvalSummary,
  assistantContextForAnalysis,
  applyCostProposal,
  applySavedListingProposal,
  acceptAssistantProposal,
  type ApprovalState,
  type AssistantProposal,
} from '../src/assistant';
import {
  createInitialAnalysis,
  applyHouseholdProfile,
  setRecurringValue,
} from '../src/shared/analysis';
import { createComparison } from '../src/saved/comparison';
import { applyHouseholdPetFilters } from '../src/search';

const household = { occupants: 2, cats: 1, smallDogs: 0, largeDogs: 0 };
function state(): ApprovalState {
  return {
    search: { location: 'Cupertino', maxListedRent: 3700 },
    household: { ...household },
    analysis: createInitialAnalysis('https://example.com/current'),
    savedListings: [],
    selectedIds: [],
  };
}
const cost = (
  id: string,
  category: 'electricity' | 'water',
): AssistantProposal => ({
  id,
  type: 'analysis.set_cost',
  explanation: 'Change expense.',
  arguments: { category, amount: 100, currency: 'USD', frequency: 'monthly' },
});

describe('assistant approvals against redesigned Search and household', () => {
  it('allows unrelated sibling changes but rejects an edit whose actual target value changed', async () => {
    const original = state();
    const electricity = cost('electricity', 'electricity');
    const water = cost('water', 'water');
    const waterRevision = await approvalFingerprint(water, original);
    const next = {
      ...original,
      analysis: applyCostProposal(
        original.analysis!,
        electricity as Parameters<typeof applyCostProposal>[1],
      ),
    };
    expect(await approvalFingerprint(water, next)).toBe(waterRevision);
    next.analysis = setRecurringValue(next.analysis, 'water', 200);
    expect(await approvalFingerprint(water, next)).not.toBe(waterRevision);
  });
  it('guards search separately from listing edits and checks both rent bounds', async () => {
    const patch: AssistantProposal = {
      id: 's',
      type: 'search.patch',
      explanation: 'Set budget.',
      arguments: { set: { maxListedRent: 3200 }, clear: [] },
    };
    const original = state();
    const revision = await approvalFingerprint(patch, original);
    expect(
      await approvalFingerprint(patch, {
        ...original,
        analysis: setRecurringValue(original.analysis!, 'water', 100),
      }),
    ).toBe(revision);
    expect(
      await approvalFingerprint(patch, {
        ...original,
        search: { ...original.search, minListedRent: 3500 },
      }),
    ).not.toBe(revision);
    expect(
      await approvalFingerprint(patch, {
        ...original,
        search: { ...original.search, maxListedRent: 3500 },
      }),
    ).not.toBe(revision);
  });
  it('prevents a site approval from launching different preferences and previews omitted filters', async () => {
    const launch: AssistantProposal = {
      id: 'open',
      type: 'search.launch',
      explanation: 'Open Zillow.',
      arguments: { siteIds: ['zillow'] },
    };
    const original = state();
    const revision = await approvalFingerprint(launch, original);
    expect(
      await approvalFingerprint(launch, {
        ...original,
        household: { ...household, cats: 0 },
      }),
    ).not.toBe(revision);
    const preview = approvalSummary(launch, original)!;
    expect(preview).toContain('Zillow');
    expect(preview).toContain('supported:');
    expect(preview).toContain('check on site:');
    expect(preview).toContain('Household counts stay in RentSight');
    expect(applyHouseholdPetFilters(original.search, household)).toMatchObject({
      catsAllowed: true,
    });
  });
  it('shows concrete changes and preserves untouched household counts', () => {
    const patch: AssistantProposal = {
      id: 'h',
      type: 'household.patch',
      explanation: 'Update household.',
      arguments: { set: { occupants: 3 } },
    };
    expect(approvalSummary(patch, state())).toBe('Occupants: 2 → 3');
  });
  it('uses the same current household calculations as Saved/Compare without rewriting saved facts', () => {
    const analysis = createInitialAnalysis('https://example.com/saved');
    const record = {
      schemaVersion: 1 as const,
      id: 'saved',
      url: 'https://example.com/saved',
      analysis,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };
    const before = structuredClone(record);
    const context = assistantContextForAnalysis(
      undefined,
      [record],
      ['saved'],
      household,
      { location: 'Cupertino' },
    );
    const snapshot = context.selectedListings![0];
    expect(snapshot.calculation).toMatchObject({
      estimatedTrueMonthlyCost: createComparison(record, household)
        .trueMonthlyCost,
      inputs: { occupants: 2, householdProfile: household },
    });
    expect(context).toMatchObject({
      household,
      search: { location: 'Cupertino' },
    });
    expect(record).toEqual(before);
    expect(applyHouseholdProfile(analysis, household).occupants).toBe(2);
  });
  it('keeps independent saved-listing edits actionable after the first record write', async () => {
    const original = state();
    const record = {
      schemaVersion: 1 as const,
      id: 'saved',
      url: 'https://example.com/saved',
      analysis: original.analysis!,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };
    original.savedListings = [record];
    original.selectedIds = ['saved'];
    const rent = {
      id: 'rent',
      type: 'saved_listing.set_field' as const,
      explanation: 'Correct rent.',
      contextRevision: 'original',
      arguments: {
        listingId: 'saved',
        field: 'recurring.advertisedRent' as const,
        value: 2400,
      },
    };
    const water = {
      id: 'water',
      type: 'saved_listing.set_cost' as const,
      explanation: 'Correct water.',
      contextRevision: 'original',
      arguments: {
        listingId: 'saved',
        category: 'water' as const,
        amount: 70,
        currency: 'USD' as const,
        frequency: 'monthly' as const,
      },
    };
    const before = await approvalFingerprint(water, original);
    const changed = {
      ...original,
      savedListings: applySavedListingProposal(original.savedListings, rent)
        .records,
    };
    expect(await approvalFingerprint(water, changed)).toBe(before);
    expect(
      await approvalFingerprint(water, { ...changed, selectedIds: [] }),
    ).not.toBe(before);
  });
  it('allows a location approval after an unrelated budget change', async () => {
    const location = {
      id: 'location',
      type: 'search.patch' as const,
      explanation: 'Move search.',
      arguments: { set: { location: 'Pasadena' }, clear: [] },
    };
    const original = state();
    expect(
      await approvalFingerprint(location, {
        ...original,
        search: { ...original.search, maxListedRent: 3200 },
      }),
    ).toBe(await approvalFingerprint(location, original));
  });
  it('rejects direct pet flags and silent no-op preference payloads at the frontend boundary', () => {
    for (const set of [
      { catsAllowed: true },
      { inUnitLaundry: false },
      { location: '' },
      { propertyTypes: [] },
      { propertyTypes: ['house', 'house'] },
    ]) {
      expect(
        acceptAssistantProposal({
          id: 'bad',
          type: 'search.patch',
          explanation: 'Change search.',
          arguments: { set, clear: [] },
        }),
      ).toBeUndefined();
    }
  });
});
