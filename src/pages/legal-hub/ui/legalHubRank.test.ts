import { describe, expect, it } from 'vitest';
import { canAssignLegalHubTask, legalHubPositionRank } from './legalHubRank';

describe('legalHubPositionRank', () => {
    it('ставит партнёра выше Associate, а Associate выше младших', () => {
        expect(legalHubPositionRank('Partner', null)).toBe(0);
        expect(legalHubPositionRank('', 'Партнёр')).toBe(0);
        expect(legalHubPositionRank('Senior Associate', null)).toBe(2);
        expect(legalHubPositionRank('Associate', null)).toBe(5);
        expect(legalHubPositionRank('Junior Associate', null)).toBe(7);
        expect(legalHubPositionRank('Senior Associate', null)).toBeLessThan(legalHubPositionRank('Associate', null));
        expect(legalHubPositionRank('Associate', null)).toBeLessThan(legalHubPositionRank('Junior Associate', null));
    });
});

describe('canAssignLegalHubTask', () => {
    const partner = { id: 1, rank: 0 };
    const senior = { id: 2, rank: 2 };
    const associate = { id: 3, rank: 5 };
    const otherAssociate = { id: 4, rank: 5 };
    const junior = { id: 5, rank: 7 };

    it('партнёр задаёт задачи всем', () => {
        expect(canAssignLegalHubTask(partner, partner)).toBe(true);
        expect(canAssignLegalHubTask(partner, associate)).toBe(true);
        expect(canAssignLegalHubTask(partner, junior)).toBe(true);
    });

    it('Associate задаёт задачи только тем, кто ниже', () => {
        expect(canAssignLegalHubTask(associate, junior)).toBe(true);
        expect(canAssignLegalHubTask(associate, associate)).toBe(false);
        expect(canAssignLegalHubTask(associate, otherAssociate)).toBe(false);
        expect(canAssignLegalHubTask(associate, partner)).toBe(false);
        expect(canAssignLegalHubTask(senior, associate)).toBe(true);
        expect(canAssignLegalHubTask(senior, partner)).toBe(false);
    });

    it('младший сотрудник оставляет задачу себе', () => {
        expect(canAssignLegalHubTask(junior, junior)).toBe(true);
        expect(canAssignLegalHubTask(junior, associate)).toBe(false);
    });
});
