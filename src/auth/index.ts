import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  deleteUser,
  GoogleAuthProvider,
  getAuth,
  indexedDBLocalPersistence,
  onAuthStateChanged,
  reauthenticateWithCredential,
  setPersistence,
  signInWithCredential,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth/web-extension';
import { firebaseConfig, firebaseIsConfigured } from './config';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface GoogleCredentialMessage {
  type: 'FIREBASE_GOOGLE_SIGN_IN';
}

interface GoogleCredentialResponse {
  idToken?: string;
  accessToken?: string;
  error?: string;
}

const app = firebaseIsConfigured()
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : undefined;

export const auth = app ? getAuth(app) : undefined;
const authPersistenceReady = auth
  ? setPersistence(auth, indexedDBLocalPersistence)
  : Promise.resolve();

const publicUser = (user: User | null): AuthUser | null =>
  user
    ? {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      }
    : null;

export const observeAuthUser = (
  listener: (user: AuthUser | null) => void,
): (() => void) => {
  if (!auth) {
    listener(null);
    return () => undefined;
  }
  let unsubscribe: (() => void) | undefined;
  let active = true;
  void authPersistenceReady.then(() => {
    if (active)
      unsubscribe = onAuthStateChanged(auth, (user) =>
        listener(publicUser(user)),
      );
  });
  return () => {
    active = false;
    unsubscribe?.();
  };
};

export const getCurrentUser = (): AuthUser | null =>
  publicUser(auth?.currentUser ?? null);

async function requestGoogleCredential() {
  const response = (await chrome.runtime.sendMessage({
    type: 'FIREBASE_GOOGLE_SIGN_IN',
  } satisfies GoogleCredentialMessage)) as GoogleCredentialResponse;
  if (response.error) throw new Error(response.error);
  if (!response.idToken && !response.accessToken)
    throw new Error('Google sign-in did not return a Firebase credential.');

  return GoogleAuthProvider.credential(response.idToken, response.accessToken);
}

export async function signInWithGoogle(): Promise<AuthUser> {
  if (!auth) throw new Error('Firebase Authentication is not configured.');
  await authPersistenceReady;
  const credential = await requestGoogleCredential();
  const result = await signInWithCredential(auth, credential);
  return publicUser(result.user)!;
}

const errorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null
    ? String(Reflect.get(error, 'code') ?? '') || undefined
    : undefined;

export async function deleteCurrentUser(): Promise<void> {
  if (!auth) throw new Error('Firebase Authentication is not configured.');
  await authPersistenceReady;
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again to finish deleting your data.');

  try {
    await deleteUser(user);
  } catch (error: unknown) {
    if (errorCode(error) !== 'auth/requires-recent-login')
      throw new Error(
        'Your cloud data was deleted, but RentSight could not finish deleting your sign-in. Try Delete all data again.',
        { cause: error },
      );
    try {
      await reauthenticateWithCredential(user, await requestGoogleCredential());
      await deleteUser(user);
    } catch (reauthenticationError: unknown) {
      throw new Error(
        'Your cloud data was deleted, but RentSight could not finish deleting your sign-in. Try Delete all data again.',
        { cause: reauthenticationError },
      );
    }
  }
}

export async function signOut(): Promise<void> {
  if (auth) {
    await authPersistenceReady;
    await firebaseSignOut(auth);
  }
}

export async function getFirebaseIdToken(): Promise<string | undefined> {
  if (!auth) return undefined;
  await authPersistenceReady;
  await auth.authStateReady();
  // getIdToken refreshes an expired token and otherwise returns the current
  // valid Firebase ID token. Tokens themselves are never stored by RentSight.
  return auth.currentUser?.getIdToken();
}
