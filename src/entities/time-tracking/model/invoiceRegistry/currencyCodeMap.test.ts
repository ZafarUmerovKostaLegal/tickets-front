import { describe, expect, it } from 'vitest';
import {
    applyInvoiceRegistryCurrencyCodeFixes,
    mapInvoiceRegistryCurrencyCode,
} from './currencyCodeMap';

describe('invoice registry currency code map', () => {
    it('maps known currency typos', () => {
        expect(mapInvoiceRegistryCurrencyCode('USZ')).toBe('UZS');
        expect(mapInvoiceRegistryCurrencyCode('usz')).toBe('UZS');
        expect(mapInvoiceRegistryCurrencyCode('UZD')).toBe('UZS');
        expect(mapInvoiceRegistryCurrencyCode('GBH')).toBe('GBP');
        expect(mapInvoiceRegistryCurrencyCode('UZS')).toBe('UZS');
        expect(mapInvoiceRegistryCurrencyCode('GBP')).toBe('GBP');
    });

    it('applies fixes on rows', () => {
        expect(applyInvoiceRegistryCurrencyCodeFixes({ id: '1', currency: 'USZ' }).currency).toBe('UZS');
        expect(applyInvoiceRegistryCurrencyCodeFixes({ id: '2', currency: 'UZD' }).currency).toBe('UZS');
        expect(applyInvoiceRegistryCurrencyCodeFixes({ id: '3', currency: 'GBH' }).currency).toBe('GBP');
    });
});
