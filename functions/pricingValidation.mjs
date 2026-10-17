import { HttpsError } from 'firebase-functions/v2/https';
import { isDeepStrictEqual } from 'node:util';
import { totals, runningPricing, extended, MAX_LINES, MAX_PRICE_CENTS, MAX_QUANTITY_MILLI } from './shared/pricingModel.js';
const fail = (code, message) => { throw new HttpsError(code, message); };
function keys(value, allowed) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)) || allowed.some(k => !Object.hasOwn(value, k)))
    fail('invalid-argument', 'Invalid pricing fields.'); }
function text(v, max, required = false) { if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
    fail('invalid-argument', 'Invalid or missing text field.'); return v.trim(); }
function integer(v, min, max, label) { if (!Number.isSafeInteger(v) || v < min || v > max)
    fail('invalid-argument', label + ' is outside the allowed range.'); }
export function validatePricingInput(input) { keys(input, ['companyId', 'workOrderId', 'revision', 'draft', 'note']); text(input.companyId, 128, true); if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.workOrderId))
    fail('invalid-argument', 'Invalid work order ID.'); integer(input.revision, 0, 1000000, 'Revision'); const note = text(input.note, 200, true), d = input.draft; keys(d, ['items', 'order', 'discountCents', 'taxEnabled', 'taxRateBps', 'taxLabel']); if (!d.items || typeof d.items !== 'object' || Array.isArray(d.items) || !Array.isArray(d.order) || d.order.length > MAX_LINES || new Set(d.order).size !== d.order.length || Object.keys(d.items).length !== d.order.length)
    fail('invalid-argument', 'Invalid charge list.'); if (typeof d.taxEnabled !== 'boolean')
    fail('invalid-argument', 'Invalid tax configuration.'); const taxLabel = text(d.taxLabel, 80, d.taxEnabled), items = {}; for (const id of d.order) {
    if (typeof id !== 'string' || !/^[-A-Za-z0-9_]{1,128}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id) || !Object.hasOwn(d.items, id))
        fail('invalid-argument', 'Invalid charge ID.');
    const l = d.items[id];
    keys(l, ['id', 'sourceId', 'snapshot', 'rateKind', 'description', 'quantityMilli', 'unit', 'unitPriceCents', 'extendedCents', 'runningCents']);
    if (l.id !== id)
        fail('invalid-argument', 'Charge ID does not match.');
    keys(l.snapshot, ['kind', 'code', 'description', 'priceCents']);
    if (!['service', 'labor', 'material', 'custom'].includes(l.snapshot.kind) || !['standard', 'overtime'].includes(l.rateKind))
        fail('invalid-argument', 'Invalid catalog type or labor rate.');
    text(l.sourceId, 128);
    text(l.snapshot.code, 40);
    text(l.snapshot.description, 2000);
    integer(l.snapshot.priceCents, 0, MAX_PRICE_CENTS, 'Snapshot price');
    integer(l.quantityMilli, 1, MAX_QUANTITY_MILLI, 'Quantity');
    integer(l.unitPriceCents, 0, MAX_PRICE_CENTS, 'Price');
    if (l.extendedCents !== extended(l.quantityMilli, l.unitPriceCents))
        fail('invalid-argument', 'Invalid extended amount.');
    if (l.snapshot.kind === 'custom' && (l.sourceId !== '' || l.rateKind !== 'standard' || !isDeepStrictEqual(l.snapshot, { kind: 'custom', code: '', description: '', priceCents: 0 })))
        fail('invalid-argument', 'Invalid custom charge source.');
    if (l.snapshot.kind !== 'custom' && !/^[-A-Za-z0-9_]{1,128}$/.test(l.sourceId))
        fail('invalid-argument', 'Invalid catalog reference.');
    items[id] = { ...l, description: text(l.description, 2200, true), unit: text(l.unit, 40, true), snapshot: { ...l.snapshot } };
} const draft = runningPricing({ ...d, items, taxLabel }); try {
    return { draft, amounts: totals(draft), note };
}
catch (e) {
    fail('invalid-argument', e.message);
} }
