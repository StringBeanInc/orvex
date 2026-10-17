import type { FinancialRecord } from './financialModel';
import { usd, moneyInput } from './pricingModel.ts';
const titles = { estimate: 'Estimate', invoice: 'Invoice', changeOrder: 'Change order' };
// Customer-facing data only. No internal notes, purchase costs or time entries.
export async function createFinancialPdf(record: FinancialRecord, current: FinancialRecord) {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const pdf = new jsPDF({ unit: 'mm', format: 'letter' });
    pdf.setProperties({ title: titles[record.kind] + ' ' + record.number, author: record.issuer?.name || 'ORVEX' });
    autoTable(pdf, { startY: 16, margin: 16, theme: 'plain', styles: { fontSize: 10, cellPadding: 2, textColor: '#263d55' }, head: [[{ content: titles[record.kind] + ' ' + record.number, colSpan: 2, styles: { fontSize: 20, fontStyle: 'bold' } }]], body: [
            [record.issuer?.name || 'Company draft', record.status !== 'draft' && record.version ? 'Issued version ' + record.version : 'DRAFT - NOT ISSUED'],
            [record.customerSnapshot?.name || '', record.propertySnapshot?.name || ''],
            [[record.customerSnapshot?.streetAddress, record.customerSnapshot?.city, record.customerSnapshot?.state, record.customerSnapshot?.postalCode].filter(Boolean).join(', '), [record.propertySnapshot?.address, record.propertySnapshot?.city, record.propertySnapshot?.state, record.propertySnapshot?.postalCode].filter(Boolean).join(', ')],
            [record.expiresOn ? 'Expires ' + record.expiresOn + ' (UTC)' : '', record.dueOn ? 'Due ' + record.dueOn + ' (UTC)' : ''],
            ...(current.status === 'void' ? [[{ content: 'VOID - retained for history', colSpan: 2, styles: { fontStyle: 'bold' as const, textColor: '#b42318' } }]] : []),
            [{ content: record.title, colSpan: 2, styles: { fontSize: 12, fontStyle: 'bold' as const } }],
            [{ content: record.description, colSpan: 2 }]
        ] });
    const startY = (pdf as unknown as {
        lastAutoTable: {
            finalY: number;
        };
    }).lastAutoTable.finalY + 8;
    autoTable(pdf, { startY, margin: 16, theme: 'striped', styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: '#263d55' }, showFoot: 'lastPage', head: [['Description', 'Quantity', 'Rate', 'Amount']], body: record.pricing.order.map(id => { const l = record.pricing.items[id]; return [l.description, String(l.quantityMilli / 1000) + ' ' + l.unit, usd(l.unitPriceCents), usd(l.extendedCents)]; }), foot: [
            ['Subtotal', '', '', usd(record.subtotalCents)], ['Discount', '', '', usd(record.pricing.discountCents)],
            [record.pricing.taxEnabled ? record.pricing.taxLabel + ' (' + moneyInput(record.pricing.taxRateBps) + '%)' : 'Tax not configured', '', '', usd(record.taxCents)],
            ['Total', '', '', usd(record.totalCents)],
            ...(record.kind === 'changeOrder' ? [['Scope change delta', '', '', usd(record.deltaCents || 0)]] : []),
            ...(record.kind === 'invoice' ? [['Recorded payments', '', '', usd(current.paidCents)], ['Balance', '', '', usd(current.balanceCents)]] : [])
        ] });
    for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
        pdf.setPage(page);
        pdf.setFontSize(8);
        pdf.setTextColor('#687e96');
        pdf.text(`${record.number} | USD | Page ${page} of ${pdf.getNumberOfPages()}`, 16, 270);
    }
    return pdf;
}
