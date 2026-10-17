import {spawn} from 'node:child_process';
const files=['security.test.mjs','directory-rules.test.mjs','work-orders-rules.test.mjs','backup-procedure.test.mjs','pricing-money.test.mjs','pricing-rules.test.mjs','pricing-backend.test.mjs'];
const child=spawn(process.execPath,['--test',...files.map(n=>'emulator-tests/'+n)],{stdio:'inherit',env:{...process.env,ORVEX_TEST_FIRESTORE_PORT:'8280'}});child.on('exit',code=>{process.exitCode=code??1});child.on('error',()=>{process.exitCode=1});
