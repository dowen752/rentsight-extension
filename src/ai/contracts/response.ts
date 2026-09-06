/* Generated from the shared v1 JSON schema. Run npm run contract:generate. */

export type RentSightExtractionV1Response =
  | {
      schemaVersion: '1.1.0';
      status: 'succeeded';
      identity: Identity;
      metadata: {
        extractionId: string;
        capturedAt: string;
        completedAt: string;
        promptVersion: string;
        model: string;
        captureSha256: string;
      };
      result: Result;
    }
  | {
      schemaVersion: '1.1.0';
      status: 'failed';
      identity: Identity | null;
      error: {
        code:
          | 'INVALID_REQUEST'
          | 'UNAUTHENTICATED'
          | 'ENTITLEMENT_REQUIRED'
          | 'USAGE_LIMIT_EXCEEDED'
          | 'RATE_LIMITED'
          | 'IDEMPOTENCY_CONFLICT'
          | 'EXTRACTION_IN_PROGRESS'
          | 'UNUSABLE_CAPTURE'
          | 'MODEL_REFUSAL'
          | 'MODEL_OUTPUT_TRUNCATED'
          | 'MODEL_OUTPUT_INVALID'
          | 'MODEL_EVIDENCE_INVALID'
          | 'UPSTREAM_TIMEOUT'
          | 'UPSTREAM_UNAVAILABLE'
          | 'INTERNAL_ERROR';
        message: string;
        retryable: boolean;
        retryMode: 'none' | 'same_request' | 'new_request';
        retryAfterSeconds: number | null;
      };
    };

