import fs from 'node:fs/promises';
const source=await fs.readFile('firestore.rules','utf8');
const marker='function bootstrap(cid){return ';
if(source.split(marker).length!==2)throw Error('Bootstrap rule changed; manual review required.');
const grant="verified() && exists(/databases/$(database)/documents/betaEnrollment/$(request.auth.token.email.lower())) && get(/databases/$(database)/documents/betaEnrollment/$(request.auth.token.email.lower())).data.enabled == true && get(/databases/$(database)/documents/betaEnrollment/$(request.auth.token.email.lower())).data.expiresAt > request.time && ";
await fs.writeFile('firestore.beta.rules',source.replace(marker,marker+grant));
// Generated rules preserve all existing permissions and add an enrollment condition.
