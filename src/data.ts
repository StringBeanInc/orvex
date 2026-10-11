export type CatalogItem = {id:string;category:'Labor'|'Supplies'|'Expenditures';description:string;unitCostCents:number};
export type LineItem = {id:string;catalogItemId?:string;category:'Labor'|'Supplies'|'Expenditures';description:string;quantity:number;unitCostCents:number};
export type Status = 'Open' | 'In progress' | 'Completed';
export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type Customer = {id:string;name:string;contact:string;email:string;phone:string;streetAddress?:string;addressLine2?:string;city?:string;state?:string;postalCode?:string;country?:string};
export type Property = {id:string;name:string;address:string;city?:string;state?:string;postalCode?:string;customerId:string;type:string};
export type Technician = {id:string;name:string;specialty:string;email:string;phone:string};
export type WorkOrder = {id:string;title:string;type?:string;lineItems?:LineItem[];description:string;propertyId:string;technicianId:string;status:Status;priority:Priority;scheduled:string;created:string};
export type Activity = {id:string;text:string;at:string;orderId?:string};
export type Data = {version:1;catalog?:CatalogItem[];customers:Customer[];properties:Property[];technicians:Technician[];orders:WorkOrder[];activity:Activity[];settings:{company:string;name:string;email:string}};
export const localDate = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function seed():Data {
 const day=(offset:number)=>{const d=new Date();d.setDate(d.getDate()+offset);return localDate(d)};
 const now=new Date().toISOString();
 return {version:1,settings:{company:'ORVEX Facilities',name:'Alex Morgan',email:'alex@orvex.example'},customers:[
 {id:'c1',name:'Meridian Partners',contact:'Sarah Mitchell',email:'sarah@meridian.example',phone:'(312) 555-0142'},
 {id:'c2',name:'Northstar Living',contact:'James Bennett',email:'james@northstar.example',phone:'(312) 555-0188'},
 {id:'c3',name:'Evergreen Health',contact:'Olivia Chen',email:'olivia@evergreen.example',phone:'(773) 555-0124'},
 {id:'c4',name:'Atlas Commercial',contact:'David Brooks',email:'david@atlas.example',phone:'(312) 555-0176'}],
 properties:[{id:'p1',name:'Meridian Tower',address:'225 W Wacker Dr, Chicago, IL',customerId:'c1',type:'Office'}, {id:'p2',name:'Parkside Residences',address:'840 W Madison St, Chicago, IL',customerId:'c2',type:'Residential'}, {id:'p3',name:'Evergreen Medical Center',address:'1620 N Ashland Ave, Chicago, IL',customerId:'c3',type:'Healthcare'}, {id:'p4',name:'Atlas Business Park',address:'3100 Oak Brook Rd, Oak Brook, IL',customerId:'c4',type:'Commercial'}, {id:'p5',name:'The Northstar Lofts',address:'1150 W Fulton St, Chicago, IL',customerId:'c2',type:'Residential'}],
 technicians:[{id:'t1',name:'Marcus Johnson',specialty:'HVAC',email:'marcus@orvex.example',phone:'(312) 555-0101'}, {id:'t2',name:'Emily Rodriguez',specialty:'Electrical',email:'emily@orvex.example',phone:'(312) 555-0102'}, {id:'t3',name:'Daniel Kim',specialty:'Plumbing',email:'daniel@orvex.example',phone:'(312) 555-0103'}, {id:'t4',name:'Rachel Foster',specialty:'General maintenance',email:'rachel@orvex.example',phone:'(312) 555-0104'}],
 orders:[
 ['1048','Replace rooftop HVAC filter','Quarterly filter replacement and airflow inspection.','p1','t1','In progress','High',0,'09:00'],
 ['1047','Repair lobby lighting','Replace flickering fixtures near the main entrance.','p2','t2','Open','Medium',0,'11:30'],
 ['1046','Investigate restroom leak','Inspect supply line and repair leaking connection on floor 2.','p3','t3','Open','Urgent',0,'14:00'],
 ['1045','Inspect fire exit doors','Check hinges, closers, and emergency exit hardware.','p4','t4','In progress','High',1,'09:00'],
 ['1044','Service elevator lobby fixtures','Inspect and replace failed LED drivers.','p1','t2','Completed','Low',-1,'10:00'],
 ['1043','Annual boiler inspection','Inspect controls and document system condition.','p5','t1','Open','Medium',2,'08:30'],
 ['1042','Replace kitchen faucet','Install new faucet in common area kitchen.','p2','t3','Completed','Medium',-2,'13:00'],
 ['1041','Repair parking gate sensor','Re-align entry sensor and verify gate operation.','p4','t4','Open','High',3,'10:30'],
 ['1040','Check air handling unit','Inspect belt tension and vibration in east wing.','p3','t1','Completed','Medium',-3,'09:00'],
 ['1039','Paint community room','Touch up walls and door trim.','p5','t4','Completed','Low',-4,'11:00'],
 ['1038','Test exterior safety lights','Verify all exterior fixtures and timers.','p4','t2','In progress','Medium',1,'13:00'],
 ['1037','Drain maintenance','Clean floor drains in lower level mechanical room.','p1','t3','Open','Low',4,'10:00']
 ].map(([id,title,description,propertyId,technicianId,status,priority,offset,time])=>({id:`WO-${id}`,title,description,propertyId,technicianId,status,priority,scheduled:`${day(Number(offset))}T${time}`,created:now})) as WorkOrder[],
 activity:[{id:'a1',text:'Emily Rodriguez completed lobby fixture service',at:now,orderId:'WO-1044'},{id:'a2',text:'Rooftop HVAC filter replacement moved to In progress',at:new Date(Date.now()-3600000).toISOString(),orderId:'WO-1048'},{id:'a3',text:'Restroom leak assigned to Daniel Kim',at:new Date(Date.now()-7200000).toISOString(),orderId:'WO-1046'}]};
}
export const storageKey='orvex-v0.1';
export function readData():{data:Data;error:string} {
 try { const raw=localStorage.getItem(storageKey); if(!raw)return {data:seed(),error:''};const d=JSON.parse(raw);
 if(d.version!==1||!['customers','properties','technicians','orders','activity'].every(k=>Array.isArray(d[k]))||!d.settings || d.orders.some((o:WorkOrder)=>!o.id||!o.title||!['Open','In progress','Completed'].includes(o.status)||!['Low','Medium','High','Urgent'].includes(o.priority)))throw Error('Invalid data');
 return {data:d,error:''}; } catch {return {data:seed(),error:'Saved data could not be loaded. Sample data is shown; existing storage will not be overwritten until you save a change.'};}
}
