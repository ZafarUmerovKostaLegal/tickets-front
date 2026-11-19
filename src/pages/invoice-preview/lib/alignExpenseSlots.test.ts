import { describe, expect, it } from 'vitest';
import { alignExpenseSlotsToInvoiceLines } from './resolveInvoiceTimeReportPack';
import { emptyInvoiceTimeReportPack, finalizeDetailSlots, formatTimeReportAmount } from './invoiceTimeReportModel';

const row = (description: string, amount: string) => ({
    date: '01.11.2026', initials: '—', task: 'Expense', description, hours: '', hourlyRate: '', amount,
});

describe('alignExpenseSlotsToInvoiceLines', () => {
    it('shows the billed amount of the invoice line, not a registry recalculation', () => {
        const pack = {
            ...emptyInvoiceTimeReportPack('USD'),
            expenseSlots: finalizeDetailSlots([row('По проекту Condact Issue.', formatTimeReportAmount(1732.27, 'USD'))]),
            expenseTotalAmountDisplay: formatTimeReportAmount(1732.27, 'USD'),
        };
        const fixed = alignExpenseSlotsToInvoiceLines(pack, [
            { lineKind: 'manual', lineTotal: 10000, sortOrder: 1 },
            { lineKind: 'expense', lineTotal: 1705.96, sortOrder: 2 },
        ]);
        expect(fixed.expenseSlots[0]?.amount).toBe(formatTimeReportAmount(1705.96, 'USD'));
        expect(fixed.expenseTotalAmountDisplay).toBe(formatTimeReportAmount(1705.96, 'USD'));
    });

    it('leaves the pack alone when rows and lines do not match one to one', () => {
        const pack = { ...emptyInvoiceTimeReportPack('USD'), expenseSlots: finalizeDetailSlots([row('A', 'USD 1.00'), row('B', 'USD 2.00')]) };
        expect(alignExpenseSlotsToInvoiceLines(pack, [{ lineKind: 'expense', lineTotal: 5 }])).toBe(pack);
    });
});
