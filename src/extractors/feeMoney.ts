export interface FeeMoney {
  exact?: number;
  display: string;
  currency: string;
}
const moneyPattern =
  /(?:\$\s*|\b(?:USD|CAD|AUD|EUR|GBP)\s+)([\d,]+(?:\.\d{1,2})?)/gi;
export function parseFeeMoney(text: string, qualifications = text): FeeMoney {
  const currency =
    qualifications.match(/\b(USD|CAD|AUD|EUR|GBP)\b/i)?.[1]?.toUpperCase() ??
    (/[£€]/.test(qualifications) ? 'foreign' : 'USD');
  const matches = [...text.matchAll(moneyPattern)];
  // A bounded label/value fact or price cell can be monetary without a symbol
  // (for example "Security Deposit: 3995.0"). Do not infer bare prose numbers.
  const bare = text.match(/(?:^|:\s*)([\d,]+(?:\.\d{1,2})?)\s*$/);
  if (!matches.length && bare)
    return parseFeeMoney(`$${bare[1]}`, qualifications);
  const amounts = matches.map((m) => Number(m[1].replaceAll(',', '')));
  const format = (value: number) =>
    `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (!amounts.length)
    return {
      exact:
        /^(?:free|no charge)\b/i.test(text.trim()) ||
        /:\s*(?:free|no charge)\b/i.test(text)
          ? 0
          : undefined,
      display: /\bfree\b|\bno charge\b/i.test(text)
        ? '$0'
        : /\bincluded\b/i.test(text)
          ? 'included'
          : 'amount not listed',
      currency,
    };
  const bounds =
    amounts.length === 2 &&
    /(?:-|–|—|\bto\b)/i.test(
      text.slice(
        (matches[0].index ?? 0) + matches[0][0].length,
        matches[1].index,
      ),
    );
  const qualified =
    /\b(up to|starting (?:at|from)|from|at least|not to exceed|varies)\b|\b(?:maximum|minimum)(?:\s+(?:fee|charge|amount))?\s*(?:[:$]|$)|%/i.test(
      qualifications,
    );
  const unique = [...new Set(amounts)];
  const display = bounds
    ? `${format(amounts[0])}–${format(amounts[1])}`
    : `${/\b(up to|not to exceed|maximum)\b/i.test(qualifications) ? 'up to ' : /\b(starting|from|at least|minimum)\b/i.test(qualifications) ? 'from ' : ''}${format(amounts[0])}`;
  return {
    exact:
      currency === 'USD' && !qualified && unique.length === 1
        ? unique[0]
        : undefined,
    display: currency === 'USD' ? display : `${display} ${currency}`,
    currency,
  };
}
export function feeCadence(text: string, context: string) {
  const signals = (value: string) =>
    new Set(
      [
        /\bmonthly\b|per month|\/mo(?:nth)?\b|monthly-section/i.test(value)
          ? 'monthly'
          : undefined,
        /\bweekly\b|per week|\/w(?:ee)?k\b/i.test(value) ? 'weekly' : undefined,
        /\bannual(?:ly)?\b|\byearly\b|per year|\/y(?:ea)?r\b/i.test(value)
          ? 'yearly'
          : undefined,
        /\bone[- ]time\b|\bonce\b|due at signing|move[- ]in costs|application costs|move-in-section/i.test(
          value,
        )
          ? 'one_time'
          : undefined,
        /per occurrence/i.test(value) ? 'per_occurrence' : undefined,
      ].filter(
        (
          v,
        ): v is
          'monthly' | 'weekly' | 'yearly' | 'one_time' | 'per_occurrence' =>
          v !== undefined,
      ),
    );
  const explicit = signals(text);
  if (explicit.size > 1) return 'conflict';
  const inferred = explicit.size ? explicit : signals(context);
  return inferred.size === 1
    ? [...inferred][0]
    : inferred.size
      ? 'conflict'
      : 'unknown';
}
