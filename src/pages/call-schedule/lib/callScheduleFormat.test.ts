import { describe, expect, it } from 'vitest';
import type { TranslationKey } from '@shared/i18n/translate';
import { eventCountLabel, fmtDuration, formatDateLong, localeTag, monthTitle, weekdayLabels } from './callScheduleFormat';
import { joinLabelWithoutOpenPrefix, translateJoinLabel } from './callJoinLabels';

const t = (key: TranslationKey) => `[${key.split('.').pop()}]`;

describe('callScheduleFormat', () => {
    it('maps app locale to a BCP 47 tag', () => {
        expect(localeTag('ru')).toBe('ru-RU');
        expect(localeTag('en')).toBe('en-US');
    });

    it('formats a long date with a capitalised first letter', () => {
        const s = formatDateLong('2026-11-17', 'ru');
        expect(s.charAt(0)).toBe(s.charAt(0).toUpperCase());
        expect(s).toContain('17');
        expect(s).toContain('2026');
        expect(formatDateLong('garbage', 'ru')).toBe('garbage');
    });

    it('capitalises the month title', () => {
        const s = monthTitle(new Date(2026, 10, 1), 'ru');
        expect(s.startsWith('Н')).toBe(true);
        expect(s).toContain('2026');
    });

    it('formats durations', () => {
        expect(fmtDuration(0, t)).toBe('—');
        expect(fmtDuration(Number.NaN, t)).toBe('—');
        expect(fmtDuration(45, t)).toBe('45 [min]');
        expect(fmtDuration(60, t)).toBe('1 [hour]');
        expect(fmtDuration(95, t)).toBe('1 [hour] 35 [min]');
    });

    it('uses Russian plural rules for event counts', () => {
        expect(eventCountLabel(1, 'ru', t)).toBe('1 [one]');
        expect(eventCountLabel(3, 'ru', t)).toBe('3 [few]');
        expect(eventCountLabel(5, 'ru', t)).toBe('5 [many]');
        expect(eventCountLabel(11, 'ru', t)).toBe('11 [many]');
        expect(eventCountLabel(21, 'ru', t)).toBe('21 [one]');
        expect(eventCountLabel(22, 'ru', t)).toBe('22 [few]');
        expect(eventCountLabel(1, 'en', t)).toBe('1 [one]');
        expect(eventCountLabel(2, 'en', t)).toBe('2 [many]');
    });

    it('returns seven weekday labels starting on Monday', () => {
        expect(weekdayLabels(t)).toEqual(['[mon]', '[tue]', '[wed]', '[thu]', '[fri]', '[sat]', '[sun]']);
    });
});

describe('callJoinLabels', () => {
    it('translates by row key, then by class, then falls back to the label', () => {
        expect(translateJoinLabel({ key: 'zoom', label: 'x', className: '', url: 'u' }, t)).toBe('[zoom]');
        expect(translateJoinLabel({ key: 'ml-1', label: 'x', className: 'csched-modal__join--teams', url: 'u' }, t)).toBe('[teams]');
        expect(translateJoinLabel({ key: 'ml-2', label: 'x', className: 'csched-modal__join--generic', url: 'u' }, t)).toBe('[meetingLink]');
        expect(translateJoinLabel({ key: 'ml-3', label: 'Raw', className: 'other', url: 'u' }, t)).toBe('Raw');
    });

    it('drops the "Open" prefix in both languages', () => {
        const ru = (_: TranslationKey) => 'Открыть в Zoom';
        const en = (_: TranslationKey) => 'Open in Zoom';
        const row = { key: 'zoom', label: '', className: '', url: 'u' };
        expect(joinLabelWithoutOpenPrefix(row, ru)).toBe('в Zoom');
        expect(joinLabelWithoutOpenPrefix(row, en)).toBe('in Zoom');
    });
});
