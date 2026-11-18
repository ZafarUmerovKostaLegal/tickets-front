/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import {
    EMPTY_INVOICE_REGISTRY_FILTERS,
    readInvoiceRegistryFilters,
    readInvoiceRegistryScroll,
    writeInvoiceRegistryFilters,
    writeInvoiceRegistryScroll,
} from './invoiceRegistryViewState';

describe('invoiceRegistryViewState', () => {
    beforeEach(() => window.localStorage.clear());

    it('keeps filters per sheet', () => {
        const filters = { ...EMPTY_INVOICE_REGISTRY_FILTERS, partners: ['VBG'], months: [3, 11], dateFrom: '2026-01-01' };
        writeInvoiceRegistryFilters('2026-system', filters);
        expect(readInvoiceRegistryFilters('2026-system')).toEqual(filters);
        expect(readInvoiceRegistryFilters('2025')).toEqual(EMPTY_INVOICE_REGISTRY_FILTERS);
    });

    it('removes the entry when filters are cleared', () => {
        writeInvoiceRegistryFilters('2026', { ...EMPTY_INVOICE_REGISTRY_FILTERS, search: 'x' });
        writeInvoiceRegistryFilters('2026', EMPTY_INVOICE_REGISTRY_FILTERS);
        expect(window.localStorage.getItem('tt-inv-reg-filters:2026')).toBeNull();
    });

    it('ignores broken or foreign data', () => {
        window.localStorage.setItem('tt-inv-reg-filters:2026', '{not json');
        expect(readInvoiceRegistryFilters('2026')).toEqual(EMPTY_INVOICE_REGISTRY_FILTERS);
        window.localStorage.setItem('tt-inv-reg-filters:2026', JSON.stringify({ partners: ['A', 5], months: [0, 4, 13, 'x'], search: 7 }));
        expect(readInvoiceRegistryFilters('2026')).toEqual({ ...EMPTY_INVOICE_REGISTRY_FILTERS, partners: ['A'], months: [4] });
    });

    it('stores scroll position, dropping the top-left one', () => {
        writeInvoiceRegistryScroll('2026-system', { top: 640.6, left: 120 });
        expect(readInvoiceRegistryScroll('2026-system')).toEqual({ top: 641, left: 120 });
        writeInvoiceRegistryScroll('2026-system', { top: 0, left: 0 });
        expect(readInvoiceRegistryScroll('2026-system')).toBeNull();
    });
});
