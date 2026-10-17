import {authorize} from './authorization.mjs';
// Trusted timekeeping operations; deliberately unavailable outside local emulators.
import { createHash } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defaultTimePolicy, validateTimePolicy, geofence, ledger } from './shared/timeModel.js';
const fail = (code, message) => { throw new HttpsError(code, message); };
const id = v => { if (typeof v !== 'string' || !/^[-A-Za-z0-9_]{1,128}$/.test(v))
    fail('invalid-argument', 'Invalid record reference.'); return v; };
const reason = v => { if (typeof v !== 'string' || v.trim().length < 5 || v.length > 500)
    fail('invalid-argument', 'A review reason of 5–500 characters is required.'); return v.trim(); };
function runtime() { const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT, p = project === 'demo-orvex-phase3c-tests' ? ['127.0.0.1:8280', '127.0.0.1:9299'] : project === 'demo-orvex-phase3d-tests' ? ['127.0.0.1:18380', '127.0.0.1:19499'] : project === 'demo-orvex' ? ['127.0.0.1:8080', '127.0.0.1:9099'] : null; if (process.env.FUNCTIONS_EMULATOR !== 'true' || !p || process.env.FIRESTORE_EMULATOR_HOST !== p[0] || process.env.FIREBASE_AUTH_EMULATOR_HOST !== p[1])
    fail('failed-precondition', 'Timekeeping requires explicitly configured local emulators. Production is disabled.'); if (!getApps().length)
    initializeApp({ projectId: project }); return getFirestore(); }
async function scope(db,request,tx){const s=await authorize(db,request,tx);if(!s.can('time.self')&&!s.can('time.review'))fail('permission-denied','Timekeeping permission required.');return {...s,admin:s.can('time.review'),role:s.membership.role};}
async function bounded(tx, q) { const result = await tx.get(q.limit(1001)); if (result.size > 1000)
    fail('resource-exhausted', 'Timekeeping history exceeds the local reporting limit. A paginated backend is required.'); return result.docs.map(d => ({ ...d.data(), id: d.id })); }
