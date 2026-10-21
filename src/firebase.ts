import {initializeAppCheck,ReCaptchaEnterpriseProvider} from 'firebase/app-check';
import {getFunctions,connectFunctionsEmulator} from 'firebase/functions';
const phase3d=import.meta.env.VITE_FIREBASE_EMULATOR_PROJECT==='demo-orvex-phase3d-tests';
const phase3c=import.meta.env.VITE_FIREBASE_EMULATOR_PROJECT==='demo-orvex-phase3c-tests';
const isolated=import.meta.env.VITE_FIREBASE_EMULATOR_PROJECT==='demo-orvex-phase3b-tests';
export const emulatorAuthPort=phase3d?19499:phase3c?9299:isolated?9199:9099;
export const emulatorFirestorePort=phase3d?18380:phase3c?8280:isolated?8180:8080;
export const emulatorProject=phase3d?'demo-orvex-phase3d-tests':phase3c?'demo-orvex-phase3c-tests':isolated?'demo-orvex-phase3b-tests':import.meta.env.VITE_FIREBASE_EMULATOR_PROJECT==='demo-orvex-auth-tests'?'demo-orvex-auth-tests':'demo-orvex';
import {initializeApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,browserLocalPersistence,setPersistence} from 'firebase/auth';
import {initializeFirestore,connectFirestoreEmulator} from 'firebase/firestore';
export const hostedBeta=import.meta.env.VITE_FIREBASE_MODE==='hosted-beta';
// Hosted beta defaults to Firestore-only: no paid backend calls.
export const hostedSpark=hostedBeta&&import.meta.env.VITE_FIREBASE_BACKEND!=='functions';
function hostedConfig(){
 const e=import.meta.env;
 const approvedOrigins=e.DEV
  ? ['localhost','127.0.0.1']
  : ['orvex-iota.vercel.app','orvex-git-firebase-preparation-stringbeaninc.vercel.app','orvex-2f496.web.app','orvex-2f496.firebaseapp.com'];
 if(!approvedOrigins.includes(location.hostname)||e.VITE_FIREBASE_PROJECT_ID!=='orvex-2f496'||e.VITE_FIREBASE_AUTH_DOMAIN!=='orvex-2f496.firebaseapp.com'||!e.VITE_FIREBASE_API_KEY||!e.VITE_FIREBASE_APP_ID||!e.VITE_FIREBASE_APPCHECK_SITE_KEY)throw new Error('Hosted beta configuration is incomplete or not approved for this origin.');
 return {apiKey:e.VITE_FIREBASE_API_KEY,projectId:e.VITE_FIREBASE_PROJECT_ID,authDomain:e.VITE_FIREBASE_AUTH_DOMAIN,appId:e.VITE_FIREBASE_APP_ID};
}
let services: ReturnType<typeof initialize> | undefined;
function initialize(){
 if(hostedBeta){const app=initializeApp(hostedConfig(),'company-hosted-beta');initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});return {auth:getAuth(app),db:initializeFirestore(app,{})};}
 if(!import.meta.env.DEV || !['localhost','127.0.0.1'].includes(location.hostname))throw new Error('Company accounts are available only in local emulator development. Production access is disabled.');
 const app=initializeApp({apiKey:'demo-orvex-key',projectId:emulatorProject,authDomain:`${emulatorProject}.firebaseapp.com`},'company-emulator');
 const auth=getAuth(app);connectAuthEmulator(auth,`http://127.0.0.1:${emulatorAuthPort}`);
 const db=initializeFirestore(app,{experimentalForceLongPolling:true});connectFirestoreEmulator(db,'127.0.0.1',emulatorFirestorePort);
 return {auth,db};
}
export async function getCompanyCloudServices(){
 if(hostedBeta){services??=initialize();await setPersistence(services.auth,browserLocalPersistence);return services;}
 if(!import.meta.env.DEV)throw new Error('Production company access is disabled.');
 try{const results=await Promise.all([fetch(`http://127.0.0.1:${emulatorAuthPort}/emulator/v1/projects/${emulatorProject}/config`,{signal:AbortSignal.timeout(3000)}),fetch(`http://127.0.0.1:${emulatorFirestorePort}/`,{signal:AbortSignal.timeout(3000)})]);if(results.some(r=>r.status>=500))throw new Error();}catch{throw new Error('Local Firebase emulators are unavailable. Start Auth and Firestore, then retry. No production connection was attempted.');}
 services??=initialize();await setPersistence(services.auth,browserLocalPersistence);return services;
}

let pricingFunctions:ReturnType<typeof getFunctions>|undefined;
export async function getPricingFunctions(){if(hostedSpark)throw new Error('This feature requires a trusted backend and is disabled in the Spark beta.');const {auth}=await getCompanyCloudServices();if(!pricingFunctions){pricingFunctions=getFunctions(auth.app,'us-central1');if(!hostedBeta)connectFunctionsEmulator(pricingFunctions,'127.0.0.1',phase3d?15401:phase3c?5301:5001);}return pricingFunctions;}
