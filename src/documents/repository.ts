import {useEffect,useRef,useState} from 'react';
import {initialDocuments,type DocumentStore} from './model';
import {saveDocuments,visibleDocuments,type Baseline} from '../security/persistence';
import {docsKey,ensureNoInterruptedRestore} from '../security/backup';
import {validateDocuments} from '../security/validation';
// Replace this adapter with a tenant-scoped Firestore implementation. Callers use
// async load/save and never access browser storage directly. No shared storage yet.
export interface DocumentRepository {load():Promise<DocumentStore>;transact(change:(data:DocumentStore)=>DocumentStore):Promise<DocumentStore>;}
export type DocumentUpdate=(change:(data:DocumentStore)=>DocumentStore)=>Promise<DocumentStore|null>;
export const documentStorageKey=docsKey;
export class LocalDocumentRepository implements DocumentRepository {
 private baseline:Baseline<DocumentStore>|null=null;
 async load(){const raw=localStorage.getItem(documentStorageKey);try{ensureNoInterruptedRestore();const value=raw===null?initialDocuments():JSON.parse(raw);validateDocuments(value);this.baseline={raw,value,failed:false};return value;}catch(e){this.baseline={raw,value:initialDocuments(),failed:true};throw e;}}
 async transact(change:(data:DocumentStore)=>DocumentStore){if(!this.baseline||this.baseline.failed)throw new Error('Documents did not load successfully; saving is blocked.');const saved=await saveDocuments(this.baseline,change);this.baseline=saved;return saved.value;}
}
export function useDocumentStore(){const [fullStore,setStore]=useState(initialDocuments);const [ready,setReady]=useState(false);const [error,setError]=useState('');const queue=useRef(Promise.resolve());const [repository]=useState<DocumentRepository>(()=>new LocalDocumentRepository());
 useEffect(()=>{let alive=true;repository.load().then(d=>{if(alive){setStore(d);setReady(true)}}).catch(()=>{if(alive)setError('Document storage could not be loaded. Original bytes are preserved; saving is blocked. Use Backup & Recovery.');});const changed=(e:StorageEvent)=>{if(e.key===documentStorageKey&&alive)setError('Documents changed in another tab. Conflicting edits will be rejected; reload to see the latest records.');};window.addEventListener('storage',changed);return()=>{alive=false;window.removeEventListener('storage',changed)}},[repository]);
 const update:DocumentUpdate=change=>{let result:DocumentStore|null=null;queue.current=queue.current.then(async()=>{try{const next=await repository.transact(change);setStore(next);setError('');result=visibleDocuments(next)}catch(e){setError(e instanceof Error?e.message:'Could not save documents. Existing records are unchanged.')}});return queue.current.then(()=>result);};
 async function reload(){try{const next=await repository.load();setStore(next);setReady(true);setError('')}catch{setReady(false);setError('Document storage could not be loaded. Saving is blocked.')}}
 return {store:visibleDocuments(fullStore),fullStore,ready,error,update,reload};
}
