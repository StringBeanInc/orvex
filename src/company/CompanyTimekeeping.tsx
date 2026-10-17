import { useEffect, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getPricingFunctions } from '../firebase';
import { defaultTimePolicy } from './timeModel';
import type { LocationFix, TimeEntry, TimePolicy } from './timeModel';
import './timekeeping.css';
type Entry = TimeEntry & {
    workedMs: number;
    overtimeMs: number;
    costCents?: number | null;
};
type Request = {
    id: string;
    entryId: string;
    technicianId: string;
    minutes?: number;
    reason: string;
    status: string;
    start?: number;
    end?: number;
};
type View = {
    role: string;
    canReview?:boolean;canConfigure?:boolean;canReadCosts?:boolean;
    uid: string;
    now: number;
    policy: TimePolicy;
    policyRevision: number;
    orders: {
        id: string;
        title: string;
        propertyId: string;
        assignedTechnicianId: string;
        property?: {
            name: string;
            address: string;
            city: string;
        };
    }[];
    entries: Entry[];
    requests: Request[];
    corrections: Request[];
    events: {
        id: string;
        action: string;
        atMs: number;
        technicianId: string;
        reason: string;
        gpsResult?: string;
        decision?: string;
    }[];
    employees: {
        id: string;
        name: string;
        active: boolean;
    }[];
    rates: {
        id: string;
        name: string;
        internalCostCents: number | null;
    }[];
    sites: {
        id: string;
        latitude: number;
        longitude: number;
    }[];
    profiles: {
        id: string;
        rateId: string;
    }[];
    reviews: {
        entryId: string;
        entryRevision: number;
        reason: string;
    }[];
};
type Payload = Record<string, unknown>;
const hours = (ms: number) => (ms / 3600000).toFixed(2), money = (c: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);
async function locationFix(): Promise<LocationFix> { return new Promise(resolve => { if (!navigator.geolocation) {
    resolve({ status: 'unavailable' });
    return;
} navigator.geolocation.getCurrentPosition(p => resolve({ status: 'ok', latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, observedAt: p.timestamp }), e => resolve({ status: e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable' }), { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }); }); }
export default function CompanyTimekeeping({ companyId }: {
    companyId: string;
}) {
    const [view, setView] = useState<View | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [policy, setPolicy] = useState<TimePolicy>(defaultTimePolicy), [policyRevision, setPolicyRevision] = useState(0), [alerts, setAlerts] = useState(false), [grant, setGrant] = useState(''), [offDuty, setOffDuty] = useState(false);
    const pending = useRef<Payload | null>(null), audio = useRef<AudioContext | null>(null), reminded = useRef(new Set<string>()), generation = useRef(0);
    async function load(updatePolicy = true) { const call = httpsCallable<{
        companyId: string;
    }, View>(await getPricingFunctions(), 'timekeepingView'); const result = await call({ companyId }); setView(result.data); if (updatePolicy) {
        setPolicy(result.data.policy);
        setPolicyRevision(result.data.policyRevision);
    } }
    useEffect(() => { const g = ++generation.current; void load().catch(e => { if (g === generation.current)
        setError(e.message); }).finally(() => setLoading(false)); return () => { generation.current++; }; }, [companyId]);
    async function command(payload: Payload, retry = false) { setBusy(true); setError(''); setNotice(''); const data = retry ? pending.current : { ...payload, companyId, operationId: crypto.randomUUID() }; if (!data) {
        setBusy(false);
        return;
    } pending.current = data; try {
        const result = await httpsCallable<Payload, {
            grantId?: string;
            gps?: unknown;
            requiresFreshRequest?: boolean;
        }>(await getPricingFunctions(), 'timekeepingCommand')(data);
        pending.current = null;
        setNotice(result.data.grantId ? 'One-use GPS exception: ' + result.data.grantId : result.data.gps ? JSON.stringify(result.data.gps) : 'Saved and confirmed by the server.');
        await load();
    }
    catch (e) {
        const err = e as {
            message?: string;
            code?: string;
        };
        setError(err.message || 'Unable to confirm the operation. Retry with the same request ID.');
        if (!['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal', 'functions/unknown'].includes(err.code || ''))
            pending.current = null;
    }
    finally {
        setBusy(false);
    } }
    async function clock(action: string, entry?: Entry, workOrderId?: string) { setBusy(true); setNotice('Checking location for this event…'); const location = await locationFix(); await command({ action, entryId: entry?.id, workOrderId, location, grantId: grant || undefined, offDuty }); setOffDuty(false); }
    const admin = view && (view.canReview??['Owner', 'Admin'].includes(view.role)), active = view?.entries.find(e => e.technicianId === view.uid && e.state !== 'closed');
    useEffect(() => { if (!alerts || !active || active.state !== 'working' || active.meals.length)
        return; const tick = () => { const current = Date.now(), elapsed = current - active.start, format = new Intl.DateTimeFormat('en-GB', { timeZone: active.policy.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), scheduled = format.format(active.start) <= active.policy.lunchSchedule && format.format(current) >= active.policy.lunchSchedule; if ((elapsed < active.policy.lunchAfterMinutes * 60000 && !scheduled) || reminded.current.has(active.id))
        return; reminded.current.add(active.id); setNotice('Lunch reminder: record your actual meal break when you stop working.'); if (audio.current) {
        const osc = audio.current.createOscillator();
        osc.connect(audio.current.destination);
        osc.start();
        osc.stop(audio.current.currentTime + 0.4);
    } if ('Notification' in window && Notification.permission === 'granted')
        new Notification('ORVEX lunch reminder', { body: 'Record your meal start when you stop working.' }); }; tick(); const timer = setInterval(tick, 15000); return () => clearInterval(timer); }, [alerts, active]);
    useEffect(() => { if (!view || busy)
        return; const timer = setInterval(() => { void load(false).catch(e => setError(e.message)); }, 30000); return () => clearInterval(timer); }, [!!view, busy, companyId]);
    const ask = (label: string) => window.prompt(label) || '';
    if (loading)
        return <p role="status">Loading timekeeping from the company server…</p>;
    return <div className="timekeeping" aria-busy={busy}>
 <p>GPS is requested only for clock and meal events. Internal labor costs do not add customer charges.</p>
 {error && <p role="alert" className="account-error">{error}</p>}{notice && <p role="status">{notice}</p>}
 <div className="time-actions"><button className="btn secondary" disabled={busy} onClick={() => { setError(''); setLoading(true); void load().catch(e => setError(e.message)).finally(() => setLoading(false)); }}>Refresh / retry load</button>{pending.current && <button className="btn primary" disabled={busy} onClick={() => command({}, true)}>Retry unconfirmed operation</button>}</div>
 {view && <><section className="panel time-section"><h2>My time clock</h2><p>Required radius: {view.policy.radiusFeet} feet. Poor or unavailable GPS requires an administrator exception at clock-in.</p>
 <label>One-use administrator GPS exception (optional)<input value={grant} onChange={e => setGrant(e.target.value)} maxLength={128}/></label>
 <label className="time-check"><input type="checkbox" checked={offDuty} onChange={e => setOffDuty(e.target.checked)}/>I am fully relieved of duties for this meal. At meal end, I confirm it was uninterrupted.</label>
 <button className="btn secondary" disabled={alerts} onClick={async () => { audio.current = new AudioContext(); await audio.current.resume(); if ('Notification' in window && Notification.permission === 'default')
            await Notification.requestPermission(); setAlerts(true); }}>Enable lunch sound / reminders</button><p className="muted">Reminders operate while this page is open. Scheduled lunch: {view.policy.lunchSchedule} ({view.policy.timeZone}), {view.policy.lunchDurationMinutes} minutes; reminder at the scheduled time or after {view.policy.lunchAfterMinutes} minutes worked. Background delivery is not guaranteed.</p>
 {active ? <div className="time-active"><strong>Currently {active.state === 'lunch' ? 'on lunch' : 'clocked in'}</strong><p>Started {new Date(active.start).toLocaleString()} · {hours(active.workedMs)} recorded hours as of last refresh</p><div className="time-actions"><button className="btn primary" disabled={busy} onClick={() => clock(active.state === 'lunch' ? 'lunchEnd' : 'lunchStart', active)}>{active.state === 'lunch' ? 'End lunch' : 'Start lunch'}</button><button className="btn secondary" disabled={busy} onClick={() => clock('clockOut', active)}>Clock out</button><button className="btn secondary" disabled={busy} onClick={() => { const minutes = Number(ask('Requested overtime minutes')), reason = ask('Reason for overtime'); void command({ action: 'requestOvertime', entryId: active.id, minutes, reason }); }}>Request overtime</button></div></div> : <div className="time-job-grid">{view.orders.filter(o => o.assignedTechnicianId === view.uid).map(o => <article className="time-job" key={o.id}><h3>{o.title}</h3><p>{o.property?.name} · {o.property?.address} {o.property?.city}</p><button className="btn primary" disabled={busy} onClick={() => clock('clockIn', undefined, o.id)}>Clock in</button></article>)}{!view.orders.some(o => o.assignedTechnicianId === view.uid) && <p>No active work orders are assigned to you.</p>}</div>}
 </section>
 {admin && <section className="panel time-section"><h2>Labor dashboard</h2><p>{view.entries.filter(e => e.state !== 'closed').length} technicians clocked in · {new Set(view.entries.filter(e => e.state !== 'closed').map(e => e.workOrderId)).size} active tracked work orders · {view.requests.filter(r => r.status === 'pending').length} pending overtime requests</p><p>Hours and overtime are operational estimates. All actual time remains recorded, including unapproved overtime.</p>
 <div className="time-job-grid">{view.employees.map(t => { const entries = view.entries.filter(e => e.technicianId === t.id); return <article className="time-job" key={t.id}><strong>{t.name}</strong><p>{hours(entries.reduce((s, e) => s + e.workedMs, 0))} hours · {hours(entries.reduce((s, e) => s + e.overtimeMs, 0))} overtime</p><p>{entries.find(e => e.state !== 'closed')?.state || 'Off duty'}</p></article>; })}</div>
 <h3>Overtime reviews</h3>{view.requests.map(r => <div className="time-review" key={r.id}><span>{view.employees.find(t => t.id === r.technicianId)?.name || r.technicianId} · {r.minutes} minutes · {r.reason} · {r.status}</span>{r.status === 'pending' && ['approved', 'rejected'].map(decision => <button key={decision} disabled={busy} className="btn secondary" onClick={() => command({ action: 'decideOvertime', entryId: r.entryId, targetId: r.id, decision, reason: ask('Review reason') })}>{decision === 'approved' ? 'Approve' : 'Reject'}</button>)}</div>)}
 <h3>Correction reviews</h3>{view.corrections.map(r => <div className="time-review" key={r.id}><span>{r.reason} · {r.status}{r.start && r.end ? ` · ${new Date(r.start).toLocaleString()} – ${new Date(r.end).toLocaleString()}` : ''}</span>{r.status === 'pending' && ['approved', 'rejected'].map(decision => <button key={decision} disabled={busy} className="btn secondary" onClick={() => command({ action: 'decideCorrection', entryId: r.entryId, targetId: r.id, decision, reason: ask('Review reason') })}>{decision === 'approved' ? 'Approve correction' : 'Reject correction'}</button>)}</div>)}
 </section>}
 <section className="panel time-section"><h2>{admin ? 'Company time entries' : 'My time entries'}</h2><div className="table-scroll"><table><thead><tr><th>Technician / work order</th><th>Time / lunch</th><th>Hours / overtime</th>{admin && <th>Internal cost</th>}<th>Review / actions</th></tr></thead><tbody>{view.entries.map(e => { const approved = view.requests.filter(r => r.entryId === e.id && r.status === 'approved').reduce((s, r) => s + (r.minutes || 0), 0) * 60000, unapproved = Math.max(0, e.overtimeMs - approved), reviewed = view.reviews.some(r => r.entryId === e.id && r.entryRevision === e.revision); return <tr key={e.id}><td>{view.employees.find(t => t.id === e.technicianId)?.name || e.technicianId}<br />{view.orders.find(o => o.id === e.workOrderId)?.title || e.workOrderId}</td><td>{new Date(e.start).toLocaleString()}<br />{e.end ? new Date(e.end).toLocaleString() : e.state}<br />{e.meals.length} meals</td><td>{hours(e.workedMs)} h<br />{hours(e.overtimeMs)} h OT{unapproved > 0 && <p className="account-error">{hours(unapproved)} h unapproved overtime</p>}</td>{admin && <td>{e.costCents == null ? 'Missing rate' : money(e.costCents)}<br />{e.rate?.name} · historical rate v{e.rate?.revision}</td>}<td>{e.flags.map((f, i) => <p key={i}>{f}</p>)}{reviewed && <p>Reviewed at this revision</p>}<div className="time-actions">{e.end && <button className="btn secondary" disabled={busy} onClick={() => { const start = Date.parse(ask('Corrected clock-in (ISO timestamp with timezone)')), end = Date.parse(ask('Corrected clock-out (ISO timestamp with timezone)')), restoreMeals = window.confirm('Restore all deducted meals as paid time?'), reason = ask('Correction reason (a different administrator must review)'); void command({ action: 'requestCorrection', entryId: e.id, start, end, restoreMeals, reason }); }}>Request correction</button>}{admin && <><button className="btn secondary" disabled={busy} onClick={() => command({ action: 'reviewException', entryId: e.id, reason: ask('Review findings') })}>Record review</button>{e.state !== 'closed' && <button className="btn secondary" disabled={busy} onClick={() => command({ action: 'adminClockOut', entryId: e.id, reason: ask('Reason for administrator clock-out') })}>Admin clock-out</button>}</>}</div></td></tr>; })}</tbody></table></div>{!view.entries.length && <p>No tracked time yet.</p>}</section>
 {admin && (view.canConfigure??true) && <><details className="panel time-section"><summary>Timekeeping setup and policies</summary>
 <h3>Property GPS location</h3><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void command({ action: 'saveSite', targetId: f.get('propertyId'), latitude: Number(f.get('latitude')), longitude: Number(f.get('longitude')), reason: f.get('reason') }); }}><label>Property<select name="propertyId" required>{[...new Map(view.orders.map(o => [o.propertyId, o])).values()].map(o => <option key={o.propertyId} value={o.propertyId}>{o.property?.name || o.propertyId}</option>)}</select></label><label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" required/></label><label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" required/></label><label>Verification reason<input name="reason" minLength={5} maxLength={500} required/></label><button className="btn primary" disabled={busy}>Save verified property location</button></form>
 <h3>Internal labor rate assignment</h3><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void command({ action: 'saveProfile', targetId: f.get('employeeId'), rateId: f.get('rateId'), reason: f.get('reason') }); }}><label>Employee<select name="employeeId">{view.employees.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Labor rate<select name="rateId">{view.rates.filter(r => r.internalCostCents !== null).map(r => <option key={r.id} value={r.id}>{r.name} · internal {money(r.internalCostCents!)}/hour</option>)}</select></label><label>Reason<input name="reason" required minLength={5}/></label><button disabled={busy} className="btn primary">Save labor rate assignment</button></form>
 <h3>Company policy</h3><form onSubmit={e => { e.preventDefault(); void command({ action: 'savePolicy', value: policy, revision: policyRevision, reason: ask('Policy change reason') }); }}>{(['radiusFeet', 'maxAccuracyMeters', 'dailyMinutes', 'weeklyMinutes', 'overtimeMultiplierBps', 'lunchAfterMinutes', 'lunchDurationMinutes', 'gpsRetentionDays', 'weekStartsOn'] as const).map(k => <label key={k}>{({ radiusFeet: 'Geofence radius (feet)', maxAccuracyMeters: 'Maximum GPS uncertainty (meters)', dailyMinutes: 'Daily overtime threshold (minutes)', weeklyMinutes: 'Weekly overtime threshold (minutes)', overtimeMultiplierBps: 'Internal overtime multiplier (15000 = 1.5×)', lunchAfterMinutes: 'Lunch reminder after (minutes)', lunchDurationMinutes: 'Required uninterrupted meal duration (minutes)', gpsRetentionDays: 'Raw GPS retention (days; 0 disables storage)', weekStartsOn: 'Workweek starts on (0 Sunday – 6 Saturday)' })[k]}<input type="number" value={policy[k]} onChange={e => setPolicy({ ...policy, [k]: Number(e.target.value) })} required/></label>)}<label>Company time zone<input value={policy.timeZone} onChange={e => setPolicy({ ...policy, timeZone: e.target.value })} required/></label><label>Scheduled lunch<input type="time" value={policy.lunchSchedule} onChange={e => setPolicy({ ...policy, lunchSchedule: e.target.value })}/></label><label className="time-check"><input type="checkbox" checked={policy.unpaidMeals} onChange={e => setPolicy({ ...policy, unpaidMeals: e.target.checked })}/>Enable unpaid confirmed, uninterrupted meals under a reviewed policy</label><label>Reviewed meal policy / jurisdiction<input value={policy.mealPolicyReference} onChange={e => setPolicy({ ...policy, mealPolicyReference: e.target.value })} maxLength={500}/></label><label className="time-check"><input type="checkbox" checked={policy.gpsAdminAccess} onChange={e => setPolicy({ ...policy, gpsAdminAccess: e.target.checked })}/>Allow audited administrator access to retained GPS</label><button className="btn primary" disabled={busy}>Save company time policy</button></form>
 <h3>GPS exceptions and retention</h3><button className="btn secondary" disabled={busy} onClick={() => command({ action: 'grantGpsException', technicianId: ask('Assigned technician UID'), workOrderId: ask('Work order ID'), reason: ask('Reason for one-use clock-in exception') })}>Grant one-use GPS exception</button><button className="btn secondary" disabled={busy} onClick={() => command({ action: 'readGps', targetId: ask('Clock event ID'), reason: ask('Reason for access to retained GPS') })}>Audited GPS access</button><button className="btn secondary" disabled={busy} onClick={() => command({ action: 'purgeExpiredGps' })}>Purge expired GPS supplements</button><p>Expired coordinates cannot be read through the app. Physical removal requires this purge during the local phase. Immutable event history contains no coordinates.</p>
 </details></>}
 <details className="panel time-section"><summary>Immutable clock and approval history</summary>{view.events.sort((a, b) => b.atMs - a.atMs).map(e => <p key={e.id}>{new Date(e.atMs).toLocaleString()} · {e.action} · {e.decision} · {e.gpsResult} · {e.reason}</p>)}</details></>}
 </div>;
}
