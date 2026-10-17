import {authorize} from './authorization.mjs';
export {financialCommand,financialView,financialWorkOrderScope} from './financial.mjs';
import {validatePricingInput} from './pricingValidation.mjs';
export {validatePricingInput} from './pricingValidation.mjs';
// Local emulator only. Production enablement requires a separately reviewed backend.
export {timekeepingCommand,timekeepingView} from './timekeeping.mjs';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {isDeepStrictEqual} from 'node:util';
import {totals,runningPricing,extended,MAX_LINES,MAX_PRICE_CENTS,MAX_QUANTITY_MILLI} from './shared/pricingModel.js';
const fail=(code,message)=>{throw new HttpsError(code,message)};
function runtime(){const project=process.env.GCLOUD_PROJECT||process.env.GCP_PROJECT;const profile=project==='demo-orvex-phase3d-tests'?['127.0.0.1:18380','127.0.0.1:19499']:project==='demo-orvex-phase3c-tests'?['127.0.0.1:8280','127.0.0.1:9299']:project==='demo-orvex'?['127.0.0.1:8080','127.0.0.1:9099']:null;if(process.env.FUNCTIONS_EMULATOR!=='true'||!profile||process.env.FIRESTORE_EMULATOR_HOST!==profile[0]||process.env.FIREBASE_AUTH_EMULATOR_HOST!==profile[1])fail('failed-precondition','Pricing backend is restricted to the explicitly configured local emulators. Production access is disabled.');if(!getApps().length)initializeApp({projectId:project});return getFirestore();}
export const saveWorkOrderPricing=onCall({region:'us-central1',timeoutSeconds:30,maxInstances:2},async request=>{
 const db=runtime();if(!request.auth||request.auth.token.email_verified!==true)fail('unauthenticated','Verified sign-in is required.');const {draft,amounts,note}=validatePricingInput(request.data),uid=request.auth.uid,requested=request.data.companyId,workOrderId=request.data.workOrderId,revision=request.data.revision,eventId=crypto.randomUUID();
 await db.runTransaction(async tx=>{const scope=await authorize(db,request,tx,'pricing.manage'),root=scope.root,cid=scope.cid;if(!scope.can('costs.read'))fail('permission-denied','Catalog management requires separate internal-cost authorization.');const [parent,current]=await Promise.all([tx.get(root.collection('workOrders').doc(workOrderId)),tx.get(root.collection('workOrders').doc(workOrderId).collection('pricing').doc('current'))]);const scopeLock=await tx.get(root.collection('financialWorkOrders').doc(workOrderId));if(scopeLock.data()?.managedScope===true)fail('failed-precondition','Approved financial scope is locked. Use an approved change order to alter charges.');if(!parent.exists||parent.data().companyId!==cid)fail('not-found','Work order does not exist in this company.');const old=current.exists?current.data():null;if((old?.revision||0)!==revision)fail('aborted','Save conflict: pricing changed. Refresh and review your draft.');
 for(const id of draft.order){const line=draft.items[id],previous=old?.items?.[id];if(previous){if(previous.sourceId!==line.sourceId||previous.rateKind!==line.rateKind||!isDeepStrictEqual(previous.snapshot,line.snapshot))fail('invalid-argument','Historical catalog snapshots cannot be rewritten.');}else if(line.snapshot.kind!=='custom'){const source=await tx.get(root.collection('pricingCatalog').doc(line.sourceId)),item=source.data();if(!source.exists||item.companyId!==cid||item.kind!==line.snapshot.kind||item.active!==true)fail('failed-precondition','Choose an active catalog item from this company.');if(line.rateKind==='overtime'&&item.kind!=='labor')fail('invalid-argument','Overtime is available only for labor.');const expected={kind:item.kind,code:item.code,description:item.description,priceCents:line.rateKind==='overtime'?item.overtimePriceCents:item.sellingPriceCents};if(!isDeepStrictEqual(expected,line.snapshot))fail('failed-precondition','Catalog pricing changed before this charge was saved. Remove and re-add the item from the updated catalog.');}}
 const now=FieldValue.serverTimestamp(),next={...draft,...amounts,companyId:cid,workOrderId,schemaVersion:1,currency:'USD',revision:revision+1,createdAt:old?.createdAt||now,createdBy:old?.createdBy||uid,updatedAt:now,updatedBy:uid,lastEventId:eventId};tx.set(current.ref,next);tx.set(parent.ref.collection('pricingHistory').doc(eventId),{id:eventId,companyId:cid,workOrderId,revision:revision+1,actorUid:uid,at:now,note,beforeTotalCents:old?.totalCents??null,snapshot:next});
 });return {workOrderId,revision:revision+1};
});

export {employeeCommand,employeeView,employeeInvitationInfo,companyMemberships,employeeAssignments} from './employees.mjs';
export {technicianJobs,technicianJobUpdate,workOrderServiceReports} from './technicianJobs.mjs';

export {accountingView,accountingCommand} from './accounting.mjs';

export {integrationApi,integrationView,integrationCommand,integrationWorkOrderEvents} from './integrations.mjs';

export {dispatchView,dispatchCommand} from './dispatch.mjs';

export {saveCompanyWorkOrder} from './workOrderCommands.mjs';
