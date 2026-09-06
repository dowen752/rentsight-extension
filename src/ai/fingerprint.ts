import type { CaptureContext } from './types';

const RELEVANT =
  /\b(rent|price|fee|deposit|utilit|lease|month|bed|bath|sq\.?\s*ft|square feet|available|availability|special|promotion|address|property|unit|floor\s*plan)\b|\$\s?\d/i;
const RELATIVE_TIME =
  /\b(today|yesterday|\d+\s+(?:minutes?|hours?|days?)\s+ago|updated\s+\d+)\b/gi;

const normalize = (value: string) =>
  value.replace(RELATIVE_TIME, '').replace(/\s+/g, ' ').trim().toLowerCase();

export function relevantContentFingerprint(context: CaptureContext): string {
  const signals = [
    ...context.preliminaryValues.map(
      (item) => `${item.fieldPath}:${JSON.stringify(item.value)}`,
    ),
    ...context.capture.blocks
      .filter((block) => block.kind === 'json_ld' || RELEVANT.test(block.text))
      .map((block) => `${block.kind}:${normalize(block.text)}`),
  ];
  const stable = [...new Set(signals.filter(Boolean))].sort().join('\n');
  // Stable local hash; this is change detection, not a security primitive.
  let hash = 2166136261;
  for (let index = 0; index < stable.length; index++) {
    hash ^= stable.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fp1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
