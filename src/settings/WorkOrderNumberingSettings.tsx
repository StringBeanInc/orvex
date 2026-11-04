import {useEffect, useState} from 'react';
import type {WorkOrderNumbering} from '../data';
import {defaultWorkOrderNumbering, formatWorkOrderNumber, numberFormats,parseStartingNumber} from '../work-orders/numbering';

export default function WorkOrderNumberingSettings({value,onSave}:{value?:WorkOrderNumbering;onSave:(value:WorkOrderNumbering)=>Promise<void>}){
 const [numbering,setNumbering]=useState(value||defaultWorkOrderNumbering);
 const display=(n:WorkOrderNumbering)=>(n.sequencePrefix||'')+String(n.nextNumber).padStart(n.sequencePrefix?(n.sequenceWidth||1):1,'0');
 const [starting,setStarting]=useState(display(value||defaultWorkOrderNumbering));
 const parsed=parseStartingNumber(starting,numbering.format);
 useEffect(()=>{setNumbering(value||defaultWorkOrderNumbering);setStarting(display(value||defaultWorkOrderNumbering));},[value]);
 return <section className="panel settings-panel"><h2>Work Order Numbering</h2><p className="subtle">Choose the format used for new work orders. Existing numbers are preserved and can never be edited.</p><form className="editor-form" onSubmit={event=>{event.preventDefault();if(parsed)void onSave(parsed)}}><label>Number format<select value={numbering.format} onChange={event=>setNumbering(current=>({...current,format:event.target.value as WorkOrderNumbering['format']}))}>{numberFormats.map(format=><option key={format.value} value={format.value}>{format.label}</option>)}</select></label><label>Starting number<input type="text" required maxLength={40} pattern="[0-9]+(-[0-9]+)*" value={starting} onChange={event=>setStarting(event.target.value)}/></label><p className="subtle">Use digits and hyphens, for example 26-001. The final number increments: 26-001, 26-002.</p><p className="subtle">Next work order preview: <strong>{parsed?formatWorkOrderNumber(parsed):'Enter a valid starting number (final segment 1–999999999).'}</strong></p><div className="form-actions"><button className="btn primary" type="submit" disabled={!parsed}>Save numbering</button></div></form></section>
}
