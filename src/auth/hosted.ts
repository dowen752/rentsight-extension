import { getApps, initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, signInWithPopup } from 'firebase/auth';
import { firebaseConfig, RENT_SIGHT_EXTENSION_ID } from './config';

const app = getApps()[0] ?? initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const parentOrigin = document.location.ancestorOrigins[0];
const allowedParentOrigin = `chrome-extension://${RENT_SIGHT_EXTENSION_ID}`;

globalThis.addEventListener('message', async (event: MessageEvent) => {
  if (
    !parentOrigin ||
    parentOrigin !== allowedParentOrigin ||
    event.origin !== allowedParentOrigin ||
    event.source !== globalThis.parent ||
    event.data?.type !== 'FIREBASE_GOOGLE_SIGN_IN'
  )
    return;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    globalThis.parent.postMessage(
      {
        idToken: credential?.idToken,
        accessToken: credential?.accessToken,
      },
      allowedParentOrigin,
    );
  } catch (error: unknown) {
    globalThis.parent.postMessage(
      {
        error:
          error instanceof Error ? error.message : 'Google sign-in failed.',
      },
      allowedParentOrigin,
    );
  }
});
