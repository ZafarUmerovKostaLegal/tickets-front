import type { StatisticsLaborDetailRow, StatisticsLaborKpi, StatisticsLaborScope, StatisticsLaborSort, StatisticsLaborSortKey } from './statisticsLaborTypes';
import type { User } from '@entities/user/model/types';
import {
    canAccessAdminOnlyModules,
    isOfficeManagerRole,
    isPartnerOrgRole,
    normalizeOrgRoleKey,
} from '@shared/lib/orgRoles';

export function getStatisticsLaborScope(user: User | null): StatisticsLaborScope {
    if (!user)
        return { mode: 'all' };
    const perms = user.permissions;
    if (perms?.time_tracking_can_view_time_entries_scope)
        return { mode: 'all' };
    if (canAccessAdminOnlyModules(user.role))
        return { mode: 'all' };
    const roleKey = normalizeOrgRoleKey(user.role);
    if (isOfficeManagerRole(user.role) || roleKey.includes('it'))
        return { mode: 'all' };
    if (isPartnerOrgRole(user.role, user.position))
        return { mode: 'partner', partnerId: String(user.id) };
    return { mode: 'lawyer', lawyerId: String(user.id) };
}

export function applyStatisticsLaborScope(
    rows: StatisticsLaborDetailRow[],
    scope: StatisticsLaborScope,
): StatisticsLaborDetailRow[] {
    
    if (scope.mode === 'lawyer' && scope.lawyerId)
        return rows.filter((r) => r.lawyer_id === scope.lawyerId);
    return rows;
}

export function computeStatisticsLaborKpi(rows: StatisticsLaborDetailRow[]): StatisticsLaborKpi {
    const totalHours = rows.reduce((s, r) => s + r.hours, 0);
    const billableHours = rows.reduce((s, r) => s + r.billable_hours, 0);
    const paidAmount = rows.reduce((s, r) => s + r.payment, 0);
    const billableAmount = rows.reduce((s, r) => s + (r.billable_amount || 0), 0);
    const paidCurrency = rows.find((r) => r.payment > 0)?.currency
        ?? rows.find((r) => (r.billable_amount || 0) > 0)?.currency
        ?? 'USD';
    const ratePerHour = billableHours > 0 ? paidAmount / billableHours : 0;
    const accruedRatePerHour = billableHours > 0 ? billableAmount / billableHours : 0;
    return {
        totalHours,
        billableHours,
        nonBillableHours: Math.max(0, totalHours - billableHours),
        paidAmount,
        paidCurrency,
        ratePerHour,
        billableAmount,
        billableCurrency: paidCurrency,
        accruedRatePerHour,
    };
}

function rowRate(row: StatisticsLaborDetailRow): number {
    return row.billable_hours > 0 ? row.payment / row.billable_hours : 0;
}

function sortValue(row: StatisticsLaborDetailRow, key: StatisticsLaborSortKey): string | number {
    if (key === 'rate')
        return rowRate(row);
    if (key === 'hours')
        return row.hours;
    if (key === 'payment')
        return row.payment;
    if (key === 'billable_amount')
        return row.billable_amount || 0;
    return String(row[key] ?? '');
}

export function sortStatisticsLaborRows(
    rows: StatisticsLaborDetailRow[],
    sort: StatisticsLaborSort,
): StatisticsLaborDetailRow[] {
    const sorted = [...rows];
    sorted.sort((a, b) => {
        const av = sortValue(a, sort.key);
        const bv = sortValue(b, sort.key);
        let cmp = 0;
        if (typeof av === 'number' && typeof bv === 'number')
            cmp = av - bv;
        else
            cmp = String(av).localeCompare(String(bv), 'ru', { sensitivity: 'base' });
        return sort.dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
}

export function filterStatisticsLaborRowsByQuery(
    rows: StatisticsLaborDetailRow[],
    query: string,
): StatisticsLaborDetailRow[] {
    const q = query.trim().toLowerCase();
    if (!q)
        return rows;
    return rows.filter((row) => {
        const haystack = [
            row.partner_name,
            row.team_name,
            row.lawyer_name,
            row.client_name,
            row.project_name,
            row.task_name,
            row.work_type,
            row.period_label,
        ].join(' ').toLowerCase();
        return haystack.includes(q);
    });
}
