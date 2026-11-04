import type {Customer,Property,Status,Technician,WorkOrder} from '../data';

export type SchedulingView='Calendar'|'Dispatch'|'Map'|'List'|'Board';
export type CalendarMode='Month'|'Week'|'Day';
export type SchedulingData={orders:WorkOrder[];properties:Property[];customers:Customer[];technicians:Technician[];statuses:Status[];mapDefaultLocation?:string};
export type ScheduleLookups={property:(id:string)=>Property|undefined;technician:(id:string)=>Technician|undefined};
