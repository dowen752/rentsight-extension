import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AiState } from '../ai/session';
import type { RentalAnalysis } from '../shared/analysis';
import { adaptExtraction } from '../ai/adapter';
import { formatReviewIssue } from './reviewIssueLabels';

export interface AiControls {
  state: AiState;
  retry: () => void;
  continueWithPreliminary: () => void;
}
export function AiExtractionCard({ controls }: { controls: AiControls }) {
  const { state } = controls;
  const cardRef = useRef<HTMLElement>(null);
  const footprint = useRef({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    // Preserve the space already occupied before paint: status changes must
    // not pull the listing inputs up when the progress section disappears.
    const keepFootprint = () => {
      const width = card.getBoundingClientRect().width;
      if (Math.abs(width - footprint.current.width) > 1) {
        card.style.minHeight = '';
        footprint.current = { width, height: 0 };
      }
      const height = Math.max(
        footprint.current.height,
        card.getBoundingClientRect().height,
      );
      footprint.current = { width, height };
      card.style.minHeight = `${height}px`;
    };
    keepFootprint();
    const observer = new ResizeObserver(keepFootprint);
    observer.observe(card);
    return () => observer.disconnect();
  }, [state]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state.status !== 'failed') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state]);
  if (state.status === 'idle') return null;
  const running = state.status === 'preparing' || state.status === 'extracting';
  const failed = state.status === 'failed' && !state.continued;
  const wait = failed
    ? Math.max(0, Math.ceil((state.retryAt - now) / 1000))
    : 0;
  return (
    <section
      ref={cardRef}
      className={`ai-extraction-card ai-${state.status}`}
      aria-label="AI listing review"
      aria-busy={running}
    >
      <div className="ai-card-heading">
        <span className="ai-orbit" aria-hidden="true">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
            focusable="false"
          >
            <path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M21 16v4a1 1 0 0 1-1 1h-4M8 21H4a1 1 0 0 1-1-1v-4M8 10h8M8 14h5" />
          </svg>
        </span>
        <div>
          <span className="ai-eyebrow">RENTSIGHT AI</span>
          <h2>
            {running
              ? state.status === 'preparing'
                ? 'Preparing the listing review'
                : 'Reviewing the listing details'
              : failed
                ? 'AI review couldn’t finish'
                : state.status === 'failed' && state.continued
                  ? 'Using preliminary details'
                  : 'AI review complete'}
          </h2>
        </div>
      </div>
      <p role="status" aria-live="polite">
        {running
          ? state.status === 'preparing'
            ? 'Gathering the listing details needed for AI review.'
            : 'Initial details are ready. AI is checking the listing for rent, fees, and lease conditions.'
          : failed
            ? state.message
            : state.status === 'failed' && state.continued
              ? 'Check the preliminary values carefully before confirming.'
              : 'The listing baseline has been updated. Your edits are preserved.'}
      </p>
      {running && (
        <>
          <div className="ai-scan-track" aria-hidden="true">
            <span />
          </div>
          <div className="ai-stages">
            <span>✓ Initial details</span>
            <strong>
              {state.status === 'preparing' ? 'Preparing review' : 'AI review'}
            </strong>
            <span>Your confirmation</span>
          </div>
          <p className="ai-card-hint">
            You can keep editing. Confirm will be available when the review
            finishes.
          </p>
        </>
      )}
      {failed && (
        <div className="ai-card-actions">
          {state.retryMode !== 'none' && (
            <button type="button" disabled={wait > 0} onClick={controls.retry}>
              {wait ? `Retry in ${wait}s` : 'Retry AI extraction'}
            </button>
          )}
          <button type="button" onClick={controls.continueWithPreliminary}>
            Continue with preliminary values
          </button>
        </div>
      )}
    </section>
  );
}

