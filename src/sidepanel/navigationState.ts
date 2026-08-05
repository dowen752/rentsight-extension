import type { ListingExtraction } from '../extractors';
import {
  applyExtraction,
  createInitialAnalysis,
  type RentalAnalysis,
  type RentalAnalysisMap,
} from '../shared/analysis';

export function analysisForNavigation(
  current: RentalAnalysis | undefined,
  url: string,
  title: string,
  extraction: ListingExtraction | undefined,
  stored: RentalAnalysisMap | undefined,
): RentalAnalysis {
  const base =
    current?.listing.identity.url?.value === url
      ? current
      : (stored?.[url] ?? createInitialAnalysis(url, title));
  return extraction ? applyExtraction(base, extraction) : base;
}
