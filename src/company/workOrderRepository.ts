import {hostedSpark,getCompanyCloudServices} from '../firebase';
import {commitWorkOrder} from './firestoreWorkOrder';
import {employeeApi} from './CompanyEmployees';
import {collection,doc,getDocsFromServer} from 'firebase/firestore';
import {companyScope,serverDeadline} from './directoryRepository';
import {workOrderStatuses,workOrderPriorities,emptyWorkOrderDraft} from './workOrderModel';
import type {CompanyWorkOrder,CompanyEmployee,WorkOrderDraft,WorkOrderActivity} from './workOrderModel';
export async function loadWorkOrders(companyId:string){const {db,cid}=await companyScope(companyId);const [orders,employees]=await serverDeadline(Promise.all([getDocsFromServer(collection(db,'organizations',cid,'workOrders')),employeeApi<{employees:CompanyEmployee[];warning?:string}>('employeeAssignments',{companyId:cid})]));return {orders:orders.docs.map(d=>({...d.data(),id:d.id}) as CompanyWorkOrder),employees:employees.employees,employeeWarning:employees.warning};}
// The overview needs no employee directory or assignment transaction.
export async function loadWorkOrderOverview(companyId:string){const {db,cid}=await companyScope(companyId);const orders=await serverDeadline(getDocsFromServer(collection(db,'organizations',cid,'workOrders')));return orders.docs.map(d=>({...d.data(),id:d.id}) as CompanyWorkOrder);}
export async function loadWorkOrderActivity(companyId:string,id:string){const {db,cid}=await companyScope(companyId);const snapshot=await serverDeadline(getDocsFromServer(collection(db,'organizations',cid,'workOrders',id,'activity')));return snapshot.docs.map(d=>({...d.data(),id:d.id}) as WorkOrderActivity).sort((a,b)=>b.revision-a.revision);}
function validate(d:WorkOrderDraft){if(!d.customerId||!d.propertyId||!d.title.trim()||!d.description.trim()||!d.serviceCategory.trim())throw Error('Customer, property, title, description and service category are required.');if(!workOrderStatuses.includes(d.status)||!workOrderPriorities.includes(d.priority))throw Error('Choose a valid status and priority.');for(const date of [d.scheduledDate,d.dueDate])if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date).toISOString().slice(0,10)!==date))throw Error('Enter valid scheduling dates.');if(d.status==='Scheduled'&&!d.scheduledDate)throw Error('A scheduled work order requires a scheduled date.');if(d.scheduledDate&&d.dueDate&&d.dueDate<d.scheduledDate)throw Error('Due date must be on or after the scheduled date.');}
export async function saveWorkOrder(companyId:string,id:string,revision:number,input:WorkOrderDraft){
 const draft=Object.fromEntries(Object.keys(emptyWorkOrderDraft()).map(k=>[k,String(input[k as keyof WorkOrderDraft]??'').trim()])) as WorkOrderDraft;validate(draft);
 const {cid}=await companyScope(companyId);if(hostedSpark){const {auth,db}=await getCompanyCloudServices();await serverDeadline(commitWorkOrder(db,auth.currentUser!.uid,cid,id,revision,draft));return id;}const result=await employeeApi<{id:string}>('saveCompanyWorkOrder',{companyId:cid,id,revision,draft,operationId:crypto.randomUUID()});return result.id;
}
