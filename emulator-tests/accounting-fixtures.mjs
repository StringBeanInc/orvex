export {fixture,identity,raw,patchFixture,environment,callFunction} from './phase3e-fixtures.mjs';
import {callFunction,raw} from './phase3e-fixtures.mjs';
import {command,draft} from './financial-fixtures.mjs';
export const ok=r=>{if(r.status!==200)throw Error(JSON.stringify(r));return r.body.result;};
export const account=(u,action,data={},op=crypto.randomUUID())=>callFunction('accountingCommand',u,{companyId:u?.cid,action,operationId:op,note:'Synthetic accounting boundary test',...data});
export const view=async u=>ok(await callFunction('accountingView',u,{companyId:u.cid}));
export async function connect(u){const rev=(await view(u)).connection?.revision||0,b=ok(await account(u,'beginConnect',{revision:rev}));ok(await account(u,'completeConnect',{...b,mockConsent:'approve'}));return view(u);}
export async function configured(u){await connect(u);const v=await view(u);ok(await account(u,'configure',{revision:v.connection.revision,mapping:{salesItemRef:'mock-service',taxCodeRef:'mock-tax',discountAccountRef:'mock-discount',taxMode:'explicit'}}));}
export async function synchronize(u,kind,id,scenario='success'){const q=ok(await account(u,kind==='customer'?'queueCustomer':'queueInvoice',{sourceId:id,scenario}));ok(await account(u,'processJob',{jobId:q.jobId}));return raw(u.cid,'qboJobs/'+q.jobId);}
export async function issued(u,changes={}){const r=ok(await command(u,'invoice','saveDraft',{draft:draft(changes)}));return ok(await command(u,'invoice','issue',{id:r.id,revision:r.revision}));}
