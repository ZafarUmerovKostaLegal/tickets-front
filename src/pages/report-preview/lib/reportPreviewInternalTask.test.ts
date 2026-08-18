import { describe, expect, it } from 'vitest';
import { isKostaLegalInternalTask } from './reportPreviewInternalTask';

describe('isKostaLegalInternalTask', () => {
    it('matches the English catalog name', () => {
        expect(isKostaLegalInternalTask('Kosta Legal Internal')).toBe(true);
        expect(isKostaLegalInternalTask('  kosta legal internal  ')).toBe(true);
    });

    it('matches the Russian label', () => {
        expect(isKostaLegalInternalTask('Внутренние дела Kosta Legal')).toBe(true);
    });

    it('matches a synthetic task id', () => {
        expect(isKostaLegalInternalTask('', 'task:Kosta Legal Internal')).toBe(true);
    });

    it('does not match other tasks', () => {
        expect(isKostaLegalInternalTask('Document Review')).toBe(false);
        expect(isKostaLegalInternalTask('Research')).toBe(false);
        expect(isKostaLegalInternalTask('')).toBe(false);
    });
});
