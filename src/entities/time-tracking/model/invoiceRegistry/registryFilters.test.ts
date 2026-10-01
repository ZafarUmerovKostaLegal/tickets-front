import { describe, expect, it } from 'vitest';
import { filterInvoiceRegistryRows, parseRegistryDay } from './registryFilters';
import type { InvoiceRegistryRow } from './types';

function row(patch: Partial<InvoiceRegistryRow> & { id: string }): InvoiceRegistryRow {
    return {
        seqNo: '',
        billedTo: '',
        partner: '',
        issueDate: '',
        clientNumber: '',
        ...patch,
    };
}

const sample: InvoiceRegistryRow[] = [
    row({ id: '1', seqNo: '1', billedTo: 'ADB Water', partner: 'NFH', issueDate: '2026-01-08', clientNumber: 'KL-ADB/OT-36/62' }),
    row({ id: '2', seqNo: '2', billedTo: 'Hospital PPP', partner: 'AAA', issueDate: '2026-03-09', clientNumber: 'KL-H/2' }),
    row({ id: '12', seqNo: '12', billedTo: 'Other', partner: 'NFH', issueDate: '13.02.2025', clientNumber: 'X-12' }),
    row({ id: '13', seqNo: '13', billedTo: 'Blank', partner: 'VGB', issueDate: '', clientNumber: '' }),
];

describe('parseRegistryDay', () => {
    it('reads ISO and the first Excel date', () => {
        expect(parseRegistryDay('2026-01-08')).toEqual({ year: 2026, month: 1, day: 8 });
        expect(parseRegistryDay('13.02.2025/\n02.05.2025')).toEqual({ year: 2025, month: 2, day: 13 });
    });
});

describe('filterInvoiceRegistryRows', () => {
    it('combines partner, number, month and date range', () => {
        const matched = filterInvoiceRegistryRows(sample, {
            partners: new Set(['nfh']),
            numberQuery: 'adb',
            months: new Set([1]),
            dateFrom: '2026-01-01',
            dateTo: '2026-01-31',
        });
        expect(matched.map((item) => item.id)).toEqual(['1']);
    });

    it('matches the row number and the client invoice number', () => {
        expect(filterInvoiceRegistryRows(sample, { numberQuery: '12' }).map((item) => item.id)).toEqual(['12']);
        expect(filterInvoiceRegistryRows(sample, { numberQuery: 'KL-H' }).map((item) => item.id)).toEqual(['2']);
    });

    it('keeps several partners and several months', () => {
        const matched = filterInvoiceRegistryRows(sample, {
            partners: new Set(['NFH', 'AAA']),
            months: new Set([1, 3]),
        });
        expect(matched.map((item) => item.id)).toEqual(['1', '2']);
    });

    it('drops rows without an issue date when a date filter is on', () => {
        expect(filterInvoiceRegistryRows(sample, { dateFrom: '2026-01-01' }).map((item) => item.id)).toEqual(['1', '2']);
    });
});
