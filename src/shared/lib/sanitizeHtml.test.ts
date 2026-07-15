/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { sanitizeHtml, stripHtmlToText } from './sanitizeHtml';

describe('sanitizeHtml', () => {
    it('strips scripts in rich profile', () => {
        const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>', 'rich');
        expect(out).toContain('ok');
        expect(out.toLowerCase()).not.toContain('<script');
    });

    it('textOnly removes all tags', () => {
        expect(stripHtmlToText('<b>Hello</b> &amp; world')).toContain('Hello');
        expect(stripHtmlToText('<b>Hello</b>')).not.toContain('<b>');
    });

    it('twemoji profile keeps img tags with safe attrs', () => {
        const out = sanitizeHtml(
            '<img src="/twemoji/1f600.svg" alt="😀" class="twemoji" onerror="alert(1)">',
            'twemoji',
        );
        expect(out).toContain('<img');
        expect(out.toLowerCase()).not.toContain('onerror');
    });
});
