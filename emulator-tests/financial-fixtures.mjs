export {fixture,timeFixture,identity,raw,patchFixture,environment,callPricing,callTime,goodFix,callFunction,project} from './phase3e-fixtures.mjs';
import {callFunction} from './phase3e-fixtures.mjs';
import {newFinancialDraft} from '../src/company/financialModel.ts';
import {emptyPricing,customLine,runningPricing} from '../src/company/pricingModel.ts';
export function charges(cents=10000){const l={...customLine(),description:'Maintenance service',unitPriceCents:cents,extendedCents:cents};return runningPricing({...emptyPricing(),items:{[l.id]:l},order:[l.id]});}
export const draft=(changes={})=>({...newFinancialDraft(),customerId:'c1',propertyId:'p1',title:'Facility maintenance',description:'Professional maintenance scope',pricing:charges(),...changes});
export async function command(user,kind,action,data={},operationId=crypto.randomUUID()){return callFunction('financialCommand',user,{companyId:user?.cid,kind,action,id:data.id||crypto.randomUUID(),revision:0,note:'Synthetic financial test operation',operationId,...data});}
export async function view(user,kind,id){return callFunction('financialView',user,{companyId:user?.cid,kind,id});}
