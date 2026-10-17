import {onboardingInput} from './companyOnboarding';
import type {Membership} from '../company/permissions';
import {activeMember} from '../company/permissions';
import {requirePublicSignup} from './signupGate';
import {doc,getDoc,getDocFromServer,writeBatch,serverTimestamp,collection} from 'firebase/firestore';
import type {User} from 'firebase/auth';
import {getCompanyCloudServices} from '../firebase';
export type Company={companyId:string;name:string;ownerName:string;ownerUid:string;phone?:string;timeZone?:string;membershipRole?:string;membership?:Membership};
export async function loadCompany(user:User,selectedCompanyId?:string):Promise<Company|null>{
 if(!user.emailVerified)return null;
 const {db}=await getCompanyCloudServices();const link=await getDocFromServer(doc(db,'users',user.uid));if(!link.exists()&&!selectedCompanyId)return null;
 const cid=selectedCompanyId||link.data()?.companyId;const membership=await getDocFromServer(doc(db,'organizations',cid,'members',user.uid));if(!membership.exists()||!activeMember(membership.data()))throw new Error('Active company membership does not match this workspace.');
 const company=await getDocFromServer(doc(db,'organizations',cid));if(!company.exists())throw new Error('Company setup is incomplete.');return {...company.data(),membershipRole:membership.data().role,membership:membership.data()} as Company;
}
export async function createCompany(user:User,name:string,ownerName:string,phone='',timeZone='America/Chicago'){
 const details=onboardingInput(name,ownerName,phone,timeZone);
 await user.reload();await user.getIdToken(true);if(!user.emailVerified)throw new Error('Verify your email before creating the company.');
 const existing=await loadCompany(user);if(existing)return existing;
 await requirePublicSignup();
 const {db}=await getCompanyCloudServices();const ref=doc(collection(db,'organizations'));const cid=ref.id;const batch=writeBatch(db);const createdAt=serverTimestamp();
 batch.set(ref,{companyId:cid,...details,ownerUid:user.uid,schemaVersion:1,createdAt});
 batch.set(doc(db,'users',user.uid),{companyId:cid,createdAt});
 batch.set(doc(db,'organizations',cid,'members',user.uid),{uid:user.uid,companyId:cid,role:'Owner',active:true,createdAt});
 batch.set(doc(db,'organizations',cid,'employees',user.uid),{uid:user.uid,companyId:cid,role:'Owner',name:ownerName.trim(),createdAt});
 try{await batch.commit();}catch(e){const recovered=await loadCompany(user);if(recovered)return recovered;throw e;}return {...(await getDoc(ref)).data(),membershipRole:'Owner'} as Company;
}
