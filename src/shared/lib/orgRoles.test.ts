import { describe, expect, it } from 'vitest';
import {
    canAccessAdminOnlyModules,
    canAccessAdminPanel,
    canAccessAttendance,
    hasFullTicketAccessRole,
    isPartnerOrgRole,
    normalizeOrgRoleKey,
} from './orgRoles';

describe('normalizeOrgRoleKey', () => {
    it('нормализует регистр и ё', () => {
        expect(normalizeOrgRoleKey('  Администратор  ')).toBe('администратор');
        expect(normalizeOrgRoleKey('Партнёр')).toBe('партнер');
    });
});

describe('isPartnerOrgRole', () => {
    it('распознаёт партнёра по роли и должности', () => {
        expect(isPartnerOrgRole('Партнёр', null)).toBe(true);
        expect(isPartnerOrgRole('Юрист', 'Партнёр')).toBe(true);
        expect(isPartnerOrgRole('Сотрудник', 'Юрист')).toBe(false);
    });
});

describe('canAccessAdminPanel', () => {
    it('даёт доступ админам и партнёрам', () => {
        expect(canAccessAdminPanel('Администратор', null)).toBe(true);
        expect(canAccessAdminPanel('Главный администратор', null)).toBe(true);
        expect(canAccessAdminPanel('Партнёр', null)).toBe(true);
        expect(canAccessAdminPanel('Сотрудник', null)).toBe(false);
    });
});

describe('canAccessAdminOnlyModules', () => {
    it('только для администраторов, не для партнёров', () => {
        expect(canAccessAdminOnlyModules('Администратор')).toBe(true);
        expect(canAccessAdminOnlyModules('Партнёр')).toBe(false);
    });
});

describe('canAccessAttendance', () => {
    it('доступен админам и партнёрам', () => {
        expect(canAccessAttendance('Администратор', null)).toBe(true);
        expect(canAccessAttendance('Сотрудник', 'Партнёр')).toBe(true);
        expect(canAccessAttendance('Сотрудник', null)).toBe(false);
    });
});

describe('hasFullTicketAccessRole', () => {
    it('расширенный доступ для IT, админов и партнёров', () => {
        expect(hasFullTicketAccessRole('IT')).toBe(true);
        expect(hasFullTicketAccessRole('Администратор')).toBe(true);
        expect(hasFullTicketAccessRole('Партнёр')).toBe(true);
        expect(hasFullTicketAccessRole('Сотрудник')).toBe(false);
    });
});
