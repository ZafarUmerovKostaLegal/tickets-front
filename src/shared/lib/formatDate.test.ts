import { describe, expect, it } from 'vitest';
import {
    formatClockDate,
    formatDateForInput,
    formatDateInfo,
    formatDateOnly,
    formatDateRu,
    formatDateShort,
    formatDateShortWithTime,
    formatTime,
    toDateInput,
} from './formatDate';

describe('formatDate', () => {
    const iso = '2026-07-27T09:05:06.000Z';

    it('formats API timestamps for the supported UI variants', () => {
        expect(formatDateRu(iso)).toMatch(/2026/);
        expect(formatDateShort(iso)).toMatch(/2026/);
        expect(formatDateShortWithTime(iso)).toMatch(/2026/);
        expect(formatDateInfo(iso)).toMatch(/2026/);
        expect(formatDateOnly(iso)).toMatch(/2026/);
        expect(formatTime(iso)).toMatch(/\d{2}:\d{2}:\d{2}/);
        expect(formatClockDate(new Date(2026, 6, 27))).toContain('27');
    });

    it('returns safe date-input values for nullable and invalid input', () => {
        expect(toDateInput(iso)).toBe('2026-07-27');
        expect(toDateInput(null)).toBe('');
        expect(toDateInput('invalid')).toBe('');
        expect(formatDateOnly(null)).toBeTruthy();
        expect(formatDateForInput(new Date('2026-07-27T18:30:00.000Z'))).toBe('2026-07-27');
    });
});
