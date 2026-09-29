export interface DeleteAllDataDependencies {
  deleteCloudAccount?: () => Promise<void>;
  deleteAuthenticationAccount?: () => Promise<void>;
  clearLocalData: () => Promise<void>;
}

export async function deleteAllRentSightData({
  deleteCloudAccount,
  deleteAuthenticationAccount,
  clearLocalData,
}: DeleteAllDataDependencies): Promise<void> {
  if (deleteCloudAccount || deleteAuthenticationAccount) {
    if (!deleteCloudAccount || !deleteAuthenticationAccount)
      throw new Error('Account deletion is not fully configured.');
    await deleteCloudAccount();
    await deleteAuthenticationAccount();
  }
  await clearLocalData();
}
