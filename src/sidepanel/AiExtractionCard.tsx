import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AiState } from '../ai/session';
import type { RentalAnalysis } from '../shared/analysis';
import { adaptExtraction } from '../ai/adapter';
import { AiMark } from './AiMark';

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
          <AiMark />
        </span>
        <div>
          <span className="ai-eyebrow">RENTSIGHT AI</span>
          <h2>
            {running
              ? 'AI review in progress'
              : failed
                ? 'Your listing details are ready'
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
          {state.retryAction !== 'none' && (
            <button type="button" disabled={wait > 0} onClick={controls.retry}>
              {wait
                ? `Retry in ${wait}s`
                : state.retryAction === 'refresh'
                  ? 'Load listing and try again'
                  : 'Retry AI extraction'}
            </button>
          )}
          <button type="button" onClick={controls.continueWithPreliminary}>
            Review preliminary details
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
  if (!manualCharges.length) return null;
  return (
    <section className="ai-source-review">
      {manualCharges.length > 0 && (
        <div className="ai-extraction-flags">
          <h2>Flagged during extraction</h2>
          <p>
            Review what RentSight found. You can update the related inputs, keep
            any detail as a property note, or continue without changes.
          </p>
          {manualCharges.map((charge) => (
            <div className="ai-charge" key={charge.id}>
              <strong>{charge.label}</strong>
              <p>
                <span>Current understanding:</span> {charge.detail}
              </p>
              <label className="ai-charge-note-toggle">
                <input
                  type="checkbox"
                  checked={(analysis.propertyNotes ?? []).some(
                    (note) =>
                      note.source === 'ai' && note.sourceId === charge.id,
                  )}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    update((current) => {
                      const next = structuredClone(current);
                      next.aiReviewDecisions ??= {};
                      next.propertyNotes = (next.propertyNotes ?? []).filter(
                        (note) =>
                          !(
                            note.source === 'ai' && note.sourceId === charge.id
                          ),
                      );
                      if (checked) {
                        next.aiReviewDecisions[charge.id] = 'noted';
                        next.propertyNotes.push({
                          id: crypto.randomUUID(),
                          text: `${charge.label}: ${charge.detail}`,
                          source: 'ai',
                          sourceId: charge.id,
                        });
                      } else delete next.aiReviewDecisions[charge.id];
                      next.updatedAt = new Date().toISOString();
                      return next;
                    });
                  }}
                />
                <span>Keep as a property note</span>
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
