import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const within=(root,p)=>p===root||p.startsWith(root+path.sep);
export async function inspectExport(directory){
 const root=await fs.realpath(path.resolve(directory));const files=[];
 async function scan(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(entry.isSymbolicLink())throw Error('Export symlinks are not allowed.');const p=path.join(dir,entry.name);if(entry.isDirectory())await scan(p);else if(p!==path.join(root,'orvex-integrity.json')){const bytes=await fs.readFile(p);files.push({path:path.relative(root,p).replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}}}
 await scan(root);files.sort((a,b)=>a.path.localeCompare(b.path));
 const metadata=JSON.parse(await fs.readFile(path.join(root,'firebase-export-metadata.json'),'utf8'));
 if(!metadata.auth||!metadata.firestore)throw Error('Both Auth and Firestore exports are required.');
 async function safeFile(relative){const p=await fs.realpath(path.resolve(root,relative));if(!within(root,p))throw Error('Export path escapes the backup.');return p;}
 const accounts=JSON.parse(await fs.readFile(await safeFile(path.join(metadata.auth.path,'accounts.json')),'utf8'));if(!Array.isArray(accounts.users))throw Error('Invalid Auth account export.');
 JSON.parse(await fs.readFile(await safeFile(path.join(metadata.auth.path,'config.json')),'utf8'));await safeFile(metadata.firestore.metadata_file);
 const digest=crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
 const manifestPath=path.join(root,'orvex-integrity.json');try{const saved=JSON.parse(await fs.readFile(manifestPath,'utf8'));if(saved.sha256!==digest)throw Error('Backup integrity mismatch.');}catch(e){if(e.code!=='ENOENT')throw e;}
 return {root,authUsers:accounts.users.length,files,sha256:digest,metadataModified:(await fs.stat(path.join(root,'firebase-export-metadata.json'))).mtime.toISOString()};
}
export async function newDestination(root=path.join(workspace,'emulator-backups')){await fs.mkdir(root,{recursive:true});const destination=path.join(root,'export-'+new Date().toISOString().replaceAll(':','-')+'-'+crypto.randomUUID());try{await fs.access(destination);throw Error('Refusing to overwrite a backup.');}catch(e){if(e.code!=='ENOENT')throw e;}const lock=await fs.open(destination+'.reserved','wx');await lock.close();return destination;}
function cli(args){return new Promise((resolve,reject)=>{const quote=v=>"'"+v.replaceAll("'","''")+"'";const command=process.platform==='win32'?'powershell.exe':'firebase';const argv=process.platform==='win32'?['-NoProfile','-NonInteractive','-Command','& firebase '+args.map(quote).join(' ')]:args;const child=spawn(command,argv,{cwd:workspace,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Firebase CLI failed; existing backups were not overwritten.')));});}
async function listening(port){try{await fetch('http://127.0.0.1:'+port+'/',{signal:AbortSignal.timeout(1500)});return true;}catch{return false;}}
export async function main(args){const action=args[0],value=key=>args[args.indexOf(key)+1];if(action==='inspect'){if(!args.includes('--from'))throw Error('Use --from <export directory>.');const result=await inspectExport(value('--from'));console.log(JSON.stringify({directory:result.root,authUsers:result.authUsers,files:result.files.length,sha256:result.sha256,metadataModified:result.metadataModified},null,2));return;}
 if(action==='backup'){if(!(await listening(4400))||!(await listening(9099))||!(await listening(8080)))throw Error('Normal emulator hub is unavailable. No backup or database change occurred.');const dest=await newDestination();await cli(['emulators:export',dest,'--project','demo-orvex']);const result=await inspectExport(dest);await fs.writeFile(path.join(dest,'orvex-integrity.json'),JSON.stringify({version:1,createdAt:new Date().toISOString(),sha256:result.sha256,files:result.files},null,2),{flag:'wx'});console.log('Verified new Auth + Firestore backup: '+dest);return;}
 if(action==='start'){if(!args.includes('--from')||!args.includes('--confirm-import'))throw Error('Normal Firebase start is blocked until you explicitly choose a verified export: --from <directory> --confirm-import. No data was imported.');const source=await inspectExport(value('--from'));for(const port of [4400,8080,9099,5001])if(await listening(port))throw Error('An emulator is already running. Refusing to import over current state.');const dest=await newDestination();console.log('Explicit import source: '+source.root+'\nNew shutdown export: '+dest);await cli(['emulators:start','--only','auth,firestore,functions','--project','demo-orvex','--import',source.root,'--export-on-exit',dest]);const result=await inspectExport(dest);await fs.writeFile(path.join(dest,'orvex-integrity.json'),JSON.stringify({version:1,createdAt:new Date().toISOString(),sha256:result.sha256,files:result.files},null,2),{flag:'wx'});return;}
 throw Error('Use inspect, backup, or start. No automatic recovery or blank normal workspace is permitted.');}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1});