export interface Identity {
  requestId: string;
  captureRevision: string;
  listingUrl: string;
  selectedUnit: {
    id: string | null;
    label: string;
  } | null;
  selectedLeaseTermMonths: number | null;
}
export interface Result {
  property: Property;
  evidence: Evidence[];
  notes: Note[];
  reviewIssues: Issue[];
}
export interface Property {
  propertyName: TextField;
  streetAddress: TextField;
  city: TextField;
  region: TextField;
  postalCode: TextField;
  country: TextField;
  unitLabel: TextField;
  bedrooms: NumberField;
  bathrooms: NumberField;
  floorArea: AreaField;
  baseRent: MoneyField;
  fees: {
    status: 'known' | 'unknown' | 'not_applicable' | 'conflict';
    value: Fee[] | null;
    candidates: Fee[][];
    scope: 'selected_unit' | 'floor_plan' | 'building' | 'listing' | 'unknown';
    evidenceIds: string[];
  };
  utilities: {
    status: 'known' | 'unknown' | 'not_applicable' | 'conflict';
    value: Utility[] | null;
    candidates: Utility[][];
    scope: 'selected_unit' | 'floor_plan' | 'building' | 'listing' | 'unknown';
    evidenceIds: string[];
  };
  leaseTerm: DurationField;
  availableOn: DateField;
  promotions: {
    status: 'known' | 'unknown' | 'not_applicable' | 'conflict';
    value: Promotion[] | null;
    candidates: Promotion[][];
    scope: 'selected_unit' | 'floor_plan' | 'building' | 'listing' | 'unknown';
    evidenceIds: string[];
  };
}
export interface TextField {
  status: 'known' | 'unknown' | 'not_applicable' | 'conflict';
  value: string | null;
  candidates: string[];
  scope: 'selected_unit' | 'floor_plan' | 'building' | 'listing' | 'unknown';
  evidenceIds: string[];
}
export interface NumberField {
  status: 'known' | 'unknown' | 'not_applicable' | 'conflict';
  value: number | null;
  candidates: number[];
  scope: 'selected_unit' | 'floor_plan' | 'building' | 'listing' | 'unknown';
  evidenceIds: string[];
}
export interface AreaField {
  status: 'known' | 'unknown' | 'not_applicable' | 'conflict';
  value: {
    kind: 'exact' | 'range';
    min: number | null;
    max: number | null;
    unit: 'sq_ft' | 'sq_m';
  } | null;
  candidates: {
    kind: 'exact' | 'range';
    min: number | null;
    max: number | null;
    unit: 'sq_ft' | 'sq_m';
  }[];
  scope: 'selected_unit' | 'floor_plan' | 'building' | 'listing' | 'unknown';
  evidenceIds: string[];
}
export interface MoneyField {
  status: 'known' | 'unknown' | 'not_applicable' | 'conflict';
  value: Money | null;
  candidates: Money[];
  scope: 'selected_unit' | 'floor_plan' | 'building' | 'listing' | 'unknown';
  evidenceIds: string[];
}
export interface Money {
  kind: 'exact' | 'range';
  minMinor: number | null;
  maxMinor: number | null;
  currency: string;
  frequency:
    | 'monthly'
    | 'weekly'
    | 'daily'
    | 'yearly'
    | 'one_time'
    | 'per_occurrence'
    | 'unknown';
  basis:
    | 'per_unit'
    | 'per_person'
    | 'per_pet'
    | 'per_vehicle'
    | 'per_application'
    | 'unknown';
}
export interface Fee {
  id: string;
  label: string;
  category:
    | 'application'
    | 'administration'
    | 'security_deposit'
    | 'holding_deposit'
    | 'pet_deposit'
    | 'pet_rent'
    | 'parking'
    | 'amenity'
    | 'service'
    | 'move_in'
    | 'other';
  amount: MoneyField;
  applicability: Applicability;
  refundable: BooleanField;
}
export interface Applicability {
  kind: 'required' | 'optional' | 'conditional' | 'unknown';
  conditions: string[];
  evidenceIds: string[];
}
export interface BooleanField {
  status: 'known' | 'unknown' | 'not_applicable' | 'conflict';
  value: boolean | null;
  candidates: boolean[];
  scope: 'selected_unit' | 'floor_plan' | 'building' | 'listing' | 'unknown';
  evidenceIds: string[];
}
export interface Utility {
  id: string;
  kind:
    | 'water'
    | 'sewer'
    | 'trash'
    | 'electricity'
    | 'gas'
    | 'internet'
    | 'cable'
    | 'other';
  label: string;
  responsibility: {
    status: 'known' | 'unknown' | 'not_applicable' | 'conflict';
    value:
      | ('included_in_rent' | 'tenant_pays_provider' | 'tenant_pays_landlord')
      | null;
    candidates: (
      'included_in_rent' | 'tenant_pays_provider' | 'tenant_pays_landlord'
    )[];
    scope: 'selected_unit' | 'floor_plan' | 'building' | 'listing' | 'unknown';
    evidenceIds: string[];
  };
  amount: MoneyField;
  applicability: Applicability;
}
export interface DurationField {
  status: 'known' | 'unknown' | 'not_applicable' | 'conflict';
  value: {
    kind: 'exact' | 'range';
    min: number | null;
    max: number | null;
    unit: 'months' | 'weeks' | 'days';
  } | null;
  candidates: {
    kind: 'exact' | 'range';
    min: number | null;
    max: number | null;
    unit: 'months' | 'weeks' | 'days';
  }[];
  scope: 'selected_unit' | 'floor_plan' | 'building' | 'listing' | 'unknown';
  evidenceIds: string[];
}
export interface DateField {
  status: 'known' | 'unknown' | 'not_applicable' | 'conflict';
  value: string | null;
  candidates: string[];
  scope: 'selected_unit' | 'floor_plan' | 'building' | 'listing' | 'unknown';
  evidenceIds: string[];
}
export interface Promotion {
  id: string;
  description: string;
  benefitType:
    'free_rent' | 'rent_discount' | 'fee_waiver' | 'other' | 'unknown';
  discount: MoneyField;
  freeRentDuration: DurationField;
  advertisedEffectiveRent: MoneyField;
  requiredLeaseTerm: DurationField;
  applyBy: DateField;
  moveInBy: DateField;
  applicability: Applicability;
  evidenceIds: string[];
}
export interface Evidence {
  id: string;
  blockId: string;
  quote: string;
}
export interface Note {
  id: string;
  fieldPaths: string[];
  text: string;
  evidenceIds: string[];
}
export interface Issue {
  id: string;
  code:
    | 'UNKNOWN_VALUE'
    | 'CONFLICTING_VALUES'
    | 'RENT_RANGE'
    | 'CONDITIONAL_CHARGE'
    | 'PROMOTION_CONDITIONS'
    | 'UNIT_SCOPE_UNCERTAIN'
    | 'SOURCE_INCOMPLETE';
  fieldPaths: string[];
  message: string;
  evidenceIds: string[];
}
