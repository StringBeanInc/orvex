import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';
import {doc,setDoc} from 'firebase/firestore';
export default async function(){
 const env=await initializeTestEnvironment({projectId:'demo-orvex-auth-tests',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'platformConfig','publicSignup'),{enabled:true}));await env.cleanup();
 // Preserve all existing workspace records; only close the local user's signup gate.
 const main=await initializeTestEnvironment({projectId:'demo-orvex',firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
 await main.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'platformConfig','publicSignup'),{enabled:false}));await main.cleanup();
}
