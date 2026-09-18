import { describe, expect, it } from 'vitest';
import { wrapPdfCellLines } from './invoicePdfCellWrap';

describe('wrapPdfCellLines', () => {
    it('wraps at spaces when words fit', () => {
        const lines = wrapPdfCellLines('hello world again', 100, (s) => s.length * 10);
        expect(lines).toEqual(['hello', 'world', 'again']);
    });

    it('splits a long unbroken token so it fits the column', () => {
        const long = 'Проверкаработывсейконструкциивалфвоыпраолвфыпраролпвфьюл';
        const lines = wrapPdfCellLines(long, 50, (s) => s.length * 10);
        expect(lines.length).toBeGreaterThan(1);
        expect(lines.join('')).toBe(long);
        for (const ln of lines)
            expect(ln.length * 10).toBeLessThanOrEqual(50);
    });

    it('keeps short text on one line', () => {
        expect(wrapPdfCellLines('ok', 100, (s) => s.length)).toEqual(['ok']);
    });
});
