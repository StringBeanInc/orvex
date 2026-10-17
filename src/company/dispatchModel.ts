import {distanceMeters} from './timeModel.ts';
export type DispatchStop={id:string;location?:{latitude:number;longitude:number}|null};
export function validDate(value:string){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2020-01-01'||value>'2100-12-31'||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('Choose a valid date between 2020 and 2100.');return value;}
export function addDays(day:string,count:number){return new Date(Date.parse(validDate(day)+'T00:00:00Z')+count*86400000).toISOString().slice(0,10);}
function parts(ms:number,timeZone:string){const f=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});return Object.fromEntries(f.formatToParts(ms).map(p=>[p.type,p.value]));}
export function wallTime(ms:number,timeZone:string){const p=parts(ms,timeZone);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
export const localDay=(ms:number,timeZone:string)=>wallTime(ms,timeZone).slice(0,10);
export function localInstant(value:string,timeZone:string,fold='reject'){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||!['reject','earlier','later'].includes(fold))throw Error('Use a valid local date/time and ambiguity choice.');validDate(value.slice(0,10));
 const nominal=Date.parse(value+'Z');if(!Number.isFinite(nominal)||new Date(nominal).toISOString().slice(0,16)!==value)throw Error('Invalid local date/time.');
 const offsets=new Set<number>();for(let h=-36;h<=36;h+=6){const sample=nominal+h*3600000;offsets.add(Date.parse(wallTime(sample,timeZone)+'Z')-sample);}
 const choices=[...offsets].map(offset=>nominal-offset).filter(ms=>wallTime(ms,timeZone)===value).sort((a,b)=>a-b);
 if(!choices.length)throw Error('This local time does not exist due to a timezone transition.');if(choices.length>1&&fold==='reject')throw Error('This local time occurs twice. Choose earlier or later explicitly.');return fold==='later'?choices.at(-1)!:choices[0];
}
export const overlaps=(a:{startMs:number;endMs:number},b:{startMs:number;endMs:number})=>a.startMs<b.endMs&&b.startMs<a.endMs;
export function scheduleConflicts(slot:{startMs:number;endMs:number;technicianId:string;workOrderId:string},bookings:{startMs:number;endMs:number;technicianId:string;workOrderId:string;active:boolean}[],availability:{startMs:number;endMs:number;technicianId:string;kind:string;active:boolean}[]){
 const relevant=availability.filter(a=>a.active&&a.technicianId===slot.technicianId);
 const hard:string[]=[];if(bookings.some(b=>b.active&&b.technicianId===slot.technicianId&&b.workOrderId!==slot.workOrderId&&overlaps(slot,b)))hard.push('Technician already has an overlapping appointment.');if(relevant.some(a=>a.kind==='unavailable'&&overlaps(slot,a)))hard.push('Technician has an unavailable/time-off period.');
 const soft=relevant.some(a=>a.kind==='shift'&&a.startMs<=slot.startMs&&a.endMs>=slot.endMs)?[]:['Appointment is outside a recorded work shift (or no shift exists).'];return {hard,soft};
}
export function routeSuggestion<T extends DispatchStop>(stops:T[]){const known=stops.filter(s=>s.location),missing=stops.filter(s=>!s.location),ordered:T[]=[];let km=0;if(known.length)ordered.push(known.shift()!);while(known.length){const last=ordered.at(-1)!;known.sort((a,b)=>distanceMeters(last.location!,a.location!)-distanceMeters(last.location!,b.location!)||a.id.localeCompare(b.id));const next=known.shift()!;km+=distanceMeters(last.location!,next.location!)/1000;ordered.push(next);}return {ids:[...ordered,...missing].map(s=>s.id),straightLineKm:km,missing:missing.map(s=>s.id)};}
