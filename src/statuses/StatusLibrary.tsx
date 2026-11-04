import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Data,WorkOrderStatusDefinition,WorkOrderWorkflow} from '../data';
import './status-library.css';
import './status-library-layout.css';

type StatusColor={label:string;value:string};

const colorFamilies:{name:string;shades:StatusColor[]}[]=[
  {name:'Blue',shades:[['Blue 1','#1d4ed8'],['Blue 2','#2563eb'],['Blue 3','#2f6eb7'],['Blue 4','#60a5fa']]},
  {name:'Green',shades:[['Green 1','#047857'],['Green 2','#187457'],['Green 3','#16a34a'],['Green 4','#86efac']]},
  {name:'Yellow',shades:[['Yellow 1','#a16207'],['Yellow 2','#ca8a04'],['Yellow 3','#eab308'],['Yellow 4','#fde047']]},
  {name:'Purple',shades:[['Purple 1','#6d28d9'],['Purple 2','#7c3aed'],['Purple 3','#a855f7'],['Purple 4','#d8b4fe']]},
  {name:'Black',shades:[['Black 1','#111827'],['Black 2','#1f2937'],['Black 3','#475569'],['Black 4','#64748b']]},
  {name:'Violet',shades:[['Violet 1','#5b21b6'],['Violet 2','#6d28d9'],['Violet 3','#8b5cf6'],['Violet 4','#c4b5fd']]},
  {name:'Orange',shades:[['Orange 1','#c2410c'],['Orange 2','#ea580c'],['Orange 3','#f97316'],['Orange 4','#fdba74']]},
  {name:'Red',shades:[['Red 1','#b91c1c'],['Red 2','#dc2626'],['Red 3','#ef4444'],['Red 4','#fca5a5']]},
  {name:'Red orange',shades:[['Red orange 1','#c2410c'],['Red orange 2','#e11d48'],['Red orange 3','#f43f5e'],['Red orange 4','#fda4af']]},
].map(family=>({name:family.name,shades:family.shades.map(([label,value])=>({label,value}))}));

const fallback:WorkOrderWorkflow={defaultStatusId:'open',statuses:[{id:'open',name:'Open',color:'#2f6eb7',terminal:false},{id:'in-progress',name:'In progress',color:'#187457',terminal:false},{id:'completed',name:'Completed',color:'#64748b',terminal:true},{id:'closed',name:'Closed',color:'#475569',terminal:true}]};

function StatusColorPicker({value,onChange}:{value:string;onChange:(value:string)=>void}){
  const initialFamily=colorFamilies.find(family=>family.shades.some(color=>color.value===value))?.name||colorFamilies[0].name;
  const [open,setOpen]=useState(false);
  const [opensUp,setOpensUp]=useState(false);
  const [activeFamily,setActiveFamily]=useState(initialFamily);
  const pickerRef=useRef<HTMLDivElement>(null);
  const family=colorFamilies.find(item=>item.name===activeFamily)||colorFamilies[0];
  useEffect(()=>{
    if(!open)return;
    const close=(event:PointerEvent)=>{if(!pickerRef.current?.contains(event.target as Node))setOpen(false)};
    document.addEventListener('pointerdown',close);
    return()=>document.removeEventListener('pointerdown',close);
  },[open]);
  const toggle=()=>{
    if(!open&&pickerRef.current){
      const bounds=pickerRef.current.getBoundingClientRect();
      setOpensUp(window.innerHeight-bounds.bottom<310);
    }
    setOpen(current=>!current);
  };
  return <div className={`status-color-picker ${opensUp?'opens-up':''}`} ref={pickerRef}>
    <button type="button" className="status-color-trigger" aria-label="Choose status color" aria-expanded={open} onClick={toggle}>
      <span className="status-color-swatch" style={{backgroundColor:value}}/>
    </button>
    {open&&<div className="status-color-menu" role="dialog" aria-label="Status color palette">
      <div className="status-color-families" aria-label="Color families">
        {colorFamilies.map(item=><button type="button" key={item.name} className={item.name===activeFamily?'active':''} onMouseEnter={()=>setActiveFamily(item.name)} onFocus={()=>setActiveFamily(item.name)} onClick={()=>setActiveFamily(item.name)}>
          <span style={{backgroundColor:item.shades[1].value}}/>{item.name}
        </button>)}
      </div>
      <div className="status-color-shades" aria-label={`${family.name} shades`}>
        <strong>{family.name}</strong>
        <div>{family.shades.map(color=><button type="button" key={color.value} title={color.label} aria-label={color.label} className={color.value===value?'selected':''} style={{backgroundColor:color.value}} onClick={()=>{onChange(color.value);setOpen(false)}}/>)}</div>
      </div>
    </div>}
  </div>;
}

export default function StatusLibrary({data,onSave}:{data:Data;onSave:(workflow:WorkOrderWorkflow)=>Promise<void>}){
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [workflow,setWorkflow]=useState(data.workOrderWorkflow||fallback);
  const [name,setName]=useState('');
  const used=new Set(data.orders.map(order=>order.status));
  useEffect(()=>setHost(document.getElementById('settings-status-library-slot')),[]);
  const update=(id:string,patch:Partial<WorkOrderStatusDefinition>)=>setWorkflow(current=>({...current,statuses:current.statuses.map(status=>status.id===id?{...status,...patch}:status)}));
  const add=()=>{const value=name.trim();if(!value)return;setWorkflow(current=>({...current,statuses:[...current.statuses,{id:crypto.randomUUID(),name:value,color:'#64748b',terminal:false}]}));setName('')};
  const content=<section className="panel status-library"><div><span className="eyebrow">SETTINGS / WORK ORDERS</span><h2>Statuses &amp; Workflows</h2><p>Manage reusable statuses with a curated ORVEX color palette. Workflow transitions will be configured in Phase 2.</p></div><div className="status-list">{workflow.statuses.map((status,index)=><div className="status-row" key={status.id} draggable onDragStart={event=>event.dataTransfer.setData('text/plain',String(index))} onDragOver={event=>event.preventDefault()} onDrop={event=>{const from=Number(event.dataTransfer.getData('text/plain'));setWorkflow(current=>{const statuses=[...current.statuses];const [moved]=statuses.splice(from,1);statuses.splice(index,0,moved);return {...current,statuses}})}}><StatusColorPicker value={status.color} onChange={color=>update(status.id,{color})}/><input value={status.name} onChange={event=>update(status.id,{name:event.target.value})}/><label><input type="checkbox" checked={status.terminal} onChange={event=>update(status.id,{terminal:event.target.checked})}/> Terminal</label><label><input type="radio" name="default-status" checked={workflow.defaultStatusId===status.id} onChange={()=>setWorkflow(current=>({...current,defaultStatusId:status.id}))}/> Default</label><button disabled={workflow.defaultStatusId===status.id||used.has(status.name)} onClick={()=>update(status.id,{archived:!status.archived})}>{status.archived?'Restore':'Archive'}</button></div>)}</div><div className="status-add"><input placeholder="New status name" value={name} onChange={event=>setName(event.target.value)}/><button className="btn secondary" onClick={add}>Add status</button><button className="btn primary" onClick={()=>void onSave(workflow)}>Save status library</button></div><p className="subtle">Drag rows to reorder. A default or status used by existing work orders cannot be archived.</p></section>;
  return host?createPortal(content,host):null;
}
