import type {WorkOrderNumbering} from '../data';

export const defaultWorkOrderNumbering: WorkOrderNumbering = {format: 'wo-sequence', nextNumber: 1000};
export const numberFormats = [
  {value: 'wo-sequence', label: 'WO-00000'},
  {value: 'work-order-year', label: 'Work Order 2026-0000'},
  {value: 'dated-sequence', label: 'WO-YYYYMMDD-0000'},
] as const;

export const formatWorkOrderNumber = (numbering: WorkOrderNumbering, date = new Date()) => {
  const sequence = (numbering.sequencePrefix||'')+String(numbering.nextNumber).padStart(numbering.sequenceWidth??(numbering.format === 'wo-sequence' ? 5 : 4), '0');
  if (numbering.format === 'work-order-year') return `Work Order ${date.getFullYear()}-${sequence}`;
  if (numbering.format === 'dated-sequence') return `WO-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}-${sequence}`;
  return `WO-${sequence}`;
};

export function parseStartingNumber(value:string,format:WorkOrderNumbering['format']):WorkOrderNumbering|null {
  if(!/^\d+(?:-\d+)*$/.test(value)||value.length>40)return null;
  const split=value.lastIndexOf('-'),digits=value.slice(split+1),nextNumber=Number(digits);
  if(!Number.isSafeInteger(nextNumber)||nextNumber<1||nextNumber>999999999)return null;
  return {format,nextNumber,sequencePrefix:split<0?'':value.slice(0,split+1),sequenceWidth:split<0?(format==='wo-sequence'?5:4):digits.length};
}

export function nextAvailableWorkOrderNumber(numbering:WorkOrderNumbering,ids:string[],date=new Date()){
  let nextNumber=numbering.nextNumber;
  const prefix=formatWorkOrderNumber({...numbering,nextNumber:0},date).replace(/0+$/,'');
  for(const id of ids){if(!id.startsWith(prefix))continue;const suffix=id.slice(prefix.length);if(/^\d+$/.test(suffix))nextNumber=Math.max(nextNumber,Number(suffix)+1);}
  return nextNumber;
}
