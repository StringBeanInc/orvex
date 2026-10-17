// Explicitly open/close only the disposable Phase 3C registration preview gate.
// No import, reset, original project, or business record writes.
const mode=process.argv[2];if(!['enable','disable'].includes(mode))throw Error('Usage: node scripts/local-registration-gate.mjs enable|disable');
const url='http://127.0.0.1:8280/v1/projects/demo-orvex-phase3c-tests/databases/(default)/documents/platformConfig/publicSignup?updateMask.fieldPaths=enabled';
const r=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body:JSON.stringify({fields:{enabled:{booleanValue:mode==='enable'}}}),signal:AbortSignal.timeout(15000)});
if(!r.ok)throw Error('Synthetic signup gate update failed: '+r.status);console.log('Synthetic demo-orvex-phase3c-tests public registration '+mode+'d. No original-company records were accessed.');
