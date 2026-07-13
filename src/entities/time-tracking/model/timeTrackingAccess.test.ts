import { describe, expect, it } from 'vitest';
import type { User } from '@entities/user';
import {
    canAccessTimeTracking,
    canViewTimeTrackingReports,
    getVisibleTimeTrackingTabs,
    hasFullTimeTrackingTabs,
    resolveInitialTimeTab,
} from './timeTrackingAccess';

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

describe('timeTrackingAccess', () => {
    it('canAccessTimeTracking для user и manager', () => {
        expect(canAccessTimeTracking(user({ role: 'X', time_tracking_role: 'user' }))).toBe(true);
        expect(canAccessTimeTracking(user({ role: 'X', time_tracking_role: 'manager' }))).toBe(true);
        expect(canAccessTimeTracking(user({ role: 'X', time_tracking_role: null }))).toBe(false);
    });

    it('hasFullTimeTrackingTabs только для manager', () => {
        expect(hasFullTimeTrackingTabs(user({ role: 'X', time_tracking_role: 'manager' }))).toBe(true);
        expect(hasFullTimeTrackingTabs(user({ role: 'X', time_tracking_role: 'user' }))).toBe(false);
    });

    it('getVisibleTimeTrackingTabs — user видит 2 вкладки, manager — все', () => {
        const u = user({ role: 'X', time_tracking_role: 'user' });
        expect(getVisibleTimeTrackingTabs(u)).toEqual(['timesheet', 'expenses']);
        const m = user({ role: 'X', time_tracking_role: 'manager' });
        expect(getVisibleTimeTrackingTabs(m).length).toBeGreaterThan(2);
    });

    it('canViewTimeTrackingReports — false только при явном запрете', () => {
        expect(canViewTimeTrackingReports(user({ role: 'X', time_tracking_role: 'user' }))).toBe(true);
        expect(canViewTimeTrackingReports(user({
            role: 'X',
            time_tracking_role: 'user',
            permissions: { v: 1, time_tracking_can_view_reports: false },
        }))).toBe(false);
    });

    it('resolveInitialTimeTab сохраняет допустимую вкладку', () => {
        const u = user({ role: 'X', time_tracking_role: 'user' });
        expect(resolveInitialTimeTab(u, 'expenses')).toBe('expenses');
        expect(resolveInitialTimeTab(u, 'reports')).toBe('timesheet');
    });
});
