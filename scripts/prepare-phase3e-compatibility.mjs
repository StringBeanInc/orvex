// Reuse the complete synthetic Phase 3C group. Do not restart/import/reset any service.
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
const root='tmp/phase3e-compatibility';await fs.mkdir(root,{recursive:true});
for(const name of ['time-backend.test.mjs','time.spec.ts']){
 let source=await fs.readFile('emulator-tests/'+name,'utf8');
 source=source.replaceAll('./phase3d-fixtures.mjs',pathToFileURL(path.resolve('emulator-tests/phase3e-fixtures.mjs')).href);
 source=source.replaceAll('../src/company/timeModel.ts',pathToFileURL(path.resolve('src/company/timeModel.ts')).href);
 source=source.replaceAll('../functions/index.mjs',pathToFileURL(path.resolve('functions/index.mjs')).href);
 await fs.writeFile(root+'/'+name,source);
}
await fs.writeFile(root+'/playwright.config.ts',`import {defineConfig} from '@playwright/test';export default defineConfig({testDir:'.',testMatch:'time.spec.ts',use:{baseURL:'http://127.0.0.1:5177',channel:'msedge',headless:true},workers:1,reporter:'list',timeout:90000,expect:{timeout:20000}});`);
