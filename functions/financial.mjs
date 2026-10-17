import {authorize} from './authorization.mjs';
// Company financial commands are deliberately unavailable outside local emulators.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { validatePricingInput } from './pricingValidation.mjs';
import { totals, emptyPricing } from './shared/pricingModel.js';
import { financialCollections, pricingOnly, validDate, effectiveFinancialStatus, scopeDelta } from './shared/financialModel.js';
const fail = (code, message) => { throw new HttpsError(code, message); };
function id(value) { if (typeof value !== 'string' || !/^[-A-Za-z0-9_]{1,128}$/.test(value))
    fail('invalid-argument', 'Invalid record reference.'); return value; }
function text(value, max, required = false) { if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    fail('invalid-argument', 'Invalid or missing text.'); return value.trim(); }
function runtime() { const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT, p = project === 'demo-orvex-phase3d-tests' ? ['127.0.0.1:18380', '127.0.0.1:19499'] : project === 'demo-orvex-phase3c-tests' ? ['127.0.0.1:8280', '127.0.0.1:9299'] : project === 'demo-orvex' ? ['127.0.0.1:8080', '127.0.0.1:9099'] : null; if (process.env.FUNCTIONS_EMULATOR !== 'true' || !p || process.env.FIRESTORE_EMULATOR_HOST !== p[0] || process.env.FIREBASE_AUTH_EMULATOR_HOST !== p[1])
    fail('failed-precondition', 'Financial backend is emulator-only. Production access is disabled.'); if (!getApps().length)
    initializeApp({ projectId: project }); return getFirestore(); }
async function scope(db,request,tx){return authorize(db,request,tx,request.data.kind+'.read');}
async function list(tx, query) { const snap = await tx.get(query.limit(1001)); if (snap.size > 1000)
    fail('resource-exhausted', 'Financial view exceeds the local reporting limit. Pagination is required.'); return snap.docs.map(d => ({ ...d.data(), id: d.id })); }
