import type { User } from '@entities/user';
import type { TimeTabId } from '@entities/time-tracking/model/types';
import { TABS } from '@entities/time-tracking/model/constants';
import { canManageTimeManagerClients } from '@entities/time-tracking/model/timeManagerClientsAccess';
export const TIME_TRACKING_LIMITED_TAB_IDS: readonly TimeTabId[] = ['timesheet', 'expenses'];
export const TIME_TRACKING_ALL_TAB_IDS: TimeTabId[] = TABS.map(t => t.id);
export function hasFullTimeTrackingTabs(user: User | null | undefined): boolean {
    return user?.time_tracking_role === 'manager';
}

export function canOverrideReportPreviewWeeklyLock(user: User | null | undefined): boolean {
    if (!user)
        return false;
    if (user.time_tracking_role === 'manager')
        return true;
    return canManageTimeManagerClients(user.role);
}
export function canAccessTimeTracking(user: User | null | undefined): boolean {
    if (!user)
        return false;
    const tt = user.time_tracking_role;
    return tt === 'manager' || tt === 'user';
}
export function getVisibleTimeTrackingTabs(user: User | null | undefined): TimeTabId[] {
    if (!user)
        return [];
    if (!canAccessTimeTracking(user))
        return [];
    if (hasFullTimeTrackingTabs(user))
        return [...TIME_TRACKING_ALL_TAB_IDS];
    if (user.time_tracking_role === 'user')
        return [...TIME_TRACKING_LIMITED_TAB_IDS];
    return [];
}
export function getVisibleTimeTrackingTabDefs(user: User | null | undefined): {
    id: TimeTabId;
    label: string;
}[] {
    const ids = new Set(getVisibleTimeTrackingTabs(user));
    return TABS.filter(t => ids.has(t.id));
}
export function resolveInitialTimeTab(user: User | null | undefined, saved: TimeTabId | null): TimeTabId {
    const visible = getVisibleTimeTrackingTabs(user);
    if (visible.length === 0)
        return 'timesheet';
    if (saved && visible.includes(saved))
        return saved;
    return visible[0];
}
