import { DEFAULT_COST_ASSUMPTIONS, type CostAssumptions } from './assumptions';
import type {
  RecurringCosts,
  SourcedValue,
  UtilityCategory,
  UtilityEstimationInput,
} from './models';
import {
  CalculationValidationError,
  validateUtilityEstimationInput,
} from './validation';

const UTILITY_CATEGORIES: readonly UtilityCategory[] = [
  'electricity',
  'naturalGas',
  'water',
  'sewer',
  'trash',
  'internet',
];

export function estimateUtilities(
  input: UtilityEstimationInput,
  assumptions: Readonly<CostAssumptions> = DEFAULT_COST_ASSUMPTIONS,
): Partial<Record<UtilityCategory, SourcedValue<number>>> {
  const validation = validateUtilityEstimationInput(input);
  if (!validation.valid)
    throw new CalculationValidationError(validation.errors);

  const occupantFactor =
    1 +
    Math.max(0, input.occupants - 1) * assumptions.additionalOccupantMultiplier;
  const bedroomFactor =
    1 + Math.max(0, (input.bedrooms ?? 1) - 1) * assumptions.bedroomAdjustment;
  const sizeSteps = Math.max(
    0,
    ((input.squareFootage ?? assumptions.squareFootageBaseline) -
      assumptions.squareFootageBaseline) /
      500,
  );
  const sizeFactor = 1 + sizeSteps * assumptions.squareFootageAdjustmentPer500;
  const housingFactor = assumptions.housingTypeMultiplier[input.housingType];
  const included = new Set(input.includedUtilities);

  return Object.fromEntries(
    UTILITY_CATEGORIES.map((category) => {
      const value = included.has(category)
        ? 0
        : Math.round(
            assumptions.utilities[category] *
              occupantFactor *
              bedroomFactor *
              sizeFactor *
              housingFactor +
              1e-9,
          );
      return [
        category,
        {
          value,
          source: included.has(category) ? 'listing' : 'default',
          confidence: included.has(category) ? 1 : 0.35,
          note: included.has(category)
            ? 'Included in advertised rent.'
            : 'Placeholder estimate from centralized RentSight assumptions.',
        },
      ];
    }),
  );
}

export function estimateSupplementalRecurringCosts(
  input: UtilityEstimationInput,
  assumptions: Readonly<CostAssumptions> = DEFAULT_COST_ASSUMPTIONS,
): Pick<RecurringCosts, 'laundry' | 'rentersInsurance'> {
  return {
    laundry:
      input.laundryType === undefined
        ? undefined
        : {
            value:
              input.laundryType === 'shared_paid'
                ? assumptions.paidSharedLaundry
                : 0,
            source: 'default',
            confidence: 0.6,
            note:
              input.laundryType === 'shared_paid'
                ? 'Assumes routine use of paid shared machines.'
                : 'No separate paid-laundry estimate for this laundry type.',
          },
    rentersInsurance: {
      value: assumptions.defaultRentersInsurance,
      source: 'default',
      confidence: 0.4,
      note: 'Placeholder renters-insurance estimate.',
    },
  };
}
