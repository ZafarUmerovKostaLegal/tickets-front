import { describe, expect, it } from 'vitest';
import { reconcileWithIssuedInvoice } from './issuedInvoiceTotals';
import { buildInvoiceCoverLetterModel } from './invoiceCoverLetterModel';

describe('reconcileWithIssuedInvoice', () => {
    it('takes TOTAL and extra expenses from the issued invoice, not from a stale saved layout', () => {
        const base = buildInvoiceCoverLetterModel({ issueDateIso: '2026-11-19', clientName: 'Makyol', clientAddress: null, contactName: null, totalAmount: 11732.27, currency: 'USD' });
        const stale = { ...base, invoiceParagraphOverride: `Total due: ${base.totalFormatted}.` };
        const { model, legal } = reconcileWithIssuedInvoice(stale, { extraExpensesAmount: 'USD 1,732.27' }, {
            currency: 'USD',
            totalAmount: 11705.96,
            taxAmount: 0,
            lines: [{ lineKind: 'expense', lineTotal: 1705.96 }, { lineKind: 'manual', lineTotal: 10000 }],
        });
        expect(legal.extraExpensesAmount).toBe('USD 1,705.96');
        expect(model.totalFormatted).toBe('USD 11,705.96');
        expect(model.servicesAmountFormatted).toBe('USD 10,000.00');
        expect(model.invoiceParagraphOverride).toBe('Total due: USD 11,705.96.');
    });
});
