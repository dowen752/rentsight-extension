'use strict';
export const validate = validate20;
export default validate20;
const schema31 = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:rentsight:extraction:1.0.0:response',
  title: 'RentSight extraction v1 response',
  anyOf: [
    {
      type: 'object',
      properties: {
        schemaVersion: { type: 'string', enum: ['1.0.0'] },
        status: { type: 'string', enum: ['succeeded'] },
        identity: { $ref: '#/$defs/identity' },
        metadata: {
          type: 'object',
          properties: {
            extractionId: { type: 'string' },
            capturedAt: { type: 'string' },
            completedAt: { type: 'string' },
            promptVersion: { type: 'string' },
            model: { type: 'string' },
            captureSha256: { type: 'string' },
          },
          required: [
            'extractionId',
            'capturedAt',
            'completedAt',
            'promptVersion',
            'model',
            'captureSha256',
          ],
          additionalProperties: false,
        },
        result: { $ref: '#/$defs/result' },
      },
      required: ['schemaVersion', 'status', 'identity', 'metadata', 'result'],
      additionalProperties: false,
    },
    {
      type: 'object',
      properties: {
        schemaVersion: { type: 'string', enum: ['1.0.0'] },
        status: { type: 'string', enum: ['failed'] },
        identity: { anyOf: [{ $ref: '#/$defs/identity' }, { type: 'null' }] },
        error: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              enum: [
                'INVALID_REQUEST',
                'UNAUTHENTICATED',
                'ENTITLEMENT_REQUIRED',
                'USAGE_LIMIT_EXCEEDED',
                'RATE_LIMITED',
                'IDEMPOTENCY_CONFLICT',
                'EXTRACTION_IN_PROGRESS',
                'UNUSABLE_CAPTURE',
                'MODEL_REFUSAL',
                'MODEL_OUTPUT_TRUNCATED',
                'MODEL_OUTPUT_INVALID',
                'MODEL_EVIDENCE_INVALID',
                'UPSTREAM_TIMEOUT',
                'UPSTREAM_UNAVAILABLE',
                'INTERNAL_ERROR',
              ],
            },
            message: { type: 'string' },
            retryable: { type: 'boolean' },
            retryMode: {
              type: 'string',
              enum: ['none', 'same_request', 'new_request'],
            },
            retryAfterSeconds: {
              anyOf: [{ type: 'integer' }, { type: 'null' }],
            },
          },
          required: [
            'code',
            'message',
            'retryable',
            'retryMode',
            'retryAfterSeconds',
          ],
          additionalProperties: false,
        },
      },
      required: ['schemaVersion', 'status', 'identity', 'error'],
      additionalProperties: false,
    },
  ],
  $defs: {
    money: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['exact', 'range'] },
        minMinor: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
        maxMinor: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
        currency: { type: 'string' },
        frequency: {
          type: 'string',
          enum: [
            'monthly',
            'weekly',
            'daily',
            'yearly',
            'one_time',
            'per_occurrence',
            'unknown',
          ],
        },
        basis: {
          type: 'string',
          enum: [
            'per_unit',
            'per_person',
            'per_pet',
            'per_vehicle',
            'per_application',
            'unknown',
          ],
        },
      },
      required: [
        'kind',
        'minMinor',
        'maxMinor',
        'currency',
        'frequency',
        'basis',
      ],
      additionalProperties: false,
    },
    textField: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['known', 'unknown', 'not_applicable', 'conflict'],
        },
        value: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        candidates: { type: 'array', items: { type: 'string' } },
        scope: {
          type: 'string',
          enum: [
            'selected_unit',
            'floor_plan',
            'building',
            'listing',
            'unknown',
          ],
        },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
      additionalProperties: false,
    },
    numberField: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['known', 'unknown', 'not_applicable', 'conflict'],
        },
        value: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        candidates: { type: 'array', items: { type: 'number' } },
        scope: {
          type: 'string',
          enum: [
            'selected_unit',
            'floor_plan',
            'building',
            'listing',
            'unknown',
          ],
        },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
      additionalProperties: false,
    },
    dateField: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['known', 'unknown', 'not_applicable', 'conflict'],
        },
        value: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        candidates: { type: 'array', items: { type: 'string' } },
        scope: {
          type: 'string',
          enum: [
            'selected_unit',
            'floor_plan',
            'building',
            'listing',
            'unknown',
          ],
        },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
      additionalProperties: false,
    },
    areaField: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['known', 'unknown', 'not_applicable', 'conflict'],
        },
        value: {
          anyOf: [
            {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['exact', 'range'] },
                min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                unit: { type: 'string', enum: ['sq_ft', 'sq_m'] },
              },
              required: ['kind', 'min', 'max', 'unit'],
              additionalProperties: false,
            },
            { type: 'null' },
          ],
        },
        candidates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['exact', 'range'] },
              min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              unit: { type: 'string', enum: ['sq_ft', 'sq_m'] },
            },
            required: ['kind', 'min', 'max', 'unit'],
            additionalProperties: false,
          },
        },
        scope: {
          type: 'string',
          enum: [
            'selected_unit',
            'floor_plan',
            'building',
            'listing',
            'unknown',
          ],
        },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
      additionalProperties: false,
    },
    durationField: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['known', 'unknown', 'not_applicable', 'conflict'],
        },
        value: {
          anyOf: [
            {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['exact', 'range'] },
                min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                unit: { type: 'string', enum: ['months', 'weeks', 'days'] },
              },
              required: ['kind', 'min', 'max', 'unit'],
              additionalProperties: false,
            },
            { type: 'null' },
          ],
        },
        candidates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['exact', 'range'] },
              min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              unit: { type: 'string', enum: ['months', 'weeks', 'days'] },
            },
            required: ['kind', 'min', 'max', 'unit'],
            additionalProperties: false,
          },
        },
        scope: {
          type: 'string',
          enum: [
            'selected_unit',
            'floor_plan',
            'building',
            'listing',
            'unknown',
          ],
        },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
      additionalProperties: false,
    },
    moneyField: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['known', 'unknown', 'not_applicable', 'conflict'],
        },
        value: { anyOf: [{ $ref: '#/$defs/money' }, { type: 'null' }] },
        candidates: { type: 'array', items: { $ref: '#/$defs/money' } },
        scope: {
          type: 'string',
          enum: [
            'selected_unit',
            'floor_plan',
            'building',
            'listing',
            'unknown',
          ],
        },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
      additionalProperties: false,
    },
    booleanField: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['known', 'unknown', 'not_applicable', 'conflict'],
        },
        value: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
        candidates: { type: 'array', items: { type: 'boolean' } },
        scope: {
          type: 'string',
          enum: [
            'selected_unit',
            'floor_plan',
            'building',
            'listing',
            'unknown',
          ],
        },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
      additionalProperties: false,
    },
    applicability: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['required', 'optional', 'conditional', 'unknown'],
        },
        conditions: { type: 'array', items: { type: 'string' } },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['kind', 'conditions', 'evidenceIds'],
      additionalProperties: false,
    },
    fee: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        label: { type: 'string' },
        category: {
          type: 'string',
          enum: [
            'application',
            'administration',
            'security_deposit',
            'holding_deposit',
            'pet_deposit',
            'pet_rent',
            'parking',
            'amenity',
            'service',
            'move_in',
            'other',
          ],
        },
        amount: { $ref: '#/$defs/moneyField' },
        applicability: { $ref: '#/$defs/applicability' },
        refundable: { $ref: '#/$defs/booleanField' },
      },
      required: [
        'id',
        'label',
        'category',
        'amount',
        'applicability',
        'refundable',
      ],
      additionalProperties: false,
    },
    utility: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        kind: {
          type: 'string',
          enum: [
            'water',
            'sewer',
            'trash',
            'electricity',
            'gas',
            'internet',
            'cable',
            'other',
          ],
        },
        label: { type: 'string' },
        responsibility: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['known', 'unknown', 'not_applicable', 'conflict'],
            },
            value: {
              anyOf: [
                {
                  type: 'string',
                  enum: [
                    'included_in_rent',
                    'tenant_pays_provider',
                    'tenant_pays_landlord',
                  ],
                },
                { type: 'null' },
              ],
            },
            candidates: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'included_in_rent',
                  'tenant_pays_provider',
                  'tenant_pays_landlord',
                ],
              },
            },
            scope: {
              type: 'string',
              enum: [
                'selected_unit',
                'floor_plan',
                'building',
                'listing',
                'unknown',
              ],
            },
            evidenceIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
          additionalProperties: false,
        },
        amount: { $ref: '#/$defs/moneyField' },
        applicability: { $ref: '#/$defs/applicability' },
      },
      required: [
        'id',
        'kind',
        'label',
        'responsibility',
        'amount',
        'applicability',
      ],
      additionalProperties: false,
    },
    promotion: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        description: { type: 'string' },
        benefitType: {
          type: 'string',
          enum: [
            'free_rent',
            'rent_discount',
            'fee_waiver',
            'other',
            'unknown',
          ],
        },
        discount: { $ref: '#/$defs/moneyField' },
        freeRentDuration: { $ref: '#/$defs/durationField' },
        advertisedEffectiveRent: { $ref: '#/$defs/moneyField' },
        requiredLeaseTerm: { $ref: '#/$defs/durationField' },
        applyBy: { $ref: '#/$defs/dateField' },
        moveInBy: { $ref: '#/$defs/dateField' },
        applicability: { $ref: '#/$defs/applicability' },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'id',
        'description',
        'benefitType',
        'discount',
        'freeRentDuration',
        'advertisedEffectiveRent',
        'requiredLeaseTerm',
        'applyBy',
        'moveInBy',
        'applicability',
        'evidenceIds',
      ],
      additionalProperties: false,
    },
    property: {
      type: 'object',
      properties: {
        propertyName: { $ref: '#/$defs/textField' },
        address: { $ref: '#/$defs/textField' },
        unitLabel: { $ref: '#/$defs/textField' },
        bedrooms: { $ref: '#/$defs/numberField' },
        bathrooms: { $ref: '#/$defs/numberField' },
        floorArea: { $ref: '#/$defs/areaField' },
        baseRent: { $ref: '#/$defs/moneyField' },
        fees: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['known', 'unknown', 'not_applicable', 'conflict'],
            },
            value: {
              anyOf: [
                { type: 'array', items: { $ref: '#/$defs/fee' } },
                { type: 'null' },
              ],
            },
            candidates: {
              type: 'array',
              items: { type: 'array', items: { $ref: '#/$defs/fee' } },
            },
            scope: {
              type: 'string',
              enum: [
                'selected_unit',
                'floor_plan',
                'building',
                'listing',
                'unknown',
              ],
            },
            evidenceIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
          additionalProperties: false,
        },
        utilities: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['known', 'unknown', 'not_applicable', 'conflict'],
            },
            value: {
              anyOf: [
                { type: 'array', items: { $ref: '#/$defs/utility' } },
                { type: 'null' },
              ],
            },
            candidates: {
              type: 'array',
              items: { type: 'array', items: { $ref: '#/$defs/utility' } },
            },
            scope: {
              type: 'string',
              enum: [
                'selected_unit',
                'floor_plan',
                'building',
                'listing',
                'unknown',
              ],
            },
            evidenceIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
          additionalProperties: false,
        },
        leaseTerm: { $ref: '#/$defs/durationField' },
        availableOn: { $ref: '#/$defs/dateField' },
        promotions: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['known', 'unknown', 'not_applicable', 'conflict'],
            },
            value: {
              anyOf: [
                { type: 'array', items: { $ref: '#/$defs/promotion' } },
                { type: 'null' },
              ],
            },
            candidates: {
              type: 'array',
              items: { type: 'array', items: { $ref: '#/$defs/promotion' } },
            },
            scope: {
              type: 'string',
              enum: [
                'selected_unit',
                'floor_plan',
                'building',
                'listing',
                'unknown',
              ],
            },
            evidenceIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
          additionalProperties: false,
        },
      },
      required: [
        'propertyName',
        'address',
        'unitLabel',
        'bedrooms',
        'bathrooms',
        'floorArea',
        'baseRent',
        'fees',
        'utilities',
        'leaseTerm',
        'availableOn',
        'promotions',
      ],
      additionalProperties: false,
    },
    evidence: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        blockId: { type: 'string' },
        quote: { type: 'string' },
      },
      required: ['id', 'blockId', 'quote'],
      additionalProperties: false,
    },
    note: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        fieldPaths: { type: 'array', items: { type: 'string' } },
        text: { type: 'string' },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['id', 'fieldPaths', 'text', 'evidenceIds'],
      additionalProperties: false,
    },
    issue: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        code: {
          type: 'string',
          enum: [
            'UNKNOWN_VALUE',
            'CONFLICTING_VALUES',
            'RENT_RANGE',
            'CONDITIONAL_CHARGE',
            'PROMOTION_CONDITIONS',
            'UNIT_SCOPE_UNCERTAIN',
            'SOURCE_INCOMPLETE',
          ],
        },
        fieldPaths: { type: 'array', items: { type: 'string' } },
        message: { type: 'string' },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['id', 'code', 'fieldPaths', 'message', 'evidenceIds'],
      additionalProperties: false,
    },
    result: {
      type: 'object',
      properties: {
        property: { $ref: '#/$defs/property' },
        evidence: { type: 'array', items: { $ref: '#/$defs/evidence' } },
        notes: { type: 'array', items: { $ref: '#/$defs/note' } },
        reviewIssues: { type: 'array', items: { $ref: '#/$defs/issue' } },
      },
      required: ['property', 'evidence', 'notes', 'reviewIssues'],
      additionalProperties: false,
    },
    identity: {
      type: 'object',
      properties: {
        requestId: { type: 'string' },
        captureRevision: { type: 'string' },
        listingUrl: { type: 'string' },
        selectedUnit: {
          anyOf: [
            {
              type: 'object',
              properties: {
                id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                label: { type: 'string' },
              },
              required: ['id', 'label'],
              additionalProperties: false,
            },
            { type: 'null' },
          ],
        },
        selectedLeaseTermMonths: {
          anyOf: [{ type: 'number' }, { type: 'null' }],
        },
      },
      required: [
        'requestId',
        'captureRevision',
        'listingUrl',
        'selectedUnit',
        'selectedLeaseTermMonths',
      ],
      additionalProperties: false,
    },
  },
};
const schema32 = {
  type: 'object',
  properties: {
    requestId: { type: 'string' },
    captureRevision: { type: 'string' },
    listingUrl: { type: 'string' },
    selectedUnit: {
      anyOf: [
        {
          type: 'object',
          properties: {
            id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            label: { type: 'string' },
          },
          required: ['id', 'label'],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    selectedLeaseTermMonths: { anyOf: [{ type: 'number' }, { type: 'null' }] },
  },
  required: [
    'requestId',
    'captureRevision',
    'listingUrl',
    'selectedUnit',
    'selectedLeaseTermMonths',
  ],
  additionalProperties: false,
};
const schema33 = {
  type: 'object',
  properties: {
    property: { $ref: '#/$defs/property' },
    evidence: { type: 'array', items: { $ref: '#/$defs/evidence' } },
    notes: { type: 'array', items: { $ref: '#/$defs/note' } },
    reviewIssues: { type: 'array', items: { $ref: '#/$defs/issue' } },
  },
  required: ['property', 'evidence', 'notes', 'reviewIssues'],
  additionalProperties: false,
};
const schema57 = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    blockId: { type: 'string' },
    quote: { type: 'string' },
  },
  required: ['id', 'blockId', 'quote'],
  additionalProperties: false,
};
const schema58 = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    fieldPaths: { type: 'array', items: { type: 'string' } },
    text: { type: 'string' },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'fieldPaths', 'text', 'evidenceIds'],
  additionalProperties: false,
};
const schema59 = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    code: {
      type: 'string',
      enum: [
        'UNKNOWN_VALUE',
        'CONFLICTING_VALUES',
        'RENT_RANGE',
        'CONDITIONAL_CHARGE',
        'PROMOTION_CONDITIONS',
        'UNIT_SCOPE_UNCERTAIN',
        'SOURCE_INCOMPLETE',
      ],
    },
    fieldPaths: { type: 'array', items: { type: 'string' } },
    message: { type: 'string' },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'code', 'fieldPaths', 'message', 'evidenceIds'],
  additionalProperties: false,
};
const schema34 = {
  type: 'object',
  properties: {
    propertyName: { $ref: '#/$defs/textField' },
    address: { $ref: '#/$defs/textField' },
    unitLabel: { $ref: '#/$defs/textField' },
    bedrooms: { $ref: '#/$defs/numberField' },
    bathrooms: { $ref: '#/$defs/numberField' },
    floorArea: { $ref: '#/$defs/areaField' },
    baseRent: { $ref: '#/$defs/moneyField' },
    fees: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['known', 'unknown', 'not_applicable', 'conflict'],
        },
        value: {
          anyOf: [
            { type: 'array', items: { $ref: '#/$defs/fee' } },
            { type: 'null' },
          ],
        },
        candidates: {
          type: 'array',
          items: { type: 'array', items: { $ref: '#/$defs/fee' } },
        },
        scope: {
          type: 'string',
          enum: [
            'selected_unit',
            'floor_plan',
            'building',
            'listing',
            'unknown',
          ],
        },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
      additionalProperties: false,
    },
    utilities: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['known', 'unknown', 'not_applicable', 'conflict'],
        },
        value: {
          anyOf: [
            { type: 'array', items: { $ref: '#/$defs/utility' } },
            { type: 'null' },
          ],
        },
        candidates: {
          type: 'array',
          items: { type: 'array', items: { $ref: '#/$defs/utility' } },
        },
        scope: {
          type: 'string',
          enum: [
            'selected_unit',
            'floor_plan',
            'building',
            'listing',
            'unknown',
          ],
        },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
      additionalProperties: false,
    },
    leaseTerm: { $ref: '#/$defs/durationField' },
    availableOn: { $ref: '#/$defs/dateField' },
    promotions: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['known', 'unknown', 'not_applicable', 'conflict'],
        },
        value: {
          anyOf: [
            { type: 'array', items: { $ref: '#/$defs/promotion' } },
            { type: 'null' },
          ],
        },
        candidates: {
          type: 'array',
          items: { type: 'array', items: { $ref: '#/$defs/promotion' } },
        },
        scope: {
          type: 'string',
          enum: [
            'selected_unit',
            'floor_plan',
            'building',
            'listing',
            'unknown',
          ],
        },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
      additionalProperties: false,
    },
  },
  required: [
    'propertyName',
    'address',
    'unitLabel',
    'bedrooms',
    'bathrooms',
    'floorArea',
    'baseRent',
    'fees',
    'utilities',
    'leaseTerm',
    'availableOn',
    'promotions',
  ],
  additionalProperties: false,
};
const schema35 = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['known', 'unknown', 'not_applicable', 'conflict'],
    },
    value: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    candidates: { type: 'array', items: { type: 'string' } },
    scope: {
      type: 'string',
      enum: ['selected_unit', 'floor_plan', 'building', 'listing', 'unknown'],
    },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
  additionalProperties: false,
};
const schema38 = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['known', 'unknown', 'not_applicable', 'conflict'],
    },
    value: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    candidates: { type: 'array', items: { type: 'number' } },
    scope: {
      type: 'string',
      enum: ['selected_unit', 'floor_plan', 'building', 'listing', 'unknown'],
    },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
  additionalProperties: false,
};
const schema40 = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['known', 'unknown', 'not_applicable', 'conflict'],
    },
    value: {
      anyOf: [
        {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['exact', 'range'] },
            min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
            max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
            unit: { type: 'string', enum: ['sq_ft', 'sq_m'] },
          },
          required: ['kind', 'min', 'max', 'unit'],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['exact', 'range'] },
          min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          unit: { type: 'string', enum: ['sq_ft', 'sq_m'] },
        },
        required: ['kind', 'min', 'max', 'unit'],
        additionalProperties: false,
      },
    },
    scope: {
      type: 'string',
      enum: ['selected_unit', 'floor_plan', 'building', 'listing', 'unknown'],
    },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
  additionalProperties: false,
};
const schema49 = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['known', 'unknown', 'not_applicable', 'conflict'],
    },
    value: {
      anyOf: [
        {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['exact', 'range'] },
            min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
            max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
            unit: { type: 'string', enum: ['months', 'weeks', 'days'] },
          },
          required: ['kind', 'min', 'max', 'unit'],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['exact', 'range'] },
          min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          unit: { type: 'string', enum: ['months', 'weeks', 'days'] },
        },
        required: ['kind', 'min', 'max', 'unit'],
        additionalProperties: false,
      },
    },
    scope: {
      type: 'string',
      enum: ['selected_unit', 'floor_plan', 'building', 'listing', 'unknown'],
    },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
  additionalProperties: false,
};
const schema50 = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['known', 'unknown', 'not_applicable', 'conflict'],
    },
    value: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    candidates: { type: 'array', items: { type: 'string' } },
    scope: {
      type: 'string',
      enum: ['selected_unit', 'floor_plan', 'building', 'listing', 'unknown'],
    },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
  additionalProperties: false,
};
const func1 = Object.prototype.hasOwnProperty;
const schema41 = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['known', 'unknown', 'not_applicable', 'conflict'],
    },
    value: { anyOf: [{ $ref: '#/$defs/money' }, { type: 'null' }] },
    candidates: { type: 'array', items: { $ref: '#/$defs/money' } },
    scope: {
      type: 'string',
      enum: ['selected_unit', 'floor_plan', 'building', 'listing', 'unknown'],
    },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
  additionalProperties: false,
};
const schema42 = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['exact', 'range'] },
    minMinor: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    maxMinor: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    currency: { type: 'string' },
    frequency: {
      type: 'string',
      enum: [
        'monthly',
        'weekly',
        'daily',
        'yearly',
        'one_time',
        'per_occurrence',
        'unknown',
      ],
    },
    basis: {
      type: 'string',
      enum: [
        'per_unit',
        'per_person',
        'per_pet',
        'per_vehicle',
        'per_application',
        'unknown',
      ],
    },
  },
  required: ['kind', 'minMinor', 'maxMinor', 'currency', 'frequency', 'basis'],
  additionalProperties: false,
};
function validate23(
  data,
  {
    instancePath = '',
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (
        (data.status === undefined && (missing0 = 'status')) ||
        (data.value === undefined && (missing0 = 'value')) ||
        (data.candidates === undefined && (missing0 = 'candidates')) ||
        (data.scope === undefined && (missing0 = 'scope')) ||
        (data.evidenceIds === undefined && (missing0 = 'evidenceIds'))
      ) {
        validate23.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(
            key0 === 'status' ||
            key0 === 'value' ||
            key0 === 'candidates' ||
            key0 === 'scope' ||
            key0 === 'evidenceIds'
          )) {
            validate23.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.status !== undefined) {
            let data0 = data.status;
            const _errs2 = errors;
            if (typeof data0 !== 'string') {
              validate23.errors = [
                {
                  instancePath: instancePath + '/status',
                  schemaPath: '#/properties/status/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            if (!(
              data0 === 'known' ||
              data0 === 'unknown' ||
              data0 === 'not_applicable' ||
              data0 === 'conflict'
            )) {
              validate23.errors = [
                {
                  instancePath: instancePath + '/status',
                  schemaPath: '#/properties/status/enum',
                  keyword: 'enum',
                  params: { allowedValues: schema41.properties.status.enum },
                  message: 'must be equal to one of the allowed values',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.value !== undefined) {
              let data1 = data.value;
              const _errs4 = errors;
              const _errs5 = errors;
              let valid1 = false;
              const _errs6 = errors;
              const _errs7 = errors;
              if (errors === _errs7) {
                if (
                  data1 &&
                  typeof data1 == 'object' &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.kind === undefined && (missing1 = 'kind')) ||
                    (data1.minMinor === undefined && (missing1 = 'minMinor')) ||
                    (data1.maxMinor === undefined && (missing1 = 'maxMinor')) ||
                    (data1.currency === undefined && (missing1 = 'currency')) ||
                    (data1.frequency === undefined &&
                      (missing1 = 'frequency')) ||
                    (data1.basis === undefined && (missing1 = 'basis'))
                  ) {
                    const err0 = {
                      instancePath: instancePath + '/value',
                      schemaPath: '#/$defs/money/required',
                      keyword: 'required',
                      params: { missingProperty: missing1 },
                      message: "must have required property '" + missing1 + "'",
                    };
                    if (vErrors === null) {
                      vErrors = [err0];
                    } else {
                      vErrors.push(err0);
                    }
                    errors++;
                  } else {
                    const _errs9 = errors;
                    for (const key1 in data1) {
                      if (!(
                        key1 === 'kind' ||
                        key1 === 'minMinor' ||
                        key1 === 'maxMinor' ||
                        key1 === 'currency' ||
                        key1 === 'frequency' ||
                        key1 === 'basis'
                      )) {
                        const err1 = {
                          instancePath: instancePath + '/value',
                          schemaPath: '#/$defs/money/additionalProperties',
                          keyword: 'additionalProperties',
                          params: { additionalProperty: key1 },
                          message: 'must NOT have additional properties',
                        };
                        if (vErrors === null) {
                          vErrors = [err1];
                        } else {
                          vErrors.push(err1);
                        }
                        errors++;
                        break;
                      }
                    }
                    if (_errs9 === errors) {
                      if (data1.kind !== undefined) {
                        let data2 = data1.kind;
                        const _errs10 = errors;
                        if (typeof data2 !== 'string') {
                          const err2 = {
                            instancePath: instancePath + '/value/kind',
                            schemaPath: '#/$defs/money/properties/kind/type',
                            keyword: 'type',
                            params: { type: 'string' },
                            message: 'must be string',
                          };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors++;
                        }
                        if (!(data2 === 'exact' || data2 === 'range')) {
                          const err3 = {
                            instancePath: instancePath + '/value/kind',
                            schemaPath: '#/$defs/money/properties/kind/enum',
                            keyword: 'enum',
                            params: {
                              allowedValues: schema42.properties.kind.enum,
                            },
                            message:
                              'must be equal to one of the allowed values',
                          };
                          if (vErrors === null) {
                            vErrors = [err3];
                          } else {
                            vErrors.push(err3);
                          }
                          errors++;
                        }
                        var valid3 = _errs10 === errors;
                      } else {
                        var valid3 = true;
                      }
                      if (valid3) {
                        if (data1.minMinor !== undefined) {
                          let data3 = data1.minMinor;
                          const _errs12 = errors;
                          const _errs13 = errors;
                          let valid4 = false;
                          const _errs14 = errors;
                          if (!(
                            typeof data3 == 'number' &&
                            !(data3 % 1) &&
                            !isNaN(data3)
                          )) {
                            const err4 = {
                              instancePath: instancePath + '/value/minMinor',
                              schemaPath:
                                '#/$defs/money/properties/minMinor/anyOf/0/type',
                              keyword: 'type',
                              params: { type: 'integer' },
                              message: 'must be integer',
                            };
                            if (vErrors === null) {
                              vErrors = [err4];
                            } else {
                              vErrors.push(err4);
                            }
                            errors++;
                          }
                          var _valid1 = _errs14 === errors;
                          valid4 = valid4 || _valid1;
                          const _errs16 = errors;
                          if (data3 !== null) {
                            const err5 = {
                              instancePath: instancePath + '/value/minMinor',
                              schemaPath:
                                '#/$defs/money/properties/minMinor/anyOf/1/type',
                              keyword: 'type',
                              params: { type: 'null' },
                              message: 'must be null',
                            };
                            if (vErrors === null) {
                              vErrors = [err5];
                            } else {
                              vErrors.push(err5);
                            }
                            errors++;
                          }
                          var _valid1 = _errs16 === errors;
                          valid4 = valid4 || _valid1;
                          if (!valid4) {
                            const err6 = {
                              instancePath: instancePath + '/value/minMinor',
                              schemaPath:
                                '#/$defs/money/properties/minMinor/anyOf',
                              keyword: 'anyOf',
                              params: {},
                              message: 'must match a schema in anyOf',
                            };
                            if (vErrors === null) {
                              vErrors = [err6];
                            } else {
                              vErrors.push(err6);
                            }
                            errors++;
                          } else {
                            errors = _errs13;
                            if (vErrors !== null) {
                              if (_errs13) {
                                vErrors.length = _errs13;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid3 = _errs12 === errors;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data1.maxMinor !== undefined) {
                            let data4 = data1.maxMinor;
                            const _errs18 = errors;
                            const _errs19 = errors;
                            let valid5 = false;
                            const _errs20 = errors;
                            if (!(
                              typeof data4 == 'number' &&
                              !(data4 % 1) &&
                              !isNaN(data4)
                            )) {
                              const err7 = {
                                instancePath: instancePath + '/value/maxMinor',
                                schemaPath:
                                  '#/$defs/money/properties/maxMinor/anyOf/0/type',
                                keyword: 'type',
                                params: { type: 'integer' },
                                message: 'must be integer',
                              };
                              if (vErrors === null) {
                                vErrors = [err7];
                              } else {
                                vErrors.push(err7);
                              }
                              errors++;
                            }
                            var _valid2 = _errs20 === errors;
                            valid5 = valid5 || _valid2;
                            const _errs22 = errors;
                            if (data4 !== null) {
                              const err8 = {
                                instancePath: instancePath + '/value/maxMinor',
                                schemaPath:
                                  '#/$defs/money/properties/maxMinor/anyOf/1/type',
                                keyword: 'type',
                                params: { type: 'null' },
                                message: 'must be null',
                              };
                              if (vErrors === null) {
                                vErrors = [err8];
                              } else {
                                vErrors.push(err8);
                              }
                              errors++;
                            }
                            var _valid2 = _errs22 === errors;
                            valid5 = valid5 || _valid2;
                            if (!valid5) {
                              const err9 = {
                                instancePath: instancePath + '/value/maxMinor',
                                schemaPath:
                                  '#/$defs/money/properties/maxMinor/anyOf',
                                keyword: 'anyOf',
                                params: {},
                                message: 'must match a schema in anyOf',
                              };
                              if (vErrors === null) {
                                vErrors = [err9];
                              } else {
                                vErrors.push(err9);
                              }
                              errors++;
                            } else {
                              errors = _errs19;
                              if (vErrors !== null) {
                                if (_errs19) {
                                  vErrors.length = _errs19;
                                } else {
                                  vErrors = null;
                                }
                              }
                            }
                            var valid3 = _errs18 === errors;
                          } else {
                            var valid3 = true;
                          }
                          if (valid3) {
                            if (data1.currency !== undefined) {
                              const _errs24 = errors;
                              if (typeof data1.currency !== 'string') {
                                const err10 = {
                                  instancePath:
                                    instancePath + '/value/currency',
                                  schemaPath:
                                    '#/$defs/money/properties/currency/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                };
                                if (vErrors === null) {
                                  vErrors = [err10];
                                } else {
                                  vErrors.push(err10);
                                }
                                errors++;
                              }
                              var valid3 = _errs24 === errors;
                            } else {
                              var valid3 = true;
                            }
                            if (valid3) {
                              if (data1.frequency !== undefined) {
                                let data6 = data1.frequency;
                                const _errs26 = errors;
                                if (typeof data6 !== 'string') {
                                  const err11 = {
                                    instancePath:
                                      instancePath + '/value/frequency',
                                    schemaPath:
                                      '#/$defs/money/properties/frequency/type',
                                    keyword: 'type',
                                    params: { type: 'string' },
                                    message: 'must be string',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err11];
                                  } else {
                                    vErrors.push(err11);
                                  }
                                  errors++;
                                }
                                if (!(
                                  data6 === 'monthly' ||
                                  data6 === 'weekly' ||
                                  data6 === 'daily' ||
                                  data6 === 'yearly' ||
                                  data6 === 'one_time' ||
                                  data6 === 'per_occurrence' ||
                                  data6 === 'unknown'
                                )) {
                                  const err12 = {
                                    instancePath:
                                      instancePath + '/value/frequency',
                                    schemaPath:
                                      '#/$defs/money/properties/frequency/enum',
                                    keyword: 'enum',
                                    params: {
                                      allowedValues:
                                        schema42.properties.frequency.enum,
                                    },
                                    message:
                                      'must be equal to one of the allowed values',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err12];
                                  } else {
                                    vErrors.push(err12);
                                  }
                                  errors++;
                                }
                                var valid3 = _errs26 === errors;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (data1.basis !== undefined) {
                                  let data7 = data1.basis;
                                  const _errs28 = errors;
                                  if (typeof data7 !== 'string') {
                                    const err13 = {
                                      instancePath:
                                        instancePath + '/value/basis',
                                      schemaPath:
                                        '#/$defs/money/properties/basis/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err13];
                                    } else {
                                      vErrors.push(err13);
                                    }
                                    errors++;
                                  }
                                  if (!(
                                    data7 === 'per_unit' ||
                                    data7 === 'per_person' ||
                                    data7 === 'per_pet' ||
                                    data7 === 'per_vehicle' ||
                                    data7 === 'per_application' ||
                                    data7 === 'unknown'
                                  )) {
                                    const err14 = {
                                      instancePath:
                                        instancePath + '/value/basis',
                                      schemaPath:
                                        '#/$defs/money/properties/basis/enum',
                                      keyword: 'enum',
                                      params: {
                                        allowedValues:
                                          schema42.properties.basis.enum,
                                      },
                                      message:
                                        'must be equal to one of the allowed values',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err14];
                                    } else {
                                      vErrors.push(err14);
                                    }
                                    errors++;
                                  }
                                  var valid3 = _errs28 === errors;
                                } else {
                                  var valid3 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  const err15 = {
                    instancePath: instancePath + '/value',
                    schemaPath: '#/$defs/money/type',
                    keyword: 'type',
                    params: { type: 'object' },
                    message: 'must be object',
                  };
                  if (vErrors === null) {
                    vErrors = [err15];
                  } else {
                    vErrors.push(err15);
                  }
                  errors++;
                }
              }
              var _valid0 = _errs6 === errors;
              valid1 = valid1 || _valid0;
              const _errs30 = errors;
              if (data1 !== null) {
                const err16 = {
                  instancePath: instancePath + '/value',
                  schemaPath: '#/properties/value/anyOf/1/type',
                  keyword: 'type',
                  params: { type: 'null' },
                  message: 'must be null',
                };
                if (vErrors === null) {
                  vErrors = [err16];
                } else {
                  vErrors.push(err16);
                }
                errors++;
              }
              var _valid0 = _errs30 === errors;
              valid1 = valid1 || _valid0;
              if (!valid1) {
                const err17 = {
                  instancePath: instancePath + '/value',
                  schemaPath: '#/properties/value/anyOf',
                  keyword: 'anyOf',
                  params: {},
                  message: 'must match a schema in anyOf',
                };
                if (vErrors === null) {
                  vErrors = [err17];
                } else {
                  vErrors.push(err17);
                }
                errors++;
                validate23.errors = vErrors;
                return false;
              } else {
                errors = _errs5;
                if (vErrors !== null) {
                  if (_errs5) {
                    vErrors.length = _errs5;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.candidates !== undefined) {
                let data8 = data.candidates;
                const _errs32 = errors;
                if (errors === _errs32) {
                  if (Array.isArray(data8)) {
                    var valid6 = true;
                    const len0 = data8.length;
                    for (let i0 = 0; i0 < len0; i0++) {
                      let data9 = data8[i0];
                      const _errs34 = errors;
                      const _errs35 = errors;
                      if (errors === _errs35) {
                        if (
                          data9 &&
                          typeof data9 == 'object' &&
                          !Array.isArray(data9)
                        ) {
                          let missing2;
                          if (
                            (data9.kind === undefined && (missing2 = 'kind')) ||
                            (data9.minMinor === undefined &&
                              (missing2 = 'minMinor')) ||
                            (data9.maxMinor === undefined &&
                              (missing2 = 'maxMinor')) ||
                            (data9.currency === undefined &&
                              (missing2 = 'currency')) ||
                            (data9.frequency === undefined &&
                              (missing2 = 'frequency')) ||
                            (data9.basis === undefined && (missing2 = 'basis'))
                          ) {
                            validate23.errors = [
                              {
                                instancePath:
                                  instancePath + '/candidates/' + i0,
                                schemaPath: '#/$defs/money/required',
                                keyword: 'required',
                                params: { missingProperty: missing2 },
                                message:
                                  "must have required property '" +
                                  missing2 +
                                  "'",
                              },
                            ];
                            return false;
                          } else {
                            const _errs37 = errors;
                            for (const key2 in data9) {
                              if (!(
                                key2 === 'kind' ||
                                key2 === 'minMinor' ||
                                key2 === 'maxMinor' ||
                                key2 === 'currency' ||
                                key2 === 'frequency' ||
                                key2 === 'basis'
                              )) {
                                validate23.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/candidates/' + i0,
                                    schemaPath:
                                      '#/$defs/money/additionalProperties',
                                    keyword: 'additionalProperties',
                                    params: { additionalProperty: key2 },
                                    message:
                                      'must NOT have additional properties',
                                  },
                                ];
                                return false;
                                break;
                              }
                            }
                            if (_errs37 === errors) {
                              if (data9.kind !== undefined) {
                                let data10 = data9.kind;
                                const _errs38 = errors;
                                if (typeof data10 !== 'string') {
                                  validate23.errors = [
                                    {
                                      instancePath:
                                        instancePath +
                                        '/candidates/' +
                                        i0 +
                                        '/kind',
                                      schemaPath:
                                        '#/$defs/money/properties/kind/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    },
                                  ];
                                  return false;
                                }
                                if (!(
                                  data10 === 'exact' || data10 === 'range'
                                )) {
                                  validate23.errors = [
                                    {
                                      instancePath:
                                        instancePath +
                                        '/candidates/' +
                                        i0 +
                                        '/kind',
                                      schemaPath:
                                        '#/$defs/money/properties/kind/enum',
                                      keyword: 'enum',
                                      params: {
                                        allowedValues:
                                          schema42.properties.kind.enum,
                                      },
                                      message:
                                        'must be equal to one of the allowed values',
                                    },
                                  ];
                                  return false;
                                }
                                var valid8 = _errs38 === errors;
                              } else {
                                var valid8 = true;
                              }
                              if (valid8) {
                                if (data9.minMinor !== undefined) {
                                  let data11 = data9.minMinor;
                                  const _errs40 = errors;
                                  const _errs41 = errors;
                                  let valid9 = false;
                                  const _errs42 = errors;
                                  if (!(
                                    typeof data11 == 'number' &&
                                    !(data11 % 1) &&
                                    !isNaN(data11)
                                  )) {
                                    const err18 = {
                                      instancePath:
                                        instancePath +
                                        '/candidates/' +
                                        i0 +
                                        '/minMinor',
                                      schemaPath:
                                        '#/$defs/money/properties/minMinor/anyOf/0/type',
                                      keyword: 'type',
                                      params: { type: 'integer' },
                                      message: 'must be integer',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err18];
                                    } else {
                                      vErrors.push(err18);
                                    }
                                    errors++;
                                  }
                                  var _valid3 = _errs42 === errors;
                                  valid9 = valid9 || _valid3;
                                  const _errs44 = errors;
                                  if (data11 !== null) {
                                    const err19 = {
                                      instancePath:
                                        instancePath +
                                        '/candidates/' +
                                        i0 +
                                        '/minMinor',
                                      schemaPath:
                                        '#/$defs/money/properties/minMinor/anyOf/1/type',
                                      keyword: 'type',
                                      params: { type: 'null' },
                                      message: 'must be null',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err19];
                                    } else {
                                      vErrors.push(err19);
                                    }
                                    errors++;
                                  }
                                  var _valid3 = _errs44 === errors;
                                  valid9 = valid9 || _valid3;
                                  if (!valid9) {
                                    const err20 = {
                                      instancePath:
                                        instancePath +
                                        '/candidates/' +
                                        i0 +
                                        '/minMinor',
                                      schemaPath:
                                        '#/$defs/money/properties/minMinor/anyOf',
                                      keyword: 'anyOf',
                                      params: {},
                                      message: 'must match a schema in anyOf',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err20];
                                    } else {
                                      vErrors.push(err20);
                                    }
                                    errors++;
                                    validate23.errors = vErrors;
                                    return false;
                                  } else {
                                    errors = _errs41;
                                    if (vErrors !== null) {
                                      if (_errs41) {
                                        vErrors.length = _errs41;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid8 = _errs40 === errors;
                                } else {
                                  var valid8 = true;
                                }
                                if (valid8) {
                                  if (data9.maxMinor !== undefined) {
                                    let data12 = data9.maxMinor;
                                    const _errs46 = errors;
                                    const _errs47 = errors;
                                    let valid10 = false;
                                    const _errs48 = errors;
                                    if (!(
                                      typeof data12 == 'number' &&
                                      !(data12 % 1) &&
                                      !isNaN(data12)
                                    )) {
                                      const err21 = {
                                        instancePath:
                                          instancePath +
                                          '/candidates/' +
                                          i0 +
                                          '/maxMinor',
                                        schemaPath:
                                          '#/$defs/money/properties/maxMinor/anyOf/0/type',
                                        keyword: 'type',
                                        params: { type: 'integer' },
                                        message: 'must be integer',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err21];
                                      } else {
                                        vErrors.push(err21);
                                      }
                                      errors++;
                                    }
                                    var _valid4 = _errs48 === errors;
                                    valid10 = valid10 || _valid4;
                                    const _errs50 = errors;
                                    if (data12 !== null) {
                                      const err22 = {
                                        instancePath:
                                          instancePath +
                                          '/candidates/' +
                                          i0 +
                                          '/maxMinor',
                                        schemaPath:
                                          '#/$defs/money/properties/maxMinor/anyOf/1/type',
                                        keyword: 'type',
                                        params: { type: 'null' },
                                        message: 'must be null',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err22];
                                      } else {
                                        vErrors.push(err22);
                                      }
                                      errors++;
                                    }
                                    var _valid4 = _errs50 === errors;
                                    valid10 = valid10 || _valid4;
                                    if (!valid10) {
                                      const err23 = {
                                        instancePath:
                                          instancePath +
                                          '/candidates/' +
                                          i0 +
                                          '/maxMinor',
                                        schemaPath:
                                          '#/$defs/money/properties/maxMinor/anyOf',
                                        keyword: 'anyOf',
                                        params: {},
                                        message: 'must match a schema in anyOf',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err23];
                                      } else {
                                        vErrors.push(err23);
                                      }
                                      errors++;
                                      validate23.errors = vErrors;
                                      return false;
                                    } else {
                                      errors = _errs47;
                                      if (vErrors !== null) {
                                        if (_errs47) {
                                          vErrors.length = _errs47;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid8 = _errs46 === errors;
                                  } else {
                                    var valid8 = true;
                                  }
                                  if (valid8) {
                                    if (data9.currency !== undefined) {
                                      const _errs52 = errors;
                                      if (typeof data9.currency !== 'string') {
                                        validate23.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/candidates/' +
                                              i0 +
                                              '/currency',
                                            schemaPath:
                                              '#/$defs/money/properties/currency/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid8 = _errs52 === errors;
                                    } else {
                                      var valid8 = true;
                                    }
                                    if (valid8) {
                                      if (data9.frequency !== undefined) {
                                        let data14 = data9.frequency;
                                        const _errs54 = errors;
                                        if (typeof data14 !== 'string') {
                                          validate23.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/candidates/' +
                                                i0 +
                                                '/frequency',
                                              schemaPath:
                                                '#/$defs/money/properties/frequency/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            },
                                          ];
                                          return false;
                                        }
                                        if (!(
                                          data14 === 'monthly' ||
                                          data14 === 'weekly' ||
                                          data14 === 'daily' ||
                                          data14 === 'yearly' ||
                                          data14 === 'one_time' ||
                                          data14 === 'per_occurrence' ||
                                          data14 === 'unknown'
                                        )) {
                                          validate23.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/candidates/' +
                                                i0 +
                                                '/frequency',
                                              schemaPath:
                                                '#/$defs/money/properties/frequency/enum',
                                              keyword: 'enum',
                                              params: {
                                                allowedValues:
                                                  schema42.properties.frequency
                                                    .enum,
                                              },
                                              message:
                                                'must be equal to one of the allowed values',
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid8 = _errs54 === errors;
                                      } else {
                                        var valid8 = true;
                                      }
                                      if (valid8) {
                                        if (data9.basis !== undefined) {
                                          let data15 = data9.basis;
                                          const _errs56 = errors;
                                          if (typeof data15 !== 'string') {
                                            validate23.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/candidates/' +
                                                  i0 +
                                                  '/basis',
                                                schemaPath:
                                                  '#/$defs/money/properties/basis/type',
                                                keyword: 'type',
                                                params: { type: 'string' },
                                                message: 'must be string',
                                              },
                                            ];
                                            return false;
                                          }
                                          if (!(
                                            data15 === 'per_unit' ||
                                            data15 === 'per_person' ||
                                            data15 === 'per_pet' ||
                                            data15 === 'per_vehicle' ||
                                            data15 === 'per_application' ||
                                            data15 === 'unknown'
                                          )) {
                                            validate23.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/candidates/' +
                                                  i0 +
                                                  '/basis',
                                                schemaPath:
                                                  '#/$defs/money/properties/basis/enum',
                                                keyword: 'enum',
                                                params: {
                                                  allowedValues:
                                                    schema42.properties.basis
                                                      .enum,
                                                },
                                                message:
                                                  'must be equal to one of the allowed values',
                                              },
                                            ];
                                            return false;
                                          }
                                          var valid8 = _errs56 === errors;
                                        } else {
                                          var valid8 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate23.errors = [
                            {
                              instancePath: instancePath + '/candidates/' + i0,
                              schemaPath: '#/$defs/money/type',
                              keyword: 'type',
                              params: { type: 'object' },
                              message: 'must be object',
                            },
                          ];
                          return false;
                        }
                      }
                      var valid6 = _errs34 === errors;
                      if (!valid6) {
                        break;
                      }
                    }
                  } else {
                    validate23.errors = [
                      {
                        instancePath: instancePath + '/candidates',
                        schemaPath: '#/properties/candidates/type',
                        keyword: 'type',
                        params: { type: 'array' },
                        message: 'must be array',
                      },
                    ];
                    return false;
                  }
                }
                var valid0 = _errs32 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.scope !== undefined) {
                  let data16 = data.scope;
                  const _errs58 = errors;
                  if (typeof data16 !== 'string') {
                    validate23.errors = [
                      {
                        instancePath: instancePath + '/scope',
                        schemaPath: '#/properties/scope/type',
                        keyword: 'type',
                        params: { type: 'string' },
                        message: 'must be string',
                      },
                    ];
                    return false;
                  }
                  if (!(
                    data16 === 'selected_unit' ||
                    data16 === 'floor_plan' ||
                    data16 === 'building' ||
                    data16 === 'listing' ||
                    data16 === 'unknown'
                  )) {
                    validate23.errors = [
                      {
                        instancePath: instancePath + '/scope',
                        schemaPath: '#/properties/scope/enum',
                        keyword: 'enum',
                        params: {
                          allowedValues: schema41.properties.scope.enum,
                        },
                        message: 'must be equal to one of the allowed values',
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs58 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.evidenceIds !== undefined) {
                    let data17 = data.evidenceIds;
                    const _errs60 = errors;
                    if (errors === _errs60) {
                      if (Array.isArray(data17)) {
                        var valid11 = true;
                        const len1 = data17.length;
                        for (let i1 = 0; i1 < len1; i1++) {
                          const _errs62 = errors;
                          if (typeof data17[i1] !== 'string') {
                            validate23.errors = [
                              {
                                instancePath:
                                  instancePath + '/evidenceIds/' + i1,
                                schemaPath:
                                  '#/properties/evidenceIds/items/type',
                                keyword: 'type',
                                params: { type: 'string' },
                                message: 'must be string',
                              },
                            ];
                            return false;
                          }
                          var valid11 = _errs62 === errors;
                          if (!valid11) {
                            break;
                          }
                        }
                      } else {
                        validate23.errors = [
                          {
                            instancePath: instancePath + '/evidenceIds',
                            schemaPath: '#/properties/evidenceIds/type',
                            keyword: 'type',
                            params: { type: 'array' },
                            message: 'must be array',
                          },
                        ];
                        return false;
                      }
                    }
                    var valid0 = _errs60 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate23.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate23.errors = vErrors;
  return errors === 0;
}
validate23.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
const schema44 = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    category: {
      type: 'string',
      enum: [
        'application',
        'administration',
        'security_deposit',
        'holding_deposit',
        'pet_deposit',
        'pet_rent',
        'parking',
        'amenity',
        'service',
        'move_in',
        'other',
      ],
    },
    amount: { $ref: '#/$defs/moneyField' },
    applicability: { $ref: '#/$defs/applicability' },
    refundable: { $ref: '#/$defs/booleanField' },
  },
  required: [
    'id',
    'label',
    'category',
    'amount',
    'applicability',
    'refundable',
  ],
  additionalProperties: false,
};
const schema45 = {
  type: 'object',
  properties: {
    kind: {
      type: 'string',
      enum: ['required', 'optional', 'conditional', 'unknown'],
    },
    conditions: { type: 'array', items: { type: 'string' } },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['kind', 'conditions', 'evidenceIds'],
  additionalProperties: false,
};
const schema46 = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['known', 'unknown', 'not_applicable', 'conflict'],
    },
    value: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
    candidates: { type: 'array', items: { type: 'boolean' } },
    scope: {
      type: 'string',
      enum: ['selected_unit', 'floor_plan', 'building', 'listing', 'unknown'],
    },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
  additionalProperties: false,
};
function validate25(
  data,
  {
    instancePath = '',
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate25.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = 'id')) ||
        (data.label === undefined && (missing0 = 'label')) ||
        (data.category === undefined && (missing0 = 'category')) ||
        (data.amount === undefined && (missing0 = 'amount')) ||
        (data.applicability === undefined && (missing0 = 'applicability')) ||
        (data.refundable === undefined && (missing0 = 'refundable'))
      ) {
        validate25.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(
            key0 === 'id' ||
            key0 === 'label' ||
            key0 === 'category' ||
            key0 === 'amount' ||
            key0 === 'applicability' ||
            key0 === 'refundable'
          )) {
            validate25.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            const _errs2 = errors;
            if (typeof data.id !== 'string') {
              validate25.errors = [
                {
                  instancePath: instancePath + '/id',
                  schemaPath: '#/properties/id/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.label !== undefined) {
              const _errs4 = errors;
              if (typeof data.label !== 'string') {
                validate25.errors = [
                  {
                    instancePath: instancePath + '/label',
                    schemaPath: '#/properties/label/type',
                    keyword: 'type',
                    params: { type: 'string' },
                    message: 'must be string',
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.category !== undefined) {
                let data2 = data.category;
                const _errs6 = errors;
                if (typeof data2 !== 'string') {
                  validate25.errors = [
                    {
                      instancePath: instancePath + '/category',
                      schemaPath: '#/properties/category/type',
                      keyword: 'type',
                      params: { type: 'string' },
                      message: 'must be string',
                    },
                  ];
                  return false;
                }
                if (!(
                  data2 === 'application' ||
                  data2 === 'administration' ||
                  data2 === 'security_deposit' ||
                  data2 === 'holding_deposit' ||
                  data2 === 'pet_deposit' ||
                  data2 === 'pet_rent' ||
                  data2 === 'parking' ||
                  data2 === 'amenity' ||
                  data2 === 'service' ||
                  data2 === 'move_in' ||
                  data2 === 'other'
                )) {
                  validate25.errors = [
                    {
                      instancePath: instancePath + '/category',
                      schemaPath: '#/properties/category/enum',
                      keyword: 'enum',
                      params: {
                        allowedValues: schema44.properties.category.enum,
                      },
                      message: 'must be equal to one of the allowed values',
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.amount !== undefined) {
                  const _errs8 = errors;
                  if (
                    !validate23(data.amount, {
                      instancePath: instancePath + '/amount',
                      parentData: data,
                      parentDataProperty: 'amount',
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate23.errors
                        : vErrors.concat(validate23.errors);
                    errors = vErrors.length;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.applicability !== undefined) {
                    let data4 = data.applicability;
                    const _errs9 = errors;
                    const _errs10 = errors;
                    if (errors === _errs10) {
                      if (
                        data4 &&
                        typeof data4 == 'object' &&
                        !Array.isArray(data4)
                      ) {
                        let missing1;
                        if (
                          (data4.kind === undefined && (missing1 = 'kind')) ||
                          (data4.conditions === undefined &&
                            (missing1 = 'conditions')) ||
                          (data4.evidenceIds === undefined &&
                            (missing1 = 'evidenceIds'))
                        ) {
                          validate25.errors = [
                            {
                              instancePath: instancePath + '/applicability',
                              schemaPath: '#/$defs/applicability/required',
                              keyword: 'required',
                              params: { missingProperty: missing1 },
                              message:
                                "must have required property '" +
                                missing1 +
                                "'",
                            },
                          ];
                          return false;
                        } else {
                          const _errs12 = errors;
                          for (const key1 in data4) {
                            if (!(
                              key1 === 'kind' ||
                              key1 === 'conditions' ||
                              key1 === 'evidenceIds'
                            )) {
                              validate25.errors = [
                                {
                                  instancePath: instancePath + '/applicability',
                                  schemaPath:
                                    '#/$defs/applicability/additionalProperties',
                                  keyword: 'additionalProperties',
                                  params: { additionalProperty: key1 },
                                  message:
                                    'must NOT have additional properties',
                                },
                              ];
                              return false;
                              break;
                            }
                          }
                          if (_errs12 === errors) {
                            if (data4.kind !== undefined) {
                              let data5 = data4.kind;
                              const _errs13 = errors;
                              if (typeof data5 !== 'string') {
                                validate25.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/applicability/kind',
                                    schemaPath:
                                      '#/$defs/applicability/properties/kind/type',
                                    keyword: 'type',
                                    params: { type: 'string' },
                                    message: 'must be string',
                                  },
                                ];
                                return false;
                              }
                              if (!(
                                data5 === 'required' ||
                                data5 === 'optional' ||
                                data5 === 'conditional' ||
                                data5 === 'unknown'
                              )) {
                                validate25.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/applicability/kind',
                                    schemaPath:
                                      '#/$defs/applicability/properties/kind/enum',
                                    keyword: 'enum',
                                    params: {
                                      allowedValues:
                                        schema45.properties.kind.enum,
                                    },
                                    message:
                                      'must be equal to one of the allowed values',
                                  },
                                ];
                                return false;
                              }
                              var valid2 = _errs13 === errors;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data4.conditions !== undefined) {
                                let data6 = data4.conditions;
                                const _errs15 = errors;
                                if (errors === _errs15) {
                                  if (Array.isArray(data6)) {
                                    var valid3 = true;
                                    const len0 = data6.length;
                                    for (let i0 = 0; i0 < len0; i0++) {
                                      const _errs17 = errors;
                                      if (typeof data6[i0] !== 'string') {
                                        validate25.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/applicability/conditions/' +
                                              i0,
                                            schemaPath:
                                              '#/$defs/applicability/properties/conditions/items/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid3 = _errs17 === errors;
                                      if (!valid3) {
                                        break;
                                      }
                                    }
                                  } else {
                                    validate25.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          '/applicability/conditions',
                                        schemaPath:
                                          '#/$defs/applicability/properties/conditions/type',
                                        keyword: 'type',
                                        params: { type: 'array' },
                                        message: 'must be array',
                                      },
                                    ];
                                    return false;
                                  }
                                }
                                var valid2 = _errs15 === errors;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data4.evidenceIds !== undefined) {
                                  let data8 = data4.evidenceIds;
                                  const _errs19 = errors;
                                  if (errors === _errs19) {
                                    if (Array.isArray(data8)) {
                                      var valid4 = true;
                                      const len1 = data8.length;
                                      for (let i1 = 0; i1 < len1; i1++) {
                                        const _errs21 = errors;
                                        if (typeof data8[i1] !== 'string') {
                                          validate25.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/applicability/evidenceIds/' +
                                                i1,
                                              schemaPath:
                                                '#/$defs/applicability/properties/evidenceIds/items/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid4 = _errs21 === errors;
                                        if (!valid4) {
                                          break;
                                        }
                                      }
                                    } else {
                                      validate25.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/applicability/evidenceIds',
                                          schemaPath:
                                            '#/$defs/applicability/properties/evidenceIds/type',
                                          keyword: 'type',
                                          params: { type: 'array' },
                                          message: 'must be array',
                                        },
                                      ];
                                      return false;
                                    }
                                  }
                                  var valid2 = _errs19 === errors;
                                } else {
                                  var valid2 = true;
                                }
                              }
                            }
                          }
                        }
                      } else {
                        validate25.errors = [
                          {
                            instancePath: instancePath + '/applicability',
                            schemaPath: '#/$defs/applicability/type',
                            keyword: 'type',
                            params: { type: 'object' },
                            message: 'must be object',
                          },
                        ];
                        return false;
                      }
                    }
                    var valid0 = _errs9 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.refundable !== undefined) {
                      let data10 = data.refundable;
                      const _errs23 = errors;
                      const _errs24 = errors;
                      if (errors === _errs24) {
                        if (
                          data10 &&
                          typeof data10 == 'object' &&
                          !Array.isArray(data10)
                        ) {
                          let missing2;
                          if (
                            (data10.status === undefined &&
                              (missing2 = 'status')) ||
                            (data10.value === undefined &&
                              (missing2 = 'value')) ||
                            (data10.candidates === undefined &&
                              (missing2 = 'candidates')) ||
                            (data10.scope === undefined &&
                              (missing2 = 'scope')) ||
                            (data10.evidenceIds === undefined &&
                              (missing2 = 'evidenceIds'))
                          ) {
                            validate25.errors = [
                              {
                                instancePath: instancePath + '/refundable',
                                schemaPath: '#/$defs/booleanField/required',
                                keyword: 'required',
                                params: { missingProperty: missing2 },
                                message:
                                  "must have required property '" +
                                  missing2 +
                                  "'",
                              },
                            ];
                            return false;
                          } else {
                            const _errs26 = errors;
                            for (const key2 in data10) {
                              if (!(
                                key2 === 'status' ||
                                key2 === 'value' ||
                                key2 === 'candidates' ||
                                key2 === 'scope' ||
                                key2 === 'evidenceIds'
                              )) {
                                validate25.errors = [
                                  {
                                    instancePath: instancePath + '/refundable',
                                    schemaPath:
                                      '#/$defs/booleanField/additionalProperties',
                                    keyword: 'additionalProperties',
                                    params: { additionalProperty: key2 },
                                    message:
                                      'must NOT have additional properties',
                                  },
                                ];
                                return false;
                                break;
                              }
                            }
                            if (_errs26 === errors) {
                              if (data10.status !== undefined) {
                                let data11 = data10.status;
                                const _errs27 = errors;
                                if (typeof data11 !== 'string') {
                                  validate25.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/refundable/status',
                                      schemaPath:
                                        '#/$defs/booleanField/properties/status/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    },
                                  ];
                                  return false;
                                }
                                if (!(
                                  data11 === 'known' ||
                                  data11 === 'unknown' ||
                                  data11 === 'not_applicable' ||
                                  data11 === 'conflict'
                                )) {
                                  validate25.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/refundable/status',
                                      schemaPath:
                                        '#/$defs/booleanField/properties/status/enum',
                                      keyword: 'enum',
                                      params: {
                                        allowedValues:
                                          schema46.properties.status.enum,
                                      },
                                      message:
                                        'must be equal to one of the allowed values',
                                    },
                                  ];
                                  return false;
                                }
                                var valid6 = _errs27 === errors;
                              } else {
                                var valid6 = true;
                              }
                              if (valid6) {
                                if (data10.value !== undefined) {
                                  let data12 = data10.value;
                                  const _errs29 = errors;
                                  const _errs30 = errors;
                                  let valid7 = false;
                                  const _errs31 = errors;
                                  if (typeof data12 !== 'boolean') {
                                    const err0 = {
                                      instancePath:
                                        instancePath + '/refundable/value',
                                      schemaPath:
                                        '#/$defs/booleanField/properties/value/anyOf/0/type',
                                      keyword: 'type',
                                      params: { type: 'boolean' },
                                      message: 'must be boolean',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err0];
                                    } else {
                                      vErrors.push(err0);
                                    }
                                    errors++;
                                  }
                                  var _valid0 = _errs31 === errors;
                                  valid7 = valid7 || _valid0;
                                  const _errs33 = errors;
                                  if (data12 !== null) {
                                    const err1 = {
                                      instancePath:
                                        instancePath + '/refundable/value',
                                      schemaPath:
                                        '#/$defs/booleanField/properties/value/anyOf/1/type',
                                      keyword: 'type',
                                      params: { type: 'null' },
                                      message: 'must be null',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err1];
                                    } else {
                                      vErrors.push(err1);
                                    }
                                    errors++;
                                  }
                                  var _valid0 = _errs33 === errors;
                                  valid7 = valid7 || _valid0;
                                  if (!valid7) {
                                    const err2 = {
                                      instancePath:
                                        instancePath + '/refundable/value',
                                      schemaPath:
                                        '#/$defs/booleanField/properties/value/anyOf',
                                      keyword: 'anyOf',
                                      params: {},
                                      message: 'must match a schema in anyOf',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err2];
                                    } else {
                                      vErrors.push(err2);
                                    }
                                    errors++;
                                    validate25.errors = vErrors;
                                    return false;
                                  } else {
                                    errors = _errs30;
                                    if (vErrors !== null) {
                                      if (_errs30) {
                                        vErrors.length = _errs30;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid6 = _errs29 === errors;
                                } else {
                                  var valid6 = true;
                                }
                                if (valid6) {
                                  if (data10.candidates !== undefined) {
                                    let data13 = data10.candidates;
                                    const _errs35 = errors;
                                    if (errors === _errs35) {
                                      if (Array.isArray(data13)) {
                                        var valid8 = true;
                                        const len2 = data13.length;
                                        for (let i2 = 0; i2 < len2; i2++) {
                                          const _errs37 = errors;
                                          if (typeof data13[i2] !== 'boolean') {
                                            validate25.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/refundable/candidates/' +
                                                  i2,
                                                schemaPath:
                                                  '#/$defs/booleanField/properties/candidates/items/type',
                                                keyword: 'type',
                                                params: { type: 'boolean' },
                                                message: 'must be boolean',
                                              },
                                            ];
                                            return false;
                                          }
                                          var valid8 = _errs37 === errors;
                                          if (!valid8) {
                                            break;
                                          }
                                        }
                                      } else {
                                        validate25.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/refundable/candidates',
                                            schemaPath:
                                              '#/$defs/booleanField/properties/candidates/type',
                                            keyword: 'type',
                                            params: { type: 'array' },
                                            message: 'must be array',
                                          },
                                        ];
                                        return false;
                                      }
                                    }
                                    var valid6 = _errs35 === errors;
                                  } else {
                                    var valid6 = true;
                                  }
                                  if (valid6) {
                                    if (data10.scope !== undefined) {
                                      let data15 = data10.scope;
                                      const _errs39 = errors;
                                      if (typeof data15 !== 'string') {
                                        validate25.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/refundable/scope',
                                            schemaPath:
                                              '#/$defs/booleanField/properties/scope/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          },
                                        ];
                                        return false;
                                      }
                                      if (!(
                                        data15 === 'selected_unit' ||
                                        data15 === 'floor_plan' ||
                                        data15 === 'building' ||
                                        data15 === 'listing' ||
                                        data15 === 'unknown'
                                      )) {
                                        validate25.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/refundable/scope',
                                            schemaPath:
                                              '#/$defs/booleanField/properties/scope/enum',
                                            keyword: 'enum',
                                            params: {
                                              allowedValues:
                                                schema46.properties.scope.enum,
                                            },
                                            message:
                                              'must be equal to one of the allowed values',
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid6 = _errs39 === errors;
                                    } else {
                                      var valid6 = true;
                                    }
                                    if (valid6) {
                                      if (data10.evidenceIds !== undefined) {
                                        let data16 = data10.evidenceIds;
                                        const _errs41 = errors;
                                        if (errors === _errs41) {
                                          if (Array.isArray(data16)) {
                                            var valid9 = true;
                                            const len3 = data16.length;
                                            for (let i3 = 0; i3 < len3; i3++) {
                                              const _errs43 = errors;
                                              if (
                                                typeof data16[i3] !== 'string'
                                              ) {
                                                validate25.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      '/refundable/evidenceIds/' +
                                                      i3,
                                                    schemaPath:
                                                      '#/$defs/booleanField/properties/evidenceIds/items/type',
                                                    keyword: 'type',
                                                    params: { type: 'string' },
                                                    message: 'must be string',
                                                  },
                                                ];
                                                return false;
                                              }
                                              var valid9 = _errs43 === errors;
                                              if (!valid9) {
                                                break;
                                              }
                                            }
                                          } else {
                                            validate25.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/refundable/evidenceIds',
                                                schemaPath:
                                                  '#/$defs/booleanField/properties/evidenceIds/type',
                                                keyword: 'type',
                                                params: { type: 'array' },
                                                message: 'must be array',
                                              },
                                            ];
                                            return false;
                                          }
                                        }
                                        var valid6 = _errs41 === errors;
                                      } else {
                                        var valid6 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate25.errors = [
                            {
                              instancePath: instancePath + '/refundable',
                              schemaPath: '#/$defs/booleanField/type',
                              keyword: 'type',
                              params: { type: 'object' },
                              message: 'must be object',
                            },
                          ];
                          return false;
                        }
                      }
                      var valid0 = _errs23 === errors;
                    } else {
                      var valid0 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate25.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate25.errors = vErrors;
  return errors === 0;
}
validate25.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
const schema47 = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    kind: {
      type: 'string',
      enum: [
        'water',
        'sewer',
        'trash',
        'electricity',
        'gas',
        'internet',
        'cable',
        'other',
      ],
    },
    label: { type: 'string' },
    responsibility: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['known', 'unknown', 'not_applicable', 'conflict'],
        },
        value: {
          anyOf: [
            {
              type: 'string',
              enum: [
                'included_in_rent',
                'tenant_pays_provider',
                'tenant_pays_landlord',
              ],
            },
            { type: 'null' },
          ],
        },
        candidates: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'included_in_rent',
              'tenant_pays_provider',
              'tenant_pays_landlord',
            ],
          },
        },
        scope: {
          type: 'string',
          enum: [
            'selected_unit',
            'floor_plan',
            'building',
            'listing',
            'unknown',
          ],
        },
        evidenceIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'value', 'candidates', 'scope', 'evidenceIds'],
      additionalProperties: false,
    },
    amount: { $ref: '#/$defs/moneyField' },
    applicability: { $ref: '#/$defs/applicability' },
  },
  required: [
    'id',
    'kind',
    'label',
    'responsibility',
    'amount',
    'applicability',
  ],
  additionalProperties: false,
};
function validate29(
  data,
  {
    instancePath = '',
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate29.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = 'id')) ||
        (data.kind === undefined && (missing0 = 'kind')) ||
        (data.label === undefined && (missing0 = 'label')) ||
        (data.responsibility === undefined && (missing0 = 'responsibility')) ||
        (data.amount === undefined && (missing0 = 'amount')) ||
        (data.applicability === undefined && (missing0 = 'applicability'))
      ) {
        validate29.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(
            key0 === 'id' ||
            key0 === 'kind' ||
            key0 === 'label' ||
            key0 === 'responsibility' ||
            key0 === 'amount' ||
            key0 === 'applicability'
          )) {
            validate29.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            const _errs2 = errors;
            if (typeof data.id !== 'string') {
              validate29.errors = [
                {
                  instancePath: instancePath + '/id',
                  schemaPath: '#/properties/id/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.kind !== undefined) {
              let data1 = data.kind;
              const _errs4 = errors;
              if (typeof data1 !== 'string') {
                validate29.errors = [
                  {
                    instancePath: instancePath + '/kind',
                    schemaPath: '#/properties/kind/type',
                    keyword: 'type',
                    params: { type: 'string' },
                    message: 'must be string',
                  },
                ];
                return false;
              }
              if (!(
                data1 === 'water' ||
                data1 === 'sewer' ||
                data1 === 'trash' ||
                data1 === 'electricity' ||
                data1 === 'gas' ||
                data1 === 'internet' ||
                data1 === 'cable' ||
                data1 === 'other'
              )) {
                validate29.errors = [
                  {
                    instancePath: instancePath + '/kind',
                    schemaPath: '#/properties/kind/enum',
                    keyword: 'enum',
                    params: { allowedValues: schema47.properties.kind.enum },
                    message: 'must be equal to one of the allowed values',
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.label !== undefined) {
                const _errs6 = errors;
                if (typeof data.label !== 'string') {
                  validate29.errors = [
                    {
                      instancePath: instancePath + '/label',
                      schemaPath: '#/properties/label/type',
                      keyword: 'type',
                      params: { type: 'string' },
                      message: 'must be string',
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.responsibility !== undefined) {
                  let data3 = data.responsibility;
                  const _errs8 = errors;
                  if (errors === _errs8) {
                    if (
                      data3 &&
                      typeof data3 == 'object' &&
                      !Array.isArray(data3)
                    ) {
                      let missing1;
                      if (
                        (data3.status === undefined && (missing1 = 'status')) ||
                        (data3.value === undefined && (missing1 = 'value')) ||
                        (data3.candidates === undefined &&
                          (missing1 = 'candidates')) ||
                        (data3.scope === undefined && (missing1 = 'scope')) ||
                        (data3.evidenceIds === undefined &&
                          (missing1 = 'evidenceIds'))
                      ) {
                        validate29.errors = [
                          {
                            instancePath: instancePath + '/responsibility',
                            schemaPath: '#/properties/responsibility/required',
                            keyword: 'required',
                            params: { missingProperty: missing1 },
                            message:
                              "must have required property '" + missing1 + "'",
                          },
                        ];
                        return false;
                      } else {
                        const _errs10 = errors;
                        for (const key1 in data3) {
                          if (!(
                            key1 === 'status' ||
                            key1 === 'value' ||
                            key1 === 'candidates' ||
                            key1 === 'scope' ||
                            key1 === 'evidenceIds'
                          )) {
                            validate29.errors = [
                              {
                                instancePath: instancePath + '/responsibility',
                                schemaPath:
                                  '#/properties/responsibility/additionalProperties',
                                keyword: 'additionalProperties',
                                params: { additionalProperty: key1 },
                                message: 'must NOT have additional properties',
                              },
                            ];
                            return false;
                            break;
                          }
                        }
                        if (_errs10 === errors) {
                          if (data3.status !== undefined) {
                            let data4 = data3.status;
                            const _errs11 = errors;
                            if (typeof data4 !== 'string') {
                              validate29.errors = [
                                {
                                  instancePath:
                                    instancePath + '/responsibility/status',
                                  schemaPath:
                                    '#/properties/responsibility/properties/status/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                },
                              ];
                              return false;
                            }
                            if (!(
                              data4 === 'known' ||
                              data4 === 'unknown' ||
                              data4 === 'not_applicable' ||
                              data4 === 'conflict'
                            )) {
                              validate29.errors = [
                                {
                                  instancePath:
                                    instancePath + '/responsibility/status',
                                  schemaPath:
                                    '#/properties/responsibility/properties/status/enum',
                                  keyword: 'enum',
                                  params: {
                                    allowedValues:
                                      schema47.properties.responsibility
                                        .properties.status.enum,
                                  },
                                  message:
                                    'must be equal to one of the allowed values',
                                },
                              ];
                              return false;
                            }
                            var valid1 = _errs11 === errors;
                          } else {
                            var valid1 = true;
                          }
                          if (valid1) {
                            if (data3.value !== undefined) {
                              let data5 = data3.value;
                              const _errs13 = errors;
                              const _errs14 = errors;
                              let valid2 = false;
                              const _errs15 = errors;
                              if (typeof data5 !== 'string') {
                                const err0 = {
                                  instancePath:
                                    instancePath + '/responsibility/value',
                                  schemaPath:
                                    '#/properties/responsibility/properties/value/anyOf/0/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                };
                                if (vErrors === null) {
                                  vErrors = [err0];
                                } else {
                                  vErrors.push(err0);
                                }
                                errors++;
                              }
                              if (!(
                                data5 === 'included_in_rent' ||
                                data5 === 'tenant_pays_provider' ||
                                data5 === 'tenant_pays_landlord'
                              )) {
                                const err1 = {
                                  instancePath:
                                    instancePath + '/responsibility/value',
                                  schemaPath:
                                    '#/properties/responsibility/properties/value/anyOf/0/enum',
                                  keyword: 'enum',
                                  params: {
                                    allowedValues:
                                      schema47.properties.responsibility
                                        .properties.value.anyOf[0].enum,
                                  },
                                  message:
                                    'must be equal to one of the allowed values',
                                };
                                if (vErrors === null) {
                                  vErrors = [err1];
                                } else {
                                  vErrors.push(err1);
                                }
                                errors++;
                              }
                              var _valid0 = _errs15 === errors;
                              valid2 = valid2 || _valid0;
                              const _errs17 = errors;
                              if (data5 !== null) {
                                const err2 = {
                                  instancePath:
                                    instancePath + '/responsibility/value',
                                  schemaPath:
                                    '#/properties/responsibility/properties/value/anyOf/1/type',
                                  keyword: 'type',
                                  params: { type: 'null' },
                                  message: 'must be null',
                                };
                                if (vErrors === null) {
                                  vErrors = [err2];
                                } else {
                                  vErrors.push(err2);
                                }
                                errors++;
                              }
                              var _valid0 = _errs17 === errors;
                              valid2 = valid2 || _valid0;
                              if (!valid2) {
                                const err3 = {
                                  instancePath:
                                    instancePath + '/responsibility/value',
                                  schemaPath:
                                    '#/properties/responsibility/properties/value/anyOf',
                                  keyword: 'anyOf',
                                  params: {},
                                  message: 'must match a schema in anyOf',
                                };
                                if (vErrors === null) {
                                  vErrors = [err3];
                                } else {
                                  vErrors.push(err3);
                                }
                                errors++;
                                validate29.errors = vErrors;
                                return false;
                              } else {
                                errors = _errs14;
                                if (vErrors !== null) {
                                  if (_errs14) {
                                    vErrors.length = _errs14;
                                  } else {
                                    vErrors = null;
                                  }
                                }
                              }
                              var valid1 = _errs13 === errors;
                            } else {
                              var valid1 = true;
                            }
                            if (valid1) {
                              if (data3.candidates !== undefined) {
                                let data6 = data3.candidates;
                                const _errs19 = errors;
                                if (errors === _errs19) {
                                  if (Array.isArray(data6)) {
                                    var valid3 = true;
                                    const len0 = data6.length;
                                    for (let i0 = 0; i0 < len0; i0++) {
                                      let data7 = data6[i0];
                                      const _errs21 = errors;
                                      if (typeof data7 !== 'string') {
                                        validate29.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/responsibility/candidates/' +
                                              i0,
                                            schemaPath:
                                              '#/properties/responsibility/properties/candidates/items/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          },
                                        ];
                                        return false;
                                      }
                                      if (!(
                                        data7 === 'included_in_rent' ||
                                        data7 === 'tenant_pays_provider' ||
                                        data7 === 'tenant_pays_landlord'
                                      )) {
                                        validate29.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/responsibility/candidates/' +
                                              i0,
                                            schemaPath:
                                              '#/properties/responsibility/properties/candidates/items/enum',
                                            keyword: 'enum',
                                            params: {
                                              allowedValues:
                                                schema47.properties
                                                  .responsibility.properties
                                                  .candidates.items.enum,
                                            },
                                            message:
                                              'must be equal to one of the allowed values',
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid3 = _errs21 === errors;
                                      if (!valid3) {
                                        break;
                                      }
                                    }
                                  } else {
                                    validate29.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          '/responsibility/candidates',
                                        schemaPath:
                                          '#/properties/responsibility/properties/candidates/type',
                                        keyword: 'type',
                                        params: { type: 'array' },
                                        message: 'must be array',
                                      },
                                    ];
                                    return false;
                                  }
                                }
                                var valid1 = _errs19 === errors;
                              } else {
                                var valid1 = true;
                              }
                              if (valid1) {
                                if (data3.scope !== undefined) {
                                  let data8 = data3.scope;
                                  const _errs23 = errors;
                                  if (typeof data8 !== 'string') {
                                    validate29.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          '/responsibility/scope',
                                        schemaPath:
                                          '#/properties/responsibility/properties/scope/type',
                                        keyword: 'type',
                                        params: { type: 'string' },
                                        message: 'must be string',
                                      },
                                    ];
                                    return false;
                                  }
                                  if (!(
                                    data8 === 'selected_unit' ||
                                    data8 === 'floor_plan' ||
                                    data8 === 'building' ||
                                    data8 === 'listing' ||
                                    data8 === 'unknown'
                                  )) {
                                    validate29.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          '/responsibility/scope',
                                        schemaPath:
                                          '#/properties/responsibility/properties/scope/enum',
                                        keyword: 'enum',
                                        params: {
                                          allowedValues:
                                            schema47.properties.responsibility
                                              .properties.scope.enum,
                                        },
                                        message:
                                          'must be equal to one of the allowed values',
                                      },
                                    ];
                                    return false;
                                  }
                                  var valid1 = _errs23 === errors;
                                } else {
                                  var valid1 = true;
                                }
                                if (valid1) {
                                  if (data3.evidenceIds !== undefined) {
                                    let data9 = data3.evidenceIds;
                                    const _errs25 = errors;
                                    if (errors === _errs25) {
                                      if (Array.isArray(data9)) {
                                        var valid4 = true;
                                        const len1 = data9.length;
                                        for (let i1 = 0; i1 < len1; i1++) {
                                          const _errs27 = errors;
                                          if (typeof data9[i1] !== 'string') {
                                            validate29.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/responsibility/evidenceIds/' +
                                                  i1,
                                                schemaPath:
                                                  '#/properties/responsibility/properties/evidenceIds/items/type',
                                                keyword: 'type',
                                                params: { type: 'string' },
                                                message: 'must be string',
                                              },
                                            ];
                                            return false;
                                          }
                                          var valid4 = _errs27 === errors;
                                          if (!valid4) {
                                            break;
                                          }
                                        }
                                      } else {
                                        validate29.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/responsibility/evidenceIds',
                                            schemaPath:
                                              '#/properties/responsibility/properties/evidenceIds/type',
                                            keyword: 'type',
                                            params: { type: 'array' },
                                            message: 'must be array',
                                          },
                                        ];
                                        return false;
                                      }
                                    }
                                    var valid1 = _errs25 === errors;
                                  } else {
                                    var valid1 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    } else {
                      validate29.errors = [
                        {
                          instancePath: instancePath + '/responsibility',
                          schemaPath: '#/properties/responsibility/type',
                          keyword: 'type',
                          params: { type: 'object' },
                          message: 'must be object',
                        },
                      ];
                      return false;
                    }
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.amount !== undefined) {
                    const _errs29 = errors;
                    if (
                      !validate23(data.amount, {
                        instancePath: instancePath + '/amount',
                        parentData: data,
                        parentDataProperty: 'amount',
                        rootData,
                        dynamicAnchors,
                      })
                    ) {
                      vErrors =
                        vErrors === null
                          ? validate23.errors
                          : vErrors.concat(validate23.errors);
                      errors = vErrors.length;
                    }
                    var valid0 = _errs29 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.applicability !== undefined) {
                      let data12 = data.applicability;
                      const _errs30 = errors;
                      const _errs31 = errors;
                      if (errors === _errs31) {
                        if (
                          data12 &&
                          typeof data12 == 'object' &&
                          !Array.isArray(data12)
                        ) {
                          let missing2;
                          if (
                            (data12.kind === undefined &&
                              (missing2 = 'kind')) ||
                            (data12.conditions === undefined &&
                              (missing2 = 'conditions')) ||
                            (data12.evidenceIds === undefined &&
                              (missing2 = 'evidenceIds'))
                          ) {
                            validate29.errors = [
                              {
                                instancePath: instancePath + '/applicability',
                                schemaPath: '#/$defs/applicability/required',
                                keyword: 'required',
                                params: { missingProperty: missing2 },
                                message:
                                  "must have required property '" +
                                  missing2 +
                                  "'",
                              },
                            ];
                            return false;
                          } else {
                            const _errs33 = errors;
                            for (const key2 in data12) {
                              if (!(
                                key2 === 'kind' ||
                                key2 === 'conditions' ||
                                key2 === 'evidenceIds'
                              )) {
                                validate29.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/applicability',
                                    schemaPath:
                                      '#/$defs/applicability/additionalProperties',
                                    keyword: 'additionalProperties',
                                    params: { additionalProperty: key2 },
                                    message:
                                      'must NOT have additional properties',
                                  },
                                ];
                                return false;
                                break;
                              }
                            }
                            if (_errs33 === errors) {
                              if (data12.kind !== undefined) {
                                let data13 = data12.kind;
                                const _errs34 = errors;
                                if (typeof data13 !== 'string') {
                                  validate29.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/applicability/kind',
                                      schemaPath:
                                        '#/$defs/applicability/properties/kind/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    },
                                  ];
                                  return false;
                                }
                                if (!(
                                  data13 === 'required' ||
                                  data13 === 'optional' ||
                                  data13 === 'conditional' ||
                                  data13 === 'unknown'
                                )) {
                                  validate29.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/applicability/kind',
                                      schemaPath:
                                        '#/$defs/applicability/properties/kind/enum',
                                      keyword: 'enum',
                                      params: {
                                        allowedValues:
                                          schema45.properties.kind.enum,
                                      },
                                      message:
                                        'must be equal to one of the allowed values',
                                    },
                                  ];
                                  return false;
                                }
                                var valid6 = _errs34 === errors;
                              } else {
                                var valid6 = true;
                              }
                              if (valid6) {
                                if (data12.conditions !== undefined) {
                                  let data14 = data12.conditions;
                                  const _errs36 = errors;
                                  if (errors === _errs36) {
                                    if (Array.isArray(data14)) {
                                      var valid7 = true;
                                      const len2 = data14.length;
                                      for (let i2 = 0; i2 < len2; i2++) {
                                        const _errs38 = errors;
                                        if (typeof data14[i2] !== 'string') {
                                          validate29.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/applicability/conditions/' +
                                                i2,
                                              schemaPath:
                                                '#/$defs/applicability/properties/conditions/items/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid7 = _errs38 === errors;
                                        if (!valid7) {
                                          break;
                                        }
                                      }
                                    } else {
                                      validate29.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/applicability/conditions',
                                          schemaPath:
                                            '#/$defs/applicability/properties/conditions/type',
                                          keyword: 'type',
                                          params: { type: 'array' },
                                          message: 'must be array',
                                        },
                                      ];
                                      return false;
                                    }
                                  }
                                  var valid6 = _errs36 === errors;
                                } else {
                                  var valid6 = true;
                                }
                                if (valid6) {
                                  if (data12.evidenceIds !== undefined) {
                                    let data16 = data12.evidenceIds;
                                    const _errs40 = errors;
                                    if (errors === _errs40) {
                                      if (Array.isArray(data16)) {
                                        var valid8 = true;
                                        const len3 = data16.length;
                                        for (let i3 = 0; i3 < len3; i3++) {
                                          const _errs42 = errors;
                                          if (typeof data16[i3] !== 'string') {
                                            validate29.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/applicability/evidenceIds/' +
                                                  i3,
                                                schemaPath:
                                                  '#/$defs/applicability/properties/evidenceIds/items/type',
                                                keyword: 'type',
                                                params: { type: 'string' },
                                                message: 'must be string',
                                              },
                                            ];
                                            return false;
                                          }
                                          var valid8 = _errs42 === errors;
                                          if (!valid8) {
                                            break;
                                          }
                                        }
                                      } else {
                                        validate29.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/applicability/evidenceIds',
                                            schemaPath:
                                              '#/$defs/applicability/properties/evidenceIds/type',
                                            keyword: 'type',
                                            params: { type: 'array' },
                                            message: 'must be array',
                                          },
                                        ];
                                        return false;
                                      }
                                    }
                                    var valid6 = _errs40 === errors;
                                  } else {
                                    var valid6 = true;
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate29.errors = [
                            {
                              instancePath: instancePath + '/applicability',
                              schemaPath: '#/$defs/applicability/type',
                              keyword: 'type',
                              params: { type: 'object' },
                              message: 'must be object',
                            },
                          ];
                          return false;
                        }
                      }
                      var valid0 = _errs30 === errors;
                    } else {
                      var valid0 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate29.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate29.errors = vErrors;
  return errors === 0;
}
validate29.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
const schema51 = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    description: { type: 'string' },
    benefitType: {
      type: 'string',
      enum: ['free_rent', 'rent_discount', 'fee_waiver', 'other', 'unknown'],
    },
    discount: { $ref: '#/$defs/moneyField' },
    freeRentDuration: { $ref: '#/$defs/durationField' },
    advertisedEffectiveRent: { $ref: '#/$defs/moneyField' },
    requiredLeaseTerm: { $ref: '#/$defs/durationField' },
    applyBy: { $ref: '#/$defs/dateField' },
    moveInBy: { $ref: '#/$defs/dateField' },
    applicability: { $ref: '#/$defs/applicability' },
    evidenceIds: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'id',
    'description',
    'benefitType',
    'discount',
    'freeRentDuration',
    'advertisedEffectiveRent',
    'requiredLeaseTerm',
    'applyBy',
    'moveInBy',
    'applicability',
    'evidenceIds',
  ],
  additionalProperties: false,
};
function validate33(
  data,
  {
    instancePath = '',
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate33.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = 'id')) ||
        (data.description === undefined && (missing0 = 'description')) ||
        (data.benefitType === undefined && (missing0 = 'benefitType')) ||
        (data.discount === undefined && (missing0 = 'discount')) ||
        (data.freeRentDuration === undefined &&
          (missing0 = 'freeRentDuration')) ||
        (data.advertisedEffectiveRent === undefined &&
          (missing0 = 'advertisedEffectiveRent')) ||
        (data.requiredLeaseTerm === undefined &&
          (missing0 = 'requiredLeaseTerm')) ||
        (data.applyBy === undefined && (missing0 = 'applyBy')) ||
        (data.moveInBy === undefined && (missing0 = 'moveInBy')) ||
        (data.applicability === undefined && (missing0 = 'applicability')) ||
        (data.evidenceIds === undefined && (missing0 = 'evidenceIds'))
      ) {
        validate33.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func1.call(schema51.properties, key0)) {
            validate33.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            const _errs2 = errors;
            if (typeof data.id !== 'string') {
              validate33.errors = [
                {
                  instancePath: instancePath + '/id',
                  schemaPath: '#/properties/id/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.description !== undefined) {
              const _errs4 = errors;
              if (typeof data.description !== 'string') {
                validate33.errors = [
                  {
                    instancePath: instancePath + '/description',
                    schemaPath: '#/properties/description/type',
                    keyword: 'type',
                    params: { type: 'string' },
                    message: 'must be string',
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.benefitType !== undefined) {
                let data2 = data.benefitType;
                const _errs6 = errors;
                if (typeof data2 !== 'string') {
                  validate33.errors = [
                    {
                      instancePath: instancePath + '/benefitType',
                      schemaPath: '#/properties/benefitType/type',
                      keyword: 'type',
                      params: { type: 'string' },
                      message: 'must be string',
                    },
                  ];
                  return false;
                }
                if (!(
                  data2 === 'free_rent' ||
                  data2 === 'rent_discount' ||
                  data2 === 'fee_waiver' ||
                  data2 === 'other' ||
                  data2 === 'unknown'
                )) {
                  validate33.errors = [
                    {
                      instancePath: instancePath + '/benefitType',
                      schemaPath: '#/properties/benefitType/enum',
                      keyword: 'enum',
                      params: {
                        allowedValues: schema51.properties.benefitType.enum,
                      },
                      message: 'must be equal to one of the allowed values',
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.discount !== undefined) {
                  const _errs8 = errors;
                  if (
                    !validate23(data.discount, {
                      instancePath: instancePath + '/discount',
                      parentData: data,
                      parentDataProperty: 'discount',
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate23.errors
                        : vErrors.concat(validate23.errors);
                    errors = vErrors.length;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.freeRentDuration !== undefined) {
                    let data4 = data.freeRentDuration;
                    const _errs9 = errors;
                    const _errs10 = errors;
                    if (errors === _errs10) {
                      if (
                        data4 &&
                        typeof data4 == 'object' &&
                        !Array.isArray(data4)
                      ) {
                        let missing1;
                        if (
                          (data4.status === undefined &&
                            (missing1 = 'status')) ||
                          (data4.value === undefined && (missing1 = 'value')) ||
                          (data4.candidates === undefined &&
                            (missing1 = 'candidates')) ||
                          (data4.scope === undefined && (missing1 = 'scope')) ||
                          (data4.evidenceIds === undefined &&
                            (missing1 = 'evidenceIds'))
                        ) {
                          validate33.errors = [
                            {
                              instancePath: instancePath + '/freeRentDuration',
                              schemaPath: '#/$defs/durationField/required',
                              keyword: 'required',
                              params: { missingProperty: missing1 },
                              message:
                                "must have required property '" +
                                missing1 +
                                "'",
                            },
                          ];
                          return false;
                        } else {
                          const _errs12 = errors;
                          for (const key1 in data4) {
                            if (!(
                              key1 === 'status' ||
                              key1 === 'value' ||
                              key1 === 'candidates' ||
                              key1 === 'scope' ||
                              key1 === 'evidenceIds'
                            )) {
                              validate33.errors = [
                                {
                                  instancePath:
                                    instancePath + '/freeRentDuration',
                                  schemaPath:
                                    '#/$defs/durationField/additionalProperties',
                                  keyword: 'additionalProperties',
                                  params: { additionalProperty: key1 },
                                  message:
                                    'must NOT have additional properties',
                                },
                              ];
                              return false;
                              break;
                            }
                          }
                          if (_errs12 === errors) {
                            if (data4.status !== undefined) {
                              let data5 = data4.status;
                              const _errs13 = errors;
                              if (typeof data5 !== 'string') {
                                validate33.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/freeRentDuration/status',
                                    schemaPath:
                                      '#/$defs/durationField/properties/status/type',
                                    keyword: 'type',
                                    params: { type: 'string' },
                                    message: 'must be string',
                                  },
                                ];
                                return false;
                              }
                              if (!(
                                data5 === 'known' ||
                                data5 === 'unknown' ||
                                data5 === 'not_applicable' ||
                                data5 === 'conflict'
                              )) {
                                validate33.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/freeRentDuration/status',
                                    schemaPath:
                                      '#/$defs/durationField/properties/status/enum',
                                    keyword: 'enum',
                                    params: {
                                      allowedValues:
                                        schema49.properties.status.enum,
                                    },
                                    message:
                                      'must be equal to one of the allowed values',
                                  },
                                ];
                                return false;
                              }
                              var valid2 = _errs13 === errors;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data4.value !== undefined) {
                                let data6 = data4.value;
                                const _errs15 = errors;
                                const _errs16 = errors;
                                let valid3 = false;
                                const _errs17 = errors;
                                if (errors === _errs17) {
                                  if (
                                    data6 &&
                                    typeof data6 == 'object' &&
                                    !Array.isArray(data6)
                                  ) {
                                    let missing2;
                                    if (
                                      (data6.kind === undefined &&
                                        (missing2 = 'kind')) ||
                                      (data6.min === undefined &&
                                        (missing2 = 'min')) ||
                                      (data6.max === undefined &&
                                        (missing2 = 'max')) ||
                                      (data6.unit === undefined &&
                                        (missing2 = 'unit'))
                                    ) {
                                      const err0 = {
                                        instancePath:
                                          instancePath +
                                          '/freeRentDuration/value',
                                        schemaPath:
                                          '#/$defs/durationField/properties/value/anyOf/0/required',
                                        keyword: 'required',
                                        params: { missingProperty: missing2 },
                                        message:
                                          "must have required property '" +
                                          missing2 +
                                          "'",
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err0];
                                      } else {
                                        vErrors.push(err0);
                                      }
                                      errors++;
                                    } else {
                                      const _errs19 = errors;
                                      for (const key2 in data6) {
                                        if (!(
                                          key2 === 'kind' ||
                                          key2 === 'min' ||
                                          key2 === 'max' ||
                                          key2 === 'unit'
                                        )) {
                                          const err1 = {
                                            instancePath:
                                              instancePath +
                                              '/freeRentDuration/value',
                                            schemaPath:
                                              '#/$defs/durationField/properties/value/anyOf/0/additionalProperties',
                                            keyword: 'additionalProperties',
                                            params: {
                                              additionalProperty: key2,
                                            },
                                            message:
                                              'must NOT have additional properties',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err1];
                                          } else {
                                            vErrors.push(err1);
                                          }
                                          errors++;
                                          break;
                                        }
                                      }
                                      if (_errs19 === errors) {
                                        if (data6.kind !== undefined) {
                                          let data7 = data6.kind;
                                          const _errs20 = errors;
                                          if (typeof data7 !== 'string') {
                                            const err2 = {
                                              instancePath:
                                                instancePath +
                                                '/freeRentDuration/value/kind',
                                              schemaPath:
                                                '#/$defs/durationField/properties/value/anyOf/0/properties/kind/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err2];
                                            } else {
                                              vErrors.push(err2);
                                            }
                                            errors++;
                                          }
                                          if (!(
                                            data7 === 'exact' ||
                                            data7 === 'range'
                                          )) {
                                            const err3 = {
                                              instancePath:
                                                instancePath +
                                                '/freeRentDuration/value/kind',
                                              schemaPath:
                                                '#/$defs/durationField/properties/value/anyOf/0/properties/kind/enum',
                                              keyword: 'enum',
                                              params: {
                                                allowedValues:
                                                  schema49.properties.value
                                                    .anyOf[0].properties.kind
                                                    .enum,
                                              },
                                              message:
                                                'must be equal to one of the allowed values',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err3];
                                            } else {
                                              vErrors.push(err3);
                                            }
                                            errors++;
                                          }
                                          var valid4 = _errs20 === errors;
                                        } else {
                                          var valid4 = true;
                                        }
                                        if (valid4) {
                                          if (data6.min !== undefined) {
                                            let data8 = data6.min;
                                            const _errs22 = errors;
                                            const _errs23 = errors;
                                            let valid5 = false;
                                            const _errs24 = errors;
                                            if (!(typeof data8 == 'number')) {
                                              const err4 = {
                                                instancePath:
                                                  instancePath +
                                                  '/freeRentDuration/value/min',
                                                schemaPath:
                                                  '#/$defs/durationField/properties/value/anyOf/0/properties/min/anyOf/0/type',
                                                keyword: 'type',
                                                params: { type: 'number' },
                                                message: 'must be number',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err4];
                                              } else {
                                                vErrors.push(err4);
                                              }
                                              errors++;
                                            }
                                            var _valid1 = _errs24 === errors;
                                            valid5 = valid5 || _valid1;
                                            const _errs26 = errors;
                                            if (data8 !== null) {
                                              const err5 = {
                                                instancePath:
                                                  instancePath +
                                                  '/freeRentDuration/value/min',
                                                schemaPath:
                                                  '#/$defs/durationField/properties/value/anyOf/0/properties/min/anyOf/1/type',
                                                keyword: 'type',
                                                params: { type: 'null' },
                                                message: 'must be null',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err5];
                                              } else {
                                                vErrors.push(err5);
                                              }
                                              errors++;
                                            }
                                            var _valid1 = _errs26 === errors;
                                            valid5 = valid5 || _valid1;
                                            if (!valid5) {
                                              const err6 = {
                                                instancePath:
                                                  instancePath +
                                                  '/freeRentDuration/value/min',
                                                schemaPath:
                                                  '#/$defs/durationField/properties/value/anyOf/0/properties/min/anyOf',
                                                keyword: 'anyOf',
                                                params: {},
                                                message:
                                                  'must match a schema in anyOf',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err6];
                                              } else {
                                                vErrors.push(err6);
                                              }
                                              errors++;
                                            } else {
                                              errors = _errs23;
                                              if (vErrors !== null) {
                                                if (_errs23) {
                                                  vErrors.length = _errs23;
                                                } else {
                                                  vErrors = null;
                                                }
                                              }
                                            }
                                            var valid4 = _errs22 === errors;
                                          } else {
                                            var valid4 = true;
                                          }
                                          if (valid4) {
                                            if (data6.max !== undefined) {
                                              let data9 = data6.max;
                                              const _errs28 = errors;
                                              const _errs29 = errors;
                                              let valid6 = false;
                                              const _errs30 = errors;
                                              if (!(typeof data9 == 'number')) {
                                                const err7 = {
                                                  instancePath:
                                                    instancePath +
                                                    '/freeRentDuration/value/max',
                                                  schemaPath:
                                                    '#/$defs/durationField/properties/value/anyOf/0/properties/max/anyOf/0/type',
                                                  keyword: 'type',
                                                  params: { type: 'number' },
                                                  message: 'must be number',
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err7];
                                                } else {
                                                  vErrors.push(err7);
                                                }
                                                errors++;
                                              }
                                              var _valid2 = _errs30 === errors;
                                              valid6 = valid6 || _valid2;
                                              const _errs32 = errors;
                                              if (data9 !== null) {
                                                const err8 = {
                                                  instancePath:
                                                    instancePath +
                                                    '/freeRentDuration/value/max',
                                                  schemaPath:
                                                    '#/$defs/durationField/properties/value/anyOf/0/properties/max/anyOf/1/type',
                                                  keyword: 'type',
                                                  params: { type: 'null' },
                                                  message: 'must be null',
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err8];
                                                } else {
                                                  vErrors.push(err8);
                                                }
                                                errors++;
                                              }
                                              var _valid2 = _errs32 === errors;
                                              valid6 = valid6 || _valid2;
                                              if (!valid6) {
                                                const err9 = {
                                                  instancePath:
                                                    instancePath +
                                                    '/freeRentDuration/value/max',
                                                  schemaPath:
                                                    '#/$defs/durationField/properties/value/anyOf/0/properties/max/anyOf',
                                                  keyword: 'anyOf',
                                                  params: {},
                                                  message:
                                                    'must match a schema in anyOf',
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err9];
                                                } else {
                                                  vErrors.push(err9);
                                                }
                                                errors++;
                                              } else {
                                                errors = _errs29;
                                                if (vErrors !== null) {
                                                  if (_errs29) {
                                                    vErrors.length = _errs29;
                                                  } else {
                                                    vErrors = null;
                                                  }
                                                }
                                              }
                                              var valid4 = _errs28 === errors;
                                            } else {
                                              var valid4 = true;
                                            }
                                            if (valid4) {
                                              if (data6.unit !== undefined) {
                                                let data10 = data6.unit;
                                                const _errs34 = errors;
                                                if (
                                                  typeof data10 !== 'string'
                                                ) {
                                                  const err10 = {
                                                    instancePath:
                                                      instancePath +
                                                      '/freeRentDuration/value/unit',
                                                    schemaPath:
                                                      '#/$defs/durationField/properties/value/anyOf/0/properties/unit/type',
                                                    keyword: 'type',
                                                    params: { type: 'string' },
                                                    message: 'must be string',
                                                  };
                                                  if (vErrors === null) {
                                                    vErrors = [err10];
                                                  } else {
                                                    vErrors.push(err10);
                                                  }
                                                  errors++;
                                                }
                                                if (!(
                                                  data10 === 'months' ||
                                                  data10 === 'weeks' ||
                                                  data10 === 'days'
                                                )) {
                                                  const err11 = {
                                                    instancePath:
                                                      instancePath +
                                                      '/freeRentDuration/value/unit',
                                                    schemaPath:
                                                      '#/$defs/durationField/properties/value/anyOf/0/properties/unit/enum',
                                                    keyword: 'enum',
                                                    params: {
                                                      allowedValues:
                                                        schema49.properties
                                                          .value.anyOf[0]
                                                          .properties.unit.enum,
                                                    },
                                                    message:
                                                      'must be equal to one of the allowed values',
                                                  };
                                                  if (vErrors === null) {
                                                    vErrors = [err11];
                                                  } else {
                                                    vErrors.push(err11);
                                                  }
                                                  errors++;
                                                }
                                                var valid4 = _errs34 === errors;
                                              } else {
                                                var valid4 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    const err12 = {
                                      instancePath:
                                        instancePath +
                                        '/freeRentDuration/value',
                                      schemaPath:
                                        '#/$defs/durationField/properties/value/anyOf/0/type',
                                      keyword: 'type',
                                      params: { type: 'object' },
                                      message: 'must be object',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err12];
                                    } else {
                                      vErrors.push(err12);
                                    }
                                    errors++;
                                  }
                                }
                                var _valid0 = _errs17 === errors;
                                valid3 = valid3 || _valid0;
                                const _errs36 = errors;
                                if (data6 !== null) {
                                  const err13 = {
                                    instancePath:
                                      instancePath + '/freeRentDuration/value',
                                    schemaPath:
                                      '#/$defs/durationField/properties/value/anyOf/1/type',
                                    keyword: 'type',
                                    params: { type: 'null' },
                                    message: 'must be null',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err13];
                                  } else {
                                    vErrors.push(err13);
                                  }
                                  errors++;
                                }
                                var _valid0 = _errs36 === errors;
                                valid3 = valid3 || _valid0;
                                if (!valid3) {
                                  const err14 = {
                                    instancePath:
                                      instancePath + '/freeRentDuration/value',
                                    schemaPath:
                                      '#/$defs/durationField/properties/value/anyOf',
                                    keyword: 'anyOf',
                                    params: {},
                                    message: 'must match a schema in anyOf',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err14];
                                  } else {
                                    vErrors.push(err14);
                                  }
                                  errors++;
                                  validate33.errors = vErrors;
                                  return false;
                                } else {
                                  errors = _errs16;
                                  if (vErrors !== null) {
                                    if (_errs16) {
                                      vErrors.length = _errs16;
                                    } else {
                                      vErrors = null;
                                    }
                                  }
                                }
                                var valid2 = _errs15 === errors;
                              } else {
                                var valid2 = true;
                              }
                              if (valid2) {
                                if (data4.candidates !== undefined) {
                                  let data11 = data4.candidates;
                                  const _errs38 = errors;
                                  if (errors === _errs38) {
                                    if (Array.isArray(data11)) {
                                      var valid7 = true;
                                      const len0 = data11.length;
                                      for (let i0 = 0; i0 < len0; i0++) {
                                        let data12 = data11[i0];
                                        const _errs40 = errors;
                                        if (errors === _errs40) {
                                          if (
                                            data12 &&
                                            typeof data12 == 'object' &&
                                            !Array.isArray(data12)
                                          ) {
                                            let missing3;
                                            if (
                                              (data12.kind === undefined &&
                                                (missing3 = 'kind')) ||
                                              (data12.min === undefined &&
                                                (missing3 = 'min')) ||
                                              (data12.max === undefined &&
                                                (missing3 = 'max')) ||
                                              (data12.unit === undefined &&
                                                (missing3 = 'unit'))
                                            ) {
                                              validate33.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/freeRentDuration/candidates/' +
                                                    i0,
                                                  schemaPath:
                                                    '#/$defs/durationField/properties/candidates/items/required',
                                                  keyword: 'required',
                                                  params: {
                                                    missingProperty: missing3,
                                                  },
                                                  message:
                                                    "must have required property '" +
                                                    missing3 +
                                                    "'",
                                                },
                                              ];
                                              return false;
                                            } else {
                                              const _errs42 = errors;
                                              for (const key3 in data12) {
                                                if (!(
                                                  key3 === 'kind' ||
                                                  key3 === 'min' ||
                                                  key3 === 'max' ||
                                                  key3 === 'unit'
                                                )) {
                                                  validate33.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/freeRentDuration/candidates/' +
                                                        i0,
                                                      schemaPath:
                                                        '#/$defs/durationField/properties/candidates/items/additionalProperties',
                                                      keyword:
                                                        'additionalProperties',
                                                      params: {
                                                        additionalProperty:
                                                          key3,
                                                      },
                                                      message:
                                                        'must NOT have additional properties',
                                                    },
                                                  ];
                                                  return false;
                                                  break;
                                                }
                                              }
                                              if (_errs42 === errors) {
                                                if (data12.kind !== undefined) {
                                                  let data13 = data12.kind;
                                                  const _errs43 = errors;
                                                  if (
                                                    typeof data13 !== 'string'
                                                  ) {
                                                    validate33.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          '/freeRentDuration/candidates/' +
                                                          i0 +
                                                          '/kind',
                                                        schemaPath:
                                                          '#/$defs/durationField/properties/candidates/items/properties/kind/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'string',
                                                        },
                                                        message:
                                                          'must be string',
                                                      },
                                                    ];
                                                    return false;
                                                  }
                                                  if (!(
                                                    data13 === 'exact' ||
                                                    data13 === 'range'
                                                  )) {
                                                    validate33.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          '/freeRentDuration/candidates/' +
                                                          i0 +
                                                          '/kind',
                                                        schemaPath:
                                                          '#/$defs/durationField/properties/candidates/items/properties/kind/enum',
                                                        keyword: 'enum',
                                                        params: {
                                                          allowedValues:
                                                            schema49.properties
                                                              .candidates.items
                                                              .properties.kind
                                                              .enum,
                                                        },
                                                        message:
                                                          'must be equal to one of the allowed values',
                                                      },
                                                    ];
                                                    return false;
                                                  }
                                                  var valid8 =
                                                    _errs43 === errors;
                                                } else {
                                                  var valid8 = true;
                                                }
                                                if (valid8) {
                                                  if (
                                                    data12.min !== undefined
                                                  ) {
                                                    let data14 = data12.min;
                                                    const _errs45 = errors;
                                                    const _errs46 = errors;
                                                    let valid9 = false;
                                                    const _errs47 = errors;
                                                    if (
                                                      !(
                                                        typeof data14 ==
                                                        'number'
                                                      )
                                                    ) {
                                                      const err15 = {
                                                        instancePath:
                                                          instancePath +
                                                          '/freeRentDuration/candidates/' +
                                                          i0 +
                                                          '/min',
                                                        schemaPath:
                                                          '#/$defs/durationField/properties/candidates/items/properties/min/anyOf/0/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'number',
                                                        },
                                                        message:
                                                          'must be number',
                                                      };
                                                      if (vErrors === null) {
                                                        vErrors = [err15];
                                                      } else {
                                                        vErrors.push(err15);
                                                      }
                                                      errors++;
                                                    }
                                                    var _valid3 =
                                                      _errs47 === errors;
                                                    valid9 = valid9 || _valid3;
                                                    const _errs49 = errors;
                                                    if (data14 !== null) {
                                                      const err16 = {
                                                        instancePath:
                                                          instancePath +
                                                          '/freeRentDuration/candidates/' +
                                                          i0 +
                                                          '/min',
                                                        schemaPath:
                                                          '#/$defs/durationField/properties/candidates/items/properties/min/anyOf/1/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'null',
                                                        },
                                                        message: 'must be null',
                                                      };
                                                      if (vErrors === null) {
                                                        vErrors = [err16];
                                                      } else {
                                                        vErrors.push(err16);
                                                      }
                                                      errors++;
                                                    }
                                                    var _valid3 =
                                                      _errs49 === errors;
                                                    valid9 = valid9 || _valid3;
                                                    if (!valid9) {
                                                      const err17 = {
                                                        instancePath:
                                                          instancePath +
                                                          '/freeRentDuration/candidates/' +
                                                          i0 +
                                                          '/min',
                                                        schemaPath:
                                                          '#/$defs/durationField/properties/candidates/items/properties/min/anyOf',
                                                        keyword: 'anyOf',
                                                        params: {},
                                                        message:
                                                          'must match a schema in anyOf',
                                                      };
                                                      if (vErrors === null) {
                                                        vErrors = [err17];
                                                      } else {
                                                        vErrors.push(err17);
                                                      }
                                                      errors++;
                                                      validate33.errors =
                                                        vErrors;
                                                      return false;
                                                    } else {
                                                      errors = _errs46;
                                                      if (vErrors !== null) {
                                                        if (_errs46) {
                                                          vErrors.length =
                                                            _errs46;
                                                        } else {
                                                          vErrors = null;
                                                        }
                                                      }
                                                    }
                                                    var valid8 =
                                                      _errs45 === errors;
                                                  } else {
                                                    var valid8 = true;
                                                  }
                                                  if (valid8) {
                                                    if (
                                                      data12.max !== undefined
                                                    ) {
                                                      let data15 = data12.max;
                                                      const _errs51 = errors;
                                                      const _errs52 = errors;
                                                      let valid10 = false;
                                                      const _errs53 = errors;
                                                      if (
                                                        !(
                                                          typeof data15 ==
                                                          'number'
                                                        )
                                                      ) {
                                                        const err18 = {
                                                          instancePath:
                                                            instancePath +
                                                            '/freeRentDuration/candidates/' +
                                                            i0 +
                                                            '/max',
                                                          schemaPath:
                                                            '#/$defs/durationField/properties/candidates/items/properties/max/anyOf/0/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'number',
                                                          },
                                                          message:
                                                            'must be number',
                                                        };
                                                        if (vErrors === null) {
                                                          vErrors = [err18];
                                                        } else {
                                                          vErrors.push(err18);
                                                        }
                                                        errors++;
                                                      }
                                                      var _valid4 =
                                                        _errs53 === errors;
                                                      valid10 =
                                                        valid10 || _valid4;
                                                      const _errs55 = errors;
                                                      if (data15 !== null) {
                                                        const err19 = {
                                                          instancePath:
                                                            instancePath +
                                                            '/freeRentDuration/candidates/' +
                                                            i0 +
                                                            '/max',
                                                          schemaPath:
                                                            '#/$defs/durationField/properties/candidates/items/properties/max/anyOf/1/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'null',
                                                          },
                                                          message:
                                                            'must be null',
                                                        };
                                                        if (vErrors === null) {
                                                          vErrors = [err19];
                                                        } else {
                                                          vErrors.push(err19);
                                                        }
                                                        errors++;
                                                      }
                                                      var _valid4 =
                                                        _errs55 === errors;
                                                      valid10 =
                                                        valid10 || _valid4;
                                                      if (!valid10) {
                                                        const err20 = {
                                                          instancePath:
                                                            instancePath +
                                                            '/freeRentDuration/candidates/' +
                                                            i0 +
                                                            '/max',
                                                          schemaPath:
                                                            '#/$defs/durationField/properties/candidates/items/properties/max/anyOf',
                                                          keyword: 'anyOf',
                                                          params: {},
                                                          message:
                                                            'must match a schema in anyOf',
                                                        };
                                                        if (vErrors === null) {
                                                          vErrors = [err20];
                                                        } else {
                                                          vErrors.push(err20);
                                                        }
                                                        errors++;
                                                        validate33.errors =
                                                          vErrors;
                                                        return false;
                                                      } else {
                                                        errors = _errs52;
                                                        if (vErrors !== null) {
                                                          if (_errs52) {
                                                            vErrors.length =
                                                              _errs52;
                                                          } else {
                                                            vErrors = null;
                                                          }
                                                        }
                                                      }
                                                      var valid8 =
                                                        _errs51 === errors;
                                                    } else {
                                                      var valid8 = true;
                                                    }
                                                    if (valid8) {
                                                      if (
                                                        data12.unit !==
                                                        undefined
                                                      ) {
                                                        let data16 =
                                                          data12.unit;
                                                        const _errs57 = errors;
                                                        if (
                                                          typeof data16 !==
                                                          'string'
                                                        ) {
                                                          validate33.errors = [
                                                            {
                                                              instancePath:
                                                                instancePath +
                                                                '/freeRentDuration/candidates/' +
                                                                i0 +
                                                                '/unit',
                                                              schemaPath:
                                                                '#/$defs/durationField/properties/candidates/items/properties/unit/type',
                                                              keyword: 'type',
                                                              params: {
                                                                type: 'string',
                                                              },
                                                              message:
                                                                'must be string',
                                                            },
                                                          ];
                                                          return false;
                                                        }
                                                        if (!(
                                                          data16 === 'months' ||
                                                          data16 === 'weeks' ||
                                                          data16 === 'days'
                                                        )) {
                                                          validate33.errors = [
                                                            {
                                                              instancePath:
                                                                instancePath +
                                                                '/freeRentDuration/candidates/' +
                                                                i0 +
                                                                '/unit',
                                                              schemaPath:
                                                                '#/$defs/durationField/properties/candidates/items/properties/unit/enum',
                                                              keyword: 'enum',
                                                              params: {
                                                                allowedValues:
                                                                  schema49
                                                                    .properties
                                                                    .candidates
                                                                    .items
                                                                    .properties
                                                                    .unit.enum,
                                                              },
                                                              message:
                                                                'must be equal to one of the allowed values',
                                                            },
                                                          ];
                                                          return false;
                                                        }
                                                        var valid8 =
                                                          _errs57 === errors;
                                                      } else {
                                                        var valid8 = true;
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          } else {
                                            validate33.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/freeRentDuration/candidates/' +
                                                  i0,
                                                schemaPath:
                                                  '#/$defs/durationField/properties/candidates/items/type',
                                                keyword: 'type',
                                                params: { type: 'object' },
                                                message: 'must be object',
                                              },
                                            ];
                                            return false;
                                          }
                                        }
                                        var valid7 = _errs40 === errors;
                                        if (!valid7) {
                                          break;
                                        }
                                      }
                                    } else {
                                      validate33.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/freeRentDuration/candidates',
                                          schemaPath:
                                            '#/$defs/durationField/properties/candidates/type',
                                          keyword: 'type',
                                          params: { type: 'array' },
                                          message: 'must be array',
                                        },
                                      ];
                                      return false;
                                    }
                                  }
                                  var valid2 = _errs38 === errors;
                                } else {
                                  var valid2 = true;
                                }
                                if (valid2) {
                                  if (data4.scope !== undefined) {
                                    let data17 = data4.scope;
                                    const _errs59 = errors;
                                    if (typeof data17 !== 'string') {
                                      validate33.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/freeRentDuration/scope',
                                          schemaPath:
                                            '#/$defs/durationField/properties/scope/type',
                                          keyword: 'type',
                                          params: { type: 'string' },
                                          message: 'must be string',
                                        },
                                      ];
                                      return false;
                                    }
                                    if (!(
                                      data17 === 'selected_unit' ||
                                      data17 === 'floor_plan' ||
                                      data17 === 'building' ||
                                      data17 === 'listing' ||
                                      data17 === 'unknown'
                                    )) {
                                      validate33.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/freeRentDuration/scope',
                                          schemaPath:
                                            '#/$defs/durationField/properties/scope/enum',
                                          keyword: 'enum',
                                          params: {
                                            allowedValues:
                                              schema49.properties.scope.enum,
                                          },
                                          message:
                                            'must be equal to one of the allowed values',
                                        },
                                      ];
                                      return false;
                                    }
                                    var valid2 = _errs59 === errors;
                                  } else {
                                    var valid2 = true;
                                  }
                                  if (valid2) {
                                    if (data4.evidenceIds !== undefined) {
                                      let data18 = data4.evidenceIds;
                                      const _errs61 = errors;
                                      if (errors === _errs61) {
                                        if (Array.isArray(data18)) {
                                          var valid11 = true;
                                          const len1 = data18.length;
                                          for (let i1 = 0; i1 < len1; i1++) {
                                            const _errs63 = errors;
                                            if (
                                              typeof data18[i1] !== 'string'
                                            ) {
                                              validate33.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/freeRentDuration/evidenceIds/' +
                                                    i1,
                                                  schemaPath:
                                                    '#/$defs/durationField/properties/evidenceIds/items/type',
                                                  keyword: 'type',
                                                  params: { type: 'string' },
                                                  message: 'must be string',
                                                },
                                              ];
                                              return false;
                                            }
                                            var valid11 = _errs63 === errors;
                                            if (!valid11) {
                                              break;
                                            }
                                          }
                                        } else {
                                          validate33.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/freeRentDuration/evidenceIds',
                                              schemaPath:
                                                '#/$defs/durationField/properties/evidenceIds/type',
                                              keyword: 'type',
                                              params: { type: 'array' },
                                              message: 'must be array',
                                            },
                                          ];
                                          return false;
                                        }
                                      }
                                      var valid2 = _errs61 === errors;
                                    } else {
                                      var valid2 = true;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        validate33.errors = [
                          {
                            instancePath: instancePath + '/freeRentDuration',
                            schemaPath: '#/$defs/durationField/type',
                            keyword: 'type',
                            params: { type: 'object' },
                            message: 'must be object',
                          },
                        ];
                        return false;
                      }
                    }
                    var valid0 = _errs9 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.advertisedEffectiveRent !== undefined) {
                      const _errs65 = errors;
                      if (
                        !validate23(data.advertisedEffectiveRent, {
                          instancePath:
                            instancePath + '/advertisedEffectiveRent',
                          parentData: data,
                          parentDataProperty: 'advertisedEffectiveRent',
                          rootData,
                          dynamicAnchors,
                        })
                      ) {
                        vErrors =
                          vErrors === null
                            ? validate23.errors
                            : vErrors.concat(validate23.errors);
                        errors = vErrors.length;
                      }
                      var valid0 = _errs65 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.requiredLeaseTerm !== undefined) {
                        let data21 = data.requiredLeaseTerm;
                        const _errs66 = errors;
                        const _errs67 = errors;
                        if (errors === _errs67) {
                          if (
                            data21 &&
                            typeof data21 == 'object' &&
                            !Array.isArray(data21)
                          ) {
                            let missing4;
                            if (
                              (data21.status === undefined &&
                                (missing4 = 'status')) ||
                              (data21.value === undefined &&
                                (missing4 = 'value')) ||
                              (data21.candidates === undefined &&
                                (missing4 = 'candidates')) ||
                              (data21.scope === undefined &&
                                (missing4 = 'scope')) ||
                              (data21.evidenceIds === undefined &&
                                (missing4 = 'evidenceIds'))
                            ) {
                              validate33.errors = [
                                {
                                  instancePath:
                                    instancePath + '/requiredLeaseTerm',
                                  schemaPath: '#/$defs/durationField/required',
                                  keyword: 'required',
                                  params: { missingProperty: missing4 },
                                  message:
                                    "must have required property '" +
                                    missing4 +
                                    "'",
                                },
                              ];
                              return false;
                            } else {
                              const _errs69 = errors;
                              for (const key4 in data21) {
                                if (!(
                                  key4 === 'status' ||
                                  key4 === 'value' ||
                                  key4 === 'candidates' ||
                                  key4 === 'scope' ||
                                  key4 === 'evidenceIds'
                                )) {
                                  validate33.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/requiredLeaseTerm',
                                      schemaPath:
                                        '#/$defs/durationField/additionalProperties',
                                      keyword: 'additionalProperties',
                                      params: { additionalProperty: key4 },
                                      message:
                                        'must NOT have additional properties',
                                    },
                                  ];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs69 === errors) {
                                if (data21.status !== undefined) {
                                  let data22 = data21.status;
                                  const _errs70 = errors;
                                  if (typeof data22 !== 'string') {
                                    validate33.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          '/requiredLeaseTerm/status',
                                        schemaPath:
                                          '#/$defs/durationField/properties/status/type',
                                        keyword: 'type',
                                        params: { type: 'string' },
                                        message: 'must be string',
                                      },
                                    ];
                                    return false;
                                  }
                                  if (!(
                                    data22 === 'known' ||
                                    data22 === 'unknown' ||
                                    data22 === 'not_applicable' ||
                                    data22 === 'conflict'
                                  )) {
                                    validate33.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          '/requiredLeaseTerm/status',
                                        schemaPath:
                                          '#/$defs/durationField/properties/status/enum',
                                        keyword: 'enum',
                                        params: {
                                          allowedValues:
                                            schema49.properties.status.enum,
                                        },
                                        message:
                                          'must be equal to one of the allowed values',
                                      },
                                    ];
                                    return false;
                                  }
                                  var valid13 = _errs70 === errors;
                                } else {
                                  var valid13 = true;
                                }
                                if (valid13) {
                                  if (data21.value !== undefined) {
                                    let data23 = data21.value;
                                    const _errs72 = errors;
                                    const _errs73 = errors;
                                    let valid14 = false;
                                    const _errs74 = errors;
                                    if (errors === _errs74) {
                                      if (
                                        data23 &&
                                        typeof data23 == 'object' &&
                                        !Array.isArray(data23)
                                      ) {
                                        let missing5;
                                        if (
                                          (data23.kind === undefined &&
                                            (missing5 = 'kind')) ||
                                          (data23.min === undefined &&
                                            (missing5 = 'min')) ||
                                          (data23.max === undefined &&
                                            (missing5 = 'max')) ||
                                          (data23.unit === undefined &&
                                            (missing5 = 'unit'))
                                        ) {
                                          const err21 = {
                                            instancePath:
                                              instancePath +
                                              '/requiredLeaseTerm/value',
                                            schemaPath:
                                              '#/$defs/durationField/properties/value/anyOf/0/required',
                                            keyword: 'required',
                                            params: {
                                              missingProperty: missing5,
                                            },
                                            message:
                                              "must have required property '" +
                                              missing5 +
                                              "'",
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err21];
                                          } else {
                                            vErrors.push(err21);
                                          }
                                          errors++;
                                        } else {
                                          const _errs76 = errors;
                                          for (const key5 in data23) {
                                            if (!(
                                              key5 === 'kind' ||
                                              key5 === 'min' ||
                                              key5 === 'max' ||
                                              key5 === 'unit'
                                            )) {
                                              const err22 = {
                                                instancePath:
                                                  instancePath +
                                                  '/requiredLeaseTerm/value',
                                                schemaPath:
                                                  '#/$defs/durationField/properties/value/anyOf/0/additionalProperties',
                                                keyword: 'additionalProperties',
                                                params: {
                                                  additionalProperty: key5,
                                                },
                                                message:
                                                  'must NOT have additional properties',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err22];
                                              } else {
                                                vErrors.push(err22);
                                              }
                                              errors++;
                                              break;
                                            }
                                          }
                                          if (_errs76 === errors) {
                                            if (data23.kind !== undefined) {
                                              let data24 = data23.kind;
                                              const _errs77 = errors;
                                              if (typeof data24 !== 'string') {
                                                const err23 = {
                                                  instancePath:
                                                    instancePath +
                                                    '/requiredLeaseTerm/value/kind',
                                                  schemaPath:
                                                    '#/$defs/durationField/properties/value/anyOf/0/properties/kind/type',
                                                  keyword: 'type',
                                                  params: { type: 'string' },
                                                  message: 'must be string',
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err23];
                                                } else {
                                                  vErrors.push(err23);
                                                }
                                                errors++;
                                              }
                                              if (!(
                                                data24 === 'exact' ||
                                                data24 === 'range'
                                              )) {
                                                const err24 = {
                                                  instancePath:
                                                    instancePath +
                                                    '/requiredLeaseTerm/value/kind',
                                                  schemaPath:
                                                    '#/$defs/durationField/properties/value/anyOf/0/properties/kind/enum',
                                                  keyword: 'enum',
                                                  params: {
                                                    allowedValues:
                                                      schema49.properties.value
                                                        .anyOf[0].properties
                                                        .kind.enum,
                                                  },
                                                  message:
                                                    'must be equal to one of the allowed values',
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err24];
                                                } else {
                                                  vErrors.push(err24);
                                                }
                                                errors++;
                                              }
                                              var valid15 = _errs77 === errors;
                                            } else {
                                              var valid15 = true;
                                            }
                                            if (valid15) {
                                              if (data23.min !== undefined) {
                                                let data25 = data23.min;
                                                const _errs79 = errors;
                                                const _errs80 = errors;
                                                let valid16 = false;
                                                const _errs81 = errors;
                                                if (
                                                  !(typeof data25 == 'number')
                                                ) {
                                                  const err25 = {
                                                    instancePath:
                                                      instancePath +
                                                      '/requiredLeaseTerm/value/min',
                                                    schemaPath:
                                                      '#/$defs/durationField/properties/value/anyOf/0/properties/min/anyOf/0/type',
                                                    keyword: 'type',
                                                    params: { type: 'number' },
                                                    message: 'must be number',
                                                  };
                                                  if (vErrors === null) {
                                                    vErrors = [err25];
                                                  } else {
                                                    vErrors.push(err25);
                                                  }
                                                  errors++;
                                                }
                                                var _valid6 =
                                                  _errs81 === errors;
                                                valid16 = valid16 || _valid6;
                                                const _errs83 = errors;
                                                if (data25 !== null) {
                                                  const err26 = {
                                                    instancePath:
                                                      instancePath +
                                                      '/requiredLeaseTerm/value/min',
                                                    schemaPath:
                                                      '#/$defs/durationField/properties/value/anyOf/0/properties/min/anyOf/1/type',
                                                    keyword: 'type',
                                                    params: { type: 'null' },
                                                    message: 'must be null',
                                                  };
                                                  if (vErrors === null) {
                                                    vErrors = [err26];
                                                  } else {
                                                    vErrors.push(err26);
                                                  }
                                                  errors++;
                                                }
                                                var _valid6 =
                                                  _errs83 === errors;
                                                valid16 = valid16 || _valid6;
                                                if (!valid16) {
                                                  const err27 = {
                                                    instancePath:
                                                      instancePath +
                                                      '/requiredLeaseTerm/value/min',
                                                    schemaPath:
                                                      '#/$defs/durationField/properties/value/anyOf/0/properties/min/anyOf',
                                                    keyword: 'anyOf',
                                                    params: {},
                                                    message:
                                                      'must match a schema in anyOf',
                                                  };
                                                  if (vErrors === null) {
                                                    vErrors = [err27];
                                                  } else {
                                                    vErrors.push(err27);
                                                  }
                                                  errors++;
                                                } else {
                                                  errors = _errs80;
                                                  if (vErrors !== null) {
                                                    if (_errs80) {
                                                      vErrors.length = _errs80;
                                                    } else {
                                                      vErrors = null;
                                                    }
                                                  }
                                                }
                                                var valid15 =
                                                  _errs79 === errors;
                                              } else {
                                                var valid15 = true;
                                              }
                                              if (valid15) {
                                                if (data23.max !== undefined) {
                                                  let data26 = data23.max;
                                                  const _errs85 = errors;
                                                  const _errs86 = errors;
                                                  let valid17 = false;
                                                  const _errs87 = errors;
                                                  if (
                                                    !(typeof data26 == 'number')
                                                  ) {
                                                    const err28 = {
                                                      instancePath:
                                                        instancePath +
                                                        '/requiredLeaseTerm/value/max',
                                                      schemaPath:
                                                        '#/$defs/durationField/properties/value/anyOf/0/properties/max/anyOf/0/type',
                                                      keyword: 'type',
                                                      params: {
                                                        type: 'number',
                                                      },
                                                      message: 'must be number',
                                                    };
                                                    if (vErrors === null) {
                                                      vErrors = [err28];
                                                    } else {
                                                      vErrors.push(err28);
                                                    }
                                                    errors++;
                                                  }
                                                  var _valid7 =
                                                    _errs87 === errors;
                                                  valid17 = valid17 || _valid7;
                                                  const _errs89 = errors;
                                                  if (data26 !== null) {
                                                    const err29 = {
                                                      instancePath:
                                                        instancePath +
                                                        '/requiredLeaseTerm/value/max',
                                                      schemaPath:
                                                        '#/$defs/durationField/properties/value/anyOf/0/properties/max/anyOf/1/type',
                                                      keyword: 'type',
                                                      params: { type: 'null' },
                                                      message: 'must be null',
                                                    };
                                                    if (vErrors === null) {
                                                      vErrors = [err29];
                                                    } else {
                                                      vErrors.push(err29);
                                                    }
                                                    errors++;
                                                  }
                                                  var _valid7 =
                                                    _errs89 === errors;
                                                  valid17 = valid17 || _valid7;
                                                  if (!valid17) {
                                                    const err30 = {
                                                      instancePath:
                                                        instancePath +
                                                        '/requiredLeaseTerm/value/max',
                                                      schemaPath:
                                                        '#/$defs/durationField/properties/value/anyOf/0/properties/max/anyOf',
                                                      keyword: 'anyOf',
                                                      params: {},
                                                      message:
                                                        'must match a schema in anyOf',
                                                    };
                                                    if (vErrors === null) {
                                                      vErrors = [err30];
                                                    } else {
                                                      vErrors.push(err30);
                                                    }
                                                    errors++;
                                                  } else {
                                                    errors = _errs86;
                                                    if (vErrors !== null) {
                                                      if (_errs86) {
                                                        vErrors.length =
                                                          _errs86;
                                                      } else {
                                                        vErrors = null;
                                                      }
                                                    }
                                                  }
                                                  var valid15 =
                                                    _errs85 === errors;
                                                } else {
                                                  var valid15 = true;
                                                }
                                                if (valid15) {
                                                  if (
                                                    data23.unit !== undefined
                                                  ) {
                                                    let data27 = data23.unit;
                                                    const _errs91 = errors;
                                                    if (
                                                      typeof data27 !== 'string'
                                                    ) {
                                                      const err31 = {
                                                        instancePath:
                                                          instancePath +
                                                          '/requiredLeaseTerm/value/unit',
                                                        schemaPath:
                                                          '#/$defs/durationField/properties/value/anyOf/0/properties/unit/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'string',
                                                        },
                                                        message:
                                                          'must be string',
                                                      };
                                                      if (vErrors === null) {
                                                        vErrors = [err31];
                                                      } else {
                                                        vErrors.push(err31);
                                                      }
                                                      errors++;
                                                    }
                                                    if (!(
                                                      data27 === 'months' ||
                                                      data27 === 'weeks' ||
                                                      data27 === 'days'
                                                    )) {
                                                      const err32 = {
                                                        instancePath:
                                                          instancePath +
                                                          '/requiredLeaseTerm/value/unit',
                                                        schemaPath:
                                                          '#/$defs/durationField/properties/value/anyOf/0/properties/unit/enum',
                                                        keyword: 'enum',
                                                        params: {
                                                          allowedValues:
                                                            schema49.properties
                                                              .value.anyOf[0]
                                                              .properties.unit
                                                              .enum,
                                                        },
                                                        message:
                                                          'must be equal to one of the allowed values',
                                                      };
                                                      if (vErrors === null) {
                                                        vErrors = [err32];
                                                      } else {
                                                        vErrors.push(err32);
                                                      }
                                                      errors++;
                                                    }
                                                    var valid15 =
                                                      _errs91 === errors;
                                                  } else {
                                                    var valid15 = true;
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      } else {
                                        const err33 = {
                                          instancePath:
                                            instancePath +
                                            '/requiredLeaseTerm/value',
                                          schemaPath:
                                            '#/$defs/durationField/properties/value/anyOf/0/type',
                                          keyword: 'type',
                                          params: { type: 'object' },
                                          message: 'must be object',
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err33];
                                        } else {
                                          vErrors.push(err33);
                                        }
                                        errors++;
                                      }
                                    }
                                    var _valid5 = _errs74 === errors;
                                    valid14 = valid14 || _valid5;
                                    const _errs93 = errors;
                                    if (data23 !== null) {
                                      const err34 = {
                                        instancePath:
                                          instancePath +
                                          '/requiredLeaseTerm/value',
                                        schemaPath:
                                          '#/$defs/durationField/properties/value/anyOf/1/type',
                                        keyword: 'type',
                                        params: { type: 'null' },
                                        message: 'must be null',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err34];
                                      } else {
                                        vErrors.push(err34);
                                      }
                                      errors++;
                                    }
                                    var _valid5 = _errs93 === errors;
                                    valid14 = valid14 || _valid5;
                                    if (!valid14) {
                                      const err35 = {
                                        instancePath:
                                          instancePath +
                                          '/requiredLeaseTerm/value',
                                        schemaPath:
                                          '#/$defs/durationField/properties/value/anyOf',
                                        keyword: 'anyOf',
                                        params: {},
                                        message: 'must match a schema in anyOf',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err35];
                                      } else {
                                        vErrors.push(err35);
                                      }
                                      errors++;
                                      validate33.errors = vErrors;
                                      return false;
                                    } else {
                                      errors = _errs73;
                                      if (vErrors !== null) {
                                        if (_errs73) {
                                          vErrors.length = _errs73;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid13 = _errs72 === errors;
                                  } else {
                                    var valid13 = true;
                                  }
                                  if (valid13) {
                                    if (data21.candidates !== undefined) {
                                      let data28 = data21.candidates;
                                      const _errs95 = errors;
                                      if (errors === _errs95) {
                                        if (Array.isArray(data28)) {
                                          var valid18 = true;
                                          const len2 = data28.length;
                                          for (let i2 = 0; i2 < len2; i2++) {
                                            let data29 = data28[i2];
                                            const _errs97 = errors;
                                            if (errors === _errs97) {
                                              if (
                                                data29 &&
                                                typeof data29 == 'object' &&
                                                !Array.isArray(data29)
                                              ) {
                                                let missing6;
                                                if (
                                                  (data29.kind === undefined &&
                                                    (missing6 = 'kind')) ||
                                                  (data29.min === undefined &&
                                                    (missing6 = 'min')) ||
                                                  (data29.max === undefined &&
                                                    (missing6 = 'max')) ||
                                                  (data29.unit === undefined &&
                                                    (missing6 = 'unit'))
                                                ) {
                                                  validate33.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/requiredLeaseTerm/candidates/' +
                                                        i2,
                                                      schemaPath:
                                                        '#/$defs/durationField/properties/candidates/items/required',
                                                      keyword: 'required',
                                                      params: {
                                                        missingProperty:
                                                          missing6,
                                                      },
                                                      message:
                                                        "must have required property '" +
                                                        missing6 +
                                                        "'",
                                                    },
                                                  ];
                                                  return false;
                                                } else {
                                                  const _errs99 = errors;
                                                  for (const key6 in data29) {
                                                    if (!(
                                                      key6 === 'kind' ||
                                                      key6 === 'min' ||
                                                      key6 === 'max' ||
                                                      key6 === 'unit'
                                                    )) {
                                                      validate33.errors = [
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/requiredLeaseTerm/candidates/' +
                                                            i2,
                                                          schemaPath:
                                                            '#/$defs/durationField/properties/candidates/items/additionalProperties',
                                                          keyword:
                                                            'additionalProperties',
                                                          params: {
                                                            additionalProperty:
                                                              key6,
                                                          },
                                                          message:
                                                            'must NOT have additional properties',
                                                        },
                                                      ];
                                                      return false;
                                                      break;
                                                    }
                                                  }
                                                  if (_errs99 === errors) {
                                                    if (
                                                      data29.kind !== undefined
                                                    ) {
                                                      let data30 = data29.kind;
                                                      const _errs100 = errors;
                                                      if (
                                                        typeof data30 !==
                                                        'string'
                                                      ) {
                                                        validate33.errors = [
                                                          {
                                                            instancePath:
                                                              instancePath +
                                                              '/requiredLeaseTerm/candidates/' +
                                                              i2 +
                                                              '/kind',
                                                            schemaPath:
                                                              '#/$defs/durationField/properties/candidates/items/properties/kind/type',
                                                            keyword: 'type',
                                                            params: {
                                                              type: 'string',
                                                            },
                                                            message:
                                                              'must be string',
                                                          },
                                                        ];
                                                        return false;
                                                      }
                                                      if (!(
                                                        data30 === 'exact' ||
                                                        data30 === 'range'
                                                      )) {
                                                        validate33.errors = [
                                                          {
                                                            instancePath:
                                                              instancePath +
                                                              '/requiredLeaseTerm/candidates/' +
                                                              i2 +
                                                              '/kind',
                                                            schemaPath:
                                                              '#/$defs/durationField/properties/candidates/items/properties/kind/enum',
                                                            keyword: 'enum',
                                                            params: {
                                                              allowedValues:
                                                                schema49
                                                                  .properties
                                                                  .candidates
                                                                  .items
                                                                  .properties
                                                                  .kind.enum,
                                                            },
                                                            message:
                                                              'must be equal to one of the allowed values',
                                                          },
                                                        ];
                                                        return false;
                                                      }
                                                      var valid19 =
                                                        _errs100 === errors;
                                                    } else {
                                                      var valid19 = true;
                                                    }
                                                    if (valid19) {
                                                      if (
                                                        data29.min !== undefined
                                                      ) {
                                                        let data31 = data29.min;
                                                        const _errs102 = errors;
                                                        const _errs103 = errors;
                                                        let valid20 = false;
                                                        const _errs104 = errors;
                                                        if (
                                                          !(
                                                            typeof data31 ==
                                                            'number'
                                                          )
                                                        ) {
                                                          const err36 = {
                                                            instancePath:
                                                              instancePath +
                                                              '/requiredLeaseTerm/candidates/' +
                                                              i2 +
                                                              '/min',
                                                            schemaPath:
                                                              '#/$defs/durationField/properties/candidates/items/properties/min/anyOf/0/type',
                                                            keyword: 'type',
                                                            params: {
                                                              type: 'number',
                                                            },
                                                            message:
                                                              'must be number',
                                                          };
                                                          if (
                                                            vErrors === null
                                                          ) {
                                                            vErrors = [err36];
                                                          } else {
                                                            vErrors.push(err36);
                                                          }
                                                          errors++;
                                                        }
                                                        var _valid8 =
                                                          _errs104 === errors;
                                                        valid20 =
                                                          valid20 || _valid8;
                                                        const _errs106 = errors;
                                                        if (data31 !== null) {
                                                          const err37 = {
                                                            instancePath:
                                                              instancePath +
                                                              '/requiredLeaseTerm/candidates/' +
                                                              i2 +
                                                              '/min',
                                                            schemaPath:
                                                              '#/$defs/durationField/properties/candidates/items/properties/min/anyOf/1/type',
                                                            keyword: 'type',
                                                            params: {
                                                              type: 'null',
                                                            },
                                                            message:
                                                              'must be null',
                                                          };
                                                          if (
                                                            vErrors === null
                                                          ) {
                                                            vErrors = [err37];
                                                          } else {
                                                            vErrors.push(err37);
                                                          }
                                                          errors++;
                                                        }
                                                        var _valid8 =
                                                          _errs106 === errors;
                                                        valid20 =
                                                          valid20 || _valid8;
                                                        if (!valid20) {
                                                          const err38 = {
                                                            instancePath:
                                                              instancePath +
                                                              '/requiredLeaseTerm/candidates/' +
                                                              i2 +
                                                              '/min',
                                                            schemaPath:
                                                              '#/$defs/durationField/properties/candidates/items/properties/min/anyOf',
                                                            keyword: 'anyOf',
                                                            params: {},
                                                            message:
                                                              'must match a schema in anyOf',
                                                          };
                                                          if (
                                                            vErrors === null
                                                          ) {
                                                            vErrors = [err38];
                                                          } else {
                                                            vErrors.push(err38);
                                                          }
                                                          errors++;
                                                          validate33.errors =
                                                            vErrors;
                                                          return false;
                                                        } else {
                                                          errors = _errs103;
                                                          if (
                                                            vErrors !== null
                                                          ) {
                                                            if (_errs103) {
                                                              vErrors.length =
                                                                _errs103;
                                                            } else {
                                                              vErrors = null;
                                                            }
                                                          }
                                                        }
                                                        var valid19 =
                                                          _errs102 === errors;
                                                      } else {
                                                        var valid19 = true;
                                                      }
                                                      if (valid19) {
                                                        if (
                                                          data29.max !==
                                                          undefined
                                                        ) {
                                                          let data32 =
                                                            data29.max;
                                                          const _errs108 =
                                                            errors;
                                                          const _errs109 =
                                                            errors;
                                                          let valid21 = false;
                                                          const _errs110 =
                                                            errors;
                                                          if (
                                                            !(
                                                              typeof data32 ==
                                                              'number'
                                                            )
                                                          ) {
                                                            const err39 = {
                                                              instancePath:
                                                                instancePath +
                                                                '/requiredLeaseTerm/candidates/' +
                                                                i2 +
                                                                '/max',
                                                              schemaPath:
                                                                '#/$defs/durationField/properties/candidates/items/properties/max/anyOf/0/type',
                                                              keyword: 'type',
                                                              params: {
                                                                type: 'number',
                                                              },
                                                              message:
                                                                'must be number',
                                                            };
                                                            if (
                                                              vErrors === null
                                                            ) {
                                                              vErrors = [err39];
                                                            } else {
                                                              vErrors.push(
                                                                err39,
                                                              );
                                                            }
                                                            errors++;
                                                          }
                                                          var _valid9 =
                                                            _errs110 === errors;
                                                          valid21 =
                                                            valid21 || _valid9;
                                                          const _errs112 =
                                                            errors;
                                                          if (data32 !== null) {
                                                            const err40 = {
                                                              instancePath:
                                                                instancePath +
                                                                '/requiredLeaseTerm/candidates/' +
                                                                i2 +
                                                                '/max',
                                                              schemaPath:
                                                                '#/$defs/durationField/properties/candidates/items/properties/max/anyOf/1/type',
                                                              keyword: 'type',
                                                              params: {
                                                                type: 'null',
                                                              },
                                                              message:
                                                                'must be null',
                                                            };
                                                            if (
                                                              vErrors === null
                                                            ) {
                                                              vErrors = [err40];
                                                            } else {
                                                              vErrors.push(
                                                                err40,
                                                              );
                                                            }
                                                            errors++;
                                                          }
                                                          var _valid9 =
                                                            _errs112 === errors;
                                                          valid21 =
                                                            valid21 || _valid9;
                                                          if (!valid21) {
                                                            const err41 = {
                                                              instancePath:
                                                                instancePath +
                                                                '/requiredLeaseTerm/candidates/' +
                                                                i2 +
                                                                '/max',
                                                              schemaPath:
                                                                '#/$defs/durationField/properties/candidates/items/properties/max/anyOf',
                                                              keyword: 'anyOf',
                                                              params: {},
                                                              message:
                                                                'must match a schema in anyOf',
                                                            };
                                                            if (
                                                              vErrors === null
                                                            ) {
                                                              vErrors = [err41];
                                                            } else {
                                                              vErrors.push(
                                                                err41,
                                                              );
                                                            }
                                                            errors++;
                                                            validate33.errors =
                                                              vErrors;
                                                            return false;
                                                          } else {
                                                            errors = _errs109;
                                                            if (
                                                              vErrors !== null
                                                            ) {
                                                              if (_errs109) {
                                                                vErrors.length =
                                                                  _errs109;
                                                              } else {
                                                                vErrors = null;
                                                              }
                                                            }
                                                          }
                                                          var valid19 =
                                                            _errs108 === errors;
                                                        } else {
                                                          var valid19 = true;
                                                        }
                                                        if (valid19) {
                                                          if (
                                                            data29.unit !==
                                                            undefined
                                                          ) {
                                                            let data33 =
                                                              data29.unit;
                                                            const _errs114 =
                                                              errors;
                                                            if (
                                                              typeof data33 !==
                                                              'string'
                                                            ) {
                                                              validate33.errors =
                                                                [
                                                                  {
                                                                    instancePath:
                                                                      instancePath +
                                                                      '/requiredLeaseTerm/candidates/' +
                                                                      i2 +
                                                                      '/unit',
                                                                    schemaPath:
                                                                      '#/$defs/durationField/properties/candidates/items/properties/unit/type',
                                                                    keyword:
                                                                      'type',
                                                                    params: {
                                                                      type: 'string',
                                                                    },
                                                                    message:
                                                                      'must be string',
                                                                  },
                                                                ];
                                                              return false;
                                                            }
                                                            if (!(
                                                              data33 ===
                                                                'months' ||
                                                              data33 ===
                                                                'weeks' ||
                                                              data33 === 'days'
                                                            )) {
                                                              validate33.errors =
                                                                [
                                                                  {
                                                                    instancePath:
                                                                      instancePath +
                                                                      '/requiredLeaseTerm/candidates/' +
                                                                      i2 +
                                                                      '/unit',
                                                                    schemaPath:
                                                                      '#/$defs/durationField/properties/candidates/items/properties/unit/enum',
                                                                    keyword:
                                                                      'enum',
                                                                    params: {
                                                                      allowedValues:
                                                                        schema49
                                                                          .properties
                                                                          .candidates
                                                                          .items
                                                                          .properties
                                                                          .unit
                                                                          .enum,
                                                                    },
                                                                    message:
                                                                      'must be equal to one of the allowed values',
                                                                  },
                                                                ];
                                                              return false;
                                                            }
                                                            var valid19 =
                                                              _errs114 ===
                                                              errors;
                                                          } else {
                                                            var valid19 = true;
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              } else {
                                                validate33.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      '/requiredLeaseTerm/candidates/' +
                                                      i2,
                                                    schemaPath:
                                                      '#/$defs/durationField/properties/candidates/items/type',
                                                    keyword: 'type',
                                                    params: { type: 'object' },
                                                    message: 'must be object',
                                                  },
                                                ];
                                                return false;
                                              }
                                            }
                                            var valid18 = _errs97 === errors;
                                            if (!valid18) {
                                              break;
                                            }
                                          }
                                        } else {
                                          validate33.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/requiredLeaseTerm/candidates',
                                              schemaPath:
                                                '#/$defs/durationField/properties/candidates/type',
                                              keyword: 'type',
                                              params: { type: 'array' },
                                              message: 'must be array',
                                            },
                                          ];
                                          return false;
                                        }
                                      }
                                      var valid13 = _errs95 === errors;
                                    } else {
                                      var valid13 = true;
                                    }
                                    if (valid13) {
                                      if (data21.scope !== undefined) {
                                        let data34 = data21.scope;
                                        const _errs116 = errors;
                                        if (typeof data34 !== 'string') {
                                          validate33.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/requiredLeaseTerm/scope',
                                              schemaPath:
                                                '#/$defs/durationField/properties/scope/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            },
                                          ];
                                          return false;
                                        }
                                        if (!(
                                          data34 === 'selected_unit' ||
                                          data34 === 'floor_plan' ||
                                          data34 === 'building' ||
                                          data34 === 'listing' ||
                                          data34 === 'unknown'
                                        )) {
                                          validate33.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/requiredLeaseTerm/scope',
                                              schemaPath:
                                                '#/$defs/durationField/properties/scope/enum',
                                              keyword: 'enum',
                                              params: {
                                                allowedValues:
                                                  schema49.properties.scope
                                                    .enum,
                                              },
                                              message:
                                                'must be equal to one of the allowed values',
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid13 = _errs116 === errors;
                                      } else {
                                        var valid13 = true;
                                      }
                                      if (valid13) {
                                        if (data21.evidenceIds !== undefined) {
                                          let data35 = data21.evidenceIds;
                                          const _errs118 = errors;
                                          if (errors === _errs118) {
                                            if (Array.isArray(data35)) {
                                              var valid22 = true;
                                              const len3 = data35.length;
                                              for (
                                                let i3 = 0;
                                                i3 < len3;
                                                i3++
                                              ) {
                                                const _errs120 = errors;
                                                if (
                                                  typeof data35[i3] !== 'string'
                                                ) {
                                                  validate33.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/requiredLeaseTerm/evidenceIds/' +
                                                        i3,
                                                      schemaPath:
                                                        '#/$defs/durationField/properties/evidenceIds/items/type',
                                                      keyword: 'type',
                                                      params: {
                                                        type: 'string',
                                                      },
                                                      message: 'must be string',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                                var valid22 =
                                                  _errs120 === errors;
                                                if (!valid22) {
                                                  break;
                                                }
                                              }
                                            } else {
                                              validate33.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/requiredLeaseTerm/evidenceIds',
                                                  schemaPath:
                                                    '#/$defs/durationField/properties/evidenceIds/type',
                                                  keyword: 'type',
                                                  params: { type: 'array' },
                                                  message: 'must be array',
                                                },
                                              ];
                                              return false;
                                            }
                                          }
                                          var valid13 = _errs118 === errors;
                                        } else {
                                          var valid13 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate33.errors = [
                              {
                                instancePath:
                                  instancePath + '/requiredLeaseTerm',
                                schemaPath: '#/$defs/durationField/type',
                                keyword: 'type',
                                params: { type: 'object' },
                                message: 'must be object',
                              },
                            ];
                            return false;
                          }
                        }
                        var valid0 = _errs66 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.applyBy !== undefined) {
                          let data37 = data.applyBy;
                          const _errs122 = errors;
                          const _errs123 = errors;
                          if (errors === _errs123) {
                            if (
                              data37 &&
                              typeof data37 == 'object' &&
                              !Array.isArray(data37)
                            ) {
                              let missing7;
                              if (
                                (data37.status === undefined &&
                                  (missing7 = 'status')) ||
                                (data37.value === undefined &&
                                  (missing7 = 'value')) ||
                                (data37.candidates === undefined &&
                                  (missing7 = 'candidates')) ||
                                (data37.scope === undefined &&
                                  (missing7 = 'scope')) ||
                                (data37.evidenceIds === undefined &&
                                  (missing7 = 'evidenceIds'))
                              ) {
                                validate33.errors = [
                                  {
                                    instancePath: instancePath + '/applyBy',
                                    schemaPath: '#/$defs/dateField/required',
                                    keyword: 'required',
                                    params: { missingProperty: missing7 },
                                    message:
                                      "must have required property '" +
                                      missing7 +
                                      "'",
                                  },
                                ];
                                return false;
                              } else {
                                const _errs125 = errors;
                                for (const key7 in data37) {
                                  if (!(
                                    key7 === 'status' ||
                                    key7 === 'value' ||
                                    key7 === 'candidates' ||
                                    key7 === 'scope' ||
                                    key7 === 'evidenceIds'
                                  )) {
                                    validate33.errors = [
                                      {
                                        instancePath: instancePath + '/applyBy',
                                        schemaPath:
                                          '#/$defs/dateField/additionalProperties',
                                        keyword: 'additionalProperties',
                                        params: { additionalProperty: key7 },
                                        message:
                                          'must NOT have additional properties',
                                      },
                                    ];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs125 === errors) {
                                  if (data37.status !== undefined) {
                                    let data38 = data37.status;
                                    const _errs126 = errors;
                                    if (typeof data38 !== 'string') {
                                      validate33.errors = [
                                        {
                                          instancePath:
                                            instancePath + '/applyBy/status',
                                          schemaPath:
                                            '#/$defs/dateField/properties/status/type',
                                          keyword: 'type',
                                          params: { type: 'string' },
                                          message: 'must be string',
                                        },
                                      ];
                                      return false;
                                    }
                                    if (!(
                                      data38 === 'known' ||
                                      data38 === 'unknown' ||
                                      data38 === 'not_applicable' ||
                                      data38 === 'conflict'
                                    )) {
                                      validate33.errors = [
                                        {
                                          instancePath:
                                            instancePath + '/applyBy/status',
                                          schemaPath:
                                            '#/$defs/dateField/properties/status/enum',
                                          keyword: 'enum',
                                          params: {
                                            allowedValues:
                                              schema50.properties.status.enum,
                                          },
                                          message:
                                            'must be equal to one of the allowed values',
                                        },
                                      ];
                                      return false;
                                    }
                                    var valid24 = _errs126 === errors;
                                  } else {
                                    var valid24 = true;
                                  }
                                  if (valid24) {
                                    if (data37.value !== undefined) {
                                      let data39 = data37.value;
                                      const _errs128 = errors;
                                      const _errs129 = errors;
                                      let valid25 = false;
                                      const _errs130 = errors;
                                      if (typeof data39 !== 'string') {
                                        const err42 = {
                                          instancePath:
                                            instancePath + '/applyBy/value',
                                          schemaPath:
                                            '#/$defs/dateField/properties/value/anyOf/0/type',
                                          keyword: 'type',
                                          params: { type: 'string' },
                                          message: 'must be string',
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err42];
                                        } else {
                                          vErrors.push(err42);
                                        }
                                        errors++;
                                      }
                                      var _valid10 = _errs130 === errors;
                                      valid25 = valid25 || _valid10;
                                      const _errs132 = errors;
                                      if (data39 !== null) {
                                        const err43 = {
                                          instancePath:
                                            instancePath + '/applyBy/value',
                                          schemaPath:
                                            '#/$defs/dateField/properties/value/anyOf/1/type',
                                          keyword: 'type',
                                          params: { type: 'null' },
                                          message: 'must be null',
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err43];
                                        } else {
                                          vErrors.push(err43);
                                        }
                                        errors++;
                                      }
                                      var _valid10 = _errs132 === errors;
                                      valid25 = valid25 || _valid10;
                                      if (!valid25) {
                                        const err44 = {
                                          instancePath:
                                            instancePath + '/applyBy/value',
                                          schemaPath:
                                            '#/$defs/dateField/properties/value/anyOf',
                                          keyword: 'anyOf',
                                          params: {},
                                          message:
                                            'must match a schema in anyOf',
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err44];
                                        } else {
                                          vErrors.push(err44);
                                        }
                                        errors++;
                                        validate33.errors = vErrors;
                                        return false;
                                      } else {
                                        errors = _errs129;
                                        if (vErrors !== null) {
                                          if (_errs129) {
                                            vErrors.length = _errs129;
                                          } else {
                                            vErrors = null;
                                          }
                                        }
                                      }
                                      var valid24 = _errs128 === errors;
                                    } else {
                                      var valid24 = true;
                                    }
                                    if (valid24) {
                                      if (data37.candidates !== undefined) {
                                        let data40 = data37.candidates;
                                        const _errs134 = errors;
                                        if (errors === _errs134) {
                                          if (Array.isArray(data40)) {
                                            var valid26 = true;
                                            const len4 = data40.length;
                                            for (let i4 = 0; i4 < len4; i4++) {
                                              const _errs136 = errors;
                                              if (
                                                typeof data40[i4] !== 'string'
                                              ) {
                                                validate33.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      '/applyBy/candidates/' +
                                                      i4,
                                                    schemaPath:
                                                      '#/$defs/dateField/properties/candidates/items/type',
                                                    keyword: 'type',
                                                    params: { type: 'string' },
                                                    message: 'must be string',
                                                  },
                                                ];
                                                return false;
                                              }
                                              var valid26 = _errs136 === errors;
                                              if (!valid26) {
                                                break;
                                              }
                                            }
                                          } else {
                                            validate33.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/applyBy/candidates',
                                                schemaPath:
                                                  '#/$defs/dateField/properties/candidates/type',
                                                keyword: 'type',
                                                params: { type: 'array' },
                                                message: 'must be array',
                                              },
                                            ];
                                            return false;
                                          }
                                        }
                                        var valid24 = _errs134 === errors;
                                      } else {
                                        var valid24 = true;
                                      }
                                      if (valid24) {
                                        if (data37.scope !== undefined) {
                                          let data42 = data37.scope;
                                          const _errs138 = errors;
                                          if (typeof data42 !== 'string') {
                                            validate33.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/applyBy/scope',
                                                schemaPath:
                                                  '#/$defs/dateField/properties/scope/type',
                                                keyword: 'type',
                                                params: { type: 'string' },
                                                message: 'must be string',
                                              },
                                            ];
                                            return false;
                                          }
                                          if (!(
                                            data42 === 'selected_unit' ||
                                            data42 === 'floor_plan' ||
                                            data42 === 'building' ||
                                            data42 === 'listing' ||
                                            data42 === 'unknown'
                                          )) {
                                            validate33.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/applyBy/scope',
                                                schemaPath:
                                                  '#/$defs/dateField/properties/scope/enum',
                                                keyword: 'enum',
                                                params: {
                                                  allowedValues:
                                                    schema50.properties.scope
                                                      .enum,
                                                },
                                                message:
                                                  'must be equal to one of the allowed values',
                                              },
                                            ];
                                            return false;
                                          }
                                          var valid24 = _errs138 === errors;
                                        } else {
                                          var valid24 = true;
                                        }
                                        if (valid24) {
                                          if (
                                            data37.evidenceIds !== undefined
                                          ) {
                                            let data43 = data37.evidenceIds;
                                            const _errs140 = errors;
                                            if (errors === _errs140) {
                                              if (Array.isArray(data43)) {
                                                var valid27 = true;
                                                const len5 = data43.length;
                                                for (
                                                  let i5 = 0;
                                                  i5 < len5;
                                                  i5++
                                                ) {
                                                  const _errs142 = errors;
                                                  if (
                                                    typeof data43[i5] !==
                                                    'string'
                                                  ) {
                                                    validate33.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          '/applyBy/evidenceIds/' +
                                                          i5,
                                                        schemaPath:
                                                          '#/$defs/dateField/properties/evidenceIds/items/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'string',
                                                        },
                                                        message:
                                                          'must be string',
                                                      },
                                                    ];
                                                    return false;
                                                  }
                                                  var valid27 =
                                                    _errs142 === errors;
                                                  if (!valid27) {
                                                    break;
                                                  }
                                                }
                                              } else {
                                                validate33.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      '/applyBy/evidenceIds',
                                                    schemaPath:
                                                      '#/$defs/dateField/properties/evidenceIds/type',
                                                    keyword: 'type',
                                                    params: { type: 'array' },
                                                    message: 'must be array',
                                                  },
                                                ];
                                                return false;
                                              }
                                            }
                                            var valid24 = _errs140 === errors;
                                          } else {
                                            var valid24 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              validate33.errors = [
                                {
                                  instancePath: instancePath + '/applyBy',
                                  schemaPath: '#/$defs/dateField/type',
                                  keyword: 'type',
                                  params: { type: 'object' },
                                  message: 'must be object',
                                },
                              ];
                              return false;
                            }
                          }
                          var valid0 = _errs122 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.moveInBy !== undefined) {
                            let data45 = data.moveInBy;
                            const _errs144 = errors;
                            const _errs145 = errors;
                            if (errors === _errs145) {
                              if (
                                data45 &&
                                typeof data45 == 'object' &&
                                !Array.isArray(data45)
                              ) {
                                let missing8;
                                if (
                                  (data45.status === undefined &&
                                    (missing8 = 'status')) ||
                                  (data45.value === undefined &&
                                    (missing8 = 'value')) ||
                                  (data45.candidates === undefined &&
                                    (missing8 = 'candidates')) ||
                                  (data45.scope === undefined &&
                                    (missing8 = 'scope')) ||
                                  (data45.evidenceIds === undefined &&
                                    (missing8 = 'evidenceIds'))
                                ) {
                                  validate33.errors = [
                                    {
                                      instancePath: instancePath + '/moveInBy',
                                      schemaPath: '#/$defs/dateField/required',
                                      keyword: 'required',
                                      params: { missingProperty: missing8 },
                                      message:
                                        "must have required property '" +
                                        missing8 +
                                        "'",
                                    },
                                  ];
                                  return false;
                                } else {
                                  const _errs147 = errors;
                                  for (const key8 in data45) {
                                    if (!(
                                      key8 === 'status' ||
                                      key8 === 'value' ||
                                      key8 === 'candidates' ||
                                      key8 === 'scope' ||
                                      key8 === 'evidenceIds'
                                    )) {
                                      validate33.errors = [
                                        {
                                          instancePath:
                                            instancePath + '/moveInBy',
                                          schemaPath:
                                            '#/$defs/dateField/additionalProperties',
                                          keyword: 'additionalProperties',
                                          params: { additionalProperty: key8 },
                                          message:
                                            'must NOT have additional properties',
                                        },
                                      ];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs147 === errors) {
                                    if (data45.status !== undefined) {
                                      let data46 = data45.status;
                                      const _errs148 = errors;
                                      if (typeof data46 !== 'string') {
                                        validate33.errors = [
                                          {
                                            instancePath:
                                              instancePath + '/moveInBy/status',
                                            schemaPath:
                                              '#/$defs/dateField/properties/status/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          },
                                        ];
                                        return false;
                                      }
                                      if (!(
                                        data46 === 'known' ||
                                        data46 === 'unknown' ||
                                        data46 === 'not_applicable' ||
                                        data46 === 'conflict'
                                      )) {
                                        validate33.errors = [
                                          {
                                            instancePath:
                                              instancePath + '/moveInBy/status',
                                            schemaPath:
                                              '#/$defs/dateField/properties/status/enum',
                                            keyword: 'enum',
                                            params: {
                                              allowedValues:
                                                schema50.properties.status.enum,
                                            },
                                            message:
                                              'must be equal to one of the allowed values',
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid29 = _errs148 === errors;
                                    } else {
                                      var valid29 = true;
                                    }
                                    if (valid29) {
                                      if (data45.value !== undefined) {
                                        let data47 = data45.value;
                                        const _errs150 = errors;
                                        const _errs151 = errors;
                                        let valid30 = false;
                                        const _errs152 = errors;
                                        if (typeof data47 !== 'string') {
                                          const err45 = {
                                            instancePath:
                                              instancePath + '/moveInBy/value',
                                            schemaPath:
                                              '#/$defs/dateField/properties/value/anyOf/0/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err45];
                                          } else {
                                            vErrors.push(err45);
                                          }
                                          errors++;
                                        }
                                        var _valid11 = _errs152 === errors;
                                        valid30 = valid30 || _valid11;
                                        const _errs154 = errors;
                                        if (data47 !== null) {
                                          const err46 = {
                                            instancePath:
                                              instancePath + '/moveInBy/value',
                                            schemaPath:
                                              '#/$defs/dateField/properties/value/anyOf/1/type',
                                            keyword: 'type',
                                            params: { type: 'null' },
                                            message: 'must be null',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err46];
                                          } else {
                                            vErrors.push(err46);
                                          }
                                          errors++;
                                        }
                                        var _valid11 = _errs154 === errors;
                                        valid30 = valid30 || _valid11;
                                        if (!valid30) {
                                          const err47 = {
                                            instancePath:
                                              instancePath + '/moveInBy/value',
                                            schemaPath:
                                              '#/$defs/dateField/properties/value/anyOf',
                                            keyword: 'anyOf',
                                            params: {},
                                            message:
                                              'must match a schema in anyOf',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err47];
                                          } else {
                                            vErrors.push(err47);
                                          }
                                          errors++;
                                          validate33.errors = vErrors;
                                          return false;
                                        } else {
                                          errors = _errs151;
                                          if (vErrors !== null) {
                                            if (_errs151) {
                                              vErrors.length = _errs151;
                                            } else {
                                              vErrors = null;
                                            }
                                          }
                                        }
                                        var valid29 = _errs150 === errors;
                                      } else {
                                        var valid29 = true;
                                      }
                                      if (valid29) {
                                        if (data45.candidates !== undefined) {
                                          let data48 = data45.candidates;
                                          const _errs156 = errors;
                                          if (errors === _errs156) {
                                            if (Array.isArray(data48)) {
                                              var valid31 = true;
                                              const len6 = data48.length;
                                              for (
                                                let i6 = 0;
                                                i6 < len6;
                                                i6++
                                              ) {
                                                const _errs158 = errors;
                                                if (
                                                  typeof data48[i6] !== 'string'
                                                ) {
                                                  validate33.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/moveInBy/candidates/' +
                                                        i6,
                                                      schemaPath:
                                                        '#/$defs/dateField/properties/candidates/items/type',
                                                      keyword: 'type',
                                                      params: {
                                                        type: 'string',
                                                      },
                                                      message: 'must be string',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                                var valid31 =
                                                  _errs158 === errors;
                                                if (!valid31) {
                                                  break;
                                                }
                                              }
                                            } else {
                                              validate33.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/moveInBy/candidates',
                                                  schemaPath:
                                                    '#/$defs/dateField/properties/candidates/type',
                                                  keyword: 'type',
                                                  params: { type: 'array' },
                                                  message: 'must be array',
                                                },
                                              ];
                                              return false;
                                            }
                                          }
                                          var valid29 = _errs156 === errors;
                                        } else {
                                          var valid29 = true;
                                        }
                                        if (valid29) {
                                          if (data45.scope !== undefined) {
                                            let data50 = data45.scope;
                                            const _errs160 = errors;
                                            if (typeof data50 !== 'string') {
                                              validate33.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/moveInBy/scope',
                                                  schemaPath:
                                                    '#/$defs/dateField/properties/scope/type',
                                                  keyword: 'type',
                                                  params: { type: 'string' },
                                                  message: 'must be string',
                                                },
                                              ];
                                              return false;
                                            }
                                            if (!(
                                              data50 === 'selected_unit' ||
                                              data50 === 'floor_plan' ||
                                              data50 === 'building' ||
                                              data50 === 'listing' ||
                                              data50 === 'unknown'
                                            )) {
                                              validate33.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/moveInBy/scope',
                                                  schemaPath:
                                                    '#/$defs/dateField/properties/scope/enum',
                                                  keyword: 'enum',
                                                  params: {
                                                    allowedValues:
                                                      schema50.properties.scope
                                                        .enum,
                                                  },
                                                  message:
                                                    'must be equal to one of the allowed values',
                                                },
                                              ];
                                              return false;
                                            }
                                            var valid29 = _errs160 === errors;
                                          } else {
                                            var valid29 = true;
                                          }
                                          if (valid29) {
                                            if (
                                              data45.evidenceIds !== undefined
                                            ) {
                                              let data51 = data45.evidenceIds;
                                              const _errs162 = errors;
                                              if (errors === _errs162) {
                                                if (Array.isArray(data51)) {
                                                  var valid32 = true;
                                                  const len7 = data51.length;
                                                  for (
                                                    let i7 = 0;
                                                    i7 < len7;
                                                    i7++
                                                  ) {
                                                    const _errs164 = errors;
                                                    if (
                                                      typeof data51[i7] !==
                                                      'string'
                                                    ) {
                                                      validate33.errors = [
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/moveInBy/evidenceIds/' +
                                                            i7,
                                                          schemaPath:
                                                            '#/$defs/dateField/properties/evidenceIds/items/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'string',
                                                          },
                                                          message:
                                                            'must be string',
                                                        },
                                                      ];
                                                      return false;
                                                    }
                                                    var valid32 =
                                                      _errs164 === errors;
                                                    if (!valid32) {
                                                      break;
                                                    }
                                                  }
                                                } else {
                                                  validate33.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/moveInBy/evidenceIds',
                                                      schemaPath:
                                                        '#/$defs/dateField/properties/evidenceIds/type',
                                                      keyword: 'type',
                                                      params: { type: 'array' },
                                                      message: 'must be array',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                              }
                                              var valid29 = _errs162 === errors;
                                            } else {
                                              var valid29 = true;
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate33.errors = [
                                  {
                                    instancePath: instancePath + '/moveInBy',
                                    schemaPath: '#/$defs/dateField/type',
                                    keyword: 'type',
                                    params: { type: 'object' },
                                    message: 'must be object',
                                  },
                                ];
                                return false;
                              }
                            }
                            var valid0 = _errs144 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.applicability !== undefined) {
                              let data53 = data.applicability;
                              const _errs166 = errors;
                              const _errs167 = errors;
                              if (errors === _errs167) {
                                if (
                                  data53 &&
                                  typeof data53 == 'object' &&
                                  !Array.isArray(data53)
                                ) {
                                  let missing9;
                                  if (
                                    (data53.kind === undefined &&
                                      (missing9 = 'kind')) ||
                                    (data53.conditions === undefined &&
                                      (missing9 = 'conditions')) ||
                                    (data53.evidenceIds === undefined &&
                                      (missing9 = 'evidenceIds'))
                                  ) {
                                    validate33.errors = [
                                      {
                                        instancePath:
                                          instancePath + '/applicability',
                                        schemaPath:
                                          '#/$defs/applicability/required',
                                        keyword: 'required',
                                        params: { missingProperty: missing9 },
                                        message:
                                          "must have required property '" +
                                          missing9 +
                                          "'",
                                      },
                                    ];
                                    return false;
                                  } else {
                                    const _errs169 = errors;
                                    for (const key9 in data53) {
                                      if (!(
                                        key9 === 'kind' ||
                                        key9 === 'conditions' ||
                                        key9 === 'evidenceIds'
                                      )) {
                                        validate33.errors = [
                                          {
                                            instancePath:
                                              instancePath + '/applicability',
                                            schemaPath:
                                              '#/$defs/applicability/additionalProperties',
                                            keyword: 'additionalProperties',
                                            params: {
                                              additionalProperty: key9,
                                            },
                                            message:
                                              'must NOT have additional properties',
                                          },
                                        ];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs169 === errors) {
                                      if (data53.kind !== undefined) {
                                        let data54 = data53.kind;
                                        const _errs170 = errors;
                                        if (typeof data54 !== 'string') {
                                          validate33.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/applicability/kind',
                                              schemaPath:
                                                '#/$defs/applicability/properties/kind/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            },
                                          ];
                                          return false;
                                        }
                                        if (!(
                                          data54 === 'required' ||
                                          data54 === 'optional' ||
                                          data54 === 'conditional' ||
                                          data54 === 'unknown'
                                        )) {
                                          validate33.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/applicability/kind',
                                              schemaPath:
                                                '#/$defs/applicability/properties/kind/enum',
                                              keyword: 'enum',
                                              params: {
                                                allowedValues:
                                                  schema45.properties.kind.enum,
                                              },
                                              message:
                                                'must be equal to one of the allowed values',
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid34 = _errs170 === errors;
                                      } else {
                                        var valid34 = true;
                                      }
                                      if (valid34) {
                                        if (data53.conditions !== undefined) {
                                          let data55 = data53.conditions;
                                          const _errs172 = errors;
                                          if (errors === _errs172) {
                                            if (Array.isArray(data55)) {
                                              var valid35 = true;
                                              const len8 = data55.length;
                                              for (
                                                let i8 = 0;
                                                i8 < len8;
                                                i8++
                                              ) {
                                                const _errs174 = errors;
                                                if (
                                                  typeof data55[i8] !== 'string'
                                                ) {
                                                  validate33.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/applicability/conditions/' +
                                                        i8,
                                                      schemaPath:
                                                        '#/$defs/applicability/properties/conditions/items/type',
                                                      keyword: 'type',
                                                      params: {
                                                        type: 'string',
                                                      },
                                                      message: 'must be string',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                                var valid35 =
                                                  _errs174 === errors;
                                                if (!valid35) {
                                                  break;
                                                }
                                              }
                                            } else {
                                              validate33.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/applicability/conditions',
                                                  schemaPath:
                                                    '#/$defs/applicability/properties/conditions/type',
                                                  keyword: 'type',
                                                  params: { type: 'array' },
                                                  message: 'must be array',
                                                },
                                              ];
                                              return false;
                                            }
                                          }
                                          var valid34 = _errs172 === errors;
                                        } else {
                                          var valid34 = true;
                                        }
                                        if (valid34) {
                                          if (
                                            data53.evidenceIds !== undefined
                                          ) {
                                            let data57 = data53.evidenceIds;
                                            const _errs176 = errors;
                                            if (errors === _errs176) {
                                              if (Array.isArray(data57)) {
                                                var valid36 = true;
                                                const len9 = data57.length;
                                                for (
                                                  let i9 = 0;
                                                  i9 < len9;
                                                  i9++
                                                ) {
                                                  const _errs178 = errors;
                                                  if (
                                                    typeof data57[i9] !==
                                                    'string'
                                                  ) {
                                                    validate33.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          '/applicability/evidenceIds/' +
                                                          i9,
                                                        schemaPath:
                                                          '#/$defs/applicability/properties/evidenceIds/items/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'string',
                                                        },
                                                        message:
                                                          'must be string',
                                                      },
                                                    ];
                                                    return false;
                                                  }
                                                  var valid36 =
                                                    _errs178 === errors;
                                                  if (!valid36) {
                                                    break;
                                                  }
                                                }
                                              } else {
                                                validate33.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      '/applicability/evidenceIds',
                                                    schemaPath:
                                                      '#/$defs/applicability/properties/evidenceIds/type',
                                                    keyword: 'type',
                                                    params: { type: 'array' },
                                                    message: 'must be array',
                                                  },
                                                ];
                                                return false;
                                              }
                                            }
                                            var valid34 = _errs176 === errors;
                                          } else {
                                            var valid34 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate33.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/applicability',
                                      schemaPath: '#/$defs/applicability/type',
                                      keyword: 'type',
                                      params: { type: 'object' },
                                      message: 'must be object',
                                    },
                                  ];
                                  return false;
                                }
                              }
                              var valid0 = _errs166 === errors;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.evidenceIds !== undefined) {
                                let data59 = data.evidenceIds;
                                const _errs180 = errors;
                                if (errors === _errs180) {
                                  if (Array.isArray(data59)) {
                                    var valid37 = true;
                                    const len10 = data59.length;
                                    for (let i10 = 0; i10 < len10; i10++) {
                                      const _errs182 = errors;
                                      if (typeof data59[i10] !== 'string') {
                                        validate33.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/evidenceIds/' +
                                              i10,
                                            schemaPath:
                                              '#/properties/evidenceIds/items/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid37 = _errs182 === errors;
                                      if (!valid37) {
                                        break;
                                      }
                                    }
                                  } else {
                                    validate33.errors = [
                                      {
                                        instancePath:
                                          instancePath + '/evidenceIds',
                                        schemaPath:
                                          '#/properties/evidenceIds/type',
                                        keyword: 'type',
                                        params: { type: 'array' },
                                        message: 'must be array',
                                      },
                                    ];
                                    return false;
                                  }
                                }
                                var valid0 = _errs180 === errors;
                              } else {
                                var valid0 = true;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate33.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate33.errors = vErrors;
  return errors === 0;
}
validate33.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate22(
  data,
  {
    instancePath = '',
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (
        (data.propertyName === undefined && (missing0 = 'propertyName')) ||
        (data.address === undefined && (missing0 = 'address')) ||
        (data.unitLabel === undefined && (missing0 = 'unitLabel')) ||
        (data.bedrooms === undefined && (missing0 = 'bedrooms')) ||
        (data.bathrooms === undefined && (missing0 = 'bathrooms')) ||
        (data.floorArea === undefined && (missing0 = 'floorArea')) ||
        (data.baseRent === undefined && (missing0 = 'baseRent')) ||
        (data.fees === undefined && (missing0 = 'fees')) ||
        (data.utilities === undefined && (missing0 = 'utilities')) ||
        (data.leaseTerm === undefined && (missing0 = 'leaseTerm')) ||
        (data.availableOn === undefined && (missing0 = 'availableOn')) ||
        (data.promotions === undefined && (missing0 = 'promotions'))
      ) {
        validate22.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func1.call(schema34.properties, key0)) {
            validate22.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.propertyName !== undefined) {
            let data0 = data.propertyName;
            const _errs2 = errors;
            const _errs3 = errors;
            if (errors === _errs3) {
              if (data0 && typeof data0 == 'object' && !Array.isArray(data0)) {
                let missing1;
                if (
                  (data0.status === undefined && (missing1 = 'status')) ||
                  (data0.value === undefined && (missing1 = 'value')) ||
                  (data0.candidates === undefined &&
                    (missing1 = 'candidates')) ||
                  (data0.scope === undefined && (missing1 = 'scope')) ||
                  (data0.evidenceIds === undefined &&
                    (missing1 = 'evidenceIds'))
                ) {
                  validate22.errors = [
                    {
                      instancePath: instancePath + '/propertyName',
                      schemaPath: '#/$defs/textField/required',
                      keyword: 'required',
                      params: { missingProperty: missing1 },
                      message: "must have required property '" + missing1 + "'",
                    },
                  ];
                  return false;
                } else {
                  const _errs5 = errors;
                  for (const key1 in data0) {
                    if (!(
                      key1 === 'status' ||
                      key1 === 'value' ||
                      key1 === 'candidates' ||
                      key1 === 'scope' ||
                      key1 === 'evidenceIds'
                    )) {
                      validate22.errors = [
                        {
                          instancePath: instancePath + '/propertyName',
                          schemaPath: '#/$defs/textField/additionalProperties',
                          keyword: 'additionalProperties',
                          params: { additionalProperty: key1 },
                          message: 'must NOT have additional properties',
                        },
                      ];
                      return false;
                      break;
                    }
                  }
                  if (_errs5 === errors) {
                    if (data0.status !== undefined) {
                      let data1 = data0.status;
                      const _errs6 = errors;
                      if (typeof data1 !== 'string') {
                        validate22.errors = [
                          {
                            instancePath: instancePath + '/propertyName/status',
                            schemaPath:
                              '#/$defs/textField/properties/status/type',
                            keyword: 'type',
                            params: { type: 'string' },
                            message: 'must be string',
                          },
                        ];
                        return false;
                      }
                      if (!(
                        data1 === 'known' ||
                        data1 === 'unknown' ||
                        data1 === 'not_applicable' ||
                        data1 === 'conflict'
                      )) {
                        validate22.errors = [
                          {
                            instancePath: instancePath + '/propertyName/status',
                            schemaPath:
                              '#/$defs/textField/properties/status/enum',
                            keyword: 'enum',
                            params: {
                              allowedValues: schema35.properties.status.enum,
                            },
                            message:
                              'must be equal to one of the allowed values',
                          },
                        ];
                        return false;
                      }
                      var valid2 = _errs6 === errors;
                    } else {
                      var valid2 = true;
                    }
                    if (valid2) {
                      if (data0.value !== undefined) {
                        let data2 = data0.value;
                        const _errs8 = errors;
                        const _errs9 = errors;
                        let valid3 = false;
                        const _errs10 = errors;
                        if (typeof data2 !== 'string') {
                          const err0 = {
                            instancePath: instancePath + '/propertyName/value',
                            schemaPath:
                              '#/$defs/textField/properties/value/anyOf/0/type',
                            keyword: 'type',
                            params: { type: 'string' },
                            message: 'must be string',
                          };
                          if (vErrors === null) {
                            vErrors = [err0];
                          } else {
                            vErrors.push(err0);
                          }
                          errors++;
                        }
                        var _valid0 = _errs10 === errors;
                        valid3 = valid3 || _valid0;
                        const _errs12 = errors;
                        if (data2 !== null) {
                          const err1 = {
                            instancePath: instancePath + '/propertyName/value',
                            schemaPath:
                              '#/$defs/textField/properties/value/anyOf/1/type',
                            keyword: 'type',
                            params: { type: 'null' },
                            message: 'must be null',
                          };
                          if (vErrors === null) {
                            vErrors = [err1];
                          } else {
                            vErrors.push(err1);
                          }
                          errors++;
                        }
                        var _valid0 = _errs12 === errors;
                        valid3 = valid3 || _valid0;
                        if (!valid3) {
                          const err2 = {
                            instancePath: instancePath + '/propertyName/value',
                            schemaPath:
                              '#/$defs/textField/properties/value/anyOf',
                            keyword: 'anyOf',
                            params: {},
                            message: 'must match a schema in anyOf',
                          };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors++;
                          validate22.errors = vErrors;
                          return false;
                        } else {
                          errors = _errs9;
                          if (vErrors !== null) {
                            if (_errs9) {
                              vErrors.length = _errs9;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid2 = _errs8 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data0.candidates !== undefined) {
                          let data3 = data0.candidates;
                          const _errs14 = errors;
                          if (errors === _errs14) {
                            if (Array.isArray(data3)) {
                              var valid4 = true;
                              const len0 = data3.length;
                              for (let i0 = 0; i0 < len0; i0++) {
                                const _errs16 = errors;
                                if (typeof data3[i0] !== 'string') {
                                  validate22.errors = [
                                    {
                                      instancePath:
                                        instancePath +
                                        '/propertyName/candidates/' +
                                        i0,
                                      schemaPath:
                                        '#/$defs/textField/properties/candidates/items/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    },
                                  ];
                                  return false;
                                }
                                var valid4 = _errs16 === errors;
                                if (!valid4) {
                                  break;
                                }
                              }
                            } else {
                              validate22.errors = [
                                {
                                  instancePath:
                                    instancePath + '/propertyName/candidates',
                                  schemaPath:
                                    '#/$defs/textField/properties/candidates/type',
                                  keyword: 'type',
                                  params: { type: 'array' },
                                  message: 'must be array',
                                },
                              ];
                              return false;
                            }
                          }
                          var valid2 = _errs14 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data0.scope !== undefined) {
                            let data5 = data0.scope;
                            const _errs18 = errors;
                            if (typeof data5 !== 'string') {
                              validate22.errors = [
                                {
                                  instancePath:
                                    instancePath + '/propertyName/scope',
                                  schemaPath:
                                    '#/$defs/textField/properties/scope/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                },
                              ];
                              return false;
                            }
                            if (!(
                              data5 === 'selected_unit' ||
                              data5 === 'floor_plan' ||
                              data5 === 'building' ||
                              data5 === 'listing' ||
                              data5 === 'unknown'
                            )) {
                              validate22.errors = [
                                {
                                  instancePath:
                                    instancePath + '/propertyName/scope',
                                  schemaPath:
                                    '#/$defs/textField/properties/scope/enum',
                                  keyword: 'enum',
                                  params: {
                                    allowedValues:
                                      schema35.properties.scope.enum,
                                  },
                                  message:
                                    'must be equal to one of the allowed values',
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs18 === errors;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data0.evidenceIds !== undefined) {
                              let data6 = data0.evidenceIds;
                              const _errs20 = errors;
                              if (errors === _errs20) {
                                if (Array.isArray(data6)) {
                                  var valid5 = true;
                                  const len1 = data6.length;
                                  for (let i1 = 0; i1 < len1; i1++) {
                                    const _errs22 = errors;
                                    if (typeof data6[i1] !== 'string') {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/propertyName/evidenceIds/' +
                                            i1,
                                          schemaPath:
                                            '#/$defs/textField/properties/evidenceIds/items/type',
                                          keyword: 'type',
                                          params: { type: 'string' },
                                          message: 'must be string',
                                        },
                                      ];
                                      return false;
                                    }
                                    var valid5 = _errs22 === errors;
                                    if (!valid5) {
                                      break;
                                    }
                                  }
                                } else {
                                  validate22.errors = [
                                    {
                                      instancePath:
                                        instancePath +
                                        '/propertyName/evidenceIds',
                                      schemaPath:
                                        '#/$defs/textField/properties/evidenceIds/type',
                                      keyword: 'type',
                                      params: { type: 'array' },
                                      message: 'must be array',
                                    },
                                  ];
                                  return false;
                                }
                              }
                              var valid2 = _errs20 === errors;
                            } else {
                              var valid2 = true;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                validate22.errors = [
                  {
                    instancePath: instancePath + '/propertyName',
                    schemaPath: '#/$defs/textField/type',
                    keyword: 'type',
                    params: { type: 'object' },
                    message: 'must be object',
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.address !== undefined) {
              let data8 = data.address;
              const _errs24 = errors;
              const _errs25 = errors;
              if (errors === _errs25) {
                if (
                  data8 &&
                  typeof data8 == 'object' &&
                  !Array.isArray(data8)
                ) {
                  let missing2;
                  if (
                    (data8.status === undefined && (missing2 = 'status')) ||
                    (data8.value === undefined && (missing2 = 'value')) ||
                    (data8.candidates === undefined &&
                      (missing2 = 'candidates')) ||
                    (data8.scope === undefined && (missing2 = 'scope')) ||
                    (data8.evidenceIds === undefined &&
                      (missing2 = 'evidenceIds'))
                  ) {
                    validate22.errors = [
                      {
                        instancePath: instancePath + '/address',
                        schemaPath: '#/$defs/textField/required',
                        keyword: 'required',
                        params: { missingProperty: missing2 },
                        message:
                          "must have required property '" + missing2 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs27 = errors;
                    for (const key2 in data8) {
                      if (!(
                        key2 === 'status' ||
                        key2 === 'value' ||
                        key2 === 'candidates' ||
                        key2 === 'scope' ||
                        key2 === 'evidenceIds'
                      )) {
                        validate22.errors = [
                          {
                            instancePath: instancePath + '/address',
                            schemaPath:
                              '#/$defs/textField/additionalProperties',
                            keyword: 'additionalProperties',
                            params: { additionalProperty: key2 },
                            message: 'must NOT have additional properties',
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs27 === errors) {
                      if (data8.status !== undefined) {
                        let data9 = data8.status;
                        const _errs28 = errors;
                        if (typeof data9 !== 'string') {
                          validate22.errors = [
                            {
                              instancePath: instancePath + '/address/status',
                              schemaPath:
                                '#/$defs/textField/properties/status/type',
                              keyword: 'type',
                              params: { type: 'string' },
                              message: 'must be string',
                            },
                          ];
                          return false;
                        }
                        if (!(
                          data9 === 'known' ||
                          data9 === 'unknown' ||
                          data9 === 'not_applicable' ||
                          data9 === 'conflict'
                        )) {
                          validate22.errors = [
                            {
                              instancePath: instancePath + '/address/status',
                              schemaPath:
                                '#/$defs/textField/properties/status/enum',
                              keyword: 'enum',
                              params: {
                                allowedValues: schema35.properties.status.enum,
                              },
                              message:
                                'must be equal to one of the allowed values',
                            },
                          ];
                          return false;
                        }
                        var valid7 = _errs28 === errors;
                      } else {
                        var valid7 = true;
                      }
                      if (valid7) {
                        if (data8.value !== undefined) {
                          let data10 = data8.value;
                          const _errs30 = errors;
                          const _errs31 = errors;
                          let valid8 = false;
                          const _errs32 = errors;
                          if (typeof data10 !== 'string') {
                            const err3 = {
                              instancePath: instancePath + '/address/value',
                              schemaPath:
                                '#/$defs/textField/properties/value/anyOf/0/type',
                              keyword: 'type',
                              params: { type: 'string' },
                              message: 'must be string',
                            };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors++;
                          }
                          var _valid1 = _errs32 === errors;
                          valid8 = valid8 || _valid1;
                          const _errs34 = errors;
                          if (data10 !== null) {
                            const err4 = {
                              instancePath: instancePath + '/address/value',
                              schemaPath:
                                '#/$defs/textField/properties/value/anyOf/1/type',
                              keyword: 'type',
                              params: { type: 'null' },
                              message: 'must be null',
                            };
                            if (vErrors === null) {
                              vErrors = [err4];
                            } else {
                              vErrors.push(err4);
                            }
                            errors++;
                          }
                          var _valid1 = _errs34 === errors;
                          valid8 = valid8 || _valid1;
                          if (!valid8) {
                            const err5 = {
                              instancePath: instancePath + '/address/value',
                              schemaPath:
                                '#/$defs/textField/properties/value/anyOf',
                              keyword: 'anyOf',
                              params: {},
                              message: 'must match a schema in anyOf',
                            };
                            if (vErrors === null) {
                              vErrors = [err5];
                            } else {
                              vErrors.push(err5);
                            }
                            errors++;
                            validate22.errors = vErrors;
                            return false;
                          } else {
                            errors = _errs31;
                            if (vErrors !== null) {
                              if (_errs31) {
                                vErrors.length = _errs31;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid7 = _errs30 === errors;
                        } else {
                          var valid7 = true;
                        }
                        if (valid7) {
                          if (data8.candidates !== undefined) {
                            let data11 = data8.candidates;
                            const _errs36 = errors;
                            if (errors === _errs36) {
                              if (Array.isArray(data11)) {
                                var valid9 = true;
                                const len2 = data11.length;
                                for (let i2 = 0; i2 < len2; i2++) {
                                  const _errs38 = errors;
                                  if (typeof data11[i2] !== 'string') {
                                    validate22.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          '/address/candidates/' +
                                          i2,
                                        schemaPath:
                                          '#/$defs/textField/properties/candidates/items/type',
                                        keyword: 'type',
                                        params: { type: 'string' },
                                        message: 'must be string',
                                      },
                                    ];
                                    return false;
                                  }
                                  var valid9 = _errs38 === errors;
                                  if (!valid9) {
                                    break;
                                  }
                                }
                              } else {
                                validate22.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/address/candidates',
                                    schemaPath:
                                      '#/$defs/textField/properties/candidates/type',
                                    keyword: 'type',
                                    params: { type: 'array' },
                                    message: 'must be array',
                                  },
                                ];
                                return false;
                              }
                            }
                            var valid7 = _errs36 === errors;
                          } else {
                            var valid7 = true;
                          }
                          if (valid7) {
                            if (data8.scope !== undefined) {
                              let data13 = data8.scope;
                              const _errs40 = errors;
                              if (typeof data13 !== 'string') {
                                validate22.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/address/scope',
                                    schemaPath:
                                      '#/$defs/textField/properties/scope/type',
                                    keyword: 'type',
                                    params: { type: 'string' },
                                    message: 'must be string',
                                  },
                                ];
                                return false;
                              }
                              if (!(
                                data13 === 'selected_unit' ||
                                data13 === 'floor_plan' ||
                                data13 === 'building' ||
                                data13 === 'listing' ||
                                data13 === 'unknown'
                              )) {
                                validate22.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/address/scope',
                                    schemaPath:
                                      '#/$defs/textField/properties/scope/enum',
                                    keyword: 'enum',
                                    params: {
                                      allowedValues:
                                        schema35.properties.scope.enum,
                                    },
                                    message:
                                      'must be equal to one of the allowed values',
                                  },
                                ];
                                return false;
                              }
                              var valid7 = _errs40 === errors;
                            } else {
                              var valid7 = true;
                            }
                            if (valid7) {
                              if (data8.evidenceIds !== undefined) {
                                let data14 = data8.evidenceIds;
                                const _errs42 = errors;
                                if (errors === _errs42) {
                                  if (Array.isArray(data14)) {
                                    var valid10 = true;
                                    const len3 = data14.length;
                                    for (let i3 = 0; i3 < len3; i3++) {
                                      const _errs44 = errors;
                                      if (typeof data14[i3] !== 'string') {
                                        validate22.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/address/evidenceIds/' +
                                              i3,
                                            schemaPath:
                                              '#/$defs/textField/properties/evidenceIds/items/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid10 = _errs44 === errors;
                                      if (!valid10) {
                                        break;
                                      }
                                    }
                                  } else {
                                    validate22.errors = [
                                      {
                                        instancePath:
                                          instancePath + '/address/evidenceIds',
                                        schemaPath:
                                          '#/$defs/textField/properties/evidenceIds/type',
                                        keyword: 'type',
                                        params: { type: 'array' },
                                        message: 'must be array',
                                      },
                                    ];
                                    return false;
                                  }
                                }
                                var valid7 = _errs42 === errors;
                              } else {
                                var valid7 = true;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate22.errors = [
                    {
                      instancePath: instancePath + '/address',
                      schemaPath: '#/$defs/textField/type',
                      keyword: 'type',
                      params: { type: 'object' },
                      message: 'must be object',
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs24 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.unitLabel !== undefined) {
                let data16 = data.unitLabel;
                const _errs46 = errors;
                const _errs47 = errors;
                if (errors === _errs47) {
                  if (
                    data16 &&
                    typeof data16 == 'object' &&
                    !Array.isArray(data16)
                  ) {
                    let missing3;
                    if (
                      (data16.status === undefined && (missing3 = 'status')) ||
                      (data16.value === undefined && (missing3 = 'value')) ||
                      (data16.candidates === undefined &&
                        (missing3 = 'candidates')) ||
                      (data16.scope === undefined && (missing3 = 'scope')) ||
                      (data16.evidenceIds === undefined &&
                        (missing3 = 'evidenceIds'))
                    ) {
                      validate22.errors = [
                        {
                          instancePath: instancePath + '/unitLabel',
                          schemaPath: '#/$defs/textField/required',
                          keyword: 'required',
                          params: { missingProperty: missing3 },
                          message:
                            "must have required property '" + missing3 + "'",
                        },
                      ];
                      return false;
                    } else {
                      const _errs49 = errors;
                      for (const key3 in data16) {
                        if (!(
                          key3 === 'status' ||
                          key3 === 'value' ||
                          key3 === 'candidates' ||
                          key3 === 'scope' ||
                          key3 === 'evidenceIds'
                        )) {
                          validate22.errors = [
                            {
                              instancePath: instancePath + '/unitLabel',
                              schemaPath:
                                '#/$defs/textField/additionalProperties',
                              keyword: 'additionalProperties',
                              params: { additionalProperty: key3 },
                              message: 'must NOT have additional properties',
                            },
                          ];
                          return false;
                          break;
                        }
                      }
                      if (_errs49 === errors) {
                        if (data16.status !== undefined) {
                          let data17 = data16.status;
                          const _errs50 = errors;
                          if (typeof data17 !== 'string') {
                            validate22.errors = [
                              {
                                instancePath:
                                  instancePath + '/unitLabel/status',
                                schemaPath:
                                  '#/$defs/textField/properties/status/type',
                                keyword: 'type',
                                params: { type: 'string' },
                                message: 'must be string',
                              },
                            ];
                            return false;
                          }
                          if (!(
                            data17 === 'known' ||
                            data17 === 'unknown' ||
                            data17 === 'not_applicable' ||
                            data17 === 'conflict'
                          )) {
                            validate22.errors = [
                              {
                                instancePath:
                                  instancePath + '/unitLabel/status',
                                schemaPath:
                                  '#/$defs/textField/properties/status/enum',
                                keyword: 'enum',
                                params: {
                                  allowedValues:
                                    schema35.properties.status.enum,
                                },
                                message:
                                  'must be equal to one of the allowed values',
                              },
                            ];
                            return false;
                          }
                          var valid12 = _errs50 === errors;
                        } else {
                          var valid12 = true;
                        }
                        if (valid12) {
                          if (data16.value !== undefined) {
                            let data18 = data16.value;
                            const _errs52 = errors;
                            const _errs53 = errors;
                            let valid13 = false;
                            const _errs54 = errors;
                            if (typeof data18 !== 'string') {
                              const err6 = {
                                instancePath: instancePath + '/unitLabel/value',
                                schemaPath:
                                  '#/$defs/textField/properties/value/anyOf/0/type',
                                keyword: 'type',
                                params: { type: 'string' },
                                message: 'must be string',
                              };
                              if (vErrors === null) {
                                vErrors = [err6];
                              } else {
                                vErrors.push(err6);
                              }
                              errors++;
                            }
                            var _valid2 = _errs54 === errors;
                            valid13 = valid13 || _valid2;
                            const _errs56 = errors;
                            if (data18 !== null) {
                              const err7 = {
                                instancePath: instancePath + '/unitLabel/value',
                                schemaPath:
                                  '#/$defs/textField/properties/value/anyOf/1/type',
                                keyword: 'type',
                                params: { type: 'null' },
                                message: 'must be null',
                              };
                              if (vErrors === null) {
                                vErrors = [err7];
                              } else {
                                vErrors.push(err7);
                              }
                              errors++;
                            }
                            var _valid2 = _errs56 === errors;
                            valid13 = valid13 || _valid2;
                            if (!valid13) {
                              const err8 = {
                                instancePath: instancePath + '/unitLabel/value',
                                schemaPath:
                                  '#/$defs/textField/properties/value/anyOf',
                                keyword: 'anyOf',
                                params: {},
                                message: 'must match a schema in anyOf',
                              };
                              if (vErrors === null) {
                                vErrors = [err8];
                              } else {
                                vErrors.push(err8);
                              }
                              errors++;
                              validate22.errors = vErrors;
                              return false;
                            } else {
                              errors = _errs53;
                              if (vErrors !== null) {
                                if (_errs53) {
                                  vErrors.length = _errs53;
                                } else {
                                  vErrors = null;
                                }
                              }
                            }
                            var valid12 = _errs52 === errors;
                          } else {
                            var valid12 = true;
                          }
                          if (valid12) {
                            if (data16.candidates !== undefined) {
                              let data19 = data16.candidates;
                              const _errs58 = errors;
                              if (errors === _errs58) {
                                if (Array.isArray(data19)) {
                                  var valid14 = true;
                                  const len4 = data19.length;
                                  for (let i4 = 0; i4 < len4; i4++) {
                                    const _errs60 = errors;
                                    if (typeof data19[i4] !== 'string') {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/unitLabel/candidates/' +
                                            i4,
                                          schemaPath:
                                            '#/$defs/textField/properties/candidates/items/type',
                                          keyword: 'type',
                                          params: { type: 'string' },
                                          message: 'must be string',
                                        },
                                      ];
                                      return false;
                                    }
                                    var valid14 = _errs60 === errors;
                                    if (!valid14) {
                                      break;
                                    }
                                  }
                                } else {
                                  validate22.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/unitLabel/candidates',
                                      schemaPath:
                                        '#/$defs/textField/properties/candidates/type',
                                      keyword: 'type',
                                      params: { type: 'array' },
                                      message: 'must be array',
                                    },
                                  ];
                                  return false;
                                }
                              }
                              var valid12 = _errs58 === errors;
                            } else {
                              var valid12 = true;
                            }
                            if (valid12) {
                              if (data16.scope !== undefined) {
                                let data21 = data16.scope;
                                const _errs62 = errors;
                                if (typeof data21 !== 'string') {
                                  validate22.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/unitLabel/scope',
                                      schemaPath:
                                        '#/$defs/textField/properties/scope/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    },
                                  ];
                                  return false;
                                }
                                if (!(
                                  data21 === 'selected_unit' ||
                                  data21 === 'floor_plan' ||
                                  data21 === 'building' ||
                                  data21 === 'listing' ||
                                  data21 === 'unknown'
                                )) {
                                  validate22.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/unitLabel/scope',
                                      schemaPath:
                                        '#/$defs/textField/properties/scope/enum',
                                      keyword: 'enum',
                                      params: {
                                        allowedValues:
                                          schema35.properties.scope.enum,
                                      },
                                      message:
                                        'must be equal to one of the allowed values',
                                    },
                                  ];
                                  return false;
                                }
                                var valid12 = _errs62 === errors;
                              } else {
                                var valid12 = true;
                              }
                              if (valid12) {
                                if (data16.evidenceIds !== undefined) {
                                  let data22 = data16.evidenceIds;
                                  const _errs64 = errors;
                                  if (errors === _errs64) {
                                    if (Array.isArray(data22)) {
                                      var valid15 = true;
                                      const len5 = data22.length;
                                      for (let i5 = 0; i5 < len5; i5++) {
                                        const _errs66 = errors;
                                        if (typeof data22[i5] !== 'string') {
                                          validate22.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/unitLabel/evidenceIds/' +
                                                i5,
                                              schemaPath:
                                                '#/$defs/textField/properties/evidenceIds/items/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid15 = _errs66 === errors;
                                        if (!valid15) {
                                          break;
                                        }
                                      }
                                    } else {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/unitLabel/evidenceIds',
                                          schemaPath:
                                            '#/$defs/textField/properties/evidenceIds/type',
                                          keyword: 'type',
                                          params: { type: 'array' },
                                          message: 'must be array',
                                        },
                                      ];
                                      return false;
                                    }
                                  }
                                  var valid12 = _errs64 === errors;
                                } else {
                                  var valid12 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    validate22.errors = [
                      {
                        instancePath: instancePath + '/unitLabel',
                        schemaPath: '#/$defs/textField/type',
                        keyword: 'type',
                        params: { type: 'object' },
                        message: 'must be object',
                      },
                    ];
                    return false;
                  }
                }
                var valid0 = _errs46 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.bedrooms !== undefined) {
                  let data24 = data.bedrooms;
                  const _errs68 = errors;
                  const _errs69 = errors;
                  if (errors === _errs69) {
                    if (
                      data24 &&
                      typeof data24 == 'object' &&
                      !Array.isArray(data24)
                    ) {
                      let missing4;
                      if (
                        (data24.status === undefined &&
                          (missing4 = 'status')) ||
                        (data24.value === undefined && (missing4 = 'value')) ||
                        (data24.candidates === undefined &&
                          (missing4 = 'candidates')) ||
                        (data24.scope === undefined && (missing4 = 'scope')) ||
                        (data24.evidenceIds === undefined &&
                          (missing4 = 'evidenceIds'))
                      ) {
                        validate22.errors = [
                          {
                            instancePath: instancePath + '/bedrooms',
                            schemaPath: '#/$defs/numberField/required',
                            keyword: 'required',
                            params: { missingProperty: missing4 },
                            message:
                              "must have required property '" + missing4 + "'",
                          },
                        ];
                        return false;
                      } else {
                        const _errs71 = errors;
                        for (const key4 in data24) {
                          if (!(
                            key4 === 'status' ||
                            key4 === 'value' ||
                            key4 === 'candidates' ||
                            key4 === 'scope' ||
                            key4 === 'evidenceIds'
                          )) {
                            validate22.errors = [
                              {
                                instancePath: instancePath + '/bedrooms',
                                schemaPath:
                                  '#/$defs/numberField/additionalProperties',
                                keyword: 'additionalProperties',
                                params: { additionalProperty: key4 },
                                message: 'must NOT have additional properties',
                              },
                            ];
                            return false;
                            break;
                          }
                        }
                        if (_errs71 === errors) {
                          if (data24.status !== undefined) {
                            let data25 = data24.status;
                            const _errs72 = errors;
                            if (typeof data25 !== 'string') {
                              validate22.errors = [
                                {
                                  instancePath:
                                    instancePath + '/bedrooms/status',
                                  schemaPath:
                                    '#/$defs/numberField/properties/status/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                },
                              ];
                              return false;
                            }
                            if (!(
                              data25 === 'known' ||
                              data25 === 'unknown' ||
                              data25 === 'not_applicable' ||
                              data25 === 'conflict'
                            )) {
                              validate22.errors = [
                                {
                                  instancePath:
                                    instancePath + '/bedrooms/status',
                                  schemaPath:
                                    '#/$defs/numberField/properties/status/enum',
                                  keyword: 'enum',
                                  params: {
                                    allowedValues:
                                      schema38.properties.status.enum,
                                  },
                                  message:
                                    'must be equal to one of the allowed values',
                                },
                              ];
                              return false;
                            }
                            var valid17 = _errs72 === errors;
                          } else {
                            var valid17 = true;
                          }
                          if (valid17) {
                            if (data24.value !== undefined) {
                              let data26 = data24.value;
                              const _errs74 = errors;
                              const _errs75 = errors;
                              let valid18 = false;
                              const _errs76 = errors;
                              if (!(typeof data26 == 'number')) {
                                const err9 = {
                                  instancePath:
                                    instancePath + '/bedrooms/value',
                                  schemaPath:
                                    '#/$defs/numberField/properties/value/anyOf/0/type',
                                  keyword: 'type',
                                  params: { type: 'number' },
                                  message: 'must be number',
                                };
                                if (vErrors === null) {
                                  vErrors = [err9];
                                } else {
                                  vErrors.push(err9);
                                }
                                errors++;
                              }
                              var _valid3 = _errs76 === errors;
                              valid18 = valid18 || _valid3;
                              const _errs78 = errors;
                              if (data26 !== null) {
                                const err10 = {
                                  instancePath:
                                    instancePath + '/bedrooms/value',
                                  schemaPath:
                                    '#/$defs/numberField/properties/value/anyOf/1/type',
                                  keyword: 'type',
                                  params: { type: 'null' },
                                  message: 'must be null',
                                };
                                if (vErrors === null) {
                                  vErrors = [err10];
                                } else {
                                  vErrors.push(err10);
                                }
                                errors++;
                              }
                              var _valid3 = _errs78 === errors;
                              valid18 = valid18 || _valid3;
                              if (!valid18) {
                                const err11 = {
                                  instancePath:
                                    instancePath + '/bedrooms/value',
                                  schemaPath:
                                    '#/$defs/numberField/properties/value/anyOf',
                                  keyword: 'anyOf',
                                  params: {},
                                  message: 'must match a schema in anyOf',
                                };
                                if (vErrors === null) {
                                  vErrors = [err11];
                                } else {
                                  vErrors.push(err11);
                                }
                                errors++;
                                validate22.errors = vErrors;
                                return false;
                              } else {
                                errors = _errs75;
                                if (vErrors !== null) {
                                  if (_errs75) {
                                    vErrors.length = _errs75;
                                  } else {
                                    vErrors = null;
                                  }
                                }
                              }
                              var valid17 = _errs74 === errors;
                            } else {
                              var valid17 = true;
                            }
                            if (valid17) {
                              if (data24.candidates !== undefined) {
                                let data27 = data24.candidates;
                                const _errs80 = errors;
                                if (errors === _errs80) {
                                  if (Array.isArray(data27)) {
                                    var valid19 = true;
                                    const len6 = data27.length;
                                    for (let i6 = 0; i6 < len6; i6++) {
                                      const _errs82 = errors;
                                      if (!(typeof data27[i6] == 'number')) {
                                        validate22.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/bedrooms/candidates/' +
                                              i6,
                                            schemaPath:
                                              '#/$defs/numberField/properties/candidates/items/type',
                                            keyword: 'type',
                                            params: { type: 'number' },
                                            message: 'must be number',
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid19 = _errs82 === errors;
                                      if (!valid19) {
                                        break;
                                      }
                                    }
                                  } else {
                                    validate22.errors = [
                                      {
                                        instancePath:
                                          instancePath + '/bedrooms/candidates',
                                        schemaPath:
                                          '#/$defs/numberField/properties/candidates/type',
                                        keyword: 'type',
                                        params: { type: 'array' },
                                        message: 'must be array',
                                      },
                                    ];
                                    return false;
                                  }
                                }
                                var valid17 = _errs80 === errors;
                              } else {
                                var valid17 = true;
                              }
                              if (valid17) {
                                if (data24.scope !== undefined) {
                                  let data29 = data24.scope;
                                  const _errs84 = errors;
                                  if (typeof data29 !== 'string') {
                                    validate22.errors = [
                                      {
                                        instancePath:
                                          instancePath + '/bedrooms/scope',
                                        schemaPath:
                                          '#/$defs/numberField/properties/scope/type',
                                        keyword: 'type',
                                        params: { type: 'string' },
                                        message: 'must be string',
                                      },
                                    ];
                                    return false;
                                  }
                                  if (!(
                                    data29 === 'selected_unit' ||
                                    data29 === 'floor_plan' ||
                                    data29 === 'building' ||
                                    data29 === 'listing' ||
                                    data29 === 'unknown'
                                  )) {
                                    validate22.errors = [
                                      {
                                        instancePath:
                                          instancePath + '/bedrooms/scope',
                                        schemaPath:
                                          '#/$defs/numberField/properties/scope/enum',
                                        keyword: 'enum',
                                        params: {
                                          allowedValues:
                                            schema38.properties.scope.enum,
                                        },
                                        message:
                                          'must be equal to one of the allowed values',
                                      },
                                    ];
                                    return false;
                                  }
                                  var valid17 = _errs84 === errors;
                                } else {
                                  var valid17 = true;
                                }
                                if (valid17) {
                                  if (data24.evidenceIds !== undefined) {
                                    let data30 = data24.evidenceIds;
                                    const _errs86 = errors;
                                    if (errors === _errs86) {
                                      if (Array.isArray(data30)) {
                                        var valid20 = true;
                                        const len7 = data30.length;
                                        for (let i7 = 0; i7 < len7; i7++) {
                                          const _errs88 = errors;
                                          if (typeof data30[i7] !== 'string') {
                                            validate22.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/bedrooms/evidenceIds/' +
                                                  i7,
                                                schemaPath:
                                                  '#/$defs/numberField/properties/evidenceIds/items/type',
                                                keyword: 'type',
                                                params: { type: 'string' },
                                                message: 'must be string',
                                              },
                                            ];
                                            return false;
                                          }
                                          var valid20 = _errs88 === errors;
                                          if (!valid20) {
                                            break;
                                          }
                                        }
                                      } else {
                                        validate22.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/bedrooms/evidenceIds',
                                            schemaPath:
                                              '#/$defs/numberField/properties/evidenceIds/type',
                                            keyword: 'type',
                                            params: { type: 'array' },
                                            message: 'must be array',
                                          },
                                        ];
                                        return false;
                                      }
                                    }
                                    var valid17 = _errs86 === errors;
                                  } else {
                                    var valid17 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    } else {
                      validate22.errors = [
                        {
                          instancePath: instancePath + '/bedrooms',
                          schemaPath: '#/$defs/numberField/type',
                          keyword: 'type',
                          params: { type: 'object' },
                          message: 'must be object',
                        },
                      ];
                      return false;
                    }
                  }
                  var valid0 = _errs68 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.bathrooms !== undefined) {
                    let data32 = data.bathrooms;
                    const _errs90 = errors;
                    const _errs91 = errors;
                    if (errors === _errs91) {
                      if (
                        data32 &&
                        typeof data32 == 'object' &&
                        !Array.isArray(data32)
                      ) {
                        let missing5;
                        if (
                          (data32.status === undefined &&
                            (missing5 = 'status')) ||
                          (data32.value === undefined &&
                            (missing5 = 'value')) ||
                          (data32.candidates === undefined &&
                            (missing5 = 'candidates')) ||
                          (data32.scope === undefined &&
                            (missing5 = 'scope')) ||
                          (data32.evidenceIds === undefined &&
                            (missing5 = 'evidenceIds'))
                        ) {
                          validate22.errors = [
                            {
                              instancePath: instancePath + '/bathrooms',
                              schemaPath: '#/$defs/numberField/required',
                              keyword: 'required',
                              params: { missingProperty: missing5 },
                              message:
                                "must have required property '" +
                                missing5 +
                                "'",
                            },
                          ];
                          return false;
                        } else {
                          const _errs93 = errors;
                          for (const key5 in data32) {
                            if (!(
                              key5 === 'status' ||
                              key5 === 'value' ||
                              key5 === 'candidates' ||
                              key5 === 'scope' ||
                              key5 === 'evidenceIds'
                            )) {
                              validate22.errors = [
                                {
                                  instancePath: instancePath + '/bathrooms',
                                  schemaPath:
                                    '#/$defs/numberField/additionalProperties',
                                  keyword: 'additionalProperties',
                                  params: { additionalProperty: key5 },
                                  message:
                                    'must NOT have additional properties',
                                },
                              ];
                              return false;
                              break;
                            }
                          }
                          if (_errs93 === errors) {
                            if (data32.status !== undefined) {
                              let data33 = data32.status;
                              const _errs94 = errors;
                              if (typeof data33 !== 'string') {
                                validate22.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/bathrooms/status',
                                    schemaPath:
                                      '#/$defs/numberField/properties/status/type',
                                    keyword: 'type',
                                    params: { type: 'string' },
                                    message: 'must be string',
                                  },
                                ];
                                return false;
                              }
                              if (!(
                                data33 === 'known' ||
                                data33 === 'unknown' ||
                                data33 === 'not_applicable' ||
                                data33 === 'conflict'
                              )) {
                                validate22.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/bathrooms/status',
                                    schemaPath:
                                      '#/$defs/numberField/properties/status/enum',
                                    keyword: 'enum',
                                    params: {
                                      allowedValues:
                                        schema38.properties.status.enum,
                                    },
                                    message:
                                      'must be equal to one of the allowed values',
                                  },
                                ];
                                return false;
                              }
                              var valid22 = _errs94 === errors;
                            } else {
                              var valid22 = true;
                            }
                            if (valid22) {
                              if (data32.value !== undefined) {
                                let data34 = data32.value;
                                const _errs96 = errors;
                                const _errs97 = errors;
                                let valid23 = false;
                                const _errs98 = errors;
                                if (!(typeof data34 == 'number')) {
                                  const err12 = {
                                    instancePath:
                                      instancePath + '/bathrooms/value',
                                    schemaPath:
                                      '#/$defs/numberField/properties/value/anyOf/0/type',
                                    keyword: 'type',
                                    params: { type: 'number' },
                                    message: 'must be number',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err12];
                                  } else {
                                    vErrors.push(err12);
                                  }
                                  errors++;
                                }
                                var _valid4 = _errs98 === errors;
                                valid23 = valid23 || _valid4;
                                const _errs100 = errors;
                                if (data34 !== null) {
                                  const err13 = {
                                    instancePath:
                                      instancePath + '/bathrooms/value',
                                    schemaPath:
                                      '#/$defs/numberField/properties/value/anyOf/1/type',
                                    keyword: 'type',
                                    params: { type: 'null' },
                                    message: 'must be null',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err13];
                                  } else {
                                    vErrors.push(err13);
                                  }
                                  errors++;
                                }
                                var _valid4 = _errs100 === errors;
                                valid23 = valid23 || _valid4;
                                if (!valid23) {
                                  const err14 = {
                                    instancePath:
                                      instancePath + '/bathrooms/value',
                                    schemaPath:
                                      '#/$defs/numberField/properties/value/anyOf',
                                    keyword: 'anyOf',
                                    params: {},
                                    message: 'must match a schema in anyOf',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err14];
                                  } else {
                                    vErrors.push(err14);
                                  }
                                  errors++;
                                  validate22.errors = vErrors;
                                  return false;
                                } else {
                                  errors = _errs97;
                                  if (vErrors !== null) {
                                    if (_errs97) {
                                      vErrors.length = _errs97;
                                    } else {
                                      vErrors = null;
                                    }
                                  }
                                }
                                var valid22 = _errs96 === errors;
                              } else {
                                var valid22 = true;
                              }
                              if (valid22) {
                                if (data32.candidates !== undefined) {
                                  let data35 = data32.candidates;
                                  const _errs102 = errors;
                                  if (errors === _errs102) {
                                    if (Array.isArray(data35)) {
                                      var valid24 = true;
                                      const len8 = data35.length;
                                      for (let i8 = 0; i8 < len8; i8++) {
                                        const _errs104 = errors;
                                        if (!(typeof data35[i8] == 'number')) {
                                          validate22.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/bathrooms/candidates/' +
                                                i8,
                                              schemaPath:
                                                '#/$defs/numberField/properties/candidates/items/type',
                                              keyword: 'type',
                                              params: { type: 'number' },
                                              message: 'must be number',
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid24 = _errs104 === errors;
                                        if (!valid24) {
                                          break;
                                        }
                                      }
                                    } else {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/bathrooms/candidates',
                                          schemaPath:
                                            '#/$defs/numberField/properties/candidates/type',
                                          keyword: 'type',
                                          params: { type: 'array' },
                                          message: 'must be array',
                                        },
                                      ];
                                      return false;
                                    }
                                  }
                                  var valid22 = _errs102 === errors;
                                } else {
                                  var valid22 = true;
                                }
                                if (valid22) {
                                  if (data32.scope !== undefined) {
                                    let data37 = data32.scope;
                                    const _errs106 = errors;
                                    if (typeof data37 !== 'string') {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath + '/bathrooms/scope',
                                          schemaPath:
                                            '#/$defs/numberField/properties/scope/type',
                                          keyword: 'type',
                                          params: { type: 'string' },
                                          message: 'must be string',
                                        },
                                      ];
                                      return false;
                                    }
                                    if (!(
                                      data37 === 'selected_unit' ||
                                      data37 === 'floor_plan' ||
                                      data37 === 'building' ||
                                      data37 === 'listing' ||
                                      data37 === 'unknown'
                                    )) {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath + '/bathrooms/scope',
                                          schemaPath:
                                            '#/$defs/numberField/properties/scope/enum',
                                          keyword: 'enum',
                                          params: {
                                            allowedValues:
                                              schema38.properties.scope.enum,
                                          },
                                          message:
                                            'must be equal to one of the allowed values',
                                        },
                                      ];
                                      return false;
                                    }
                                    var valid22 = _errs106 === errors;
                                  } else {
                                    var valid22 = true;
                                  }
                                  if (valid22) {
                                    if (data32.evidenceIds !== undefined) {
                                      let data38 = data32.evidenceIds;
                                      const _errs108 = errors;
                                      if (errors === _errs108) {
                                        if (Array.isArray(data38)) {
                                          var valid25 = true;
                                          const len9 = data38.length;
                                          for (let i9 = 0; i9 < len9; i9++) {
                                            const _errs110 = errors;
                                            if (
                                              typeof data38[i9] !== 'string'
                                            ) {
                                              validate22.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/bathrooms/evidenceIds/' +
                                                    i9,
                                                  schemaPath:
                                                    '#/$defs/numberField/properties/evidenceIds/items/type',
                                                  keyword: 'type',
                                                  params: { type: 'string' },
                                                  message: 'must be string',
                                                },
                                              ];
                                              return false;
                                            }
                                            var valid25 = _errs110 === errors;
                                            if (!valid25) {
                                              break;
                                            }
                                          }
                                        } else {
                                          validate22.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/bathrooms/evidenceIds',
                                              schemaPath:
                                                '#/$defs/numberField/properties/evidenceIds/type',
                                              keyword: 'type',
                                              params: { type: 'array' },
                                              message: 'must be array',
                                            },
                                          ];
                                          return false;
                                        }
                                      }
                                      var valid22 = _errs108 === errors;
                                    } else {
                                      var valid22 = true;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      } else {
                        validate22.errors = [
                          {
                            instancePath: instancePath + '/bathrooms',
                            schemaPath: '#/$defs/numberField/type',
                            keyword: 'type',
                            params: { type: 'object' },
                            message: 'must be object',
                          },
                        ];
                        return false;
                      }
                    }
                    var valid0 = _errs90 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.floorArea !== undefined) {
                      let data40 = data.floorArea;
                      const _errs112 = errors;
                      const _errs113 = errors;
                      if (errors === _errs113) {
                        if (
                          data40 &&
                          typeof data40 == 'object' &&
                          !Array.isArray(data40)
                        ) {
                          let missing6;
                          if (
                            (data40.status === undefined &&
                              (missing6 = 'status')) ||
                            (data40.value === undefined &&
                              (missing6 = 'value')) ||
                            (data40.candidates === undefined &&
                              (missing6 = 'candidates')) ||
                            (data40.scope === undefined &&
                              (missing6 = 'scope')) ||
                            (data40.evidenceIds === undefined &&
                              (missing6 = 'evidenceIds'))
                          ) {
                            validate22.errors = [
                              {
                                instancePath: instancePath + '/floorArea',
                                schemaPath: '#/$defs/areaField/required',
                                keyword: 'required',
                                params: { missingProperty: missing6 },
                                message:
                                  "must have required property '" +
                                  missing6 +
                                  "'",
                              },
                            ];
                            return false;
                          } else {
                            const _errs115 = errors;
                            for (const key6 in data40) {
                              if (!(
                                key6 === 'status' ||
                                key6 === 'value' ||
                                key6 === 'candidates' ||
                                key6 === 'scope' ||
                                key6 === 'evidenceIds'
                              )) {
                                validate22.errors = [
                                  {
                                    instancePath: instancePath + '/floorArea',
                                    schemaPath:
                                      '#/$defs/areaField/additionalProperties',
                                    keyword: 'additionalProperties',
                                    params: { additionalProperty: key6 },
                                    message:
                                      'must NOT have additional properties',
                                  },
                                ];
                                return false;
                                break;
                              }
                            }
                            if (_errs115 === errors) {
                              if (data40.status !== undefined) {
                                let data41 = data40.status;
                                const _errs116 = errors;
                                if (typeof data41 !== 'string') {
                                  validate22.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/floorArea/status',
                                      schemaPath:
                                        '#/$defs/areaField/properties/status/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    },
                                  ];
                                  return false;
                                }
                                if (!(
                                  data41 === 'known' ||
                                  data41 === 'unknown' ||
                                  data41 === 'not_applicable' ||
                                  data41 === 'conflict'
                                )) {
                                  validate22.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/floorArea/status',
                                      schemaPath:
                                        '#/$defs/areaField/properties/status/enum',
                                      keyword: 'enum',
                                      params: {
                                        allowedValues:
                                          schema40.properties.status.enum,
                                      },
                                      message:
                                        'must be equal to one of the allowed values',
                                    },
                                  ];
                                  return false;
                                }
                                var valid27 = _errs116 === errors;
                              } else {
                                var valid27 = true;
                              }
                              if (valid27) {
                                if (data40.value !== undefined) {
                                  let data42 = data40.value;
                                  const _errs118 = errors;
                                  const _errs119 = errors;
                                  let valid28 = false;
                                  const _errs120 = errors;
                                  if (errors === _errs120) {
                                    if (
                                      data42 &&
                                      typeof data42 == 'object' &&
                                      !Array.isArray(data42)
                                    ) {
                                      let missing7;
                                      if (
                                        (data42.kind === undefined &&
                                          (missing7 = 'kind')) ||
                                        (data42.min === undefined &&
                                          (missing7 = 'min')) ||
                                        (data42.max === undefined &&
                                          (missing7 = 'max')) ||
                                        (data42.unit === undefined &&
                                          (missing7 = 'unit'))
                                      ) {
                                        const err15 = {
                                          instancePath:
                                            instancePath + '/floorArea/value',
                                          schemaPath:
                                            '#/$defs/areaField/properties/value/anyOf/0/required',
                                          keyword: 'required',
                                          params: { missingProperty: missing7 },
                                          message:
                                            "must have required property '" +
                                            missing7 +
                                            "'",
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err15];
                                        } else {
                                          vErrors.push(err15);
                                        }
                                        errors++;
                                      } else {
                                        const _errs122 = errors;
                                        for (const key7 in data42) {
                                          if (!(
                                            key7 === 'kind' ||
                                            key7 === 'min' ||
                                            key7 === 'max' ||
                                            key7 === 'unit'
                                          )) {
                                            const err16 = {
                                              instancePath:
                                                instancePath +
                                                '/floorArea/value',
                                              schemaPath:
                                                '#/$defs/areaField/properties/value/anyOf/0/additionalProperties',
                                              keyword: 'additionalProperties',
                                              params: {
                                                additionalProperty: key7,
                                              },
                                              message:
                                                'must NOT have additional properties',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err16];
                                            } else {
                                              vErrors.push(err16);
                                            }
                                            errors++;
                                            break;
                                          }
                                        }
                                        if (_errs122 === errors) {
                                          if (data42.kind !== undefined) {
                                            let data43 = data42.kind;
                                            const _errs123 = errors;
                                            if (typeof data43 !== 'string') {
                                              const err17 = {
                                                instancePath:
                                                  instancePath +
                                                  '/floorArea/value/kind',
                                                schemaPath:
                                                  '#/$defs/areaField/properties/value/anyOf/0/properties/kind/type',
                                                keyword: 'type',
                                                params: { type: 'string' },
                                                message: 'must be string',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err17];
                                              } else {
                                                vErrors.push(err17);
                                              }
                                              errors++;
                                            }
                                            if (!(
                                              data43 === 'exact' ||
                                              data43 === 'range'
                                            )) {
                                              const err18 = {
                                                instancePath:
                                                  instancePath +
                                                  '/floorArea/value/kind',
                                                schemaPath:
                                                  '#/$defs/areaField/properties/value/anyOf/0/properties/kind/enum',
                                                keyword: 'enum',
                                                params: {
                                                  allowedValues:
                                                    schema40.properties.value
                                                      .anyOf[0].properties.kind
                                                      .enum,
                                                },
                                                message:
                                                  'must be equal to one of the allowed values',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err18];
                                              } else {
                                                vErrors.push(err18);
                                              }
                                              errors++;
                                            }
                                            var valid29 = _errs123 === errors;
                                          } else {
                                            var valid29 = true;
                                          }
                                          if (valid29) {
                                            if (data42.min !== undefined) {
                                              let data44 = data42.min;
                                              const _errs125 = errors;
                                              const _errs126 = errors;
                                              let valid30 = false;
                                              const _errs127 = errors;
                                              if (
                                                !(typeof data44 == 'number')
                                              ) {
                                                const err19 = {
                                                  instancePath:
                                                    instancePath +
                                                    '/floorArea/value/min',
                                                  schemaPath:
                                                    '#/$defs/areaField/properties/value/anyOf/0/properties/min/anyOf/0/type',
                                                  keyword: 'type',
                                                  params: { type: 'number' },
                                                  message: 'must be number',
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err19];
                                                } else {
                                                  vErrors.push(err19);
                                                }
                                                errors++;
                                              }
                                              var _valid6 = _errs127 === errors;
                                              valid30 = valid30 || _valid6;
                                              const _errs129 = errors;
                                              if (data44 !== null) {
                                                const err20 = {
                                                  instancePath:
                                                    instancePath +
                                                    '/floorArea/value/min',
                                                  schemaPath:
                                                    '#/$defs/areaField/properties/value/anyOf/0/properties/min/anyOf/1/type',
                                                  keyword: 'type',
                                                  params: { type: 'null' },
                                                  message: 'must be null',
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err20];
                                                } else {
                                                  vErrors.push(err20);
                                                }
                                                errors++;
                                              }
                                              var _valid6 = _errs129 === errors;
                                              valid30 = valid30 || _valid6;
                                              if (!valid30) {
                                                const err21 = {
                                                  instancePath:
                                                    instancePath +
                                                    '/floorArea/value/min',
                                                  schemaPath:
                                                    '#/$defs/areaField/properties/value/anyOf/0/properties/min/anyOf',
                                                  keyword: 'anyOf',
                                                  params: {},
                                                  message:
                                                    'must match a schema in anyOf',
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err21];
                                                } else {
                                                  vErrors.push(err21);
                                                }
                                                errors++;
                                              } else {
                                                errors = _errs126;
                                                if (vErrors !== null) {
                                                  if (_errs126) {
                                                    vErrors.length = _errs126;
                                                  } else {
                                                    vErrors = null;
                                                  }
                                                }
                                              }
                                              var valid29 = _errs125 === errors;
                                            } else {
                                              var valid29 = true;
                                            }
                                            if (valid29) {
                                              if (data42.max !== undefined) {
                                                let data45 = data42.max;
                                                const _errs131 = errors;
                                                const _errs132 = errors;
                                                let valid31 = false;
                                                const _errs133 = errors;
                                                if (
                                                  !(typeof data45 == 'number')
                                                ) {
                                                  const err22 = {
                                                    instancePath:
                                                      instancePath +
                                                      '/floorArea/value/max',
                                                    schemaPath:
                                                      '#/$defs/areaField/properties/value/anyOf/0/properties/max/anyOf/0/type',
                                                    keyword: 'type',
                                                    params: { type: 'number' },
                                                    message: 'must be number',
                                                  };
                                                  if (vErrors === null) {
                                                    vErrors = [err22];
                                                  } else {
                                                    vErrors.push(err22);
                                                  }
                                                  errors++;
                                                }
                                                var _valid7 =
                                                  _errs133 === errors;
                                                valid31 = valid31 || _valid7;
                                                const _errs135 = errors;
                                                if (data45 !== null) {
                                                  const err23 = {
                                                    instancePath:
                                                      instancePath +
                                                      '/floorArea/value/max',
                                                    schemaPath:
                                                      '#/$defs/areaField/properties/value/anyOf/0/properties/max/anyOf/1/type',
                                                    keyword: 'type',
                                                    params: { type: 'null' },
                                                    message: 'must be null',
                                                  };
                                                  if (vErrors === null) {
                                                    vErrors = [err23];
                                                  } else {
                                                    vErrors.push(err23);
                                                  }
                                                  errors++;
                                                }
                                                var _valid7 =
                                                  _errs135 === errors;
                                                valid31 = valid31 || _valid7;
                                                if (!valid31) {
                                                  const err24 = {
                                                    instancePath:
                                                      instancePath +
                                                      '/floorArea/value/max',
                                                    schemaPath:
                                                      '#/$defs/areaField/properties/value/anyOf/0/properties/max/anyOf',
                                                    keyword: 'anyOf',
                                                    params: {},
                                                    message:
                                                      'must match a schema in anyOf',
                                                  };
                                                  if (vErrors === null) {
                                                    vErrors = [err24];
                                                  } else {
                                                    vErrors.push(err24);
                                                  }
                                                  errors++;
                                                } else {
                                                  errors = _errs132;
                                                  if (vErrors !== null) {
                                                    if (_errs132) {
                                                      vErrors.length = _errs132;
                                                    } else {
                                                      vErrors = null;
                                                    }
                                                  }
                                                }
                                                var valid29 =
                                                  _errs131 === errors;
                                              } else {
                                                var valid29 = true;
                                              }
                                              if (valid29) {
                                                if (data42.unit !== undefined) {
                                                  let data46 = data42.unit;
                                                  const _errs137 = errors;
                                                  if (
                                                    typeof data46 !== 'string'
                                                  ) {
                                                    const err25 = {
                                                      instancePath:
                                                        instancePath +
                                                        '/floorArea/value/unit',
                                                      schemaPath:
                                                        '#/$defs/areaField/properties/value/anyOf/0/properties/unit/type',
                                                      keyword: 'type',
                                                      params: {
                                                        type: 'string',
                                                      },
                                                      message: 'must be string',
                                                    };
                                                    if (vErrors === null) {
                                                      vErrors = [err25];
                                                    } else {
                                                      vErrors.push(err25);
                                                    }
                                                    errors++;
                                                  }
                                                  if (!(
                                                    data46 === 'sq_ft' ||
                                                    data46 === 'sq_m'
                                                  )) {
                                                    const err26 = {
                                                      instancePath:
                                                        instancePath +
                                                        '/floorArea/value/unit',
                                                      schemaPath:
                                                        '#/$defs/areaField/properties/value/anyOf/0/properties/unit/enum',
                                                      keyword: 'enum',
                                                      params: {
                                                        allowedValues:
                                                          schema40.properties
                                                            .value.anyOf[0]
                                                            .properties.unit
                                                            .enum,
                                                      },
                                                      message:
                                                        'must be equal to one of the allowed values',
                                                    };
                                                    if (vErrors === null) {
                                                      vErrors = [err26];
                                                    } else {
                                                      vErrors.push(err26);
                                                    }
                                                    errors++;
                                                  }
                                                  var valid29 =
                                                    _errs137 === errors;
                                                } else {
                                                  var valid29 = true;
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    } else {
                                      const err27 = {
                                        instancePath:
                                          instancePath + '/floorArea/value',
                                        schemaPath:
                                          '#/$defs/areaField/properties/value/anyOf/0/type',
                                        keyword: 'type',
                                        params: { type: 'object' },
                                        message: 'must be object',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err27];
                                      } else {
                                        vErrors.push(err27);
                                      }
                                      errors++;
                                    }
                                  }
                                  var _valid5 = _errs120 === errors;
                                  valid28 = valid28 || _valid5;
                                  const _errs139 = errors;
                                  if (data42 !== null) {
                                    const err28 = {
                                      instancePath:
                                        instancePath + '/floorArea/value',
                                      schemaPath:
                                        '#/$defs/areaField/properties/value/anyOf/1/type',
                                      keyword: 'type',
                                      params: { type: 'null' },
                                      message: 'must be null',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err28];
                                    } else {
                                      vErrors.push(err28);
                                    }
                                    errors++;
                                  }
                                  var _valid5 = _errs139 === errors;
                                  valid28 = valid28 || _valid5;
                                  if (!valid28) {
                                    const err29 = {
                                      instancePath:
                                        instancePath + '/floorArea/value',
                                      schemaPath:
                                        '#/$defs/areaField/properties/value/anyOf',
                                      keyword: 'anyOf',
                                      params: {},
                                      message: 'must match a schema in anyOf',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err29];
                                    } else {
                                      vErrors.push(err29);
                                    }
                                    errors++;
                                    validate22.errors = vErrors;
                                    return false;
                                  } else {
                                    errors = _errs119;
                                    if (vErrors !== null) {
                                      if (_errs119) {
                                        vErrors.length = _errs119;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid27 = _errs118 === errors;
                                } else {
                                  var valid27 = true;
                                }
                                if (valid27) {
                                  if (data40.candidates !== undefined) {
                                    let data47 = data40.candidates;
                                    const _errs141 = errors;
                                    if (errors === _errs141) {
                                      if (Array.isArray(data47)) {
                                        var valid32 = true;
                                        const len10 = data47.length;
                                        for (let i10 = 0; i10 < len10; i10++) {
                                          let data48 = data47[i10];
                                          const _errs143 = errors;
                                          if (errors === _errs143) {
                                            if (
                                              data48 &&
                                              typeof data48 == 'object' &&
                                              !Array.isArray(data48)
                                            ) {
                                              let missing8;
                                              if (
                                                (data48.kind === undefined &&
                                                  (missing8 = 'kind')) ||
                                                (data48.min === undefined &&
                                                  (missing8 = 'min')) ||
                                                (data48.max === undefined &&
                                                  (missing8 = 'max')) ||
                                                (data48.unit === undefined &&
                                                  (missing8 = 'unit'))
                                              ) {
                                                validate22.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      '/floorArea/candidates/' +
                                                      i10,
                                                    schemaPath:
                                                      '#/$defs/areaField/properties/candidates/items/required',
                                                    keyword: 'required',
                                                    params: {
                                                      missingProperty: missing8,
                                                    },
                                                    message:
                                                      "must have required property '" +
                                                      missing8 +
                                                      "'",
                                                  },
                                                ];
                                                return false;
                                              } else {
                                                const _errs145 = errors;
                                                for (const key8 in data48) {
                                                  if (!(
                                                    key8 === 'kind' ||
                                                    key8 === 'min' ||
                                                    key8 === 'max' ||
                                                    key8 === 'unit'
                                                  )) {
                                                    validate22.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          '/floorArea/candidates/' +
                                                          i10,
                                                        schemaPath:
                                                          '#/$defs/areaField/properties/candidates/items/additionalProperties',
                                                        keyword:
                                                          'additionalProperties',
                                                        params: {
                                                          additionalProperty:
                                                            key8,
                                                        },
                                                        message:
                                                          'must NOT have additional properties',
                                                      },
                                                    ];
                                                    return false;
                                                    break;
                                                  }
                                                }
                                                if (_errs145 === errors) {
                                                  if (
                                                    data48.kind !== undefined
                                                  ) {
                                                    let data49 = data48.kind;
                                                    const _errs146 = errors;
                                                    if (
                                                      typeof data49 !== 'string'
                                                    ) {
                                                      validate22.errors = [
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/floorArea/candidates/' +
                                                            i10 +
                                                            '/kind',
                                                          schemaPath:
                                                            '#/$defs/areaField/properties/candidates/items/properties/kind/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'string',
                                                          },
                                                          message:
                                                            'must be string',
                                                        },
                                                      ];
                                                      return false;
                                                    }
                                                    if (!(
                                                      data49 === 'exact' ||
                                                      data49 === 'range'
                                                    )) {
                                                      validate22.errors = [
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/floorArea/candidates/' +
                                                            i10 +
                                                            '/kind',
                                                          schemaPath:
                                                            '#/$defs/areaField/properties/candidates/items/properties/kind/enum',
                                                          keyword: 'enum',
                                                          params: {
                                                            allowedValues:
                                                              schema40
                                                                .properties
                                                                .candidates
                                                                .items
                                                                .properties.kind
                                                                .enum,
                                                          },
                                                          message:
                                                            'must be equal to one of the allowed values',
                                                        },
                                                      ];
                                                      return false;
                                                    }
                                                    var valid33 =
                                                      _errs146 === errors;
                                                  } else {
                                                    var valid33 = true;
                                                  }
                                                  if (valid33) {
                                                    if (
                                                      data48.min !== undefined
                                                    ) {
                                                      let data50 = data48.min;
                                                      const _errs148 = errors;
                                                      const _errs149 = errors;
                                                      let valid34 = false;
                                                      const _errs150 = errors;
                                                      if (
                                                        !(
                                                          typeof data50 ==
                                                          'number'
                                                        )
                                                      ) {
                                                        const err30 = {
                                                          instancePath:
                                                            instancePath +
                                                            '/floorArea/candidates/' +
                                                            i10 +
                                                            '/min',
                                                          schemaPath:
                                                            '#/$defs/areaField/properties/candidates/items/properties/min/anyOf/0/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'number',
                                                          },
                                                          message:
                                                            'must be number',
                                                        };
                                                        if (vErrors === null) {
                                                          vErrors = [err30];
                                                        } else {
                                                          vErrors.push(err30);
                                                        }
                                                        errors++;
                                                      }
                                                      var _valid8 =
                                                        _errs150 === errors;
                                                      valid34 =
                                                        valid34 || _valid8;
                                                      const _errs152 = errors;
                                                      if (data50 !== null) {
                                                        const err31 = {
                                                          instancePath:
                                                            instancePath +
                                                            '/floorArea/candidates/' +
                                                            i10 +
                                                            '/min',
                                                          schemaPath:
                                                            '#/$defs/areaField/properties/candidates/items/properties/min/anyOf/1/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'null',
                                                          },
                                                          message:
                                                            'must be null',
                                                        };
                                                        if (vErrors === null) {
                                                          vErrors = [err31];
                                                        } else {
                                                          vErrors.push(err31);
                                                        }
                                                        errors++;
                                                      }
                                                      var _valid8 =
                                                        _errs152 === errors;
                                                      valid34 =
                                                        valid34 || _valid8;
                                                      if (!valid34) {
                                                        const err32 = {
                                                          instancePath:
                                                            instancePath +
                                                            '/floorArea/candidates/' +
                                                            i10 +
                                                            '/min',
                                                          schemaPath:
                                                            '#/$defs/areaField/properties/candidates/items/properties/min/anyOf',
                                                          keyword: 'anyOf',
                                                          params: {},
                                                          message:
                                                            'must match a schema in anyOf',
                                                        };
                                                        if (vErrors === null) {
                                                          vErrors = [err32];
                                                        } else {
                                                          vErrors.push(err32);
                                                        }
                                                        errors++;
                                                        validate22.errors =
                                                          vErrors;
                                                        return false;
                                                      } else {
                                                        errors = _errs149;
                                                        if (vErrors !== null) {
                                                          if (_errs149) {
                                                            vErrors.length =
                                                              _errs149;
                                                          } else {
                                                            vErrors = null;
                                                          }
                                                        }
                                                      }
                                                      var valid33 =
                                                        _errs148 === errors;
                                                    } else {
                                                      var valid33 = true;
                                                    }
                                                    if (valid33) {
                                                      if (
                                                        data48.max !== undefined
                                                      ) {
                                                        let data51 = data48.max;
                                                        const _errs154 = errors;
                                                        const _errs155 = errors;
                                                        let valid35 = false;
                                                        const _errs156 = errors;
                                                        if (
                                                          !(
                                                            typeof data51 ==
                                                            'number'
                                                          )
                                                        ) {
                                                          const err33 = {
                                                            instancePath:
                                                              instancePath +
                                                              '/floorArea/candidates/' +
                                                              i10 +
                                                              '/max',
                                                            schemaPath:
                                                              '#/$defs/areaField/properties/candidates/items/properties/max/anyOf/0/type',
                                                            keyword: 'type',
                                                            params: {
                                                              type: 'number',
                                                            },
                                                            message:
                                                              'must be number',
                                                          };
                                                          if (
                                                            vErrors === null
                                                          ) {
                                                            vErrors = [err33];
                                                          } else {
                                                            vErrors.push(err33);
                                                          }
                                                          errors++;
                                                        }
                                                        var _valid9 =
                                                          _errs156 === errors;
                                                        valid35 =
                                                          valid35 || _valid9;
                                                        const _errs158 = errors;
                                                        if (data51 !== null) {
                                                          const err34 = {
                                                            instancePath:
                                                              instancePath +
                                                              '/floorArea/candidates/' +
                                                              i10 +
                                                              '/max',
                                                            schemaPath:
                                                              '#/$defs/areaField/properties/candidates/items/properties/max/anyOf/1/type',
                                                            keyword: 'type',
                                                            params: {
                                                              type: 'null',
                                                            },
                                                            message:
                                                              'must be null',
                                                          };
                                                          if (
                                                            vErrors === null
                                                          ) {
                                                            vErrors = [err34];
                                                          } else {
                                                            vErrors.push(err34);
                                                          }
                                                          errors++;
                                                        }
                                                        var _valid9 =
                                                          _errs158 === errors;
                                                        valid35 =
                                                          valid35 || _valid9;
                                                        if (!valid35) {
                                                          const err35 = {
                                                            instancePath:
                                                              instancePath +
                                                              '/floorArea/candidates/' +
                                                              i10 +
                                                              '/max',
                                                            schemaPath:
                                                              '#/$defs/areaField/properties/candidates/items/properties/max/anyOf',
                                                            keyword: 'anyOf',
                                                            params: {},
                                                            message:
                                                              'must match a schema in anyOf',
                                                          };
                                                          if (
                                                            vErrors === null
                                                          ) {
                                                            vErrors = [err35];
                                                          } else {
                                                            vErrors.push(err35);
                                                          }
                                                          errors++;
                                                          validate22.errors =
                                                            vErrors;
                                                          return false;
                                                        } else {
                                                          errors = _errs155;
                                                          if (
                                                            vErrors !== null
                                                          ) {
                                                            if (_errs155) {
                                                              vErrors.length =
                                                                _errs155;
                                                            } else {
                                                              vErrors = null;
                                                            }
                                                          }
                                                        }
                                                        var valid33 =
                                                          _errs154 === errors;
                                                      } else {
                                                        var valid33 = true;
                                                      }
                                                      if (valid33) {
                                                        if (
                                                          data48.unit !==
                                                          undefined
                                                        ) {
                                                          let data52 =
                                                            data48.unit;
                                                          const _errs160 =
                                                            errors;
                                                          if (
                                                            typeof data52 !==
                                                            'string'
                                                          ) {
                                                            validate22.errors =
                                                              [
                                                                {
                                                                  instancePath:
                                                                    instancePath +
                                                                    '/floorArea/candidates/' +
                                                                    i10 +
                                                                    '/unit',
                                                                  schemaPath:
                                                                    '#/$defs/areaField/properties/candidates/items/properties/unit/type',
                                                                  keyword:
                                                                    'type',
                                                                  params: {
                                                                    type: 'string',
                                                                  },
                                                                  message:
                                                                    'must be string',
                                                                },
                                                              ];
                                                            return false;
                                                          }
                                                          if (!(
                                                            data52 ===
                                                              'sq_ft' ||
                                                            data52 === 'sq_m'
                                                          )) {
                                                            validate22.errors =
                                                              [
                                                                {
                                                                  instancePath:
                                                                    instancePath +
                                                                    '/floorArea/candidates/' +
                                                                    i10 +
                                                                    '/unit',
                                                                  schemaPath:
                                                                    '#/$defs/areaField/properties/candidates/items/properties/unit/enum',
                                                                  keyword:
                                                                    'enum',
                                                                  params: {
                                                                    allowedValues:
                                                                      schema40
                                                                        .properties
                                                                        .candidates
                                                                        .items
                                                                        .properties
                                                                        .unit
                                                                        .enum,
                                                                  },
                                                                  message:
                                                                    'must be equal to one of the allowed values',
                                                                },
                                                              ];
                                                            return false;
                                                          }
                                                          var valid33 =
                                                            _errs160 === errors;
                                                        } else {
                                                          var valid33 = true;
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            } else {
                                              validate22.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/floorArea/candidates/' +
                                                    i10,
                                                  schemaPath:
                                                    '#/$defs/areaField/properties/candidates/items/type',
                                                  keyword: 'type',
                                                  params: { type: 'object' },
                                                  message: 'must be object',
                                                },
                                              ];
                                              return false;
                                            }
                                          }
                                          var valid32 = _errs143 === errors;
                                          if (!valid32) {
                                            break;
                                          }
                                        }
                                      } else {
                                        validate22.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/floorArea/candidates',
                                            schemaPath:
                                              '#/$defs/areaField/properties/candidates/type',
                                            keyword: 'type',
                                            params: { type: 'array' },
                                            message: 'must be array',
                                          },
                                        ];
                                        return false;
                                      }
                                    }
                                    var valid27 = _errs141 === errors;
                                  } else {
                                    var valid27 = true;
                                  }
                                  if (valid27) {
                                    if (data40.scope !== undefined) {
                                      let data53 = data40.scope;
                                      const _errs162 = errors;
                                      if (typeof data53 !== 'string') {
                                        validate22.errors = [
                                          {
                                            instancePath:
                                              instancePath + '/floorArea/scope',
                                            schemaPath:
                                              '#/$defs/areaField/properties/scope/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          },
                                        ];
                                        return false;
                                      }
                                      if (!(
                                        data53 === 'selected_unit' ||
                                        data53 === 'floor_plan' ||
                                        data53 === 'building' ||
                                        data53 === 'listing' ||
                                        data53 === 'unknown'
                                      )) {
                                        validate22.errors = [
                                          {
                                            instancePath:
                                              instancePath + '/floorArea/scope',
                                            schemaPath:
                                              '#/$defs/areaField/properties/scope/enum',
                                            keyword: 'enum',
                                            params: {
                                              allowedValues:
                                                schema40.properties.scope.enum,
                                            },
                                            message:
                                              'must be equal to one of the allowed values',
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid27 = _errs162 === errors;
                                    } else {
                                      var valid27 = true;
                                    }
                                    if (valid27) {
                                      if (data40.evidenceIds !== undefined) {
                                        let data54 = data40.evidenceIds;
                                        const _errs164 = errors;
                                        if (errors === _errs164) {
                                          if (Array.isArray(data54)) {
                                            var valid36 = true;
                                            const len11 = data54.length;
                                            for (
                                              let i11 = 0;
                                              i11 < len11;
                                              i11++
                                            ) {
                                              const _errs166 = errors;
                                              if (
                                                typeof data54[i11] !== 'string'
                                              ) {
                                                validate22.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      '/floorArea/evidenceIds/' +
                                                      i11,
                                                    schemaPath:
                                                      '#/$defs/areaField/properties/evidenceIds/items/type',
                                                    keyword: 'type',
                                                    params: { type: 'string' },
                                                    message: 'must be string',
                                                  },
                                                ];
                                                return false;
                                              }
                                              var valid36 = _errs166 === errors;
                                              if (!valid36) {
                                                break;
                                              }
                                            }
                                          } else {
                                            validate22.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/floorArea/evidenceIds',
                                                schemaPath:
                                                  '#/$defs/areaField/properties/evidenceIds/type',
                                                keyword: 'type',
                                                params: { type: 'array' },
                                                message: 'must be array',
                                              },
                                            ];
                                            return false;
                                          }
                                        }
                                        var valid27 = _errs164 === errors;
                                      } else {
                                        var valid27 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate22.errors = [
                            {
                              instancePath: instancePath + '/floorArea',
                              schemaPath: '#/$defs/areaField/type',
                              keyword: 'type',
                              params: { type: 'object' },
                              message: 'must be object',
                            },
                          ];
                          return false;
                        }
                      }
                      var valid0 = _errs112 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.baseRent !== undefined) {
                        const _errs168 = errors;
                        if (
                          !validate23(data.baseRent, {
                            instancePath: instancePath + '/baseRent',
                            parentData: data,
                            parentDataProperty: 'baseRent',
                            rootData,
                            dynamicAnchors,
                          })
                        ) {
                          vErrors =
                            vErrors === null
                              ? validate23.errors
                              : vErrors.concat(validate23.errors);
                          errors = vErrors.length;
                        }
                        var valid0 = _errs168 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.fees !== undefined) {
                          let data57 = data.fees;
                          const _errs169 = errors;
                          if (errors === _errs169) {
                            if (
                              data57 &&
                              typeof data57 == 'object' &&
                              !Array.isArray(data57)
                            ) {
                              let missing9;
                              if (
                                (data57.status === undefined &&
                                  (missing9 = 'status')) ||
                                (data57.value === undefined &&
                                  (missing9 = 'value')) ||
                                (data57.candidates === undefined &&
                                  (missing9 = 'candidates')) ||
                                (data57.scope === undefined &&
                                  (missing9 = 'scope')) ||
                                (data57.evidenceIds === undefined &&
                                  (missing9 = 'evidenceIds'))
                              ) {
                                validate22.errors = [
                                  {
                                    instancePath: instancePath + '/fees',
                                    schemaPath: '#/properties/fees/required',
                                    keyword: 'required',
                                    params: { missingProperty: missing9 },
                                    message:
                                      "must have required property '" +
                                      missing9 +
                                      "'",
                                  },
                                ];
                                return false;
                              } else {
                                const _errs171 = errors;
                                for (const key9 in data57) {
                                  if (!(
                                    key9 === 'status' ||
                                    key9 === 'value' ||
                                    key9 === 'candidates' ||
                                    key9 === 'scope' ||
                                    key9 === 'evidenceIds'
                                  )) {
                                    validate22.errors = [
                                      {
                                        instancePath: instancePath + '/fees',
                                        schemaPath:
                                          '#/properties/fees/additionalProperties',
                                        keyword: 'additionalProperties',
                                        params: { additionalProperty: key9 },
                                        message:
                                          'must NOT have additional properties',
                                      },
                                    ];
                                    return false;
                                    break;
                                  }
                                }
                                if (_errs171 === errors) {
                                  if (data57.status !== undefined) {
                                    let data58 = data57.status;
                                    const _errs172 = errors;
                                    if (typeof data58 !== 'string') {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath + '/fees/status',
                                          schemaPath:
                                            '#/properties/fees/properties/status/type',
                                          keyword: 'type',
                                          params: { type: 'string' },
                                          message: 'must be string',
                                        },
                                      ];
                                      return false;
                                    }
                                    if (!(
                                      data58 === 'known' ||
                                      data58 === 'unknown' ||
                                      data58 === 'not_applicable' ||
                                      data58 === 'conflict'
                                    )) {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath + '/fees/status',
                                          schemaPath:
                                            '#/properties/fees/properties/status/enum',
                                          keyword: 'enum',
                                          params: {
                                            allowedValues:
                                              schema34.properties.fees
                                                .properties.status.enum,
                                          },
                                          message:
                                            'must be equal to one of the allowed values',
                                        },
                                      ];
                                      return false;
                                    }
                                    var valid37 = _errs172 === errors;
                                  } else {
                                    var valid37 = true;
                                  }
                                  if (valid37) {
                                    if (data57.value !== undefined) {
                                      let data59 = data57.value;
                                      const _errs174 = errors;
                                      const _errs175 = errors;
                                      let valid38 = false;
                                      const _errs176 = errors;
                                      if (errors === _errs176) {
                                        if (Array.isArray(data59)) {
                                          var valid39 = true;
                                          const len12 = data59.length;
                                          for (
                                            let i12 = 0;
                                            i12 < len12;
                                            i12++
                                          ) {
                                            const _errs178 = errors;
                                            if (
                                              !validate25(data59[i12], {
                                                instancePath:
                                                  instancePath +
                                                  '/fees/value/' +
                                                  i12,
                                                parentData: data59,
                                                parentDataProperty: i12,
                                                rootData,
                                                dynamicAnchors,
                                              })
                                            ) {
                                              vErrors =
                                                vErrors === null
                                                  ? validate25.errors
                                                  : vErrors.concat(
                                                      validate25.errors,
                                                    );
                                              errors = vErrors.length;
                                            }
                                            var valid39 = _errs178 === errors;
                                            if (!valid39) {
                                              break;
                                            }
                                          }
                                        } else {
                                          const err36 = {
                                            instancePath:
                                              instancePath + '/fees/value',
                                            schemaPath:
                                              '#/properties/fees/properties/value/anyOf/0/type',
                                            keyword: 'type',
                                            params: { type: 'array' },
                                            message: 'must be array',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err36];
                                          } else {
                                            vErrors.push(err36);
                                          }
                                          errors++;
                                        }
                                      }
                                      var _valid10 = _errs176 === errors;
                                      valid38 = valid38 || _valid10;
                                      const _errs179 = errors;
                                      if (data59 !== null) {
                                        const err37 = {
                                          instancePath:
                                            instancePath + '/fees/value',
                                          schemaPath:
                                            '#/properties/fees/properties/value/anyOf/1/type',
                                          keyword: 'type',
                                          params: { type: 'null' },
                                          message: 'must be null',
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err37];
                                        } else {
                                          vErrors.push(err37);
                                        }
                                        errors++;
                                      }
                                      var _valid10 = _errs179 === errors;
                                      valid38 = valid38 || _valid10;
                                      if (!valid38) {
                                        const err38 = {
                                          instancePath:
                                            instancePath + '/fees/value',
                                          schemaPath:
                                            '#/properties/fees/properties/value/anyOf',
                                          keyword: 'anyOf',
                                          params: {},
                                          message:
                                            'must match a schema in anyOf',
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err38];
                                        } else {
                                          vErrors.push(err38);
                                        }
                                        errors++;
                                        validate22.errors = vErrors;
                                        return false;
                                      } else {
                                        errors = _errs175;
                                        if (vErrors !== null) {
                                          if (_errs175) {
                                            vErrors.length = _errs175;
                                          } else {
                                            vErrors = null;
                                          }
                                        }
                                      }
                                      var valid37 = _errs174 === errors;
                                    } else {
                                      var valid37 = true;
                                    }
                                    if (valid37) {
                                      if (data57.candidates !== undefined) {
                                        let data61 = data57.candidates;
                                        const _errs181 = errors;
                                        if (errors === _errs181) {
                                          if (Array.isArray(data61)) {
                                            var valid40 = true;
                                            const len13 = data61.length;
                                            for (
                                              let i13 = 0;
                                              i13 < len13;
                                              i13++
                                            ) {
                                              let data62 = data61[i13];
                                              const _errs183 = errors;
                                              if (errors === _errs183) {
                                                if (Array.isArray(data62)) {
                                                  var valid41 = true;
                                                  const len14 = data62.length;
                                                  for (
                                                    let i14 = 0;
                                                    i14 < len14;
                                                    i14++
                                                  ) {
                                                    const _errs185 = errors;
                                                    if (
                                                      !validate25(data62[i14], {
                                                        instancePath:
                                                          instancePath +
                                                          '/fees/candidates/' +
                                                          i13 +
                                                          '/' +
                                                          i14,
                                                        parentData: data62,
                                                        parentDataProperty: i14,
                                                        rootData,
                                                        dynamicAnchors,
                                                      })
                                                    ) {
                                                      vErrors =
                                                        vErrors === null
                                                          ? validate25.errors
                                                          : vErrors.concat(
                                                              validate25.errors,
                                                            );
                                                      errors = vErrors.length;
                                                    }
                                                    var valid41 =
                                                      _errs185 === errors;
                                                    if (!valid41) {
                                                      break;
                                                    }
                                                  }
                                                } else {
                                                  validate22.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/fees/candidates/' +
                                                        i13,
                                                      schemaPath:
                                                        '#/properties/fees/properties/candidates/items/type',
                                                      keyword: 'type',
                                                      params: { type: 'array' },
                                                      message: 'must be array',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                              }
                                              var valid40 = _errs183 === errors;
                                              if (!valid40) {
                                                break;
                                              }
                                            }
                                          } else {
                                            validate22.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/fees/candidates',
                                                schemaPath:
                                                  '#/properties/fees/properties/candidates/type',
                                                keyword: 'type',
                                                params: { type: 'array' },
                                                message: 'must be array',
                                              },
                                            ];
                                            return false;
                                          }
                                        }
                                        var valid37 = _errs181 === errors;
                                      } else {
                                        var valid37 = true;
                                      }
                                      if (valid37) {
                                        if (data57.scope !== undefined) {
                                          let data64 = data57.scope;
                                          const _errs186 = errors;
                                          if (typeof data64 !== 'string') {
                                            validate22.errors = [
                                              {
                                                instancePath:
                                                  instancePath + '/fees/scope',
                                                schemaPath:
                                                  '#/properties/fees/properties/scope/type',
                                                keyword: 'type',
                                                params: { type: 'string' },
                                                message: 'must be string',
                                              },
                                            ];
                                            return false;
                                          }
                                          if (!(
                                            data64 === 'selected_unit' ||
                                            data64 === 'floor_plan' ||
                                            data64 === 'building' ||
                                            data64 === 'listing' ||
                                            data64 === 'unknown'
                                          )) {
                                            validate22.errors = [
                                              {
                                                instancePath:
                                                  instancePath + '/fees/scope',
                                                schemaPath:
                                                  '#/properties/fees/properties/scope/enum',
                                                keyword: 'enum',
                                                params: {
                                                  allowedValues:
                                                    schema34.properties.fees
                                                      .properties.scope.enum,
                                                },
                                                message:
                                                  'must be equal to one of the allowed values',
                                              },
                                            ];
                                            return false;
                                          }
                                          var valid37 = _errs186 === errors;
                                        } else {
                                          var valid37 = true;
                                        }
                                        if (valid37) {
                                          if (
                                            data57.evidenceIds !== undefined
                                          ) {
                                            let data65 = data57.evidenceIds;
                                            const _errs188 = errors;
                                            if (errors === _errs188) {
                                              if (Array.isArray(data65)) {
                                                var valid42 = true;
                                                const len15 = data65.length;
                                                for (
                                                  let i15 = 0;
                                                  i15 < len15;
                                                  i15++
                                                ) {
                                                  const _errs190 = errors;
                                                  if (
                                                    typeof data65[i15] !==
                                                    'string'
                                                  ) {
                                                    validate22.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          '/fees/evidenceIds/' +
                                                          i15,
                                                        schemaPath:
                                                          '#/properties/fees/properties/evidenceIds/items/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'string',
                                                        },
                                                        message:
                                                          'must be string',
                                                      },
                                                    ];
                                                    return false;
                                                  }
                                                  var valid42 =
                                                    _errs190 === errors;
                                                  if (!valid42) {
                                                    break;
                                                  }
                                                }
                                              } else {
                                                validate22.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      '/fees/evidenceIds',
                                                    schemaPath:
                                                      '#/properties/fees/properties/evidenceIds/type',
                                                    keyword: 'type',
                                                    params: { type: 'array' },
                                                    message: 'must be array',
                                                  },
                                                ];
                                                return false;
                                              }
                                            }
                                            var valid37 = _errs188 === errors;
                                          } else {
                                            var valid37 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            } else {
                              validate22.errors = [
                                {
                                  instancePath: instancePath + '/fees',
                                  schemaPath: '#/properties/fees/type',
                                  keyword: 'type',
                                  params: { type: 'object' },
                                  message: 'must be object',
                                },
                              ];
                              return false;
                            }
                          }
                          var valid0 = _errs169 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.utilities !== undefined) {
                            let data67 = data.utilities;
                            const _errs192 = errors;
                            if (errors === _errs192) {
                              if (
                                data67 &&
                                typeof data67 == 'object' &&
                                !Array.isArray(data67)
                              ) {
                                let missing10;
                                if (
                                  (data67.status === undefined &&
                                    (missing10 = 'status')) ||
                                  (data67.value === undefined &&
                                    (missing10 = 'value')) ||
                                  (data67.candidates === undefined &&
                                    (missing10 = 'candidates')) ||
                                  (data67.scope === undefined &&
                                    (missing10 = 'scope')) ||
                                  (data67.evidenceIds === undefined &&
                                    (missing10 = 'evidenceIds'))
                                ) {
                                  validate22.errors = [
                                    {
                                      instancePath: instancePath + '/utilities',
                                      schemaPath:
                                        '#/properties/utilities/required',
                                      keyword: 'required',
                                      params: { missingProperty: missing10 },
                                      message:
                                        "must have required property '" +
                                        missing10 +
                                        "'",
                                    },
                                  ];
                                  return false;
                                } else {
                                  const _errs194 = errors;
                                  for (const key10 in data67) {
                                    if (!(
                                      key10 === 'status' ||
                                      key10 === 'value' ||
                                      key10 === 'candidates' ||
                                      key10 === 'scope' ||
                                      key10 === 'evidenceIds'
                                    )) {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath + '/utilities',
                                          schemaPath:
                                            '#/properties/utilities/additionalProperties',
                                          keyword: 'additionalProperties',
                                          params: { additionalProperty: key10 },
                                          message:
                                            'must NOT have additional properties',
                                        },
                                      ];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs194 === errors) {
                                    if (data67.status !== undefined) {
                                      let data68 = data67.status;
                                      const _errs195 = errors;
                                      if (typeof data68 !== 'string') {
                                        validate22.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/utilities/status',
                                            schemaPath:
                                              '#/properties/utilities/properties/status/type',
                                            keyword: 'type',
                                            params: { type: 'string' },
                                            message: 'must be string',
                                          },
                                        ];
                                        return false;
                                      }
                                      if (!(
                                        data68 === 'known' ||
                                        data68 === 'unknown' ||
                                        data68 === 'not_applicable' ||
                                        data68 === 'conflict'
                                      )) {
                                        validate22.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              '/utilities/status',
                                            schemaPath:
                                              '#/properties/utilities/properties/status/enum',
                                            keyword: 'enum',
                                            params: {
                                              allowedValues:
                                                schema34.properties.utilities
                                                  .properties.status.enum,
                                            },
                                            message:
                                              'must be equal to one of the allowed values',
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid43 = _errs195 === errors;
                                    } else {
                                      var valid43 = true;
                                    }
                                    if (valid43) {
                                      if (data67.value !== undefined) {
                                        let data69 = data67.value;
                                        const _errs197 = errors;
                                        const _errs198 = errors;
                                        let valid44 = false;
                                        const _errs199 = errors;
                                        if (errors === _errs199) {
                                          if (Array.isArray(data69)) {
                                            var valid45 = true;
                                            const len16 = data69.length;
                                            for (
                                              let i16 = 0;
                                              i16 < len16;
                                              i16++
                                            ) {
                                              const _errs201 = errors;
                                              if (
                                                !validate29(data69[i16], {
                                                  instancePath:
                                                    instancePath +
                                                    '/utilities/value/' +
                                                    i16,
                                                  parentData: data69,
                                                  parentDataProperty: i16,
                                                  rootData,
                                                  dynamicAnchors,
                                                })
                                              ) {
                                                vErrors =
                                                  vErrors === null
                                                    ? validate29.errors
                                                    : vErrors.concat(
                                                        validate29.errors,
                                                      );
                                                errors = vErrors.length;
                                              }
                                              var valid45 = _errs201 === errors;
                                              if (!valid45) {
                                                break;
                                              }
                                            }
                                          } else {
                                            const err39 = {
                                              instancePath:
                                                instancePath +
                                                '/utilities/value',
                                              schemaPath:
                                                '#/properties/utilities/properties/value/anyOf/0/type',
                                              keyword: 'type',
                                              params: { type: 'array' },
                                              message: 'must be array',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err39];
                                            } else {
                                              vErrors.push(err39);
                                            }
                                            errors++;
                                          }
                                        }
                                        var _valid11 = _errs199 === errors;
                                        valid44 = valid44 || _valid11;
                                        const _errs202 = errors;
                                        if (data69 !== null) {
                                          const err40 = {
                                            instancePath:
                                              instancePath + '/utilities/value',
                                            schemaPath:
                                              '#/properties/utilities/properties/value/anyOf/1/type',
                                            keyword: 'type',
                                            params: { type: 'null' },
                                            message: 'must be null',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err40];
                                          } else {
                                            vErrors.push(err40);
                                          }
                                          errors++;
                                        }
                                        var _valid11 = _errs202 === errors;
                                        valid44 = valid44 || _valid11;
                                        if (!valid44) {
                                          const err41 = {
                                            instancePath:
                                              instancePath + '/utilities/value',
                                            schemaPath:
                                              '#/properties/utilities/properties/value/anyOf',
                                            keyword: 'anyOf',
                                            params: {},
                                            message:
                                              'must match a schema in anyOf',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err41];
                                          } else {
                                            vErrors.push(err41);
                                          }
                                          errors++;
                                          validate22.errors = vErrors;
                                          return false;
                                        } else {
                                          errors = _errs198;
                                          if (vErrors !== null) {
                                            if (_errs198) {
                                              vErrors.length = _errs198;
                                            } else {
                                              vErrors = null;
                                            }
                                          }
                                        }
                                        var valid43 = _errs197 === errors;
                                      } else {
                                        var valid43 = true;
                                      }
                                      if (valid43) {
                                        if (data67.candidates !== undefined) {
                                          let data71 = data67.candidates;
                                          const _errs204 = errors;
                                          if (errors === _errs204) {
                                            if (Array.isArray(data71)) {
                                              var valid46 = true;
                                              const len17 = data71.length;
                                              for (
                                                let i17 = 0;
                                                i17 < len17;
                                                i17++
                                              ) {
                                                let data72 = data71[i17];
                                                const _errs206 = errors;
                                                if (errors === _errs206) {
                                                  if (Array.isArray(data72)) {
                                                    var valid47 = true;
                                                    const len18 = data72.length;
                                                    for (
                                                      let i18 = 0;
                                                      i18 < len18;
                                                      i18++
                                                    ) {
                                                      const _errs208 = errors;
                                                      if (
                                                        !validate29(
                                                          data72[i18],
                                                          {
                                                            instancePath:
                                                              instancePath +
                                                              '/utilities/candidates/' +
                                                              i17 +
                                                              '/' +
                                                              i18,
                                                            parentData: data72,
                                                            parentDataProperty:
                                                              i18,
                                                            rootData,
                                                            dynamicAnchors,
                                                          },
                                                        )
                                                      ) {
                                                        vErrors =
                                                          vErrors === null
                                                            ? validate29.errors
                                                            : vErrors.concat(
                                                                validate29.errors,
                                                              );
                                                        errors = vErrors.length;
                                                      }
                                                      var valid47 =
                                                        _errs208 === errors;
                                                      if (!valid47) {
                                                        break;
                                                      }
                                                    }
                                                  } else {
                                                    validate22.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          '/utilities/candidates/' +
                                                          i17,
                                                        schemaPath:
                                                          '#/properties/utilities/properties/candidates/items/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'array',
                                                        },
                                                        message:
                                                          'must be array',
                                                      },
                                                    ];
                                                    return false;
                                                  }
                                                }
                                                var valid46 =
                                                  _errs206 === errors;
                                                if (!valid46) {
                                                  break;
                                                }
                                              }
                                            } else {
                                              validate22.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/utilities/candidates',
                                                  schemaPath:
                                                    '#/properties/utilities/properties/candidates/type',
                                                  keyword: 'type',
                                                  params: { type: 'array' },
                                                  message: 'must be array',
                                                },
                                              ];
                                              return false;
                                            }
                                          }
                                          var valid43 = _errs204 === errors;
                                        } else {
                                          var valid43 = true;
                                        }
                                        if (valid43) {
                                          if (data67.scope !== undefined) {
                                            let data74 = data67.scope;
                                            const _errs209 = errors;
                                            if (typeof data74 !== 'string') {
                                              validate22.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/utilities/scope',
                                                  schemaPath:
                                                    '#/properties/utilities/properties/scope/type',
                                                  keyword: 'type',
                                                  params: { type: 'string' },
                                                  message: 'must be string',
                                                },
                                              ];
                                              return false;
                                            }
                                            if (!(
                                              data74 === 'selected_unit' ||
                                              data74 === 'floor_plan' ||
                                              data74 === 'building' ||
                                              data74 === 'listing' ||
                                              data74 === 'unknown'
                                            )) {
                                              validate22.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/utilities/scope',
                                                  schemaPath:
                                                    '#/properties/utilities/properties/scope/enum',
                                                  keyword: 'enum',
                                                  params: {
                                                    allowedValues:
                                                      schema34.properties
                                                        .utilities.properties
                                                        .scope.enum,
                                                  },
                                                  message:
                                                    'must be equal to one of the allowed values',
                                                },
                                              ];
                                              return false;
                                            }
                                            var valid43 = _errs209 === errors;
                                          } else {
                                            var valid43 = true;
                                          }
                                          if (valid43) {
                                            if (
                                              data67.evidenceIds !== undefined
                                            ) {
                                              let data75 = data67.evidenceIds;
                                              const _errs211 = errors;
                                              if (errors === _errs211) {
                                                if (Array.isArray(data75)) {
                                                  var valid48 = true;
                                                  const len19 = data75.length;
                                                  for (
                                                    let i19 = 0;
                                                    i19 < len19;
                                                    i19++
                                                  ) {
                                                    const _errs213 = errors;
                                                    if (
                                                      typeof data75[i19] !==
                                                      'string'
                                                    ) {
                                                      validate22.errors = [
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/utilities/evidenceIds/' +
                                                            i19,
                                                          schemaPath:
                                                            '#/properties/utilities/properties/evidenceIds/items/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'string',
                                                          },
                                                          message:
                                                            'must be string',
                                                        },
                                                      ];
                                                      return false;
                                                    }
                                                    var valid48 =
                                                      _errs213 === errors;
                                                    if (!valid48) {
                                                      break;
                                                    }
                                                  }
                                                } else {
                                                  validate22.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/utilities/evidenceIds',
                                                      schemaPath:
                                                        '#/properties/utilities/properties/evidenceIds/type',
                                                      keyword: 'type',
                                                      params: { type: 'array' },
                                                      message: 'must be array',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                              }
                                              var valid43 = _errs211 === errors;
                                            } else {
                                              var valid43 = true;
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate22.errors = [
                                  {
                                    instancePath: instancePath + '/utilities',
                                    schemaPath: '#/properties/utilities/type',
                                    keyword: 'type',
                                    params: { type: 'object' },
                                    message: 'must be object',
                                  },
                                ];
                                return false;
                              }
                            }
                            var valid0 = _errs192 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.leaseTerm !== undefined) {
                              let data77 = data.leaseTerm;
                              const _errs215 = errors;
                              const _errs216 = errors;
                              if (errors === _errs216) {
                                if (
                                  data77 &&
                                  typeof data77 == 'object' &&
                                  !Array.isArray(data77)
                                ) {
                                  let missing11;
                                  if (
                                    (data77.status === undefined &&
                                      (missing11 = 'status')) ||
                                    (data77.value === undefined &&
                                      (missing11 = 'value')) ||
                                    (data77.candidates === undefined &&
                                      (missing11 = 'candidates')) ||
                                    (data77.scope === undefined &&
                                      (missing11 = 'scope')) ||
                                    (data77.evidenceIds === undefined &&
                                      (missing11 = 'evidenceIds'))
                                  ) {
                                    validate22.errors = [
                                      {
                                        instancePath:
                                          instancePath + '/leaseTerm',
                                        schemaPath:
                                          '#/$defs/durationField/required',
                                        keyword: 'required',
                                        params: { missingProperty: missing11 },
                                        message:
                                          "must have required property '" +
                                          missing11 +
                                          "'",
                                      },
                                    ];
                                    return false;
                                  } else {
                                    const _errs218 = errors;
                                    for (const key11 in data77) {
                                      if (!(
                                        key11 === 'status' ||
                                        key11 === 'value' ||
                                        key11 === 'candidates' ||
                                        key11 === 'scope' ||
                                        key11 === 'evidenceIds'
                                      )) {
                                        validate22.errors = [
                                          {
                                            instancePath:
                                              instancePath + '/leaseTerm',
                                            schemaPath:
                                              '#/$defs/durationField/additionalProperties',
                                            keyword: 'additionalProperties',
                                            params: {
                                              additionalProperty: key11,
                                            },
                                            message:
                                              'must NOT have additional properties',
                                          },
                                        ];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs218 === errors) {
                                      if (data77.status !== undefined) {
                                        let data78 = data77.status;
                                        const _errs219 = errors;
                                        if (typeof data78 !== 'string') {
                                          validate22.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/leaseTerm/status',
                                              schemaPath:
                                                '#/$defs/durationField/properties/status/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            },
                                          ];
                                          return false;
                                        }
                                        if (!(
                                          data78 === 'known' ||
                                          data78 === 'unknown' ||
                                          data78 === 'not_applicable' ||
                                          data78 === 'conflict'
                                        )) {
                                          validate22.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/leaseTerm/status',
                                              schemaPath:
                                                '#/$defs/durationField/properties/status/enum',
                                              keyword: 'enum',
                                              params: {
                                                allowedValues:
                                                  schema49.properties.status
                                                    .enum,
                                              },
                                              message:
                                                'must be equal to one of the allowed values',
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid50 = _errs219 === errors;
                                      } else {
                                        var valid50 = true;
                                      }
                                      if (valid50) {
                                        if (data77.value !== undefined) {
                                          let data79 = data77.value;
                                          const _errs221 = errors;
                                          const _errs222 = errors;
                                          let valid51 = false;
                                          const _errs223 = errors;
                                          if (errors === _errs223) {
                                            if (
                                              data79 &&
                                              typeof data79 == 'object' &&
                                              !Array.isArray(data79)
                                            ) {
                                              let missing12;
                                              if (
                                                (data79.kind === undefined &&
                                                  (missing12 = 'kind')) ||
                                                (data79.min === undefined &&
                                                  (missing12 = 'min')) ||
                                                (data79.max === undefined &&
                                                  (missing12 = 'max')) ||
                                                (data79.unit === undefined &&
                                                  (missing12 = 'unit'))
                                              ) {
                                                const err42 = {
                                                  instancePath:
                                                    instancePath +
                                                    '/leaseTerm/value',
                                                  schemaPath:
                                                    '#/$defs/durationField/properties/value/anyOf/0/required',
                                                  keyword: 'required',
                                                  params: {
                                                    missingProperty: missing12,
                                                  },
                                                  message:
                                                    "must have required property '" +
                                                    missing12 +
                                                    "'",
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err42];
                                                } else {
                                                  vErrors.push(err42);
                                                }
                                                errors++;
                                              } else {
                                                const _errs225 = errors;
                                                for (const key12 in data79) {
                                                  if (!(
                                                    key12 === 'kind' ||
                                                    key12 === 'min' ||
                                                    key12 === 'max' ||
                                                    key12 === 'unit'
                                                  )) {
                                                    const err43 = {
                                                      instancePath:
                                                        instancePath +
                                                        '/leaseTerm/value',
                                                      schemaPath:
                                                        '#/$defs/durationField/properties/value/anyOf/0/additionalProperties',
                                                      keyword:
                                                        'additionalProperties',
                                                      params: {
                                                        additionalProperty:
                                                          key12,
                                                      },
                                                      message:
                                                        'must NOT have additional properties',
                                                    };
                                                    if (vErrors === null) {
                                                      vErrors = [err43];
                                                    } else {
                                                      vErrors.push(err43);
                                                    }
                                                    errors++;
                                                    break;
                                                  }
                                                }
                                                if (_errs225 === errors) {
                                                  if (
                                                    data79.kind !== undefined
                                                  ) {
                                                    let data80 = data79.kind;
                                                    const _errs226 = errors;
                                                    if (
                                                      typeof data80 !== 'string'
                                                    ) {
                                                      const err44 = {
                                                        instancePath:
                                                          instancePath +
                                                          '/leaseTerm/value/kind',
                                                        schemaPath:
                                                          '#/$defs/durationField/properties/value/anyOf/0/properties/kind/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'string',
                                                        },
                                                        message:
                                                          'must be string',
                                                      };
                                                      if (vErrors === null) {
                                                        vErrors = [err44];
                                                      } else {
                                                        vErrors.push(err44);
                                                      }
                                                      errors++;
                                                    }
                                                    if (!(
                                                      data80 === 'exact' ||
                                                      data80 === 'range'
                                                    )) {
                                                      const err45 = {
                                                        instancePath:
                                                          instancePath +
                                                          '/leaseTerm/value/kind',
                                                        schemaPath:
                                                          '#/$defs/durationField/properties/value/anyOf/0/properties/kind/enum',
                                                        keyword: 'enum',
                                                        params: {
                                                          allowedValues:
                                                            schema49.properties
                                                              .value.anyOf[0]
                                                              .properties.kind
                                                              .enum,
                                                        },
                                                        message:
                                                          'must be equal to one of the allowed values',
                                                      };
                                                      if (vErrors === null) {
                                                        vErrors = [err45];
                                                      } else {
                                                        vErrors.push(err45);
                                                      }
                                                      errors++;
                                                    }
                                                    var valid52 =
                                                      _errs226 === errors;
                                                  } else {
                                                    var valid52 = true;
                                                  }
                                                  if (valid52) {
                                                    if (
                                                      data79.min !== undefined
                                                    ) {
                                                      let data81 = data79.min;
                                                      const _errs228 = errors;
                                                      const _errs229 = errors;
                                                      let valid53 = false;
                                                      const _errs230 = errors;
                                                      if (
                                                        !(
                                                          typeof data81 ==
                                                          'number'
                                                        )
                                                      ) {
                                                        const err46 = {
                                                          instancePath:
                                                            instancePath +
                                                            '/leaseTerm/value/min',
                                                          schemaPath:
                                                            '#/$defs/durationField/properties/value/anyOf/0/properties/min/anyOf/0/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'number',
                                                          },
                                                          message:
                                                            'must be number',
                                                        };
                                                        if (vErrors === null) {
                                                          vErrors = [err46];
                                                        } else {
                                                          vErrors.push(err46);
                                                        }
                                                        errors++;
                                                      }
                                                      var _valid13 =
                                                        _errs230 === errors;
                                                      valid53 =
                                                        valid53 || _valid13;
                                                      const _errs232 = errors;
                                                      if (data81 !== null) {
                                                        const err47 = {
                                                          instancePath:
                                                            instancePath +
                                                            '/leaseTerm/value/min',
                                                          schemaPath:
                                                            '#/$defs/durationField/properties/value/anyOf/0/properties/min/anyOf/1/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'null',
                                                          },
                                                          message:
                                                            'must be null',
                                                        };
                                                        if (vErrors === null) {
                                                          vErrors = [err47];
                                                        } else {
                                                          vErrors.push(err47);
                                                        }
                                                        errors++;
                                                      }
                                                      var _valid13 =
                                                        _errs232 === errors;
                                                      valid53 =
                                                        valid53 || _valid13;
                                                      if (!valid53) {
                                                        const err48 = {
                                                          instancePath:
                                                            instancePath +
                                                            '/leaseTerm/value/min',
                                                          schemaPath:
                                                            '#/$defs/durationField/properties/value/anyOf/0/properties/min/anyOf',
                                                          keyword: 'anyOf',
                                                          params: {},
                                                          message:
                                                            'must match a schema in anyOf',
                                                        };
                                                        if (vErrors === null) {
                                                          vErrors = [err48];
                                                        } else {
                                                          vErrors.push(err48);
                                                        }
                                                        errors++;
                                                      } else {
                                                        errors = _errs229;
                                                        if (vErrors !== null) {
                                                          if (_errs229) {
                                                            vErrors.length =
                                                              _errs229;
                                                          } else {
                                                            vErrors = null;
                                                          }
                                                        }
                                                      }
                                                      var valid52 =
                                                        _errs228 === errors;
                                                    } else {
                                                      var valid52 = true;
                                                    }
                                                    if (valid52) {
                                                      if (
                                                        data79.max !== undefined
                                                      ) {
                                                        let data82 = data79.max;
                                                        const _errs234 = errors;
                                                        const _errs235 = errors;
                                                        let valid54 = false;
                                                        const _errs236 = errors;
                                                        if (
                                                          !(
                                                            typeof data82 ==
                                                            'number'
                                                          )
                                                        ) {
                                                          const err49 = {
                                                            instancePath:
                                                              instancePath +
                                                              '/leaseTerm/value/max',
                                                            schemaPath:
                                                              '#/$defs/durationField/properties/value/anyOf/0/properties/max/anyOf/0/type',
                                                            keyword: 'type',
                                                            params: {
                                                              type: 'number',
                                                            },
                                                            message:
                                                              'must be number',
                                                          };
                                                          if (
                                                            vErrors === null
                                                          ) {
                                                            vErrors = [err49];
                                                          } else {
                                                            vErrors.push(err49);
                                                          }
                                                          errors++;
                                                        }
                                                        var _valid14 =
                                                          _errs236 === errors;
                                                        valid54 =
                                                          valid54 || _valid14;
                                                        const _errs238 = errors;
                                                        if (data82 !== null) {
                                                          const err50 = {
                                                            instancePath:
                                                              instancePath +
                                                              '/leaseTerm/value/max',
                                                            schemaPath:
                                                              '#/$defs/durationField/properties/value/anyOf/0/properties/max/anyOf/1/type',
                                                            keyword: 'type',
                                                            params: {
                                                              type: 'null',
                                                            },
                                                            message:
                                                              'must be null',
                                                          };
                                                          if (
                                                            vErrors === null
                                                          ) {
                                                            vErrors = [err50];
                                                          } else {
                                                            vErrors.push(err50);
                                                          }
                                                          errors++;
                                                        }
                                                        var _valid14 =
                                                          _errs238 === errors;
                                                        valid54 =
                                                          valid54 || _valid14;
                                                        if (!valid54) {
                                                          const err51 = {
                                                            instancePath:
                                                              instancePath +
                                                              '/leaseTerm/value/max',
                                                            schemaPath:
                                                              '#/$defs/durationField/properties/value/anyOf/0/properties/max/anyOf',
                                                            keyword: 'anyOf',
                                                            params: {},
                                                            message:
                                                              'must match a schema in anyOf',
                                                          };
                                                          if (
                                                            vErrors === null
                                                          ) {
                                                            vErrors = [err51];
                                                          } else {
                                                            vErrors.push(err51);
                                                          }
                                                          errors++;
                                                        } else {
                                                          errors = _errs235;
                                                          if (
                                                            vErrors !== null
                                                          ) {
                                                            if (_errs235) {
                                                              vErrors.length =
                                                                _errs235;
                                                            } else {
                                                              vErrors = null;
                                                            }
                                                          }
                                                        }
                                                        var valid52 =
                                                          _errs234 === errors;
                                                      } else {
                                                        var valid52 = true;
                                                      }
                                                      if (valid52) {
                                                        if (
                                                          data79.unit !==
                                                          undefined
                                                        ) {
                                                          let data83 =
                                                            data79.unit;
                                                          const _errs240 =
                                                            errors;
                                                          if (
                                                            typeof data83 !==
                                                            'string'
                                                          ) {
                                                            const err52 = {
                                                              instancePath:
                                                                instancePath +
                                                                '/leaseTerm/value/unit',
                                                              schemaPath:
                                                                '#/$defs/durationField/properties/value/anyOf/0/properties/unit/type',
                                                              keyword: 'type',
                                                              params: {
                                                                type: 'string',
                                                              },
                                                              message:
                                                                'must be string',
                                                            };
                                                            if (
                                                              vErrors === null
                                                            ) {
                                                              vErrors = [err52];
                                                            } else {
                                                              vErrors.push(
                                                                err52,
                                                              );
                                                            }
                                                            errors++;
                                                          }
                                                          if (!(
                                                            data83 ===
                                                              'months' ||
                                                            data83 ===
                                                              'weeks' ||
                                                            data83 === 'days'
                                                          )) {
                                                            const err53 = {
                                                              instancePath:
                                                                instancePath +
                                                                '/leaseTerm/value/unit',
                                                              schemaPath:
                                                                '#/$defs/durationField/properties/value/anyOf/0/properties/unit/enum',
                                                              keyword: 'enum',
                                                              params: {
                                                                allowedValues:
                                                                  schema49
                                                                    .properties
                                                                    .value
                                                                    .anyOf[0]
                                                                    .properties
                                                                    .unit.enum,
                                                              },
                                                              message:
                                                                'must be equal to one of the allowed values',
                                                            };
                                                            if (
                                                              vErrors === null
                                                            ) {
                                                              vErrors = [err53];
                                                            } else {
                                                              vErrors.push(
                                                                err53,
                                                              );
                                                            }
                                                            errors++;
                                                          }
                                                          var valid52 =
                                                            _errs240 === errors;
                                                        } else {
                                                          var valid52 = true;
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            } else {
                                              const err54 = {
                                                instancePath:
                                                  instancePath +
                                                  '/leaseTerm/value',
                                                schemaPath:
                                                  '#/$defs/durationField/properties/value/anyOf/0/type',
                                                keyword: 'type',
                                                params: { type: 'object' },
                                                message: 'must be object',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err54];
                                              } else {
                                                vErrors.push(err54);
                                              }
                                              errors++;
                                            }
                                          }
                                          var _valid12 = _errs223 === errors;
                                          valid51 = valid51 || _valid12;
                                          const _errs242 = errors;
                                          if (data79 !== null) {
                                            const err55 = {
                                              instancePath:
                                                instancePath +
                                                '/leaseTerm/value',
                                              schemaPath:
                                                '#/$defs/durationField/properties/value/anyOf/1/type',
                                              keyword: 'type',
                                              params: { type: 'null' },
                                              message: 'must be null',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err55];
                                            } else {
                                              vErrors.push(err55);
                                            }
                                            errors++;
                                          }
                                          var _valid12 = _errs242 === errors;
                                          valid51 = valid51 || _valid12;
                                          if (!valid51) {
                                            const err56 = {
                                              instancePath:
                                                instancePath +
                                                '/leaseTerm/value',
                                              schemaPath:
                                                '#/$defs/durationField/properties/value/anyOf',
                                              keyword: 'anyOf',
                                              params: {},
                                              message:
                                                'must match a schema in anyOf',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err56];
                                            } else {
                                              vErrors.push(err56);
                                            }
                                            errors++;
                                            validate22.errors = vErrors;
                                            return false;
                                          } else {
                                            errors = _errs222;
                                            if (vErrors !== null) {
                                              if (_errs222) {
                                                vErrors.length = _errs222;
                                              } else {
                                                vErrors = null;
                                              }
                                            }
                                          }
                                          var valid50 = _errs221 === errors;
                                        } else {
                                          var valid50 = true;
                                        }
                                        if (valid50) {
                                          if (data77.candidates !== undefined) {
                                            let data84 = data77.candidates;
                                            const _errs244 = errors;
                                            if (errors === _errs244) {
                                              if (Array.isArray(data84)) {
                                                var valid55 = true;
                                                const len20 = data84.length;
                                                for (
                                                  let i20 = 0;
                                                  i20 < len20;
                                                  i20++
                                                ) {
                                                  let data85 = data84[i20];
                                                  const _errs246 = errors;
                                                  if (errors === _errs246) {
                                                    if (
                                                      data85 &&
                                                      typeof data85 ==
                                                        'object' &&
                                                      !Array.isArray(data85)
                                                    ) {
                                                      let missing13;
                                                      if (
                                                        (data85.kind ===
                                                          undefined &&
                                                          (missing13 =
                                                            'kind')) ||
                                                        (data85.min ===
                                                          undefined &&
                                                          (missing13 =
                                                            'min')) ||
                                                        (data85.max ===
                                                          undefined &&
                                                          (missing13 =
                                                            'max')) ||
                                                        (data85.unit ===
                                                          undefined &&
                                                          (missing13 = 'unit'))
                                                      ) {
                                                        validate22.errors = [
                                                          {
                                                            instancePath:
                                                              instancePath +
                                                              '/leaseTerm/candidates/' +
                                                              i20,
                                                            schemaPath:
                                                              '#/$defs/durationField/properties/candidates/items/required',
                                                            keyword: 'required',
                                                            params: {
                                                              missingProperty:
                                                                missing13,
                                                            },
                                                            message:
                                                              "must have required property '" +
                                                              missing13 +
                                                              "'",
                                                          },
                                                        ];
                                                        return false;
                                                      } else {
                                                        const _errs248 = errors;
                                                        for (const key13 in data85) {
                                                          if (!(
                                                            key13 === 'kind' ||
                                                            key13 === 'min' ||
                                                            key13 === 'max' ||
                                                            key13 === 'unit'
                                                          )) {
                                                            validate22.errors =
                                                              [
                                                                {
                                                                  instancePath:
                                                                    instancePath +
                                                                    '/leaseTerm/candidates/' +
                                                                    i20,
                                                                  schemaPath:
                                                                    '#/$defs/durationField/properties/candidates/items/additionalProperties',
                                                                  keyword:
                                                                    'additionalProperties',
                                                                  params: {
                                                                    additionalProperty:
                                                                      key13,
                                                                  },
                                                                  message:
                                                                    'must NOT have additional properties',
                                                                },
                                                              ];
                                                            return false;
                                                            break;
                                                          }
                                                        }
                                                        if (
                                                          _errs248 === errors
                                                        ) {
                                                          if (
                                                            data85.kind !==
                                                            undefined
                                                          ) {
                                                            let data86 =
                                                              data85.kind;
                                                            const _errs249 =
                                                              errors;
                                                            if (
                                                              typeof data86 !==
                                                              'string'
                                                            ) {
                                                              validate22.errors =
                                                                [
                                                                  {
                                                                    instancePath:
                                                                      instancePath +
                                                                      '/leaseTerm/candidates/' +
                                                                      i20 +
                                                                      '/kind',
                                                                    schemaPath:
                                                                      '#/$defs/durationField/properties/candidates/items/properties/kind/type',
                                                                    keyword:
                                                                      'type',
                                                                    params: {
                                                                      type: 'string',
                                                                    },
                                                                    message:
                                                                      'must be string',
                                                                  },
                                                                ];
                                                              return false;
                                                            }
                                                            if (!(
                                                              data86 ===
                                                                'exact' ||
                                                              data86 === 'range'
                                                            )) {
                                                              validate22.errors =
                                                                [
                                                                  {
                                                                    instancePath:
                                                                      instancePath +
                                                                      '/leaseTerm/candidates/' +
                                                                      i20 +
                                                                      '/kind',
                                                                    schemaPath:
                                                                      '#/$defs/durationField/properties/candidates/items/properties/kind/enum',
                                                                    keyword:
                                                                      'enum',
                                                                    params: {
                                                                      allowedValues:
                                                                        schema49
                                                                          .properties
                                                                          .candidates
                                                                          .items
                                                                          .properties
                                                                          .kind
                                                                          .enum,
                                                                    },
                                                                    message:
                                                                      'must be equal to one of the allowed values',
                                                                  },
                                                                ];
                                                              return false;
                                                            }
                                                            var valid56 =
                                                              _errs249 ===
                                                              errors;
                                                          } else {
                                                            var valid56 = true;
                                                          }
                                                          if (valid56) {
                                                            if (
                                                              data85.min !==
                                                              undefined
                                                            ) {
                                                              let data87 =
                                                                data85.min;
                                                              const _errs251 =
                                                                errors;
                                                              const _errs252 =
                                                                errors;
                                                              let valid57 = false;
                                                              const _errs253 =
                                                                errors;
                                                              if (
                                                                !(
                                                                  typeof data87 ==
                                                                  'number'
                                                                )
                                                              ) {
                                                                const err57 = {
                                                                  instancePath:
                                                                    instancePath +
                                                                    '/leaseTerm/candidates/' +
                                                                    i20 +
                                                                    '/min',
                                                                  schemaPath:
                                                                    '#/$defs/durationField/properties/candidates/items/properties/min/anyOf/0/type',
                                                                  keyword:
                                                                    'type',
                                                                  params: {
                                                                    type: 'number',
                                                                  },
                                                                  message:
                                                                    'must be number',
                                                                };
                                                                if (
                                                                  vErrors ===
                                                                  null
                                                                ) {
                                                                  vErrors = [
                                                                    err57,
                                                                  ];
                                                                } else {
                                                                  vErrors.push(
                                                                    err57,
                                                                  );
                                                                }
                                                                errors++;
                                                              }
                                                              var _valid15 =
                                                                _errs253 ===
                                                                errors;
                                                              valid57 =
                                                                valid57 ||
                                                                _valid15;
                                                              const _errs255 =
                                                                errors;
                                                              if (
                                                                data87 !== null
                                                              ) {
                                                                const err58 = {
                                                                  instancePath:
                                                                    instancePath +
                                                                    '/leaseTerm/candidates/' +
                                                                    i20 +
                                                                    '/min',
                                                                  schemaPath:
                                                                    '#/$defs/durationField/properties/candidates/items/properties/min/anyOf/1/type',
                                                                  keyword:
                                                                    'type',
                                                                  params: {
                                                                    type: 'null',
                                                                  },
                                                                  message:
                                                                    'must be null',
                                                                };
                                                                if (
                                                                  vErrors ===
                                                                  null
                                                                ) {
                                                                  vErrors = [
                                                                    err58,
                                                                  ];
                                                                } else {
                                                                  vErrors.push(
                                                                    err58,
                                                                  );
                                                                }
                                                                errors++;
                                                              }
                                                              var _valid15 =
                                                                _errs255 ===
                                                                errors;
                                                              valid57 =
                                                                valid57 ||
                                                                _valid15;
                                                              if (!valid57) {
                                                                const err59 = {
                                                                  instancePath:
                                                                    instancePath +
                                                                    '/leaseTerm/candidates/' +
                                                                    i20 +
                                                                    '/min',
                                                                  schemaPath:
                                                                    '#/$defs/durationField/properties/candidates/items/properties/min/anyOf',
                                                                  keyword:
                                                                    'anyOf',
                                                                  params: {},
                                                                  message:
                                                                    'must match a schema in anyOf',
                                                                };
                                                                if (
                                                                  vErrors ===
                                                                  null
                                                                ) {
                                                                  vErrors = [
                                                                    err59,
                                                                  ];
                                                                } else {
                                                                  vErrors.push(
                                                                    err59,
                                                                  );
                                                                }
                                                                errors++;
                                                                validate22.errors =
                                                                  vErrors;
                                                                return false;
                                                              } else {
                                                                errors =
                                                                  _errs252;
                                                                if (
                                                                  vErrors !==
                                                                  null
                                                                ) {
                                                                  if (
                                                                    _errs252
                                                                  ) {
                                                                    vErrors.length =
                                                                      _errs252;
                                                                  } else {
                                                                    vErrors =
                                                                      null;
                                                                  }
                                                                }
                                                              }
                                                              var valid56 =
                                                                _errs251 ===
                                                                errors;
                                                            } else {
                                                              var valid56 = true;
                                                            }
                                                            if (valid56) {
                                                              if (
                                                                data85.max !==
                                                                undefined
                                                              ) {
                                                                let data88 =
                                                                  data85.max;
                                                                const _errs257 =
                                                                  errors;
                                                                const _errs258 =
                                                                  errors;
                                                                let valid58 = false;
                                                                const _errs259 =
                                                                  errors;
                                                                if (
                                                                  !(
                                                                    typeof data88 ==
                                                                    'number'
                                                                  )
                                                                ) {
                                                                  const err60 =
                                                                    {
                                                                      instancePath:
                                                                        instancePath +
                                                                        '/leaseTerm/candidates/' +
                                                                        i20 +
                                                                        '/max',
                                                                      schemaPath:
                                                                        '#/$defs/durationField/properties/candidates/items/properties/max/anyOf/0/type',
                                                                      keyword:
                                                                        'type',
                                                                      params: {
                                                                        type: 'number',
                                                                      },
                                                                      message:
                                                                        'must be number',
                                                                    };
                                                                  if (
                                                                    vErrors ===
                                                                    null
                                                                  ) {
                                                                    vErrors = [
                                                                      err60,
                                                                    ];
                                                                  } else {
                                                                    vErrors.push(
                                                                      err60,
                                                                    );
                                                                  }
                                                                  errors++;
                                                                }
                                                                var _valid16 =
                                                                  _errs259 ===
                                                                  errors;
                                                                valid58 =
                                                                  valid58 ||
                                                                  _valid16;
                                                                const _errs261 =
                                                                  errors;
                                                                if (
                                                                  data88 !==
                                                                  null
                                                                ) {
                                                                  const err61 =
                                                                    {
                                                                      instancePath:
                                                                        instancePath +
                                                                        '/leaseTerm/candidates/' +
                                                                        i20 +
                                                                        '/max',
                                                                      schemaPath:
                                                                        '#/$defs/durationField/properties/candidates/items/properties/max/anyOf/1/type',
                                                                      keyword:
                                                                        'type',
                                                                      params: {
                                                                        type: 'null',
                                                                      },
                                                                      message:
                                                                        'must be null',
                                                                    };
                                                                  if (
                                                                    vErrors ===
                                                                    null
                                                                  ) {
                                                                    vErrors = [
                                                                      err61,
                                                                    ];
                                                                  } else {
                                                                    vErrors.push(
                                                                      err61,
                                                                    );
                                                                  }
                                                                  errors++;
                                                                }
                                                                var _valid16 =
                                                                  _errs261 ===
                                                                  errors;
                                                                valid58 =
                                                                  valid58 ||
                                                                  _valid16;
                                                                if (!valid58) {
                                                                  const err62 =
                                                                    {
                                                                      instancePath:
                                                                        instancePath +
                                                                        '/leaseTerm/candidates/' +
                                                                        i20 +
                                                                        '/max',
                                                                      schemaPath:
                                                                        '#/$defs/durationField/properties/candidates/items/properties/max/anyOf',
                                                                      keyword:
                                                                        'anyOf',
                                                                      params:
                                                                        {},
                                                                      message:
                                                                        'must match a schema in anyOf',
                                                                    };
                                                                  if (
                                                                    vErrors ===
                                                                    null
                                                                  ) {
                                                                    vErrors = [
                                                                      err62,
                                                                    ];
                                                                  } else {
                                                                    vErrors.push(
                                                                      err62,
                                                                    );
                                                                  }
                                                                  errors++;
                                                                  validate22.errors =
                                                                    vErrors;
                                                                  return false;
                                                                } else {
                                                                  errors =
                                                                    _errs258;
                                                                  if (
                                                                    vErrors !==
                                                                    null
                                                                  ) {
                                                                    if (
                                                                      _errs258
                                                                    ) {
                                                                      vErrors.length =
                                                                        _errs258;
                                                                    } else {
                                                                      vErrors =
                                                                        null;
                                                                    }
                                                                  }
                                                                }
                                                                var valid56 =
                                                                  _errs257 ===
                                                                  errors;
                                                              } else {
                                                                var valid56 = true;
                                                              }
                                                              if (valid56) {
                                                                if (
                                                                  data85.unit !==
                                                                  undefined
                                                                ) {
                                                                  let data89 =
                                                                    data85.unit;
                                                                  const _errs263 =
                                                                    errors;
                                                                  if (
                                                                    typeof data89 !==
                                                                    'string'
                                                                  ) {
                                                                    validate22.errors =
                                                                      [
                                                                        {
                                                                          instancePath:
                                                                            instancePath +
                                                                            '/leaseTerm/candidates/' +
                                                                            i20 +
                                                                            '/unit',
                                                                          schemaPath:
                                                                            '#/$defs/durationField/properties/candidates/items/properties/unit/type',
                                                                          keyword:
                                                                            'type',
                                                                          params:
                                                                            {
                                                                              type: 'string',
                                                                            },
                                                                          message:
                                                                            'must be string',
                                                                        },
                                                                      ];
                                                                    return false;
                                                                  }
                                                                  if (!(
                                                                    data89 ===
                                                                      'months' ||
                                                                    data89 ===
                                                                      'weeks' ||
                                                                    data89 ===
                                                                      'days'
                                                                  )) {
                                                                    validate22.errors =
                                                                      [
                                                                        {
                                                                          instancePath:
                                                                            instancePath +
                                                                            '/leaseTerm/candidates/' +
                                                                            i20 +
                                                                            '/unit',
                                                                          schemaPath:
                                                                            '#/$defs/durationField/properties/candidates/items/properties/unit/enum',
                                                                          keyword:
                                                                            'enum',
                                                                          params:
                                                                            {
                                                                              allowedValues:
                                                                                schema49
                                                                                  .properties
                                                                                  .candidates
                                                                                  .items
                                                                                  .properties
                                                                                  .unit
                                                                                  .enum,
                                                                            },
                                                                          message:
                                                                            'must be equal to one of the allowed values',
                                                                        },
                                                                      ];
                                                                    return false;
                                                                  }
                                                                  var valid56 =
                                                                    _errs263 ===
                                                                    errors;
                                                                } else {
                                                                  var valid56 = true;
                                                                }
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    } else {
                                                      validate22.errors = [
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/leaseTerm/candidates/' +
                                                            i20,
                                                          schemaPath:
                                                            '#/$defs/durationField/properties/candidates/items/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'object',
                                                          },
                                                          message:
                                                            'must be object',
                                                        },
                                                      ];
                                                      return false;
                                                    }
                                                  }
                                                  var valid55 =
                                                    _errs246 === errors;
                                                  if (!valid55) {
                                                    break;
                                                  }
                                                }
                                              } else {
                                                validate22.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      '/leaseTerm/candidates',
                                                    schemaPath:
                                                      '#/$defs/durationField/properties/candidates/type',
                                                    keyword: 'type',
                                                    params: { type: 'array' },
                                                    message: 'must be array',
                                                  },
                                                ];
                                                return false;
                                              }
                                            }
                                            var valid50 = _errs244 === errors;
                                          } else {
                                            var valid50 = true;
                                          }
                                          if (valid50) {
                                            if (data77.scope !== undefined) {
                                              let data90 = data77.scope;
                                              const _errs265 = errors;
                                              if (typeof data90 !== 'string') {
                                                validate22.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      '/leaseTerm/scope',
                                                    schemaPath:
                                                      '#/$defs/durationField/properties/scope/type',
                                                    keyword: 'type',
                                                    params: { type: 'string' },
                                                    message: 'must be string',
                                                  },
                                                ];
                                                return false;
                                              }
                                              if (!(
                                                data90 === 'selected_unit' ||
                                                data90 === 'floor_plan' ||
                                                data90 === 'building' ||
                                                data90 === 'listing' ||
                                                data90 === 'unknown'
                                              )) {
                                                validate22.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      '/leaseTerm/scope',
                                                    schemaPath:
                                                      '#/$defs/durationField/properties/scope/enum',
                                                    keyword: 'enum',
                                                    params: {
                                                      allowedValues:
                                                        schema49.properties
                                                          .scope.enum,
                                                    },
                                                    message:
                                                      'must be equal to one of the allowed values',
                                                  },
                                                ];
                                                return false;
                                              }
                                              var valid50 = _errs265 === errors;
                                            } else {
                                              var valid50 = true;
                                            }
                                            if (valid50) {
                                              if (
                                                data77.evidenceIds !== undefined
                                              ) {
                                                let data91 = data77.evidenceIds;
                                                const _errs267 = errors;
                                                if (errors === _errs267) {
                                                  if (Array.isArray(data91)) {
                                                    var valid59 = true;
                                                    const len21 = data91.length;
                                                    for (
                                                      let i21 = 0;
                                                      i21 < len21;
                                                      i21++
                                                    ) {
                                                      const _errs269 = errors;
                                                      if (
                                                        typeof data91[i21] !==
                                                        'string'
                                                      ) {
                                                        validate22.errors = [
                                                          {
                                                            instancePath:
                                                              instancePath +
                                                              '/leaseTerm/evidenceIds/' +
                                                              i21,
                                                            schemaPath:
                                                              '#/$defs/durationField/properties/evidenceIds/items/type',
                                                            keyword: 'type',
                                                            params: {
                                                              type: 'string',
                                                            },
                                                            message:
                                                              'must be string',
                                                          },
                                                        ];
                                                        return false;
                                                      }
                                                      var valid59 =
                                                        _errs269 === errors;
                                                      if (!valid59) {
                                                        break;
                                                      }
                                                    }
                                                  } else {
                                                    validate22.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          '/leaseTerm/evidenceIds',
                                                        schemaPath:
                                                          '#/$defs/durationField/properties/evidenceIds/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'array',
                                                        },
                                                        message:
                                                          'must be array',
                                                      },
                                                    ];
                                                    return false;
                                                  }
                                                }
                                                var valid50 =
                                                  _errs267 === errors;
                                              } else {
                                                var valid50 = true;
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate22.errors = [
                                    {
                                      instancePath: instancePath + '/leaseTerm',
                                      schemaPath: '#/$defs/durationField/type',
                                      keyword: 'type',
                                      params: { type: 'object' },
                                      message: 'must be object',
                                    },
                                  ];
                                  return false;
                                }
                              }
                              var valid0 = _errs215 === errors;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.availableOn !== undefined) {
                                let data93 = data.availableOn;
                                const _errs271 = errors;
                                const _errs272 = errors;
                                if (errors === _errs272) {
                                  if (
                                    data93 &&
                                    typeof data93 == 'object' &&
                                    !Array.isArray(data93)
                                  ) {
                                    let missing14;
                                    if (
                                      (data93.status === undefined &&
                                        (missing14 = 'status')) ||
                                      (data93.value === undefined &&
                                        (missing14 = 'value')) ||
                                      (data93.candidates === undefined &&
                                        (missing14 = 'candidates')) ||
                                      (data93.scope === undefined &&
                                        (missing14 = 'scope')) ||
                                      (data93.evidenceIds === undefined &&
                                        (missing14 = 'evidenceIds'))
                                    ) {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath + '/availableOn',
                                          schemaPath:
                                            '#/$defs/dateField/required',
                                          keyword: 'required',
                                          params: {
                                            missingProperty: missing14,
                                          },
                                          message:
                                            "must have required property '" +
                                            missing14 +
                                            "'",
                                        },
                                      ];
                                      return false;
                                    } else {
                                      const _errs274 = errors;
                                      for (const key14 in data93) {
                                        if (!(
                                          key14 === 'status' ||
                                          key14 === 'value' ||
                                          key14 === 'candidates' ||
                                          key14 === 'scope' ||
                                          key14 === 'evidenceIds'
                                        )) {
                                          validate22.errors = [
                                            {
                                              instancePath:
                                                instancePath + '/availableOn',
                                              schemaPath:
                                                '#/$defs/dateField/additionalProperties',
                                              keyword: 'additionalProperties',
                                              params: {
                                                additionalProperty: key14,
                                              },
                                              message:
                                                'must NOT have additional properties',
                                            },
                                          ];
                                          return false;
                                          break;
                                        }
                                      }
                                      if (_errs274 === errors) {
                                        if (data93.status !== undefined) {
                                          let data94 = data93.status;
                                          const _errs275 = errors;
                                          if (typeof data94 !== 'string') {
                                            validate22.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/availableOn/status',
                                                schemaPath:
                                                  '#/$defs/dateField/properties/status/type',
                                                keyword: 'type',
                                                params: { type: 'string' },
                                                message: 'must be string',
                                              },
                                            ];
                                            return false;
                                          }
                                          if (!(
                                            data94 === 'known' ||
                                            data94 === 'unknown' ||
                                            data94 === 'not_applicable' ||
                                            data94 === 'conflict'
                                          )) {
                                            validate22.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  '/availableOn/status',
                                                schemaPath:
                                                  '#/$defs/dateField/properties/status/enum',
                                                keyword: 'enum',
                                                params: {
                                                  allowedValues:
                                                    schema50.properties.status
                                                      .enum,
                                                },
                                                message:
                                                  'must be equal to one of the allowed values',
                                              },
                                            ];
                                            return false;
                                          }
                                          var valid61 = _errs275 === errors;
                                        } else {
                                          var valid61 = true;
                                        }
                                        if (valid61) {
                                          if (data93.value !== undefined) {
                                            let data95 = data93.value;
                                            const _errs277 = errors;
                                            const _errs278 = errors;
                                            let valid62 = false;
                                            const _errs279 = errors;
                                            if (typeof data95 !== 'string') {
                                              const err63 = {
                                                instancePath:
                                                  instancePath +
                                                  '/availableOn/value',
                                                schemaPath:
                                                  '#/$defs/dateField/properties/value/anyOf/0/type',
                                                keyword: 'type',
                                                params: { type: 'string' },
                                                message: 'must be string',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err63];
                                              } else {
                                                vErrors.push(err63);
                                              }
                                              errors++;
                                            }
                                            var _valid17 = _errs279 === errors;
                                            valid62 = valid62 || _valid17;
                                            const _errs281 = errors;
                                            if (data95 !== null) {
                                              const err64 = {
                                                instancePath:
                                                  instancePath +
                                                  '/availableOn/value',
                                                schemaPath:
                                                  '#/$defs/dateField/properties/value/anyOf/1/type',
                                                keyword: 'type',
                                                params: { type: 'null' },
                                                message: 'must be null',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err64];
                                              } else {
                                                vErrors.push(err64);
                                              }
                                              errors++;
                                            }
                                            var _valid17 = _errs281 === errors;
                                            valid62 = valid62 || _valid17;
                                            if (!valid62) {
                                              const err65 = {
                                                instancePath:
                                                  instancePath +
                                                  '/availableOn/value',
                                                schemaPath:
                                                  '#/$defs/dateField/properties/value/anyOf',
                                                keyword: 'anyOf',
                                                params: {},
                                                message:
                                                  'must match a schema in anyOf',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err65];
                                              } else {
                                                vErrors.push(err65);
                                              }
                                              errors++;
                                              validate22.errors = vErrors;
                                              return false;
                                            } else {
                                              errors = _errs278;
                                              if (vErrors !== null) {
                                                if (_errs278) {
                                                  vErrors.length = _errs278;
                                                } else {
                                                  vErrors = null;
                                                }
                                              }
                                            }
                                            var valid61 = _errs277 === errors;
                                          } else {
                                            var valid61 = true;
                                          }
                                          if (valid61) {
                                            if (
                                              data93.candidates !== undefined
                                            ) {
                                              let data96 = data93.candidates;
                                              const _errs283 = errors;
                                              if (errors === _errs283) {
                                                if (Array.isArray(data96)) {
                                                  var valid63 = true;
                                                  const len22 = data96.length;
                                                  for (
                                                    let i22 = 0;
                                                    i22 < len22;
                                                    i22++
                                                  ) {
                                                    const _errs285 = errors;
                                                    if (
                                                      typeof data96[i22] !==
                                                      'string'
                                                    ) {
                                                      validate22.errors = [
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/availableOn/candidates/' +
                                                            i22,
                                                          schemaPath:
                                                            '#/$defs/dateField/properties/candidates/items/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'string',
                                                          },
                                                          message:
                                                            'must be string',
                                                        },
                                                      ];
                                                      return false;
                                                    }
                                                    var valid63 =
                                                      _errs285 === errors;
                                                    if (!valid63) {
                                                      break;
                                                    }
                                                  }
                                                } else {
                                                  validate22.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/availableOn/candidates',
                                                      schemaPath:
                                                        '#/$defs/dateField/properties/candidates/type',
                                                      keyword: 'type',
                                                      params: { type: 'array' },
                                                      message: 'must be array',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                              }
                                              var valid61 = _errs283 === errors;
                                            } else {
                                              var valid61 = true;
                                            }
                                            if (valid61) {
                                              if (data93.scope !== undefined) {
                                                let data98 = data93.scope;
                                                const _errs287 = errors;
                                                if (
                                                  typeof data98 !== 'string'
                                                ) {
                                                  validate22.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/availableOn/scope',
                                                      schemaPath:
                                                        '#/$defs/dateField/properties/scope/type',
                                                      keyword: 'type',
                                                      params: {
                                                        type: 'string',
                                                      },
                                                      message: 'must be string',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                                if (!(
                                                  data98 === 'selected_unit' ||
                                                  data98 === 'floor_plan' ||
                                                  data98 === 'building' ||
                                                  data98 === 'listing' ||
                                                  data98 === 'unknown'
                                                )) {
                                                  validate22.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/availableOn/scope',
                                                      schemaPath:
                                                        '#/$defs/dateField/properties/scope/enum',
                                                      keyword: 'enum',
                                                      params: {
                                                        allowedValues:
                                                          schema50.properties
                                                            .scope.enum,
                                                      },
                                                      message:
                                                        'must be equal to one of the allowed values',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                                var valid61 =
                                                  _errs287 === errors;
                                              } else {
                                                var valid61 = true;
                                              }
                                              if (valid61) {
                                                if (
                                                  data93.evidenceIds !==
                                                  undefined
                                                ) {
                                                  let data99 =
                                                    data93.evidenceIds;
                                                  const _errs289 = errors;
                                                  if (errors === _errs289) {
                                                    if (Array.isArray(data99)) {
                                                      var valid64 = true;
                                                      const len23 =
                                                        data99.length;
                                                      for (
                                                        let i23 = 0;
                                                        i23 < len23;
                                                        i23++
                                                      ) {
                                                        const _errs291 = errors;
                                                        if (
                                                          typeof data99[i23] !==
                                                          'string'
                                                        ) {
                                                          validate22.errors = [
                                                            {
                                                              instancePath:
                                                                instancePath +
                                                                '/availableOn/evidenceIds/' +
                                                                i23,
                                                              schemaPath:
                                                                '#/$defs/dateField/properties/evidenceIds/items/type',
                                                              keyword: 'type',
                                                              params: {
                                                                type: 'string',
                                                              },
                                                              message:
                                                                'must be string',
                                                            },
                                                          ];
                                                          return false;
                                                        }
                                                        var valid64 =
                                                          _errs291 === errors;
                                                        if (!valid64) {
                                                          break;
                                                        }
                                                      }
                                                    } else {
                                                      validate22.errors = [
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/availableOn/evidenceIds',
                                                          schemaPath:
                                                            '#/$defs/dateField/properties/evidenceIds/type',
                                                          keyword: 'type',
                                                          params: {
                                                            type: 'array',
                                                          },
                                                          message:
                                                            'must be array',
                                                        },
                                                      ];
                                                      return false;
                                                    }
                                                  }
                                                  var valid61 =
                                                    _errs289 === errors;
                                                } else {
                                                  var valid61 = true;
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    validate22.errors = [
                                      {
                                        instancePath:
                                          instancePath + '/availableOn',
                                        schemaPath: '#/$defs/dateField/type',
                                        keyword: 'type',
                                        params: { type: 'object' },
                                        message: 'must be object',
                                      },
                                    ];
                                    return false;
                                  }
                                }
                                var valid0 = _errs271 === errors;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.promotions !== undefined) {
                                  let data101 = data.promotions;
                                  const _errs293 = errors;
                                  if (errors === _errs293) {
                                    if (
                                      data101 &&
                                      typeof data101 == 'object' &&
                                      !Array.isArray(data101)
                                    ) {
                                      let missing15;
                                      if (
                                        (data101.status === undefined &&
                                          (missing15 = 'status')) ||
                                        (data101.value === undefined &&
                                          (missing15 = 'value')) ||
                                        (data101.candidates === undefined &&
                                          (missing15 = 'candidates')) ||
                                        (data101.scope === undefined &&
                                          (missing15 = 'scope')) ||
                                        (data101.evidenceIds === undefined &&
                                          (missing15 = 'evidenceIds'))
                                      ) {
                                        validate22.errors = [
                                          {
                                            instancePath:
                                              instancePath + '/promotions',
                                            schemaPath:
                                              '#/properties/promotions/required',
                                            keyword: 'required',
                                            params: {
                                              missingProperty: missing15,
                                            },
                                            message:
                                              "must have required property '" +
                                              missing15 +
                                              "'",
                                          },
                                        ];
                                        return false;
                                      } else {
                                        const _errs295 = errors;
                                        for (const key15 in data101) {
                                          if (!(
                                            key15 === 'status' ||
                                            key15 === 'value' ||
                                            key15 === 'candidates' ||
                                            key15 === 'scope' ||
                                            key15 === 'evidenceIds'
                                          )) {
                                            validate22.errors = [
                                              {
                                                instancePath:
                                                  instancePath + '/promotions',
                                                schemaPath:
                                                  '#/properties/promotions/additionalProperties',
                                                keyword: 'additionalProperties',
                                                params: {
                                                  additionalProperty: key15,
                                                },
                                                message:
                                                  'must NOT have additional properties',
                                              },
                                            ];
                                            return false;
                                            break;
                                          }
                                        }
                                        if (_errs295 === errors) {
                                          if (data101.status !== undefined) {
                                            let data102 = data101.status;
                                            const _errs296 = errors;
                                            if (typeof data102 !== 'string') {
                                              validate22.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/promotions/status',
                                                  schemaPath:
                                                    '#/properties/promotions/properties/status/type',
                                                  keyword: 'type',
                                                  params: { type: 'string' },
                                                  message: 'must be string',
                                                },
                                              ];
                                              return false;
                                            }
                                            if (!(
                                              data102 === 'known' ||
                                              data102 === 'unknown' ||
                                              data102 === 'not_applicable' ||
                                              data102 === 'conflict'
                                            )) {
                                              validate22.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/promotions/status',
                                                  schemaPath:
                                                    '#/properties/promotions/properties/status/enum',
                                                  keyword: 'enum',
                                                  params: {
                                                    allowedValues:
                                                      schema34.properties
                                                        .promotions.properties
                                                        .status.enum,
                                                  },
                                                  message:
                                                    'must be equal to one of the allowed values',
                                                },
                                              ];
                                              return false;
                                            }
                                            var valid65 = _errs296 === errors;
                                          } else {
                                            var valid65 = true;
                                          }
                                          if (valid65) {
                                            if (data101.value !== undefined) {
                                              let data103 = data101.value;
                                              const _errs298 = errors;
                                              const _errs299 = errors;
                                              let valid66 = false;
                                              const _errs300 = errors;
                                              if (errors === _errs300) {
                                                if (Array.isArray(data103)) {
                                                  var valid67 = true;
                                                  const len24 = data103.length;
                                                  for (
                                                    let i24 = 0;
                                                    i24 < len24;
                                                    i24++
                                                  ) {
                                                    const _errs302 = errors;
                                                    if (
                                                      !validate33(
                                                        data103[i24],
                                                        {
                                                          instancePath:
                                                            instancePath +
                                                            '/promotions/value/' +
                                                            i24,
                                                          parentData: data103,
                                                          parentDataProperty:
                                                            i24,
                                                          rootData,
                                                          dynamicAnchors,
                                                        },
                                                      )
                                                    ) {
                                                      vErrors =
                                                        vErrors === null
                                                          ? validate33.errors
                                                          : vErrors.concat(
                                                              validate33.errors,
                                                            );
                                                      errors = vErrors.length;
                                                    }
                                                    var valid67 =
                                                      _errs302 === errors;
                                                    if (!valid67) {
                                                      break;
                                                    }
                                                  }
                                                } else {
                                                  const err66 = {
                                                    instancePath:
                                                      instancePath +
                                                      '/promotions/value',
                                                    schemaPath:
                                                      '#/properties/promotions/properties/value/anyOf/0/type',
                                                    keyword: 'type',
                                                    params: { type: 'array' },
                                                    message: 'must be array',
                                                  };
                                                  if (vErrors === null) {
                                                    vErrors = [err66];
                                                  } else {
                                                    vErrors.push(err66);
                                                  }
                                                  errors++;
                                                }
                                              }
                                              var _valid18 =
                                                _errs300 === errors;
                                              valid66 = valid66 || _valid18;
                                              const _errs303 = errors;
                                              if (data103 !== null) {
                                                const err67 = {
                                                  instancePath:
                                                    instancePath +
                                                    '/promotions/value',
                                                  schemaPath:
                                                    '#/properties/promotions/properties/value/anyOf/1/type',
                                                  keyword: 'type',
                                                  params: { type: 'null' },
                                                  message: 'must be null',
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err67];
                                                } else {
                                                  vErrors.push(err67);
                                                }
                                                errors++;
                                              }
                                              var _valid18 =
                                                _errs303 === errors;
                                              valid66 = valid66 || _valid18;
                                              if (!valid66) {
                                                const err68 = {
                                                  instancePath:
                                                    instancePath +
                                                    '/promotions/value',
                                                  schemaPath:
                                                    '#/properties/promotions/properties/value/anyOf',
                                                  keyword: 'anyOf',
                                                  params: {},
                                                  message:
                                                    'must match a schema in anyOf',
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err68];
                                                } else {
                                                  vErrors.push(err68);
                                                }
                                                errors++;
                                                validate22.errors = vErrors;
                                                return false;
                                              } else {
                                                errors = _errs299;
                                                if (vErrors !== null) {
                                                  if (_errs299) {
                                                    vErrors.length = _errs299;
                                                  } else {
                                                    vErrors = null;
                                                  }
                                                }
                                              }
                                              var valid65 = _errs298 === errors;
                                            } else {
                                              var valid65 = true;
                                            }
                                            if (valid65) {
                                              if (
                                                data101.candidates !== undefined
                                              ) {
                                                let data105 =
                                                  data101.candidates;
                                                const _errs305 = errors;
                                                if (errors === _errs305) {
                                                  if (Array.isArray(data105)) {
                                                    var valid68 = true;
                                                    const len25 =
                                                      data105.length;
                                                    for (
                                                      let i25 = 0;
                                                      i25 < len25;
                                                      i25++
                                                    ) {
                                                      let data106 =
                                                        data105[i25];
                                                      const _errs307 = errors;
                                                      if (errors === _errs307) {
                                                        if (
                                                          Array.isArray(data106)
                                                        ) {
                                                          var valid69 = true;
                                                          const len26 =
                                                            data106.length;
                                                          for (
                                                            let i26 = 0;
                                                            i26 < len26;
                                                            i26++
                                                          ) {
                                                            const _errs309 =
                                                              errors;
                                                            if (
                                                              !validate33(
                                                                data106[i26],
                                                                {
                                                                  instancePath:
                                                                    instancePath +
                                                                    '/promotions/candidates/' +
                                                                    i25 +
                                                                    '/' +
                                                                    i26,
                                                                  parentData:
                                                                    data106,
                                                                  parentDataProperty:
                                                                    i26,
                                                                  rootData,
                                                                  dynamicAnchors,
                                                                },
                                                              )
                                                            ) {
                                                              vErrors =
                                                                vErrors === null
                                                                  ? validate33.errors
                                                                  : vErrors.concat(
                                                                      validate33.errors,
                                                                    );
                                                              errors =
                                                                vErrors.length;
                                                            }
                                                            var valid69 =
                                                              _errs309 ===
                                                              errors;
                                                            if (!valid69) {
                                                              break;
                                                            }
                                                          }
                                                        } else {
                                                          validate22.errors = [
                                                            {
                                                              instancePath:
                                                                instancePath +
                                                                '/promotions/candidates/' +
                                                                i25,
                                                              schemaPath:
                                                                '#/properties/promotions/properties/candidates/items/type',
                                                              keyword: 'type',
                                                              params: {
                                                                type: 'array',
                                                              },
                                                              message:
                                                                'must be array',
                                                            },
                                                          ];
                                                          return false;
                                                        }
                                                      }
                                                      var valid68 =
                                                        _errs307 === errors;
                                                      if (!valid68) {
                                                        break;
                                                      }
                                                    }
                                                  } else {
                                                    validate22.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          '/promotions/candidates',
                                                        schemaPath:
                                                          '#/properties/promotions/properties/candidates/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'array',
                                                        },
                                                        message:
                                                          'must be array',
                                                      },
                                                    ];
                                                    return false;
                                                  }
                                                }
                                                var valid65 =
                                                  _errs305 === errors;
                                              } else {
                                                var valid65 = true;
                                              }
                                              if (valid65) {
                                                if (
                                                  data101.scope !== undefined
                                                ) {
                                                  let data108 = data101.scope;
                                                  const _errs310 = errors;
                                                  if (
                                                    typeof data108 !== 'string'
                                                  ) {
                                                    validate22.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          '/promotions/scope',
                                                        schemaPath:
                                                          '#/properties/promotions/properties/scope/type',
                                                        keyword: 'type',
                                                        params: {
                                                          type: 'string',
                                                        },
                                                        message:
                                                          'must be string',
                                                      },
                                                    ];
                                                    return false;
                                                  }
                                                  if (!(
                                                    data108 ===
                                                      'selected_unit' ||
                                                    data108 === 'floor_plan' ||
                                                    data108 === 'building' ||
                                                    data108 === 'listing' ||
                                                    data108 === 'unknown'
                                                  )) {
                                                    validate22.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          '/promotions/scope',
                                                        schemaPath:
                                                          '#/properties/promotions/properties/scope/enum',
                                                        keyword: 'enum',
                                                        params: {
                                                          allowedValues:
                                                            schema34.properties
                                                              .promotions
                                                              .properties.scope
                                                              .enum,
                                                        },
                                                        message:
                                                          'must be equal to one of the allowed values',
                                                      },
                                                    ];
                                                    return false;
                                                  }
                                                  var valid65 =
                                                    _errs310 === errors;
                                                } else {
                                                  var valid65 = true;
                                                }
                                                if (valid65) {
                                                  if (
                                                    data101.evidenceIds !==
                                                    undefined
                                                  ) {
                                                    let data109 =
                                                      data101.evidenceIds;
                                                    const _errs312 = errors;
                                                    if (errors === _errs312) {
                                                      if (
                                                        Array.isArray(data109)
                                                      ) {
                                                        var valid70 = true;
                                                        const len27 =
                                                          data109.length;
                                                        for (
                                                          let i27 = 0;
                                                          i27 < len27;
                                                          i27++
                                                        ) {
                                                          const _errs314 =
                                                            errors;
                                                          if (
                                                            typeof data109[
                                                              i27
                                                            ] !== 'string'
                                                          ) {
                                                            validate22.errors =
                                                              [
                                                                {
                                                                  instancePath:
                                                                    instancePath +
                                                                    '/promotions/evidenceIds/' +
                                                                    i27,
                                                                  schemaPath:
                                                                    '#/properties/promotions/properties/evidenceIds/items/type',
                                                                  keyword:
                                                                    'type',
                                                                  params: {
                                                                    type: 'string',
                                                                  },
                                                                  message:
                                                                    'must be string',
                                                                },
                                                              ];
                                                            return false;
                                                          }
                                                          var valid70 =
                                                            _errs314 === errors;
                                                          if (!valid70) {
                                                            break;
                                                          }
                                                        }
                                                      } else {
                                                        validate22.errors = [
                                                          {
                                                            instancePath:
                                                              instancePath +
                                                              '/promotions/evidenceIds',
                                                            schemaPath:
                                                              '#/properties/promotions/properties/evidenceIds/type',
                                                            keyword: 'type',
                                                            params: {
                                                              type: 'array',
                                                            },
                                                            message:
                                                              'must be array',
                                                          },
                                                        ];
                                                        return false;
                                                      }
                                                    }
                                                    var valid65 =
                                                      _errs312 === errors;
                                                  } else {
                                                    var valid65 = true;
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    } else {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath + '/promotions',
                                          schemaPath:
                                            '#/properties/promotions/type',
                                          keyword: 'type',
                                          params: { type: 'object' },
                                          message: 'must be object',
                                        },
                                      ];
                                      return false;
                                    }
                                  }
                                  var valid0 = _errs293 === errors;
                                } else {
                                  var valid0 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate22.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate22.errors = vErrors;
  return errors === 0;
}
validate22.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate21(
  data,
  {
    instancePath = '',
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate21.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (
        (data.property === undefined && (missing0 = 'property')) ||
        (data.evidence === undefined && (missing0 = 'evidence')) ||
        (data.notes === undefined && (missing0 = 'notes')) ||
        (data.reviewIssues === undefined && (missing0 = 'reviewIssues'))
      ) {
        validate21.errors = [
          {
            instancePath,
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(
            key0 === 'property' ||
            key0 === 'evidence' ||
            key0 === 'notes' ||
            key0 === 'reviewIssues'
          )) {
            validate21.errors = [
              {
                instancePath,
                schemaPath: '#/additionalProperties',
                keyword: 'additionalProperties',
                params: { additionalProperty: key0 },
                message: 'must NOT have additional properties',
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.property !== undefined) {
            const _errs2 = errors;
            if (
              !validate22(data.property, {
                instancePath: instancePath + '/property',
                parentData: data,
                parentDataProperty: 'property',
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate22.errors
                  : vErrors.concat(validate22.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.evidence !== undefined) {
              let data1 = data.evidence;
              const _errs3 = errors;
              if (errors === _errs3) {
                if (Array.isArray(data1)) {
                  var valid1 = true;
                  const len0 = data1.length;
                  for (let i0 = 0; i0 < len0; i0++) {
                    let data2 = data1[i0];
                    const _errs5 = errors;
                    const _errs6 = errors;
                    if (errors === _errs6) {
                      if (
                        data2 &&
                        typeof data2 == 'object' &&
                        !Array.isArray(data2)
                      ) {
                        let missing1;
                        if (
                          (data2.id === undefined && (missing1 = 'id')) ||
                          (data2.blockId === undefined &&
                            (missing1 = 'blockId')) ||
                          (data2.quote === undefined && (missing1 = 'quote'))
                        ) {
                          validate21.errors = [
                            {
                              instancePath: instancePath + '/evidence/' + i0,
                              schemaPath: '#/$defs/evidence/required',
                              keyword: 'required',
                              params: { missingProperty: missing1 },
                              message:
                                "must have required property '" +
                                missing1 +
                                "'",
                            },
                          ];
                          return false;
                        } else {
                          const _errs8 = errors;
                          for (const key1 in data2) {
                            if (!(
                              key1 === 'id' ||
                              key1 === 'blockId' ||
                              key1 === 'quote'
                            )) {
                              validate21.errors = [
                                {
                                  instancePath:
                                    instancePath + '/evidence/' + i0,
                                  schemaPath:
                                    '#/$defs/evidence/additionalProperties',
                                  keyword: 'additionalProperties',
                                  params: { additionalProperty: key1 },
                                  message:
                                    'must NOT have additional properties',
                                },
                              ];
                              return false;
                              break;
                            }
                          }
                          if (_errs8 === errors) {
                            if (data2.id !== undefined) {
                              const _errs9 = errors;
                              if (typeof data2.id !== 'string') {
                                validate21.errors = [
                                  {
                                    instancePath:
                                      instancePath + '/evidence/' + i0 + '/id',
                                    schemaPath:
                                      '#/$defs/evidence/properties/id/type',
                                    keyword: 'type',
                                    params: { type: 'string' },
                                    message: 'must be string',
                                  },
                                ];
                                return false;
                              }
                              var valid3 = _errs9 === errors;
                            } else {
                              var valid3 = true;
                            }
                            if (valid3) {
                              if (data2.blockId !== undefined) {
                                const _errs11 = errors;
                                if (typeof data2.blockId !== 'string') {
                                  validate21.errors = [
                                    {
                                      instancePath:
                                        instancePath +
                                        '/evidence/' +
                                        i0 +
                                        '/blockId',
                                      schemaPath:
                                        '#/$defs/evidence/properties/blockId/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    },
                                  ];
                                  return false;
                                }
                                var valid3 = _errs11 === errors;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (data2.quote !== undefined) {
                                  const _errs13 = errors;
                                  if (typeof data2.quote !== 'string') {
                                    validate21.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          '/evidence/' +
                                          i0 +
                                          '/quote',
                                        schemaPath:
                                          '#/$defs/evidence/properties/quote/type',
                                        keyword: 'type',
                                        params: { type: 'string' },
                                        message: 'must be string',
                                      },
                                    ];
                                    return false;
                                  }
                                  var valid3 = _errs13 === errors;
                                } else {
                                  var valid3 = true;
                                }
                              }
                            }
                          }
                        }
                      } else {
                        validate21.errors = [
                          {
                            instancePath: instancePath + '/evidence/' + i0,
                            schemaPath: '#/$defs/evidence/type',
                            keyword: 'type',
                            params: { type: 'object' },
                            message: 'must be object',
                          },
                        ];
                        return false;
                      }
                    }
                    var valid1 = _errs5 === errors;
                    if (!valid1) {
                      break;
                    }
                  }
                } else {
                  validate21.errors = [
                    {
                      instancePath: instancePath + '/evidence',
                      schemaPath: '#/properties/evidence/type',
                      keyword: 'type',
                      params: { type: 'array' },
                      message: 'must be array',
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.notes !== undefined) {
                let data6 = data.notes;
                const _errs15 = errors;
                if (errors === _errs15) {
                  if (Array.isArray(data6)) {
                    var valid4 = true;
                    const len1 = data6.length;
                    for (let i1 = 0; i1 < len1; i1++) {
                      let data7 = data6[i1];
                      const _errs17 = errors;
                      const _errs18 = errors;
                      if (errors === _errs18) {
                        if (
                          data7 &&
                          typeof data7 == 'object' &&
                          !Array.isArray(data7)
                        ) {
                          let missing2;
                          if (
                            (data7.id === undefined && (missing2 = 'id')) ||
                            (data7.fieldPaths === undefined &&
                              (missing2 = 'fieldPaths')) ||
                            (data7.text === undefined && (missing2 = 'text')) ||
                            (data7.evidenceIds === undefined &&
                              (missing2 = 'evidenceIds'))
                          ) {
                            validate21.errors = [
                              {
                                instancePath: instancePath + '/notes/' + i1,
                                schemaPath: '#/$defs/note/required',
                                keyword: 'required',
                                params: { missingProperty: missing2 },
                                message:
                                  "must have required property '" +
                                  missing2 +
                                  "'",
                              },
                            ];
                            return false;
                          } else {
                            const _errs20 = errors;
                            for (const key2 in data7) {
                              if (!(
                                key2 === 'id' ||
                                key2 === 'fieldPaths' ||
                                key2 === 'text' ||
                                key2 === 'evidenceIds'
                              )) {
                                validate21.errors = [
                                  {
                                    instancePath: instancePath + '/notes/' + i1,
                                    schemaPath:
                                      '#/$defs/note/additionalProperties',
                                    keyword: 'additionalProperties',
                                    params: { additionalProperty: key2 },
                                    message:
                                      'must NOT have additional properties',
                                  },
                                ];
                                return false;
                                break;
                              }
                            }
                            if (_errs20 === errors) {
                              if (data7.id !== undefined) {
                                const _errs21 = errors;
                                if (typeof data7.id !== 'string') {
                                  validate21.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/notes/' + i1 + '/id',
                                      schemaPath:
                                        '#/$defs/note/properties/id/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    },
                                  ];
                                  return false;
                                }
                                var valid6 = _errs21 === errors;
                              } else {
                                var valid6 = true;
                              }
                              if (valid6) {
                                if (data7.fieldPaths !== undefined) {
                                  let data9 = data7.fieldPaths;
                                  const _errs23 = errors;
                                  if (errors === _errs23) {
                                    if (Array.isArray(data9)) {
                                      var valid7 = true;
                                      const len2 = data9.length;
                                      for (let i2 = 0; i2 < len2; i2++) {
                                        const _errs25 = errors;
                                        if (typeof data9[i2] !== 'string') {
                                          validate21.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/notes/' +
                                                i1 +
                                                '/fieldPaths/' +
                                                i2,
                                              schemaPath:
                                                '#/$defs/note/properties/fieldPaths/items/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid7 = _errs25 === errors;
                                        if (!valid7) {
                                          break;
                                        }
                                      }
                                    } else {
                                      validate21.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/notes/' +
                                            i1 +
                                            '/fieldPaths',
                                          schemaPath:
                                            '#/$defs/note/properties/fieldPaths/type',
                                          keyword: 'type',
                                          params: { type: 'array' },
                                          message: 'must be array',
                                        },
                                      ];
                                      return false;
                                    }
                                  }
                                  var valid6 = _errs23 === errors;
                                } else {
                                  var valid6 = true;
                                }
                                if (valid6) {
                                  if (data7.text !== undefined) {
                                    const _errs27 = errors;
                                    if (typeof data7.text !== 'string') {
                                      validate21.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/notes/' +
                                            i1 +
                                            '/text',
                                          schemaPath:
                                            '#/$defs/note/properties/text/type',
                                          keyword: 'type',
                                          params: { type: 'string' },
                                          message: 'must be string',
                                        },
                                      ];
                                      return false;
                                    }
                                    var valid6 = _errs27 === errors;
                                  } else {
                                    var valid6 = true;
                                  }
                                  if (valid6) {
                                    if (data7.evidenceIds !== undefined) {
                                      let data12 = data7.evidenceIds;
                                      const _errs29 = errors;
                                      if (errors === _errs29) {
                                        if (Array.isArray(data12)) {
                                          var valid8 = true;
                                          const len3 = data12.length;
                                          for (let i3 = 0; i3 < len3; i3++) {
                                            const _errs31 = errors;
                                            if (
                                              typeof data12[i3] !== 'string'
                                            ) {
                                              validate21.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/notes/' +
                                                    i1 +
                                                    '/evidenceIds/' +
                                                    i3,
                                                  schemaPath:
                                                    '#/$defs/note/properties/evidenceIds/items/type',
                                                  keyword: 'type',
                                                  params: { type: 'string' },
                                                  message: 'must be string',
                                                },
                                              ];
                                              return false;
                                            }
                                            var valid8 = _errs31 === errors;
                                            if (!valid8) {
                                              break;
                                            }
                                          }
                                        } else {
                                          validate21.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/notes/' +
                                                i1 +
                                                '/evidenceIds',
                                              schemaPath:
                                                '#/$defs/note/properties/evidenceIds/type',
                                              keyword: 'type',
                                              params: { type: 'array' },
                                              message: 'must be array',
                                            },
                                          ];
                                          return false;
                                        }
                                      }
                                      var valid6 = _errs29 === errors;
                                    } else {
                                      var valid6 = true;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate21.errors = [
                            {
                              instancePath: instancePath + '/notes/' + i1,
                              schemaPath: '#/$defs/note/type',
                              keyword: 'type',
                              params: { type: 'object' },
                              message: 'must be object',
                            },
                          ];
                          return false;
                        }
                      }
                      var valid4 = _errs17 === errors;
                      if (!valid4) {
                        break;
                      }
                    }
                  } else {
                    validate21.errors = [
                      {
                        instancePath: instancePath + '/notes',
                        schemaPath: '#/properties/notes/type',
                        keyword: 'type',
                        params: { type: 'array' },
                        message: 'must be array',
                      },
                    ];
                    return false;
                  }
                }
                var valid0 = _errs15 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.reviewIssues !== undefined) {
                  let data14 = data.reviewIssues;
                  const _errs33 = errors;
                  if (errors === _errs33) {
                    if (Array.isArray(data14)) {
                      var valid9 = true;
                      const len4 = data14.length;
                      for (let i4 = 0; i4 < len4; i4++) {
                        let data15 = data14[i4];
                        const _errs35 = errors;
                        const _errs36 = errors;
                        if (errors === _errs36) {
                          if (
                            data15 &&
                            typeof data15 == 'object' &&
                            !Array.isArray(data15)
                          ) {
                            let missing3;
                            if (
                              (data15.id === undefined && (missing3 = 'id')) ||
                              (data15.code === undefined &&
                                (missing3 = 'code')) ||
                              (data15.fieldPaths === undefined &&
                                (missing3 = 'fieldPaths')) ||
                              (data15.message === undefined &&
                                (missing3 = 'message')) ||
                              (data15.evidenceIds === undefined &&
                                (missing3 = 'evidenceIds'))
                            ) {
                              validate21.errors = [
                                {
                                  instancePath:
                                    instancePath + '/reviewIssues/' + i4,
                                  schemaPath: '#/$defs/issue/required',
                                  keyword: 'required',
                                  params: { missingProperty: missing3 },
                                  message:
                                    "must have required property '" +
                                    missing3 +
                                    "'",
                                },
                              ];
                              return false;
                            } else {
                              const _errs38 = errors;
                              for (const key3 in data15) {
                                if (!(
                                  key3 === 'id' ||
                                  key3 === 'code' ||
                                  key3 === 'fieldPaths' ||
                                  key3 === 'message' ||
                                  key3 === 'evidenceIds'
                                )) {
                                  validate21.errors = [
                                    {
                                      instancePath:
                                        instancePath + '/reviewIssues/' + i4,
                                      schemaPath:
                                        '#/$defs/issue/additionalProperties',
                                      keyword: 'additionalProperties',
                                      params: { additionalProperty: key3 },
                                      message:
                                        'must NOT have additional properties',
                                    },
                                  ];
                                  return false;
                                  break;
                                }
                              }
                              if (_errs38 === errors) {
                                if (data15.id !== undefined) {
                                  const _errs39 = errors;
                                  if (typeof data15.id !== 'string') {
                                    validate21.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          '/reviewIssues/' +
                                          i4 +
                                          '/id',
                                        schemaPath:
                                          '#/$defs/issue/properties/id/type',
                                        keyword: 'type',
                                        params: { type: 'string' },
                                        message: 'must be string',
                                      },
                                    ];
                                    return false;
                                  }
                                  var valid11 = _errs39 === errors;
                                } else {
                                  var valid11 = true;
                                }
                                if (valid11) {
                                  if (data15.code !== undefined) {
                                    let data17 = data15.code;
                                    const _errs41 = errors;
                                    if (typeof data17 !== 'string') {
                                      validate21.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/reviewIssues/' +
                                            i4 +
                                            '/code',
                                          schemaPath:
                                            '#/$defs/issue/properties/code/type',
                                          keyword: 'type',
                                          params: { type: 'string' },
                                          message: 'must be string',
                                        },
                                      ];
                                      return false;
                                    }
                                    if (!(
                                      data17 === 'UNKNOWN_VALUE' ||
                                      data17 === 'CONFLICTING_VALUES' ||
                                      data17 === 'RENT_RANGE' ||
                                      data17 === 'CONDITIONAL_CHARGE' ||
                                      data17 === 'PROMOTION_CONDITIONS' ||
                                      data17 === 'UNIT_SCOPE_UNCERTAIN' ||
                                      data17 === 'SOURCE_INCOMPLETE'
                                    )) {
                                      validate21.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            '/reviewIssues/' +
                                            i4 +
                                            '/code',
                                          schemaPath:
                                            '#/$defs/issue/properties/code/enum',
                                          keyword: 'enum',
                                          params: {
                                            allowedValues:
                                              schema59.properties.code.enum,
                                          },
                                          message:
                                            'must be equal to one of the allowed values',
                                        },
                                      ];
                                      return false;
                                    }
                                    var valid11 = _errs41 === errors;
                                  } else {
                                    var valid11 = true;
                                  }
                                  if (valid11) {
                                    if (data15.fieldPaths !== undefined) {
                                      let data18 = data15.fieldPaths;
                                      const _errs43 = errors;
                                      if (errors === _errs43) {
                                        if (Array.isArray(data18)) {
                                          var valid12 = true;
                                          const len5 = data18.length;
                                          for (let i5 = 0; i5 < len5; i5++) {
                                            const _errs45 = errors;
                                            if (
                                              typeof data18[i5] !== 'string'
                                            ) {
                                              validate21.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/reviewIssues/' +
                                                    i4 +
                                                    '/fieldPaths/' +
                                                    i5,
                                                  schemaPath:
                                                    '#/$defs/issue/properties/fieldPaths/items/type',
                                                  keyword: 'type',
                                                  params: { type: 'string' },
                                                  message: 'must be string',
                                                },
                                              ];
                                              return false;
                                            }
                                            var valid12 = _errs45 === errors;
                                            if (!valid12) {
                                              break;
                                            }
                                          }
                                        } else {
                                          validate21.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/reviewIssues/' +
                                                i4 +
                                                '/fieldPaths',
                                              schemaPath:
                                                '#/$defs/issue/properties/fieldPaths/type',
                                              keyword: 'type',
                                              params: { type: 'array' },
                                              message: 'must be array',
                                            },
                                          ];
                                          return false;
                                        }
                                      }
                                      var valid11 = _errs43 === errors;
                                    } else {
                                      var valid11 = true;
                                    }
                                    if (valid11) {
                                      if (data15.message !== undefined) {
                                        const _errs47 = errors;
                                        if (
                                          typeof data15.message !== 'string'
                                        ) {
                                          validate21.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                '/reviewIssues/' +
                                                i4 +
                                                '/message',
                                              schemaPath:
                                                '#/$defs/issue/properties/message/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid11 = _errs47 === errors;
                                      } else {
                                        var valid11 = true;
                                      }
                                      if (valid11) {
                                        if (data15.evidenceIds !== undefined) {
                                          let data21 = data15.evidenceIds;
                                          const _errs49 = errors;
                                          if (errors === _errs49) {
                                            if (Array.isArray(data21)) {
                                              var valid13 = true;
                                              const len6 = data21.length;
                                              for (
                                                let i6 = 0;
                                                i6 < len6;
                                                i6++
                                              ) {
                                                const _errs51 = errors;
                                                if (
                                                  typeof data21[i6] !== 'string'
                                                ) {
                                                  validate21.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        '/reviewIssues/' +
                                                        i4 +
                                                        '/evidenceIds/' +
                                                        i6,
                                                      schemaPath:
                                                        '#/$defs/issue/properties/evidenceIds/items/type',
                                                      keyword: 'type',
                                                      params: {
                                                        type: 'string',
                                                      },
                                                      message: 'must be string',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                                var valid13 =
                                                  _errs51 === errors;
                                                if (!valid13) {
                                                  break;
                                                }
                                              }
                                            } else {
                                              validate21.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    '/reviewIssues/' +
                                                    i4 +
                                                    '/evidenceIds',
                                                  schemaPath:
                                                    '#/$defs/issue/properties/evidenceIds/type',
                                                  keyword: 'type',
                                                  params: { type: 'array' },
                                                  message: 'must be array',
                                                },
                                              ];
                                              return false;
                                            }
                                          }
                                          var valid11 = _errs49 === errors;
                                        } else {
                                          var valid11 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          } else {
                            validate21.errors = [
                              {
                                instancePath:
                                  instancePath + '/reviewIssues/' + i4,
                                schemaPath: '#/$defs/issue/type',
                                keyword: 'type',
                                params: { type: 'object' },
                                message: 'must be object',
                              },
                            ];
                            return false;
                          }
                        }
                        var valid9 = _errs35 === errors;
                        if (!valid9) {
                          break;
                        }
                      }
                    } else {
                      validate21.errors = [
                        {
                          instancePath: instancePath + '/reviewIssues',
                          schemaPath: '#/properties/reviewIssues/type',
                          keyword: 'type',
                          params: { type: 'array' },
                          message: 'must be array',
                        },
                      ];
                      return false;
                    }
                  }
                  var valid0 = _errs33 === errors;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate21.errors = [
        {
          instancePath,
          schemaPath: '#/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
        },
      ];
      return false;
    }
  }
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate20(
  data,
  {
    instancePath = '',
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  /*# sourceURL="urn:rentsight:extraction:1.0.0:response" */ let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  const _errs0 = errors;
  let valid0 = false;
  const _errs1 = errors;
  if (errors === _errs1) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing0;
      if (
        (data.schemaVersion === undefined && (missing0 = 'schemaVersion')) ||
        (data.status === undefined && (missing0 = 'status')) ||
        (data.identity === undefined && (missing0 = 'identity')) ||
        (data.metadata === undefined && (missing0 = 'metadata')) ||
        (data.result === undefined && (missing0 = 'result'))
      ) {
        const err0 = {
          instancePath,
          schemaPath: '#/anyOf/0/required',
          keyword: 'required',
          params: { missingProperty: missing0 },
          message: "must have required property '" + missing0 + "'",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      } else {
        const _errs3 = errors;
        for (const key0 in data) {
          if (!(
            key0 === 'schemaVersion' ||
            key0 === 'status' ||
            key0 === 'identity' ||
            key0 === 'metadata' ||
            key0 === 'result'
          )) {
            const err1 = {
              instancePath,
              schemaPath: '#/anyOf/0/additionalProperties',
              keyword: 'additionalProperties',
              params: { additionalProperty: key0 },
              message: 'must NOT have additional properties',
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
            break;
          }
        }
        if (_errs3 === errors) {
          if (data.schemaVersion !== undefined) {
            let data0 = data.schemaVersion;
            const _errs4 = errors;
            if (typeof data0 !== 'string') {
              const err2 = {
                instancePath: instancePath + '/schemaVersion',
                schemaPath: '#/anyOf/0/properties/schemaVersion/type',
                keyword: 'type',
                params: { type: 'string' },
                message: 'must be string',
              };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors++;
            }
            if (!(data0 === '1.0.0')) {
              const err3 = {
                instancePath: instancePath + '/schemaVersion',
                schemaPath: '#/anyOf/0/properties/schemaVersion/enum',
                keyword: 'enum',
                params: {
                  allowedValues:
                    schema31.anyOf[0].properties.schemaVersion.enum,
                },
                message: 'must be equal to one of the allowed values',
              };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors++;
            }
            var valid1 = _errs4 === errors;
          } else {
            var valid1 = true;
          }
          if (valid1) {
            if (data.status !== undefined) {
              let data1 = data.status;
              const _errs6 = errors;
              if (typeof data1 !== 'string') {
                const err4 = {
                  instancePath: instancePath + '/status',
                  schemaPath: '#/anyOf/0/properties/status/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                };
                if (vErrors === null) {
                  vErrors = [err4];
                } else {
                  vErrors.push(err4);
                }
                errors++;
              }
              if (!(data1 === 'succeeded')) {
                const err5 = {
                  instancePath: instancePath + '/status',
                  schemaPath: '#/anyOf/0/properties/status/enum',
                  keyword: 'enum',
                  params: {
                    allowedValues: schema31.anyOf[0].properties.status.enum,
                  },
                  message: 'must be equal to one of the allowed values',
                };
                if (vErrors === null) {
                  vErrors = [err5];
                } else {
                  vErrors.push(err5);
                }
                errors++;
              }
              var valid1 = _errs6 === errors;
            } else {
              var valid1 = true;
            }
            if (valid1) {
              if (data.identity !== undefined) {
                let data2 = data.identity;
                const _errs8 = errors;
                const _errs9 = errors;
                if (errors === _errs9) {
                  if (
                    data2 &&
                    typeof data2 == 'object' &&
                    !Array.isArray(data2)
                  ) {
                    let missing1;
                    if (
                      (data2.requestId === undefined &&
                        (missing1 = 'requestId')) ||
                      (data2.captureRevision === undefined &&
                        (missing1 = 'captureRevision')) ||
                      (data2.listingUrl === undefined &&
                        (missing1 = 'listingUrl')) ||
                      (data2.selectedUnit === undefined &&
                        (missing1 = 'selectedUnit')) ||
                      (data2.selectedLeaseTermMonths === undefined &&
                        (missing1 = 'selectedLeaseTermMonths'))
                    ) {
                      const err6 = {
                        instancePath: instancePath + '/identity',
                        schemaPath: '#/$defs/identity/required',
                        keyword: 'required',
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      };
                      if (vErrors === null) {
                        vErrors = [err6];
                      } else {
                        vErrors.push(err6);
                      }
                      errors++;
                    } else {
                      const _errs11 = errors;
                      for (const key1 in data2) {
                        if (!(
                          key1 === 'requestId' ||
                          key1 === 'captureRevision' ||
                          key1 === 'listingUrl' ||
                          key1 === 'selectedUnit' ||
                          key1 === 'selectedLeaseTermMonths'
                        )) {
                          const err7 = {
                            instancePath: instancePath + '/identity',
                            schemaPath: '#/$defs/identity/additionalProperties',
                            keyword: 'additionalProperties',
                            params: { additionalProperty: key1 },
                            message: 'must NOT have additional properties',
                          };
                          if (vErrors === null) {
                            vErrors = [err7];
                          } else {
                            vErrors.push(err7);
                          }
                          errors++;
                          break;
                        }
                      }
                      if (_errs11 === errors) {
                        if (data2.requestId !== undefined) {
                          const _errs12 = errors;
                          if (typeof data2.requestId !== 'string') {
                            const err8 = {
                              instancePath:
                                instancePath + '/identity/requestId',
                              schemaPath:
                                '#/$defs/identity/properties/requestId/type',
                              keyword: 'type',
                              params: { type: 'string' },
                              message: 'must be string',
                            };
                            if (vErrors === null) {
                              vErrors = [err8];
                            } else {
                              vErrors.push(err8);
                            }
                            errors++;
                          }
                          var valid3 = _errs12 === errors;
                        } else {
                          var valid3 = true;
                        }
                        if (valid3) {
                          if (data2.captureRevision !== undefined) {
                            const _errs14 = errors;
                            if (typeof data2.captureRevision !== 'string') {
                              const err9 = {
                                instancePath:
                                  instancePath + '/identity/captureRevision',
                                schemaPath:
                                  '#/$defs/identity/properties/captureRevision/type',
                                keyword: 'type',
                                params: { type: 'string' },
                                message: 'must be string',
                              };
                              if (vErrors === null) {
                                vErrors = [err9];
                              } else {
                                vErrors.push(err9);
                              }
                              errors++;
                            }
                            var valid3 = _errs14 === errors;
                          } else {
                            var valid3 = true;
                          }
                          if (valid3) {
                            if (data2.listingUrl !== undefined) {
                              const _errs16 = errors;
                              if (typeof data2.listingUrl !== 'string') {
                                const err10 = {
                                  instancePath:
                                    instancePath + '/identity/listingUrl',
                                  schemaPath:
                                    '#/$defs/identity/properties/listingUrl/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                };
                                if (vErrors === null) {
                                  vErrors = [err10];
                                } else {
                                  vErrors.push(err10);
                                }
                                errors++;
                              }
                              var valid3 = _errs16 === errors;
                            } else {
                              var valid3 = true;
                            }
                            if (valid3) {
                              if (data2.selectedUnit !== undefined) {
                                let data6 = data2.selectedUnit;
                                const _errs18 = errors;
                                const _errs19 = errors;
                                let valid4 = false;
                                const _errs20 = errors;
                                if (errors === _errs20) {
                                  if (
                                    data6 &&
                                    typeof data6 == 'object' &&
                                    !Array.isArray(data6)
                                  ) {
                                    let missing2;
                                    if (
                                      (data6.id === undefined &&
                                        (missing2 = 'id')) ||
                                      (data6.label === undefined &&
                                        (missing2 = 'label'))
                                    ) {
                                      const err11 = {
                                        instancePath:
                                          instancePath +
                                          '/identity/selectedUnit',
                                        schemaPath:
                                          '#/$defs/identity/properties/selectedUnit/anyOf/0/required',
                                        keyword: 'required',
                                        params: { missingProperty: missing2 },
                                        message:
                                          "must have required property '" +
                                          missing2 +
                                          "'",
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err11];
                                      } else {
                                        vErrors.push(err11);
                                      }
                                      errors++;
                                    } else {
                                      const _errs22 = errors;
                                      for (const key2 in data6) {
                                        if (!(
                                          key2 === 'id' || key2 === 'label'
                                        )) {
                                          const err12 = {
                                            instancePath:
                                              instancePath +
                                              '/identity/selectedUnit',
                                            schemaPath:
                                              '#/$defs/identity/properties/selectedUnit/anyOf/0/additionalProperties',
                                            keyword: 'additionalProperties',
                                            params: {
                                              additionalProperty: key2,
                                            },
                                            message:
                                              'must NOT have additional properties',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err12];
                                          } else {
                                            vErrors.push(err12);
                                          }
                                          errors++;
                                          break;
                                        }
                                      }
                                      if (_errs22 === errors) {
                                        if (data6.id !== undefined) {
                                          let data7 = data6.id;
                                          const _errs23 = errors;
                                          const _errs24 = errors;
                                          let valid6 = false;
                                          const _errs25 = errors;
                                          if (typeof data7 !== 'string') {
                                            const err13 = {
                                              instancePath:
                                                instancePath +
                                                '/identity/selectedUnit/id',
                                              schemaPath:
                                                '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/id/anyOf/0/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err13];
                                            } else {
                                              vErrors.push(err13);
                                            }
                                            errors++;
                                          }
                                          var _valid2 = _errs25 === errors;
                                          valid6 = valid6 || _valid2;
                                          const _errs27 = errors;
                                          if (data7 !== null) {
                                            const err14 = {
                                              instancePath:
                                                instancePath +
                                                '/identity/selectedUnit/id',
                                              schemaPath:
                                                '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/id/anyOf/1/type',
                                              keyword: 'type',
                                              params: { type: 'null' },
                                              message: 'must be null',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err14];
                                            } else {
                                              vErrors.push(err14);
                                            }
                                            errors++;
                                          }
                                          var _valid2 = _errs27 === errors;
                                          valid6 = valid6 || _valid2;
                                          if (!valid6) {
                                            const err15 = {
                                              instancePath:
                                                instancePath +
                                                '/identity/selectedUnit/id',
                                              schemaPath:
                                                '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/id/anyOf',
                                              keyword: 'anyOf',
                                              params: {},
                                              message:
                                                'must match a schema in anyOf',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err15];
                                            } else {
                                              vErrors.push(err15);
                                            }
                                            errors++;
                                          } else {
                                            errors = _errs24;
                                            if (vErrors !== null) {
                                              if (_errs24) {
                                                vErrors.length = _errs24;
                                              } else {
                                                vErrors = null;
                                              }
                                            }
                                          }
                                          var valid5 = _errs23 === errors;
                                        } else {
                                          var valid5 = true;
                                        }
                                        if (valid5) {
                                          if (data6.label !== undefined) {
                                            const _errs29 = errors;
                                            if (
                                              typeof data6.label !== 'string'
                                            ) {
                                              const err16 = {
                                                instancePath:
                                                  instancePath +
                                                  '/identity/selectedUnit/label',
                                                schemaPath:
                                                  '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/label/type',
                                                keyword: 'type',
                                                params: { type: 'string' },
                                                message: 'must be string',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err16];
                                              } else {
                                                vErrors.push(err16);
                                              }
                                              errors++;
                                            }
                                            var valid5 = _errs29 === errors;
                                          } else {
                                            var valid5 = true;
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    const err17 = {
                                      instancePath:
                                        instancePath + '/identity/selectedUnit',
                                      schemaPath:
                                        '#/$defs/identity/properties/selectedUnit/anyOf/0/type',
                                      keyword: 'type',
                                      params: { type: 'object' },
                                      message: 'must be object',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err17];
                                    } else {
                                      vErrors.push(err17);
                                    }
                                    errors++;
                                  }
                                }
                                var _valid1 = _errs20 === errors;
                                valid4 = valid4 || _valid1;
                                const _errs31 = errors;
                                if (data6 !== null) {
                                  const err18 = {
                                    instancePath:
                                      instancePath + '/identity/selectedUnit',
                                    schemaPath:
                                      '#/$defs/identity/properties/selectedUnit/anyOf/1/type',
                                    keyword: 'type',
                                    params: { type: 'null' },
                                    message: 'must be null',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err18];
                                  } else {
                                    vErrors.push(err18);
                                  }
                                  errors++;
                                }
                                var _valid1 = _errs31 === errors;
                                valid4 = valid4 || _valid1;
                                if (!valid4) {
                                  const err19 = {
                                    instancePath:
                                      instancePath + '/identity/selectedUnit',
                                    schemaPath:
                                      '#/$defs/identity/properties/selectedUnit/anyOf',
                                    keyword: 'anyOf',
                                    params: {},
                                    message: 'must match a schema in anyOf',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err19];
                                  } else {
                                    vErrors.push(err19);
                                  }
                                  errors++;
                                } else {
                                  errors = _errs19;
                                  if (vErrors !== null) {
                                    if (_errs19) {
                                      vErrors.length = _errs19;
                                    } else {
                                      vErrors = null;
                                    }
                                  }
                                }
                                var valid3 = _errs18 === errors;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (
                                  data2.selectedLeaseTermMonths !== undefined
                                ) {
                                  let data9 = data2.selectedLeaseTermMonths;
                                  const _errs33 = errors;
                                  const _errs34 = errors;
                                  let valid7 = false;
                                  const _errs35 = errors;
                                  if (!(typeof data9 == 'number')) {
                                    const err20 = {
                                      instancePath:
                                        instancePath +
                                        '/identity/selectedLeaseTermMonths',
                                      schemaPath:
                                        '#/$defs/identity/properties/selectedLeaseTermMonths/anyOf/0/type',
                                      keyword: 'type',
                                      params: { type: 'number' },
                                      message: 'must be number',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err20];
                                    } else {
                                      vErrors.push(err20);
                                    }
                                    errors++;
                                  }
                                  var _valid3 = _errs35 === errors;
                                  valid7 = valid7 || _valid3;
                                  const _errs37 = errors;
                                  if (data9 !== null) {
                                    const err21 = {
                                      instancePath:
                                        instancePath +
                                        '/identity/selectedLeaseTermMonths',
                                      schemaPath:
                                        '#/$defs/identity/properties/selectedLeaseTermMonths/anyOf/1/type',
                                      keyword: 'type',
                                      params: { type: 'null' },
                                      message: 'must be null',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err21];
                                    } else {
                                      vErrors.push(err21);
                                    }
                                    errors++;
                                  }
                                  var _valid3 = _errs37 === errors;
                                  valid7 = valid7 || _valid3;
                                  if (!valid7) {
                                    const err22 = {
                                      instancePath:
                                        instancePath +
                                        '/identity/selectedLeaseTermMonths',
                                      schemaPath:
                                        '#/$defs/identity/properties/selectedLeaseTermMonths/anyOf',
                                      keyword: 'anyOf',
                                      params: {},
                                      message: 'must match a schema in anyOf',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err22];
                                    } else {
                                      vErrors.push(err22);
                                    }
                                    errors++;
                                  } else {
                                    errors = _errs34;
                                    if (vErrors !== null) {
                                      if (_errs34) {
                                        vErrors.length = _errs34;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid3 = _errs33 === errors;
                                } else {
                                  var valid3 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    const err23 = {
                      instancePath: instancePath + '/identity',
                      schemaPath: '#/$defs/identity/type',
                      keyword: 'type',
                      params: { type: 'object' },
                      message: 'must be object',
                    };
                    if (vErrors === null) {
                      vErrors = [err23];
                    } else {
                      vErrors.push(err23);
                    }
                    errors++;
                  }
                }
                var valid1 = _errs8 === errors;
              } else {
                var valid1 = true;
              }
              if (valid1) {
                if (data.metadata !== undefined) {
                  let data10 = data.metadata;
                  const _errs39 = errors;
                  if (errors === _errs39) {
                    if (
                      data10 &&
                      typeof data10 == 'object' &&
                      !Array.isArray(data10)
                    ) {
                      let missing3;
                      if (
                        (data10.extractionId === undefined &&
                          (missing3 = 'extractionId')) ||
                        (data10.capturedAt === undefined &&
                          (missing3 = 'capturedAt')) ||
                        (data10.completedAt === undefined &&
                          (missing3 = 'completedAt')) ||
                        (data10.promptVersion === undefined &&
                          (missing3 = 'promptVersion')) ||
                        (data10.model === undefined && (missing3 = 'model')) ||
                        (data10.captureSha256 === undefined &&
                          (missing3 = 'captureSha256'))
                      ) {
                        const err24 = {
                          instancePath: instancePath + '/metadata',
                          schemaPath: '#/anyOf/0/properties/metadata/required',
                          keyword: 'required',
                          params: { missingProperty: missing3 },
                          message:
                            "must have required property '" + missing3 + "'",
                        };
                        if (vErrors === null) {
                          vErrors = [err24];
                        } else {
                          vErrors.push(err24);
                        }
                        errors++;
                      } else {
                        const _errs41 = errors;
                        for (const key3 in data10) {
                          if (!(
                            key3 === 'extractionId' ||
                            key3 === 'capturedAt' ||
                            key3 === 'completedAt' ||
                            key3 === 'promptVersion' ||
                            key3 === 'model' ||
                            key3 === 'captureSha256'
                          )) {
                            const err25 = {
                              instancePath: instancePath + '/metadata',
                              schemaPath:
                                '#/anyOf/0/properties/metadata/additionalProperties',
                              keyword: 'additionalProperties',
                              params: { additionalProperty: key3 },
                              message: 'must NOT have additional properties',
                            };
                            if (vErrors === null) {
                              vErrors = [err25];
                            } else {
                              vErrors.push(err25);
                            }
                            errors++;
                            break;
                          }
                        }
                        if (_errs41 === errors) {
                          if (data10.extractionId !== undefined) {
                            const _errs42 = errors;
                            if (typeof data10.extractionId !== 'string') {
                              const err26 = {
                                instancePath:
                                  instancePath + '/metadata/extractionId',
                                schemaPath:
                                  '#/anyOf/0/properties/metadata/properties/extractionId/type',
                                keyword: 'type',
                                params: { type: 'string' },
                                message: 'must be string',
                              };
                              if (vErrors === null) {
                                vErrors = [err26];
                              } else {
                                vErrors.push(err26);
                              }
                              errors++;
                            }
                            var valid8 = _errs42 === errors;
                          } else {
                            var valid8 = true;
                          }
                          if (valid8) {
                            if (data10.capturedAt !== undefined) {
                              const _errs44 = errors;
                              if (typeof data10.capturedAt !== 'string') {
                                const err27 = {
                                  instancePath:
                                    instancePath + '/metadata/capturedAt',
                                  schemaPath:
                                    '#/anyOf/0/properties/metadata/properties/capturedAt/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                };
                                if (vErrors === null) {
                                  vErrors = [err27];
                                } else {
                                  vErrors.push(err27);
                                }
                                errors++;
                              }
                              var valid8 = _errs44 === errors;
                            } else {
                              var valid8 = true;
                            }
                            if (valid8) {
                              if (data10.completedAt !== undefined) {
                                const _errs46 = errors;
                                if (typeof data10.completedAt !== 'string') {
                                  const err28 = {
                                    instancePath:
                                      instancePath + '/metadata/completedAt',
                                    schemaPath:
                                      '#/anyOf/0/properties/metadata/properties/completedAt/type',
                                    keyword: 'type',
                                    params: { type: 'string' },
                                    message: 'must be string',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err28];
                                  } else {
                                    vErrors.push(err28);
                                  }
                                  errors++;
                                }
                                var valid8 = _errs46 === errors;
                              } else {
                                var valid8 = true;
                              }
                              if (valid8) {
                                if (data10.promptVersion !== undefined) {
                                  const _errs48 = errors;
                                  if (
                                    typeof data10.promptVersion !== 'string'
                                  ) {
                                    const err29 = {
                                      instancePath:
                                        instancePath +
                                        '/metadata/promptVersion',
                                      schemaPath:
                                        '#/anyOf/0/properties/metadata/properties/promptVersion/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err29];
                                    } else {
                                      vErrors.push(err29);
                                    }
                                    errors++;
                                  }
                                  var valid8 = _errs48 === errors;
                                } else {
                                  var valid8 = true;
                                }
                                if (valid8) {
                                  if (data10.model !== undefined) {
                                    const _errs50 = errors;
                                    if (typeof data10.model !== 'string') {
                                      const err30 = {
                                        instancePath:
                                          instancePath + '/metadata/model',
                                        schemaPath:
                                          '#/anyOf/0/properties/metadata/properties/model/type',
                                        keyword: 'type',
                                        params: { type: 'string' },
                                        message: 'must be string',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err30];
                                      } else {
                                        vErrors.push(err30);
                                      }
                                      errors++;
                                    }
                                    var valid8 = _errs50 === errors;
                                  } else {
                                    var valid8 = true;
                                  }
                                  if (valid8) {
                                    if (data10.captureSha256 !== undefined) {
                                      const _errs52 = errors;
                                      if (
                                        typeof data10.captureSha256 !== 'string'
                                      ) {
                                        const err31 = {
                                          instancePath:
                                            instancePath +
                                            '/metadata/captureSha256',
                                          schemaPath:
                                            '#/anyOf/0/properties/metadata/properties/captureSha256/type',
                                          keyword: 'type',
                                          params: { type: 'string' },
                                          message: 'must be string',
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err31];
                                        } else {
                                          vErrors.push(err31);
                                        }
                                        errors++;
                                      }
                                      var valid8 = _errs52 === errors;
                                    } else {
                                      var valid8 = true;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    } else {
                      const err32 = {
                        instancePath: instancePath + '/metadata',
                        schemaPath: '#/anyOf/0/properties/metadata/type',
                        keyword: 'type',
                        params: { type: 'object' },
                        message: 'must be object',
                      };
                      if (vErrors === null) {
                        vErrors = [err32];
                      } else {
                        vErrors.push(err32);
                      }
                      errors++;
                    }
                  }
                  var valid1 = _errs39 === errors;
                } else {
                  var valid1 = true;
                }
                if (valid1) {
                  if (data.result !== undefined) {
                    const _errs54 = errors;
                    if (
                      !validate21(data.result, {
                        instancePath: instancePath + '/result',
                        parentData: data,
                        parentDataProperty: 'result',
                        rootData,
                        dynamicAnchors,
                      })
                    ) {
                      vErrors =
                        vErrors === null
                          ? validate21.errors
                          : vErrors.concat(validate21.errors);
                      errors = vErrors.length;
                    }
                    var valid1 = _errs54 === errors;
                  } else {
                    var valid1 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      const err33 = {
        instancePath,
        schemaPath: '#/anyOf/0/type',
        keyword: 'type',
        params: { type: 'object' },
        message: 'must be object',
      };
      if (vErrors === null) {
        vErrors = [err33];
      } else {
        vErrors.push(err33);
      }
      errors++;
    }
  }
  var _valid0 = _errs1 === errors;
  valid0 = valid0 || _valid0;
  if (_valid0) {
    var props1 = true;
  }
  const _errs55 = errors;
  if (errors === _errs55) {
    if (data && typeof data == 'object' && !Array.isArray(data)) {
      let missing4;
      if (
        (data.schemaVersion === undefined && (missing4 = 'schemaVersion')) ||
        (data.status === undefined && (missing4 = 'status')) ||
        (data.identity === undefined && (missing4 = 'identity')) ||
        (data.error === undefined && (missing4 = 'error'))
      ) {
        const err34 = {
          instancePath,
          schemaPath: '#/anyOf/1/required',
          keyword: 'required',
          params: { missingProperty: missing4 },
          message: "must have required property '" + missing4 + "'",
        };
        if (vErrors === null) {
          vErrors = [err34];
        } else {
          vErrors.push(err34);
        }
        errors++;
      } else {
        const _errs57 = errors;
        for (const key4 in data) {
          if (!(
            key4 === 'schemaVersion' ||
            key4 === 'status' ||
            key4 === 'identity' ||
            key4 === 'error'
          )) {
            const err35 = {
              instancePath,
              schemaPath: '#/anyOf/1/additionalProperties',
              keyword: 'additionalProperties',
              params: { additionalProperty: key4 },
              message: 'must NOT have additional properties',
            };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors++;
            break;
          }
        }
        if (_errs57 === errors) {
          if (data.schemaVersion !== undefined) {
            let data18 = data.schemaVersion;
            const _errs58 = errors;
            if (typeof data18 !== 'string') {
              const err36 = {
                instancePath: instancePath + '/schemaVersion',
                schemaPath: '#/anyOf/1/properties/schemaVersion/type',
                keyword: 'type',
                params: { type: 'string' },
                message: 'must be string',
              };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
            if (!(data18 === '1.0.0')) {
              const err37 = {
                instancePath: instancePath + '/schemaVersion',
                schemaPath: '#/anyOf/1/properties/schemaVersion/enum',
                keyword: 'enum',
                params: {
                  allowedValues:
                    schema31.anyOf[1].properties.schemaVersion.enum,
                },
                message: 'must be equal to one of the allowed values',
              };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
            var valid9 = _errs58 === errors;
          } else {
            var valid9 = true;
          }
          if (valid9) {
            if (data.status !== undefined) {
              let data19 = data.status;
              const _errs60 = errors;
              if (typeof data19 !== 'string') {
                const err38 = {
                  instancePath: instancePath + '/status',
                  schemaPath: '#/anyOf/1/properties/status/type',
                  keyword: 'type',
                  params: { type: 'string' },
                  message: 'must be string',
                };
                if (vErrors === null) {
                  vErrors = [err38];
                } else {
                  vErrors.push(err38);
                }
                errors++;
              }
              if (!(data19 === 'failed')) {
                const err39 = {
                  instancePath: instancePath + '/status',
                  schemaPath: '#/anyOf/1/properties/status/enum',
                  keyword: 'enum',
                  params: {
                    allowedValues: schema31.anyOf[1].properties.status.enum,
                  },
                  message: 'must be equal to one of the allowed values',
                };
                if (vErrors === null) {
                  vErrors = [err39];
                } else {
                  vErrors.push(err39);
                }
                errors++;
              }
              var valid9 = _errs60 === errors;
            } else {
              var valid9 = true;
            }
            if (valid9) {
              if (data.identity !== undefined) {
                let data20 = data.identity;
                const _errs62 = errors;
                const _errs63 = errors;
                let valid10 = false;
                const _errs64 = errors;
                const _errs65 = errors;
                if (errors === _errs65) {
                  if (
                    data20 &&
                    typeof data20 == 'object' &&
                    !Array.isArray(data20)
                  ) {
                    let missing5;
                    if (
                      (data20.requestId === undefined &&
                        (missing5 = 'requestId')) ||
                      (data20.captureRevision === undefined &&
                        (missing5 = 'captureRevision')) ||
                      (data20.listingUrl === undefined &&
                        (missing5 = 'listingUrl')) ||
                      (data20.selectedUnit === undefined &&
                        (missing5 = 'selectedUnit')) ||
                      (data20.selectedLeaseTermMonths === undefined &&
                        (missing5 = 'selectedLeaseTermMonths'))
                    ) {
                      const err40 = {
                        instancePath: instancePath + '/identity',
                        schemaPath: '#/$defs/identity/required',
                        keyword: 'required',
                        params: { missingProperty: missing5 },
                        message:
                          "must have required property '" + missing5 + "'",
                      };
                      if (vErrors === null) {
                        vErrors = [err40];
                      } else {
                        vErrors.push(err40);
                      }
                      errors++;
                    } else {
                      const _errs67 = errors;
                      for (const key5 in data20) {
                        if (!(
                          key5 === 'requestId' ||
                          key5 === 'captureRevision' ||
                          key5 === 'listingUrl' ||
                          key5 === 'selectedUnit' ||
                          key5 === 'selectedLeaseTermMonths'
                        )) {
                          const err41 = {
                            instancePath: instancePath + '/identity',
                            schemaPath: '#/$defs/identity/additionalProperties',
                            keyword: 'additionalProperties',
                            params: { additionalProperty: key5 },
                            message: 'must NOT have additional properties',
                          };
                          if (vErrors === null) {
                            vErrors = [err41];
                          } else {
                            vErrors.push(err41);
                          }
                          errors++;
                          break;
                        }
                      }
                      if (_errs67 === errors) {
                        if (data20.requestId !== undefined) {
                          const _errs68 = errors;
                          if (typeof data20.requestId !== 'string') {
                            const err42 = {
                              instancePath:
                                instancePath + '/identity/requestId',
                              schemaPath:
                                '#/$defs/identity/properties/requestId/type',
                              keyword: 'type',
                              params: { type: 'string' },
                              message: 'must be string',
                            };
                            if (vErrors === null) {
                              vErrors = [err42];
                            } else {
                              vErrors.push(err42);
                            }
                            errors++;
                          }
                          var valid12 = _errs68 === errors;
                        } else {
                          var valid12 = true;
                        }
                        if (valid12) {
                          if (data20.captureRevision !== undefined) {
                            const _errs70 = errors;
                            if (typeof data20.captureRevision !== 'string') {
                              const err43 = {
                                instancePath:
                                  instancePath + '/identity/captureRevision',
                                schemaPath:
                                  '#/$defs/identity/properties/captureRevision/type',
                                keyword: 'type',
                                params: { type: 'string' },
                                message: 'must be string',
                              };
                              if (vErrors === null) {
                                vErrors = [err43];
                              } else {
                                vErrors.push(err43);
                              }
                              errors++;
                            }
                            var valid12 = _errs70 === errors;
                          } else {
                            var valid12 = true;
                          }
                          if (valid12) {
                            if (data20.listingUrl !== undefined) {
                              const _errs72 = errors;
                              if (typeof data20.listingUrl !== 'string') {
                                const err44 = {
                                  instancePath:
                                    instancePath + '/identity/listingUrl',
                                  schemaPath:
                                    '#/$defs/identity/properties/listingUrl/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                };
                                if (vErrors === null) {
                                  vErrors = [err44];
                                } else {
                                  vErrors.push(err44);
                                }
                                errors++;
                              }
                              var valid12 = _errs72 === errors;
                            } else {
                              var valid12 = true;
                            }
                            if (valid12) {
                              if (data20.selectedUnit !== undefined) {
                                let data24 = data20.selectedUnit;
                                const _errs74 = errors;
                                const _errs75 = errors;
                                let valid13 = false;
                                const _errs76 = errors;
                                if (errors === _errs76) {
                                  if (
                                    data24 &&
                                    typeof data24 == 'object' &&
                                    !Array.isArray(data24)
                                  ) {
                                    let missing6;
                                    if (
                                      (data24.id === undefined &&
                                        (missing6 = 'id')) ||
                                      (data24.label === undefined &&
                                        (missing6 = 'label'))
                                    ) {
                                      const err45 = {
                                        instancePath:
                                          instancePath +
                                          '/identity/selectedUnit',
                                        schemaPath:
                                          '#/$defs/identity/properties/selectedUnit/anyOf/0/required',
                                        keyword: 'required',
                                        params: { missingProperty: missing6 },
                                        message:
                                          "must have required property '" +
                                          missing6 +
                                          "'",
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err45];
                                      } else {
                                        vErrors.push(err45);
                                      }
                                      errors++;
                                    } else {
                                      const _errs78 = errors;
                                      for (const key6 in data24) {
                                        if (!(
                                          key6 === 'id' || key6 === 'label'
                                        )) {
                                          const err46 = {
                                            instancePath:
                                              instancePath +
                                              '/identity/selectedUnit',
                                            schemaPath:
                                              '#/$defs/identity/properties/selectedUnit/anyOf/0/additionalProperties',
                                            keyword: 'additionalProperties',
                                            params: {
                                              additionalProperty: key6,
                                            },
                                            message:
                                              'must NOT have additional properties',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err46];
                                          } else {
                                            vErrors.push(err46);
                                          }
                                          errors++;
                                          break;
                                        }
                                      }
                                      if (_errs78 === errors) {
                                        if (data24.id !== undefined) {
                                          let data25 = data24.id;
                                          const _errs79 = errors;
                                          const _errs80 = errors;
                                          let valid15 = false;
                                          const _errs81 = errors;
                                          if (typeof data25 !== 'string') {
                                            const err47 = {
                                              instancePath:
                                                instancePath +
                                                '/identity/selectedUnit/id',
                                              schemaPath:
                                                '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/id/anyOf/0/type',
                                              keyword: 'type',
                                              params: { type: 'string' },
                                              message: 'must be string',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err47];
                                            } else {
                                              vErrors.push(err47);
                                            }
                                            errors++;
                                          }
                                          var _valid6 = _errs81 === errors;
                                          valid15 = valid15 || _valid6;
                                          const _errs83 = errors;
                                          if (data25 !== null) {
                                            const err48 = {
                                              instancePath:
                                                instancePath +
                                                '/identity/selectedUnit/id',
                                              schemaPath:
                                                '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/id/anyOf/1/type',
                                              keyword: 'type',
                                              params: { type: 'null' },
                                              message: 'must be null',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err48];
                                            } else {
                                              vErrors.push(err48);
                                            }
                                            errors++;
                                          }
                                          var _valid6 = _errs83 === errors;
                                          valid15 = valid15 || _valid6;
                                          if (!valid15) {
                                            const err49 = {
                                              instancePath:
                                                instancePath +
                                                '/identity/selectedUnit/id',
                                              schemaPath:
                                                '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/id/anyOf',
                                              keyword: 'anyOf',
                                              params: {},
                                              message:
                                                'must match a schema in anyOf',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err49];
                                            } else {
                                              vErrors.push(err49);
                                            }
                                            errors++;
                                          } else {
                                            errors = _errs80;
                                            if (vErrors !== null) {
                                              if (_errs80) {
                                                vErrors.length = _errs80;
                                              } else {
                                                vErrors = null;
                                              }
                                            }
                                          }
                                          var valid14 = _errs79 === errors;
                                        } else {
                                          var valid14 = true;
                                        }
                                        if (valid14) {
                                          if (data24.label !== undefined) {
                                            const _errs85 = errors;
                                            if (
                                              typeof data24.label !== 'string'
                                            ) {
                                              const err50 = {
                                                instancePath:
                                                  instancePath +
                                                  '/identity/selectedUnit/label',
                                                schemaPath:
                                                  '#/$defs/identity/properties/selectedUnit/anyOf/0/properties/label/type',
                                                keyword: 'type',
                                                params: { type: 'string' },
                                                message: 'must be string',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err50];
                                              } else {
                                                vErrors.push(err50);
                                              }
                                              errors++;
                                            }
                                            var valid14 = _errs85 === errors;
                                          } else {
                                            var valid14 = true;
                                          }
                                        }
                                      }
                                    }
                                  } else {
                                    const err51 = {
                                      instancePath:
                                        instancePath + '/identity/selectedUnit',
                                      schemaPath:
                                        '#/$defs/identity/properties/selectedUnit/anyOf/0/type',
                                      keyword: 'type',
                                      params: { type: 'object' },
                                      message: 'must be object',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err51];
                                    } else {
                                      vErrors.push(err51);
                                    }
                                    errors++;
                                  }
                                }
                                var _valid5 = _errs76 === errors;
                                valid13 = valid13 || _valid5;
                                const _errs87 = errors;
                                if (data24 !== null) {
                                  const err52 = {
                                    instancePath:
                                      instancePath + '/identity/selectedUnit',
                                    schemaPath:
                                      '#/$defs/identity/properties/selectedUnit/anyOf/1/type',
                                    keyword: 'type',
                                    params: { type: 'null' },
                                    message: 'must be null',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err52];
                                  } else {
                                    vErrors.push(err52);
                                  }
                                  errors++;
                                }
                                var _valid5 = _errs87 === errors;
                                valid13 = valid13 || _valid5;
                                if (!valid13) {
                                  const err53 = {
                                    instancePath:
                                      instancePath + '/identity/selectedUnit',
                                    schemaPath:
                                      '#/$defs/identity/properties/selectedUnit/anyOf',
                                    keyword: 'anyOf',
                                    params: {},
                                    message: 'must match a schema in anyOf',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err53];
                                  } else {
                                    vErrors.push(err53);
                                  }
                                  errors++;
                                } else {
                                  errors = _errs75;
                                  if (vErrors !== null) {
                                    if (_errs75) {
                                      vErrors.length = _errs75;
                                    } else {
                                      vErrors = null;
                                    }
                                  }
                                }
                                var valid12 = _errs74 === errors;
                              } else {
                                var valid12 = true;
                              }
                              if (valid12) {
                                if (
                                  data20.selectedLeaseTermMonths !== undefined
                                ) {
                                  let data27 = data20.selectedLeaseTermMonths;
                                  const _errs89 = errors;
                                  const _errs90 = errors;
                                  let valid16 = false;
                                  const _errs91 = errors;
                                  if (!(typeof data27 == 'number')) {
                                    const err54 = {
                                      instancePath:
                                        instancePath +
                                        '/identity/selectedLeaseTermMonths',
                                      schemaPath:
                                        '#/$defs/identity/properties/selectedLeaseTermMonths/anyOf/0/type',
                                      keyword: 'type',
                                      params: { type: 'number' },
                                      message: 'must be number',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err54];
                                    } else {
                                      vErrors.push(err54);
                                    }
                                    errors++;
                                  }
                                  var _valid7 = _errs91 === errors;
                                  valid16 = valid16 || _valid7;
                                  const _errs93 = errors;
                                  if (data27 !== null) {
                                    const err55 = {
                                      instancePath:
                                        instancePath +
                                        '/identity/selectedLeaseTermMonths',
                                      schemaPath:
                                        '#/$defs/identity/properties/selectedLeaseTermMonths/anyOf/1/type',
                                      keyword: 'type',
                                      params: { type: 'null' },
                                      message: 'must be null',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err55];
                                    } else {
                                      vErrors.push(err55);
                                    }
                                    errors++;
                                  }
                                  var _valid7 = _errs93 === errors;
                                  valid16 = valid16 || _valid7;
                                  if (!valid16) {
                                    const err56 = {
                                      instancePath:
                                        instancePath +
                                        '/identity/selectedLeaseTermMonths',
                                      schemaPath:
                                        '#/$defs/identity/properties/selectedLeaseTermMonths/anyOf',
                                      keyword: 'anyOf',
                                      params: {},
                                      message: 'must match a schema in anyOf',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err56];
                                    } else {
                                      vErrors.push(err56);
                                    }
                                    errors++;
                                  } else {
                                    errors = _errs90;
                                    if (vErrors !== null) {
                                      if (_errs90) {
                                        vErrors.length = _errs90;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid12 = _errs89 === errors;
                                } else {
                                  var valid12 = true;
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  } else {
                    const err57 = {
                      instancePath: instancePath + '/identity',
                      schemaPath: '#/$defs/identity/type',
                      keyword: 'type',
                      params: { type: 'object' },
                      message: 'must be object',
                    };
                    if (vErrors === null) {
                      vErrors = [err57];
                    } else {
                      vErrors.push(err57);
                    }
                    errors++;
                  }
                }
                var _valid4 = _errs64 === errors;
                valid10 = valid10 || _valid4;
                const _errs95 = errors;
                if (data20 !== null) {
                  const err58 = {
                    instancePath: instancePath + '/identity',
                    schemaPath: '#/anyOf/1/properties/identity/anyOf/1/type',
                    keyword: 'type',
                    params: { type: 'null' },
                    message: 'must be null',
                  };
                  if (vErrors === null) {
                    vErrors = [err58];
                  } else {
                    vErrors.push(err58);
                  }
                  errors++;
                }
                var _valid4 = _errs95 === errors;
                valid10 = valid10 || _valid4;
                if (!valid10) {
                  const err59 = {
                    instancePath: instancePath + '/identity',
                    schemaPath: '#/anyOf/1/properties/identity/anyOf',
                    keyword: 'anyOf',
                    params: {},
                    message: 'must match a schema in anyOf',
                  };
                  if (vErrors === null) {
                    vErrors = [err59];
                  } else {
                    vErrors.push(err59);
                  }
                  errors++;
                } else {
                  errors = _errs63;
                  if (vErrors !== null) {
                    if (_errs63) {
                      vErrors.length = _errs63;
                    } else {
                      vErrors = null;
                    }
                  }
                }
                var valid9 = _errs62 === errors;
              } else {
                var valid9 = true;
              }
              if (valid9) {
                if (data.error !== undefined) {
                  let data28 = data.error;
                  const _errs97 = errors;
                  if (errors === _errs97) {
                    if (
                      data28 &&
                      typeof data28 == 'object' &&
                      !Array.isArray(data28)
                    ) {
                      let missing7;
                      if (
                        (data28.code === undefined && (missing7 = 'code')) ||
                        (data28.message === undefined &&
                          (missing7 = 'message')) ||
                        (data28.retryable === undefined &&
                          (missing7 = 'retryable')) ||
                        (data28.retryMode === undefined &&
                          (missing7 = 'retryMode')) ||
                        (data28.retryAfterSeconds === undefined &&
                          (missing7 = 'retryAfterSeconds'))
                      ) {
                        const err60 = {
                          instancePath: instancePath + '/error',
                          schemaPath: '#/anyOf/1/properties/error/required',
                          keyword: 'required',
                          params: { missingProperty: missing7 },
                          message:
                            "must have required property '" + missing7 + "'",
                        };
                        if (vErrors === null) {
                          vErrors = [err60];
                        } else {
                          vErrors.push(err60);
                        }
                        errors++;
                      } else {
                        const _errs99 = errors;
                        for (const key7 in data28) {
                          if (!(
                            key7 === 'code' ||
                            key7 === 'message' ||
                            key7 === 'retryable' ||
                            key7 === 'retryMode' ||
                            key7 === 'retryAfterSeconds'
                          )) {
                            const err61 = {
                              instancePath: instancePath + '/error',
                              schemaPath:
                                '#/anyOf/1/properties/error/additionalProperties',
                              keyword: 'additionalProperties',
                              params: { additionalProperty: key7 },
                              message: 'must NOT have additional properties',
                            };
                            if (vErrors === null) {
                              vErrors = [err61];
                            } else {
                              vErrors.push(err61);
                            }
                            errors++;
                            break;
                          }
                        }
                        if (_errs99 === errors) {
                          if (data28.code !== undefined) {
                            let data29 = data28.code;
                            const _errs100 = errors;
                            if (typeof data29 !== 'string') {
                              const err62 = {
                                instancePath: instancePath + '/error/code',
                                schemaPath:
                                  '#/anyOf/1/properties/error/properties/code/type',
                                keyword: 'type',
                                params: { type: 'string' },
                                message: 'must be string',
                              };
                              if (vErrors === null) {
                                vErrors = [err62];
                              } else {
                                vErrors.push(err62);
                              }
                              errors++;
                            }
                            if (!(
                              data29 === 'INVALID_REQUEST' ||
                              data29 === 'UNAUTHENTICATED' ||
                              data29 === 'ENTITLEMENT_REQUIRED' ||
                              data29 === 'USAGE_LIMIT_EXCEEDED' ||
                              data29 === 'RATE_LIMITED' ||
                              data29 === 'IDEMPOTENCY_CONFLICT' ||
                              data29 === 'EXTRACTION_IN_PROGRESS' ||
                              data29 === 'UNUSABLE_CAPTURE' ||
                              data29 === 'MODEL_REFUSAL' ||
                              data29 === 'MODEL_OUTPUT_TRUNCATED' ||
                              data29 === 'MODEL_OUTPUT_INVALID' ||
                              data29 === 'MODEL_EVIDENCE_INVALID' ||
                              data29 === 'UPSTREAM_TIMEOUT' ||
                              data29 === 'UPSTREAM_UNAVAILABLE' ||
                              data29 === 'INTERNAL_ERROR'
                            )) {
                              const err63 = {
                                instancePath: instancePath + '/error/code',
                                schemaPath:
                                  '#/anyOf/1/properties/error/properties/code/enum',
                                keyword: 'enum',
                                params: {
                                  allowedValues:
                                    schema31.anyOf[1].properties.error
                                      .properties.code.enum,
                                },
                                message:
                                  'must be equal to one of the allowed values',
                              };
                              if (vErrors === null) {
                                vErrors = [err63];
                              } else {
                                vErrors.push(err63);
                              }
                              errors++;
                            }
                            var valid17 = _errs100 === errors;
                          } else {
                            var valid17 = true;
                          }
                          if (valid17) {
                            if (data28.message !== undefined) {
                              const _errs102 = errors;
                              if (typeof data28.message !== 'string') {
                                const err64 = {
                                  instancePath: instancePath + '/error/message',
                                  schemaPath:
                                    '#/anyOf/1/properties/error/properties/message/type',
                                  keyword: 'type',
                                  params: { type: 'string' },
                                  message: 'must be string',
                                };
                                if (vErrors === null) {
                                  vErrors = [err64];
                                } else {
                                  vErrors.push(err64);
                                }
                                errors++;
                              }
                              var valid17 = _errs102 === errors;
                            } else {
                              var valid17 = true;
                            }
                            if (valid17) {
                              if (data28.retryable !== undefined) {
                                const _errs104 = errors;
                                if (typeof data28.retryable !== 'boolean') {
                                  const err65 = {
                                    instancePath:
                                      instancePath + '/error/retryable',
                                    schemaPath:
                                      '#/anyOf/1/properties/error/properties/retryable/type',
                                    keyword: 'type',
                                    params: { type: 'boolean' },
                                    message: 'must be boolean',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err65];
                                  } else {
                                    vErrors.push(err65);
                                  }
                                  errors++;
                                }
                                var valid17 = _errs104 === errors;
                              } else {
                                var valid17 = true;
                              }
                              if (valid17) {
                                if (data28.retryMode !== undefined) {
                                  let data32 = data28.retryMode;
                                  const _errs106 = errors;
                                  if (typeof data32 !== 'string') {
                                    const err66 = {
                                      instancePath:
                                        instancePath + '/error/retryMode',
                                      schemaPath:
                                        '#/anyOf/1/properties/error/properties/retryMode/type',
                                      keyword: 'type',
                                      params: { type: 'string' },
                                      message: 'must be string',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err66];
                                    } else {
                                      vErrors.push(err66);
                                    }
                                    errors++;
                                  }
                                  if (!(
                                    data32 === 'none' ||
                                    data32 === 'same_request' ||
                                    data32 === 'new_request'
                                  )) {
                                    const err67 = {
                                      instancePath:
                                        instancePath + '/error/retryMode',
                                      schemaPath:
                                        '#/anyOf/1/properties/error/properties/retryMode/enum',
                                      keyword: 'enum',
                                      params: {
                                        allowedValues:
                                          schema31.anyOf[1].properties.error
                                            .properties.retryMode.enum,
                                      },
                                      message:
                                        'must be equal to one of the allowed values',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err67];
                                    } else {
                                      vErrors.push(err67);
                                    }
                                    errors++;
                                  }
                                  var valid17 = _errs106 === errors;
                                } else {
                                  var valid17 = true;
                                }
                                if (valid17) {
                                  if (data28.retryAfterSeconds !== undefined) {
                                    let data33 = data28.retryAfterSeconds;
                                    const _errs108 = errors;
                                    const _errs109 = errors;
                                    let valid18 = false;
                                    const _errs110 = errors;
                                    if (!(
                                      typeof data33 == 'number' &&
                                      !(data33 % 1) &&
                                      !isNaN(data33)
                                    )) {
                                      const err68 = {
                                        instancePath:
                                          instancePath +
                                          '/error/retryAfterSeconds',
                                        schemaPath:
                                          '#/anyOf/1/properties/error/properties/retryAfterSeconds/anyOf/0/type',
                                        keyword: 'type',
                                        params: { type: 'integer' },
                                        message: 'must be integer',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err68];
                                      } else {
                                        vErrors.push(err68);
                                      }
                                      errors++;
                                    }
                                    var _valid8 = _errs110 === errors;
                                    valid18 = valid18 || _valid8;
                                    const _errs112 = errors;
                                    if (data33 !== null) {
                                      const err69 = {
                                        instancePath:
                                          instancePath +
                                          '/error/retryAfterSeconds',
                                        schemaPath:
                                          '#/anyOf/1/properties/error/properties/retryAfterSeconds/anyOf/1/type',
                                        keyword: 'type',
                                        params: { type: 'null' },
                                        message: 'must be null',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err69];
                                      } else {
                                        vErrors.push(err69);
                                      }
                                      errors++;
                                    }
                                    var _valid8 = _errs112 === errors;
                                    valid18 = valid18 || _valid8;
                                    if (!valid18) {
                                      const err70 = {
                                        instancePath:
                                          instancePath +
                                          '/error/retryAfterSeconds',
                                        schemaPath:
                                          '#/anyOf/1/properties/error/properties/retryAfterSeconds/anyOf',
                                        keyword: 'anyOf',
                                        params: {},
                                        message: 'must match a schema in anyOf',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err70];
                                      } else {
                                        vErrors.push(err70);
                                      }
                                      errors++;
                                    } else {
                                      errors = _errs109;
                                      if (vErrors !== null) {
                                        if (_errs109) {
                                          vErrors.length = _errs109;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid17 = _errs108 === errors;
                                  } else {
                                    var valid17 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    } else {
                      const err71 = {
                        instancePath: instancePath + '/error',
                        schemaPath: '#/anyOf/1/properties/error/type',
                        keyword: 'type',
                        params: { type: 'object' },
                        message: 'must be object',
                      };
                      if (vErrors === null) {
                        vErrors = [err71];
                      } else {
                        vErrors.push(err71);
                      }
                      errors++;
                    }
                  }
                  var valid9 = _errs97 === errors;
                } else {
                  var valid9 = true;
                }
              }
            }
          }
        }
      }
    } else {
      const err72 = {
        instancePath,
        schemaPath: '#/anyOf/1/type',
        keyword: 'type',
        params: { type: 'object' },
        message: 'must be object',
      };
      if (vErrors === null) {
        vErrors = [err72];
      } else {
        vErrors.push(err72);
      }
      errors++;
    }
  }
  var _valid0 = _errs55 === errors;
  valid0 = valid0 || _valid0;
  if (_valid0) {
    if (props1 !== true) {
      props1 = true;
    }
  }
  if (!valid0) {
    const err73 = {
      instancePath,
      schemaPath: '#/anyOf',
      keyword: 'anyOf',
      params: {},
      message: 'must match a schema in anyOf',
    };
    if (vErrors === null) {
      vErrors = [err73];
    } else {
      vErrors.push(err73);
    }
    errors++;
    validate20.errors = vErrors;
    return false;
  } else {
    errors = _errs0;
    if (vErrors !== null) {
      if (_errs0) {
        vErrors.length = _errs0;
      } else {
        vErrors = null;
      }
    }
  }
  validate20.errors = vErrors;
  evaluated0.props = props1;
  return errors === 0;
}
validate20.evaluated = { dynamicProps: true, dynamicItems: false };
