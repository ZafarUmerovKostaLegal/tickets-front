import { describe, expect, it } from 'vitest';
import {
    applyInvoiceRegistryPartnerCodeFixes,
    mapInvoiceRegistryAdvanceFee,
    mapInvoiceRegistryPartnerCode,
} from './partnerCodeMap';

describe('invoice registry partner code map', () => {
    it('maps known partner codes', () => {
        expect(mapInvoiceRegistryPartnerCode('AA')).toBe('AAA');
        expect(mapInvoiceRegistryPartnerCode('VG')).toBe('VGB');
        expect(mapInvoiceRegistryPartnerCode('NH')).toBe('NFH');
        expect(mapInvoiceRegistryPartnerCode('SHYU')).toBe('SHMYU');
        expect(mapInvoiceRegistryPartnerCode('ShYu')).toBe('SHMYU');
        expect(mapInvoiceRegistryPartnerCode('MD')).toBe('MAD');
        expect(mapInvoiceRegistryPartnerCode('NFH')).toBe('NFH');
    });

    it('maps advanceFee partner prefixes', () => {
        expect(mapInvoiceRegistryAdvanceFee('NH: 3 375,00\nAA: 1 351,80')).toBe('NFH: 3 375,00\nAAA: 1 351,80');
        expect(mapInvoiceRegistryAdvanceFee('VG:8 952 000')).toBe('VGB:8 952 000');
    });

    it('applies fixes on rows', () => {
        const row = applyInvoiceRegistryPartnerCodeFixes({
            id: '1',
            partner: 'ShYu',
            advanceFee: 'MD: 100',
        });
        expect(row.partner).toBe('SHMYU');
        expect(row.advanceFee).toBe('MAD: 100');
    });
});
