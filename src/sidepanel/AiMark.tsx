export function AiMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`ai-mark ${className}`.trim()}
      aria-label="Added by RentSight AI"
      title="Added by RentSight AI"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        aria-hidden="true"
      >
        <path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M21 16v4a1 1 0 0 1-1 1h-4M8 21H4a1 1 0 0 1-1-1v-4M8 10h8M8 14h5" />
      </svg>
    </span>
  );
}
