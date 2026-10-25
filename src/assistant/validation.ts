import {
  normalizeRentalSearch,
  SEARCH_SITE_ADAPTERS,
  type SearchCriterion,
} from '../search';
import {
  ASSISTANT_COST_FREQUENCIES,
  SAVED_LISTING_CLEARABLE_FIELDS,
  SAVED_LISTING_SETTABLE_FIELDS,
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

const SETTABLE_SAVED_FIELDS = new Set<string>(SAVED_LISTING_SETTABLE_FIELDS);
const CLEARABLE_SAVED_FIELDS = new Set<string>(SAVED_LISTING_CLEARABLE_FIELDS);
const SAVED_TEXT_FIELDS = new Set([
  'identity.listingTitle',
  'identity.fullAddress',
  'identity.city',
  'identity.state',
  'identity.zipCode',
  'identity.url',
]);
const SAVED_UTILITY_FIELDS = new Set([
  'utilityIncluded.electricity',
  'utilityIncluded.naturalGas',
  'utilityIncluded.water',
  'utilityIncluded.sewer',
  'utilityIncluded.trash',
  'utilityIncluded.internet',
]);

const finiteAmount = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1_000_000;

const validSavedFieldValue = (field: string, value: unknown) => {
  if (SAVED_TEXT_FIELDS.has(field)) {
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > (field === 'identity.url' ? 2_000 : 500)
    )
      return false;
    if (field !== 'identity.url') return true;
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }
  if (SAVED_UTILITY_FIELDS.has(field)) return typeof value === 'boolean';
  if (field === 'laundryType')
    return [
      'in_unit',
      'shared_paid',
      'shared_free',
      'hookups_only',
      'none',
      'unknown',
    ].includes(String(value));
  if (!finiteAmount(value)) return false;
  return (
    field !== 'concessions.leaseMonths' ||
    (Number.isInteger(value) && value >= 1 && value <= 120)
  );
};

export function acceptAssistantProposal(
  value: unknown,
): AssistantProposal | undefined {
  if (!object(value) || !proposalBase(value) || !object(value.arguments))
    return undefined;
  const args = value.arguments;
  if (value.type === 'household.patch') {
    if (
      !hasExactKeys(args, ['set']) ||
      !object(args.set) ||
      !Object.keys(args.set).length ||
      Object.entries(args.set).some(
        ([key, count]) =>
          !['occupants', 'cats', 'smallDogs', 'largeDogs'].includes(key) ||
          typeof count !== 'number' ||
          !Number.isSafeInteger(count) ||
          count < (key === 'occupants' ? 1 : 0) ||
          count > Number.MAX_SAFE_INTEGER,
      )
    )
      return undefined;
    return value as unknown as AssistantProposal;
  }
  if (value.type === 'search.launch') {
    if (
      !hasExactKeys(args, ['siteIds']) ||
      !Array.isArray(args.siteIds) ||
      !args.siteIds.length ||
      args.siteIds.length !== 1 ||
      new Set(args.siteIds).size !== args.siteIds.length ||
      args.siteIds.some(
        (id) => !SEARCH_SITE_ADAPTERS.some((site) => site.id === id),
      )
    )
      return undefined;
    return value as unknown as AssistantProposal;
  }
  if (value.type === 'search.patch') {
    if (
      !hasExactKeys(args, ['set', 'clear']) ||
      !object(args.set) ||
      !Array.isArray(args.clear) ||
      (!Object.keys(args.set).length && !args.clear.length) ||
      new Set(args.clear).size !== args.clear.length ||
      args.clear.some(
        (key) => typeof key !== 'string' || key in (args.set as object),
      )
    )
      return undefined;
    const normalized = normalizeRentalSearch(args.set);
    if (
      normalized.issues.length ||
      Object.keys(normalized.search).length !== Object.keys(args.set).length ||
      (Array.isArray(args.set.propertyTypes) &&
        new Set(args.set.propertyTypes).size !==
          args.set.propertyTypes.length) ||
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
  if (value.type === 'saved_listing.set_field') {
    if (
      !hasExactKeys(value, [
        'id',
        'type',
        'explanation',
        'contextRevision',
        'arguments',
      ]) ||
      !hasExactKeys(args, ['listingId', 'field', 'value']) ||
      !text(value.contextRevision, 2_000) ||
      !text(args.listingId, 200) ||
      typeof args.field !== 'string' ||
      !SETTABLE_SAVED_FIELDS.has(args.field) ||
      !validSavedFieldValue(args.field, args.value)
    )
      return undefined;
    return value as unknown as AssistantProposal;
  }
  if (value.type === 'saved_listing.clear_field') {
    if (
      !hasExactKeys(value, [
        'id',
        'type',
        'explanation',
        'contextRevision',
        'arguments',
      ]) ||
      !hasExactKeys(args, ['listingId', 'field']) ||
      !text(value.contextRevision, 2_000) ||
      !text(args.listingId, 200) ||
      typeof args.field !== 'string' ||
      !CLEARABLE_SAVED_FIELDS.has(args.field)
    )
      return undefined;
    return value as unknown as AssistantProposal;
  }
  if (value.type === 'saved_listing.add_custom_fee') {
    if (
      !hasExactKeys(value, [
        'id',
        'type',
        'explanation',
        'contextRevision',
        'arguments',
      ]) ||
      !hasExactKeys(args, ['listingId', 'cadence', 'label', 'amount']) ||
      !text(value.contextRevision, 2_000) ||
      !text(args.listingId, 200) ||
      !['monthly', 'one_time'].includes(String(args.cadence)) ||
      !text(args.label, 200) ||
      !(args.label as string).trim() ||
      !finiteAmount(args.amount)
    )
      return undefined;
    return value as unknown as AssistantProposal;
  }
  if (
    value.type === 'saved_listing.update_custom_fee' ||
    value.type === 'saved_listing.remove_custom_fee'
  ) {
    const keys =
      value.type === 'saved_listing.update_custom_fee'
        ? ['listingId', 'cadence', 'feeId', 'label', 'amount']
        : ['listingId', 'cadence', 'feeId'];
    if (
      !hasExactKeys(value, [
        'id',
        'type',
        'explanation',
        'contextRevision',
        'arguments',
      ]) ||
      !hasExactKeys(args, keys) ||
      !text(value.contextRevision, 2_000) ||
      !text(args.listingId, 200) ||
      !['monthly', 'one_time'].includes(String(args.cadence)) ||
      !text(args.feeId, 200)
    )
      return undefined;
    if (
      value.type === 'saved_listing.update_custom_fee' &&
      (!text(args.label, 200) ||
        !(args.label as string).trim() ||
        !finiteAmount(args.amount))
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
  if (value.type === 'saved_listing.remove_note') {
    if (
      !hasExactKeys(value, [
        'id',
        'type',
        'explanation',
        'contextRevision',
        'arguments',
      ]) ||
      !hasExactKeys(args, ['listingId', 'noteId']) ||
      !text(value.contextRevision, 2_000) ||
      !text(args.listingId, 200) ||
      !text(args.noteId, 200)
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
