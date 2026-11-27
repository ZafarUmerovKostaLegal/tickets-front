import { describe, expect, it } from 'vitest';
import type { CashMovement } from '@entities/expenses/model/cashApi';
import { cashExportRows, cashExportTotals } from './exportCash';

const base = { note: '', balanceBefore: null, createdByUserId: 1, text: '' };
const rows: CashMovement[] = [
    { ...base, id: 3, kind: 'expense', amount: '150000', note: ' Такси ', balanceBefore: '1000000', balanceAfter: '850000', createdAt: '2026-11-20T10:00:00Z', expenseId: 'EXP-7', attachments: [{ id: 'a', fileName: 'чек.jpg', mimeType: 'image/jpeg' }] },
    { ...base, id: 1, kind: 'set', amount: '500000', balanceAfter: '500000', createdAt: '2026-11-01T09:00:00Z' },
    { ...base, id: 2, kind: 'topup', amount: '500000', balanceBefore: '500000', balanceAfter: '1000000', createdAt: '2026-11-10T09:00:00Z' },
];

describe('cash excel export', () => {
    it('lists operations oldest first with money in its own column', () => {
        const out = cashExportRows(rows);
        expect(out.map((row) => row.kind)).toEqual(['Остаток установлен', 'Пополнение', 'Потрачено']);
        expect(out[0]).toMatchObject({ set: 500000, income: null, outcome: null, after: 500000 });
        expect(out[1]).toMatchObject({ income: 500000, outcome: null, before: 500000 });
        expect(out[2]).toMatchObject({ outcome: 150000, note: 'Такси', expenseId: 'EXP-7', files: 'чек.jpg', before: 1000000, after: 850000 });
    });

    it('sums top-ups and spending, not the opening balance', () => {
        expect(cashExportTotals(cashExportRows(rows))).toEqual({ income: 500000, outcome: 150000 });
    });

    it('keeps the local wall-clock time for Excel', () => {
        const [first] = cashExportRows(rows);
        const local = new Date('2026-11-01T09:00:00Z');
        expect(first!.date!.getUTCHours()).toBe(local.getHours());
    });
});
