import { describe, expect, it, vi } from 'vitest';
import { deleteAllRentSightData } from '../src/sidepanel/deleteAllData';

describe('deleteAllRentSightData', () => {
  it('deletes cloud data before authentication and local data', async () => {
    const order: string[] = [];

    await deleteAllRentSightData({
      deleteCloudAccount: async () => {
        order.push('cloud');
      },
      deleteAuthenticationAccount: async () => {
        order.push('authentication');
      },
      clearLocalData: async () => {
        order.push('local');
      },
    });

    expect(order).toEqual(['cloud', 'authentication', 'local']);
  });

  it('stops before Firebase and local deletion when cloud deletion fails', async () => {
    const deleteAuthenticationAccount = vi.fn(async () => undefined);
    const clearLocalData = vi.fn(async () => undefined);

    await expect(
      deleteAllRentSightData({
        deleteCloudAccount: async () => {
          throw new Error('Retry the backend request.');
        },
        deleteAuthenticationAccount,
        clearLocalData,
      }),
    ).rejects.toThrow('Retry the backend request.');

    expect(deleteAuthenticationAccount).not.toHaveBeenCalled();
    expect(clearLocalData).not.toHaveBeenCalled();
  });

  it('clears local data directly when there is no signed-in account', async () => {
    const clearLocalData = vi.fn(async () => undefined);

    await deleteAllRentSightData({ clearLocalData });

    expect(clearLocalData).toHaveBeenCalledOnce();
  });
});
