import {useEffect, useState} from 'react';
import type {DashboardPreferences, DashboardStageDefinition, DashboardWidgetId, WorkOrderWorkflow} from '../data';
import {dashboardStages} from '../dashboard/stages';
import './dashboard-settings.css';

const widgets: Array<{id: DashboardWidgetId; title: string; description: string}> = [
  {id: 'total-work-orders', title: 'Total work orders', description: 'Show the total number of active work orders.'},
  {id: 'open-work-orders', title: 'Open work orders', description: 'Show jobs that are ready for the team.'},
  {id: 'in-progress', title: 'In progress', description: 'Show jobs currently being worked.'},
  {id: 'completed', title: 'Completed', description: 'Show jobs that are successfully closed.'},
];

export default function DashboardSettings({preferences, workflow, onSave}: {preferences?: DashboardPreferences; workflow?: WorkOrderWorkflow; onSave: (preferences: DashboardPreferences) => Promise<void>}) {
  const [hidden, setHidden] = useState<DashboardWidgetId[]>(preferences?.hiddenWidgets || []);
  const [stages, setStages] = useState<DashboardStageDefinition[]>(() => dashboardStages(preferences));
  const [draggedStatusId, setDraggedStatusId] = useState<string|null>(null);
  const [stagesExpanded, setStagesExpanded] = useState(true);
  useEffect(() => {setHidden(preferences?.hiddenWidgets || []);setStages(dashboardStages(preferences));}, [preferences]);
  const toggle = (id: DashboardWidgetId) => setHidden(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const statuses = workflow?.statuses.filter(status => !status.archived) || [];
  const assigned = new Set(stages.flatMap(stage => stage.statusIds));
  const moveStatus = (statusId:string, targetId:string|null) => setStages(current => current.map(stage => ({...stage,statusIds:stage.statusIds.filter(id => id !== statusId)})).map(stage => stage.id===targetId ? {...stage,statusIds:[...stage.statusIds,statusId]} : stage));
  const addStage = () => setStages(current => [...current,{id:crypto.randomUUID(),label:'New stage',statusIds:[]}]);
  const renameStage = (id:string,label:string) => setStages(current => current.map(stage => stage.id===id ? {...stage,label} : stage));
  const drop = (targetId:string|null) => {if(draggedStatusId)moveStatus(draggedStatusId,targetId);setDraggedStatusId(null)};

  return <section className="panel dashboard-settings">
    <div className="settings-panel-heading"><div><h2>Dashboard</h2><p className="subtle">Choose which overview cards your company sees. Hidden cards can be restored here at any time.</p></div></div>
    <div className="dashboard-widget-list">{widgets.map(widget => <label className="dashboard-widget-option" key={widget.id}><input type="checkbox" checked={!hidden.includes(widget.id)} onChange={() => toggle(widget.id)}/><span><strong>{widget.title}</strong><small>{widget.description}</small></span><em>{hidden.includes(widget.id) ? 'Hidden' : 'Visible'}</em></label>)}</div>
    <section className={`dashboard-stage-builder ${stagesExpanded ? 'expanded' : ''}`}><button type="button" className="dashboard-stage-toggle" onClick={() => setStagesExpanded(value => !value)} aria-expanded={stagesExpanded}><span><strong>Status stages</strong><small>Drag each status into one Dashboard stage. A status can belong to only one stage.</small></span><b>{stagesExpanded ? '−' : '+'}</b></button>{stagesExpanded&&<div className="dashboard-stage-layout"><div className="unassigned-statuses" onDragOver={event => event.preventDefault()} onDrop={() => drop(null)}><strong>Unassigned statuses</strong><div>{statuses.filter(status => !assigned.has(status.id)).map(status => <StatusChip key={status.id} status={status} onDragStart={() => setDraggedStatusId(status.id)}/>)}</div></div><div className="dashboard-stage-grid">{stages.map(stage => <article className="dashboard-stage" key={stage.id} onDragOver={event => event.preventDefault()} onDrop={() => drop(stage.id)}><input aria-label={`Dashboard stage name ${stage.label}`} value={stage.label} onChange={event => renameStage(stage.id,event.target.value)} /><div>{stage.statusIds.map(statusId => statuses.find(status => status.id===statusId)).filter(Boolean).map(status => <StatusChip key={status!.id} status={status!} onDragStart={() => setDraggedStatusId(status!.id)}/>)}</div></article>)}<button type="button" className="add-dashboard-stage" onClick={addStage}>+ Add stage</button></div></div>}</section>
    <div className="form-actions"><button className="btn primary" type="button" onClick={() => void onSave({hiddenWidgets: hidden,stages:stages.map(stage => ({...stage,label:stage.label.trim()||'Untitled stage'}))})}>Save dashboard</button></div>
  </section>;
}

function StatusChip({status,onDragStart}:{status:{id:string;name:string;color:string};onDragStart:()=>void}){return <span className="dashboard-status-chip" draggable onDragStart={onDragStart}><i style={{backgroundColor:status.color}}/>{status.name}</span>}
