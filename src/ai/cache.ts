import type { ExtractionSuccess } from './types';
import type { ListingCacheIdentity } from './identity';
import { listingCacheKey } from './identity';

export const EXTRACTION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const EXTRACTION_FAILURE_COOLDOWN_MS = 10 * 60 * 1000;
export const EXTRACTION_IN_FLIGHT_TTL_MS = 2 * 60 * 1000;

export interface ExtractionCacheEntry {
  identity: ListingCacheIdentity;
  fingerprint: string;
  completedAt: number;
  response: ExtractionSuccess;
}

interface CacheEnvelope {
  entries: Record<string, ExtractionCacheEntry>;
  inFlight: Record<string, { owner: string; expiresAt: number }>;
  failures: Record<string, { fingerprint: string; retryAt: number }>;
}

const EMPTY: CacheEnvelope = { entries: {}, inFlight: {}, failures: {} };
const STORAGE_KEY = 'aiExtractionCacheV1';

export interface ExtractionCache {
  get(
    identity: ListingCacheIdentity,
  ): Promise<ExtractionCacheEntry | undefined>;
  put(entry: ExtractionCacheEntry): Promise<void>;
  claim(
    identity: ListingCacheIdentity,
    owner: string,
    now: number,
  ): Promise<boolean>;
  release(identity: ListingCacheIdentity, owner: string): Promise<void>;
  suppress(
    identity: ListingCacheIdentity,
    fingerprint: string,
    retryAt: number,
  ): Promise<void>;
  isSuppressed(
    identity: ListingCacheIdentity,
    fingerprint: string,
    now: number,
  ): Promise<boolean>;
}

export class ChromeExtractionCache implements ExtractionCache {
  private async read(): Promise<CacheEnvelope> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return (
      (result[STORAGE_KEY] as CacheEnvelope | undefined) ??
      structuredClone(EMPTY)
    );
  }
  private async write(value: CacheEnvelope) {
    await chrome.storage.local.set({ [STORAGE_KEY]: value });
  }
  async get(identity: ListingCacheIdentity) {
    return (await this.read()).entries[listingCacheKey(identity)];
  }
  async put(entry: ExtractionCacheEntry) {
    const value = await this.read();
    value.entries[listingCacheKey(entry.identity)] = entry;
    await this.write(value);
  }
  async claim(identity: ListingCacheIdentity, owner: string, now: number) {
    const key = listingCacheKey(identity);
    const value = await this.read();
    const current = value.inFlight[key];
    if (current && current.expiresAt > now && current.owner !== owner)
      return false;
    value.inFlight[key] = {
      owner,
      expiresAt: now + EXTRACTION_IN_FLIGHT_TTL_MS,
    };
    await this.write(value);
    const verified = (await this.read()).inFlight[key];
    return verified?.owner === owner;
  }
  async release(identity: ListingCacheIdentity, owner: string) {
    const key = listingCacheKey(identity);
    const value = await this.read();
    if (value.inFlight[key]?.owner === owner) delete value.inFlight[key];
    await this.write(value);
  }
  async suppress(
    identity: ListingCacheIdentity,
    fingerprint: string,
    retryAt: number,
  ) {
    const value = await this.read();
    value.failures[listingCacheKey(identity)] = { fingerprint, retryAt };
    await this.write(value);
  }
  async isSuppressed(
    identity: ListingCacheIdentity,
    fingerprint: string,
    now: number,
  ) {
    const failure = (await this.read()).failures[listingCacheKey(identity)];
    return failure?.fingerprint === fingerprint && failure.retryAt > now;
  }
}

export const developmentDiagnostic = (
  event: string,
  details: Record<string, unknown>,
) => {
  if (import.meta.env.DEV)
    console.debug('[RentSight AI]', { event, ...details });
};
