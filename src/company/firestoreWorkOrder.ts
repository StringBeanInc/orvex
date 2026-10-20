import {doc,runTransaction,serverTimestamp} from 'firebase/firestore';
import type {Firestore} from 'firebase/firestore';
import {emptyWorkOrderDraft,activityChanges} from './workOrderModel.ts';
import type {WorkOrderDraft} from './workOrderModel.ts';

// Rules independently validate permission, references, revision, counter and history.
export async function commitWorkOrder(db:Firestore,uid:string,cid:string,id:string,expectedRevision:number,input:WorkOrderDraft){
 const draft=Object.fromEntries(Object.keys(emptyWorkOrderDraft()).map(k=>[k,String(input[k as keyof WorkOrderDraft]??'').trim()])) as WorkOrderDraft;
 const ref=(kind:string,key:string)=>doc(db,'organizations',cid,kind,key);
 return runTransaction(db,async tx=>{
  const record=ref('workOrders',id),oldSnap=await tx.get(record),old=oldSnap.exists()?oldSnap.data():null;
  if((old?.revision||0)!==expectedRevision)throw Error('Save conflict: refresh and review the newer work order.');
  const prop=await tx.get(ref('properties',draft.propertyId));
  const oldProp=old&&old.propertyId!==draft.propertyId?await tx.get(ref('properties',old.propertyId)):null;
  const counter=!old?await tx.get(ref('numberSequences','workOrders')):null;
  if(!prop.exists()||oldProp&&!oldProp.exists())throw Error('Property is unavailable.');
  const now=serverTimestamp(),revision=expectedRevision+1,number=old?.number||(counter?.exists()?counter.data().nextNumber:1),activityId=id+'-r'+revision;
  const next={...draft,id,companyId:cid,schemaVersion:1,revision,number,createdAt:old?.createdAt||now,createdBy:old?.createdBy||uid,updatedAt:now,updatedBy:uid,lastActivityId:activityId};
  if(!old)tx.set(ref('numberSequences','workOrders'),{companyId:cid,schemaVersion:1,nextNumber:number+1,revision:(counter?.exists()?counter.data().revision:0)+1,lastWorkOrderId:id,updatedAt:now,updatedBy:uid});
  if(!old||old.propertyId!==draft.propertyId){
   tx.update(prop.ref,{workOrderCount:(prop.data().workOrderCount||0)+1,workOrderMutationId:id,revision:prop.data().revision+1,updatedAt:now,updatedBy:uid});
   if(oldProp?.exists())tx.update(oldProp.ref,{workOrderCount:oldProp.data().workOrderCount-1,workOrderMutationId:id,revision:oldProp.data().revision+1,updatedAt:now,updatedBy:uid});
  }
  tx.set(record,next);
  tx.set(doc(record,'activity',activityId),{id:activityId,companyId:cid,workOrderId:id,revision,actorUid:uid,at:now,...activityChanges(old as WorkOrderDraft|null,draft),beforeStatus:old?.status||'',afterStatus:draft.status,beforePriority:old?.priority||'',afterPriority:draft.priority,beforeAssignment:old?.assignedTechnicianId||'',afterAssignment:draft.assignedTechnicianId,beforeScheduled:old?.scheduledDate||'',afterScheduled:draft.scheduledDate,beforeDue:old?.dueDate||'',afterDue:draft.dueDate,notes:draft.internalNotes});
  return number;
 });
}
