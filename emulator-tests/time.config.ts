import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'time.spec.ts',use:{baseURL:'http://127.0.0.1:15179',channel:'msedge',headless:true},workers:1,reporter:'list',timeout:90000,expect:{timeout:20000}});
