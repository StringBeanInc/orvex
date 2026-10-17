// This finite registry is also compiled for the trusted emulator backend.
export const roles=['Owner','Administrator','Manager','Office Staff','Technician'] as const;
export const permissions=['dispatch.read','dispatch.manage','dispatch.override','dispatch.self','accounting.read','accounting.connect','accounting.configure','accounting.sync','accounting.reconcile','employees.manage','directory.read','directory.write','workOrders.read','workOrders.write','pricing.manage','costs.read','time.self','time.review','time.configure','gps.read','estimate.read','estimate.edit','estimate.issue','estimate.approve','estimate.convert','invoice.read','invoice.edit','invoice.issue','invoice.pay','invoice.void','changeOrder.read','changeOrder.edit','changeOrder.issue','changeOrder.approve'] as const;
export type Permission=typeof permissions[number];
export type Membership={uid?:string;companyId?:string;role?:string;active?:boolean;status?:string;permissions?:string[];permissionSchema?:number;revision?:number};
export function activeMember(m:Membership|undefined){return !!m&&m.active===true&&(m.status===undefined||m.status==='active')&&(['Owner','Admin','Technician'].includes(m.role||'')||(m.permissionSchema===1&&['Administrator','Manager','Office Staff'].includes(m.role||''))); }
export function allowed(m:Membership|undefined,p:Permission):boolean{
 if(!activeMember(m)||!permissions.includes(p))return false;
 if(m!.role==='Owner')return true;
 // Preserve the previous Admin's timekeeping-only authority, including cost/GPS review.
 if(m!.role==='Admin')return ['time.self','time.review','time.configure','gps.read','costs.read'].includes(p);
 const defaults:Record<string,string[]>={Administrator:['employees.manage','directory.read','directory.write','workOrders.read','workOrders.write','time.self','time.review','time.configure'],Manager:['directory.read','workOrders.read','workOrders.write','time.self'],'Office Staff':['directory.read','directory.write','workOrders.read'],Technician:['time.self','dispatch.self']};
 return (defaults[m!.role!]||[]).includes(p)||(m!.permissionSchema===1&&Array.isArray(m!.permissions)&&m!.permissions!.includes(p));
}
