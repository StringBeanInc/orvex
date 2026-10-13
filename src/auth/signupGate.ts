import {doc,getDocFromServer} from 'firebase/firestore';
import {getCompanyCloudServices} from '../firebase';
import {publicSignupEnabled} from '../features';
export async function requirePublicSignup(){
 if(!publicSignupEnabled)throw new Error('Public company registration is temporarily disabled.');
 const {db}=await getCompanyCloudServices();const gate=await getDocFromServer(doc(db,'platformConfig','publicSignup'));
 if(!gate.exists()||gate.data().enabled!==true)throw new Error('Public company registration is temporarily disabled by the server.');
}
