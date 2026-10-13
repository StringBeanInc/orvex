import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc} from 'firebase/firestore';
export default async function(){const env=await initializeTestEnvironment({projectId:'demo-orvex-auth-tests',firestore:{host:'127.0.0.1',port:8080}});await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'platformConfig','publicSignup'),{enabled:false}));await env.cleanup();}
