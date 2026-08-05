import type {
  LaundryType,
  SourcedValue,
  UtilityCategory,
} from '../calculations';
import type { RentEvidence } from './types';

export function listingValue<T>(
  value: T,
  confidence: number,
  rawText?: string,
): SourcedValue<T> {
  return {
    value,
    source: 'listing',
    confidence,
    note: rawText ? `Supporting text: ${rawText.trim()}` : undefined,
  };
}

export function parseMoney(text: string): number | undefined {
  const match = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return undefined;
  const amount = Number(match[1].replaceAll(',', ''));
  return Number.isFinite(amount) ? amount : undefined;
}

export function parseRentEvidence(
  texts: readonly string[],
  confidence: number,
): RentEvidence | undefined {
  const relevant = texts.map((text) => text.trim()).filter(Boolean);
  for (const text of relevant) {
    const range = text.match(/\$\s*([\d,]+)\s*(?:-|–|—|to)\s*\$?\s*([\d,]+)/i);
    if (range) {
      const minimum = Number(range[1].replaceAll(',', ''));
      const maximum = Number(range[2].replaceAll(',', ''));
      return {
        kind: 'range',
        minimum: listingValue(Math.min(minimum, maximum), confidence, text),
        maximum: listingValue(Math.max(minimum, maximum), confidence, text),
        rawText: text,
      };
    }
  }
  const candidates = relevant
    .map((rawText) => ({ rawText, amount: parseMoney(rawText) }))
    .filter(
      (item): item is { rawText: string; amount: number } =>
        item.amount !== undefined,
    );
  const unique = [...new Set(candidates.map(({ amount }) => amount))];
  if (unique.length === 1) {
    const rawText =
      candidates.find(({ amount }) => amount === unique[0])?.rawText ?? '';
    return {
      kind: 'single',
      amount: listingValue(unique[0], confidence, rawText),
      rawText,
    };
  }
  if (unique.length > 1) {
    return {
      kind: 'conflict',
      candidates: unique.map((amount) =>
        listingValue(
          amount,
          Math.min(confidence, 0.45),
          candidates.find((item) => item.amount === amount)?.rawText,
        ),
      ),
      rawText: candidates.map(({ rawText }) => rawText),
    };
  }
  return undefined;
}

export function parseNumberNear(
  text: string,
  label: RegExp,
): number | undefined {
  const match = text.match(label);
  return match ? Number(match[1].replaceAll(',', '')) : undefined;
}

export function classifyLaundry(text: string): LaundryType | undefined {
  if (/washer\s*(?:\/|and|&)\s*dryer\s+hookups?|w\/d hookups?/i.test(text))
    return 'hookups_only';
  if (
    /in[- ]unit (?:washer|laundry)|washer\s*(?:\/|and|&)\s*dryer in unit/i.test(
      text,
    )
  )
    return 'in_unit';
  if (
    /(?:coin|paid|card)[- ](?:op(?:erated)?|operated)?\s*(?:laundry|washer)|laundry.*\$(?:\d+)/i.test(
      text,
    )
  )
    return 'shared_paid';
  if (/free (?:shared )?laundry|laundry included/i.test(text))
    return 'shared_free';
  if (/no laundry|laundry unavailable/i.test(text)) return 'none';
  return undefined;
}

const UTILITY_PHRASES: Record<UtilityCategory, RegExp> = {
  electricity:
    /electric(?:ity)?\s+(?:is\s+)?included|includes?\s+electric(?:ity)?/i,
  naturalGas:
    /(?:natural\s+)?gas\s+(?:is\s+)?included|includes?\s+(?:natural\s+)?gas/i,
  water: /water\s+(?:is\s+)?included|includes?\s+water/i,
  sewer: /sewer\s+(?:is\s+)?included|includes?\s+sewer/i,
  trash: /trash\s+(?:is\s+)?included|includes?\s+trash/i,
  internet: /internet\s+(?:is\s+)?included|includes?\s+internet/i,
};

export function classifyIncludedUtilities(text: string): UtilityCategory[] {
  if (/all utilities (?:are )?included/i.test(text))
    return Object.keys(UTILITY_PHRASES) as UtilityCategory[];
  const found = new Set<UtilityCategory>();
  for (const match of text.matchAll(/([^.;\n]{0,120})\bincluded\b/gi)) {
    const clause = match[1];
    if (/\belectric(?:ity)?\b/i.test(clause)) found.add('electricity');
    if (/\b(?:natural\s+)?gas\b/i.test(clause)) found.add('naturalGas');
    if (/\bwater\b/i.test(clause)) found.add('water');
    if (/\bsewer\b/i.test(clause)) found.add('sewer');
    if (/\btrash\b/i.test(clause)) found.add('trash');
    if (/\binternet\b/i.test(clause)) found.add('internet');
  }
  for (const [category, pattern] of Object.entries(UTILITY_PHRASES) as [
    UtilityCategory,
    RegExp,
  ][]) {
    if (pattern.test(text)) found.add(category);
  }
  return [...found];
}

export function parseUsAddress(
  text: string,
):
  | { fullAddress: string; city: string; state: string; zipCode: string }
  | undefined {
  const match = text.match(
    /(\d{1,6}\s+[^,\n]+),\s*([A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/i,
  );
  return match
    ? {
        fullAddress: `${match[1].trim()}, ${match[2].trim()}, ${match[3]} ${match[4]}`,
        city: match[2].trim(),
        state: match[3],
        zipCode: match[4],
      }
    : undefined;
}
