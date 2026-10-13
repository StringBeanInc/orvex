import {requirePublicSignup} from './signupGate';
import {doc,getDoc,getDocFromServer,writeBatch,serverTimestamp,collection} from 'firebase/firestore';
import type {User} from 'firebase/auth';
import {getCompanyCloudServices} from '../firebase';
export type Company={companyId:string;name:string;ownerName:string;ownerUid:string};
export async function loadCompany(user:User):Promise<Company|null>{
 if(!user.emailVerified)return null;
 const {db}=await getCompanyCloudServices();const link=await getDocFromServer(doc(db,'users',user.uid));if(!link.exists())return null;
 const cid=link.data().companyId;const membership=await getDocFromServer(doc(db,'organizations',cid,'members',user.uid));if(!membership.exists()||membership.data().active!==true)throw new Error('Active company membership is required.');
 const company=await getDocFromServer(doc(db,'organizations',cid));if(!company.exists())throw new Error('Company setup is incomplete.');return company.data() as Company;
}
export async function createCompany(user:User,name:string,ownerName:string){
 await user.reload();await user.getIdToken(true);if(!user.emailVerified)throw new Error('Verify your email before creating the company.');
 const existing=await loadCompany(user);if(existing)return existing;
 await requirePublicSignup();
 const {db}=await getCompanyCloudServices();const ref=doc(collection(db,'organizations'));const cid=ref.id;const batch=writeBatch(db);const createdAt=serverTimestamp();
 batch.set(ref,{companyId:cid,name:name.trim(),ownerName:ownerName.trim(),ownerUid:user.uid,schemaVersion:1,createdAt});
 batch.set(doc(db,'users',user.uid),{companyId:cid,createdAt});
 batch.set(doc(db,'organizations',cid,'members',user.uid),{uid:user.uid,companyId:cid,role:'Owner',active:true,createdAt});
 batch.set(doc(db,'organizations',cid,'employees',user.uid),{uid:user.uid,companyId:cid,role:'Owner',name:ownerName.trim(),createdAt});
 try{await batch.commit();}catch(e){const recovered=await loadCompany(user);if(recovered)return recovered;throw e;}return (await getDoc(ref)).data() as Company;
}
