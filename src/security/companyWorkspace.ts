import type {Data} from '../data';

/** Pure factory: never reads browser storage, an email domain, or sample records. */
export function emptyLocalWorkspace(): Data {
 return {version:1,customers:[],properties:[],orders:[],technicians:[],catalog:[],activity:[],settings:{company:'',name:'',email:''}};
}
export const businessCollections = ['customers','properties','workOrders','invoices','estimates','changeOrders','catalogItems','employees','documentTemplates'] as const;
export type BusinessCollection = typeof businessCollections[number];
export type VerifiedMembership = {uid:string;companyId:string;active:boolean;verified:boolean;role:'Owner'|'Admin'|'Manager'|'Office Staff'|'Technician'};
const validId=(id:string)=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
/** Future adapter guard only. Firebase rules and backend must independently authorize every operation. */
export function companyRecordPath(authUid:string|null,membership:VerifiedMembership|null,companyId:string,collection:BusinessCollection,recordId:string):string {
 if(!authUid||!membership||membership.uid!==authUid||!membership.active||!membership.verified||membership.companyId!==companyId)throw new Error('Verified company membership is required.');
 if(!validId(companyId)||!validId(recordId)||!businessCollections.includes(collection))throw new Error('Invalid company record scope.');
 return `organizations/${companyId}/${collection}/${recordId}`;
}
/** Trusted backend bootstrap payload; caller must generate companyId and verify Auth first. */
export function freshCompanyWorkspace(companyId:string,ownerUid:string,createdAt:string) {
 if(!validId(companyId)||!validId(ownerUid)||!Number.isFinite(Date.parse(createdAt)))throw new Error('Invalid company bootstrap.');
 return {schemaVersion:1,companyId,createdAt,members:[{uid:ownerUid,companyId,role:'Owner' as const,active:true}],employees:[{id:ownerUid,companyId,role:'Owner' as const,createdAt}],customers:[],properties:[],workOrders:[],invoices:[],estimates:[],changeOrders:[],catalogItems:[],documentTemplates:[]};
}
