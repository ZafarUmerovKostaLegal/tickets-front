import { describe, expect, it } from 'vitest';
import { canDeleteCorrespondence } from './permissions';

describe('canDeleteCorrespondence', () => {
    it('allows registry managers', () => {
        expect(canDeleteCorrespondence('Администратор')).toBe(true);
        expect(canDeleteCorrespondence('Партнёр')).toBe(true);
        expect(canDeleteCorrespondence('Офис-менеджер')).toBe(true);
    });

    it('hides delete from employees and IT', () => {
        expect(canDeleteCorrespondence('Сотрудник')).toBe(false);
        expect(canDeleteCorrespondence('IT отдел')).toBe(false);
        expect(canDeleteCorrespondence(null)).toBe(false);
    });
});
