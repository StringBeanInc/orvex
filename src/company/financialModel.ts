import { emptyPricing, totals } from './pricingModel.ts';
import type { PricingDraft } from './pricingModel.ts';
export type FinancialKind = 'estimate' | 'changeOrder' | 'invoice';
export const financialCollections = { estimate: 'estimates', changeOrder: 'changeOrders', invoice: 'invoices' } as const;
export type FinancialDraft = {
    customerId: string;
    propertyId: string;
    workOrderId: string;
    estimateId: string;
    title: string;
    description: string;
    internalNotes: string;
    expiresOn: string;
    dueOn: string;
    pricing: PricingDraft;
};
export type FinancialRecord = FinancialDraft & {
    id: string;
    companyId: string;
    kind: FinancialKind;
    schemaVersion: 1;
    currency: 'USD';
    number: string;
    revision: number;
    version: number;
    status: string;
    archived: boolean;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    paidCents: number;
    balanceCents: number;
    basePricing?: PricingDraft;
    basePricingRevision?: number;
    sourcePricingRevision?: number;
    deltaCents?: number;
    convertedWorkOrderId?: string;
    applied?: boolean;
    issuer?: {
        name: string;
    };
    customerSnapshot?: Record<string, string>;
    propertySnapshot?: Record<string, string>;
    updatedAtMs: number;
};
export const newFinancialDraft = (): FinancialDraft => ({ customerId: '', propertyId: '', workOrderId: '', estimateId: '', title: '', description: '', internalNotes: '', expiresOn: '', dueOn: '', pricing: emptyPricing() });
export function pricingOnly(d: PricingDraft): PricingDraft { return { items: structuredClone(d.items), order: [...d.order], discountCents: d.discountCents, taxEnabled: d.taxEnabled, taxRateBps: d.taxRateBps, taxLabel: d.taxLabel }; }
export function validDate(value: string) { return value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value; }
export function effectiveFinancialStatus(d: {
    kind: FinancialKind;
    status: string;
    expiresOn: string;
    dueOn: string;
    balanceCents: number;
}, today: string) { if (d.kind === 'estimate' && d.status === 'issued' && d.expiresOn && d.expiresOn < today)
    return 'expired'; if (d.kind === 'invoice' && ['issued', 'partially paid'].includes(d.status) && d.balanceCents > 0 && d.dueOn && d.dueOn < today)
    return 'overdue'; return d.status; }
export function scopeDelta(before: PricingDraft, after: PricingDraft) { const added = after.order.filter(id => !before.items[id]), removed = before.order.filter(id => !after.items[id]), revised = after.order.filter(id => before.items[id] && (['description', 'quantityMilli', 'unit', 'unitPriceCents'] as const).some(k => before.items[id][k] !== after.items[id][k])); return { added, removed, revised, beforeTotalCents: totals(before).totalCents, afterTotalCents: totals(after).totalCents, deltaCents: totals(after).totalCents - totals(before).totalCents }; }
