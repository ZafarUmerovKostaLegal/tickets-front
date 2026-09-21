import { describe, expect, it } from 'vitest';
import { buildCorrespondenceQrPngBytes } from '../ui/CorrespondenceLetterQr';

describe('buildCorrespondenceQrPngBytes', () => {
    it('returns PNG bytes for a https URL', async () => {
        const bytes = await buildCorrespondenceQrPngBytes(
            'https://ticketsback.kostalegal.com/api/v1/correspondence/doc/attachments/att/public-file?token=abc.def',
            64,
        );
        expect(bytes).not.toBeNull();
        expect(bytes!.length).toBeGreaterThan(40);
        // PNG signature
        expect([...bytes!.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    });

    it('returns null for empty URL', async () => {
        expect(await buildCorrespondenceQrPngBytes('')).toBeNull();
    });
});
