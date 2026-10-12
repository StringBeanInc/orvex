import {documentTotals,money,lineAmount,type BusinessDocument,type TemplateBlock} from './model';
const categoryLabel=(s:string)=>s==='Supplies'?'Materials':s==='Expenditures'?'Additional charges':s;
const date=(s:string)=>s?new Date(`${s}T12:00:00`).toLocaleDateString('en-US'):'';
export function blockContent(b:TemplateBlock,d:BusinessDocument):string[]{const fields=b.fields;const has=(k:string)=>fields.includes(k);const total=documentTotals(d);switch(b.kind){
 case 'Company Information':return ['businessName','address','phone','email','website','license'].filter(has).map(k=>d.company[k as keyof typeof d.company]).filter(Boolean);
 case 'Document Title and Number':return [has('title')?d.title:'',has('number')?d.number:'',has('status')?'DRAFT':''].filter(Boolean);
 case 'Customer Information':return [has('name')?d.customer.name:'',has('contact')?d.customer.contact:'',has('address')?[d.customer.streetAddress,d.customer.addressLine2,[d.customer.city,d.customer.state,d.customer.postalCode].filter(Boolean).join(' '),d.customer.country].filter(Boolean).join('\n'):'',has('email')?d.customer.email:'',has('phone')?d.customer.phone:''].filter(Boolean);
 case 'Service Location':return [has('name')?d.property?.name:'',has('address')?[d.property?.address,[d.property?.city,d.property?.state,d.property?.postalCode].filter(Boolean).join(' ')].filter(Boolean).join('\n'):''].filter(Boolean) as string[];
 case 'Dates':return [has('issueDate')?`Issued: ${date(d.issueDate)}`:'',has('relevantDate')&&d.relevantDate?`${d.type==='Invoice'?'Due':d.type==='Estimate'?'Valid through':'Effective'}: ${date(d.relevantDate)}`:''].filter(Boolean);
 case 'Work Order Information':return [has('id')&&d.workOrderId?`Work order: ${d.workOrderId}`:'',has('title')?d.workOrderTitle:''].filter(Boolean);
 case 'Scope of Work':return [has('scope')?d.scope:'',has('changeReason')&&d.type==='Change Order'&&d.changeReason?`Reason for change: ${d.changeReason}`:''].filter(Boolean);
 case 'Subtotals and Taxes':return [...['Labor','Supplies','Expenditures'].filter(has).map(c=>`${categoryLabel(c)}: ${money(d.items.filter(i=>i.category===c).reduce((s,i)=>s+lineAmount(i),0))}`),has('subtotal')?`Subtotal: ${money(total.subtotal)}`:'',has('tax')?(d.taxEnabled?`${d.taxLabel} (${d.taxRate}%): ${money(total.tax)}`:'Taxes: not included'):''].filter(Boolean);
 case 'Grand Total':return [has('total')?`${b.heading||'Total'}: ${money(total.total)}`:'',d.type==='Invoice'&&has('amountPaid')&&d.amountPaidCents?`Payments / credits: ${money(d.amountPaidCents)}`:'',d.type==='Invoice'&&has('balance')?`Balance due: ${money(total.balance)}`:'',d.type==='Change Order'&&has('revisedContract')?`Original contract: ${money(d.originalContractCents)}\nPrior approved changes: ${money(d.priorChangesCents)}\nRevised contract: ${money(total.revisedContract)}`:''].filter(Boolean);
 case 'Notes':return has('notes')&&d.notes?[d.notes]:[];
 case 'Terms and Conditions':return has('terms')&&d.terms?[d.terms]:[];
 case 'Signature / Approval':return [has('acceptedBy')?'Accepted by: __________________________':'',has('signature')?'Signature: ____________________________':'',has('date')?'Date: _________________________________':''].filter(Boolean);
 case 'Custom Text':return b.text?[b.text]:[];
 default:return [];
}}
