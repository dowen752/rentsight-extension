import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  ASSISTANT_ACTION_VERSIONS,
  approvalFingerprint,
  approvalSummary,
  type ApprovalState,
  acceptStoredAssistantConversation,
  assistantContextForAnalysis,
  assistantContextRevision,
  type AssistantActionOutcome,
  type AssistantConversationPage,
  type AssistantConversationSummary,
  type AssistantConversationTurnsPage,
  type AssistantHistoryTurn,
  type AssistantProposal,
  type AssistantRequest,
  type AssistantResponse,
  type SavedListingProposal,
  type StoredAssistantConversation,
  type StoredAssistantMessage,
} from '../assistant';
import { BackendRequestError, SignedOutError } from '../backend';
import { rentSightApi } from '../backend/services';
import type { SavedListingRecord } from '../saved';
import {
  getSearchProfile,
  applyHouseholdPetFilters,
  launchRentalSite,
  prepareRentalSiteAccess,
  setSearchProfile,
  type RentalSearch,
} from '../search';
import {
  normalizeHouseholdProfile,
  type HouseholdProfile,
} from '../shared/household';
import type { RentalAnalysis } from '../shared/analysis';
import { extensionStorage } from '../storage';
import { AssistantMarkdown } from './AssistantMarkdown';

type AssistantTab = 'find' | 'current' | 'saved' | 'compare';

type ConversationMessage = StoredAssistantMessage & {
  animate?: boolean;
  historical?: boolean;
  savedScope?: boolean;
};

interface AssistantHistoryApi {
  listConversations: (options: {
    limit: number;
    cursor?: string;
  }) => Promise<AssistantConversationPage>;
  getTurns: (
    conversationId: string,
    options: { limit: number; cursor?: string },
  ) => Promise<AssistantConversationTurnsPage>;
  deleteConversation: (conversationId: string) => Promise<void>;
}

const DEFAULT_HISTORY_API: AssistantHistoryApi = {
  listConversations: (options) =>
    rentSightApi.listAssistantConversations(options),
  getTurns: (conversationId, options) =>
    rentSightApi.getAssistantConversationTurns(conversationId, options),
  deleteConversation: (conversationId) =>
    rentSightApi.deleteAssistantConversation(conversationId),
};

const HISTORY_PAGE_SIZE = 20;
const TURN_PAGE_SIZE = 20;
const SAVED_LISTING_ACTION_VERSIONS = {
  'search.patch': ASSISTANT_ACTION_VERSIONS['search.patch'],
  'search.launch': ASSISTANT_ACTION_VERSIONS['search.launch'],
  'saved_listing.set_cost': ASSISTANT_ACTION_VERSIONS['saved_listing.set_cost'],
  'saved_listing.set_field':
    ASSISTANT_ACTION_VERSIONS['saved_listing.set_field'],
  'saved_listing.clear_field':
    ASSISTANT_ACTION_VERSIONS['saved_listing.clear_field'],
  'saved_listing.add_custom_fee':
    ASSISTANT_ACTION_VERSIONS['saved_listing.add_custom_fee'],
  'saved_listing.update_custom_fee':
    ASSISTANT_ACTION_VERSIONS['saved_listing.update_custom_fee'],
  'saved_listing.remove_custom_fee':
    ASSISTANT_ACTION_VERSIONS['saved_listing.remove_custom_fee'],
  'saved_listing.add_note': ASSISTANT_ACTION_VERSIONS['saved_listing.add_note'],
  'saved_listing.remove_note':
    ASSISTANT_ACTION_VERSIONS['saved_listing.remove_note'],
  'workspace.navigate': ASSISTANT_ACTION_VERSIONS['workspace.navigate'],
};
const SEARCH_ACTION_VERSIONS = {
  'search.patch': ASSISTANT_ACTION_VERSIONS['search.patch'],
  'search.launch': ASSISTANT_ACTION_VERSIONS['search.launch'],
  'workspace.navigate': ASSISTANT_ACTION_VERSIONS['workspace.navigate'],
};
const CURRENT_LISTING_ACTION_VERSIONS = {
  'search.patch': ASSISTANT_ACTION_VERSIONS['search.patch'],
  'search.launch': ASSISTANT_ACTION_VERSIONS['search.launch'],
  'analysis.set_cost': ASSISTANT_ACTION_VERSIONS['analysis.set_cost'],
  'property_note.add': ASSISTANT_ACTION_VERSIONS['property_note.add'],
  'workspace.navigate': ASSISTANT_ACTION_VERSIONS['workspace.navigate'],
};

const emptyConversation = (): StoredAssistantConversation => ({
  schemaVersion: '1.0',
  messages: [],
  outcomes: [],
  pendingOutcomes: [],
});

const randomId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const errorStatus = (cause: unknown) =>
  cause instanceof BackendRequestError
    ? cause.status
    : typeof cause === 'object' &&
        cause !== null &&
        typeof Reflect.get(cause, 'status') === 'number'
      ? (Reflect.get(cause, 'status') as number)
      : undefined;

const historyErrorMessage = (cause: unknown) => {
  if (cause instanceof SignedOutError || errorStatus(cause) === 401)
    return 'Your session has expired. Sign in again to view chat history.';
  return cause instanceof Error
    ? cause.message
    : 'Chat history could not be loaded. Please try again.';
};

const formatUpdatedTime = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date().getFullYear()
      ? { year: 'numeric' as const }
      : {}),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const savedListingLabel = (record: SavedListingRecord) =>
  record.analysis.listing.identity.listingTitle?.value ||
  record.analysis.listing.identity.fullAddress?.value ||
  'Saved rental';

