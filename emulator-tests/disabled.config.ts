import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'signup-disabled.spec.ts',globalSetup:'./setup.mjs',globalTeardown:'./teardown.mjs',use:{baseURL:'http://127.0.0.1:5173',channel:'msedge',headless:true},workers:1,reporter:'list'});
