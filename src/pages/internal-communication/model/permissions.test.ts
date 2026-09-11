import { describe, expect, it } from 'vitest';
import { canManageInternalExtensions } from './permissions';

describe('canManageInternalExtensions', () => {
    it.each([
        'Администратор',
        'Главный администратор',
        'IT',
        'IT отдел',
        'Офис менеджер',
        'Партнёр',
        'Партнер',
    ])('allows %s', (role) => {
        expect(canManageInternalExtensions(role)).toBe(true);
    });

    it.each([null, undefined, '', 'Сотрудник', 'Юрист'])('denies %s', (role) => {
        expect(canManageInternalExtensions(role)).toBe(false);
    });
});
