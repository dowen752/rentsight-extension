import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { ExtractionRequest, ExtractionSuccess } from '../../src/ai/types';
import type { Fee, Money, MoneyField } from '../../src/ai/contracts/response';

export interface ChargeScenario {
  id: string;
  category: Fee['category'];
  label: string;
  quote: string;
  amountMinor: number;
  frequency: Money['frequency'];
  basis?: Money['basis'];
  currency?: string;
  applicability?: Fee['applicability']['kind'];
  refundable?: boolean | null;
  scope?: MoneyField['scope'];
  rangeMaximumMinor?: number;
}

// Synthetic wire fixtures use their own exact evidence and do not simulate a
// model. Validate them before testing adaptation, calculation, or persistence.
export function feeContract(charges: ChargeScenario[]) {
  const response = JSON.parse(
    readFileSync(
      new URL('../fixtures/ai/normal.response.json', import.meta.url),
      'utf8',
    ),
  ) as ExtractionSuccess;
  const request = JSON.parse(
    readFileSync(
      new URL('../fixtures/ai/normal.request.json', import.meta.url),
      'utf8',
    ),
  ) as ExtractionRequest;
  const template = structuredClone(response.result.property.fees.value![0]);
  for (const field of Object.values(response.result.property))
    Object.assign(field, {
      status: 'unknown',
      value: null,
      candidates: [],
      scope: 'unknown',
      evidenceIds: [],
    });
  request.capture.blocks = [
    {
      id: 'rent',
      kind: 'paragraph',
      sectionPath: ['Selected unit'],
      text: 'Base rent $2,000 per month.',
    },
  ];
  request.preliminaryValues = [];
  response.result.evidence = [
    {
      id: 'rent-evidence',
      blockId: 'rent',
      quote: request.capture.blocks[0].text,
    },
  ];
  response.result.notes = [];
  response.result.reviewIssues = [];
  response.result.property.baseRent = {
    ...template.amount,
    value: {
      kind: 'exact',
      minMinor: 200000,
      maxMinor: 200000,
      currency: 'USD',
      frequency: 'monthly',
      basis: 'per_unit',
    },
    scope: 'selected_unit',
    evidenceIds: ['rent-evidence'],
  };
  const fees = charges.map((charge) => {
    const id = `evidence-${charge.id}`;
    request.capture.blocks.push({
      id: charge.id,
      kind: 'paragraph',
      sectionPath: ['Selected unit', 'Charge schedule'],
      text: charge.quote,
    });
    response.result.evidence.push({
      id,
      blockId: charge.id,
      quote: charge.quote,
    });
    const refundable = charge.refundable ?? false;
    const fee: Fee = {
      ...structuredClone(template),
      id: charge.id,
      label: charge.label,
      category: charge.category,
      amount: {
        ...template.amount,
        value: {
          kind: charge.rangeMaximumMinor === undefined ? 'exact' : 'range',
          minMinor: charge.amountMinor,
          maxMinor: charge.rangeMaximumMinor ?? charge.amountMinor,
          currency: charge.currency ?? 'USD',
          frequency: charge.frequency,
          basis: charge.basis ?? 'per_unit',
        },
        scope: charge.scope ?? 'selected_unit',
        evidenceIds: [id],
      },
      applicability: {
        kind: charge.applicability ?? 'required',
        conditions:
          charge.applicability === 'conditional'
            ? ['Only if the renter selects this service.']
            : [],
        evidenceIds: [id],
      },
      refundable: {
        ...template.refundable,
        status: charge.refundable === null ? 'unknown' : 'known',
        value: charge.refundable === null ? null : refundable,
        evidenceIds: charge.refundable === null ? [] : [id],
      },
    };
    return fee;
  });
  if (!charges.length) {
    request.capture.blocks.push({
      id: 'no-fees',
      kind: 'paragraph',
      sectionPath: ['Selected unit', 'Charge schedule'],
      text: 'No listed additional charges.',
    });
    response.result.evidence.push({
      id: 'no-fees',
      blockId: 'no-fees',
      quote: 'No listed additional charges.',
    });
  }
  response.result.property.fees = {
    ...response.result.property.fees,
    status: 'known',
    value: fees,
    scope: 'selected_unit',
    evidenceIds: charges.length
      ? charges.map((c) => `evidence-${c.id}`)
      : ['no-fees'],
  };
  response.metadata.captureSha256 = createHash('sha256')
    .update(JSON.stringify(request.capture))
    .digest('hex');
  return { request, response };
}
