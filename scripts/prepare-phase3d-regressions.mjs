// Generates configuration only. Never imports, resets or changes emulator data.
import fs from 'node:fs/promises';
const root='tmp/phase3d-work-order-regression';await fs.mkdir(root,{recursive:true});
const source=(await fs.readFile('emulator-tests/work-orders.spec.ts','utf8')).replaceAll('demo-orvex-phase3b-tests','demo-orvex-phase3c-tests').replaceAll(':9199',':9299').replaceAll('8180','8280');
await fs.writeFile(root+'/work-orders.spec.ts',source);
await fs.writeFile(root+'/playwright.config.ts',`import {defineConfig} from '@playwright/test';export default defineConfig({testDir:'.',testMatch:'work-orders.spec.ts',use:{baseURL:'http://127.0.0.1:5177',channel:'msedge',headless:true},workers:1,reporter:'list',timeout:60000});`);
