import {
  calculateEffectiveMonthlyCostAfterConcessions,
  calculateEstimatedTrueMonthlyCost,
  calculateFirstYearHousingCost,
  calculateRequiredMoveInCash,
} from '../calculations';
import type { SavedListingRecord } from '../saved';
import { materializeListing, type RentalAnalysis } from '../shared/analysis';
import type { AssistantContext } from './types';

const sourced = <T>(
  value: { value: T; source: string; note?: string } | undefined,
) =>
  value
    ? {
        value: value.value,
        source: value.source,
        ...(value.note ? { note: value.note } : {}),
      }
    : undefined;

export function assistantContextForAnalysis(
  analysis: RentalAnalysis | undefined,
  savedListings: SavedListingRecord[],
): AssistantContext {
  if (!analysis)
    return {
      activeView: 'unavailable',
      selectedListings: savedListings.slice(0, 10).map((record) => ({
        id: record.id,
        address: record.analysis.listing.identity.fullAddress?.value,
      })),
    };
  const listing = materializeListing(analysis);
  const identity = listing.identity;
  const recurring = Object.fromEntries(
    Object.entries(listing.recurring).map(([key, value]) => [
      key,
      sourced(value),
    ]),
  );
  const upfront = Object.fromEntries(
    Object.entries(listing.upfront).map(([key, value]) => [
      key,
      sourced(value),
    ]),
  );
  return {
    activeView: 'current',
    currentListing: {
      title: identity.listingTitle?.value,
      address: identity.fullAddress?.value,
      city: identity.city?.value,
      state: identity.state?.value,
      zipCode: identity.zipCode?.value,
      bedrooms: identity.bedrooms?.value,
      bathrooms: identity.bathrooms?.value,
      squareFeet: identity.squareFootage?.value,
      recurring,
      upfront,
      concessions: listing.concessions,
      propertyNotes: analysis.propertyNotes.map(({ text, source }) => ({
        text,
        source,
      })),
    },
    currentCalculation: {
      advertisedRent: listing.recurring.advertisedRent?.value,
      estimatedTrueMonthlyCost: calculateEstimatedTrueMonthlyCost(listing),
      effectiveMonthlyCostAfterConcessions:
        calculateEffectiveMonthlyCostAfterConcessions(listing),
      requiredMoveInCash: calculateRequiredMoveInCash(listing),
      firstYearHousingCost: calculateFirstYearHousingCost(listing),
      recurring,
      upfront,
    },
    location: analysis.locationEstimate
      ? {
          ...analysis.locationEstimate.location,
          providerNotes: analysis.locationEstimate.providerNotes,
          resolvedAt: analysis.locationEstimate.resolvedAt,
        }
      : {
          city: identity.city?.value,
          state: identity.state?.value,
          zipCode: identity.zipCode?.value,
        },
    selectedListings: savedListings.slice(0, 10).map((record) => ({
      id: record.id,
      address: record.analysis.listing.identity.fullAddress?.value,
      advertisedRent: record.analysis.listing.recurring.advertisedRent?.value,
    })),
  };
}

export const assistantContextRevision = (analysis?: RentalAnalysis): string =>
  analysis
    ? `listing-analysis:${analysis.updatedAt}:${analysis.listing.identity.url?.value ?? ''}`
    : 'workspace:unavailable';
