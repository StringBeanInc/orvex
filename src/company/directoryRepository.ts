import {collection,doc,getDocsFromServer,runTransaction,serverTimestamp,Timestamp} from 'firebase/firestore';
import type {DocumentData} from 'firebase/firestore';
import {getCompanyCloudServices} from '../firebase';
import {loadCompany} from '../auth/company';
import type {Customer,Property} from '../data';
export type Metadata={companyId:string;revision:number;schemaVersion:1;createdAt:Timestamp;createdBy:string;updatedAt:Timestamp;updatedBy:string;deletedAt:Timestamp|null;deletedBy:string|null;recoverUntil:Timestamp|null};
export type CompanyCustomer=Omit<Customer,keyof Metadata> & Metadata & {propertyCount:number;relationshipMutationId:string};
export type CompanyProperty=Omit<Property,keyof Metadata> & Metadata & {workOrderCount?:number;workOrderMutationId?:string};
export type DirectoryRecord=CompanyCustomer|CompanyProperty;
export type DirectoryKind='customers'|'properties';
export function serverDeadline<T>(promise:Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>;return Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Server confirmation is unavailable. Refresh and review records before retrying. No local fallback was used.')),15000)})]).finally(()=>clearTimeout(timer));}
export async function companyScope(expectedCompanyId:string){const {auth,db}=await getCompanyCloudServices();const user=auth.currentUser;if(!user||!user.emailVerified)throw new Error('Verified sign-in is required.');const company=await serverDeadline(loadCompany(user,expectedCompanyId));if(!company||company.companyId!==expectedCompanyId)throw new Error('Verified company membership does not match this workspace.');return {db,uid:user.uid,cid:company.companyId};}
export async function loadDirectory(companyId:string){const {db,cid}=await companyScope(companyId);const results=await serverDeadline(Promise.all(['customers','properties'].map(k=>getDocsFromServer(collection(db,'organizations',cid,k)))));return {customers:results[0].docs.map(d=>({...d.data(),id:d.id}) as CompanyCustomer),properties:results[1].docs.map(d=>({...d.data(),id:d.id}) as CompanyProperty)};}
function fields(kind:DirectoryKind,input:Record<string,unknown>){const keys=kind==='customers'?['name','contact','email','phone','streetAddress','addressLine2','city','state','postalCode','country']:['name','address','city','state','postalCode','customerId','type'];return Object.fromEntries(keys.map(k=>[k,String(input[k]||'').trim()]));}
export async function saveDirectory(companyId:string,kind:DirectoryKind,id:string,expectedRevision:number,input:Record<string,unknown>,remove=false){
 const {db,cid,uid}=await companyScope(companyId);const ref=doc(db,'organizations',cid,kind,id);const expires=Date.now()+15000;
 await serverDeadline(runTransaction(db,async transaction=>{
  const snapshot=await transaction.get(ref);const previous=snapshot.exists()?snapshot.data():null;
  if((previous?.revision||0)!==expectedRevision)throw new Error('Save conflict: this record changed. Refresh the directory and review your edit.');
  if(previous?.deletedAt)throw new Error('This record has already been deleted.');
  if(remove&&!previous)throw new Error('Record no longer exists.');
  if(kind==='properties'&&previous&&previous.workOrderCount>0&&(remove||String(input.customerId)!==previous.customerId))throw new Error('Property has linked work orders. Move those work orders before deleting or changing its customer.');
  if(kind==='customers'&&remove&&previous!.propertyCount!==0)throw new Error('Customer has linked properties. Delete or reassign those properties first.');
  const now=serverTimestamp();const after:DocumentData={...fields(kind,input),id,companyId:cid,schemaVersion:1,revision:expectedRevision+1,createdAt:previous?.createdAt||now,createdBy:previous?.createdBy||uid,updatedAt:now,updatedBy:uid,deletedAt:remove?now:null,deletedBy:remove?uid:null,recoverUntil:remove?Timestamp.fromMillis(Date.now()+30*86400000):null};
  // Rules bound recoverUntil to 29–31 days after server request.time. Records are never automatically purged.
  if(kind==='customers'){after.propertyCount=previous?.propertyCount||0;after.relationshipMutationId=previous?.relationshipMutationId||'';}
  else {
   after.workOrderCount=previous?.workOrderCount||0;after.workOrderMutationId=previous?.workOrderMutationId||'';
   const oldCustomer=previous?.customerId as string|undefined,newCustomer=after.customerId as string;
   const changes=new Map<string,number>();if(oldCustomer&&(remove||oldCustomer!==newCustomer))changes.set(oldCustomer,-1);if(!remove&&(!previous||oldCustomer!==newCustomer))changes.set(newCustomer,(changes.get(newCustomer)||0)+1);
   const customerIds=Array.from(new Set([...changes.keys(),...(!remove?[newCustomer]:[])]));const parents=await Promise.all(customerIds.map(async customerId=>{const parent=doc(db,'organizations',cid,'customers',customerId);const current=await transaction.get(parent);if(!current.exists()||current.data().deletedAt)throw new Error('Select an active customer from this company.');return {parent,current:current.data(),customerId}}));
   for(const {parent,current,customerId} of parents){const delta=changes.get(customerId);if(delta)transaction.update(parent,{propertyCount:current.propertyCount+delta,relationshipMutationId:id,revision:current.revision+1,updatedAt:now,updatedBy:uid});}
  }
  if(Date.now()>=expires)throw new Error('Save expired before submission. Refresh and retry.');transaction.set(ref,after);
 },{maxAttempts:3}));
}
