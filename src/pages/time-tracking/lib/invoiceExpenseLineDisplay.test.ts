import { describe, expect, it } from 'vitest';
import { invoiceExpenseLineDisplayAmounts } from './invoiceExpenseLineDisplay';
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
