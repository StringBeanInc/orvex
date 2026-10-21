import {useEffect,useState} from 'react';
import {hostedBeta} from '../firebase';
import type {Company} from './company';
import {allowed} from '../company/permissions';
import type {Permission} from '../company/permissions';
import CompanyNavigation from './CompanyNavigation';
import CompanyDashboard from '../company/CompanyDashboard';
import CompanyClients from '../company/CompanyClients';
import CompanyEmployees,{employeeApi} from '../company/CompanyEmployees';
import CompanyScheduling from '../company/CompanyScheduling';
import CompanyCatalog from '../company/CompanyCatalog';
import './workspace.css';

const pages=['Dashboard','Clients','Technicians','Scheduling','Items'] as const;
type Page=typeof pages[number];
const subtitles:Record<Page,string>={Dashboard:'A simple view of your company work.',Clients:'Manage clients and the properties linked to them.',Technicians:'Manage the technicians and staff who can be assigned to work.',Scheduling:'Plan work orders with a simple date-based calendar.',Items:'Manage the service items your company uses.'};

export default function CompanyWorkspace({company,onCompany,logout}:{company:Company;onCompany:(company:Company)=>void;logout:()=>unknown}){
 const [collapsed,setCollapsed]=useState(()=>innerWidth<600),[page,setPage]=useState<Page>('Dashboard'),[companies,setCompanies]=useState<Company[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[createRequest,setCreateRequest]=useState<{id:string;propertyId:string;customerId:string}|null>(null);
 const can=(permission:Permission)=>allowed(company.membership||{role:company.membershipRole,active:true},permission);
 const revision=company.membership?.revision||0;
 useEffect(()=>{setPage('Dashboard');setError('');void employeeApi<{companies:Company[]}>('companyMemberships',{}).then(value=>setCompanies(value.companies)).catch(e=>setError(e.message));},[company.companyId,revision]);
 function changeCompany(id:string){setBusy(true);setError('');void employeeApi<{companies:Company[]}>('companyMemberships',{}).then(value=>{const next=value.companies.find(entry=>entry.companyId===id);if(!next)throw Error('Active company membership is required.');onCompany(next);}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}
 return <div className={`app company-app ${collapsed?'is-collapsed':''}`}><CompanyNavigation company={company} companies={companies} selected={page} busy={busy} collapsed={collapsed} onCollapse={()=>setCollapsed(value=>!value)} onNavigate={name=>setPage(name as Page)} onSwitch={changeCompany} logout={logout}/><main id="company-content" tabIndex={-1}><header className="workspace-topbar"><span>{company.name}</span><small><span className="live-dot"/>{hostedBeta?'Firebase · Hosted workspace':'Local emulators'}</small></header><div className="page-content"><div className="workspace-page-heading"><p className="eyebrow">WORKSPACE</p><h1>{page}</h1><p>{subtitles[page]}</p></div>{error&&<p role="alert" className="warning">{error}</p>}{busy?<p role="status">Checking company membership…</p>:<div key={`${company.companyId}:${revision}:${page}`}>
 {page==='Dashboard'?<CompanyDashboard companyId={company.companyId} canReadOrders={can('workOrders.read')} links={['Clients','Technicians','Scheduling','Items']} onNavigate={name=>setPage(name==='Customers'?'Clients':name==='Work Orders'?'Scheduling':name as Page)} onOpenOrder={()=>setPage('Scheduling')}/>:page==='Clients'?<CompanyClients companyId={company.companyId} readOnly={!can('directory.write')} onCreateWorkOrder={(propertyId,customerId)=>{setCreateRequest({id:crypto.randomUUID(),propertyId,customerId});setPage('Scheduling')}}/>:page==='Technicians'?<CompanyEmployees companyId={company.companyId} owner={company.membershipRole==='Owner'}/>:page==='Scheduling'?<CompanyScheduling companyId={company.companyId} readOnly={!can('workOrders.write')} createRequest={createRequest} onCreateRequestOpened={()=>setCreateRequest(null)}/>:<CompanyCatalog companyId={company.companyId} kind="service"/>}
 </div>}</div></main></div>;
}
