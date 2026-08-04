import { describe, expect, it } from 'vitest';
import {
    formatOutgoingLetterheadDate,
    formatOutgoingRefLine,
} from '../ui/CorrespondenceLetterSheet';

describe('formatOutgoingRefLine', () => {
    it('prefixes registry numbers', () => {
        expect(formatOutgoingRefLine('47-07-KL-04')).toBe('Исх. № 47-07-KL-04');
    });

    it('normalizes existing Исх prefix', () => {
        expect(formatOutgoingRefLine('Исх. № 47-07-KL-04')).toBe('Исх. № 47-07-KL-04');
        expect(formatOutgoingRefLine('ИСХ-2026/001')).toBe('Исх. № 2026/001');
    });

    it('handles draft placeholder', () => {
        expect(formatOutgoingRefLine('ИСХ-черновик')).toBe('Исх. № —');
        expect(formatOutgoingRefLine('')).toBe('Исх. № —');
    });
});

describe('formatOutgoingLetterheadDate', () => {
    it('strips trailing г. from RU date', () => {
        expect(formatOutgoingLetterheadDate({
            letterDateDisplay: '13 июля 2026 г.',
            issueDateIso: '2026-07-13',
            coverLanguage: 'RU',
        })).toBe('13 июля 2026');
    });

    it('formats from issue date when display empty', () => {
        const out = formatOutgoingLetterheadDate({
            letterDateDisplay: '',
            issueDateIso: '2026-07-13',
            coverLanguage: 'RU',
        });
        expect(out).toMatch(/13\s+июля\s+2026/);
    });
});
