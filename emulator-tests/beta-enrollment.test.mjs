import {test,before,after} from 'node:test';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,writeBatch,serverTimestamp,Timestamp,updateDoc} from 'firebase/firestore';
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-orvex-beta-rules-'+Date.now(),firestore:{host:'127.0.0.1',port:8280,rules:readFileSync('firestore.beta.rules','utf8')}});await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'platformConfig/publicSignup'),{enabled:true}));});
after(async()=>env?.cleanup());
const db=(uid,verified=true)=>env.authenticatedContext(uid,{email:uid+'@example.test',email_verified:verified}).firestore();
async function grant(uid,expiry=Date.now()+60000){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'betaEnrollment',uid+'@example.test'),{enabled:true,expiresAt:Timestamp.fromMillis(expiry)}));}
function create(uid,cid,store=db(uid)){const b=writeBatch(store),createdAt=serverTimestamp();b.set(doc(store,'organizations',cid),{companyId:cid,name:'Synthetic Beta',ownerName:'Owner',ownerUid:uid,schemaVersion:1,createdAt,phone:'',timeZone:'America/Chicago'});b.set(doc(store,'users',uid),{companyId:cid,createdAt});b.set(doc(store,'organizations',cid,'members',uid),{uid,companyId:cid,role:'Owner',active:true,createdAt});b.set(doc(store,'organizations',cid,'employees',uid),{uid,companyId:cid,role:'Owner',name:'Owner',createdAt});return b.commit();}
test('unapproved verified email cannot create company or self-approve',async()=>{await assertFails(create('outsider','denied'));await assertFails(setDoc(doc(db('outsider'),'betaEnrollment/outsider@example.test'),{enabled:true,expiresAt:Timestamp.fromMillis(Date.now()+60000)}));});
test('expired grants and unverified identities are rejected',async()=>{await grant('expired',Date.now()-60000);await assertFails(create('expired','expiredcompany'));await grant('unverified');await assertFails(create('unverified','unverifiedcompany',db('unverified',false)));});
test('approved email creates atomic Owner and cannot repeat bootstrap',async()=>{await grant('owner');await assertSucceeds(create('owner','owned'));await assertSucceeds(getDoc(doc(db('owner'),'organizations/owned')));await assertFails(create('owner','duplicate'));});
test('second approved company cannot read or change first company membership',async()=>{await grant('second');await assertSucceeds(create('second','secondcompany'));await assertFails(getDoc(doc(db('second'),'organizations/owned')));await assertFails(updateDoc(doc(db('second'),'organizations/owned/members/owner'),{role:'Owner'}));});
