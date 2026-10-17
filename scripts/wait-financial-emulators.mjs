// Readiness only: no credentials, company writes, imports, resets or production fallback.
const deadline=Date.now()+45000;let last='not ready',ready=false;
while(Date.now()<deadline){
 try{
  const auth=await fetch('http://127.0.0.1:9299/emulator/v1/projects/demo-orvex-phase3c-tests/config',{signal:AbortSignal.timeout(3000)});
  if(!auth.ok||(await auth.json()).signIn===undefined)throw Error('Auth emulator is not ready');
  const db=await fetch('http://127.0.0.1:8280/',{signal:AbortSignal.timeout(3000)});await db.text();if(!db.ok)throw Error('Firestore emulator is not ready');
  const fn=await fetch('http://127.0.0.1:5301/demo-orvex-phase3c-tests/us-central1/financialView',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:{companyId:'readiness-only',kind:'estimate'}}),signal:AbortSignal.timeout(5000)});
  const body=await fn.json();if(fn.status!==401||body.error?.status!=='UNAUTHENTICATED')throw Error('Financial function is not ready');
  ready=true;break;
 }catch(e){last=e.message;await new Promise(resolve=>setTimeout(resolve,500));}
}
if(!ready)throw Error('Isolated emulators unavailable: '+last+'. No production fallback, reset or import was attempted.');
console.log('Isolated financial emulators ready (unauthenticated probe rejected as expected).');
