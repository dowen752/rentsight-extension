import { getFirebaseIdToken, observeAuthUser } from '../auth';
import { AccountSession } from './account';
import { RentSightBackendClient } from './client';

export const rentSightApi = new RentSightBackendClient({
  getAccessToken: getFirebaseIdToken,
});

export const accountSession = new AccountSession(
  { subscribe: observeAuthUser },
  rentSightApi,
);
