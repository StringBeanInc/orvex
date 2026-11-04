import {useState} from 'react';
import {Trash2} from 'lucide-react';
import type {BusinessDocument} from './model';

export default function WorkOrderDocuments({documents,onOpen,onDelete}:{documents:BusinessDocument[];onOpen:(id:string)=>void;onDelete:(id:string)=>Promise<boolean>}){
  const [pending,setPending]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function remove(id:string){
    setBusy(true);setError('');
    try{if(await onDelete(id))setPending(null);else setError('Could not delete the document. It remains saved.');}
    catch{setError('Could not delete the document. It remains saved.');}
    finally{setBusy(false);}
  }
  return <div className="quote-fields">
    {documents.map(d=><div key={d.id} className="doc-actions">
      <button className="btn secondary" onClick={()=>onOpen(d.id)}>{d.number} · {d.type} · Draft</button>
      {pending===d.id?<>
        <span>Move {d.number} to the Recycle Bin? Restore it within 30 days.</span>
        <button className="btn danger" disabled={busy} onClick={()=>remove(d.id)}>{busy?'Deleting…':'Confirm delete'}</button>
        <button className="btn secondary" disabled={busy} onClick={()=>{setPending(null);setError('');}}>Cancel</button>
      </>:<button className="icon-btn delete-customer-btn" disabled={busy} aria-label={`Delete document ${d.number}`} title={`Delete ${d.number}`} onClick={()=>{setPending(d.id);setError('');}}><Trash2 size={16}/></button>}
    </div>)}
    {!documents.length&&<p className="subtle">No documents for this work order yet. Drafts are saved separately from the work order.</p>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