const callable = fn => onCall({ region: 'us-central1', timeoutSeconds: 30, maxInstances: 2 }, fn);
export const financialView = callable(async (request) => { const db = runtime(); return db.runTransaction(async (tx) => { const s = await scope(db, request, tx), kind = request.data.kind, collection = financialCollections[kind]; if (!Object.hasOwn(financialCollections, kind))
    fail('invalid-argument', 'Invalid document type.'); const records = await list(tx, s.root.collection(collection)), customers = await list(tx, s.root.collection('customers')), properties = await list(tx, s.root.collection('properties')), orders = await list(tx, s.root.collection('workOrders')), catalog = await list(tx, s.root.collection('pricingCatalog')), locks = await list(tx, s.root.collection('billingLocks')); let versions = [], events = [], payments = []; if (request.data.id) {
    const record = s.root.collection(collection).doc(id(request.data.id));
    versions = await list(tx, record.collection('versions'));
    events = await list(tx, record.collection('events'));
    payments = await list(tx, record.collection('payments'));
} const today = new Date().toISOString().slice(0, 10); return { unsupportedCount: records.filter(r => r.financialSchema !== 'phase3e-v1').length, records: records.filter(r => r.financialSchema === 'phase3e-v1' && r.companyId === s.cid && r.kind === kind).map(r => ({ ...r, effectiveStatus: effectiveFinancialStatus(r, today) })), customers: customers.filter(r => r.companyId === s.cid && !r.deletedAt), properties: properties.filter(r => r.companyId === s.cid && !r.deletedAt), orders: orders.filter(r => r.companyId === s.cid), catalog: catalog.filter(r => r.companyId === s.cid).map(r=>s.can('costs.read')?r:(({internalCostCents,purchaseCostCents,markupBps,supplier,...safe})=>({...safe,internalCostCents:null,purchaseCostCents:0,markupBps:null,supplier:''}))(r)), locks: locks.filter(r => r.companyId === s.cid), versions: versions.filter(r => r.companyId === s.cid), events: events.filter(r => r.companyId === s.cid), payments: payments.filter(r => r.companyId === s.cid), issuer: { name: s.company.name }, today }; }); });
async function sources(tx, root, draft, previous) { for (const lineId of draft.order) {
    const line = draft.items[lineId], old = previous?.items?.[lineId];
    if (old) {
        if (old.sourceId !== line.sourceId || old.rateKind !== line.rateKind || !isDeepStrictEqual(old.snapshot, line.snapshot))
            fail('invalid-argument', 'Historical catalog sources cannot be rewritten.');
    }
    else if (line.snapshot.kind !== 'custom') {
        const source = await tx.get(root.collection('pricingCatalog').doc(id(line.sourceId))), item = source.data();
        if (!source.exists || item.companyId !== root.id || !item.active || item.kind !== line.snapshot.kind || (line.rateKind === 'overtime' && item.kind !== 'labor'))
            fail('failed-precondition', 'Choose an active catalog item from this company.');
        const expected = { kind: item.kind, code: item.code, description: item.description, priceCents: line.rateKind === 'overtime' ? item.overtimePriceCents : item.sellingPriceCents };
        if (!isDeepStrictEqual(expected, line.snapshot))
            fail('aborted', 'Catalog changed. Re-add the selected line.');
    }
} }
function draftInput(input) { const fields = ['customerId', 'propertyId', 'workOrderId', 'estimateId', 'title', 'description', 'internalNotes', 'expiresOn', 'dueOn', 'pricing']; if (!input || Object.keys(input).length !== fields.length || fields.some(k => !Object.hasOwn(input, k)))
    fail('invalid-argument', 'Invalid financial draft fields.'); const d = {}; for (const key of fields.filter(k => k !== 'pricing'))
    d[key] = text(input[key], ['description', 'internalNotes'].includes(key) ? 4000 : 160, ['customerId', 'propertyId', 'title', 'description'].includes(key)); for (const key of ['customerId', 'propertyId', 'workOrderId', 'estimateId'])
    if (d[key])
        id(d[key]); if (!validDate(d.expiresOn) || !validDate(d.dueOn))
    fail('invalid-argument', 'Invalid financial date.'); return { ...d, pricing: input.pricing }; }
