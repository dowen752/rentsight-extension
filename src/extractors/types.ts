import type {
  LaundryType,
  RentalListing,
  SourcedValue,
  UtilityCategory,
} from '../calculations/models';

export interface RentRangeEvidence {
  kind: 'range';
  minimum: SourcedValue<number>;
  maximum: SourcedValue<number>;
  rawText: string;
}

export interface RentConflictEvidence {
  kind: 'conflict';
  candidates: SourcedValue<number>[];
  rawText: string[];
}

export interface SingleRentEvidence {
  kind: 'single';
  amount: SourcedValue<number>;
  rawText: string;
}

export type RentEvidence =
  SingleRentEvidence | RentRangeEvidence | RentConflictEvidence;

export interface ListingExtraction {
  namedRecurringFees?: import('./fees').ExtractedFee[];
  feeNoteSuggestions?: import('./fees').FeeNoteSuggestion[];
  listing: RentalListing;
  rent?: RentEvidence;
  includedUtilities: UtilityCategory[];
  laundryType?: LaundryType;
  rawUtilityText?: string;
  rawLaundryText?: string;
  petPolicy?: 'none';
  rawPetPolicyText?: string;
  siteName: string;
  extractorVersion: string;
  warnings: string[];
}

export interface ListingExtractor {
  readonly siteName: string;
  readonly version: string;
  matches(url: URL, document: Document): boolean;
  extract(document: Document, url: URL): ListingExtraction;
}

export function emptyExtraction(
  siteName: string,
  version: string,
): ListingExtraction {
  return {
    listing: { identity: {}, recurring: {}, upfront: {} },
    includedUtilities: [],
    siteName,
    extractorVersion: version,
    warnings: [],
  };
}
