import { describe, expect, it } from 'vitest';
import { isActiveTimeManagerProjectRow, isProjectClosedForTimeEntry } from './projectTimeEntry';

describe('isProjectClosedForTimeEntry', () => {
    it('blocks paused projects', () => {
        expect(isProjectClosedForTimeEntry({ isPaused: true }, '2026-07-12')).toBe(true);
        expect(isProjectClosedForTimeEntry({ is_paused: true }, '2026-07-12')).toBe(true);
        expect(isProjectClosedForTimeEntry({ status: 'paused' }, '2026-07-12')).toBe(true);
    });

    it('allows active projects', () => {
        expect(isProjectClosedForTimeEntry({ isPaused: false, isArchived: false }, '2026-07-12')).toBe(false);
    });
});

describe('isActiveTimeManagerProjectRow', () => {
    it('excludes paused from picker', () => {
        expect(isActiveTimeManagerProjectRow({ isPaused: true })).toBe(false);
        expect(isActiveTimeManagerProjectRow({ isArchived: false, isPaused: false })).toBe(true);
    });
});
