import { describe, expect, it } from 'vitest';
import {
    emptyInvoiceTimeReportPack,
    ensureMehnatSeparatedPack,
    isMyMehnatTimeReportRow,
    type InvoiceTimeReportDetailRow,
} from './invoiceTimeReportModel';

function row(partial: Partial<InvoiceTimeReportDetailRow>): InvoiceTimeReportDetailRow {
    return {
        date: '17 Aug 2026',
        initials: 'DSHD',
        task: '',
        description: '',
        hours: '1,00',
        hourlyRate: 'UZS 230,000.00',
        amount: 'UZS 230,000.00',
        ...partial,
    };
}

describe('isMyMehnatTimeReportRow', () => {
    it('matches My mehnat registration and Russian label', () => {
        expect(isMyMehnatTimeReportRow({ task: 'My mehnat registration' })).toBe(true);
        expect(isMyMehnatTimeReportRow({ task: 'Регистрация My mehnat' })).toBe(true);
    });

    it('does not match other tasks that only mention mehnat in the description', () => {
        expect(isMyMehnatTimeReportRow({ task: 'Drafting' })).toBe(false);
        expect(isMyMehnatTimeReportRow({ task: 'Research' })).toBe(false);
    });
});

describe('ensureMehnatSeparatedPack', () => {
    it('moves My Mehnat rows into their own table and totals', () => {
        const pack = emptyInvoiceTimeReportPack('UZS');
        pack.detailSlots = [
            row({ task: 'My mehnat registration', description: 'termination of Sherzod' }),
            row({
                task: 'Research',
                description: 'on the Tax Code',
                hours: '0,35',
                hourlyRate: 'UZS 1,500,000.00',
                amount: 'UZS 525,000.00',
            }),
        ];
        const next = ensureMehnatSeparatedPack(pack);
        expect(next.detailSlots.map((r) => r.task)).toEqual(['Research']);
        expect(next.mehnatSlots.map((r) => r.task)).toEqual(['My mehnat registration']);
        expect(next.mehnatTotalHoursDisplay).toBe('1,00');
        expect(next.mehnatTotalAmountDisplay).toContain('230,000.00');
        expect(next.detailTotalAmountDisplay).toContain('525,000.00');
    });

    it('is idempotent after a split', () => {
        const pack = emptyInvoiceTimeReportPack('UZS');
        pack.detailSlots = [row({ task: 'My mehnat registration' })];
        const once = ensureMehnatSeparatedPack(pack);
        const twice = ensureMehnatSeparatedPack(once);
        expect(twice.mehnatSlots).toHaveLength(1);
        expect(twice.detailSlots).toHaveLength(0);
    });
});
