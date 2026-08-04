import { describe, expect, it } from 'vitest';
import {
    letterBodyIsEmpty,
    letterHtmlToPlainText,
    normalizeLetterBodyHtml,
    plainTextToLetterHtml,
} from './correspondenceLetterHtml';

describe('correspondenceLetterHtml', () => {
    it('converts plain text paragraphs to html', () => {
        const html = plainTextToLetterHtml('Hello\n\nWorld');
        expect(html).toContain('<p>Hello</p>');
        expect(html).toContain('<p>World</p>');
    });

    it('keeps existing html', () => {
        expect(normalizeLetterBodyHtml('<p><b>Hi</b></p>')).toContain('<b>Hi</b>');
    });

    it('detects empty body', () => {
        expect(letterBodyIsEmpty('')).toBe(true);
        expect(letterBodyIsEmpty('<p><br></p>')).toBe(true);
        expect(letterBodyIsEmpty('<p>Text</p>')).toBe(false);
    });

    it('strips tags to plain text', () => {
        expect(letterHtmlToPlainText('<p>A<br>B</p>')).toMatch(/A/);
        expect(letterHtmlToPlainText('<p>A<br>B</p>')).toMatch(/B/);
    });
});
