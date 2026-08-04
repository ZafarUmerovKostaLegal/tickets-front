import { describe, expect, it } from 'vitest';
import {
    buildInvoicePreviewPageSlots,
    normalizeIncludedPageKeys,
    parseIncludedPageKeys,
    timeReportPageKey,
} from './invoicePreviewPageSlots';

describe('buildInvoicePreviewPageSlots', () => {
    it('builds cover + time-report chunks + invoice', () => {
        const slots = buildInvoicePreviewPageSlots(2);
        expect(slots.map((s) => s.key)).toEqual(['cover', 'tr:0', 'tr:1', 'invoice']);
    });

    it('keeps at least one time-report slot', () => {
        expect(buildInvoicePreviewPageSlots(0).map((s) => s.key)).toEqual(['cover', 'tr:0', 'invoice']);
    });
});

describe('normalizeIncludedPageKeys', () => {
    const slots = buildInvoicePreviewPageSlots(1);

    it('defaults to all pages', () => {
        expect([...normalizeIncludedPageKeys(null, slots)]).toEqual(['cover', 'tr:0', 'invoice']);
    });

    it('drops unknown keys and keeps at least one page', () => {
        const next = normalizeIncludedPageKeys(['cover', 'tr:99' as never], slots);
        expect([...next]).toEqual(['cover']);
    });

    it('falls back to invoice when empty', () => {
        const next = normalizeIncludedPageKeys([], slots);
        expect(next.has('invoice')).toBe(true);
    });
});

describe('parseIncludedPageKeys', () => {
    it('parses stable keys', () => {
        expect(parseIncludedPageKeys(['cover', timeReportPageKey(0), 'invoice', 'cover'])).toEqual([
            'cover',
            'tr:0',
            'invoice',
        ]);
    });
});
