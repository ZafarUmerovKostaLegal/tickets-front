import { describe, expect, it } from 'vitest';
import { inertBlob, isScriptableFile } from './inertBlob';

describe('inertBlob', () => {
    it('treats HTML, SVG, XML and scripts as dangerous — by type or by name', () => {
        expect(isScriptableFile('text/html; charset=utf-8')).toBe(true);
        expect(isScriptableFile('image/svg+xml')).toBe(true);
        expect(isScriptableFile('application/atom+xml')).toBe(true);
        expect(isScriptableFile('application/octet-stream', 'invoice.HTM')).toBe(true);
        expect(isScriptableFile('', 'logo.svg')).toBe(true);
        expect(isScriptableFile('application/pdf', 'scan.pdf')).toBe(false);
        expect(isScriptableFile('image/png', 'photo.png')).toBe(false);
        expect(isScriptableFile('text/plain', 'notes.txt')).toBe(false);
    });

    it('keeps the bytes and only changes the type', async () => {
        const evil = new Blob(['<script>alert(1)</script>'], { type: 'text/html' });
        const safe = inertBlob(evil, 'x.html');
        expect(safe.type).toBe('text/plain;charset=utf-8');
        expect(safe.size).toBe(evil.size);
        const pdf = new Blob(['%PDF'], { type: 'application/pdf' });
        expect(inertBlob(pdf, 'a.pdf')).toBe(pdf);
    });
});
