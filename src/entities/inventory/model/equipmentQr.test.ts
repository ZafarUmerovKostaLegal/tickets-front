import { describe, expect, it } from 'vitest';
import { equipmentQrCode, equipmentQrCodes, equipmentQrPublicUrl, parseEquipmentQrCode } from './equipmentQr';

describe('equipmentQr', () => {
    it('builds 500 stable codes', () => {
        const codes = equipmentQrCodes();
        expect(codes).toHaveLength(500);
        expect(codes[0]).toBe('KL-EQ-0001');
        expect(codes[499]).toBe('KL-EQ-0500');
        expect(equipmentQrCode(10)).toBe('KL-EQ-0010');
    });

    it('points a scan at the protected tag page', () => {
        expect(equipmentQrPublicUrl('KL-EQ-0007')).toBe('https://tickets.kostalegal.com/inventory/tag/KL-EQ-0007');
        expect(parseEquipmentQrCode('kl-eq-0007')).toBe('KL-EQ-0007');
        expect(parseEquipmentQrCode('KL-EQ-0501')).toBeNull();
    });
});