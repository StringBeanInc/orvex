import type {Data} from './data';
import type {ReactNode} from 'react';

export type DevelopmentCloud={
  initial:Data;
  subscribe:(listener:(data:Data)=>void)=>()=>void;
  save:(base:Data,next:Data)=>Promise<Data>;
  recovery:ReactNode;
  archiveCustomerTree?:(customerId:string,expectedRevision:number)=>Promise<unknown>;
  canEdit?:boolean;
  canEditCatalog?:boolean;
};