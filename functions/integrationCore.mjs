// Local integration primitives. There is deliberately no HTTP delivery transport.
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export const scopes=['company:read','customers:read','properties:read','work_orders:read','work_orders:update','assignments:write'];
export const eventTypes=['work_order.created','work_order.updated','work_order.status_changed','work_order.assigned'];
export const hash=v=>createHash('sha256').update(v).digest('hex');
export const secret=()=>randomBytes(32).toString('base64url');
export const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function sign(key,timestamp,body){return createHmac('sha256',key).update(`${timestamp}.${body}`).digest('hex');}
export function verify(key,timestamp,body,signature,now=Date.now(),seen=new Set()){
 if(!/^\d{13}$/.test(String(timestamp))||Math.abs(now-Number(timestamp))>300000||!equal(sign(key,timestamp,body),signature))return false;
 let e;try{e=JSON.parse(body);}catch{return false;}if(typeof e.id!=='string'||!e.id||e.id.length>128||seen.has(e.id))return false;seen.add(e.id);return true;
}
export const backoff=attempt=>Math.min(60000,1000*2**Math.max(0,attempt-1));
export function mockDestination(value){if(typeof value!=='string'||!/^mock:\/\/[a-z0-9-]{1,60}$/.test(value))throw Error('Only mock:// receiver names are permitted. No network destinations are accepted.');return value;}
export function pick(v,keys){return Object.fromEntries(keys.filter(k=>v?.[k]!==undefined).map(k=>[k,v[k]]));}
export const orderPublic=w=>pick(w,['id','revision','number','customerId','propertyId','status','priority','assignedTechnicianId','scheduledDate','dueDate']);
export function workEvents(cid,id,before,after){if(!after||after.companyId!==cid||after.schemaVersion!==1||!Number.isSafeInteger(after.revision))return [];const types=[before?'work_order.updated':'work_order.created'];if(before&&before.status!==after.status)types.push('work_order.status_changed');if(after.assignedTechnicianId&&(!before||before.assignedTechnicianId!==after.assignedTechnicianId))types.push('work_order.assigned');return types.map(type=>({id:hash([cid,id,after.revision,type].join(':')),companyId:cid,type,schemaVersion:1,occurredAtMs:after.updatedAt?.toMillis?.()||Date.now(),data:orderPublic({...after,id})}));}
