import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialAnalysis } from '../src/shared/analysis';
import {
  clearAllRentSightData,
  extensionStorage,
  getRentalAnalysis,
  persistSavedListings,
  setRentalAnalysis,
} from '../src/storage';

describe('extension storage', () => {
  const values: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of Object.keys(values)) delete values[key];
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: values[key] })),
          set: vi.fn(async (update: Record<string, unknown>) =>
            Object.assign(values, update),
          ),
          remove: vi.fn(async (key: string) => delete values[key]),
          clear: vi.fn(async () => {
            for (const key of Object.keys(values)) delete values[key];
          }),
        },
      },
    });
  });

  it('persists and retrieves analyses by listing URL', async () => {
    const url = 'https://example.com/rental/1';
    const analyses = { [url]: createInitialAnalysis(url, 'Rental') };
    await extensionStorage.set('rentalAnalyses', analyses);
    await expect(extensionStorage.get('rentalAnalyses')).resolves.toEqual(
      analyses,
    );
  });

  it('stores each edited analysis independently and reads legacy drafts', async () => {
    const url = 'https://example.com/rental/independent';
    const analysis = createInitialAnalysis(url, 'Rental');
    await setRentalAnalysis(url, analysis);
    await expect(getRentalAnalysis(url)).resolves.toEqual(analysis);
    expect(values.rentalAnalyses).toBeUndefined();

    const legacyUrl = 'https://example.com/rental/legacy';
    const legacy = createInitialAnalysis(legacyUrl, 'Legacy');
    values.rentalAnalyses = { [legacyUrl]: legacy };
    await expect(getRentalAnalysis(legacyUrl)).resolves.toEqual(legacy);
  });

  it('preserves draft analyses and clears only regenerable caches on quota', async () => {
    values.rentalAnalyses = { oversized: true };
    values.locationCache = { oversized: true };
    let firstWrite = true;
    vi.mocked(chrome.storage.local.set).mockImplementation(
      async (update: Record<string, unknown>) => {
        if ('savedListings' in update && firstWrite) {
          firstWrite = false;
          throw new Error('Resource::kQuotaBytes quota exceeded');
        }
        Object.assign(values, update);
      },
    );

    await persistSavedListings([]);

    expect(values.rentalAnalyses).toEqual({ oversized: true });
    expect(values.locationCache).toBeUndefined();
    expect(values.savedListings).toEqual([]);
  });

  it('surfaces quota failure rather than deleting draft analyses', async () => {
    values.rentalAnalyses = { manualDraft: true };
    vi.mocked(chrome.storage.local.set).mockRejectedValue(
      new Error('Resource::kQuotaBytes quota exceeded'),
    );

    await expect(persistSavedListings([])).rejects.toThrow('quota exceeded');
    expect(values.rentalAnalyses).toEqual({ manualDraft: true });
  });

  it('clears drafts, saved listings, preferences, and caches together', async () => {
    values['rentalAnalysis:https%3A%2F%2Fexample.com'] = { draft: true };
    values.savedListings = [{ id: 'saved' }];
    values.internetMonthlyCost = 65;
    values.householdProfile = {
      occupants: 2,
      smallDogs: 1,
      largeDogs: 0,
      otherPets: false,
      internetMonthlyCost: 65,
    };
    values.locationCache = { place: true };
    values.assistantConversation = {
      schemaVersion: '1.0',
      conversationId: 'conversation-1',
      messages: [],
      outcomes: [],
      pendingOutcomes: [],
    };

    await clearAllRentSightData();

    expect(values).toEqual({});
    expect(chrome.storage.local.clear).toHaveBeenCalledOnce();
  });
});
