import { normalizeRentalSearch, type SearchCriterion } from '../search';
import {
  ASSISTANT_COST_FREQUENCIES,
  type AssistantConversationPage,
  type AssistantConversationTurnsPage,
  type AssistantHistoryTurn,
  type AssistantProposal,
  type AssistantResponse,
  type StoredAssistantConversation,
  type StoredAssistantMessage,
} from './types';

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

const nullableCursor = (value: unknown): value is string | null =>
  value === null || text(value, 2_000);

const timestamp = (value: unknown): value is string =>
  text(value, 100) && Number.isFinite(Date.parse(value));

const conversationIdentity = (value: unknown) =>
  object(value) &&
  text(value.conversationId, 200) &&
  text(value.title, 500) &&
  timestamp(value.createdAt) &&
  timestamp(value.updatedAt);

export function isAssistantConversationPage(
  value: unknown,
): value is AssistantConversationPage {
  return (
    object(value) &&
    value.schemaVersion === '1.0' &&
    Array.isArray(value.conversations) &&
    value.conversations.every(
      (item) =>
        conversationIdentity(item) &&
        text(item.preview, 2_000) &&
        Number.isInteger(item.turnCount) &&
        (item.turnCount as number) >= 0,
    ) &&
    nullableCursor(value.nextCursor)
  );
}

const isAssistantHistoryTurn = (
  value: unknown,
): value is AssistantHistoryTurn =>
  object(value) &&
  text(value.clientRequestId, 200) &&
  timestamp(value.createdAt) &&
  timestamp(value.completedAt) &&
  object(value.userMessage) &&
  text(value.userMessage.text, 4_000) &&
  object(value.assistantMessage) &&
  text(value.assistantMessage.messageId, 200) &&
  value.assistantMessage.format === 'markdown' &&
  text(value.assistantMessage.text, 20_000);

export function isAssistantConversationTurnsPage(
  value: unknown,
): value is AssistantConversationTurnsPage {
  return (
    object(value) &&
    value.schemaVersion === '1.0' &&
    conversationIdentity(value.conversation) &&
    Array.isArray(value.turns) &&
    value.turns.every(isAssistantHistoryTurn) &&
    nullableCursor(value.nextCursor)
  );
}

const SEARCH_KEYS = new Set<SearchCriterion>([
  'location',
  'minListedRent',
  'maxListedRent',
  'minBedrooms',
  'minBathrooms',
  'propertyTypes',
  'moveInDate',
  'minSquareFeet',
  'parkingAvailable',
  'inUnitLaundry',
  'airConditioning',
]);

const proposalBase = (value: Record<string, unknown>) =>
  text(value.id, 200) && text(value.explanation, 500);

const hasExactKeys = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
};

const validCostArguments = (args: Record<string, unknown>) => {
  if (
    typeof args.category !== 'string' ||
    !Object.hasOwn(ASSISTANT_COST_FREQUENCIES, args.category) ||
    typeof args.amount !== 'number' ||
    !Number.isFinite(args.amount) ||
    args.amount < 0 ||
    args.amount > 1_000_000 ||
    args.currency !== 'USD' ||
    !['monthly', 'one_time'].includes(String(args.frequency))
  )
    return false;
  return (
    ASSISTANT_COST_FREQUENCIES[
      args.category as keyof typeof ASSISTANT_COST_FREQUENCIES
    ] === args.frequency
  );
};

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
    if (!validCostArguments(args)) return undefined;
    return value as unknown as AssistantProposal;
  }
  if (value.type === 'property_note.add') {
    if (!text(args.text, 500)) return undefined;
    return value as unknown as AssistantProposal;
  }
  if (value.type === 'saved_listing.set_cost') {
    if (
      !hasExactKeys(value, [
        'id',
        'type',
        'explanation',
        'contextRevision',
        'arguments',
      ]) ||
      !hasExactKeys(args, [
        'listingId',
        'category',
        'amount',
        'currency',
        'frequency',
      ]) ||
      !text(value.contextRevision, 2_000) ||
      !text(args.listingId, 200) ||
      !validCostArguments(args)
    )
      return undefined;
    return value as unknown as AssistantProposal;
  }
  if (value.type === 'saved_listing.add_note') {
    if (
      !hasExactKeys(value, [
        'id',
        'type',
        'explanation',
        'contextRevision',
        'arguments',
      ]) ||
      !hasExactKeys(args, ['listingId', 'text']) ||
      !text(value.contextRevision, 2_000) ||
      !text(args.listingId, 200) ||
      !text(args.text, 500) ||
      !(args.text as string).trim()
    )
      return undefined;
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

export function acceptStoredAssistantConversation(
  value: unknown,
): StoredAssistantConversation | undefined {
  if (
    !object(value) ||
    value.schemaVersion !== '1.0' ||
    !Array.isArray(value.messages) ||
    !Array.isArray(value.outcomes) ||
    (value.pendingOutcomes !== undefined &&
      !Array.isArray(value.pendingOutcomes)) ||
    (value.conversationId !== undefined && !text(value.conversationId, 200))
  )
    return undefined;

  const messages = value.messages
    .map((item): StoredAssistantMessage | undefined => {
      if (!object(item) || !text(item.id, 200)) return undefined;
      if (item.role === 'user' && text(item.text, 4_000))
        return { id: item.id, role: 'user', text: item.text };
      if (item.role !== 'assistant') return undefined;
      const response = acceptAssistantResponse(item.response);
      if (!response) return undefined;
      return {
        id: response.messageId,
        role: 'assistant',
        text: response.message.text,
        response,
      };
    })
    .filter((item): item is StoredAssistantMessage => item !== undefined);

  const validOutcomes = (items: unknown[]) =>
    items.filter(
      (item): item is StoredAssistantConversation['outcomes'][number] =>
        object(item) &&
        text(item.proposalId, 200) &&
        ['applied', 'rejected', 'failed', 'stale'].includes(
          String(item.status),
        ),
    );
  const outcomes = validOutcomes(value.outcomes);
  const pendingOutcomes = validOutcomes(
    Array.isArray(value.pendingOutcomes) ? value.pendingOutcomes : [],
  );

  return {
    schemaVersion: '1.0',
    ...(typeof value.conversationId === 'string'
      ? { conversationId: value.conversationId }
      : {}),
    messages,
    outcomes,
    pendingOutcomes,
  };
}
