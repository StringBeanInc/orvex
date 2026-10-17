export {fixture,identity,callFunction,raw,patchFixture} from './phase3e-fixtures.mjs';
import {identity,callFunction,raw} from './phase3e-fixtures.mjs';
export const ok=r=>{if(r.status!==200)throw Error(JSON.stringify(r));return r.body.result;};
export const employeeCommand=(u,action,data={})=>callFunction('employeeCommand',u,{companyId:u.cid,action,operationId:crypto.randomUUID(),reason:'Synthetic browser membership review',...data});
export async function joined(owner,role='Technician',permissions=[]){const u={...await identity(),cid:owner.cid},i=ok(await employeeCommand(owner,'invite',{email:u.email,role,permissions}));ok(await employeeCommand(u,'acceptInvitation',{invitationId:i.invitationId,token:i.token,name:'Browser '+role}));return u;}
export async function updateEmployee(owner,u,changes={}){const m=await raw(owner.cid,'members/'+u.uid),e=await raw(owner.cid,'employees/'+u.uid);return employeeCommand(owner,'updateEmployee',{targetUid:u.uid,revision:m.revision||0,role:m.role,permissions:m.permissions||[],status:m.status||'active',name:e.name,phone:'',jobTitle:'',...changes});}
