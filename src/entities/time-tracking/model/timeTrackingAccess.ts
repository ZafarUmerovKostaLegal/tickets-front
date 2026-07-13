import type { User } from '@entities/user';
import type { TimeTabId } from '@entities/time-tracking/model/types';
import { TABS } from '@entities/time-tracking/model/constants';
import { canManageTimeManagerClients } from '@entities/time-tracking/model/timeManagerClientsAccess';
import { isPartnerOrgRole, normalizeOrgRoleKey } from '@shared/lib/orgRoles';
export const TIME_TRACKING_LIMITED_TAB_IDS: readonly TimeTabId[] = ['timesheet', 'expenses'];
export const TIME_TRACKING_ALL_TAB_IDS: TimeTabId[] = TABS.map(t => t.id);
export function hasFullTimeTrackingTabs(user: User | null | undefined): boolean {
    return user?.time_tracking_role === 'manager';
}

export function canViewTimeTrackingReports(user: User | null | undefined): boolean {
    if (!user)
        return false;
    const flag = user.permissions?.['time_tracking_can_view_reports'];
    return flag !== false;
}

export function canViewTimeTrackingStatistics(user: User | null | undefined): boolean {
    return canViewTimeTrackingReports(user);
}

export function canManageTimeTrackingOrgUsers(user: User | null | undefined): boolean {
    if (!user)
        return false;
    if (user.permissions?.time_tracking_can_manage_org_users === true)
        return true;
    return canManageTimeManagerClients(user.role);
}

export function canManageTimeTrackingClients(user: User | null | undefined): boolean {
    if (!user)
        return false;
    if (user.permissions?.time_tracking_can_manage_org_users === true)
        return true;
    return canManageTimeManagerClients(user.role);
}

export function canManageHourlyRates(user: User | null | undefined): boolean {
    if (!user)
        return false;
    if (user.permissions?.hourly_rates_can_manage === true)
        return true;
    return canManageTimeManagerClients(user.role);
}

function isAdministratorOrgRole(role: string | null | undefined): boolean {
    const rk = normalizeOrgRoleKey(role);
    if (!rk)
        return false;
    return rk.includes('администратор') || rk.includes('administrator') || rk === 'admin';
}

export function canViewAllForReviewReports(user: User | null | undefined): boolean {
    if (!user || !canViewTimeTrackingReports(user))
        return false;
    if (hasFullTimeTrackingTabs(user))
        return true;
    if (canManageTimeTrackingOrgUsers(user))
        return true;
    if (isAdministratorOrgRole(user.role))
        return true;
    if (isPartnerOrgRole(user.role, user.position))
        return true;
    return false;
}

export function canOverrideReportPreviewWeeklyLock(user: User | null | undefined): boolean {
    if (!user)
        return false;
    if (user.time_tracking_role === 'manager')
        return true;
    if (isAdministratorOrgRole(user.role) || canManageTimeManagerClients(user.role))
        return true;
    if (isPartnerOrgRole(user.role, user.position))
        return true;
    if (user.permissions?.time_tracking_can_manage_time_entries_scope === true)
        return true;
    return false;
}

export function canGrantTimeEntryEditUnlock(viewer: User | null | undefined, targetAuthUserId: number): boolean {
    if (!viewer || !Number.isFinite(targetAuthUserId))
        return false;
    if (!canOverrideReportPreviewWeeklyLock(viewer))
        return false;
    const ttMgrOnly = viewer.time_tracking_role === 'manager' && !canManageTimeManagerClients(viewer.role);
    if (ttMgrOnly && targetAuthUserId === viewer.id)
        return false;
    return true;
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
    if (hasFullTimeTrackingTabs(user)) {
        const all = [...TIME_TRACKING_ALL_TAB_IDS];
        if (!canViewTimeTrackingReports(user))
            return all.filter((id) => id !== 'reports');
        return all;
    }
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
