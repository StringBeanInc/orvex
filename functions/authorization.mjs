import {HttpsError} from 'firebase-functions/v2/https';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {validateHostedRuntime} from './hostedRuntime.mjs';
import {activeMember,allowed} from './shared/permissions.js';
export {allowed,activeMember};
export const deny=(code,message)=>{throw new HttpsError(code,message)};
export function safeId(v){if(typeof v!=='string'||!/^[-A-Za-z0-9_]{1,128}$/.test(v))deny('invalid-argument','Invalid company or record reference.');return v;}
export function localDatabase(){const project=process.env.GCLOUD_PROJECT||process.env.GCP_PROJECT,p=project==='demo-orvex-phase3c-tests'?['127.0.0.1:8280','127.0.0.1:9299']:project==='demo-orvex-phase3d-tests'?['127.0.0.1:18380','127.0.0.1:19499']:project==='demo-orvex'?['127.0.0.1:8080','127.0.0.1:9099']:null;if(process.env.FUNCTIONS_EMULATOR!=='true'||!p||process.env.FIRESTORE_EMULATOR_HOST!==p[0]||process.env.FIREBASE_AUTH_EMULATOR_HOST!==p[1])deny('failed-precondition','Employee backend is emulator-only. Production access is disabled.');if(!getApps().some(app=>app.name==='[DEFAULT]'))initializeApp({projectId:project});return getFirestore();}
export async function authorize(db,request,tx,permission){if(request.auth?.token.email_verified!==true)deny('unauthenticated','Verified authentication required.');const uid=request.auth.uid,cid=safeId(request.data?.companyId),root=db.doc('organizations/'+cid),[company,member]=await Promise.all([tx.get(root),tx.get(root.collection('members').doc(uid))]),m=member.data();if(!company.exists||company.data().companyId!==cid||m?.uid!==uid||m?.companyId!==cid||!activeMember(m)||permission&&!allowed(m,permission))deny('permission-denied','Active company membership and permission required.');return {uid,cid,root,company:company.data(),membership:m,can:p=>allowed(m,p)};}

// Only explicitly selected operational modules call this path. Other modules remain emulator-only.
export function betaDatabase(request){if(process.env.ORVEX_RUNTIME_MODE!=='hosted-beta')return localDatabase();try{validateHostedRuntime(process.env,request);}catch{deny('failed-precondition','Hosted beta runtime or attestation is not approved.');}if(!getApps().some(a=>a.name==='[DEFAULT]'))initializeApp({projectId:'orvex-2f496'});return getFirestore();}
