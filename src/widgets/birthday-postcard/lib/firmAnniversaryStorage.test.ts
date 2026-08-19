/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import {
    FIRM_FOUNDING_YEAR,
    buildFirmAnniversaryGreeting,
    firmAnniversaryYears,
    hasSeenFirmAnniversary,
    isFirmAnniversaryDate,
    markFirmAnniversarySeen,
} from './firmAnniversaryStorage';

describe('firmAnniversaryStorage', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('recognizes only 19 August', () => {
        expect(isFirmAnniversaryDate(new Date(2026, 7, 19))).toBe(true);
        expect(isFirmAnniversaryDate(new Date(2026, 7, 18))).toBe(false);
        expect(isFirmAnniversaryDate(new Date(2026, 6, 19))).toBe(false);
    });

    it('counts years from founding year', () => {
        expect(firmAnniversaryYears(2026)).toBe(11);
        expect(firmAnniversaryYears(FIRM_FOUNDING_YEAR)).toBe(1);
    });

    it('stores seen flag once per user and year', () => {
        expect(hasSeenFirmAnniversary('it@kostalegal.com', 2026)).toBe(false);
        markFirmAnniversarySeen('IT@kostalegal.com', 2026);
        expect(hasSeenFirmAnniversary('it@kostalegal.com', 2026)).toBe(true);
        expect(hasSeenFirmAnniversary('it@kostalegal.com', 2027)).toBe(false);
    });

    it('builds the 11th anniversary letter', () => {
        const greeting = buildFirmAnniversaryGreeting({
            email: 'partner@kostalegal.com',
            id: 7,
            display_name: 'Partner',
        }, new Date(2026, 7, 19));
        expect(greeting.kind).toBe('firm');
        expect(greeting.coverTitle).toBe('11 лет');
        expect(greeting.insideTitle).toBe('Уважаемые партнёры, коллеги!');
        expect(greeting.paragraphs?.[0]).toContain('11-й годовщиной');
        expect(greeting.paragraphs?.at(-1)).toContain('С уважением');
        expect(greeting.senderName).toBe('вся команда Kosta Legal');
    });
});
