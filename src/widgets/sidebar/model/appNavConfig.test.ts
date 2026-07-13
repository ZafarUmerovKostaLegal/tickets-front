import { describe, expect, it, vi } from 'vitest';
import type { User } from '@entities/user';
import { getVisibleAppNavItems, APP_NAV_DEFINITIONS } from './appNavConfig';

vi.mock('@tauri-apps/api/core', () => ({
    isTauri: () => false,
}));

function user(partial: Partial<User> & Pick<User, 'role'>): User {
    return {
        id: 1,
        email: 't@test.com',
        display_name: 'Test',
        picture: null,
        position: null,
        is_blocked: false,
        is_archived: false,
        time_tracking_role: null,
        weekly_capacity_hours: 40,
        created_at: '',
        updated_at: null,
        desktop_background: null,
        ...partial,
    };
}

describe('getVisibleAppNavItems', () => {
    it('сотрудник видит ограниченный набор разделов', () => {
        const items = getVisibleAppNavItems(user({
            role: 'Сотрудник',
            time_tracking_role: 'user',
        }), false);
        const ids = items.map((i) => i.id);
        expect(ids).toContain('tickets');
        expect(ids).toContain('todo');
        expect(ids).not.toContain('admin');
        expect(ids).not.toContain('inventory');
        expect(ids).not.toContain('attendance');
    });

    it('администратор видит admin, inventory, attendance', () => {
        const items = getVisibleAppNavItems(user({
            role: 'Администратор',
            time_tracking_role: 'manager',
        }), false);
        const ids = items.map((i) => i.id);
        expect(ids).toContain('admin');
        expect(ids).toContain('inventory');
        expect(ids).toContain('attendance');
        expect(ids).toContain('accounting');
        expect(ids).not.toContain('networkDrive');
    });

    it('партнёр видит admin, но не accounting/contacts', () => {
        const items = getVisibleAppNavItems(user({
            role: 'Партнёр',
            time_tracking_role: 'manager',
        }), false);
        const ids = items.map((i) => i.id);
        expect(ids).toContain('admin');
        expect(ids).toContain('attendance');
        expect(ids).not.toContain('accounting');
        expect(ids).not.toContain('contacts');
    });

    it('без учёта времени скрывает timeTracking', () => {
        const items = getVisibleAppNavItems(user({ role: 'Юрист', time_tracking_role: null }), false);
        expect(items.map((i) => i.id)).not.toContain('timeTracking');
    });

    it('APP_NAV_DEFINITIONS покрывает все ключевые модули', () => {
        expect(APP_NAV_DEFINITIONS.length).toBeGreaterThanOrEqual(15);
        const ids = new Set(APP_NAV_DEFINITIONS.map((d) => d.id));
        expect(ids.has('home')).toBe(true);
        expect(ids.has('kostaDaily')).toBe(true);
        expect(ids.has('contacts')).toBe(true);
    });
});
