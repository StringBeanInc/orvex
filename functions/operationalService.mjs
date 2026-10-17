// Narrow operational mutation service: no pricing, scope or financial writes.
import {Timestamp} from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
import {safeId,deny,activeMember} from './authorization.mjs';
import {workOrderStatuses,activityChanges} from './shared/workOrderModel.js';
export async function operationalUpdate(tx,s,id,input){
 const ref=s.root.collection('workOrders').doc(safeId(id)),snap=await tx.get(ref),old=snap.data();
 if(!old||old.companyId!==s.cid||old.schemaVersion!==1)deny('not-found','Work order unavailable.');
 const [customer,property]=await Promise.all([tx.get(s.root.collection('customers').doc(safeId(old.customerId))),tx.get(s.root.collection('properties').doc(safeId(old.propertyId)))]);
 if(customer.data()?.companyId!==s.cid||customer.data()?.deletedAt||property.data()?.companyId!==s.cid||property.data()?.deletedAt||property.data()?.customerId!==old.customerId)deny('failed-precondition','Active matching company customer and property required.');
 const booking=await tx.get(s.root.collection('dispatchBookings').doc(safeId(id)));if(booking.data()?.active===true&&input.assignedTechnicianId!==undefined&&input.assignedTechnicianId!==old.assignedTechnicianId)deny('failed-precondition','Use Dispatch to reassign a timed appointment.');
 if(!Number.isSafeInteger(input.revision)||old.revision!==input.revision)deny('aborted','Work order changed. Refresh and review.');
 if(['Completed','Closed'].includes(old.status))deny('failed-precondition','Terminal work orders require application review.');
 const next={...old};if(input.status!==undefined){if(!workOrderStatuses.includes(input.status)||input.status==='Scheduled'&&!old.scheduledDate)deny('invalid-argument','Invalid status or missing schedule.');next.status=input.status;}
 if(input.assignedTechnicianId!==undefined){if(input.assignedTechnicianId!==''){const uid=safeId(input.assignedTechnicianId),[m,e]=await Promise.all([tx.get(s.root.collection('members').doc(uid)),tx.get(s.root.collection('employees').doc(uid))]);if(m.data()?.uid!==uid||m.data()?.companyId!==s.cid||!activeMember(m.data())||e.data()?.companyId!==s.cid||e.data()?.active===false)deny('failed-precondition','An active company employee is required.');}next.assignedTechnicianId=input.assignedTechnicianId;}
 const eventId=randomUUID(),at=Timestamp.now();Object.assign(next,{revision:old.revision+1,updatedAt:at,updatedBy:s.uid,lastActivityId:eventId});
 tx.set(ref,next);tx.create(ref.collection('activity').doc(eventId),{id:eventId,companyId:s.cid,workOrderId:id,revision:next.revision,actorUid:s.uid,at,...activityChanges(old,next),beforeStatus:old.status,afterStatus:next.status,beforePriority:old.priority,afterPriority:next.priority,beforeAssignment:old.assignedTechnicianId,afterAssignment:next.assignedTechnicianId,beforeScheduled:old.scheduledDate,afterScheduled:next.scheduledDate,beforeDue:old.dueDate,afterDue:next.dueDate,notes:old.internalNotes});return next;
}
