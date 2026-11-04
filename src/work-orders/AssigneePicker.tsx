import {useState} from 'react';
import type {Technician} from '../data';

export default function AssigneePicker({orderId,technicianId,technicians,onSave}:{orderId:string;technicianId:string;technicians:Technician[];onSave:(id:string)=>Promise<boolean>}){
  const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false);
  const name=technicians.find(t=>t.id===technicianId)?.name||'Unassigned';
  return <div onClick={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
    {editing?<select autoFocus aria-label={`Assign technician for ${orderId}`} value={technicianId} disabled={busy}
      onBlur={()=>{if(!busy)setEditing(false);}}
      onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();setEditing(false);}}}
      onChange={async event=>{const id=event.target.value;setBusy(true);try{if(await onSave(id))setEditing(false);}finally{setBusy(false);}}}>
      <option value="">Unassigned</option>
      {technicians.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
    </select>:<button type="button" className="assignee text-btn" aria-label={`Change assignment for ${orderId}`} title="Assign or unassign technician" onClick={()=>setEditing(true)}>
      <span className="avatar small">{technicianId?name.split(' ').map(part=>part[0]).slice(0,2).join(''):'—'}</span><span>{name}</span>
    </button>}
  </div>;
}
