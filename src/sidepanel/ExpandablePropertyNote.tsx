import { useId, useState } from 'react';

export function ExpandablePropertyNote({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const long = text.length > 120;
  const preview = text
    .slice(0, 120)
    .replace(/\s+\S*$/, '')
    .trimEnd();
  return (
    <span className="comparison-note-text">
      <span id={textId}>{long && !expanded ? preview : text}</span>
      {long && (
        <button
          type="button"
          className="comparison-note-toggle"
          aria-expanded={expanded}
          aria-controls={textId}
          aria-label={
            expanded ? 'Show less of property note' : 'Show full property note'
          }
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : '…'}
        </button>
      )}
    </span>
  );
}
