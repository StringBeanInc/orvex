import {allowed} from './permissions';
import type {Membership,Permission} from './permissions';
import { useEffect, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getPricingFunctions } from '../firebase';
import type {WorkOrderPricing} from './pricingModel';
import { totals, parseDecimal, extended, catalogLine, customLine, moneyInput, usd, MAX_LINES } from './pricingModel';
import type { PricingDraft, CatalogRecord, ChargeLine } from './pricingModel';
import { newFinancialDraft, pricingOnly, scopeDelta } from './financialModel';
import type { FinancialKind, FinancialRecord, FinancialDraft } from './financialModel';
import './financial.css';
type View = {
    unsupportedCount?: number;
    today: string;
    records: (FinancialRecord & {
        effectiveStatus: string;
    })[];
    customers: {
        id: string;
        name: string;
    }[];
    properties: {
        id: string;
        customerId: string;
        name: string;
    }[];
    orders: {
        id: string;
        title: string;
        customerId: string;
        propertyId: string;
    }[];
    catalog: CatalogRecord[];
    versions: (FinancialRecord & {
        issuedRevision: number;
    })[];
    events: {
        id: string;
        atMs: number;
        operation: string;
        actorUid: string;
        note: string;
        revision: number;
        version: number;
        snapshot: FinancialRecord;
    }[];
    payments: {
        id: string;
        paidOn: string;
        amountCents: number;
        reference: string;
        method: string;
    }[];
};
const names = { estimate: 'Estimate', changeOrder: 'Change order', invoice: 'Invoice' };
const payloadDraft = (r: FinancialDraft): FinancialDraft => Object.fromEntries(Object.keys(newFinancialDraft()).map(k => [k, r[k as keyof FinancialDraft]])) as FinancialDraft;
type Payload = Record<string, unknown>;
function Preview({ record, current }: {
    record: FinancialRecord;
    current: FinancialRecord;
}) { return <article className="financial-preview" aria-label="Customer document preview"><header><strong>{record.issuer?.name || 'Company branding is captured when issued'}</strong><div><h2>{names[record.kind]} {record.number}</h2><p>{record.status !== 'draft' && record.version ? 'Issued version ' + record.version : 'DRAFT — NOT ISSUED'}</p>{current.status === 'void' && <strong>VOID</strong>}</div></header><h3>{record.title}</h3><p className="financial-scope">{record.description}</p><div className="form-grid"><div><h3>Customer</h3>{Object.entries(record.customerSnapshot || {}).filter(([, v]) => v).map(([k, v]) => <p key={k}>{v}</p>)}</div><div><h3>Property</h3>{Object.entries(record.propertySnapshot || {}).filter(([, v]) => v).map(([k, v]) => <p key={k}>{v}</p>)}</div></div><p>{record.expiresOn ? 'Estimate expires: ' + record.expiresOn + ' (UTC)' : ''} {record.dueOn ? 'Payment due: ' + record.dueOn + ' (UTC)' : ''}</p><div className="table-scroll"><table><thead><tr><th>Description</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{record.pricing.order.map(id => { const l = record.pricing.items[id]; return <tr key={id}><td>{l.description}</td><td>{l.quantityMilli / 1000} {l.unit}</td><td>{usd(l.unitPriceCents)}</td><td>{usd(l.extendedCents)}</td></tr>; })}</tbody></table></div><div className="pricing-summary"><p>Subtotal <strong>{usd(record.subtotalCents)}</strong></p><p>Discount <strong>{usd(record.pricing.discountCents)}</strong></p><p>{record.pricing.taxEnabled ? record.pricing.taxLabel + ' (' + moneyInput(record.pricing.taxRateBps) + '%)' : 'Tax not configured'} <strong>{usd(record.taxCents)}</strong></p><p>Total <strong>{usd(record.totalCents)}</strong></p>{record.kind === 'changeOrder' && <p>Change from original scope <strong>{usd(record.deltaCents || 0)}</strong></p>}{record.kind === 'invoice' && <><p>Recorded payments <strong>{usd(current.paidCents)}</strong></p><p>Remaining balance <strong>{usd(current.balanceCents)}</strong></p></>}</div></article>; }
async function download(record: FinancialRecord, current: FinancialRecord) { const { createFinancialPdf } = await import('./financialPdf'); const pdf = await createFinancialPdf(record, current); pdf.save(record.number + (record.status !== 'draft' && record.version ? '-v' + record.version : '-draft') + '.pdf'); }
function FinancialEditor({ kind, companyId, view, record, busy, onSave, onCancel, onError }: {
    kind: FinancialKind;
    companyId: string;
    view: View;
    record: FinancialRecord | null;
    busy: boolean;
    onSave: (draft: FinancialDraft) => void;
    onCancel: () => void;
    onError: (s: string) => void;
}) {
    const [d, setD] = useState<FinancialDraft>(record ? payloadDraft(record) : newFinancialDraft()), [selected, setSelected] = useState(''), [overtime, setOvertime] = useState(false), [loadingScope, setLoadingScope] = useState(false);
    const [numbers, setNumbers] = useState<Record<string, {
        quantity: string;
        price: string;
    }>>(() => Object.fromEntries((record?.pricing.order || []).map(id => [id, { quantity: String(record!.pricing.items[id].quantityMilli / 1000), price: moneyInput(record!.pricing.items[id].unitPriceCents) }]))), [discount, setDiscount] = useState(moneyInput(record?.pricing.discountCents || 0)), [tax, setTax] = useState(moneyInput(record?.pricing.taxRateBps || 0));
    const scopeGeneration = useRef(0);
    function setPricing(p: PricingDraft) { setD(old => ({ ...old, pricing: pricingOnly(p) })); setNumbers(Object.fromEntries(p.order.map(id => [id, { quantity: String(p.items[id].quantityMilli / 1000), price: moneyInput(p.items[id].unitPriceCents) }]))); setDiscount(moneyInput(p.discountCents)); setTax(moneyInput(p.taxRateBps)); }
    async function selectOrder(wid: string) { const g = ++scopeGeneration.current; const wo = view.orders.find(w => w.id === wid); setD(old => ({ ...old, workOrderId: wid, ...(wo ? { customerId: wo.customerId, propertyId: wo.propertyId, title: old.title || wo.title, description: old.description || wo.title } : {}) })); if (wo && (kind === 'changeOrder' || kind === 'invoice')) {
        setLoadingScope(true);
        try {
            const p = (await httpsCallable<unknown,{record:WorkOrderPricing|null}>(await getPricingFunctions(),'financialWorkOrderScope')({companyId,kind,workOrderId:wid})).data;
            if (!p.record)
                throw Error('This work order has no saved billable charges.');
            if (g === scopeGeneration.current)
                setPricing(p.record);
        }
        catch (e) {
            onError((e as Error).message);
        }
        finally {
            if (g === scopeGeneration.current)
                setLoadingScope(false);
        }
    } }
    function add(line: ChargeLine) { if (d.pricing.order.length >= MAX_LINES)
        return; setNumbers(n => ({ ...n, [line.id]: { quantity: '1', price: moneyInput(line.unitPriceCents) } })); setD(old => ({ ...old, pricing: { ...old.pricing, items: { ...old.pricing.items, [line.id]: line }, order: [...old.pricing.order, line.id] } })); }
    function parsed() { return { ...d, pricing: { ...d.pricing, discountCents: parseDecimal(discount, 2), taxRateBps: d.pricing.taxEnabled ? parseDecimal(tax, 2) : 0, taxLabel: d.pricing.taxEnabled ? d.pricing.taxLabel : '', items: Object.fromEntries(d.pricing.order.map(id => { const l = d.pricing.items[id], quantityMilli = parseDecimal(numbers[id].quantity, 3), unitPriceCents = parseDecimal(numbers[id].price, 2); return [id, { ...l, quantityMilli, unitPriceCents, extendedCents: extended(quantityMilli, unitPriceCents) }]; })) } }; }
    let amounts: ReturnType<typeof totals> | null = null;
    try {
        amounts = totals(parsed().pricing);
    }
    catch { /* Partial decimal input is validated on save. */ }
    const lockedPricing = kind === 'invoice' && !!d.workOrderId, chosen = view.catalog.find(c => c.id === selected);
    return <section className="panel financial-editor" aria-label="Financial draft editor"><h2>{record ? 'Edit' : 'New'} {names[kind].toLowerCase()}</h2><form onSubmit={e => { e.preventDefault(); try {
        const draft = parsed();
        totals(draft.pricing);
        onSave(draft);
    }
    catch (e) {
        onError((e as Error).message);
    } }}><fieldset disabled={busy || loadingScope}><label>Work order {kind === 'changeOrder' ? '(required)' : '(optional)'}<select aria-label="Linked work order" value={d.workOrderId} required={kind === 'changeOrder'} disabled={!!record?.workOrderId} onChange={e => void selectOrder(e.target.value)}><option value="">{kind === 'invoice' ? 'Manual invoice' : 'No work order'}</option>{view.orders.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}</select></label><div className="form-grid"><label>Customer<select aria-label="Customer" required value={d.customerId} disabled={!!d.workOrderId} onChange={e => setD({ ...d, customerId: e.target.value, propertyId: '' })}><option value="">Select customer</option>{view.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Property<select aria-label="Property" required value={d.propertyId} disabled={!!d.workOrderId} onChange={e => setD({ ...d, propertyId: e.target.value })}><option value="">Select property</option>{view.properties.filter(p => p.customerId === d.customerId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><label>Originating estimate ID (optional)<input maxLength={128} value={d.estimateId} onChange={e => setD({ ...d, estimateId: e.target.value })}/></label><label>Document title<input required maxLength={160} value={d.title} onChange={e => setD({ ...d, title: e.target.value })}/></label><label>Customer-facing description<textarea required maxLength={4000} rows={3} value={d.description} onChange={e => setD({ ...d, description: e.target.value })}/></label><label>Internal notes<textarea maxLength={4000} rows={2} value={d.internalNotes} onChange={e => setD({ ...d, internalNotes: e.target.value })}/></label>{kind === 'estimate' && <label>Expiration date (UTC)<input type="date" value={d.expiresOn} onChange={e => setD({ ...d, expiresOn: e.target.value })}/></label>}{kind === 'invoice' && <label>Due date (UTC)<input type="date" value={d.dueOn} onChange={e => setD({ ...d, dueOn: e.target.value })}/></label>}
 <h3>{kind === 'changeOrder' ? 'Proposed complete billable scope' : 'Line items'}</h3>{lockedPricing ? <p>Invoice amounts come from saved work-order charges, including applied approved changes. Use Refresh from work order after saving this draft if scope changes.</p> : <><div className="financial-actions"><label>Catalog item<select aria-label="Catalog item" value={selected} onChange={e => { setSelected(e.target.value); setOvertime(false); }}><option value="">Select catalog item</option>{view.catalog.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.code} · {c.name} · {usd(c.sellingPriceCents)}</option>)}</select></label>{chosen?.kind === 'labor' && <label className="financial-check"><input type="checkbox" checked={overtime} onChange={e => setOvertime(e.target.checked)}/>Use overtime selling rate</label>}<button type="button" className="btn secondary" disabled={!chosen || d.pricing.order.length >= MAX_LINES} onClick={() => { if (chosen)
        add(catalogLine(chosen, overtime ? 'overtime' : 'standard')); }}>Add catalog charge</button><button type="button" className="btn secondary" disabled={d.pricing.order.length >= MAX_LINES} onClick={() => add(customLine())}>Add custom charge</button></div></>}
 {d.pricing.order.map((id, i) => { const l = d.pricing.items[id]; return <fieldset className="financial-line" key={id} disabled={lockedPricing}><legend>Charge {i + 1}</legend><label>Description<input aria-label={`Charge ${i + 1} description`} required maxLength={2200} value={l.description} onChange={e => setD({ ...d, pricing: { ...d.pricing, items: { ...d.pricing.items, [id]: { ...l, description: e.target.value } } } })}/></label><div className="form-grid"><label>Quantity<input aria-label={`Charge ${i + 1} quantity`} required inputMode="decimal" value={numbers[id].quantity} onChange={e => setNumbers({ ...numbers, [id]: { ...numbers[id], quantity: e.target.value } })}/></label><label>Unit<input aria-label={`Charge ${i + 1} unit`} required maxLength={40} value={l.unit} onChange={e => setD({ ...d, pricing: { ...d.pricing, items: { ...d.pricing.items, [id]: { ...l, unit: e.target.value } } } })}/></label><label>Rate (USD)<input aria-label={`Charge ${i + 1} rate`} required inputMode="decimal" value={numbers[id].price} onChange={e => setNumbers({ ...numbers, [id]: { ...numbers[id], price: e.target.value } })}/></label></div><div className="financial-actions"><button type="button" className="btn secondary" disabled={i === 0} onClick={() => { const order = [...d.pricing.order]; [order[i - 1], order[i]] = [order[i], order[i - 1]]; setD({ ...d, pricing: { ...d.pricing, order } }); }}>Move charge {i + 1} up</button><button type="button" className="btn secondary" onClick={() => { const items = { ...d.pricing.items }; delete items[id]; setD({ ...d, pricing: { ...d.pricing, items, order: d.pricing.order.filter(k => k !== id) } }); }}>Remove charge {i + 1}</button></div></fieldset>; })}
 <fieldset disabled={lockedPricing}><label>Discount (USD)<input required inputMode="decimal" value={discount} onChange={e => setDiscount(e.target.value)}/></label><label className="financial-check"><input type="checkbox" checked={d.pricing.taxEnabled} onChange={e => setD({ ...d, pricing: { ...d.pricing, taxEnabled: e.target.checked, taxRateBps: 0, taxLabel: e.target.checked ? d.pricing.taxLabel : '' } })}/>Explicitly configure tax</label>{d.pricing.taxEnabled && <div className="form-grid"><label>Tax label<input required maxLength={80} value={d.pricing.taxLabel} onChange={e => setD({ ...d, pricing: { ...d.pricing, taxLabel: e.target.value } })}/></label><label>Tax rate (%)<input required inputMode="decimal" value={tax} onChange={e => setTax(e.target.value)}/></label></div>}</fieldset><p>No tax rate is inferred. One explicitly named rate applies to the discounted subtotal.</p>{amounts && <div className="pricing-summary"><p>Subtotal <strong>{usd(amounts.subtotalCents)}</strong></p><p>Tax <strong>{usd(amounts.taxCents)}</strong></p><p>Total <strong>{usd(amounts.totalCents)}</strong></p>{kind === 'changeOrder' && record?.basePricing && <p>Change delta <strong>{usd(amounts.totalCents - totals(record.basePricing).totalCents)}</strong></p>}</div>}<div className="financial-actions"><button type="button" className="btn secondary" onClick={onCancel}>Cancel editor</button><button className="btn primary">{busy ? 'Waiting for server…' : 'Save draft'}</button></div></fieldset></form></section>;
}
export default function CompanyFinancials({ companyId, kind, membership }: {
    companyId: string;
    kind: FinancialKind;
    membership?:Membership;
}) {
    const [view, setView] = useState<View | null>(null), [selected, setSelected] = useState(''), [edit, setEdit] = useState(false), [createId, setCreateId] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState(''), [showArchive, setShowArchive] = useState(false), [version, setVersion] = useState(-1), [detailId, setDetailId] = useState('');
    const pending = useRef<Payload | null>(null);
    async function load(id = selected) { const result = await httpsCallable<{
        companyId: string;
        kind: FinancialKind;
        id?: string;
    }, View>(await getPricingFunctions(), 'financialView')({ companyId, kind, id: id || undefined }); setView(result.data); setDetailId(id); }
    useEffect(() => { setLoading(true); void load().catch(e => setError(e.message)).finally(() => setLoading(false)); }, [companyId, kind]);
    function canAction(action:string){const p=action==='recordPayment'?'invoice.pay':action==='void'?'invoice.void':action==='convert'?'estimate.convert':['accept','decline','approve','reject','cancel'].includes(action)?kind+'.approve':action==='issue'?kind+'.issue':kind+'.edit';return allowed(membership||{active:true,role:'Owner'},p as Permission);}
    async function command(data: Payload, retry = false) { if(!canAction(String(data.action))){setError('Permission denied. An Owner must explicitly grant this financial action.');return;} if (busy)
        return; setBusy(true); setError(''); setNotice(''); let request: Payload | null = null; try {
        request = retry ? pending.current : { ...data, companyId, kind, operationId: crypto.randomUUID() };
        if (!request)
            return;
        pending.current = request;
        const result = await httpsCallable<Payload, {
            id: string;
            workOrderId?: string;
        }>(await getPricingFunctions(), 'financialCommand')(request);
        pending.current = null;
        setSelected(result.data.id);
        setEdit(false);
        setVersion(-1);
        await load(result.data.id);
        setNotice(result.data.workOrderId ? 'Confirmed work order link: ' + result.data.workOrderId : 'Saved and confirmed by the financial backend.');
    }
    catch (e) {
        const err = e as {
            code?: string;
            message: string;
        };
        setError(err.message);
        if (!['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal', 'functions/unknown'].includes(err.code || ''))
            pending.current = null;
    }
    finally {
        setBusy(false);
    } }
    const record = detailId === selected ? view?.records.find(r => r.id === selected) || null : null, resolvedVersion = version < 0 ? (record?.status === 'draft' ? 0 : record?.version || 0) : version, issued = view?.versions.find(v => v.version === resolvedVersion), preview = resolvedVersion === 0 ? record : issued || record;
    function transition(action: string, extras: Payload = {}) { if (!record)
        return; const note = window.prompt('Reason / audit note (required)'); if (!note)
        return; void command({ action, id: record.id, revision: record.revision, note, ...extras }); }
    function newDraft() { setSelected(''); setCreateId(crypto.randomUUID()); setEdit(true); setError(''); setNotice(''); }
    const filtered = view?.records.filter(r => (showArchive || !r.archived) && (!status || r.effectiveStatus === status) && [r.number, r.title, r.description, view.customers.find(c => c.id === r.customerId)?.name, view.properties.find(p => p.id === r.propertyId)?.name].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.updatedAtMs - a.updatedAtMs) || [];
    return <div className="financial-module" aria-busy={busy || loading}><p>Company financial records · USD · No payments are processed or sent to customers.</p>{error && <p role="alert" className="warning">{error}</p>}{notice && <p role="status">{notice}</p>}<div className="financial-actions"><button className="btn primary" disabled={!view || busy || edit} onClick={newDraft}>New {names[kind].toLowerCase()}</button><button className="btn secondary" disabled={busy || edit} onClick={() => { setLoading(true); setError(''); void load().catch(e => setError(e.message)).finally(() => setLoading(false)); }}>Refresh financial records</button>{pending.current && <button className="btn secondary" disabled={busy} onClick={() => command({}, true)}>Retry unconfirmed financial operation</button>}</div>{loading && <p role="status">Loading financial records…</p>}
 {view?.unsupportedCount ? <p role="status">{view.unsupportedCount} existing financial records have unsupported schemas. They are preserved; migration is not enabled.</p> : null}{view && edit && <FinancialEditor key={createId || record?.id} kind={kind} companyId={companyId} view={view} record={record} busy={busy || !!pending.current} onError={setError} onCancel={() => setEdit(false)} onSave={draft => { const id = record?.id || createId; if (kind === 'invoice' && draft.workOrderId && !record?.sourcePricingRevision)
        void command({ action: 'fromWorkOrder', id, revision: record?.revision || 0, workOrderId: draft.workOrderId, dueOn: draft.dueOn, metadata: { title: draft.title, description: draft.description, internalNotes: draft.internalNotes, estimateId: draft.estimateId }, note: 'Create invoice from explicit billable charges' });
    else
        void command({ action: 'saveDraft', id, revision: record?.revision || 0, draft, note: 'Save financial draft' }); }}/>}
 {view && !edit && !record && <section className="panel"><div className="financial-filters"><label>Search financial records<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Number, title, customer or property"/></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{[...new Set(view.records.map(r => r.effectiveStatus))].map(s => <option key={s}>{s}</option>)}</select></label><label className="financial-check"><input type="checkbox" checked={showArchive} onChange={e => setShowArchive(e.target.checked)}/>Include archived drafts</label></div><div className="table-scroll"><table><thead><tr><th>Document</th><th>Customer / property</th><th>Status</th><th>Total</th>{kind === 'invoice' && <th>Balance</th>}</tr></thead><tbody>{filtered.map(r => <tr key={r.id}><td><button className="text-btn" onClick={() => { setSelected(r.id); setVersion(-1); setLoading(true); void load(r.id).catch(e => setError(e.message)).finally(() => setLoading(false)); }}>{r.number} · {r.title}</button></td><td>{view.customers.find(c => c.id === r.customerId)?.name}<br />{view.properties.find(p => p.id === r.propertyId)?.name}</td><td>{r.effectiveStatus}{r.archived ? ' · archived' : ''}</td><td>{usd(r.totalCents)}{kind === 'changeOrder' && <p>Delta {usd(r.deltaCents || 0)}</p>}</td>{kind === 'invoice' && <td>{usd(r.balanceCents)}</td>}</tr>)}</tbody></table></div>{!filtered.length && <p className="financial-empty">No matching financial records.</p>}</section>}
 {view && record && !edit && <><section className="panel financial-detail"><div className="financial-actions"><button className="btn secondary" disabled={busy} onClick={() => { setSelected(''); setVersion(-1); }}>Back to list</button><h2>{record.number} · {record.effectiveStatus}</h2></div><p>{record.title} · revision {record.revision}{record.archived ? ' · archived' : ''}</p><p>Customer: {view.customers.find(c => c.id === record.customerId)?.name || record.customerSnapshot?.name} · Property: {view.properties.find(p => p.id === record.propertyId)?.name || record.propertySnapshot?.name}</p><p>Work order: {record.convertedWorkOrderId || record.workOrderId || 'Not linked'}</p><p className="financial-scope">Internal notes (not in customer preview): {record.internalNotes || 'None'}</p><div className="financial-actions">
 {record.status === 'draft' && !record.archived && <><button className="btn secondary" disabled={busy||!canAction('saveDraft')} onClick={() => { setCreateId(''); setEdit(true); }}>Edit draft</button><button className="btn primary" disabled={busy||!canAction('issue')}  onClick={() => transition('issue')}>Issue {names[kind].toLowerCase()}</button><button className="btn secondary" disabled={busy||!canAction('archive')}  onClick={() => transition('archive')}>Archive draft</button>{kind === 'invoice' && record.workOrderId && <button className="btn secondary" disabled={busy} onClick={() => command({ action: 'fromWorkOrder', id: record.id, revision: record.revision, workOrderId: record.workOrderId, dueOn: record.dueOn, note: 'Refresh invoice from approved work-order scope' })}>Refresh from work order</button>}</>}
 {kind === 'estimate' && <><button className="btn secondary" disabled={busy||!canAction('duplicate')}  onClick={() => command({ action: 'duplicate', id: crypto.randomUUID(), sourceId: record.id, revision: 0, note: 'Duplicate estimate into separate draft' })}>Duplicate estimate</button>{record.effectiveStatus === 'issued' && <><button className="btn primary" disabled={busy||!canAction('accept')}  onClick={() => transition('accept')}>Mark accepted</button><button className="btn secondary" disabled={busy||!canAction('decline')}  onClick={() => transition('decline')}>Mark declined</button></>}{record.status === 'accepted' && !record.convertedWorkOrderId && <button className="btn primary" disabled={busy||!canAction('convert')}  onClick={() => { if (window.confirm('Create or link one work order using this exact accepted estimate version? Existing different work-order charges will not be overwritten.'))
            transition('convert', { confirm: true }); }}>Convert accepted estimate</button>}{['issued', 'accepted', 'declined', 'expired'].includes(record.effectiveStatus) && !record.convertedWorkOrderId && <button className="btn secondary" disabled={busy||!canAction('supersede')}  onClick={() => transition('supersede')}>Supersede estimate</button>}{record.status === 'superseded' && <button className="btn secondary" disabled={busy||!canAction('revise')}  onClick={() => transition('revise')}>Create revised draft</button>}</>}
 {kind === 'changeOrder' && record.status === 'issued' && <><button className="btn primary" disabled={busy||!canAction('approve')}  onClick={() => { if (window.confirm('Approve and apply this exact change to billable work-order scope?'))
            transition('approve'); }}>Approve and apply change</button><button className="btn secondary" disabled={busy||!canAction('reject')}  onClick={() => transition('reject')}>Reject change</button></>}{kind === 'changeOrder' && ['draft', 'issued'].includes(record.status) && <button className="btn secondary" disabled={busy||!canAction('cancel')}  onClick={() => transition('cancel')}>Cancel change order</button>}
 {kind === 'invoice' && record.status === 'issued' && record.paidCents === 0 && <button className="btn secondary" disabled={busy||!canAction('void')}  onClick={() => { if (window.confirm('Void this unpaid issued invoice? Its immutable history will remain.'))
            transition('void', { confirm: true }); }}>Void invoice</button>}
 </div>{kind === 'changeOrder' && record.basePricing && <div className="financial-delta"><h3>Billable scope changes</h3><p>Original {usd(totals(record.basePricing).totalCents)} → Proposed/approved {usd(record.totalCents)} · Delta {usd(record.deltaCents || 0)}</p>{(() => { const delta = scopeDelta(record.basePricing!, record.pricing); return <><p>Added: {delta.added.map(id => record.pricing.items[id].description).join(', ') || 'None'}</p><p>Removed: {delta.removed.map(id => record.basePricing!.items[id].description).join(', ') || 'None'}</p><p>Revised: {delta.revised.map(id => record.pricing.items[id].description).join(', ') || 'None'}</p></>; })()}<p>{record.applied ? 'Approved change was applied once.' : 'No work-order scope is changed until approval succeeds.'}</p></div>}
 </section>{kind === 'invoice' && <section className="panel financial-detail"><h2>Payments and balance</h2><p>Recorded {usd(record.paidCents)} · Remaining {usd(record.balanceCents)}</p>{['issued', 'partially paid'].includes(record.status) && record.balanceCents > 0 && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); try {
            const amountCents = parseDecimal(String(f.get('amount')), 2);
            void command({ action: 'recordPayment', id: record.id, revision: record.revision, paymentId: crypto.randomUUID(), amountCents, paidOn: f.get('paidOn'), reference: f.get('reference'), method: f.get('method'), note: 'Record external/manual payment' });
        }
        catch (e) {
            setError((e as Error).message);
        } }}><div className="form-grid"><label>Payment amount (USD)<input name="amount" required inputMode="decimal"/></label><label>Payment date (UTC)<input name="paidOn" type="date" required max={view.today} defaultValue={view.today}/></label><label>Payment reference<input name="reference" required maxLength={120}/></label><label>Payment method<select name="method">{['cash', 'check', 'bank transfer', 'card recorded externally', 'other'].map(m => <option key={m}>{m}</option>)}</select></label></div><button className="btn primary" disabled={busy||!canAction('recordPayment')}>Record payment</button></form>}<ul>{view.payments.map(p => <li key={p.id}>{p.paidOn} · {usd(p.amountCents)} · {p.method} · {p.reference}</li>)}</ul></section>}
 {preview && <section className="panel financial-detail"><div className="financial-actions"><label>Preview version<select value={resolvedVersion} onChange={e => setVersion(Number(e.target.value))}>{record.status === 'draft' && <option value="0">Current draft</option>}{view.versions.map(v => <option key={v.version} value={v.version}>Issued version {v.version}</option>)}</select></label><button className="btn secondary" disabled={busy} onClick={() => void download(preview, record).catch(e => setError(e.message))}>Download {resolvedVersion ? 'issued' : 'draft'} PDF</button></div><Preview record={preview} current={record}/></section>}
 <section className="panel financial-detail"><h2>Immutable financial history</h2>{view.events.sort((a, b) => b.revision - a.revision).map(e => <details key={e.id}><summary>Revision {e.revision} · {e.operation} · {e.note}</summary><p>{new Date(e.atMs).toLocaleString()} · {e.actorUid} · issued version {e.version}</p><p>{e.snapshot.status} · {usd(e.snapshot.totalCents)}</p></details>)}</section></>}
 </div>;
}