const messagesForTurns = (
  conversationId: string,
  turns: AssistantHistoryTurn[],
): ConversationMessage[] =>
  [...turns]
    .sort(
      (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
    )
    .flatMap((turn) => [
      {
        id: `${turn.clientRequestId}:user`,
        role: 'user' as const,
        text: turn.userMessage.text,
        historical: true,
      },
      {
        id: turn.assistantMessage.messageId,
        role: 'assistant' as const,
        text: turn.assistantMessage.text,
        historical: true,
        response: {
          schemaVersion: '1.0' as const,
          conversationId,
          messageId: turn.assistantMessage.messageId,
          message: {
            format: 'markdown' as const,
            text: turn.assistantMessage.text,
          },
          proposals: [],
        },
      },
    ]);

const COST_LABELS: Record<string, string> = {
  naturalGas: 'Gas',
  petRent: 'Pet rent',
  rentersInsurance: 'Renters insurance',
  amenityFees: 'Amenity fees',
  otherRequiredMonthlyFees: 'Other required fees',
  applicationFee: 'Application fee',
  securityDeposit: 'Security deposit',
  firstMonthsRent: "First month's rent",
  lastMonthsRent: "Last month's rent",
  petDeposit: 'Pet deposit',
  petFee: 'Pet fee',
  administrativeFee: 'Administrative fee',
  utilityDeposits: 'Utility deposits',
  otherMoveInFees: 'Other move-in fees',
};

const label = (value: string) =>
  COST_LABELS[value] ??
  value.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

const savedFieldSummary = (field: string, value: string | number | boolean) => {
  const fieldLabel = label(field.replace(/^.*\./, ''));
  if (field.startsWith('utilityIncluded.'))
    return `${fieldLabel}: ${value ? 'Included in rent' : 'Not included in rent'}`;
  if (field === 'recurring.advertisedRent')
    return `${fieldLabel}: $${Number(value).toLocaleString()} per month`;
  if (field === 'concessions.oneTimeCredit')
    return `${fieldLabel}: $${Number(value).toLocaleString()} one time`;
  if (field === 'paidLaundry.washPrice' || field === 'paidLaundry.dryPrice')
    return `${fieldLabel}: $${Number(value).toLocaleString()} per load`;
  if (field === 'laundryType')
    return `Laundry type: ${label(String(value).replaceAll('_', ' '))}`;
  return `${fieldLabel}: ${String(value)}`;
};

const isSavedListingProposal = (
  proposal: AssistantProposal,
): proposal is SavedListingProposal =>
  proposal.type.startsWith('saved_listing.');

function proposalSummary(
  proposal: AssistantProposal,
  savedListing?: SavedListingRecord,
): string {
  if (proposal.type === 'household.patch')
    return 'Update your saved household counts.';
  if (proposal.type === 'search.launch')
    return 'Open rental sites using saved preferences.';
  if (proposal.type === 'search.patch') {
    const changes = Object.entries(proposal.arguments.set).map(
      ([key, value]) =>
        `${label(key)}: ${Array.isArray(value) ? value.join(', ') : String(value)}`,
    );
    changes.push(
      ...proposal.arguments.clear.map((key) => `Clear ${label(key)}`),
    );
    return changes.join(' · ');
  }
  if (
    proposal.type === 'analysis.set_cost' ||
    proposal.type === 'saved_listing.set_cost'
  )
    return `${label(proposal.arguments.category)}: $${proposal.arguments.amount.toLocaleString()} ${proposal.arguments.frequency === 'monthly' ? 'per month' : 'one time'}`;
  if (proposal.type === 'saved_listing.set_field')
    return savedFieldSummary(
      proposal.arguments.field,
      proposal.arguments.value,
    );
  if (proposal.type === 'saved_listing.clear_field')
    return `Clear ${label(proposal.arguments.field.replace(/^.*\./, ''))}`;
  if (
    proposal.type === 'saved_listing.add_custom_fee' ||
    proposal.type === 'saved_listing.update_custom_fee'
  )
    return `${proposal.arguments.label}: $${proposal.arguments.amount.toLocaleString()} ${proposal.arguments.cadence === 'monthly' ? 'per month' : 'one time'}`;
  if (proposal.type === 'saved_listing.remove_custom_fee')
    return `Remove ${
      (proposal.arguments.cadence === 'monthly'
        ? savedListing?.analysis.customRecurringFees
        : savedListing?.analysis.customOneTimeFees
      )?.find((fee) => fee.id === proposal.arguments.feeId)?.label ??
      'the selected custom fee'
    }`;
  if (
    proposal.type === 'property_note.add' ||
    proposal.type === 'saved_listing.add_note'
  )
    return proposal.arguments.text;
  if (proposal.type === 'saved_listing.remove_note')
    return `Remove “${savedListing?.analysis.propertyNotes.find((note) => note.id === proposal.arguments.noteId)?.text ?? 'the selected property note'}”`;
  return `Open ${proposal.arguments.destination === 'find' ? 'Search' : label(proposal.arguments.destination)}`;
}

function proposalTitle(
  proposal: AssistantProposal,
  savedListing?: SavedListingRecord,
) {
  if (
    proposal.type === 'saved_listing.set_cost' ||
    proposal.type === 'saved_listing.set_field' ||
    proposal.type === 'saved_listing.clear_field' ||
    proposal.type === 'saved_listing.add_custom_fee' ||
    proposal.type === 'saved_listing.update_custom_fee' ||
    proposal.type === 'saved_listing.remove_custom_fee'
  )
    return savedListing
      ? `Update ${savedListingLabel(savedListing)}`
      : 'Saved listing cost update';
  if (
    proposal.type === 'saved_listing.add_note' ||
    proposal.type === 'saved_listing.remove_note'
  )
    return savedListing
      ? `${proposal.type === 'saved_listing.add_note' ? 'Add a note to' : 'Remove a note from'} ${savedListingLabel(savedListing)}`
      : 'Saved listing note';
  return proposal.explanation;
}

function ProposalCard({
  proposal,
  savedListing,
  status,
  onApply,
  onDismiss,
  summary,
  applying,
  busy,
}: {
  proposal: AssistantProposal;
  savedListing?: SavedListingRecord;
  status?: AssistantActionOutcome['status'];
  onApply: () => void;
  onDismiss: () => void;
  summary?: string;
  applying?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="assistant-proposal">
      <strong>{proposalTitle(proposal, savedListing)}</strong>
      <p>{summary ?? proposalSummary(proposal, savedListing)}</p>
      {status ? (
        <span className={`assistant-proposal-status ${status}`}>
          {status === 'applied' &&
          (proposal.type === 'search.launch' ||
            proposal.type === 'workspace.navigate')
            ? 'Opened'
            : label(status)}
        </span>
      ) : (
        <div>
          <button
            type="button"
            className="primary-action"
            onClick={onApply}
            disabled={busy}
          >
            {applying
              ? 'Working…'
              : proposal.type === 'household.patch'
                ? 'Update household'
                : proposal.type === 'search.patch'
                  ? 'Save search preferences'
                  : proposal.type === 'search.launch'
                    ? 'Open rental site'
                    : proposal.type === 'workspace.navigate'
                      ? `Open ${proposal.arguments.destination === 'find' ? 'Search' : label(proposal.arguments.destination)}`
                      : 'Apply'}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={onDismiss}
            disabled={busy}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function ConversationMessageCard({
  message,
  animateResponse,
  statusFor,
  apply,
  dismiss,
  submitMessage,
  resolveSavedListing,
  applyingProposalId,
}: {
  message: ConversationMessage;
  applyingProposalId?: string;
  animateResponse: boolean;
  statusFor: (
    proposalId: string,
  ) => AssistantActionOutcome['status'] | undefined;
  apply: (
    proposal: AssistantProposal,
    response: AssistantResponse,
    baseline?: string,
  ) => Promise<void>;
  dismiss: (proposalId: string) => void;
  submitMessage: (message: string) => Promise<void>;
  resolveSavedListing: (
    proposal: SavedListingProposal,
  ) => SavedListingRecord | undefined;
}) {
  const [revealComplete, setRevealComplete] = useState(
    message.role === 'user' || !animateResponse,
  );

  return (
    <article className={`assistant-message ${message.role}`}>
      <span>{message.role === 'user' ? 'You' : 'RentSight'}</span>
      {message.role === 'assistant' ? (
        <AssistantMarkdown
          text={message.text}
          animate={animateResponse}
          onRevealComplete={() => setRevealComplete(true)}
        />
      ) : (
        <p className="assistant-user-text">{message.text}</p>
      )}
      {revealComplete && message.response?.citations?.length ? (
        <ul className="assistant-citations">
          {message.response.citations.map((citation) => (
            <li key={citation.id}>
              {citation.url ? (
                <a href={citation.url} target="_blank" rel="noreferrer">
                  {citation.title}
                </a>
              ) : (
                citation.title
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {revealComplete
        ? message.response?.proposals
            .filter((proposal) => {
              if (message.historical) return Boolean(statusFor(proposal.id));
              if (!message.savedScope) return !isSavedListingProposal(proposal);
              if (isSavedListingProposal(proposal))
                return Boolean(resolveSavedListing(proposal));
              return [
                'search.patch',
                'household.patch',
                'search.launch',
                'workspace.navigate',
              ].includes(proposal.type);
            })
            .map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                savedListing={
                  isSavedListingProposal(proposal)
                    ? resolveSavedListing(proposal)
                    : undefined
                }
                summary={message.approvalSummaries?.[proposal.id]}
                applying={applyingProposalId === proposal.id}
                busy={Boolean(applyingProposalId)}
                status={statusFor(proposal.id)}
                onApply={() =>
                  void apply(
                    proposal,
                    message.response!,
                    message.approvalBaselines?.[proposal.id],
                  )
                }
                onDismiss={() => dismiss(proposal.id)}
              />
            ))
        : null}
      {revealComplete &&
      !message.historical &&
      message.response?.followUpSuggestions?.length ? (
        <div className="assistant-followups">
          {message.response.followUpSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void submitMessage(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function NewChatIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 2.5h9A1.5 1.5 0 0 1 14 4v6a1.5 1.5 0 0 1-1.5 1.5H7L3 14v-2.8A1.5 1.5 0 0 1 2 9.8V4a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M8 5v4M6 7h4" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4.5A6 6 0 1 1 2 8" />
      <path d="M1.5 2v3h3M8 4.5V8l2.5 1.5" />
    </svg>
  );
}

function ConversationHistory({
  conversations,
  activeConversationId,
  loading,
  loadingMore,
  error,
  nextCursor,
  deletingId,
  deleteCandidateId,
  onOpen,
  onLoadMore,
  onRetry,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  conversations: AssistantConversationSummary[];
  activeConversationId?: string;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  nextCursor: string | null;
  deletingId?: string;
  deleteCandidateId?: string;
  onOpen: (conversationId: string) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onRequestDelete: (conversationId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (conversationId: string) => void;
}) {
  return (
    <aside className="assistant-history" aria-label="Chat history">
      <div className="assistant-history-heading">
        <div>
          <strong>Recent conversations</strong>
          <span>Successful turns are retained for 30 days.</span>
        </div>
      </div>
      {loading ? (
        <p className="assistant-history-state" role="status">
          Loading conversations…
        </p>
      ) : error && !conversations.length ? (
        <div className="assistant-history-state error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : !conversations.length ? (
        <p className="assistant-history-state">
          No retained conversations yet. Start a chat below.
        </p>
      ) : (
        <div className="assistant-history-list">
          {conversations.map((conversation) => {
            const confirming =
              deleteCandidateId === conversation.conversationId;
            return (
              <div
                className={`assistant-history-item${activeConversationId === conversation.conversationId ? ' active' : ''}`}
                key={conversation.conversationId}
              >
                <button
                  type="button"
                  className="assistant-history-open"
                  disabled={Boolean(deletingId)}
                  onClick={() => onOpen(conversation.conversationId)}
                >
                  <span className="assistant-history-title">
                    {conversation.title}
                  </span>
                  <span className="assistant-history-preview">
                    {conversation.preview}
                  </span>
                  <span className="assistant-history-meta">
                    {formatUpdatedTime(conversation.updatedAt)} ·{' '}
                    {conversation.turnCount}{' '}
                    {conversation.turnCount === 1 ? 'turn' : 'turns'}
                  </span>
                </button>
                {confirming ? (
                  <div
                    className="assistant-delete-confirmation"
                    role="alertdialog"
                    aria-label={`Delete ${conversation.title}?`}
                  >
                    <p>Delete this conversation?</p>
                    <button
                      type="button"
                      disabled={deletingId === conversation.conversationId}
                      onClick={() =>
                        onConfirmDelete(conversation.conversationId)
                      }
                    >
                      {deletingId === conversation.conversationId
                        ? 'Deleting…'
                        : 'Delete'}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(deletingId)}
                      onClick={onCancelDelete}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="assistant-history-delete"
                    aria-label={`Delete ${conversation.title}`}
                    disabled={Boolean(deletingId)}
                    onClick={() => onRequestDelete(conversation.conversationId)}
                  >
                    Delete
                  </button>
                )}
              </div>
            );
          })}
          {error ? (
            <p className="assistant-history-page-error" role="alert">
              {error}
            </p>
          ) : null}
          {nextCursor ? (
            <button
              type="button"
              className="assistant-history-more"
              disabled={loadingMore}
              onClick={onLoadMore}
            >
              {loadingMore ? 'Loading…' : 'Load more conversations'}
            </button>
          ) : null}
        </div>
      )}
    </aside>
  );
}

export function AssistantView({
  analysis,
  householdProfile,
  updateHouseholdProfile,
  openRentalSite = launchRentalSite,
  savedListings,
  selectedSavedListingIds,
  setSelectedSavedListingIds,
  updateAnalysis,
  updateSavedListing,
  navigate,
  sendMessage = (request) => rentSightApi.sendAssistantMessage(request),
  historyApi = DEFAULT_HISTORY_API,
  animateResponses = true,
}: {
  analysis?: RentalAnalysis;
  householdProfile?: HouseholdProfile;
  updateHouseholdProfile?: (profile: HouseholdProfile) => Promise<void>;
  openRentalSite?: typeof launchRentalSite;
  savedListings: SavedListingRecord[];
  selectedSavedListingIds?: string[];
  setSelectedSavedListingIds?: (ids: string[]) => void;
  updateAnalysis?: (proposal: AssistantProposal) => void | Promise<void>;
  updateSavedListing?: (proposal: SavedListingProposal) => Promise<string>;
  navigate: (tab: AssistantTab) => void;
  sendMessage?: (request: AssistantRequest) => Promise<AssistantResponse>;
  historyApi?: AssistantHistoryApi;
  animateResponses?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [storageError, setStorageError] = useState('');
  const [search, setSearch] = useState<RentalSearch>();
  const household = useMemo(
    () =>
      normalizeHouseholdProfile(householdProfile ?? analysis?.householdProfile),
    [householdProfile, analysis?.householdProfile],
  );
  const [applyingProposalId, setApplyingProposalId] = useState<string>();
  const applyingRef = useRef(false);
  const requestStates = useRef(new Map<string, ApprovalState>());
  useEffect(() => {
    let active = true;
    const load = () => {
      void getSearchProfile()
        .then((profile) => {
          if (active) setSearch(profile.search);
        })
        .catch(() => {
          if (active)
            setStorageError(
              'Could not load Search preferences. Reopen Ask to try again.',
            );
        });
    };
    load();
    const changes = globalThis.chrome?.storage?.onChanged;
    const listener = (
      items: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'local' && items.searchProfile) load();
    };
    changes?.addListener(listener);
    return () => {
      active = false;
      changes?.removeListener(listener);
    };
  }, []);
  const [localSavedListingIds, setLocalSavedListingIds] = useState<string[]>(
    [],
  );
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [outcomes, setOutcomes] = useState<AssistantActionOutcome[]>([]);
  const [pendingOutcomes, setPendingOutcomes] = useState<
    AssistantActionOutcome[]
  >([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [failedRequest, setFailedRequest] = useState<AssistantRequest>();
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<
    AssistantConversationSummary[]
  >([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [openingConversationId, setOpeningConversationId] = useState<string>();
  const [turnsCursor, setTurnsCursor] = useState<string | null>(null);
  const [olderTurnsLoading, setOlderTurnsLoading] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const threadRef = useRef<HTMLElement>(null);
  const requestedSavedListingIds =
    selectedSavedListingIds ?? localSavedListingIds;
  const scopedSavedListings = useMemo(() => {
    const ids = new Set(requestedSavedListingIds);
    return savedListings.filter((record) => ids.has(record.id)).slice(0, 5);
  }, [requestedSavedListingIds, savedListings]);
  const activeSavedListingIds = useMemo(
    () => scopedSavedListings.map((record) => record.id),
    [scopedSavedListings],
  );
  const updateSavedListingScope =
    setSelectedSavedListingIds ?? setLocalSavedListingIds;
  const usingSavedListings = activeSavedListingIds.length > 0;
  const revision = assistantContextRevision(
    analysis,
    savedListings,
    activeSavedListingIds,
  );
  const context = useMemo(
    () =>
      assistantContextForAnalysis(
        analysis,
        savedListings,
        activeSavedListingIds,
        household,
        search,
      ),
    [activeSavedListingIds, analysis, savedListings, household, search],
  );

  const persistConversation = useCallback(
    (conversation: StoredAssistantConversation) => {
      const write = persistenceQueue.current
        .catch(() => undefined)
        .then(() =>
          extensionStorage.set('assistantConversation', conversation),
        );
      persistenceQueue.current = write;
      return write;
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void extensionStorage
      .get('assistantConversation')
      .then((stored) => {
        if (!active) return;
        const accepted = acceptStoredAssistantConversation(stored);
        if (accepted) {
          setConversationId(accepted.conversationId);
          setMessages(
            accepted.messages.map((message) => ({
              ...message,
              animate: false,
              historical: true,
            })),
          );
          setOutcomes(accepted.outcomes);
          setPendingOutcomes(accepted.pendingOutcomes);
        }
        setConversationLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setStorageError(
          'Your previous chat could not be restored. New messages will still work.',
        );
        setConversationLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!conversationLoaded) return;
    const storedMessages = messages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      ...(message.response ? { response: message.response } : {}),
    }));
    void persistConversation({
      schemaVersion: '1.0',
      ...(conversationId ? { conversationId } : {}),
      messages: storedMessages,
      outcomes,
      pendingOutcomes,
    }).catch(() =>
      setStorageError(
        'This chat could not be saved. Keep the side panel open to avoid losing it.',
      ),
    );
  }, [
    conversationId,
    conversationLoaded,
    messages,
    outcomes,
    pendingOutcomes,
    persistConversation,
  ]);

  const loadConversationList = useCallback(
    async (cursor?: string, silent = false) => {
      if (cursor) setHistoryLoadingMore(true);
      else if (!silent) setHistoryLoading(true);
      if (!silent) setHistoryError('');
      try {
        const page = await historyApi.listConversations({
          limit: HISTORY_PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        });
        setConversations((current) => {
          if (!cursor) return page.conversations;
          const known = new Set(current.map((item) => item.conversationId));
          return [
            ...current,
            ...page.conversations.filter(
              (item) => !known.has(item.conversationId),
            ),
          ];
        });
        setHistoryCursor(page.nextCursor);
        setHistoryLoaded(true);
        setHistoryError('');
      } catch (cause: unknown) {
        if (!silent) setHistoryError(historyErrorMessage(cause));
      } finally {
        setHistoryLoading(false);
        setHistoryLoadingMore(false);
      }
    },
    [historyApi],
  );

  const toggleHistory = () => {
    const opening = !historyOpen;
    setHistoryOpen(opening);
    setDeleteCandidateId(undefined);
    if (opening && !historyLoaded && !historyLoading)
      void loadConversationList();
  };

  const resetConversation = useCallback(() => {
    requestStates.current.clear();
    setConversationId(undefined);
    setMessages([]);
    setOutcomes([]);
    setPendingOutcomes([]);
    setFailedRequest(undefined);
    setTurnsCursor(null);
    setOpeningConversationId(undefined);
    setError('');
    setStorageError('');
    setDraft('');
    void persistConversation(emptyConversation()).catch(() =>
      setStorageError(
        'The saved chat could not be cleared. Please try New chat again.',
      ),
    );
  }, [persistConversation]);

  const handleMissingConversation = useCallback(
    (missingId: string) => {
      setConversations((current) =>
        current.filter((item) => item.conversationId !== missingId),
      );
      setHistoryError(
        'That conversation is no longer available. It may have expired after 30 days.',
      );
      if (conversationId === missingId) resetConversation();
    },
    [conversationId, resetConversation],
  );

  const openConversation = async (selectedId: string) => {
    if (pending || applyingRef.current || openingConversationId || deletingId)
      return;
    setOpeningConversationId(selectedId);
    setHistoryError('');
    setError('');
    try {
      const page = await historyApi.getTurns(selectedId, {
        limit: TURN_PAGE_SIZE,
      });
      setConversationId(page.conversation.conversationId);
      setMessages(
        messagesForTurns(page.conversation.conversationId, page.turns),
      );
      setOutcomes([]);
      setPendingOutcomes([]);
      setFailedRequest(undefined);
      setTurnsCursor(page.nextCursor);
      setHistoryOpen(false);
      setDraft('');
    } catch (cause: unknown) {
      if (errorStatus(cause) === 404) handleMissingConversation(selectedId);
      else setHistoryError(historyErrorMessage(cause));
    } finally {
      setOpeningConversationId(undefined);
    }
  };

  const loadOlderTurns = async () => {
    if (!conversationId || !turnsCursor || olderTurnsLoading) return;
    const thread = threadRef.current;
    const previousHeight = thread?.scrollHeight ?? 0;
    const previousTop = thread?.scrollTop ?? 0;
    setOlderTurnsLoading(true);
    setError('');
    try {
      const page = await historyApi.getTurns(conversationId, {
        limit: TURN_PAGE_SIZE,
        cursor: turnsCursor,
      });
      const olderMessages = messagesForTurns(conversationId, page.turns);
      setMessages((current) => {
        const known = new Set(current.map((message) => message.id));
        return [
          ...olderMessages.filter((message) => !known.has(message.id)),
          ...current,
        ];
      });
      setTurnsCursor(page.nextCursor);
      const preserveScroll = () => {
        if (!thread) return;
        thread.scrollTop =
          previousTop + Math.max(0, thread.scrollHeight - previousHeight);
      };
      if (typeof requestAnimationFrame === 'function')
        requestAnimationFrame(preserveScroll);
      else queueMicrotask(preserveScroll);
    } catch (cause: unknown) {
      if (errorStatus(cause) === 404) handleMissingConversation(conversationId);
      else setError(historyErrorMessage(cause));
    } finally {
      setOlderTurnsLoading(false);
    }
  };

  const confirmDeleteConversation = async (selectedId: string) => {
    if (deletingId) return;
    setDeletingId(selectedId);
    setHistoryError('');
    try {
      await historyApi.deleteConversation(selectedId);
      setConversations((current) =>
        current.filter((item) => item.conversationId !== selectedId),
      );
      setDeleteCandidateId(undefined);
      if (conversationId === selectedId) resetConversation();
    } catch (cause: unknown) {
      if (errorStatus(cause) === 404) {
        handleMissingConversation(selectedId);
        setDeleteCandidateId(undefined);
      } else setHistoryError(historyErrorMessage(cause));
    } finally {
      setDeletingId(undefined);
    }
  };

  const executeRequest = async (
    request: AssistantRequest,
    appendUserMessage: boolean,
  ) => {
    if (pending || applyingRef.current) return;
    if (appendUserMessage) {
      requestStates.current.clear();
      setMessages((current) => [
        ...current,
        {
          id: request.clientRequestId,
          role: 'user',
          text: request.message,
        },
      ]);
      setDraft('');
    }
    setError('');
    setPending(true);
    try {
      let frozenState = requestStates.current.get(request.clientRequestId);
      if (!frozenState) {
        frozenState = structuredClone({
          search: request.context?.search ?? search ?? {},
          household: request.context?.household ?? household,
          analysis,
          savedListings,
          selectedIds: activeSavedListingIds,
        });
        requestStates.current.set(request.clientRequestId, frozenState);
      }
      const response = await sendMessage(request);
      if (
        response.contextRevision &&
        response.contextRevision !== request.contextRevision
      )
        throw new Error(
          'The answer references an outdated workspace. Send a new message.',
        );
      const approvalBaselines = Object.fromEntries(
        await Promise.all(
          response.proposals.map(async (proposal) => [
            proposal.id,
            await approvalFingerprint(proposal, frozenState!),
          ]),
        ),
      );
      const approvalSummaries = Object.fromEntries(
        response.proposals.flatMap((proposal) => {
          const summary = approvalSummary(proposal, frozenState!);
          return summary ? [[proposal.id, summary]] : [];
        }),
      );
      requestStates.current.delete(request.clientRequestId);
      setFailedRequest(undefined);
      setConversationId(response.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: response.messageId,
          role: 'assistant',
          text: response.message.text,
          response,
          approvalBaselines,
          approvalSummaries,
          animate: true,
          historical: false,
          savedScope: request.context?.activeView === 'saved',
        },
      ]);
      setPendingOutcomes([]);
      void loadConversationList(undefined, true);
    } catch (cause: unknown) {
      if (request.conversationId && errorStatus(cause) === 404) {
        setFailedRequest(undefined);
        handleMissingConversation(request.conversationId);
        setError(
          'This conversation is no longer available. Start a new conversation to keep chatting.',
        );
      } else {
        setFailedRequest(request);
        setError(
          cause instanceof Error
            ? cause.message
            : 'RentSight could not answer right now.',
        );
      }
    } finally {
      setPending(false);
    }
  };

  const submitMessage = async (message: string) => {
    const trimmed = message.trim();
    if (
      !trimmed ||
      search === undefined ||
      pending ||
      openingConversationId ||
      deletingId ||
      applyingRef.current
    )
      return;
    const request: AssistantRequest = {
      schemaVersion: '1.0',
      clientRequestId: randomId(),
      ...(conversationId ? { conversationId } : {}),
      message: trimmed,
      contextRevision: revision,
      context,
      capabilities: {
        actions: {
          ...(usingSavedListings
            ? SAVED_LISTING_ACTION_VERSIONS
            : analysis && updateAnalysis
              ? CURRENT_LISTING_ACTION_VERSIONS
              : SEARCH_ACTION_VERSIONS),
          ...(updateHouseholdProfile
            ? {
                'household.patch': ASSISTANT_ACTION_VERSIONS['household.patch'],
              }
            : {}),
        },
      },
      ...(pendingOutcomes.length ? { actionOutcomes: pendingOutcomes } : {}),
    };
    await executeRequest(request, true);
  };

  const setOutcome = (
    proposalId: string,
    status: AssistantActionOutcome['status'],
    resultRevision?: string,
  ) => {
    const update = (current: AssistantActionOutcome[]) => [
      ...current.filter((item) => item.proposalId !== proposalId),
      { proposalId, status, ...(resultRevision ? { resultRevision } : {}) },
    ];
    setOutcomes(update);
    setPendingOutcomes(update);
  };

  const apply = async (
    proposal: AssistantProposal,
    response: AssistantResponse,
    baseline?: string,
  ) => {
    if (applyingRef.current) return;
    applyingRef.current = true;
    setApplyingProposalId(proposal.id);
    setError('');
    // Chrome requires the optional permission request inside the original click gesture.
    const siteAccess =
      proposal.type === 'search.launch' && openRentalSite === launchRentalSite
        ? prepareRentalSiteAccess(
            proposal.arguments.siteIds[0],
            applyHouseholdPetFilters(search ?? {}, household),
          )
        : undefined;
    try {
      const freshSearch = (await getSearchProfile()).search;
      const freshHousehold = normalizeHouseholdProfile(
        (await extensionStorage.get('householdProfile')) ?? household,
      );
      const state: ApprovalState = {
        search: freshSearch,
        household: freshHousehold,
        analysis,
        savedListings,
        selectedIds: activeSavedListingIds,
      };
      if (
        baseline
          ? baseline !== (await approvalFingerprint(proposal, state))
          : response.contextRevision && response.contextRevision !== revision
      ) {
        setOutcome(proposal.id, 'stale');
        setError(
          'The values for this change have changed. Ask for an updated suggestion.',
        );
        return;
      }
      if (proposal.type === 'household.patch') {
        if (!updateHouseholdProfile)
          throw new Error('Household updates are not available.');
        await updateHouseholdProfile({
          ...freshHousehold,
          ...proposal.arguments.set,
        });
        setOutcome(proposal.id, 'applied');
        return;
      }
      if (proposal.type === 'search.patch') {
        const next: RentalSearch = {
          ...freshSearch,
          ...proposal.arguments.set,
        };
        for (const key of proposal.arguments.clear) delete next[key];
        await setSearchProfile(next);
        setSearch(next);
        setOutcome(proposal.id, 'applied');
        navigate('find');
        return;
      }
      if (proposal.type === 'search.launch') {
        for (const siteId of proposal.arguments.siteIds) {
          const activeSearch = applyHouseholdPetFilters(
            freshSearch,
            freshHousehold,
          );
          const outcome = siteAccess
            ? await openRentalSite(siteId, activeSearch, siteAccess)
            : await openRentalSite(siteId, activeSearch);
          if (outcome.message) setError(outcome.message);
        }
        setOutcome(proposal.id, 'applied');
        return;
      }
      if (proposal.type === 'workspace.navigate') {
        setOutcome(proposal.id, 'applied');
        navigate(proposal.arguments.destination);
        return;
      }
      if (isSavedListingProposal(proposal)) {
        const targets = scopedSavedListings.filter(
          (record) => record.id === proposal.arguments.listingId,
        );
        if (
          !response.contextRevision ||
          proposal.contextRevision !== response.contextRevision ||
          targets.length !== 1 ||
          !updateSavedListing
        ) {
          setOutcome(proposal.id, 'stale');
          return;
        }
        const resultRevision = await updateSavedListing(proposal);
        setOutcome(proposal.id, 'applied', resultRevision);
        return;
      }
      if (!analysis || !updateAnalysis) {
        setOutcome(proposal.id, 'stale');
        return;
      }
      await updateAnalysis(proposal);
      setOutcome(proposal.id, 'applied');
    } catch (cause) {
      setOutcome(proposal.id, 'failed');
      setError(
        cause instanceof Error ? cause.message : 'Could not apply this change.',
      );
    } finally {
      applyingRef.current = false;
      setApplyingProposalId(undefined);
    }
  };

  const statusFor = (proposalId: string) =>
    outcomes.find((item) => item.proposalId === proposalId)?.status;

  const startNewChat = () => {
    if (pending || applyingRef.current || openingConversationId || deletingId)
      return;
    resetConversation();
    setHistoryOpen(false);
  };

  const currentListingLabel =
    analysis?.listing.identity.listingTitle?.value ||
    analysis?.listing.identity.fullAddress?.value;
  const contextLabel = usingSavedListings
    ? activeSavedListingIds.length === 1
      ? `Using saved rental: ${savedListingLabel(scopedSavedListings[0])}`
      : `Using ${activeSavedListingIds.length} saved rentals`
    : currentListingLabel
      ? `Using current rental: ${currentListingLabel}`
      : 'Choose saved rentals for this chat';

  return (
    <main className="assistant-workspace">
      <div className="assistant-actions">
        <button
          type="button"
          className="chat-history-toggle"
          aria-expanded={historyOpen}
          disabled={
            !conversationLoaded || pending || Boolean(openingConversationId)
          }
          onClick={toggleHistory}
        >
          <HistoryIcon />
          History
        </button>
        <button
          type="button"
          className="new-chat"
          disabled={
            !conversationLoaded ||
            search === undefined ||
            Boolean(applyingProposalId) ||
            pending ||
            Boolean(openingConversationId) ||
            Boolean(deletingId) ||
            (!messages.length && !conversationId)
          }
          onClick={startNewChat}
        >
          <NewChatIcon />
          New chat
        </button>
      </div>
      {historyOpen ? (
        <ConversationHistory
          conversations={conversations}
          activeConversationId={conversationId}
          loading={historyLoading}
          loadingMore={historyLoadingMore}
          error={historyError}
          nextCursor={historyCursor}
          deletingId={deletingId}
          deleteCandidateId={deleteCandidateId}
          onOpen={(selectedId) => void openConversation(selectedId)}
          onLoadMore={() => {
            if (historyCursor) void loadConversationList(historyCursor);
          }}
          onRetry={() => void loadConversationList()}
          onRequestDelete={setDeleteCandidateId}
          onCancelDelete={() => setDeleteCandidateId(undefined)}
          onConfirmDelete={(selectedId) =>
            void confirmDeleteConversation(selectedId)
          }
        />
      ) : null}
      <header className="assistant-heading">
        <span className="eyebrow">RentSight assistant</span>
        <h1>
          {usingSavedListings
            ? activeSavedListingIds.length === 1
              ? 'Ask about this saved rental'
              : 'Ask about your saved rentals'
            : 'Ask about your rental'}
        </h1>
        <p>
          {usingSavedListings
            ? 'Review or update saved listing details, costs, fees, and notes, or compare rentals in this chat.'
            : 'Understand costs, explore an area, or describe the rental you want to find.'}
        </p>
        {savedListings.length ? (
          <details className="assistant-context-picker">
            <summary>
              <span className="assistant-context">{contextLabel}</span>
              <span className="disclosure-icon" aria-hidden="true" />
            </summary>
            <div className="assistant-context-options">
              <p>Choose the current page or up to five saved rentals.</p>
              {analysis ? (
                <div className="assistant-context-group">
                  <span className="assistant-context-group-label">
                    Current page
                  </span>
                  <button
                    type="button"
                    className={`assistant-context-option${!usingSavedListings ? ' selected' : ''}`}
                    aria-pressed={!usingSavedListings}
                    onClick={() => updateSavedListingScope([])}
                  >
                    <span className="assistant-context-option-copy">
                      <strong>{currentListingLabel || 'Current rental'}</strong>
                      <small>Open in this tab</small>
                    </span>
                    {!usingSavedListings ? (
                      <span className="assistant-context-option-state">
                        In chat
                      </span>
                    ) : null}
                  </button>
                </div>
              ) : null}
              <div className="assistant-context-group">
                <span className="assistant-context-group-label">
                  Saved rentals
                </span>
                {savedListings.map((record) => {
                  const selected = activeSavedListingIds.includes(record.id);
                  return (
                    <button
                      type="button"
                      className={`assistant-context-option${selected ? ' selected' : ''}`}
                      aria-pressed={selected}
                      disabled={!selected && activeSavedListingIds.length >= 5}
                      key={record.id}
                      onClick={() =>
                        updateSavedListingScope(
                          !selected
                            ? [...activeSavedListingIds, record.id]
                            : activeSavedListingIds.filter(
                                (id) => id !== record.id,
                              ),
                        )
                      }
                    >
                      <span className="assistant-context-option-copy">
                        <strong>{savedListingLabel(record)}</strong>
                        <small>Saved rental</small>
                      </span>
                      {selected ? (
                        <span className="assistant-context-option-state">
                          In chat
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </details>
        ) : (
          <span className="assistant-context">{contextLabel}</span>
        )}
        {usingSavedListings ? (
          <span className="assistant-history-context">
            Answers use the details saved in RentSight. Suggested changes are
            applied only after you approve them.
          </span>
        ) : null}
        {conversationId ? (
          <span className="assistant-history-context">
            Continuing this chat uses the context selected above. Opening
            history does not restore old listing inputs.
          </span>
        ) : null}
      </header>

      <section className="assistant-thread" aria-live="polite" ref={threadRef}>
        {openingConversationId ? (
          <p className="assistant-history-state" role="status">
            Loading conversation…
          </p>
        ) : null}
        {turnsCursor ? (
          <button
            type="button"
            className="assistant-older-turns"
            disabled={olderTurnsLoading}
            onClick={() => void loadOlderTurns()}
          >
            {olderTurnsLoading
              ? 'Loading older messages…'
              : 'Load older messages'}
          </button>
        ) : null}
        {conversationLoaded && !messages.length && (
          <div className="assistant-starters">
            {(usingSavedListings
              ? [
                  ...(activeSavedListingIds.length > 1
                    ? ['Compare the true monthly costs of these rentals.']
                    : []),
                  'What fees or costs should I verify?',
                  'Summarize the most important saved details.',
                ]
              : [
                  ...(analysis
                    ? [
                        'Why does this cost more than the listed rent?',
                        'What should I verify before applying?',
                      ]
                    : []),
                  'Find me a two-bedroom under $2,800 with in-unit laundry.',
                ]
            ).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void submitMessage(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {messages.map((message) => (
          <ConversationMessageCard
            key={message.id}
            message={message}
            animateResponse={
              animateResponses &&
              message.role === 'assistant' &&
              message.animate === true
            }
            statusFor={statusFor}
            apply={apply}
            applyingProposalId={applyingProposalId}
            dismiss={(proposalId) => setOutcome(proposalId, 'rejected')}
            submitMessage={submitMessage}
            resolveSavedListing={(proposal) =>
              scopedSavedListings.find(
                (record) => record.id === proposal.arguments.listingId,
              )
            }
          />
        ))}
        {pending && (
          <p className="assistant-thinking">Thinking about your rental…</p>
        )}
        {error && (
          <div className="assistant-error status error" role="alert">
            <p>{error}</p>
            {failedRequest && (
              <button
                type="button"
                className="secondary-action"
                disabled={pending}
                onClick={() => void executeRequest(failedRequest, false)}
              >
                Try again
              </button>
            )}
          </div>
        )}
        {storageError && (
          <p className="assistant-storage-error" role="status">
            {storageError}
          </p>
        )}
      </section>

      <form
        className="assistant-composer"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void submitMessage(draft);
        }}
      >
        <label htmlFor="assistant-message">Ask RentSight</label>
        <textarea
          id="assistant-message"
          value={draft}
          rows={3}
          maxLength={4_000}
          placeholder="Ask about costs, fees, the area, or your next search…"
          disabled={
            !conversationLoaded ||
            search === undefined ||
            Boolean(applyingProposalId) ||
            Boolean(openingConversationId) ||
            Boolean(deletingId)
          }
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submitMessage(draft);
            }
          }}
        />
        <button
          type="submit"
          className="primary-action"
          disabled={
            !conversationLoaded ||
            search === undefined ||
            Boolean(applyingProposalId) ||
            pending ||
            Boolean(openingConversationId) ||
            Boolean(deletingId) ||
            !draft.trim()
          }
        >
          {pending ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </main>
  );
}
