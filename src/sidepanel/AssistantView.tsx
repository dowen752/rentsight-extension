import { useMemo, useState, type FormEvent } from 'react';
import {
  ASSISTANT_ACTION_VERSIONS,
  assistantContextForAnalysis,
  assistantContextRevision,
  type AssistantActionOutcome,
  type AssistantProposal,
  type AssistantRequest,
  type AssistantResponse,
} from '../assistant';
import { rentSightApi } from '../backend/services';
import type { SavedListingRecord } from '../saved';
import {
  getSearchProfile,
  setSearchProfile,
  type RentalSearch,
} from '../search';
import type { RentalAnalysis } from '../shared/analysis';
import { AssistantMarkdown } from './AssistantMarkdown';

type AssistantTab = 'find' | 'current' | 'saved' | 'compare';

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AssistantResponse;
}

const randomId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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

function proposalSummary(proposal: AssistantProposal): string {
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
  if (proposal.type === 'analysis.set_cost')
    return `${label(proposal.arguments.category)}: $${proposal.arguments.amount.toLocaleString()} ${proposal.arguments.frequency === 'monthly' ? 'per month' : 'one time'}`;
  if (proposal.type === 'property_note.add') return proposal.arguments.text;
  return `Open ${label(proposal.arguments.destination)}`;
}

function ProposalCard({
  proposal,
  status,
  onApply,
  onDismiss,
}: {
  proposal: AssistantProposal;
  status?: AssistantActionOutcome['status'];
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="assistant-proposal">
      <strong>{proposal.explanation}</strong>
      <p>{proposalSummary(proposal)}</p>
      {status ? (
        <span className={`assistant-proposal-status ${status}`}>
          {label(status)}
        </span>
      ) : (
        <div>
          <button type="button" className="primary-action" onClick={onApply}>
            {proposal.type === 'workspace.navigate' ? 'Open' : 'Apply'}
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={onDismiss}
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
}: {
  message: ConversationMessage;
  animateResponse: boolean;
  statusFor: (
    proposalId: string,
  ) => AssistantActionOutcome['status'] | undefined;
  apply: (
    proposal: AssistantProposal,
    response: AssistantResponse,
  ) => Promise<void>;
  dismiss: (proposalId: string) => void;
  submitMessage: (message: string) => Promise<void>;
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
        ? message.response?.proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              status={statusFor(proposal.id)}
              onApply={() => void apply(proposal, message.response!)}
              onDismiss={() => dismiss(proposal.id)}
            />
          ))
        : null}
      {revealComplete && message.response?.followUpSuggestions?.length ? (
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

export function AssistantView({
  analysis,
  savedListings,
  updateAnalysis,
  navigate,
  sendMessage = (request) => rentSightApi.sendAssistantMessage(request),
  animateResponses = true,
}: {
  analysis?: RentalAnalysis;
  savedListings: SavedListingRecord[];
  updateAnalysis?: (proposal: AssistantProposal) => void;
  navigate: (tab: AssistantTab) => void;
  sendMessage?: (request: AssistantRequest) => Promise<AssistantResponse>;
  animateResponses?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [outcomes, setOutcomes] = useState<AssistantActionOutcome[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [failedRequest, setFailedRequest] = useState<AssistantRequest>();
  const revision = assistantContextRevision(analysis);
  const context = useMemo(
    () => assistantContextForAnalysis(analysis, savedListings),
    [analysis, savedListings],
  );

  const executeRequest = async (
    request: AssistantRequest,
    appendUserMessage: boolean,
  ) => {
    if (pending) return;
    if (appendUserMessage) {
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
      const response = await sendMessage(request);
      setFailedRequest(undefined);
      setConversationId(response.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: response.messageId,
          role: 'assistant',
          text: response.message.text,
          response,
        },
      ]);
      setOutcomes([]);
    } catch (cause: unknown) {
      setFailedRequest(request);
      setError(
        cause instanceof Error
          ? cause.message
          : 'RentSight could not answer right now.',
      );
    } finally {
      setPending(false);
    }
  };

  const submitMessage = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || pending) return;
    const request: AssistantRequest = {
      schemaVersion: '1.0',
      clientRequestId: randomId(),
      ...(conversationId ? { conversationId } : {}),
      message: trimmed,
      contextRevision: revision,
      context,
      capabilities: { actions: ASSISTANT_ACTION_VERSIONS },
      ...(outcomes.length ? { actionOutcomes: outcomes } : {}),
    };
    await executeRequest(request, true);
  };

  const setOutcome = (
    proposalId: string,
    status: AssistantActionOutcome['status'],
  ) =>
    setOutcomes((current) => [
      ...current.filter((item) => item.proposalId !== proposalId),
      { proposalId, status },
    ]);

  const apply = async (
    proposal: AssistantProposal,
    response: AssistantResponse,
  ) => {
    if (response.contextRevision && response.contextRevision !== revision) {
      setOutcome(proposal.id, 'stale');
      return;
    }
    try {
      if (proposal.type === 'search.patch') {
        const current = (await getSearchProfile()).search;
        const next: RentalSearch = { ...current, ...proposal.arguments.set };
        for (const key of proposal.arguments.clear) delete next[key];
        await setSearchProfile(next);
        setOutcome(proposal.id, 'applied');
        navigate('find');
        return;
      }
      if (proposal.type === 'workspace.navigate') {
        navigate(proposal.arguments.destination);
        setOutcome(proposal.id, 'applied');
        return;
      }
      if (!analysis || !updateAnalysis) {
        setOutcome(proposal.id, 'stale');
        return;
      }
      updateAnalysis(proposal);
      setOutcome(proposal.id, 'applied');
    } catch {
      setOutcome(proposal.id, 'failed');
    }
  };

  const statusFor = (proposalId: string) =>
    outcomes.find((item) => item.proposalId === proposalId)?.status;

  return (
    <main className="assistant-workspace">
      <header className="assistant-heading">
        <span className="eyebrow">RentSight assistant</span>
        <h1>Ask about your rental</h1>
        <p>
          Understand costs, explore an area, or describe the rental you want to
          find.
        </p>
        <span className="assistant-context">
          {analysis?.listing.identity.fullAddress?.value
            ? `Using ${analysis.listing.identity.fullAddress.value}`
            : 'No current listing — Find and saved rentals are still available'}
        </span>
      </header>

      <section className="assistant-thread" aria-live="polite">
        {!messages.length && (
          <div className="assistant-starters">
            {[
              ...(analysis
                ? [
                    'Why does this cost more than the listed rent?',
                    'What should I verify before applying?',
                  ]
                : []),
              'Find me a two-bedroom under $2,800 with in-unit laundry.',
            ].map((suggestion) => (
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
            animateResponse={animateResponses && message.role === 'assistant'}
            statusFor={statusFor}
            apply={apply}
            dismiss={(proposalId) => setOutcome(proposalId, 'rejected')}
            submitMessage={submitMessage}
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
          disabled={pending || !draft.trim()}
        >
          {pending ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </main>
  );
}
