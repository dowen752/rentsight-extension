import { normalizeRentalSearch, type SearchCriterion } from '../search';
import {
  ASSISTANT_COST_FREQUENCIES,
  type AssistantProposal,
  type AssistantResponse,
} from './types';

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

const SEARCH_KEYS = new Set<SearchCriterion>([
  'location',
  'minListedRent',
  'maxListedRent',
  'minBedrooms',
  'minBathrooms',
  'propertyTypes',
  'catsAllowed',
  'smallDogsAllowed',
  'largeDogsAllowed',
  'moveInDate',
  'minSquareFeet',
  'parkingAvailable',
  'inUnitLaundry',
  'airConditioning',
]);

const proposalBase = (value: Record<string, unknown>) =>
  text(value.id, 200) && text(value.explanation, 500);

export function acceptAssistantProposal(
  value: unknown,
): AssistantProposal | undefined {
  if (!object(value) || !proposalBase(value) || !object(value.arguments))
    return undefined;
  const args = value.arguments;
  if (value.type === 'search.patch') {
    if (!object(args.set) || !Array.isArray(args.clear)) return undefined;
    const normalized = normalizeRentalSearch(args.set);
    if (
      normalized.issues.length ||
      Object.keys(args.set).some(
        (key) => !SEARCH_KEYS.has(key as SearchCriterion),
      ) ||
      args.clear.some(
        (key) =>
          typeof key !== 'string' || !SEARCH_KEYS.has(key as SearchCriterion),
      )
    )
      return undefined;
    return {
      id: value.id as string,
      type: 'search.patch',
      explanation: value.explanation as string,
      arguments: {
        set: normalized.search,
        clear: [...new Set(args.clear as SearchCriterion[])],
      },
    };
  }
  if (value.type === 'analysis.set_cost') {
    if (
      typeof args.category !== 'string' ||
      !Object.hasOwn(ASSISTANT_COST_FREQUENCIES, args.category) ||
      typeof args.amount !== 'number' ||
      !Number.isFinite(args.amount) ||
      args.amount < 0 ||
      args.currency !== 'USD' ||
      !['monthly', 'one_time'].includes(String(args.frequency))
    )
      return undefined;
    const expectedFrequency =
      ASSISTANT_COST_FREQUENCIES[
        args.category as keyof typeof ASSISTANT_COST_FREQUENCIES
      ];
    if (expectedFrequency !== args.frequency) return undefined;
    return value as unknown as AssistantProposal;
  }
  if (value.type === 'property_note.add') {
    if (!text(args.text, 500)) return undefined;
    return value as unknown as AssistantProposal;
  }
  if (value.type === 'workspace.navigate') {
    if (
      !['find', 'current', 'saved', 'compare'].includes(
        String(args.destination),
      )
    )
      return undefined;
    return value as unknown as AssistantProposal;
  }
  return undefined;
}

export function acceptAssistantResponse(
  value: unknown,
): AssistantResponse | undefined {
  if (
    !object(value) ||
    value.schemaVersion !== '1.0' ||
    !text(value.conversationId, 200) ||
    !text(value.messageId, 200) ||
    !object(value.message) ||
    value.message.format !== 'markdown' ||
    !text(value.message.text, 20_000) ||
    !Array.isArray(value.proposals)
  )
    return undefined;
  const proposals = value.proposals
    .map(acceptAssistantProposal)
    .filter(
      (proposal): proposal is AssistantProposal => proposal !== undefined,
    );
  const citations = Array.isArray(value.citations)
    ? value.citations.filter(
        (citation) =>
          object(citation) &&
          text(citation.id, 200) &&
          text(citation.title, 500) &&
          (citation.url === undefined ||
            (typeof citation.url === 'string' &&
              /^https:\/\//.test(citation.url))),
      )
    : undefined;
  return {
    schemaVersion: '1.0',
    conversationId: value.conversationId,
    messageId: value.messageId,
    contextRevision:
      typeof value.contextRevision === 'string'
        ? value.contextRevision
        : undefined,
    message: { format: 'markdown', text: value.message.text },
    proposals,
    citations: citations as AssistantResponse['citations'],
    followUpSuggestions: Array.isArray(value.followUpSuggestions)
      ? value.followUpSuggestions.filter((item) => text(item, 300)).slice(0, 4)
      : undefined,
  };
}
