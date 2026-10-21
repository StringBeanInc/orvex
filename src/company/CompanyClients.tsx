import {useState} from 'react';
import CompanyDirectory from './CompanyDirectory';

export default function CompanyClients({companyId,readOnly,onCreateWorkOrder}:{companyId:string;readOnly:boolean;onCreateWorkOrder:(propertyId:string,customerId:string)=>void}){
 const [section,setSection]=useState<'Customers'|'Properties'>('Customers');
 return <section className="company-clients"><div className="simple-page-tabs" aria-label="Client records"><button className={`btn ${section==='Customers'?'primary':'secondary'}`} aria-pressed={section==='Customers'} onClick={()=>setSection('Customers')}>Clients</button><button className={`btn ${section==='Properties'?'primary':'secondary'}`} aria-pressed={section==='Properties'} onClick={()=>setSection('Properties')}>Properties</button></div><CompanyDirectory companyId={companyId} page={section} readOnly={readOnly} onProperties={()=>setSection('Properties')} onCreateWorkOrder={onCreateWorkOrder}/></section>;
}
