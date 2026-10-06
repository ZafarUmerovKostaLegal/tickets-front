import { describe, expect, it } from 'vitest';
import { invoiceDisplayMoneyTotals, invoiceExpenseLineDisplayAmounts } from './invoiceExpenseLineDisplay';
import type { InvoiceLineDto } from '@entities/time-tracking';

function line(partial: Partial<InvoiceLineDto> & Pick<InvoiceLineDto, 'id'>): InvoiceLineDto {
    return {
        sortOrder: 0,
        lineKind: 'expense',
        description: null,
        quantity: 1,
        unitAmount: 10.01,
        lineTotal: 10.01,
        timeEntryId: null,
        expenseRequestId: 'e1',
        ...partial,
    };
}

describe('invoiceExpenseLineDisplayAmounts', () => {
    it('replaces USD expense amounts with registry equivalent', () => {
        const map = new Map([['e1', 10.06]]);
        expect(invoiceExpenseLineDisplayAmounts(line({}), 'USD', map)).toEqual({
            unitAmount: 10.06,
            lineTotal: 10.06,
        });
    });

    it('keeps invoice amounts when registry has no match', () => {
        expect(invoiceExpenseLineDisplayAmounts(line({}), 'USD', new Map())).toEqual({
            unitAmount: 10.01,
            lineTotal: 10.01,
        });
    });

    it('does not override non-USD invoices', () => {
        const map = new Map([['e1', 10.06]]);
        expect(invoiceExpenseLineDisplayAmounts(line({}), 'EUR', map)).toEqual({
            unitAmount: 10.01,
            lineTotal: 10.01,
        });
    });
});

describe('invoiceDisplayMoneyTotals', () => {
    it('keeps sum and balance aligned after registry expense override', () => {
        const map = new Map([['e1', 5]]);
        const totals = invoiceDisplayMoneyTotals(
            {
                totalAmount: 596.61,
                amountPaid: 0,
                balanceDue: 596.61,
                currency: 'USD',
                lines: [
                    line({ id: 't1', lineKind: 'time', unitAmount: 150, lineTotal: 591.6, expenseRequestId: null }),
                    line({ id: 'e1', unitAmount: 5.01, lineTotal: 5.01 }),
                ],
            },
            map,
        );
        expect(totals.totalAmount).toBe(596.6);
        expect(totals.balanceDue).toBe(596.6);
    });

    it('adds registry expense when stored line total is zero but total omitted it', () => {
        const map = new Map([['e1', 5]]);
        const totals = invoiceDisplayMoneyTotals(
            {
                totalAmount: 591.6,
                amountPaid: 0,
                balanceDue: 591.6,
                currency: 'USD',
                lines: [
                    line({ id: 't1', lineKind: 'time', unitAmount: 150, lineTotal: 591.6, expenseRequestId: null }),
                    line({ id: 'e1', unitAmount: 0, lineTotal: 0 }),
                ],
            },
            map,
        );
        expect(totals.totalAmount).toBe(596.6);
        expect(totals.balanceDue).toBe(596.6);
    });

    it('aligns balance to total when server balance drifts by 0.01', () => {
        const totals = invoiceDisplayMoneyTotals(
            {
                totalAmount: 596.6,
                amountPaid: 0,
                balanceDue: 596.61,
                currency: 'USD',
                lines: [
                    line({ id: 't1', lineKind: 'time', unitAmount: 150, lineTotal: 591.6, expenseRequestId: null }),
                    line({ id: 'e1', unitAmount: 5, lineTotal: 5 }),
                ],
            },
            new Map(),
        );
        expect(totals.totalAmount).toBe(596.6);
        expect(totals.balanceDue).toBe(596.6);
    });
});
