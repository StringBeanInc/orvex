
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (
  import.meta.env.VITE_FIREBASE_MODE !== 'hosted-beta' ||
  firebaseConfig.projectId !== 'orvex-2f496' ||
  firebaseConfig.authDomain !== 'orvex-2f496.firebaseapp.com' ||
  !firebaseConfig.apiKey ||
  !firebaseConfig.appId
) {
  throw new Error('ORVEX Firebase configuration is incomplete.');
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

export { app };

import { getFirestore } from 'firebase/firestore';
export const db = getFirestore(app);
