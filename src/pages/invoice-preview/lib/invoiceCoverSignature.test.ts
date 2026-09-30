import { describe, expect, it } from 'vitest';
import {
    coverSignaturePublicUrl,
    findCoverSignatoryPartnerByName,
    mergeCoverSignatoryOptions,
    normalizeCoverSignatureCode,
    resolveCoverSignatoryPartner,
} from './invoiceCoverSignature';

describe('invoiceCoverSignature', () => {
    it('maps registry aliases to signature file stems', () => {
        expect(normalizeCoverSignatureCode('AA')).toBe('AAA');
        expect(normalizeCoverSignatureCode('MD')).toBe('MAD');
        expect(normalizeCoverSignatureCode('NH')).toBe('NFH');
        expect(normalizeCoverSignatureCode('VG')).toBe('VBG');
        expect(normalizeCoverSignatureCode('VGB')).toBe('VBG');
    });

    it('resolves partners by name and initials', () => {
        expect(findCoverSignatoryPartnerByName('Maxim Dogonkin')?.initials).toBe('MAD');
        expect(resolveCoverSignatoryPartner({ initials: 'NFH' })?.displayName).toBe('Nail Hassanov');
        expect(coverSignaturePublicUrl('VBG')).toBe('/signatures/VBG.svg');
        expect(coverSignaturePublicUrl('MAD')).toBe('/signatures/MAD.png');
        expect(coverSignaturePublicUrl('Unknown Person')).toBeNull();
    });

    it('lists directory partners and keeps a signature for a matching name', () => {
        const options = mergeCoverSignatoryOptions([
            { id: 8, displayName: 'Guzal Temirova' },
            { id: 3, displayName: 'Maxim Dogonkin' },
        ]);
        expect(options.find((partner) => partner.displayName === 'Guzal Temirova')).toMatchObject({
            initials: 'user:8',
            fileName: '',
        });
        expect(options.find((partner) => partner.displayName === 'Maxim Dogonkin')?.initials).toBe('MAD');
        expect(options.some((partner) => partner.initials === 'AAA')).toBe(true);
    });
});
