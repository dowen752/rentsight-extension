export const EXTRACTION_SCHEMA_VERSION = '1.0.0';
export const EXTRACTION_PROMPT_VERSION = 'unknown';

const TRACKING_PARAMETER =
  /^(utm_.+|gclid|dclid|fbclid|msclkid|mc_cid|mc_eid|_ga|vero_id|ref_|source)$/i;

export function canonicalizeListingUrl(value: string): string {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  for (const key of [...url.searchParams.keys()])
    if (TRACKING_PARAMETER.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.toString();
}

export interface ListingCacheIdentity {
  canonicalUrl: string;
  selectedUnit: string | null;
  selectedLeaseTermMonths: number | null;
  schemaVersion: string;
  promptVersion: string;
}

export function listingCacheIdentity(input: {
  url: string;
  selectedUnit?: string | null;
  selectedLeaseTermMonths?: number | null;
}): ListingCacheIdentity {
  return {
    canonicalUrl: canonicalizeListingUrl(input.url),
    selectedUnit: input.selectedUnit ?? null,
    selectedLeaseTermMonths: input.selectedLeaseTermMonths ?? null,
    schemaVersion: EXTRACTION_SCHEMA_VERSION,
    promptVersion: EXTRACTION_PROMPT_VERSION,
  };
}

export const listingCacheKey = (identity: ListingCacheIdentity): string =>
  JSON.stringify(identity);
