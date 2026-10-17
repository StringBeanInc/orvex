// Deliberately NO fetch, network client, OAuth URL, SDK or real token implementation.
// All effects are returned as data for a single emulator transaction.
import {createHash} from 'node:crypto';
export const fingerprint=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function mockRealm(cid){return 'mock-'+fingerprint(cid).slice(0,32);}
export function emptyMock(){return {schema:'phase3g-mock-v1',customers:{},invoices:{},payments:{},receipts:{}};}
export function sendMock(state,job,realm){
 const store=structuredClone(state),key=job.requestKey,prior=store.receipts[key],payloadHash=fingerprint(job.payload);
 if(prior){if(prior.payloadHash!==payloadHash)return {store,status:'conflict',message:'Idempotency payload changed; review required.'};return {store,status:'succeeded',remote:prior.remote};}
 if(job.scenario==='rejected')return {store,status:'failed',message:'Mock accounting service rejected this export.'};
 if(job.scenario==='rate-limit-always'||job.scenario==='rate-limit-once'&&job.attempts===0)return {store,status:'retry',message:'Mock rate limit; retry later.',retryAfterMs:2000};
 const collection=job.kind==='customer'?'customers':'invoices';
 const candidates=job.kind==='customer'?Object.values(store.customers).filter(c=>c.name.toLowerCase()===job.payload.name.toLowerCase()):[];
 if(candidates.length&&!job.reviewDecision)return {store,status:'conflict',message:'Existing accounting customer names require explicit review.',candidates:candidates.map(c=>({id:c.id,name:c.name,email:c.email}))};
 let remote;
 if(job.reviewDecision==='link-existing'){
  remote=store.customers[job.reviewRemoteId];if(!remote||remote.realm!==realm)return {store,status:'conflict',message:'Selected mock customer is unavailable in this realm.'};
 }else{
  const id='mock-'+collection.slice(0,-1)+'-'+fingerprint(key).slice(0,24);
  remote={...structuredClone(job.payload),id,realm,syncToken:'1'};store[collection][id]=remote;
 }
 if(job.scenario==='tax-mismatch'&&job.kind==='invoice'){remote.tax.amountCents+=1;remote.totalCents+=1;}
 store.receipts[key]={payloadHash,remote:structuredClone(remote)};
 if(job.scenario==='timeout-after-create-once'&&job.attempts===0)return {store,status:'retry',message:'Mock remote committed but response timed out; retry uses the same request key.'};
 return {store,status:'succeeded',remote};
}
