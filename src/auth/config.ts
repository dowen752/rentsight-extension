import type { FirebaseOptions } from 'firebase/app';

const value = (name: string): string =>
  String(import.meta.env[name] ?? '').trim();

export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyBLJQ0CrK2qnETRomb0iJl4uqyuxTBNMcg',
  authDomain: 'rentsight-4222d.firebaseapp.com',
  projectId: 'rentsight-4222d',
  storageBucket: 'rentsight-4222d.firebasestorage.app',
  messagingSenderId: '112935367140',
  appId: '1:112935367140:web:fe397af8055048682097f1',
  measurementId: 'G-LLLV6939P2',
};

export const PRODUCTION_FIREBASE_AUTH_HOST_URL =
  'https://auth.umbrellabrand.co/rentsight/auth-host.html';
export const FIREBASE_AUTH_HOST_URL =
  value('VITE_FIREBASE_AUTH_HOST_URL') || PRODUCTION_FIREBASE_AUTH_HOST_URL;
export const PRODUCTION_RENT_SIGHT_EXTENSION_ID =
  'pkcmgccphdnmmdjhipgiohmolkailema';
export const RENT_SIGHT_EXTENSION_ID =
  value('VITE_RENTSIGHT_EXTENSION_ID') || PRODUCTION_RENT_SIGHT_EXTENSION_ID;

export const firebaseIsConfigured = (): boolean =>
  Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
  );

export const federatedAuthIsConfigured = (): boolean =>
  Boolean(FIREBASE_AUTH_HOST_URL && RENT_SIGHT_EXTENSION_ID);
