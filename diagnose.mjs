import {chromium} from '@playwright/test';
const b=await chromium.launch({channel:'msedge'});const p=await b.newPage();p.on('pageerror',e=>console.log('ERROR',e.message));p.on('console',m=>{if(m.type()==='error')console.log(m.text())});await p.goto('http://127.0.0.1:5173');await p.waitForTimeout(1000);console.log((await p.locator('body').innerText()).slice(0,1000));await b.close();
