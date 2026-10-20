import {collection,doc,getDocFromServer,getDocsFromServer} from 'firebase/firestore';
import {getCompanyCloudServices} from '../firebase';
import {loadCompany} from '../auth/company';
import {companyScope} from './directoryRepository';

// Only these existing rule-authorized reads replace callables. No employee writes.
export async function sparkApi(name:string,input:unknown){
 const {auth,db}=await getCompanyCloudServices(),user=auth.currentUser;
 if(!user?.emailVerified)throw Error('Verified sign-in required.');
 if(name==='companyMemberships'){
  const link=await getDocFromServer(doc(db,'users',user.uid));
  const links=await getDocsFromServer(collection(db,'users',user.uid,'companyMemberships'));
  const ids=[...new Set([link.data()?.companyId,...links.docs.map(d=>d.id)].filter(Boolean))];
  const companies=[];
  for(const id of ids){try{const c=await loadCompany(user,id);if(c)companies.push(c);}catch(e){if((e as {code?:string}).code!=='permission-denied')throw e;}}
  return {companies};
 }
 if(name==='employeeAssignments'){
  const {cid}=await companyScope(String((input as {companyId?:string})?.companyId||''));
  const company=await loadCompany(user,cid);
  // Existing rules permit only Owners to read raw employee profiles.
  if(company?.membershipRole!=='Owner')return {employees:[]};
  const rows=await getDocsFromServer(collection(db,'organizations',cid,'employees'));
  return {employees:rows.docs.filter(d=>d.data().active!==false).map(d=>({id:d.id,uid:d.id,companyId:cid,name:d.data().name,role:d.data().role,active:true}))};
 }
 throw Error('Employee onboarding, role changes and technician updates require a trusted backend and are unavailable in the Spark beta.');
}
