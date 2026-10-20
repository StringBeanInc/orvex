import fs from 'node:fs/promises';
const source=await fs.readFile('firestore.rules','utf8');
const marker='function bootstrap(cid){return ';
if(source.split(marker).length!==2)throw Error('Bootstrap rule changed; review required.');
const claim='/databases/$(database)/documents/platformConfig/firstCompany';
const condition=`!exists(${claim}) && getAfter(${claim}).data.companyId == cid && getAfter(${claim}).data.ownerUid == request.auth.uid && `;
const boundary='match /platformConfig/publicSignup { allow get: if true; }';
if(!source.includes(boundary))throw Error('Signup gate changed; review required.');
const rule=`match /platformConfig/firstCompany {
   allow create: if verified() && request.resource.data.keys().hasOnly(['companyId','ownerUid','createdAt']) && request.resource.data.ownerUid == request.auth.uid && request.resource.data.createdAt == request.time && bootstrap(request.resource.data.companyId);
  }`;
await fs.writeFile('firestore.single-company.rules',source.replace(marker,marker+condition).replace(boundary,boundary+'\n  '+rule));