function pricing(input, cid) { return validatePricingInput({ companyId: cid, workOrderId: 'financial', revision: 0, draft: input, note: 'Financial document validation' }); }
function partySnapshots(company, customer, property) { return { issuer: { name: text(company.name, 120, true) }, customerSnapshot: Object.fromEntries(['name', 'contact', 'email', 'phone', 'streetAddress', 'addressLine2', 'city', 'state', 'postalCode', 'country'].map(k => [k, customer[k] || ''])), propertySnapshot: Object.fromEntries(['name', 'address', 'city', 'state', 'postalCode'].map(k => [k, property[k] || ''])) }; }
const docRef = (root, kind, key) => root.collection(financialCollections[kind]).doc(id(key));
export const financialCommand = callable(async (request) => {
    const db = runtime(), input = request.data || {}, operationId = id(input.operationId), kind = input.kind, collection = financialCollections[kind];
    if (!Object.hasOwn(financialCollections, kind))
        fail('invalid-argument', 'Invalid document type.');
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return db.runTransaction(async (tx) => {
        const s = await scope(db, request, tx), action = input.action;
        const permission = action==='recordPayment'?'invoice.pay':action==='void'?'invoice.void':action==='convert'?'estimate.convert':['accept','decline','approve','reject','cancel'].includes(action)?kind+'.approve':action==='issue'?kind+'.issue':kind+'.edit';
        if(!s.can(permission)||action==='convert'&&!s.can('workOrders.write'))fail('permission-denied','This financial action requires an explicit Owner grant.');
        const op = s.root.collection('financialOperations').doc(operationId), prior = await tx.get(op);
        if (prior.exists) {
            if (prior.data().uid !== s.uid || prior.data().fingerprint !== fingerprint)
                fail('already-exists', 'Operation ID belongs to another request.');
            return prior.data().result;
        }
        const record = docRef(s.root, kind, input.id), snapshot = await tx.get(record), old = snapshot.data(), now = Date.now(), at = Timestamp.fromMillis(now), today = new Date(now).toISOString().slice(0, 10), eventId = randomUUID();
        let next, result = { id: record.id }, before = old?.status || null;
        if (old && (old.financialSchema !== 'phase3e-v1' || old.companyId !== s.cid || old.kind !== kind))
            fail('failed-precondition', 'Existing financial records use an unsupported schema and require a separately reviewed migration.');
        const note = text(input.note ?? '', 500, true), revision = input.revision;
        if (!Number.isSafeInteger(revision) || revision < 0)
            fail('invalid-argument', 'Invalid expected revision.');
        if ((old?.revision || 0) !== revision)
            fail('aborted', 'Save conflict: document changed. Refresh and review your draft.');
        const base = { companyId: s.cid, actorUid: s.uid, at, atMs: now, operation: action, kind, documentId: record.id, operationId, note };
        function commit() { if (Buffer.byteLength(JSON.stringify(next), 'utf8') > 850000)
            fail('invalid-argument', 'Financial document is too large. Shorten descriptions before saving.'); next = { ...next, revision: revision + 1, updatedAt: at, updatedAtMs: now, updatedBy: s.uid }; result = { ...result, revision: next.revision }; tx.set(record, next); tx.create(record.collection('events').doc(eventId), { ...base, revision: next.revision, version: next.version, beforeStatus: before, afterStatus: next.status, beforeTotalCents: old?.totalCents ?? null, afterTotalCents: next.totalCents, snapshot: next }); tx.create(op, { ...base, uid: s.uid, fingerprint, result }); return result; }
        async function relationships(d) { const customer = await tx.get(s.root.collection('customers').doc(id(d.customerId))), property = await tx.get(s.root.collection('properties').doc(id(d.propertyId))); if (!customer.exists || customer.data().companyId !== s.cid || customer.data().deletedAt || !property.exists || property.data().companyId !== s.cid || property.data().deletedAt || property.data().customerId !== d.customerId)
            fail('failed-precondition', 'Choose an active customer and matching property from this company.'); let order = null; if (d.workOrderId) {
            order = await tx.get(s.root.collection('workOrders').doc(id(d.workOrderId)));
            if (!order.exists || order.data().companyId !== s.cid || order.data().customerId !== d.customerId || order.data().propertyId !== d.propertyId)
                fail('failed-precondition', 'Work order does not match this customer and property.');
        } if (d.estimateId) {
            const estimate = await tx.get(docRef(s.root, 'estimate', d.estimateId));
            if (!estimate.exists || estimate.data().companyId !== s.cid || estimate.data().customerId !== d.customerId || estimate.data().propertyId !== d.propertyId || (d.workOrderId && estimate.data().convertedWorkOrderId !== d.workOrderId && estimate.data().workOrderId !== d.workOrderId))
                fail('failed-precondition', 'Originating estimate does not match.');
        } return { customer, property, order }; }
        const lockRef = wid => s.root.collection('billingLocks').doc(id(wid));
        if (['saveDraft', 'fromWorkOrder', 'duplicate'].includes(action)) {
            if (old && (old.status !== 'draft' || old.archived))
                fail('failed-precondition', 'Only active drafts can be edited. Issued versions are immutable.');
            let d, copy = null, basePrice = null, sourcePrice = null, trusted = null;
            if (action === 'duplicate') {
                if (kind !== 'estimate' || old)
                    fail('failed-precondition', 'Duplicate into a new estimate ID.');
                const source = await tx.get(docRef(s.root, 'estimate', input.sourceId));
                if (!source.exists)
                    fail('not-found', 'Estimate to duplicate not found.');
                copy = source.data();
                d = draftInput(Object.fromEntries(['customerId', 'propertyId', 'workOrderId', 'estimateId', 'title', 'description', 'internalNotes', 'expiresOn', 'dueOn', 'pricing'].map(k => [k, copy[k]])));
                d.workOrderId = '';
                d.estimateId = '';
                trusted = copy.pricing;
            }
            else if (action === 'fromWorkOrder') {
                if (kind !== 'invoice')
                    fail('invalid-argument', 'Work-order invoice operation required.');
                const wo = await tx.get(s.root.collection('workOrders').doc(id(input.workOrderId)));
                if (!wo.exists)
                    fail('not-found', 'Work order not found.');
                sourcePrice = await tx.get(wo.ref.collection('pricing').doc('current'));
                if (!sourcePrice.exists || sourcePrice.data().companyId !== s.cid || sourcePrice.data().workOrderId !== wo.id || sourcePrice.data().schemaVersion !== 1)
                    fail('failed-precondition', 'Save explicit billable work-order charges first.');
                d = { customerId: wo.data().customerId, propertyId: wo.data().propertyId, workOrderId: wo.id, estimateId: '', title: old?.title || 'Invoice — ' + wo.data().title, description: old?.description || wo.data().description, internalNotes: old?.internalNotes || '', expiresOn: '', dueOn: text(input.dueOn ?? '', 10), pricing: pricingOnly(sourcePrice.data()) };
                if (!validDate(d.dueOn))
                    fail('invalid-argument', 'Invalid due date.');
                if (input.metadata) {
                    if (typeof input.metadata !== 'object' || Array.isArray(input.metadata) || Object.keys(input.metadata).some(k => !['title', 'description', 'internalNotes', 'estimateId'].includes(k)))
                        fail('invalid-argument', 'Invalid invoice metadata.');
                    d = draftInput({ ...d, ...input.metadata });
                }
                trusted = d.pricing;
            }
            else
                d = draftInput(input.draft);
            if (kind === 'changeOrder' && !d.workOrderId)
                fail('invalid-argument', 'A change order requires a work order.');
            if (kind === 'invoice' && d.workOrderId && action !== 'fromWorkOrder') {
                if (!old?.sourcePricingRevision)
                    fail('failed-precondition', 'Create work-order invoices using the billable-scope operation.');
                if (!isDeepStrictEqual(d.pricing, old.pricing) || d.workOrderId !== old.workOrderId || d.customerId !== old.customerId || d.propertyId !== old.propertyId)
                    fail('failed-precondition', 'Refresh the work-order invoice from approved billable charges; scope cannot be edited independently.');
            }
            if (old && (old.workOrderId !== d.workOrderId || old.customerId !== d.customerId || old.propertyId !== d.propertyId) && (kind === 'changeOrder' || old.workOrderId))
                fail('failed-precondition', 'Linked scope is fixed. Create a separate draft for a different job.');
            const related = await relationships(d);
            if (kind === 'changeOrder') {
                basePrice = await tx.get(related.order.ref.collection('pricing').doc('current'));
                if (!basePrice.exists || basePrice.data().companyId !== s.cid || basePrice.data().workOrderId !== d.workOrderId || basePrice.data().schemaVersion !== 1)
                    fail('failed-precondition', 'Save original work-order pricing before drafting a change.');
                if (old && old.basePricingRevision !== basePrice.data().revision)
                    fail('aborted', 'Work-order pricing changed. Archive this draft and create a new change order.');
                trusted = old?.pricing || pricingOnly(basePrice.data());
            }
            const validated = pricing(d.pricing, s.cid);
            d.pricing = validated.draft;
            await sources(tx, s.root, d.pricing, trusted || old?.pricing);
            let lock = null;
            if (kind === 'invoice' && d.workOrderId) {
                lock = await tx.get(lockRef(d.workOrderId));
                if (lock.exists && lock.data().invoiceId !== record.id)
                    fail('already-exists', 'This work order already has an active invoice. Progress billing requires a separate design.');
            }
            const sequence = s.root.collection('numberSequences').doc('financial_' + collection), counter = !old ? await tx.get(sequence) : null;
            let existing = [];
            if (!old) {
                existing = await list(tx, s.root.collection(collection));
                if (existing.some(r => r.financialSchema !== 'phase3e-v1') || (!counter.exists && existing.length))
                    fail('failed-precondition', 'Existing records or missing numbering state require a reviewed recovery before new documents can be numbered.');
                if (counter.exists && (counter.data().financialSchema !== 'phase3e-v1' || counter.data().companyId !== s.cid || !Number.isSafeInteger(counter.data().nextNumber) || counter.data().nextNumber < 1))
                    fail('failed-precondition', 'Invalid financial numbering state. No data was changed.');
            }
            const number = old?.number || `${kind === 'estimate' ? 'EST' : kind === 'invoice' ? 'INV' : 'CO'}-${String(counter?.data()?.nextNumber || 1).padStart(5, '0')}`;
            if (!old && existing.some(r => r.number === number))
                fail('failed-precondition', 'Numbering state would reuse an existing document number. Review recovery first.');
            next = { ...(old || {}), ...d, ...partySnapshots(s.company, related.customer.data(), related.property.data()), ...validated.amounts, id: record.id, kind, companyId: s.cid, schemaVersion: 1, financialSchema: 'phase3e-v1', currency: 'USD', number, status: 'draft', archived: false, version: old?.version || 0, paidCents: 0, balanceCents: validated.amounts.totalCents, createdAt: old?.createdAt || at, createdBy: old?.createdBy || s.uid, updatedAtMs: now };
            if (kind === 'changeOrder') {
                next.basePricing = old?.basePricing || pricingOnly(basePrice.data());
                next.basePricingRevision = basePrice.data().revision;
                next.delta = scopeDelta(next.basePricing, next.pricing);
                next.deltaCents = next.delta.deltaCents;
            }
            if (sourcePrice) {
                next.sourcePricingRevision = sourcePrice.data().revision;
            }
            if (!old)
                tx.set(sequence, { companyId: s.cid, schemaVersion: 1, financialSchema: 'phase3e-v1', nextNumber: (counter?.data()?.nextNumber || 1) + 1, revision: (counter?.data()?.revision || 0) + 1, updatedAt: at, updatedBy: s.uid });
            if (kind === 'invoice' && d.workOrderId)
                tx.set(lockRef(d.workOrderId), { companyId: s.cid, invoiceId: record.id, status: 'draft' });
            return commit();
        }
        if (!old)
            fail('not-found', 'Financial document not found.');
        next = { ...old };
        const effective = effectiveFinancialStatus(old, today);
        if (action === 'archive') {
            if (old.status !== 'draft' || old.archived)
                fail('failed-precondition', 'Only active drafts can be archived.');
            next.archived = true;
            if (kind === 'invoice' && old.workOrderId) {
                const lock = await tx.get(lockRef(old.workOrderId));
                if (lock.data()?.invoiceId !== record.id)
                    fail('aborted', 'Invoice lock changed.');
                tx.delete(lock.ref);
            }
            return commit();
        }
        if (action === 'issue') {
            if (old.status !== 'draft' || old.archived || !old.pricing.order.length)
                fail('failed-precondition', 'An active draft with at least one charge is required.');
            if (kind === 'estimate' && old.expiresOn && old.expiresOn < today)
                fail('failed-precondition', 'Set a current/future expiration date before issue.');
            const related = await relationships(old);
            let current = null, lock = null, financialLink = null;
            if (kind === 'changeOrder' || kind === 'invoice' && old.workOrderId) {
                current = await tx.get(related.order.ref.collection('pricing').doc('current'));
                if (current.data()?.revision !== (kind === 'changeOrder' ? old.basePricingRevision : old.sourcePricingRevision))
                    fail('aborted', 'Work-order charges changed. Refresh the draft before issue.');
                if (kind === 'invoice') {
                    lock = await tx.get(lockRef(old.workOrderId));
                    if (lock.data()?.invoiceId !== record.id)
                        fail('aborted', 'Invoice lock changed.');
                    financialLink = await tx.get(s.root.collection('financialWorkOrders').doc(old.workOrderId));
                }
            }
            next.status = kind === 'invoice' && old.totalCents === 0 ? 'paid' : 'issued';
            next.version = old.version + 1;
            next.issuedAt = at;
            next.issuedBy = s.uid;
            next.issuer = { name: text(s.company.name, 120, true) };
            next.customerSnapshot = Object.fromEntries(['name', 'contact', 'email', 'phone', 'streetAddress', 'addressLine2', 'city', 'state', 'postalCode', 'country'].map(k => [k, related.customer.data()[k] || '']));
            next.propertySnapshot = Object.fromEntries(['name', 'address', 'city', 'state', 'postalCode'].map(k => [k, related.property.data()[k] || '']));
            tx.create(record.collection('versions').doc(String(next.version)), { ...next, revision: revision + 1, issuedRevision: revision + 1, issuedAtMs: now });
            if (lock) {
                tx.update(lock.ref, { status: next.status });
                tx.set(s.root.collection('financialWorkOrders').doc(old.workOrderId), { ...(financialLink?.data() || {}), companyId: s.cid, workOrderId: old.workOrderId, managedScope: true });
            }
            return commit();
        }
        if (['accept', 'decline', 'expire', 'supersede', 'revise'].includes(action)) {
            if (kind !== 'estimate' || old.archived)
                fail('failed-precondition', 'Estimate transition required.');
            if (action === 'accept' || action === 'decline') {
                if (effective !== 'issued')
                    fail('failed-precondition', 'Only a current issued estimate can be accepted or declined.');
                next.status = action === 'accept' ? 'accepted' : 'declined';
                next.decision = { actorUid: s.uid, at, atMs: now, issuedVersion: old.version, issuedRevision: old.revision, note };
            }
            if (action === 'expire') {
                if (effective !== 'expired')
                    fail('failed-precondition', 'Estimate has not expired.');
                next.status = 'expired';
            }
            if (action === 'supersede') {
                if (!['issued', 'accepted', 'declined', 'expired'].includes(effective) || old.convertedWorkOrderId)
                    fail('failed-precondition', 'Converted estimates cannot be superseded; use change orders.');
                next.status = 'superseded';
            }
            if (action === 'revise') {
                if (old.status !== 'superseded')
                    fail('failed-precondition', 'Explicitly supersede the issued estimate before revising it.');
                next.status = 'draft';
                delete next.decision;
            }
            return commit();
        }
        if (action === 'convert') {
            if (kind !== 'estimate' || old.status !== 'accepted' || input.confirm !== true)
                fail('failed-precondition', 'Explicit confirmation and an accepted estimate are required.');
            if (old.convertedWorkOrderId) {
                result = { id: record.id, workOrderId: old.convertedWorkOrderId };
                tx.create(op, { ...base, uid: s.uid, fingerprint, result });
                return result;
            }
            const related = await relationships(old), wid = old.workOrderId || randomUUID(), wo = s.root.collection('workOrders').doc(wid), sequence = s.root.collection('numberSequences').doc('workOrders'), counter = !related.order ? await tx.get(sequence) : null, priceRef = wo.collection('pricing').doc('current'), current = await tx.get(priceRef), linkRef = s.root.collection('financialWorkOrders').doc(wid), link = await tx.get(linkRef), lock = await tx.get(lockRef(wid));
            if (link.exists || lock.exists)
                fail('failed-precondition', 'Work order already belongs to a financial workflow.');
            if (current.exists && !isDeepStrictEqual(pricingOnly(current.data()), old.pricing))
                fail('failed-precondition', 'Existing work-order charges differ. They cannot be overwritten by an estimate.');
            if (!related.order) {
                if (counter.exists && (counter.data().companyId !== s.cid || counter.data().schemaVersion !== 1 || !Number.isSafeInteger(counter.data().nextNumber) || counter.data().nextNumber < 1))
                    fail('failed-precondition', 'Invalid work-order numbering state.');
                if (!counter.exists) {
                    const existing = await tx.get(s.root.collection('workOrders').limit(1));
                    if (!existing.empty)
                        fail('failed-precondition', 'Work-order numbering is missing. Review recovery before conversion.');
                }
            }
            const activityId = randomUUID(), number = counter?.data()?.nextNumber || 1;
            if (!related.order) {
                tx.create(wo, { id: wid, companyId: s.cid, schemaVersion: 1, revision: 1, number, customerId: old.customerId, propertyId: old.propertyId, title: old.title, description: old.description, serviceCategory: 'General Maintenance', priority: 'Normal', status: 'New', assignedTechnicianId: '', scheduledDate: '', dueDate: '', internalNotes: old.internalNotes, createdAt: at, createdBy: s.uid, updatedAt: at, updatedBy: s.uid, lastActivityId: activityId });
                tx.set(sequence, { companyId: s.cid, schemaVersion: 1, nextNumber: number + 1, revision: (counter?.data()?.revision || 0) + 1, lastWorkOrderId: wid, updatedAt: at, updatedBy: s.uid });
                tx.update(related.property.ref, { workOrderCount: (related.property.data().workOrderCount || 0) + 1, workOrderMutationId: wid, revision: related.property.data().revision + 1, updatedAt: at, updatedBy: s.uid });
                tx.create(wo.collection('activity').doc(activityId), { id: activityId, companyId: s.cid, workOrderId: wid, revision: 1, actorUid: s.uid, at, created: true, statusChanged: false, priorityChanged: false, assignmentChanged: false, schedulingChanged: false, notesAdded: !!old.internalNotes, beforeStatus: '', afterStatus: 'New', beforePriority: '', afterPriority: 'Normal', beforeAssignment: '', afterAssignment: '', beforeScheduled: '', afterScheduled: '', beforeDue: '', afterDue: '', notes: old.internalNotes });
            }
            if (!current.exists) {
                const price = { ...old.pricing, ...totals(old.pricing), companyId: s.cid, workOrderId: wid, schemaVersion: 1, currency: 'USD', revision: 1, createdAt: at, createdBy: s.uid, updatedAt: at, updatedBy: s.uid, lastEventId: eventId };
                tx.create(priceRef, price);
                tx.create(wo.collection('pricingHistory').doc(eventId), { id: eventId, companyId: s.cid, workOrderId: wid, revision: 1, actorUid: s.uid, at, note: 'Accepted estimate ' + old.number, beforeTotalCents: null, snapshot: price });
            }
            tx.create(linkRef, { companyId: s.cid, workOrderId: wid, estimateId: record.id, estimateVersion: old.version, managedScope: true, createdAt: at, createdBy: s.uid });
            next.convertedWorkOrderId = wid;
            next.convertedEstimateVersion = old.version;
            result = { id: record.id, workOrderId: wid };
            return commit();
        }
        if (['approve', 'reject', 'cancel'].includes(action)) {
            if (kind !== 'changeOrder' || old.archived)
                fail('failed-precondition', 'Change-order transition required.');
            if (action === 'cancel') {
                if (!['draft', 'issued'].includes(old.status))
                    fail('failed-precondition', 'Approved changes cannot be canceled. Create a new reversing change order.');
                next.status = 'canceled';
                return commit();
            }
            if (old.status !== 'issued')
                fail('failed-precondition', 'Only issued changes can be reviewed.');
            next.status = action === 'approve' ? 'approved' : 'rejected';
            next.decision = { actorUid: s.uid, at, atMs: now, issuedVersion: old.version, note };
            if (action === 'approve') {
                const related = await relationships(old), priceRef = related.order.ref.collection('pricing').doc('current'), current = await tx.get(priceRef), lock = await tx.get(lockRef(old.workOrderId)), linkRef = s.root.collection('financialWorkOrders').doc(old.workOrderId), link = await tx.get(linkRef);
                if (!current.exists || current.data().revision !== old.basePricingRevision || !isDeepStrictEqual(pricingOnly(current.data()), old.basePricing))
                    fail('aborted', 'Billable scope changed. Draft and approve a fresh change order.');
                if (lock.exists && lock.data().status !== 'draft')
                    fail('failed-precondition', 'An issued invoice locks this work-order scope. Review billing/credit-note implications separately.');
                const price = { ...current.data(), ...old.pricing, ...totals(old.pricing), revision: current.data().revision + 1, updatedAt: at, updatedBy: s.uid, lastEventId: eventId };
                tx.set(priceRef, price);
                tx.create(related.order.ref.collection('pricingHistory').doc(eventId), { id: eventId, companyId: s.cid, workOrderId: old.workOrderId, revision: price.revision, actorUid: s.uid, at, note: 'Approved change ' + old.number + '; delta ' + old.deltaCents + ' cents', beforeTotalCents: current.data().totalCents, snapshot: price });
                tx.set(linkRef, { ...(link.data() || {}), companyId: s.cid, workOrderId: old.workOrderId, managedScope: true, lastChangeOrderId: record.id });
                next.applied = true;
                next.appliedPricingRevision = price.revision;
                tx.create(record.collection('approvals').doc(String(old.version)), { ...base, issuedVersion: old.version, issuedSnapshot: old, delta: old.delta, appliedPricingRevision: price.revision });
            }
            return commit();
        }
        if (action === 'recordPayment') {
            if (kind !== 'invoice' || !['issued', 'partially paid'].includes(old.status))
                fail('failed-precondition', 'Only unpaid issued invoices accept payments.');
            if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > old.balanceCents)
                fail('invalid-argument', 'Payment must be positive and cannot exceed the remaining balance.');
            if (!validDate(input.paidOn) || !input.paidOn || input.paidOn > today)
                fail('invalid-argument', 'Choose a valid payment date no later than today (UTC).');
            const reference = text(input.reference, 120, true), method = text(input.method, 40, true);
            if (!['cash', 'check', 'bank transfer', 'card recorded externally', 'other'].includes(method))
                fail('invalid-argument', 'Choose a supported recording method.');
            const paymentId = id(input.paymentId), payment = record.collection('payments').doc(paymentId), existing = await tx.get(payment), referenceRef = record.collection('paymentReferences').doc(createHash('sha256').update(reference.trim().toLowerCase()).digest('hex')), seen = await tx.get(referenceRef);
            if (existing.exists || seen.exists)
                fail('already-exists', 'This payment ID or reference is already recorded.');
            next.paidCents = old.paidCents + input.amountCents;
            next.balanceCents = old.totalCents - next.paidCents;
            next.status = next.balanceCents === 0 ? 'paid' : 'partially paid';
            tx.create(payment, { ...base, id: paymentId, amountCents: input.amountCents, paidOn: input.paidOn, reference, method, invoiceVersion: old.version });
            tx.create(referenceRef, { paymentId, companyId: s.cid, createdAt: at });
            return commit();
        }
        if (action === 'void') {
            if (kind !== 'invoice' || old.status !== 'issued' || old.paidCents !== 0 || input.confirm !== true)
                fail('failed-precondition', 'Only an unpaid issued invoice can be explicitly voided. Payments require a separate reviewed adjustment workflow.');
            if (old.workOrderId) {
                const lock = await tx.get(lockRef(old.workOrderId));
                if (lock.data()?.invoiceId !== record.id)
                    fail('aborted', 'Invoice lock changed.');
                tx.delete(lock.ref);
            }
            next.status = 'void';
            next.voidedAt = at;
            next.voidedBy = s.uid;
            next.voidReason = note;
            next.balanceCents = 0;
            return commit();
        }
        fail('invalid-argument', 'Unknown financial operation.');
    });
});

export const financialWorkOrderScope=callable(async request=>{const db=runtime();return db.runTransaction(async tx=>{const s=await scope(db,request,tx),ref=s.root.collection('workOrders').doc(id(request.data.workOrderId)),[w,p]=await Promise.all([tx.get(ref),tx.get(ref.collection('pricing').doc('current'))]);if(!w.exists||w.data().companyId!==s.cid)fail('not-found','Work order is not in this company.');if(p.exists&&(p.data().companyId!==s.cid||p.data().workOrderId!==ref.id))fail('failed-precondition','Pricing company relationship requires review.');return {record:p.exists?{...pricingOnly(p.data()),...totals(p.data()),revision:p.data().revision}:null,history:[]};});});
