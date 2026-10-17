import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'accounting.spec.ts',use:{baseURL:'http://127.0.0.1:5177',channel:'msedge',headless:true},workers:1,reporter:'list',timeout:90000,expect:{timeout:15000}});