const callable = handler => onCall({ region: 'us-central1', timeoutSeconds: 30, maxInstances: 2 }, handler);
export const timekeepingView = callable(async (request) => {
    const db = runtime();
    return db.runTransaction(async (tx) => {
        const s = await scope(db, request, tx), policyDoc = await tx.get(s.root.collection('timePolicies').doc('main')), policy = policyDoc.data()?.value || {...defaultTimePolicy,timeZone:s.company.timeZone||defaultTimePolicy.timeZone};
        const entries = await bounded(tx, s.admin ? s.root.collection('timeEntries') : s.root.collection('timeEntries').where('technicianId', '==', s.uid));
        const orders = await bounded(tx, s.admin ? s.root.collection('workOrders') : s.root.collection('workOrders').where('assignedTechnicianId', '==', s.uid));
        const properties = await Promise.all([...new Set(orders.map(o => o.propertyId))].map(pid => tx.get(s.root.collection('properties').doc(id(pid)))));
        const names = Object.fromEntries(properties.filter(p => p.exists).map(p => [p.id, { name: p.data().name, address: p.data().address, city: p.data().city }]));
        const requests = await bounded(tx, s.admin ? s.root.collection('overtimeRequests') : s.root.collection('overtimeRequests').where('technicianId', '==', s.uid));
        const corrections = await bounded(tx, s.admin ? s.root.collection('timeCorrections') : s.root.collection('timeCorrections').where('technicianId', '==', s.uid));
        const events = await bounded(tx, s.admin ? s.root.collection('timeEvents') : s.root.collection('timeEvents').where('technicianId', '==', s.uid));
        let employees = [], rates = [], sites = [], profiles = [], reviews = [];
        if (s.admin) {
            employees = await bounded(tx, s.root.collection('employees'));
            if(s.can('costs.read'))rates = await bounded(tx, s.root.collection('pricingCatalog').where('kind', '==', 'labor'));
            sites = await bounded(tx, s.root.collection('timeSites'));
            profiles = await bounded(tx, s.root.collection('timeProfiles'));
            reviews = await bounded(tx, s.root.collection('timeReviews'));
        }
        const now = Date.now(), amounts = ledger(entries, policy, now);
        return { canReview:s.admin,canConfigure:s.can('time.configure'),canReadCosts:s.can('costs.read'), role: s.role, uid: s.uid, now, policy, policyRevision: policyDoc.data()?.revision || 0, orders: orders.filter(o => !['Completed', 'Closed'].includes(o.status)).map(o => ({ id: o.id, title: o.title, propertyId: o.propertyId, property: names[o.propertyId], assignedTechnicianId: o.assignedTechnicianId })), entries: entries.map(e => s.can('costs.read') ? { ...e, ...amounts[e.id] } : (({ rate, ...rest }) => ({ ...rest, workedMs: amounts[e.id].workedMs, overtimeMs: amounts[e.id].overtimeMs }))(e)), requests, corrections, events, employees: employees.map(e => ({ id: e.id, name: e.name, role: e.role, active: e.active !== false })), rates: rates.filter(r => r.active).map(r => ({ id: r.id, name: r.name, internalCostCents: r.internalCostCents })), sites, profiles, reviews };
    });
});
export const timekeepingCommand = callable(async (request) => {
    const db = runtime(), input = request.data || {}, action = input.action, operationId = id(input.operationId), fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return db.runTransaction(async (tx) => {
        const s = await scope(db, request, tx);
        const required=['savePolicy','saveSite','grantGpsException','purgeExpiredGps'].includes(action)?'time.configure':action==='saveProfile'?'costs.read':action==='readGps'?'gps.read':['decideOvertime','decideCorrection','reviewException','adminClockOut'].includes(action)?'time.review':'time.self';
        if(!s.can(required)||action==='saveProfile'&&!s.can('time.configure'))fail('permission-denied','This timekeeping action is not authorized.');
        const ref = (c, i) => s.root.collection(c).doc(id(i)), admin = () => { if (!s.admin)
            fail('permission-denied', 'Company administrator access required.'); };
        const opRef = ref('timeOperations', operationId), prior = await tx.get(opRef), target = input.entryId || input.workOrderId || input.targetId || '';
        if (prior.exists) {
            const p = prior.data();
            if (p.uid !== s.uid || p.action !== action || p.target !== target || p.fingerprint !== fingerprint)
                fail('already-exists', 'Operation ID belongs to a different request.');
            return p.result;
        }
        const policyRef = ref('timePolicies', 'main'), pd = await tx.get(policyRef), policy = pd.data()?.value || {...defaultTimePolicy,timeZone:s.company.timeZone||defaultTimePolicy.timeZone}, now = Date.now(), timestamp = Timestamp.fromMillis(now);
        const eventRef = s.root.collection('timeEvents').doc(), base = { companyId: s.cid, actorUid: s.uid, at: timestamp, atMs: now, action }, event = { ...base, technicianId: s.uid, entryId: input.entryId || '', reason: '' };
        let result = { ok: true };
        function finish() { tx.create(eventRef, event); tx.create(opRef, { ...base, uid: s.uid, target, fingerprint, result }); return result; }
        if (action === 'savePolicy') {
            admin();
            let value;
            try {
                value = validateTimePolicy(input.value);
            }
            catch (e) {
                fail('invalid-argument', e.message);
            }
            if (input.revision !== (pd.data()?.revision || 0))
                fail('aborted', 'Policy changed. Reload before saving.');
            const existing = await tx.get(s.root.collection('timeEntries').limit(1));
            if (!existing.empty && (value.timeZone !== policy.timeZone || value.weekStartsOn !== policy.weekStartsOn))
                fail('failed-precondition', 'Time zone and workweek start are locked after the first clock entry.');
            tx.set(policyRef, { ...base, value, revision: input.revision + 1 });
            event.reason = reason(input.reason);
            return finish();
        }
        if (action === 'saveSite') {
            admin();
            const pid = id(input.targetId), property = await tx.get(ref('properties', pid));
            if (!property.exists || property.data().deletedAt || property.data().companyId !== s.cid)
                fail('failed-precondition', 'An active company property is required.');
            if (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90 || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180)
                fail('invalid-argument', 'Valid property coordinates required.');
            event.reason = reason(input.reason);
            tx.set(ref('timeSites', pid), { ...base, latitude: input.latitude, longitude: input.longitude });
            return finish();
        }
        if (action === 'saveProfile') {
            admin();
            const uid = id(input.targetId), member = await tx.get(ref('members', uid)), employee = await tx.get(ref('employees', uid)), rate = await tx.get(ref('pricingCatalog', input.rateId));
            if (!member.exists || !member.data().active || !employee.exists || employee.data().active === false || !rate.exists || rate.data().kind !== 'labor' || !rate.data().active || rate.data().companyId !== s.cid || rate.data().internalCostCents === null)
                fail('failed-precondition', 'An active company employee and labor rate with internal cost are required.');
            event.reason = reason(input.reason);
            event.technicianId = uid;
            tx.set(ref('timeProfiles', uid), { ...base, rateId: rate.id });
            return finish();
        }
        if (action === 'grantGpsException') {
            admin();
            const uid = id(input.technicianId), wid = id(input.workOrderId), wo = await tx.get(ref('workOrders', wid));
            if (!wo.exists || wo.data().assignedTechnicianId !== uid)
                fail('failed-precondition', 'Technician must be assigned.');
            event.reason = reason(input.reason);
            event.technicianId = uid;
            const grant = s.root.collection('geoOverrideGrants').doc();
            tx.create(grant, { ...base, technicianId: uid, workOrderId: wid, reason: event.reason, expiresAtMs: now + 1800000, used: false });
            result = { ok: true, grantId: grant.id };
            return finish();
        }
        if (action === 'purgeExpiredGps') {
            admin();
            const expired = await tx.get(s.root.collection('timeGps').where('expiresAtMs', '<=', now).limit(200));
            expired.forEach(d => tx.delete(d.ref));
            event.reason = 'Expired GPS supplements purged';
            result = { ok: true, count: expired.size };
            return finish();
        }
        if (action === 'readGps') {
            admin();
            if (!policy.gpsAdminAccess)
                fail('permission-denied', 'GPS access is disabled by company policy.');
            event.reason = reason(input.reason);
            const gps = await tx.get(ref('timeGps', input.targetId));
            if (!gps.exists || gps.data().expiresAtMs <= now)
                fail('not-found', 'GPS supplement expired or unavailable.');
            result = { ok: true, gps: gps.data() }; // Never retain raw GPS in idempotency/audit records.
            tx.create(eventRef, event);
            tx.create(opRef, { ...base, uid: s.uid, target, fingerprint, result: { ok: true, requiresFreshRequest: true } });
            return result;
        }
        const entryRef = action === 'clockIn' ? s.root.collection('timeEntries').doc() : ref('timeEntries', input.entryId), ed = action === 'clockIn' ? null : await tx.get(entryRef);
        let entry = ed?.data();
        if (action !== 'clockIn' && !ed?.exists)
            fail('not-found', 'Time entry not found.');
        if (entry)
            event.technicianId = entry.technicianId;
        if (entry && entry.technicianId !== s.uid && !s.admin)
            fail('permission-denied', 'Only your own time entries may be accessed.');
        if (action === 'requestOvertime') {
            if (entry.technicianId !== s.uid)
                fail('permission-denied', 'Only the technician may request overtime.');
            const lock = await tx.get(ref('overtimePending', entryRef.id));
            if (lock.exists)
                fail('already-exists', 'An overtime request is already pending.');
            if (!Number.isSafeInteger(input.minutes) || input.minutes < 1 || input.minutes > 1440)
                fail('invalid-argument', 'Request 1–1440 minutes.');
            event.reason = reason(input.reason);
            const rr = s.root.collection('overtimeRequests').doc();
            tx.create(rr, { ...base, entryId: entryRef.id, technicianId: s.uid, minutes: input.minutes, reason: event.reason, status: 'pending' });
            tx.create(ref('overtimePending', entryRef.id), { requestId: rr.id });
            return finish();
        }
        if (action === 'decideOvertime') {
            admin();
            const rr = ref('overtimeRequests', input.targetId), r = await tx.get(rr);
            if (!r.exists || r.data().entryId !== entryRef.id || r.data().status !== 'pending')
                fail('failed-precondition', 'Request is no longer pending.');
            if (r.data().technicianId === s.uid)
                fail('permission-denied', 'Another administrator must review your overtime.');
            if (!['approved', 'rejected'].includes(input.decision))
                fail('invalid-argument', 'Invalid decision.');
            event.reason = reason(input.reason);
            event.technicianId = entry.technicianId;
            event.requestId = rr.id;
            event.decision = input.decision;
            tx.update(rr, { status: input.decision, reviewedAt: timestamp, reviewedBy: s.uid, reviewReason: event.reason });
            tx.delete(ref('overtimePending', entryRef.id));
            return finish();
        }
        if (action === 'requestCorrection') {
            if (entry.end === null)
                fail('failed-precondition', 'Clock out before requesting a correction.');
            if (!Number.isSafeInteger(input.start) || !Number.isSafeInteger(input.end) || input.end <= input.start || input.end > now || input.end - input.start > 7 * 86400000 || Math.abs(input.start - entry.start) > 7 * 86400000 || typeof input.restoreMeals !== 'boolean')
                fail('invalid-argument', 'Correction times must be valid and within seven days of the original entry.');
            event.reason = reason(input.reason);
            const cr = s.root.collection('timeCorrections').doc();
            tx.create(cr, { ...base, entryId: entryRef.id, technicianId: entry.technicianId, requestedBy: s.uid, revision: entry.revision, start: input.start, end: input.end, restoreMeals: input.restoreMeals, reason: event.reason, status: 'pending' });
            return finish();
        }
        if (action === 'decideCorrection') {
            admin();
            const cr = ref('timeCorrections', input.targetId), c = await tx.get(cr);
            if (!c.exists || c.data().entryId !== entryRef.id || c.data().status !== 'pending' || entry.end === null)
                fail('failed-precondition', 'Correction is not pending.');
            if (c.data().requestedBy === s.uid)
                fail('permission-denied', 'A different administrator must review the correction.');
            if (!['approved', 'rejected'].includes(input.decision))
                fail('invalid-argument', 'Invalid decision.');
            if (c.data().revision !== entry.revision)
                fail('aborted', 'Entry changed; request a fresh correction.');
            if (input.decision === 'approved') {
                const others = await bounded(tx, s.root.collection('timeEntries').where('technicianId', '==', entry.technicianId));
                if (others.some(e => e.id !== entryRef.id && (e.correction?.start ?? e.start) < c.data().end && (e.correction?.end ?? e.end ?? now) > c.data().start))
                    fail('failed-precondition', 'Corrected time overlaps another recorded session.');
            }
            event.reason = reason(input.reason);
            event.technicianId = entry.technicianId;
            event.requestId = cr.id;
            event.decision = input.decision;
            tx.update(cr, { status: input.decision, reviewedAt: timestamp, reviewedBy: s.uid, reviewReason: event.reason });
            if (input.decision === 'approved')
                tx.update(entryRef, { correction: { start: c.data().start, end: c.data().end, restoreMeals: c.data().restoreMeals }, revision: entry.revision + 1 });
            return finish();
        }
        if (action === 'reviewException') {
            admin();
            event.reason = reason(input.reason);
            event.technicianId = entry.technicianId;
            tx.set(ref('timeReviews', entryRef.id), { ...base, entryId: entryRef.id, reason: event.reason, entryRevision: entry.revision });
            return finish();
        }
        if (!['clockIn', 'clockOut', 'lunchStart', 'lunchEnd', 'adminClockOut'].includes(action))
            fail('invalid-argument', 'Unknown timekeeping action.');
        if (action === 'adminClockOut')
            admin();
        else if (entry && entry.technicianId !== s.uid)
            fail('permission-denied', 'Technicians must perform their own clock events.');
        const uid = entry?.technicianId || s.uid, sessionRef = ref('activeTimeSessions', uid), session = await tx.get(sessionRef), wid = entry?.workOrderId || id(input.workOrderId), wo = await tx.get(ref('workOrders', wid));
        if (!wo.exists || wo.data().companyId !== s.cid)
            fail('failed-precondition', 'Company work order required.');
        const propertyId = entry?.propertyId || wo.data().propertyId, property = await tx.get(ref('properties', propertyId)), site = await tx.get(ref('timeSites', propertyId));
        const check = geofence(input.location, site.data(), policy, now);
        let grant;
        if (action === 'clockIn' && !check.verified && input.grantId) {
            grant = await tx.get(ref('geoOverrideGrants', input.grantId));
            if (!grant.exists || grant.data().technicianId !== uid || grant.data().workOrderId !== wid || grant.data().used || grant.data().expiresAtMs < now)
                fail('permission-denied', 'GPS exception is invalid or expired.');
        }
        let rate;
        if (action === 'clockIn') {
            if (session.exists)
                fail('already-exists', 'You already have an active time session.');
            if (!property.exists || property.data().companyId !== s.cid || property.data().deletedAt || wo.data().assignedTechnicianId !== uid || ['Completed', 'Closed'].includes(wo.data().status))
                fail('permission-denied', 'An active assigned work order and property are required.');
            const employee = await tx.get(ref('employees', uid));
            if (!employee.exists || employee.data().active === false)
                fail('permission-denied', 'Active employee required.');
            if (!check.verified && !grant)
                fail('failed-precondition', 'GPS clock-in rejected: ' + check.reason + '. Request an audited administrator exception.');
            const profile = await tx.get(ref('timeProfiles', uid));
            if (!profile.exists)
                fail('failed-precondition', 'An administrator must configure your internal labor rate.');
            const rd = await tx.get(ref('pricingCatalog', profile.data().rateId));
            if (!rd.exists || !rd.data().active || rd.data().kind !== 'labor' || rd.data().companyId !== s.cid || !Number.isSafeInteger(rd.data().internalCostCents))
                fail('failed-precondition', 'A valid internal labor rate is required.');
            rate = { catalogId: rd.id, revision: rd.data().revision, name: rd.data().name, internalCostCents: rd.data().internalCostCents, overtimeMultiplierBps: policy.overtimeMultiplierBps };
        }
        else {
            if (entry.state === 'closed' || !session.exists || session.data().entryId !== entryRef.id)
                fail('failed-precondition', 'No matching active session.');
            if (action === 'lunchStart' && entry.state !== 'working' || action === 'lunchEnd' && entry.state !== 'lunch')
                fail('failed-precondition', 'Invalid lunch transition.');
            if (entry.meals.length >= 50 && action === 'lunchStart')
                fail('resource-exhausted', 'Too many meal events. Clock out and request review.');
        }
        // All transaction reads are complete. Never trust client timestamps or calculated distance.
        event.technicianId = uid;
        event.entryId = entryRef.id;
        event.workOrderId = wid;
        event.gpsResult = check.reason;
        event.gpsVerified = check.verified;
        event.offDutyConfirmed = input.offDuty === true;
        event.reason = action === 'adminClockOut' ? reason(input.reason) : grant ? grant.data().reason : '';
        if (policy.gpsRetentionDays > 0 && input.location?.status === 'ok' && !['invalid-fix', 'stale-fix'].includes(check.reason)) {
            tx.create(ref('timeGps', eventRef.id), { ...base, entryId: entryRef.id, technicianId: uid, latitude: input.location.latitude, longitude: input.location.longitude, accuracy: input.location.accuracy, expiresAtMs: now + policy.gpsRetentionDays * 86400000 });
        }
        if (action === 'clockIn') {
            entry = { id: entryRef.id, companyId: s.cid, technicianId: uid, workOrderId: wid, propertyId, start: now, end: null, state: 'working', meals: [], revision: 1, rate, policy: { ...policy }, flags: check.verified ? [] : ['GPS exception: ' + check.reason] };
            tx.create(sessionRef, { entryId: entryRef.id, companyId: s.cid });
            if (grant)
                tx.update(grant.ref, { used: true, usedAt: timestamp });
        }
        else {
            entry = { ...entry, meals: entry.meals.map(m => ({ ...m })), flags: [...entry.flags], revision: entry.revision + 1 };
            if (!check.verified)
                entry.flags.push(action + ': GPS ' + check.reason);
            if (wo.data().assignedTechnicianId !== uid)
                entry.flags.push('Assignment changed during session');
            if (action === 'lunchStart') {
                entry.meals.push({ start: now, end: null, offDuty: input.offDuty === true, unpaid: false });
                entry.state = 'lunch';
            }
            if (action === 'lunchEnd') {
                const meal = entry.meals.at(-1);
                meal.end = now;
                meal.offDuty = meal.offDuty && input.offDuty === true;
                meal.unpaid = entry.policy.unpaidMeals && !!entry.policy.mealPolicyReference && meal.offDuty && now - meal.start >= entry.policy.lunchDurationMinutes * 60000;
                if (!meal.unpaid)
                    entry.flags.push('Meal retained as paid: short, interrupted, unconfirmed, or policy disabled');
                entry.state = 'working';
            }
            if (['clockOut', 'adminClockOut'].includes(action)) {
                if (entry.state === 'lunch') {
                    entry.meals.at(-1).end = now;
                    entry.meals.at(-1).unpaid = false;
                    entry.flags.push('Unfinished meal retained as paid');
                }
                entry.state = 'closed';
                entry.end = now;
                tx.delete(sessionRef);
                if (action === 'adminClockOut')
                    entry.flags.push('Administrator clock-out requires review');
            }
        }
        tx.set(entryRef, entry);
        result = { ok: true, entryId: entryRef.id };
        return finish();
    });
});
