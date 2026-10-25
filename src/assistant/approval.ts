import type { HouseholdProfile } from '../shared/household';
import { materializeListing, type RentalAnalysis } from '../shared/analysis';
import type { SavedListingRecord } from '../saved';
import {
  applyHouseholdPetFilters,
  SEARCH_SITE_ADAPTERS,
  SEARCH_CRITERION_LABELS,
  type RentalSearch,
} from '../search';
import type { AssistantProposal } from './types';

export interface ApprovalState {
  search: RentalSearch;
  household: HouseholdProfile;
  analysis?: RentalAnalysis;
  savedListings: SavedListingRecord[];
  selectedIds: string[];
}
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
const pick = (value: object, keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, Reflect.get(value, key) ?? null]));

export function approvalValue(
  proposal: AssistantProposal,
  state: ApprovalState,
): unknown {
  if (proposal.type === 'workspace.navigate') return null;
  if (proposal.type === 'household.patch')
    return pick(state.household, Object.keys(proposal.arguments.set));
  if (proposal.type === 'search.patch')
    return pick(state.search, [
      ...new Set([
        ...Object.keys(proposal.arguments.set),
        ...proposal.arguments.clear,
        ...([
          ...Object.keys(proposal.arguments.set),
          ...proposal.arguments.clear,
        ].some((key) => key === 'minListedRent' || key === 'maxListedRent')
          ? ['minListedRent', 'maxListedRent']
          : []),
      ]),
    ]);
  if (proposal.type === 'search.launch')
    return { search: state.search, household: state.household };
  const saved = proposal.type.startsWith('saved_listing.');
  const id =
    'listingId' in proposal.arguments
      ? proposal.arguments.listingId
      : undefined;
  const record = saved
    ? state.savedListings.find(
        (item) => item.id === id && state.selectedIds.includes(item.id),
      )
    : undefined;
  const analysis = saved ? record?.analysis : state.analysis;
  if (!analysis) return { missing: true };
  const listing = materializeListing(analysis);
  const identity = record
    ? { id: record.id }
    : { url: analysis.listing.identity.url?.value };
  const args = proposal.arguments;
  if ('category' in args)
    return {
      ...identity,
      value:
        args.frequency === 'monthly'
          ? listing.recurring[args.category as keyof typeof listing.recurring]
          : listing.upfront[args.category as keyof typeof listing.upfront],
    };
  if ('field' in args) {
    const [group, key] = args.field.split('.');
    const container = [
      'identity',
      'recurring',
      'upfront',
      'concessions',
    ].includes(group)
      ? Reflect.get(listing, group)
      : Reflect.get(analysis, group);
    return {
      ...identity,
      value: key ? container?.[key] : container,
      cleared: analysis.userClearedFields.includes(args.field),
    };
  }
  if ('feeId' in args)
    return {
      ...identity,
      fee: (args.cadence === 'monthly'
        ? analysis.customRecurringFees
        : analysis.customOneTimeFees
      ).find((fee) => fee.id === args.feeId),
    };
  if ('noteId' in args)
    return {
      ...identity,
      note: analysis.propertyNotes.find((note) => note.id === args.noteId),
    };
  return identity; // Additive notes/fees do not overwrite existing fields.
}

export async function approvalFingerprint(
  proposal: AssistantProposal,
  state: ApprovalState,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(stable(approvalValue(proposal, state))),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

const names: Record<string, string> = {
  occupants: 'Occupants',
  cats: 'Cats',
  smallDogs: 'Small dogs',
  largeDogs: 'Large dogs',
  apartment_condo: 'Apartment or condo',
  house: 'House',
  townhouse: 'Townhouse',
  find: 'Search',
  current: 'Current',
  saved: 'Saved',
  compare: 'Compare',
};
const format = (value: unknown): string =>
  value === undefined
    ? 'No preference'
    : Array.isArray(value)
      ? value.map(format).join(', ')
      : value === true
        ? 'Required'
        : (names[String(value)] ?? String(value));
export function approvalSummary(
  proposal: AssistantProposal,
  state: ApprovalState,
): string | undefined {
  if (proposal.type === 'household.patch' || proposal.type === 'search.patch') {
    const before =
      proposal.type === 'household.patch' ? state.household : state.search;
    const entries: Array<[string, unknown]> = Object.entries(
      proposal.arguments.set,
    );
    if (proposal.type === 'search.patch')
      entries.push(
        ...proposal.arguments.clear.map(
          (key) => [key, undefined] as [string, undefined],
        ),
      );
    return entries
      .map(
        ([key, value]) =>
          `${names[key] ?? SEARCH_CRITERION_LABELS[key as keyof RentalSearch] ?? key}: ${format(Reflect.get(before, key))} → ${format(value)}`,
      )
      .join(' · ');
  }
  if (proposal.type === 'workspace.navigate')
    return `Open ${names[proposal.arguments.destination]}.`;
  if (proposal.type === 'search.launch') {
    const search = applyHouseholdPetFilters(state.search, state.household);
    return (
      proposal.arguments.siteIds
        .map((id) => {
          const site = SEARCH_SITE_ADAPTERS.find((item) => item.id === id);
          if (!site) return 'Unsupported rental site';
          const result = site.buildLink(search);
          if (result.status !== 'ready')
            return `${site.name}: ${result.reason}`;
          const labels = (keys: Array<keyof RentalSearch>) =>
            keys.map((key) => SEARCH_CRITERION_LABELS[key]).join(', ') ||
            'none';
          return `${site.name} — supported: ${labels(result.link.applied)}; check on site: ${labels(result.link.omitted)}.`;
        })
        .join(' ') +
      ' Uses saved preferences. Household counts stay in RentSight. Site access may be needed to apply supported filters.'
    );
  }
}
