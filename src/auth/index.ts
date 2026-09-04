import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  indexedDBLocalPersistence,
  onAuthStateChanged,
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

export async function signInWithGoogle(): Promise<AuthUser> {
  if (!auth) throw new Error('Firebase Authentication is not configured.');
  await authPersistenceReady;
  const response = (await chrome.runtime.sendMessage({
    type: 'FIREBASE_GOOGLE_SIGN_IN',
  } satisfies GoogleCredentialMessage)) as GoogleCredentialResponse;
  if (response.error) throw new Error(response.error);
  if (!response.idToken && !response.accessToken)
    throw new Error('Google sign-in did not return a Firebase credential.');

  const credential = GoogleAuthProvider.credential(
    response.idToken,
    response.accessToken,
  );
  const result = await signInWithCredential(auth, credential);
  return publicUser(result.user)!;
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