export function AiSourceReview({
  analysis,
  update,
}: {
  analysis: RentalAnalysis;
  update: (transform: (current: RentalAnalysis) => RentalAnalysis) => void;
}) {
  const response = analysis.aiExtraction;
  if (!response) return null;
  const { manualCharges } = adaptExtraction(response);
  return (
    <section className="ai-source-review">
      {manualCharges.length > 0 && (
        <div className="warning">
          <h2>Review charges and offers</h2>
          <p>These details need your decision before calculating.</p>
          {manualCharges.map((charge) => (
            <div className="ai-charge" key={charge.id}>
              <strong>{charge.label}</strong>
              <p>{charge.detail}</p>
              <label>
                How should this affect your calculation?
                <select
                  value={analysis.aiReviewDecisions?.[charge.id] ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    update((current) => {
                      const next = structuredClone(current);
                      next.aiReviewDecisions ??= {};
                      if (value === 'entered' || value === 'excluded')
                        next.aiReviewDecisions[charge.id] = value;
                      else delete next.aiReviewDecisions[charge.id];
                      next.updatedAt = new Date().toISOString();
                      return next;
                    });
                  }}
                >
                  <option value="">Select an option</option>
                  <option value="entered">Amount added to inputs</option>
                  <option value="excluded">Doesn’t apply</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      )}
      <details className="review-disclosure">
        <summary>AI source details</summary>
        <div className="review-disclosure-content">
          <p>These notes describe the extracted baseline, before your edits.</p>
          {response.result.reviewIssues.map((issue) => (
            <p key={issue.id}>{formatReviewIssue(issue)}</p>
          ))}
          {response.result.notes.map((note) => (
            <p key={note.id}>{note.text}</p>
          ))}
          {response.result.evidence.map((item) => (
            <blockquote key={item.id}>{item.quote}</blockquote>
          ))}
          <details>
            <summary>Property facts and qualifications</summary>
            <dl className="ai-facts">
              {Object.entries(response.result.property).map(([key, field]) => (
                <div key={key}>
                  <dt>{humanLabel(key)}</dt>
                  <dd>{describeFact(field)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </details>
    </section>
  );
}

const humanLabel = (value: string) =>
  value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
function describeFact(value: unknown): string {
  if (value === null || value === undefined) return 'Not stated';
  if (Array.isArray(value))
    return value.length ? value.map(describeFact).join('; ') : 'None stated';
  if (typeof value !== 'object') return humanLabel(String(value));
  const record = value as Record<string, unknown>;
  if ('status' in record) {
    const scope =
      record.scope === 'unknown'
        ? ''
        : ` (${humanLabel(String(record.scope))})`;
    if (record.status === 'conflict')
      return `Conflicting claims: ${describeFact(record.candidates)}${scope}`;
    if (record.status === 'not_applicable') return 'Not applicable';
    if (record.status === 'unknown') return 'Not stated';
    return `${describeFact(record.value)}${scope}`;
  }
  if ('minMinor' in record) {
    const format = (amount: unknown) =>
      amount === null
        ? null
        : `${record.currency} ${(Number(amount) / 100).toFixed(2)}`;
    const min = format(record.minMinor),
      max = format(record.maxMinor);
    const bounds =
      record.kind === 'exact'
        ? min
        : min === null
          ? `Up to ${max}`
          : max === null
            ? `From ${min}`
            : `${min}–${max}`;
    return `${bounds}, ${humanLabel(String(record.frequency))}, ${humanLabel(String(record.basis))}`;
  }
  if ('min' in record) {
    const bounds =
      record.kind === 'exact'
        ? record.min
        : record.min === null
          ? `up to ${record.max}`
          : record.max === null
            ? `from ${record.min}`
            : `${record.min}–${record.max}`;
    return `${bounds} ${humanLabel(String(record.unit))}`;
  }
  return Object.entries(record)
    .filter(([key]) => !['id', 'evidenceIds'].includes(key))
    .map(([key, entry]) => `${humanLabel(key)}: ${describeFact(entry)}`)
    .join(' · ');
}
