import {
  calculateCostPerSquareFoot,
  calculateEstimatedTrueMonthlyCost,
  calculateFirstYearHousingCost,
  calculateRequiredMoveInCash,
  type SourcedValue,
} from '../calculations';
import { materializeListing, UTILITY_CATEGORIES } from '../shared/analysis';
import type { SavedListingRecord } from './types';

export interface CompletenessScore {
  score: number;
  known: number;
  estimated: number;
  missing: number;
  label: 'Data completeness';
}

const importantFields = (
  record: SavedListingRecord,
): (SourcedValue<unknown> | undefined)[] => {
  const listing = materializeListing(record.analysis);
  return [
    listing.identity.fullAddress,
    listing.recurring.advertisedRent,
    listing.identity.bedrooms,
    listing.identity.bathrooms,
    listing.identity.squareFootage,
    ...UTILITY_CATEGORIES.map((key) => listing.recurring[key]),
    listing.recurring.parking,
    listing.recurring.laundry,
    listing.recurring.petRent,
    listing.upfront.securityDeposit,
    listing.upfront.applicationFee,
  ];
};

export function calculateCompleteness(
  record: SavedListingRecord,
): CompletenessScore {
  const fields = importantFields(record);
  const known = fields.filter(
    (field) => field && ['listing', 'user'].includes(field.source),
  ).length;
  const estimated = fields.filter(
    (field) => field && ['default', 'location_estimate'].includes(field.source),
  ).length;
  const missing = fields.length - known - estimated;
  return {
    score: Math.round(((known + estimated * 0.5) / fields.length) * 100),
    known,
    estimated,
    missing,
    label: 'Data completeness',
  };
}

export interface ComparisonSnapshot {
  id: string;
  url: string;
  address: string;
  advertisedRent?: number;
  trueMonthlyCost: number;
  monthlyDifference?: number;
  moveInCash: number;
  firstYearTotal: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  costPerSquareFoot?: number;
  utilities: number;
  parking?: number;
  laundry?: number;
  petExpenses: number;
  completeness: CompletenessScore;
  notes: SavedListingRecord['analysis']['propertyNotes'];
}

export function comparisonBest(
  values: readonly (number | undefined)[],
  direction: 'lower' | 'higher',
): number | undefined {
  const known = values.filter((value): value is number => value !== undefined);
  const unknownCount = values.length - known.length;
  if (
    known.length < 2 ||
    values.length === 0 ||
    unknownCount / values.length > 0.5
  )
    return undefined;
  const minimum = Math.min(...known);
  const maximum = Math.max(...known);
  if (minimum === maximum) return undefined;
  return direction === 'lower' ? minimum : maximum;
}

export function createComparison(
  record: SavedListingRecord,
): ComparisonSnapshot {
  const listing = materializeListing(record.analysis);
  const advertisedRent = listing.recurring.advertisedRent?.value;
  const trueMonthlyCost = calculateEstimatedTrueMonthlyCost(listing);
  const displayName = listing.identity.listingTitle?.value.trim();
  return {
    id: record.id,
    url: record.url,
    address: displayName || listing.identity.fullAddress?.value || record.url,
    advertisedRent,
    trueMonthlyCost,
    monthlyDifference:
      advertisedRent === undefined
        ? undefined
        : trueMonthlyCost - advertisedRent,
    moveInCash: calculateRequiredMoveInCash(listing),
    firstYearTotal: calculateFirstYearHousingCost(listing),
    bedrooms: listing.identity.bedrooms?.value,
    bathrooms: listing.identity.bathrooms?.value,
    squareFootage: listing.identity.squareFootage?.value,
    costPerSquareFoot: calculateCostPerSquareFoot(listing),
    utilities: UTILITY_CATEGORIES.reduce(
      (sum, key) => sum + (listing.recurring[key]?.value ?? 0),
      0,
    ),
    parking: listing.recurring.parking?.value,
    laundry: listing.recurring.laundry?.value,
    petExpenses:
      (listing.recurring.petRent?.value ?? 0) +
      (listing.upfront.petDeposit?.value ?? 0) +
      (listing.upfront.petFee?.value ?? 0),
    completeness: calculateCompleteness(record),
    notes: record.analysis.propertyNotes ?? [],
  };
}
