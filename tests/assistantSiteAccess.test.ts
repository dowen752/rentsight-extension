import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareRentalSiteAccess } from '../src/search/launch';

afterEach(() => vi.unstubAllGlobals());
describe('chatbot marketplace permission gesture', () => {
  it('starts site access synchronously before any asynchronous approval work', async () => {
    const request = vi.fn(async () => true);
    vi.stubGlobal('chrome', { permissions: { request } });
    const grant = prepareRentalSiteAccess('zillow', {
      location: 'Cupertino',
      maxListedRent: 3200,
    });
    expect(request).toHaveBeenCalledWith({
      origins: ['https://www.zillow.com/*'],
    });
    await expect(grant).resolves.toBe(true);
  });
  it('keeps denial and unsupported sites safe without opening a tab', async () => {
    const request = vi.fn(async () => {
      throw new Error('Permission denied');
    });
    const create = vi.fn();
    vi.stubGlobal('chrome', { permissions: { request }, tabs: { create } });
    await expect(
      prepareRentalSiteAccess('zillow', { maxListedRent: 3200 }),
    ).resolves.toBe(false);
    await expect(prepareRentalSiteAccess('invented', {})).resolves.toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
