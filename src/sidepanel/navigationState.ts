import type { ListingExtraction } from '../extractors';
import {
  applyExtraction,
  createInitialAnalysis,
  type RentalAnalysis,
  type RentalAnalysisMap,
} from '../shared/analysis';

function isZillowBuildingToUnitNavigation(
  previousUrl: string | undefined,
  nextUrl: string,
): boolean {
  if (!previousUrl) return false;
  try {
    const previous = new URL(previousUrl);
    const next = new URL(nextUrl);
    return (
      /(^|\.)zillow\.com$/i.test(previous.hostname) &&
      previous.hostname === next.hostname &&
      /\/b\//i.test(previous.pathname) &&
      /\/homedetails\//i.test(next.pathname)
    );
  } catch {
    return false;
  }
}

export function analysisForNavigation(
  current: RentalAnalysis | undefined,
  url: string,
  title: string,
  extraction: ListingExtraction | undefined,
  stored: RentalAnalysisMap | undefined,
): RentalAnalysis {
  const inheritingBuilding = isZillowBuildingToUnitNavigation(
    current?.listing.identity.url?.value,
    url,
  );
  let base =
    current?.listing.identity.url?.value === url
      ? current
      : (stored?.[url] ??
        (inheritingBuilding
          ? structuredClone(current!)
          : createInitialAnalysis(url, title)));
  if (base.listing.identity.url?.value !== url) {
    base = structuredClone(base);
    const urlValue = { value: url, source: 'listing' as const, confidence: 1 };
    base.listing.identity.url = urlValue;
    base.baseline.identity.url = structuredClone(urlValue);
  }
  if (!extraction) return base;
  const inheritedExtraction = current?.extraction;
  const effectiveExtraction =
    inheritingBuilding && inheritedExtraction
      ? {
          ...extraction,
          includedUtilities: [
            ...new Set([
              ...inheritedExtraction.includedUtilities,
              ...extraction.includedUtilities,
            ]),
          ],
          rawUtilityText:
            extraction.rawUtilityText ?? inheritedExtraction.rawUtilityText,
          laundryType:
            extraction.laundryType ?? inheritedExtraction.laundryType,
          rawLaundryText:
            extraction.rawLaundryText ?? inheritedExtraction.rawLaundryText,
        }
      : extraction;
  return applyExtraction(base, effectiveExtraction);
}
