import { describe, expect, it } from 'vitest';
import {
    emptyInvoiceTimeReportPack,
    ensureMehnatSeparatedPack,
    isMyMehnatTimeReportRow,
    mergeTimeReportPackPreferLiveExpenses,
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

describe('mergeTimeReportPackPreferLiveExpenses', () => {
    it('replaces a saved task label with the live database task', () => {
        const saved = emptyInvoiceTimeReportPack('USD');
        const live = emptyInvoiceTimeReportPack('USD');
        const base = {
            date: '04.09.2026',
            initials: 'AAA',
            hours: '1,15',
            hourlyRate: '320,00',
            amount: '368,00',
        };
        saved.detailSlots = [{
            ...base,
            task: 'Drafting',
            description: 'the draft LLA issues list',
        }];
        live.detailSlots = [{
            ...base,
            amount: 'USD 368.00',
            task: 'LLA advice',
            description: 'Drafting the draft LLA issues list',
        }];
        const merged = mergeTimeReportPackPreferLiveExpenses(saved, live);
        expect(merged.detailSlots[0]?.task).toBe('LLA advice');
        expect(merged.detailSlots[0]?.description).toBe('the draft LLA issues list');
    });

    it('replaces a note that was saved into the task column', () => {
        const saved = emptyInvoiceTimeReportPack('USD');
        const live = emptyInvoiceTimeReportPack('USD');
        const base = {
            date: '21.09.2026',
            initials: 'SHMYU',
            hours: '0,75',
            hourlyRate: '320,00',
            amount: '240,00',
        };
        saved.detailSlots = [{
            ...base,
            task: 'Attending CP call.',
            description: 'Attending CP call.',
        }];
        live.detailSlots = [{
            ...base,
            amount: 'USD 240.00',
            task: 'Telephone calls',
            description: 'Attending CP call.',
        }];
        const merged = mergeTimeReportPackPreferLiveExpenses(saved, live);
        expect(merged.detailSlots[0]?.task).toBe('Telephone calls');
        expect(merged.detailSlots[0]?.description).toBe('Attending CP call.');
    });

    it('drops saved time rows that are no longer selected live', () => {
        const saved = emptyInvoiceTimeReportPack('USD');
        const live = emptyInvoiceTimeReportPack('USD');
        const kept = {
            date: '22.09.2026',
            initials: 'AAA',
            task: 'Drafting',
            description: 'termination order',
            hours: '2,08',
            hourlyRate: '320,00',
            amount: 'USD 3843.84',
        };
        saved.detailSlots = [
            { ...kept, date: '17.09.2026', description: 'emails', hours: '0,87', amount: 'USD 3215.52' },
            kept,
        ];
        live.detailSlots = [kept];
        const merged = mergeTimeReportPackPreferLiveExpenses(saved, live);
        expect(merged.detailSlots).toHaveLength(1);
        expect(merged.detailSlots[0]?.description).toBe('termination order');
    });

    it('keeps a translated expense description and takes the live amount', () => {
        const saved = emptyInvoiceTimeReportPack('USD');
        const live = emptyInvoiceTimeReportPack('USD');
        const expense = {
            date: '03.09.2026',
            initials: '',
            task: '',
            description: '',
            hours: '',
            hourlyRate: '',
            amount: 'USD 5.00',
        };
        saved.expenseSlots = [{ ...expense, description: 'Visa application fee for Alfred Benedict' }];
        live.expenseSlots = [{ ...expense, description: 'оплата за подачу визовой заявки за Alfred Benedict', amount: 'USD 5.06' }];
        live.expenseTotalAmountDisplay = 'USD 5.06';
        const merged = mergeTimeReportPackPreferLiveExpenses(saved, live);
        expect(merged.expenseSlots[0]?.description).toBe('Visa application fee for Alfred Benedict');
        expect(merged.expenseSlots[0]?.amount).toBe('USD 5.06');
        expect(merged.expenseTotalAmountDisplay).toBe('USD 5.06');
    });
});
