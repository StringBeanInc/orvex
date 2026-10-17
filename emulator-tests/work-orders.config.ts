import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'work-orders.spec.ts',use:{baseURL:'http://127.0.0.1:5175',channel:'msedge',headless:true},workers:1,reporter:'list',timeout:60000});
