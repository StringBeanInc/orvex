import CompanyDashboard from '../company/CompanyDashboard';
import CompanyNavigation from './CompanyNavigation';
import './workspace.css';
import CompanyDispatch from '../company/CompanyDispatch';
import CompanyIntegrations from '../company/CompanyIntegrations';
import CompanyAccounting from '../company/CompanyAccounting';
import CompanyAssignedJobs from '../company/CompanyAssignedJobs';
import {useEffect,useState} from 'react';
import type {Company} from './company';
import {allowed} from '../company/permissions';
import type {Permission} from '../company/permissions';
import CompanyEmployees,{employeeApi} from '../company/CompanyEmployees';
import CompanyFinancials from '../company/CompanyFinancials';
import CompanyTimekeeping from '../company/CompanyTimekeeping';
import CompanyCatalog from '../company/CompanyCatalog';
import CompanyWorkOrders from '../company/CompanyWorkOrders';
import CompanyDirectory from '../company/CompanyDirectory';
const pages:Record<string,Permission>={'Accounting / Integrations':'accounting.read','Work Orders':'workOrders.read',Customers:'directory.read',Properties:'directory.read',Employees:'employees.manage',Estimates:'estimate.read',Invoices:'invoice.read','Change Orders':'changeOrder.read','Assigned Jobs':'time.self','Time Tracking':'time.self','Service Catalog':'pricing.manage','Labor Rates':'pricing.manage','Materials & Supplies':'pricing.manage'};
export default function CompanyWorkspace({company,onCompany,logout}:{company:Company;onCompany:(c:Company)=>void;logout:()=>unknown}){
 const [openOrderId,setOpenOrderId]=useState<string|null>(null);
 const [collapsed,setCollapsed]=useState(()=>innerWidth<600),[page,setPage]=useState('Dashboard'),[companies,setCompanies]=useState<Company[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const can=(p:Permission)=>allowed(company.membership||{role:company.membershipRole,active:true},p),revision=company.membership?.revision||0;
 useEffect(()=>{setPage('Dashboard');setError('');void employeeApi<{companies:Company[]}>('companyMemberships',{}).then(v=>setCompanies(v.companies)).catch(e=>setError(e.message));},[company.companyId,revision]);
 const visible=Object.keys(pages).filter(n=>can(pages[n])&&(!['Service Catalog','Labor Rates','Materials & Supplies'].includes(n)||can('costs.read')));
 if(can('dispatch.read')||can('dispatch.self'))visible.unshift('Dispatch');
 if(company.membershipRole==='Owner')visible.push('API & Webhooks');
 if(can('dispatch.read')||can('dispatch.self'))visible.push('Scheduling');
 const selected=page==='Dashboard'||page==='Settings'||visible.includes(page)?page:'Dashboard';
 return <div className={`app company-app ${collapsed?'is-collapsed':''}`}><CompanyNavigation company={company} companies={companies} visible={visible} selected={selected} busy={busy} collapsed={collapsed} onCollapse={()=>setCollapsed(!collapsed)} onNavigate={n=>{setOpenOrderId(null);setPage(n)}} logout={logout} onSwitch={id=>{setBusy(true);setPage('Dashboard');setError('');void employeeApi<{companies:Company[]}>('companyMemberships',{}).then(v=>{const c=v.companies.find(c=>c.companyId===id);if(!c)throw Error('Active company membership is required.');onCompany(c);}).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}/><main id="company-content" tabIndex={-1}><header className="workspace-topbar"><span>{company.name}</span><small><span className="live-dot"/> Local emulators</small></header><div className="page-content"><div className="workspace-page-heading"><p className="eyebrow">WORKSPACE</p><h1>{selected==='Dashboard'?'Operations overview':selected}</h1><p>{selected==='Dashboard'?'A clear view of the work ahead.':company.name+' / '+company.membershipRole}</p></div>{error&&<p role="alert">{error}</p>}{busy?<p role="status">Checking company membership…</p>:<div key={`${company.companyId}:${revision}:${company.membershipRole}:${JSON.stringify(company.membership?.permissions)}`}>
 {selected==='Dashboard'?<CompanyDashboard companyId={company.companyId} canReadOrders={can('workOrders.read')} links={visible} onNavigate={n=>setPage(n)} onOpenOrder={id=>{setOpenOrderId(id);setPage('Work Orders')}}/>:selected==='Dispatch'||selected==='Scheduling'?<CompanyDispatch key={selected} initialTab={selected==='Scheduling'?'Schedule':'Board'} companyId={company.companyId} onOpenOrder={id=>{setOpenOrderId(id||null);setPage(can('workOrders.read')?'Work Orders':'Assigned Jobs')}} onTimeTracking={()=>setPage('Time Tracking')}/>:selected==='API & Webhooks'?<CompanyIntegrations companyId={company.companyId}/>:selected==='Accounting / Integrations'?<CompanyAccounting companyId={company.companyId}/>:selected==='Assigned Jobs'?<CompanyAssignedJobs companyId={company.companyId}/>:selected==='Employees'?<CompanyEmployees companyId={company.companyId} owner={company.membershipRole==='Owner'}/>:selected==='Time Tracking'?<CompanyTimekeeping companyId={company.companyId}/>:['Estimates','Invoices','Change Orders'].includes(selected)?<CompanyFinancials companyId={company.companyId} kind={selected==='Estimates'?'estimate':selected==='Invoices'?'invoice':'changeOrder'} membership={company.membership}/>:['Service Catalog','Labor Rates','Materials & Supplies'].includes(selected)?<CompanyCatalog key={selected} companyId={company.companyId} kind={selected==='Service Catalog'?'service':selected==='Labor Rates'?'labor':'material'}/>:selected==='Work Orders'?<CompanyWorkOrders initialId={openOrderId} companyId={company.companyId} readOnly={!can('workOrders.write')} canPrice={can('pricing.manage')&&can('costs.read')}/>:selected==='Customers'||selected==='Properties'?<CompanyDirectory companyId={company.companyId} page={selected} onProperties={()=>setPage('Properties')} readOnly={!can('directory.write')}/>:<section className="panel settings-panel"><h2>Workspace settings</h2><p>{company.name} / {company.membershipRole}</p><p>Access is managed through verified company membership. Use your authorized modules for business and account controls.</p><p>The browser-local workspace and recovery tools are separate. Opening them does not import records into this company.</p>{selected==='Settings'&&<a href="/local">Open separate local workspace and recovery tools</a>}</section>}
 </div>}</div></main></div>;
}
