import {
  calculateEffectiveMonthlyCostAfterConcessions,
  calculateEstimatedTrueMonthlyCost,
  calculateFirstYearHousingCost,
  calculateRequiredMoveInCash,
} from '../calculations';
import type { SavedListingRecord } from '../saved';
import { materializeListing, type RentalAnalysis } from '../shared/analysis';
import type { AssistantContext } from './types';

const MAX_ASSISTANT_SAVED_LISTINGS = 5;

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

const analysisSnapshot = (analysis: RentalAnalysis) => {
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
    listing: {
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
    calculation: {
      advertisedRent: listing.recurring.advertisedRent?.value,
      estimatedTrueMonthlyCost: calculateEstimatedTrueMonthlyCost(listing),
      effectiveMonthlyCostAfterConcessions:
        calculateEffectiveMonthlyCostAfterConcessions(listing),
      requiredMoveInCash: calculateRequiredMoveInCash(listing),
      firstYearHousingCost: calculateFirstYearHousingCost(listing),
      recurring,
      upfront,
      inputs: {
        occupants: analysis.occupants,
        householdProfile: analysis.householdProfile,
        utilityIncluded: analysis.utilityIncluded,
        laundryType: analysis.laundryType,
        paidLaundry: analysis.paidLaundry,
        customRecurringFees: analysis.customRecurringFees,
        customOneTimeFees: analysis.customOneTimeFees,
      },
    },
    extractionNotes: [
      ...(analysis.aiExtraction?.result.notes.map((note) => ({
        id: note.id,
        text: note.text,
        fieldPaths: note.fieldPaths,
      })) ?? []),
      ...(analysis.extraction?.warnings.map((text, index) => ({
        id: `local-warning-${index}`,
        text,
      })) ?? []),
    ],
    userNotes: analysis.propertyNotes
      .filter((note) => note.source === 'user')
      .map(({ id, text }) => ({ id, text })),
    reviewIssues:
      analysis.aiExtraction?.result.reviewIssues.map((issue) => ({
        id: issue.id,
        code: issue.code,
        message: issue.message,
        fieldPaths: issue.fieldPaths,
        decision: analysis.aiReviewDecisions?.[issue.id],
      })) ?? [],
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
  };
};

export function assistantContextForAnalysis(
  analysis: RentalAnalysis | undefined,
  savedListings: SavedListingRecord[],
  selectedSavedListingIds: string[] = [],
): AssistantContext {
  const selectedIds = new Set(selectedSavedListingIds);
  const selectedSavedListings = savedListings
    .filter((record) => selectedIds.has(record.id))
    .slice(0, MAX_ASSISTANT_SAVED_LISTINGS);

  if (selectedSavedListings.length) {
    return {
      activeView: 'saved',
      extractionNotes: [],
      userNotes: [],
      reviewIssues: [],
      selectedListings: selectedSavedListings.map((record) => {
        const snapshot = analysisSnapshot(record.analysis);
        return {
          id: record.id,
          savedAt: record.createdAt,
          updatedAt: record.updatedAt,
          listing: snapshot.listing,
          calculation: snapshot.calculation,
          extractionNotes: snapshot.extractionNotes,
          userNotes: snapshot.userNotes,
          reviewIssues: snapshot.reviewIssues,
          location: snapshot.location,
        };
      }),
    };
  }

  if (!analysis)
    return {
      activeView: 'unavailable',
      extractionNotes: [],
      userNotes: [],
      reviewIssues: [],
      selectedListings: savedListings.slice(0, 10).map((record) => ({
        id: record.id,
        address: record.analysis.listing.identity.fullAddress?.value,
      })),
    };

  const snapshot = analysisSnapshot(analysis);
  return {
    activeView: 'current',
    currentListing: snapshot.listing,
    currentCalculation: snapshot.calculation,
    extractionNotes: snapshot.extractionNotes,
    userNotes: snapshot.userNotes,
    reviewIssues: snapshot.reviewIssues,
    location: snapshot.location,
    selectedListings: savedListings.slice(0, 10).map((record) => ({
      id: record.id,
      address: record.analysis.listing.identity.fullAddress?.value,
      advertisedRent: record.analysis.listing.recurring.advertisedRent?.value,
    })),
  };
}

export const assistantContextRevision = (
  analysis?: RentalAnalysis,
  savedListings: SavedListingRecord[] = [],
  selectedSavedListingIds: string[] = [],
): string => {
  const selectedIds = new Set(selectedSavedListingIds);
  const savedRevision = savedListings
    .filter((record) => selectedIds.has(record.id))
    .slice(0, MAX_ASSISTANT_SAVED_LISTINGS)
    .map((record) => `${record.id}:${record.updatedAt}`)
    .join('|');
  if (savedRevision) return `saved-listings:${savedRevision}`;
  return analysis
    ? `listing-analysis:${analysis.updatedAt}:${analysis.listing.identity.url?.value ?? ''}`
    : 'workspace:unavailable';
};
