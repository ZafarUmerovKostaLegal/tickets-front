/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { normalizeLetterBodyHtml, sanitizeLetterHtml } from './correspondenceLetterHtml';

describe('letter HTML from outside is made harmless', () => {
    it('drops scripts, handlers and javascript: links', () => {
        const html = sanitizeLetterHtml('<p onclick="x()">Hi<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">l</a></p>');
        expect(html).not.toMatch(/script|onerror|onclick|javascript:|<img/i);
        expect(html).toContain('Hi');
    });

    it('removes tracking images in styles and page overlays, keeps normal styling', () => {
        const html = sanitizeLetterHtml('<p style="color: red; background: url(https://track.example/p.gif); position: fixed; top: 0; z-index: 9999">x</p>');
        expect(html).not.toMatch(/url\(|position|z-index/i);
        expect(html).toMatch(/color: red/);
    });

    it('links opening a new tab cannot reach back to the Hub window', () => {
        const html = normalizeLetterBodyHtml('<p><a href="https://example.com" target="_blank">site</a></p>');
        expect(html).toMatch(/rel="noopener noreferrer"/);
    });
});
