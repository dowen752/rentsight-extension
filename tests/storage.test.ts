import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialAnalysis } from '../src/shared/analysis';
import { extensionStorage } from '../src/storage';

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
});
