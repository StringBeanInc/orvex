export const emulatorProject=import.meta.env.VITE_FIREBASE_EMULATOR_PROJECT==='demo-orvex-auth-tests'?'demo-orvex-auth-tests':'demo-orvex';
import {initializeApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,browserLocalPersistence,setPersistence} from 'firebase/auth';
import {initializeFirestore,connectFirestoreEmulator} from 'firebase/firestore';
let services: ReturnType<typeof initialize> | undefined;
function initialize(){
 if(!import.meta.env.DEV || !['localhost','127.0.0.1'].includes(location.hostname))throw new Error('Company accounts are available only in local emulator development. Production access is disabled.');
 const app=initializeApp({apiKey:'demo-orvex-key',projectId:emulatorProject,authDomain:`${emulatorProject}.firebaseapp.com`},'company-emulator');
 const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099');
 const db=initializeFirestore(app,{experimentalForceLongPolling:true});connectFirestoreEmulator(db,'127.0.0.1',8080);
 return {auth,db};
}
export async function getCompanyCloudServices(){
 if(!import.meta.env.DEV)throw new Error('Production company access is disabled.');
 try{const results=await Promise.all([fetch(`http://127.0.0.1:9099/emulator/v1/projects/${emulatorProject}/config`,{signal:AbortSignal.timeout(3000)}),fetch('http://127.0.0.1:8080/',{signal:AbortSignal.timeout(3000)})]);if(results.some(r=>r.status>=500))throw new Error();}catch{throw new Error('Local Firebase emulators are unavailable. Start Auth and Firestore, then retry. No production connection was attempted.');}
 services??=initialize();await setPersistence(services.auth,browserLocalPersistence);return services;
}
