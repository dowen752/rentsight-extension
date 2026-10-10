import { extractHousingType } from './housingType';
import type { SourcedValue } from '../calculations';
import { apartmentsExtractor } from './apartments';
import { apartmentListExtractor } from './apartmentList';
import { extractEmbeddedData } from './embeddedData';
import { genericExtractor } from './generic';
import { homesExtractor } from './homes';
import { extractJsonLd } from './jsonLd';
import { zillowExtractor } from './zillow';
import { redfinExtractor } from './redfin';
import { rentExtractor } from './rent';
import { realtorExtractor } from './realtor';
import {
  emptyExtraction,
  type ListingExtraction,
  type ListingExtractor,
  type RentEvidence,
} from './types';

const SITE_EXTRACTORS: readonly ListingExtractor[] = [
  realtorExtractor,
  zillowExtractor,
  apartmentsExtractor,
  apartmentListExtractor,
  redfinExtractor,
  homesExtractor,
  rentExtractor,
];

function mergeGroup(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(source))
    if (target[key] === undefined && value !== undefined) target[key] = value;
}

function reconcileRent(evidence: RentEvidence[]): RentEvidence | undefined {
  const range = evidence.find((item) => item.kind === 'range');
  if (range) return range;
  const conflicts = evidence.filter((item) => item.kind === 'conflict');
  const singles = evidence.filter(
    (item): item is Extract<RentEvidence, { kind: 'single' }> =>
      item.kind === 'single',
  );
  const values = [
    ...new Set([
      ...singles.map((item) => item.amount.value),
      ...conflicts.flatMap((item) =>
        item.kind === 'conflict'
          ? item.candidates.map((candidate) => candidate.value)
          : [],
      ),
    ]),
  ];
  if (values.length === 1) {
    if (singles[0]) return singles[0];
    const conflict = conflicts[0];
    if (conflict?.kind === 'conflict') {
      return {
        kind: 'single',
        amount: conflict.candidates[0],
        rawText: conflict.rawText[0],
      };
    }
  }
  if (values.length > 1) {
    const candidates: SourcedValue<number>[] = values.map((value) => {
      const single = singles.find(
        (item) => item.amount.value === value,
      )?.amount;
      const conflict = conflicts
        .flatMap((item) => (item.kind === 'conflict' ? item.candidates : []))
        .find((item) => item.value === value);
      return single ?? conflict!;
    });
    return {
      kind: 'conflict',
      candidates,
      rawText: evidence.flatMap((item) =>
        item.kind === 'single'
          ? [item.rawText]
          : item.kind === 'range'
            ? [item.rawText]
            : item.rawText,
      ),
    };
  }
  return undefined;
}

export function extractListing(
  document: Document,
  url: URL,
): ListingExtraction {
  const site = SITE_EXTRACTORS.find((extractor) =>
    extractor.matches(url, document),
  );
  const siteLayer = site?.extract(document, url);
  const selectedUnit = /(?:^|#)rentsight-unit=/i.test(url.hash);
  const restoreGenericHomesFallback = site === homesExtractor && !selectedUnit;
  const layers = (
    site
      ? [
          // Site-specific selectors describe the listing currently visible to
          // the user. JSON-LD is listing-scoped, while embedded application
          // state and generic page text can contain background search cards.
          siteLayer,
          // Redfin's structured payload can retain stale sale facts on rental
          // pages (including 0 beds or an unrelated floor size). Its visible,
          // labeled stats are the authoritative source for the current home.
          selectedUnit || site === redfinExtractor
            ? undefined
            : extractJsonLd(document, url),
          restoreGenericHomesFallback
            ? extractEmbeddedData(document, url)
            : undefined,
          restoreGenericHomesFallback
            ? genericExtractor.extract(document, url)
            : undefined,
        ]
      : [
          extractJsonLd(document, url),
          extractEmbeddedData(document, url),
          genericExtractor.extract(document, url),
        ]
  ).filter((value): value is ListingExtraction => Boolean(value));
  const result = emptyExtraction(
    site?.siteName ?? genericExtractor.siteName,
    site?.version ?? genericExtractor.version,
  );
  for (const layer of layers) {
    mergeGroup(
      result.listing.identity as Record<string, unknown>,
      layer.listing.identity as Record<string, unknown>,
    );
    mergeGroup(
      result.listing.recurring as Record<string, unknown>,
      layer.listing.recurring as Record<string, unknown>,
    );
    mergeGroup(
      result.listing.upfront as Record<string, unknown>,
      layer.listing.upfront as Record<string, unknown>,
    );
    if (layer.listing.concessions) {
      result.listing.concessions ??= {};
      mergeGroup(
        result.listing.concessions as Record<string, unknown>,
        layer.listing.concessions as Record<string, unknown>,
      );
    }
    result.includedUtilities = [
      ...new Set([...result.includedUtilities, ...layer.includedUtilities]),
    ];
    result.laundryType ??= layer.laundryType;
    result.rawUtilityText ??= layer.rawUtilityText;
    result.rawLaundryText ??= layer.rawLaundryText;
    result.petPolicy ??= layer.petPolicy;
    result.rawPetPolicyText ??= layer.rawPetPolicyText;
    result.warnings.push(...layer.warnings);
  }
  result.listing.identity.housingType ??= extractHousingType(document);
  result.rent =
    siteLayer?.rent ??
    reconcileRent(layers.flatMap((layer) => (layer.rent ? [layer.rent] : [])));
  if (result.rent?.kind === 'single')
    result.listing.recurring.advertisedRent = result.rent.amount;
  else if (result.rent?.kind === 'range' || result.rent?.kind === 'conflict')
    delete result.listing.recurring.advertisedRent;
  if (result.rent?.kind === 'range')
    result.warnings.push(`Rent is listed as a range: ${result.rent.rawText}`);
  if (result.rent?.kind === 'conflict')
    result.warnings.push(
      'Multiple conflicting rent values were found. Enter the applicable rent manually.',
    );
  if (
    Object.keys(result.listing.identity).length === 0 &&
    Object.keys(result.listing.recurring).length === 0 &&
    Object.keys(result.listing.upfront).length === 0
  )
    result.warnings.push(
      'RentSight could not confidently extract listing details. Manual entry is still available.',
    );
  return result;
}

export type {
  ListingExtraction,
  ListingExtractor,
  RentEvidence,
} from './types';
export {
  apartmentListExtractor,
  apartmentsExtractor,
  genericExtractor,
  homesExtractor,
  redfinExtractor,
  realtorExtractor,
  rentExtractor,
  zillowExtractor,
};
