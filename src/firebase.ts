
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const emulatorMode =
  import.meta.env.DEV &&
  import.meta.env.VITE_FIREBASE_EMULATOR_PROJECT === 'demo-orvex';

const validProject = emulatorMode
  ? firebaseConfig.projectId === 'demo-orvex'
  : firebaseConfig.projectId === 'orvex-2f496' &&
    firebaseConfig.authDomain === 'orvex-2f496.firebaseapp.com';

if (
  import.meta.env.VITE_FIREBASE_MODE !== 'hosted-beta' ||
  !validProject ||
  !firebaseConfig.apiKey ||
  !firebaseConfig.appId
) {
  throw new Error('ORVEX Firebase configuration is incomplete.');
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

if (emulatorMode) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true
  });
}

export { app };

import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
export const db = getFirestore(app);

if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATOR_PROJECT === 'demo-orvex') {
  if (firebaseConfig.projectId !== 'demo-orvex') {
    throw new Error('Emulator mode requires the isolated demo-orvex project.');
  }
  connectFirestoreEmulator(db, '127.0.0.1', 8180);
}


import {
  getFunctions,
  connectFunctionsEmulator
} from 'firebase/functions';

export const functions = getFunctions(app, 'us-central1');

if (emulatorMode) {
  connectFunctionsEmulator(
    functions,
    '127.0.0.1',
    5001
  );
}
