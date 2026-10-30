import { describe, expect, it } from 'vitest';
import {
    emptyInvoiceTimeReportPack,
    ensureMehnatSeparatedPack,
    fixedFeeScopeText,
    isFixedFeeTimeReportRow,
    isMyMehnatTimeReportRow,
    mergeTimeReportPackPreferLiveExpenses,
    orderTimeReportSummarySlots,
    summaryRowsForRateSlices,
    billableRateFromLine,
    type InvoiceTimeReportDetailRow,
    type InvoiceTimeReportSummaryRow,
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

describe('ensureMehnatSeparatedPack fixed fee', () => {
    it('moves the fixed fee row into its own table before the time total keeps only hours', () => {
        const pack = emptyInvoiceTimeReportPack('UZS');
        pack.detailSlots = [
            row({
                date: '14.10.2026',
                initials: 'TEST',
                task: 'Court Hearing',
                description: 'ponopno',
                hours: '0,05',
                hourlyRate: 'UZS 20.00',
                amount: 'UZS 1.00',
            }),
            row({
                date: '—',
                initials: '—',
                task: 'Other',
                description: 'Fixed fee',
                hours: '',
                hourlyRate: '',
                amount: 'UZS 100,000.00',
            }),
        ];
        pack.detailTotalHoursDisplay = '0,05';
        pack.detailTotalAmountDisplay = 'UZS 100,001.00';
        expect(isFixedFeeTimeReportRow(pack.detailSlots[1]!)).toBe(true);
        const next = ensureMehnatSeparatedPack(pack);
        expect(next.detailSlots.map((item) => item.task)).toEqual(['Court Hearing']);
        expect(next.fixedFeeSlots?.map((item) => item.description)).toEqual(['Fixed fee']);
        expect(next.detailTotalAmountDisplay).toBe('UZS 1.00');
        expect(next.fixedFeeTotalAmountDisplay).toBe('UZS 100,000.00');
        const twice = ensureMehnatSeparatedPack(next);
        expect(twice.detailSlots).toHaveLength(1);
        expect(twice.fixedFeeSlots).toHaveLength(1);
        expect(twice.detailTotalAmountDisplay).toBe('UZS 1.00');
    });
});

describe('fixedFeeScopeText', () => {
    it('uses the task when the description is only the fee label', () => {
        expect(fixedFeeScopeText({ task: 'Other', description: 'Fixed fee' })).toBe('Other');
    });

    it('uses a written description as the scope', () => {
        expect(fixedFeeScopeText({ task: 'Other', description: 'Filing fee' })).toBe('Filing fee');
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

    it('reorders a saved summary from partner down to junior', () => {
        const saved = emptyInvoiceTimeReportPack('UZS');
        const live = emptyInvoiceTimeReportPack('UZS');
        saved.summarySlots = [
            summary({ initials: 'SRA', name: 'Sevara', title: 'Junior Associate', hourlyRate: 'UZS 1,500,000.00', totalPrice: 'UZS 54,420,000.00' }),
            summary({ initials: 'AAA', name: 'Azizbek', title: 'Partner', hourlyRate: 'UZS 3,600,000.00', totalPrice: 'UZS 7,020,000.00' }),
            summary({ initials: 'DGO', name: 'Dilshodbek', title: 'Associate', hourlyRate: 'UZS 2,000,000.00', totalPrice: 'UZS 1,100,000.00' }),
            summary({ initials: 'IFT', name: 'Iroda', title: 'Associate', hourlyRate: 'UZS 2,000,000.00', totalPrice: 'UZS 5,260,000.00' }),
        ];
        const merged = mergeTimeReportPackPreferLiveExpenses(saved, live);
        expect(merged.summarySlots.slice(0, 4).map((row) => row.initials)).toEqual(['AAA', 'IFT', 'DGO', 'SRA']);
    });

    it('replaces a saved single rate with the live old and new rate rows', () => {
        const saved = emptyInvoiceTimeReportPack('USD');
        const live = emptyInvoiceTimeReportPack('USD');
        saved.summarySlots = [
            summary({
                initials: 'SHOKH',
                name: 'Shahzoda Khusenova',
                title: 'Junior Associate',
                hours: '5,47',
                hourlyRate: 'USD 100.00',
                totalPrice: 'USD 627.10',
            }),
        ];
        saved.summaryGrandHoursDisplay = '5,47';
        saved.summaryGrandAmountDisplay = 'USD 627.10';
        live.summarySlots = [
            summary({
                initials: 'SHOKH',
                name: 'Shahzoda Khusenova',
                title: 'Junior Associate',
                hours: '2,67',
                hourlyRate: 'USD 130.00',
                totalPrice: 'USD 347.10',
            }),
            summary({
                initials: 'SHOKH',
                name: 'Shahzoda Khusenova',
                title: '',
                hours: '2,80',
                hourlyRate: 'USD 100.00',
                totalPrice: 'USD 280.00',
            }),
        ];
        live.summaryGrandHoursDisplay = '5,47';
        live.summaryGrandAmountDisplay = 'USD 627.10';
        const merged = mergeTimeReportPackPreferLiveExpenses(saved, live);
        expect(merged.summarySlots.filter((row) => row.initials === 'SHOKH').map((row) => ({
            hours: row.hours,
            hourlyRate: row.hourlyRate,
            title: row.title,
            totalPrice: row.totalPrice,
        }))).toEqual([
            { hours: '2,67', hourlyRate: 'USD 130.00', title: 'Junior Associate', totalPrice: 'USD 347.10' },
            { hours: '2,80', hourlyRate: 'USD 100.00', title: 'Junior Associate', totalPrice: 'USD 280.00' },
        ]);
    });
});

function summary(partial: Partial<InvoiceTimeReportSummaryRow>): InvoiceTimeReportSummaryRow {
    return {
        initials: '',
        name: '',
        title: '',
        hours: '1,00',
        hourlyRate: '',
        totalPrice: '',
        ...partial,
    };
}

describe('orderTimeReportSummarySlots', () => {
    it('puts partner ahead of associate and junior even when the junior amount is larger', () => {
        const ordered = orderTimeReportSummarySlots([
            summary({ initials: 'SRA', name: 'Sevara', title: 'Junior Associate', totalPrice: 'UZS 54,420,000.00' }),
            summary({ initials: 'AAA', name: 'Azizbek', title: 'Partner', totalPrice: 'UZS 7,020,000.00' }),
            summary({ initials: 'IFT', name: 'Iroda', title: 'Associate', totalPrice: 'UZS 5,260,000.00' }),
        ]);
        expect(ordered.slice(0, 3).map((row) => row.title)).toEqual([
            'Partner',
            'Associate',
            'Junior Associate',
        ]);
    });

    it('keeps the older rate row under the same person', () => {
        const ordered = orderTimeReportSummarySlots([
            summary({ initials: 'III', name: 'Islombek', title: 'Junior Associate', hourlyRate: 'USD 160.00', totalPrice: 'USD 347.20' }),
            summary({ initials: 'ADA', name: 'Alina', title: '', hourlyRate: 'USD 100.00', totalPrice: 'USD 640.00' }),
            summary({ initials: 'SHOKH', name: 'Shahzoda', title: 'Junior Associate', hourlyRate: 'USD 130.00', totalPrice: 'USD 347.10' }),
            summary({ initials: 'ADA', name: 'Alina', title: 'Junior Associate', hourlyRate: 'USD 130.00', totalPrice: 'USD 1,773.20' }),
            summary({ initials: 'SHOKH', name: 'Shahzoda', title: '', hourlyRate: 'USD 100.00', totalPrice: 'USD 280.00' }),
        ]);
        expect(ordered.slice(0, 5).map((row) => `${row.initials} ${row.hourlyRate}`)).toEqual([
            'III USD 160.00',
            'ADA USD 130.00',
            'ADA USD 100.00',
            'SHOKH USD 130.00',
            'SHOKH USD 100.00',
        ]);
    });
});

describe('summaryRowsForRateSlices', () => {
    it('adds a second row at the older rate and leaves its title empty', () => {
        const rows = summaryRowsForRateSlices({
            initials: 'ADA',
            name: 'Alina Abdullaeva',
            title: 'Junior Associate',
            currency: 'USD',
            hours: 20.04,
            amount: 2413.2,
            slices: [
                { rate: 130, hours: 13.64, amount: 1773.2 },
                { rate: 100, hours: 6.4, amount: 640 },
            ],
        });
        expect(rows).toEqual([
            {
                initials: 'ADA',
                name: 'Alina Abdullaeva',
                title: 'Junior Associate',
                hours: '13,64',
                hourlyRate: 'USD 130.00',
                totalPrice: 'USD 1,773.20',
            },
            {
                initials: 'ADA',
                name: 'Alina Abdullaeva',
                title: '',
                hours: '6,40',
                hourlyRate: 'USD 100.00',
                totalPrice: 'USD 640.00',
            },
        ]);
    });

    it('keeps a single row when the rate did not change', () => {
        const rows = summaryRowsForRateSlices({
            initials: 'DGO',
            name: 'Dilshodbek',
            title: 'Associate',
            currency: 'USD',
            hours: 1.76,
            amount: 387.2,
            slices: [{ rate: 220, hours: 1.76, amount: 387.2 }],
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]?.title).toBe('Associate');
        expect(rows[0]?.hourlyRate).toBe('USD 220.00');
    });
});

describe('billableRateFromLine', () => {
    it('uses amount divided by hours when the stored unit rate is not what was billed', () => {
        expect(billableRateFromLine({
            unitAmount: 100,
            hours: 2.67,
            amount: 347.1,
        })).toBe(130);
        expect(billableRateFromLine({
            unitAmount: 250,
            hours: 3.81,
            amount: 952.5,
        })).toBe(250);
    });
});

describe('ensureMehnatSeparatedPack split rates', () => {
    it('does not fold two rate rows back into the person total', () => {
        const base = emptyInvoiceTimeReportPack('USD');
        const line = (hours: string, rate: string, amount: string) => ({
            date: '04.05.2026',
            initials: 'SHOKH',
            task: 'Emails',
            description: '',
            hours,
            hourlyRate: rate,
            amount,
        });
        const pack = ensureMehnatSeparatedPack({
            ...base,
            detailSlots: [
                line('2,67', 'USD 130.00', 'USD 347.10'),
                line('2,80', 'USD 100.00', 'USD 280.00'),
            ],
            summarySlots: [
                summary({ initials: 'SHOKH', name: 'Shahzoda', title: 'Junior Associate', hours: '2,67', hourlyRate: 'USD 130.00', totalPrice: 'USD 347.10' }),
                summary({ initials: 'SHOKH', name: 'Shahzoda', title: '', hours: '2,80', hourlyRate: 'USD 100.00', totalPrice: 'USD 280.00' }),
            ],
        });
        expect(pack.summarySlots.filter((row) => row.initials === 'SHOKH').map((row) => row.hours)).toEqual(['2,67', '2,80']);
    });
});
