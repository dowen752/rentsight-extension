import type {
  CalculationContext,
  MissingCostCategory,
  RecurringCostCategory,
  RecurringCosts,
  RentalListing,
  UpfrontCostCategory,
} from './models';
import { assertValidListing } from './validation';
import {
  estimateSupplementalRecurringCosts,
  estimateUtilities,
} from './utilities';

const RECURRING_LABELS: Record<RecurringCostCategory, string> = {
  advertisedRent: 'Advertised rent',
  electricity: 'Electricity',
  naturalGas: 'Natural gas',
  water: 'Water',
  sewer: 'Sewer',
  trash: 'Trash',
  internet: 'Internet',
  parking: 'Parking',
  laundry: 'Laundry',
  petRent: 'Pet rent',
  rentersInsurance: 'Renters insurance',
  amenityFees: 'Amenity fees',
  otherRequiredMonthlyFees: 'Other required monthly fees',
};

const ALL_RECURRING_CATEGORIES = Object.keys(
  RECURRING_LABELS,
) as RecurringCostCategory[];

const UPFRONT_LABELS: Record<UpfrontCostCategory, string> = {
  applicationFee: 'Application fee',
  securityDeposit: 'Security deposit',
  firstMonthsRent: "First month's rent",
  lastMonthsRent: "Last month's rent",
  petDeposit: 'Pet deposit',
  administrativeFee: 'Administrative fee',
  utilityDeposits: 'Utility deposits',
  otherMoveInFees: 'Other move-in fees',
};

const ALL_UPFRONT_CATEGORIES = Object.keys(
  UPFRONT_LABELS,
) as UpfrontCostCategory[];

function resolvedRecurring(
  listing: RentalListing,
  context?: CalculationContext,
): RecurringCosts {
  if (!context?.utilityEstimation) return listing.recurring;
  const utilityEstimates = estimateUtilities(context.utilityEstimation);
  const supplemental = estimateSupplementalRecurringCosts(
    context.utilityEstimation,
  );
  return {
    ...utilityEstimates,
    ...supplemental,
    ...listing.recurring,
  };
}

function sumKnownCosts(costs: RecurringCosts): number {
  return ALL_RECURRING_CATEGORIES.reduce(
    (total, category) => total + (costs[category]?.value ?? 0),
    0,
  );
}

export function calculateEstimatedTrueMonthlyCost(
  listing: RentalListing,
  context?: CalculationContext,
): number {
  assertValidListing(listing);
  return sumKnownCosts(resolvedRecurring(listing, context));
}

export function calculateRequiredMoveInCash(listing: RentalListing): number {
  assertValidListing(listing);
  return Object.values(listing.upfront).reduce(
    (total, field) => total + (field?.value ?? 0),
    0,
  );
}

export function calculateNonrefundableMoveInExpenses(
  listing: RentalListing,
): number {
  assertValidListing(listing);
  const { applicationFee, administrativeFee, otherMoveInFees } =
    listing.upfront;
  return [applicationFee, administrativeFee, otherMoveInFees].reduce<number>(
    (total, field) => total + (field?.value ?? 0),
    0,
  );
}

export function calculateRefundableDeposits(listing: RentalListing): number {
  assertValidListing(listing);
  const { securityDeposit, petDeposit, utilityDeposits } = listing.upfront;
  return [securityDeposit, petDeposit, utilityDeposits].reduce<number>(
    (total, field) => total + (field?.value ?? 0),
    0,
  );
}

export function calculateEffectiveMonthlyRent(
  listing: RentalListing,
): number | undefined {
  assertValidListing(listing);
  const rent = listing.recurring.advertisedRent?.value;
  if (rent === undefined) return undefined;
  const leaseMonths = listing.concessions?.leaseMonths?.value ?? 12;
  const freeMonths = Math.min(
    leaseMonths,
    listing.concessions?.monthsFree?.value ?? 0,
  );
  const credit = listing.concessions?.oneTimeCredit?.value ?? 0;
  return Math.max(
    0,
    (rent * (leaseMonths - freeMonths) - credit) / leaseMonths,
  );
}

export function calculateFirstYearHousingCost(
  listing: RentalListing,
  context?: CalculationContext,
): number {
  assertValidListing(listing);
  const recurring = resolvedRecurring(listing, context);
  const rent = listing.recurring.advertisedRent?.value ?? 0;
  const nonRentMonthly = sumKnownCosts(recurring) - rent;
  const effectiveRent = calculateEffectiveMonthlyRent(listing) ?? 0;
  return (
    (effectiveRent + nonRentMonthly) * 12 +
    calculateNonrefundableMoveInExpenses(listing)
  );
}

export function calculateCostPerSquareFoot(
  listing: RentalListing,
  context?: CalculationContext,
): number | undefined {
  assertValidListing(listing);
  const squareFootage = listing.identity.squareFootage?.value;
  if (squareFootage === undefined || squareFootage === 0) return undefined;
  return calculateEstimatedTrueMonthlyCost(listing, context) / squareFootage;
}

export function listMissingCostCategories(
  listing: RentalListing,
  context?: CalculationContext,
): MissingCostCategory[] {
  assertValidListing(listing);
  const recurring = resolvedRecurring(listing, context);
  const missingRecurring = ALL_RECURRING_CATEGORIES.filter(
    (category) => recurring[category] === undefined,
  ).map((category) => ({
    category,
    label: RECURRING_LABELS[category],
    cadence: 'monthly' as const,
    reason: 'No listing value, user value, or estimate is available.',
  }));
  const missingUpfront = ALL_UPFRONT_CATEGORIES.filter(
    (category) => listing.upfront[category] === undefined,
  ).map((category) => ({
    category,
    label: UPFRONT_LABELS[category],
    cadence: 'upfront' as const,
    reason: 'No listing value or user value is available.',
  }));
  return [...missingRecurring, ...missingUpfront];
}
