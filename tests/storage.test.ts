import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialAnalysis } from '../src/shared/analysis';
import { extensionStorage, persistSavedListings } from '../src/storage';

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

  it('clears reconstructable caches and retries when saved listings hit quota', async () => {
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

    expect(values.rentalAnalyses).toBeUndefined();
    expect(values.locationCache).toBeUndefined();
    expect(values.savedListings).toEqual([]);
  });
});
