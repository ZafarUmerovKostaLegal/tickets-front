import { describe, expect, it } from 'vitest';
import { normalizeUser } from './normalizeUser';
import { normalizeUserPublic, normalizeUsersPublicBatch } from './normalizeUserPublic';

describe('normalizeUser', () => {
    it('throws on non-object payloads', () => {
        expect(() => normalizeUser(null)).toThrow('Invalid user payload');
        expect(() => normalizeUser('x')).toThrow();
    });

    it('accepts snake_case and camelCase and coerces types', () => {
        const u = normalizeUser({
            id: '42',
            email: 'a@b.c',
            displayName: '  Иван  ',
            role: 'admin',
            isBlocked: 'true',
            is_archived: 0,
            weeklyCapacityHours: '40',
            timeTrackingRole: 'Сотрудник',
            createdAt: '2026-01-01',
            picture: '   ',
        });
        expect(u.id).toBe(42);
        expect(u.display_name).toBe('Иван');
        expect(u.is_blocked).toBe(true);
        expect(u.is_archived).toBe(false);
        expect(u.weekly_capacity_hours).toBe(40);
        expect(u.time_tracking_role).toBe('user');
        expect(u.created_at).toBe('2026-01-01');
        expect(u.picture).toBeNull();
        expect(u.updated_at).toBeNull();
    });

    it('normalises time tracking roles', () => {
        expect(normalizeUser({ time_tracking_role: 'Менеджер' }).time_tracking_role).toBe('manager');
        expect(normalizeUser({ time_tracking_role: 'employee' }).time_tracking_role).toBe('user');
        expect(normalizeUser({ time_tracking_role: 'boss' }).time_tracking_role).toBeNull();
        expect(normalizeUser({}).time_tracking_role).toBeNull();
    });

    it('distinguishes a missing weekly capacity from an empty one', () => {
        expect(normalizeUser({}).weekly_capacity_hours).toBeUndefined();
        expect(normalizeUser({ weekly_capacity_hours: '' }).weekly_capacity_hours).toBeNull();
        expect(normalizeUser({ weekly_capacity_hours: 'abc' }).weekly_capacity_hours).toBeNull();
    });

    it('keeps permissions only when they carry a numeric version', () => {
        expect(normalizeUser({ permissions: { v: 2, x: 1 } }).permissions).toEqual({ v: 2, x: 1 });
        expect(normalizeUser({ permissions: { x: 1 } }).permissions).toBeUndefined();
        expect(normalizeUser({ permissions: 'all' }).permissions).toBeUndefined();
    });

    it('falls back to 0 for invalid ids', () => {
        expect(normalizeUser({ id: 'abc' }).id).toBe(0);
    });
});

describe('normalizeUserPublic', () => {
    it('rejects payloads without a positive id', () => {
        expect(normalizeUserPublic(null)).toBeNull();
        expect(normalizeUserPublic({ id: 0 })).toBeNull();
        expect(normalizeUserPublic({ id: -1 })).toBeNull();
    });

    it('maps public fields', () => {
        expect(normalizeUserPublic({ id: '3', email: 'e', displayName: 'Имя', isArchived: 1 })).toEqual({
            id: 3,
            email: 'e',
            display_name: 'Имя',
            picture: null,
            position: null,
            is_archived: true,
        });
    });

    it('normalises a batch, dropping invalid items and ids', () => {
        expect(normalizeUsersPublicBatch(null)).toEqual({ items: [], missing_ids: [] });
        const batch = normalizeUsersPublicBatch({
            items: [{ id: 1, email: 'a' }, { id: 0 }, 'junk'],
            missingIds: [5, '6', 'x', 0],
        });
        expect(batch.items.map((u) => u.id)).toEqual([1]);
        expect(batch.missing_ids).toEqual([5, 6]);
    });
});
