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
  const supportingText = rawText?.trim().replace(/\s+/g, ' ').slice(0, 500);
  return {
    value,
    source: 'listing',
    confidence,
    note: supportingText ? `Supporting text: ${supportingText}` : undefined,
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

export function classifyNoPetsPolicy(text: string): string | undefined {
  return text.match(
    /\b(?:no pets(?:\s+(?:allowed|permitted))?|pets?\s+(?:are\s+)?not\s+(?:allowed|permitted)|pet-free\s+(?:property|home|community))\b/i,
  )?.[0];
}

const UTILITY_PHRASES: Record<UtilityCategory, RegExp> = {
  electricity:
    /electric(?:ity)?\s+(?:is\s+)?included|rent\s+includes?\s+electric(?:ity)?/i,
  naturalGas:
    /(?:natural\s+)?gas\s+(?:is\s+)?included|rent\s+includes?\s+(?:natural\s+)?gas/i,
  water: /water\s+(?:is\s+)?included|rent\s+includes?\s+water/i,
  sewer: /sewer\s+(?:is\s+)?included|rent\s+includes?\s+sewer/i,
  trash: /trash\s+(?:is\s+)?included|rent\s+includes?\s+trash/i,
  internet: /internet\s+(?:is\s+)?included|rent\s+includes?\s+internet/i,
};

export function classifyIncludedUtilities(text: string): UtilityCategory[] {
  if (
    /all utilities(?:\s+and\s+[^.;\n]{1,80})?\s+(?:are\s+)?included|includ(?:e|es|ing)\s+all utilities/i.test(
      text,
    )
  )
    return Object.keys(UTILITY_PHRASES) as UtilityCategory[];
  const found = new Set<UtilityCategory>();
  const addUtilitiesIn = (clause: string) => {
    if (/\belectric(?:ity)?\b/i.test(clause)) found.add('electricity');
    if (/\b(?:natural\s+)?gas\b/i.test(clause)) found.add('naturalGas');
    if (/\bwater\b/i.test(clause)) found.add('water');
    if (/\bsewer\b/i.test(clause)) found.add('sewer');
    if (/\b(?:trash|compost|recycl(?:e|ing))\b/i.test(clause))
      found.add('trash');
    if (/\b(?:internet|wi-?fi)\b/i.test(clause)) found.add('internet');
  };
  for (const match of text.matchAll(
    /(?:^|[.;\n])\s*([^.;\n]{1,240})\b(?:is|are)\s+included\b/gi,
  )) {
    addUtilitiesIn(match[1]);
  }
  for (const match of text.matchAll(/([^.;\n]{0,120})\bincluded\b/gi)) {
    if (/\bnot\s*$/i.test(match[1])) continue;
    addUtilitiesIn(match[1]);
  }
  for (const match of text.matchAll(
    /\butilities?\s+(?:are\s+)?included(?:\s+in\s+(?:the\s+)?rent)?\s*[:-]?\s*([^.;\n]{1,240})/gi,
  )) {
    addUtilitiesIn(match[1]);
  }
  for (const match of text.matchAll(
    /\b(?:rent\s+includes?|(?:landlord|owner)\s+pays(?:\s+for)?)\s+([^.;\n]{1,240})/gi,
  )) {
    addUtilitiesIn(match[1]);
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
    /(\d{1,6}\s+[^,\n]+)(?:,\s*((?:#|unit|apt\.?|apartment)\s*[^,\n]+))?,\s*([A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/i,
  );
  return match
    ? {
        // RentalListing stores locality fields separately, so fullAddress is
        // the street/unit portion shown in the Address editor.
        fullAddress: [match[1].trim(), match[2]?.trim()]
          .filter(Boolean)
          .join(', '),
        city: match[3].trim(),
        state: match[4].toUpperCase(),
        zipCode: match[5],
      }
    : undefined;
}
