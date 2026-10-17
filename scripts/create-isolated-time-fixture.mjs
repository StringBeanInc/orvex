// Explicit opt-in synthetic demo only. This is never called by application startup.
if(!process.argv.includes('--create-synthetic-phase3d-demo'))throw Error('Use --create-synthetic-phase3d-demo to explicitly create synthetic accounts on the dedicated Phase 3D ports.');
const {timeFixture}=await import('../emulator-tests/phase3d-fixtures.mjs');
const fixture=await timeFixture();
console.log('Synthetic Phase 3D demo only: http://127.0.0.1:15179/account');
console.log('This is not recovered company data. No real company records were imported.');
for(const role of ['owner','tech','admin']){const {email,password,uid}=fixture[role];console.log(JSON.stringify({role,email,password,uid}));}
