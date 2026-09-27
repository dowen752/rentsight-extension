import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const REVEAL_INTERVAL_MS = 28;
const MAX_REVEAL_STEPS = 70;

const prefersReducedMotion = () =>
  typeof globalThis.matchMedia === 'function' &&
  globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function AssistantMarkdown({
  text,
  animate = false,
  onRevealComplete,
}: {
  text: string;
  animate?: boolean;
  onRevealComplete?: () => void;
}) {
  const characters = useMemo(() => Array.from(text), [text]);
  const shouldAnimate = animate && !prefersReducedMotion();
  const [visibleCount, setVisibleCount] = useState(
    shouldAnimate ? 0 : characters.length,
  );
  const onRevealCompleteRef = useRef(onRevealComplete);

  useEffect(() => {
    onRevealCompleteRef.current = onRevealComplete;
  }, [onRevealComplete]);

  useEffect(() => {
    if (!shouldAnimate) {
      onRevealCompleteRef.current?.();
      return;
    }

    const charactersPerStep = Math.max(
      1,
      Math.ceil(characters.length / MAX_REVEAL_STEPS),
    );
    let completed = false;
    const timer = globalThis.setInterval(() => {
      setVisibleCount((current) => {
        const next = Math.min(characters.length, current + charactersPerStep);
        if (next === characters.length && !completed) {
          completed = true;
          globalThis.clearInterval(timer);
          onRevealCompleteRef.current?.();
        }
        return next;
      });
    }, REVEAL_INTERVAL_MS);

    return () => globalThis.clearInterval(timer);
  }, [characters, shouldAnimate]);

  const displayedCount = shouldAnimate ? visibleCount : characters.length;
  const isRevealing = displayedCount < characters.length;

  return (
    <div className="assistant-response-body">
      <div
        className="assistant-markdown"
        aria-hidden={isRevealing || undefined}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          components={{
            a: ({ children, ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            img: ({ alt }) =>
              alt ? (
                <span className="assistant-image-alt">[Image: {alt}]</span>
              ) : null,
          }}
        >
          {characters.slice(0, displayedCount).join('')}
        </ReactMarkdown>
        {isRevealing ? (
          <span className="assistant-stream-cursor" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  );
}
