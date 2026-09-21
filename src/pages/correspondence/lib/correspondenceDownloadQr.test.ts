import { describe, expect, it, vi } from 'vitest';
import { resolveCorrespondenceDownloadQrUrl } from '@entities/correspondence';
import { buildCorrespondenceQrPngBytes } from '../ui/CorrespondenceLetterQr';

vi.mock('@shared/config', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@shared/config')>();
    return {
        ...actual,
        getApiBaseUrl: () => 'https://ticketsback.kostalegal.com',
        upgradeUrlToPageSecurity: (u: string) => u,
    };
});

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

describe('resolveCorrespondenceDownloadQrUrl', () => {
    it('keeps absolute https urls', () => {
        expect(resolveCorrespondenceDownloadQrUrl('https://ticketsback.kostalegal.com/api/v1/correspondence/x/public-file?token=a.b'))
            .toBe('https://ticketsback.kostalegal.com/api/v1/correspondence/x/public-file?token=a.b');
    });

    it('prefixes relative paths with API base', () => {
        expect(resolveCorrespondenceDownloadQrUrl('/api/v1/correspondence/x/public-file?token=a.b'))
            .toBe('https://ticketsback.kostalegal.com/api/v1/correspondence/x/public-file?token=a.b');
    });
});
