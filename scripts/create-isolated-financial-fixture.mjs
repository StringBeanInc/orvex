// Explicit synthetic demo, never called by ORVEX startup. Does not recover company data.
if(!process.argv.includes('--create-synthetic-phase3e-demo'))throw Error('Use --create-synthetic-phase3e-demo to explicitly create a synthetic company on the isolated Phase 3C test ports.');
const {fixture}=await import('../emulator-tests/phase3e-fixtures.mjs');
const {email,password,uid}=await fixture();
console.log('Synthetic Phase 3E demo only: http://127.0.0.1:5177/account');
console.log('Not recovered company data. No original records were imported.');
console.log(JSON.stringify({role:'Owner',email,password,uid}));
