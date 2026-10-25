import type { ListingExtraction } from './types';
import { listingValue } from './parsers';
import {
  feeLike,
  readFeeRows,
  cleanFeeText,
  feeRoot,
  feeText,
  hasChargeLanguage,
} from './feeRows';
import { parseFeeMoney, feeCadence } from './feeMoney';
import {
  REALTOR_FEE_CARDS,
  REALTOR_NOISE,
  realtorFeeRows,
  realtorListingRoot,
  type RealtorFeeRow,
} from './realtorDom';
import type { RecurringCosts, UpfrontCosts } from '../calculations';

export interface ExtractedFee {
  id: string;
  label: string;
  amount: number;
  source: 'listing';
  evidence?: string;
}
export interface FeeNoteSuggestion {
  id: string;
  label: string;
  detail: string;
  evidence?: string;
}
export const feeIdentity = (label: string) =>
  `fee:${label
    .toLowerCase()
    .replace(/\(required\)/g, '')
    .replace(/\b(monthly|required|mandatory|optional)\b/g, '')
    .replace(/not to exceed/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()}`;

function applyRealtorFees(
  rows: RealtorFeeRow[],
  extraction: ListingExtraction,
  fees: Map<string, ExtractedFee>,
  notes: Map<string, FeeNoteSuggestion>,
  pricing: { headlineIncluded: boolean; explicitBaseRent: boolean },
) {
  const exactAmount = (row: RealtorFeeRow) =>
    parseFeeMoney(row.amountText, row.text).exact;
  const deposit = rows.find(
    (row) =>
      /^security deposit\b/i.test(row.label) &&
      row.applicability === 'required',
  );
  const credits = rows.filter(
    (row) =>
      /applied to security deposit/i.test(row.label) &&
      row.applicability === 'required',
  );
  const depositAmount = deposit && exactAmount(deposit);
  const combinedDeposit = Boolean(
    deposit &&
    depositAmount !== undefined &&
    /remaining balance/i.test(deposit.label) &&
    credits.length &&
    credits.every((row) => exactAmount(row) !== undefined),
  );
  if (combinedDeposit) {
    extraction.listing.upfront.securityDeposit = listingValue(
      depositAmount! + credits.reduce((sum, row) => sum + exactAmount(row)!, 0),
      0.95,
      [...credits, deposit!].map((row) => row.text).join('; '),
    );
  }
  for (const row of rows) {
    if (/^monthly base rent$/i.test(row.label)) continue;
    // Incidental penalties and replacement costs do not help budget an ordinary
    // tenancy. Their evidence remains available in the secondary source view.
    if (
      /additional access devices|early termination|late payment|lockout|replacement|returned payment/i.test(
        row.label,
      )
    )
      continue;
    const amount = exactAmount(row);
    const cadence = feeCadence(row.text, row.cadence.replace('_', '-'));
    const included =
      !pricing.explicitBaseRent &&
      (pricing.headlineIncluded ||
        /included (?:in|with) (?:the )?(?:advertised|monthly|rent|total)/i.test(
          row.text,
        ));
    if (combinedDeposit && (row === deposit || credits.includes(row))) continue;
    const label = row.label
      .replace(/\(\s*\$[^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const id = feeIdentity(label);
    const pet = /^pet rent\b/i.test(label);
    const required =
      row.applicability === 'required' &&
      !/\b(per vehicle|per person|per storage|if|optional|annual|yearly)\b/i.test(
        row.text,
      );
    const upfront: keyof UpfrontCosts | undefined = /^application\b/i.test(
      label,
    )
      ? 'applicationFee'
      : /^administrative\b/i.test(label)
        ? 'administrativeFee'
        : /^security deposit\b/i.test(label)
          ? 'securityDeposit'
          : /^pet deposit\b/i.test(label)
            ? 'petDeposit'
            : /^pet fee\b/i.test(label)
              ? 'petFee'
              : undefined;
    const recurring: keyof RecurringCosts | undefined = pet
      ? 'petRent'
      : /^parking\b/i.test(label)
        ? 'parking'
        : /^amenity\b/i.test(label)
          ? 'amenityFees'
          : /^(?:electric|electricity)(?: fee)?$/i.test(label)
            ? 'electricity'
            : /^(?:natural )?gas(?: fee)?$/i.test(label)
              ? 'naturalGas'
              : /^water(?: fee)?$/i.test(label)
                ? 'water'
                : /^sewer(?: fee)?$/i.test(label)
                  ? 'sewer'
                  : /^trash(?: removal| fee)?$/i.test(label)
                    ? 'trash'
                    : /^internet(?: fee)?$/i.test(label)
                      ? 'internet'
                      : undefined;
    if (
      amount !== undefined &&
      !included &&
      cadence === 'monthly' &&
      (required || pet)
    ) {
      if (recurring)
        extraction.listing.recurring[recurring] = listingValue(
          amount,
          0.95,
          row.text,
        );
      else {
        fees.set(id, {
          id,
          label: `${label} (required)`,
          amount,
          source: 'listing',
          evidence: row.text,
        });
        notes.delete(id);
      }
    } else if (
      amount !== undefined &&
      cadence === 'one_time' &&
      required &&
      upfront &&
      !(row === deposit && /remaining balance/i.test(row.label))
    ) {
      extraction.listing.upfront[upfront] = listingValue(
        amount,
        0.95,
        row.text,
      );
    } else if (
      amount !== undefined ||
      /\$|\b(?:USD|CAD|AUD|EUR|GBP)\b/i.test(row.amountText)
    ) {
      // Only concrete costs merit a note here. Variable utilities are already
      // editable estimated inputs; repeating them as warnings adds no decision.
      notes.set(id, {
        id,
        label,
        detail:
          [
            row.applicability === 'optional'
              ? 'Optional'
              : row.applicability === 'required'
                ? 'Required'
                : 'Conditional charge',
            parseFeeMoney(row.amountText, row.text).display +
              (cadence === 'monthly' ? '/month' : ''),
            cadence === 'weekly'
              ? 'weekly'
              : cadence === 'yearly'
                ? 'yearly'
                : '',
            cadence === 'conflict' ? 'payment timing conflicts' : '',
            row.label.match(
              /\bper (?:adult applicant|vehicle|storage|pet|person)\b/i,
            )?.[0],
            /refundable/i.test(row.text) && !/nonrefundable/i.test(row.text)
              ? 'refundable'
              : '',
            included
              ? 'included in the advertised total · no extra charge added'
              : 'not included in the estimate',
          ]
            .filter(Boolean)
            .join(' · ') + '.',
        evidence: row.text,
      });
    }
  }
}

export function extractAdditionalFees(
  document: Document,
  extraction: ListingExtraction,
) {
  const fees = new Map<string, ExtractedFee>();
  const notes = new Map<string, FeeNoteSuggestion>();
  const realtor = extraction.siteName === 'Realtor.com';
  const upfrontTotals = new Map<
    keyof UpfrontCosts,
    { amount: number; texts: string[]; basis?: 'per_pet' | 'per_unit' }
  >();
  const standardMonthly = new Map<
    keyof RecurringCosts,
    { amount: number; texts: string[]; basis?: 'per_pet' | 'per_unit' }
  >();
  const seen = new Set<string>();
  const authoritative = new Set<string>();
  // Whole headline totals are retained as one value. A fee explicitly included
  // in that total must not be added again. Separate base-rent rows stay superior.
  const headlineIncluded = [
    ...feeRoot(document).querySelectorAll('p,[data-testid*="price"]'),
  ].some((node) => {
    const text = feeText(node);
    return (
      /^(?:rent\b|\$)/i.test(text) &&
      /includ(?:es|ing).*required.*(?:fees|charges)/i.test(text)
    );
  });
  const explicitBaseRent =
    /\bbase rent\b/i.test(
      extraction.listing.recurring.advertisedRent?.note ?? '',
    ) ||
    Boolean(feeRoot(document).querySelector('.base-rent-fee')) ||
    (realtor &&
      realtorFeeRows(realtorListingRoot(document)).some((row) =>
        /^monthly base rent$/i.test(row.label),
      ));
  if (realtor)
    applyRealtorFees(
      realtorFeeRows(realtorListingRoot(document)),
      extraction,
      fees,
      notes,
      { headlineIncluded, explicitBaseRent },
    );
  const oneTime = (label: string): keyof UpfrontCosts | undefined =>
    /\b(?:first|1st) month(?:'s)? rent\b/i.test(label)
      ? 'firstMonthsRent'
      : /\blast month(?:'s)? rent\b/i.test(label)
        ? 'lastMonthsRent'
        : /\bapplication|screening fee\b/i.test(label)
          ? 'applicationFee'
          : /\bsecurity deposit\b/i.test(label)
            ? 'securityDeposit'
            : /\bpet deposit\b/i.test(label)
              ? 'petDeposit'
              : /\bpet fee\b/i.test(label)
                ? 'petFee'
                : /\b(?:holding|utility|utilities|refundable).*deposit\b/i.test(
                      label,
                    )
                  ? 'utilityDeposits'
                  : /\b(?:admin|administrative) fee\b/i.test(label) &&
                      !/utility|utilities/i.test(label)
                    ? 'administrativeFee'
                    : undefined;
  const monthly = (label: string): keyof RecurringCosts | undefined =>
    /\bpet rent\b/i.test(label)
      ? 'petRent'
      : /\bparking|garage|carport\b/i.test(label)
        ? 'parking'
        : /\bamenity fee\b/i.test(label)
          ? 'amenityFees'
          : /^(?:electric|electricity)(?: fee| charge)?$/i.test(label)
            ? 'electricity'
            : /^(?:natural )?gas(?: fee| charge)?$/i.test(label)
              ? 'naturalGas'
              : /^water(?: fee| charge)?$/i.test(label)
                ? 'water'
                : /^sewer(?: fee| charge)?$/i.test(label)
                  ? 'sewer'
                  : /^trash(?: removal| fee| charge)?$/i.test(label)
                    ? 'trash'
                    : /^internet(?: fee| charge)?$/i.test(label)
                      ? 'internet'
                      : undefined;
  const cleared = new Set<string>();
  const clear = (
    group: 'recurring' | 'upfront',
    key: keyof RecurringCosts | keyof UpfrontCosts,
  ) => {
    const id = `${group}.${key}`;
    if (cleared.has(id)) return;
    delete (extraction.listing[group] as Record<string, unknown>)[key];
    cleared.add(id);
  };
  for (const row of readFeeRows(document)) {
    if (
      realtor &&
      (row.element.closest(REALTOR_FEE_CARDS + ',' + REALTOR_NOISE) ||
        /^Monthly Fees:/i.test(row.text))
    )
      continue;
    const prefix = row.text.match(
      /^(?:(required|optional)\s+)?monthly\s+fees?\s*:\s*/i,
    );
    const inherited = prefix
      ? `${row.context} monthly ${prefix[1] ?? 'required'}`
      : row.context;
    // Commas only delimit a new labeled charge; currency thousands and basis
    // qualifications stay inside their clause.
    const clauses = (prefix ? row.text.slice(prefix[0].length) : row.text)
      .split(/;|[.!?](?=\s|$)|,(?=\s*[A-Za-z][^,$;]*:\s*(?:\$|USD\b))/)
      .map(cleanFeeText)
      .filter(Boolean);
    for (const text of clauses) {
      if (
        !feeLike.test(row.labelText ?? text) ||
        text.length > 500 ||
        /^(?:est\.?|estimated)\s+total|^rent\b|^monthly base rent\b/i.test(
          row.labelText ?? text,
        )
      )
        continue;
      const contextKinds = [
        ...inherited.matchAll(/\b(required|optional)(?:-group)?\b/gi),
      ];
      const optional =
        /\b(optional|not required|if|penalty|late|lease[- ]break|early termination|per occurrence)\b/i.test(
          text,
        ) || contextKinds.at(-1)?.[1].toLowerCase() === 'optional';
      const explicitRequired =
        !optional &&
        (/\b(required|mandatory)\b/i.test(text) ||
          contextKinds.at(-1)?.[1].toLowerCase() === 'required');
      const amountText =
        optional && /\$|\bUSD\b/i.test(row.labelText ?? '')
          ? row.labelText!
          : (row.amountText ?? text);
      const qualification =
        row.amountText &&
        !/\b(up to|starting|varies)\b/i.test(row.amountText) &&
        !/\b(up to|starting at|from|at least|not to exceed|maximum fee|minimum fee)\b/i.test(
          row.labelText ?? '',
        )
          ? row.amountText
          : text;
      const money = parseFeeMoney(
        amountText,
        `${qualification} ${text.match(/\b(?:USD|CAD|AUD|EUR|GBP)\b/i)?.[0] ?? ''}`,
      );
      // Do this before clearing standard fields: an unpriced amenity must not
      // replace a real parking charge found elsewhere on the page.
      if (
        money.display === 'amount not listed' &&
        !hasChargeLanguage(text) &&
        !hasChargeLanguage(inherited) &&
        !explicitRequired &&
        /\b(?:amenities|features|more about (?:this|the) (?:unit|property|home))\b/i.test(
          inherited,
        )
      )
        continue;
      let label = (row.labelText ?? text)
        .replace(
          /(?:\$\s*|\b(?:USD|CAD|AUD|EUR|GBP)\s+)[\d,]+(?:\.\d{1,2})?\s*(?:\/mo(?:nth)?|per month)?/gi,
          '',
        )
        .replace(/\b(required|mandatory|monthly|optional)\b/gi, '')
        .replace(/\(\s*\)/g, '')
        .replace(/\s*[:–-]\s*$/, '')
        .replace(/\s+/g, ' ')
        .replace(/^(?:a|an|the)\s+/i, '')
        .trim();
      if (row.amountText === undefined && /:\s*/.test(label))
        label = label.split(/:\s*/)[0].trim();
      if (!label) continue;
      const id = feeIdentity(label);
      if (!row.structured && authoritative.has(id)) continue;
      if (row.structured) authoritative.add(id);
      if (realtor && fees.has(id)) continue;
      const recurringKey = monthly(label);
      const upfrontKey = oneTime(label);
      let cadence = feeCadence(text, inherited);
      if (cadence === 'unknown') {
        if (upfrontKey) cadence = 'one_time';
        else if (recurringKey) cadence = 'monthly';
      }
      const dedicated = Boolean(recurringKey || upfrontKey);
      const required = explicitRequired || (dedicated && !optional);
      const petCharge =
        recurringKey === 'petRent' ||
        upfrontKey === 'petFee' ||
        upfrontKey === 'petDeposit';
      const basis = row.text
        .match(
          /\bper (?:each )?(pet|person|vehicle|adult applicant|applicant|application|storage)\b/i,
        )?.[1]
        .toLowerCase();
      const basisSafe =
        !basis ||
        (basis === 'pet' && /pet/i.test(label)) ||
        (upfrontKey === 'applicationFee' &&
          /applicant|application|person/.test(basis));
      const included =
        !explicitBaseRent &&
        (headlineIncluded ||
          /included (?:in|with) (?:the )?(?:advertised|monthly|rent|total)/i.test(
            text,
          ));
      if (recurringKey) clear('recurring', recurringKey);
      if (upfrontKey) clear('upfront', upfrontKey);
      if (
        cadence === 'one_time' &&
        row.element.matches('.custom-fee') &&
        !upfrontKey
      )
        clear('upfront', 'otherMoveInFees');
      const unique = `${id}:${money.display}:${cadence}:${optional}`;
      if (seen.has(unique)) continue;
      seen.add(unique);
      if (
        (required || petCharge) &&
        money.exact !== undefined &&
        basisSafe &&
        !included &&
        cadence === 'monthly' &&
        !/deposit/i.test(label)
      ) {
        if (recurringKey) {
          const old = standardMonthly.get(recurringKey);
          standardMonthly.set(recurringKey, {
            amount: (old?.amount ?? 0) + money.exact,
            texts: [...(old?.texts ?? []), text],
            basis: /pet/i.test(label)
              ? basis === 'pet'
                ? 'per_pet'
                : 'per_unit'
              : undefined,
          });
        } else {
          fees.set(id, {
            id,
            label: `${label} (required)`,
            amount: money.exact,
            source: 'listing',
            evidence: text,
          });
          notes.delete(id);
        }
      } else if (
        (required || petCharge) &&
        money.exact !== undefined &&
        basisSafe &&
        cadence === 'one_time' &&
        !/remaining balance|applied to|credited toward/i.test(label)
      ) {
        const refundable =
          /\brefundable\b/i.test(text) && !/non[- ]?refundable/i.test(text);
        const key =
          upfrontKey ?? (refundable ? 'utilityDeposits' : 'otherMoveInFees');
        const old = upfrontTotals.get(key);
        upfrontTotals.set(key, {
          amount: (old?.amount ?? 0) + money.exact,
          texts: [...(old?.texts ?? []), text],
          basis: petCharge
            ? basis === 'pet'
              ? 'per_pet'
              : 'per_unit'
            : undefined,
        });
      } else if (!fees.has(id)) {
        if (realtor && money.display === 'amount not listed') continue;
        const timing =
          cadence === 'monthly'
            ? '/month'
            : cadence === 'weekly'
              ? ' · weekly'
              : cadence === 'yearly'
                ? ' · yearly'
                : cadence === 'per_occurrence'
                  ? ' · per occurrence'
                  : '';
        notes.set(id, {
          id,
          label,
          detail:
            [
              optional
                ? /penalty|late|lease[- ]break|early termination/i.test(text)
                  ? 'Conditional penalty'
                  : 'Optional'
                : required
                  ? 'Required'
                  : 'Applicability not confirmed',
              money.display + timing,
              included
                ? 'included in the advertised total'
                : cadence === 'conflict'
                  ? 'payment timing conflicts'
                  : cadence === 'unknown' && !optional
                    ? 'payment timing needs confirmation'
                    : '',
              included
                ? 'no extra charge added'
                : 'not included in the estimate',
            ]
              .filter(Boolean)
              .join(' · ') + '.',
          evidence: text,
        });
      }
    }
  }
  for (const [key, value] of standardMonthly) {
    extraction.listing.recurring[key] = listingValue(
      value.amount,
      0.8,
      value.texts.join('; '),
    );
    if (value.basis)
      extraction.listing.recurring[key]!.billingBasis = value.basis;
  }
  for (const [key, value] of upfrontTotals) {
    extraction.listing.upfront[key] = listingValue(
      value.amount,
      0.8,
      value.texts.join('; '),
    );
    if (value.basis)
      extraction.listing.upfront[key]!.billingBasis = value.basis;
  }
  extraction.namedRecurringFees = [...fees.values()];
  extraction.feeNoteSuggestions = [...notes.values()];
  if (fees.size)
    extraction.listing.recurring.otherRequiredMonthlyFees = listingValue(
      [...fees.values()].reduce((sum, f) => sum + f.amount, 0),
      0.8,
      [...fees.values()].map((f) => f.evidence).join('; '),
    );
}
