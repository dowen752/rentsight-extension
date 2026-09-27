import type {
  SourcedValue,
  RecurringCosts,
  UpfrontCosts,
  UtilityCategory,
} from '../calculations';
import { emptyExtraction } from '../extractors/types';
import { applyExtraction, type RentalAnalysis } from '../shared/analysis';
import type { ExtractionSuccess } from './types';
import type {
  Applicability,
  BooleanField,
  Money,
  MoneyField,
} from './contracts/response';

type Field<T> = {
  status: string;
  value: T | null;
  scope: string;
  evidenceIds: string[];
};
export interface ManualCharge {
  id: string;
  label: string;
  detail: string;
}

const formatCurrency = (minor: number, currency: string) => {
  const amount = minor / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(minor % 100 === 0 ? 0 : 2)}`;
  }
};

const describeMoney = (money: Money) => {
  const minimum =
    money.minMinor === null
      ? undefined
      : formatCurrency(money.minMinor, money.currency);
  const maximum =
    money.maxMinor === null
      ? undefined
      : formatCurrency(money.maxMinor, money.currency);
  const amount =
    money.kind === 'exact'
      ? minimum
      : minimum && maximum
        ? `${minimum}–${maximum}`
        : minimum
          ? `from ${minimum}`
          : maximum
            ? `up to ${maximum}`
            : 'amount not stated';
  const frequency = {
    monthly: 'monthly',
    weekly: 'weekly',
    daily: 'daily',
    yearly: 'yearly',
    one_time: 'one time',
    per_occurrence: 'per occurrence',
    unknown: 'frequency not stated',
  }[money.frequency];
  const basis = {
    per_unit: 'per unit',
    per_person: 'per person',
    per_pet: 'per pet',
    per_vehicle: 'per vehicle',
    per_application: 'per application',
    unknown: 'basis not stated',
  }[money.basis];
  return [amount, frequency, basis].filter(Boolean).join(' · ');
};

const describeMoneyField = (field: MoneyField) => {
  if (field.status === 'known' && field.value)
    return describeMoney(field.value);
  if (field.status === 'not_applicable') return 'no separate amount';
  if (field.status === 'conflict') {
    const candidates = field.candidates.map(describeMoney);
    return candidates.length
      ? `conflicting amounts: ${candidates.join(' or ')}`
      : 'conflicting amounts';
  }
  return 'amount not stated';
};

const describeApplicability = (applicability: Applicability) => {
  const status = {
    required: 'required',
    optional: 'optional',
    conditional: 'conditional',
    unknown: 'applicability not stated',
  }[applicability.kind];
  return applicability.conditions.length
    ? `${status}: ${applicability.conditions.join('; ')}`
    : status;
};

const describeRefundability = (field: BooleanField) => {
  if (field.status === 'known')
    return field.value ? 'refundable' : 'nonrefundable';
  if (field.status === 'conflict') return 'refundability is unclear';
  return 'refundability not stated';
};
export function adaptExtraction(response: ExtractionSuccess) {
  const extraction = emptyExtraction(
    'AI listing review',
    response.schemaVersion,
  );
  const { property: p, evidence, reviewIssues } = response.result;
  const manualCharges: ManualCharge[] = [];
  const sourced = <T>(
    value: T,
    field: { evidenceIds: string[] },
  ): SourcedValue<T> => ({
    value,
    source: 'listing',
    confidence: 0.8,
    note: `AI-extracted from listing: ${evidence
      .filter((e) => field.evidenceIds.includes(e.id))
      .map((e) => e.quote)
      .join(' · ')}`,
  });
  const unitSafe = (field: { scope: string }) =>
    !response.identity.selectedUnit || field.scope === 'selected_unit';
  const known = <T>(field: Field<T>) =>
    field.status === 'known' && field.value !== null;
  const amount = (
    field: MoneyField,
    frequency: 'monthly' | 'one_time',
    allowedBases: readonly string[] = ['per_unit'],
  ) => {
    const m = field.value;
    return known(field) &&
      m?.kind === 'exact' &&
      m.currency === 'USD' &&
      m.frequency === frequency &&
      allowedBases.includes(m.basis) &&
      unitSafe(field)
      ? m.minMinor! / 100
      : undefined;
  };
  extraction.listing.identity.url = {
    value: response.identity.listingUrl,
    source: 'listing',
    confidence: 1,
  };
  if (known(p.propertyName))
    extraction.listing.identity.listingTitle = sourced(
      p.propertyName.value!,
      p.propertyName,
    );
  const addressComponents = [
    ['streetAddress', 'fullAddress'],
    ['city', 'city'],
    ['region', 'state'],
    ['postalCode', 'zipCode'],
  ] as const;
  for (const [propertyKey, identityKey] of addressComponents)
    if (known(p[propertyKey]))
      extraction.listing.identity[identityKey] = sourced(
        p[propertyKey].value!,
        p[propertyKey],
      );
  for (const key of ['bedrooms', 'bathrooms'] as const)
    if (known(p[key]) && unitSafe(p[key]) && p[key].value! <= 20)
      extraction.listing.identity[key] = sourced(p[key].value!, p[key]);
  if (
    known(p.floorArea) &&
    unitSafe(p.floorArea) &&
    p.floorArea.value!.kind === 'exact'
  ) {
    const area = p.floorArea.value!;
    extraction.listing.identity.squareFootage = sourced(
      area.min! * (area.unit === 'sq_m' ? 10.7639104167 : 1),
      p.floorArea,
    );
  }
  const rent = amount(p.baseRent, 'monthly');
  if (rent !== undefined) {
    const value = sourced(rent, p.baseRent);
    extraction.listing.recurring.advertisedRent = value;
    extraction.rent = { kind: 'single', amount: value, rawText: value.note! };
  } else
    extraction.warnings.push(
      'Enter a definite monthly rent in USD for this unit before calculating. See the AI source details for pricing qualifications.',
    );
  if (
    known(p.leaseTerm) &&
    unitSafe(p.leaseTerm) &&
    p.leaseTerm.value!.kind === 'exact' &&
    p.leaseTerm.value!.unit === 'months'
  )
    extraction.listing.concessions = {
      leaseMonths: sourced(p.leaseTerm.value!.min!, p.leaseTerm),
    };
  const recurring: Record<string, keyof RecurringCosts> = {
    pet_rent: 'petRent',
    parking: 'parking',
    amenity: 'amenityFees',
    service: 'otherRequiredMonthlyFees',
    other: 'otherRequiredMonthlyFees',
  };
  const upfront: Record<string, keyof UpfrontCosts> = {
    application: 'applicationFee',
    administration: 'administrativeFee',
    security_deposit: 'securityDeposit',
    pet_deposit: 'petDeposit',
    pet_fee: 'petFee',
    move_in: 'otherMoveInFees',
    other: 'otherMoveInFees',
  };
  const defer = (id: string, label: string, detail: string) =>
    manualCharges.push({ id, label, detail });
  for (const fee of p.fees.status === 'known' ? p.fees.value! : []) {
    const petCharge =
      fee.category === 'pet_rent' ||
      fee.category === 'pet_deposit' ||
      fee.category === 'pet_fee';
    const allowedBases =
      fee.category === 'pet_rent' ||
      fee.category === 'pet_deposit' ||
      fee.category === 'pet_fee'
        ? ['per_unit', 'per_pet']
        : fee.category === 'application'
          ? ['per_unit', 'per_person', 'per_application']
          : ['per_unit'];
    const monthly = amount(fee.amount, 'monthly', allowedBases);
    const once = amount(fee.amount, 'one_time', allowedBases);
    const deposit = fee.category.endsWith('_deposit');
    const standardApplicability =
      fee.applicability.kind === 'required' ||
      (petCharge &&
        (fee.applicability.kind === 'optional' ||
          fee.applicability.kind === 'conditional'));
    const refundableSafe = deposit
      ? fee.refundable.status === 'known' && fee.refundable.value === true
      : fee.refundable.status === 'known' && fee.refundable.value === false;
    if (
      standardApplicability &&
      refundableSafe &&
      monthly !== undefined &&
      recurring[fee.category]
    ) {
      const key = recurring[fee.category];
      const previous = extraction.listing.recurring[key];
      extraction.listing.recurring[key] = sourced(
        (previous?.value ?? 0) + monthly,
        fee.amount,
      );
    } else if (
      standardApplicability &&
      refundableSafe &&
      once !== undefined &&
      upfront[fee.category]
    ) {
      const key = upfront[fee.category];
      const previous = extraction.listing.upfront[key];
      extraction.listing.upfront[key] = sourced(
        (previous?.value ?? 0) + once,
        fee.amount,
      );
    } else
      defer(
        `fee:${fee.id}`,
        fee.label,
        [
          describeMoneyField(fee.amount),
          describeApplicability(fee.applicability),
          describeRefundability(fee.refundable),
        ].join(' · '),
      );
  }
  if (p.fees.status === 'conflict')
    defer(
      'fees:conflict',
      'Conflicting fees',
      'The listing contains conflicting fee information.',
    );
  const utilityKeys: Record<string, UtilityCategory> = {
    water: 'water',
    sewer: 'sewer',
    trash: 'trash',
    electricity: 'electricity',
    gas: 'naturalGas',
    internet: 'internet',
  };
  const seen = new Set<string>();
  for (const utility of p.utilities.status === 'known'
    ? p.utilities.value!
    : []) {
    const key = utilityKeys[utility.kind];
    if (!key || seen.has(key) || utility.applicability.kind !== 'required') {
      defer(
        `utility:${utility.id}`,
        utility.label,
        [
          describeMoneyField(utility.amount),
          describeApplicability(utility.applicability),
        ].join(' · '),
      );
      continue;
    }
    seen.add(key);
    if (
      utility.responsibility.status === 'known' &&
      utility.responsibility.value === 'included_in_rent'
    )
      extraction.includedUtilities.push(key);
    else {
      const value = amount(utility.amount, 'monthly');
      if (value !== undefined)
        extraction.listing.recurring[key] = sourced(value, utility.amount);
      else if (utility.amount.status !== 'unknown')
        defer(
          `utility:${utility.id}`,
          utility.label,
          [
            describeMoneyField(utility.amount),
            describeApplicability(utility.applicability),
          ].join(' · '),
        );
    }
  }
  if (p.utilities.status === 'conflict')
    defer(
      'utilities:conflict',
      'Conflicting utility terms',
      'The listing contains conflicting information about who pays for utilities.',
    );
  for (const promotion of p.promotions.status === 'known'
    ? p.promotions.value!
    : []) {
    defer(
      `promotion:${promotion.id}`,
      promotion.description,
      describeApplicability(promotion.applicability),
    );
  }
  if (p.promotions.status === 'conflict')
    defer(
      'promotions:conflict',
      'Conflicting promotions',
      'The listing contains conflicting promotion information.',
    );
  extraction.warnings.push(...reviewIssues.map((issue) => issue.message));
  return { extraction, manualCharges };
}

function markRetainedPreliminaryLocal(
  analysis: RentalAnalysis,
): RentalAnalysis {
  const next = structuredClone(analysis);
  for (const group of [
    'identity',
    'recurring',
    'upfront',
    'concessions',
  ] as const)
    for (const field of Object.values(next.listing[group] ?? {}))
      if (field?.source === 'listing') field.source = 'location_estimate';
  for (const group of [
    'identity',
    'recurring',
    'upfront',
    'concessions',
  ] as const)
    for (const field of Object.values(next.baseline[group] ?? {}))
      if (field?.source === 'listing') field.source = 'location_estimate';
  return next;
}

export function retainPreliminaryAfterAiFailure(
  analysis: RentalAnalysis,
): RentalAnalysis {
  const next = markRetainedPreliminaryLocal(analysis);
  next.updatedAt = new Date().toISOString();
  return next;
}

// AI is an enrichment layer: known fields overlay preliminary values, while
// quarantined/unknown fields leave the local baseline intact. User values and
// deliberate deletions remain authoritative over both layers.
export function applyAiExtraction(
  current: RentalAnalysis,
  response: ExtractionSuccess,
): RentalAnalysis {
  const { extraction } = adaptExtraction(response);
  const preliminary = markRetainedPreliminaryLocal(current);
  // Suppress applyExtraction's stale-local cleanup. Missing fields in this
  // adapted extraction represent AI unknown/conflict fields, not deletions.
  const enrichmentBase = { ...preliminary, extraction: undefined };
  const fresh = applyExtraction(enrichmentBase, extraction);
  const next: RentalAnalysis = {
    ...fresh,
    listing: fresh.listing,
    baseline: fresh.baseline,
    extraction,
    utilityIncluded: fresh.utilityIncluded,
    baselineUtilityIncluded: fresh.baselineUtilityIncluded,
    utilityIncludedSource: fresh.utilityIncludedSource,
    aiExtraction: structuredClone(response),
    aiReviewDecisions: {},
    locationEstimate: undefined,
    laundryType:
      current.laundryType === current.extraction?.laundryType
        ? fresh.laundryType
        : current.laundryType,
    updatedAt: new Date().toISOString(),
  };
  for (const group of [
    'identity',
    'recurring',
    'upfront',
    'concessions',
  ] as const) {
    const target = (next.listing[group] ??= {}) as Record<
      string,
      SourcedValue<unknown>
    >;
    for (const [key, value] of Object.entries(current.listing[group] ?? {}))
      if (value?.source === 'user') target[key] = structuredClone(value);
    for (const path of current.userClearedFields ?? [])
      if (path.startsWith(`${group}.`))
        delete target[path.slice(group.length + 1)];
  }
  for (const key of Object.keys(current.utilityIncluded) as UtilityCategory[])
    if (current.utilityIncludedSource?.[key] === 'user') {
      next.utilityIncluded[key] = current.utilityIncluded[key];
      next.utilityIncludedSource[key] = 'user';
    }
  return next;
}
