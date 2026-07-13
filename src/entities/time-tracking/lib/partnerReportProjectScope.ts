import { isPartnerOrgRole, normalizeOrgRoleKey } from '@shared/lib/orgRoles';
import type {
    TimeManagerClientProjectRow,
    TimeRowClients,
    TimeRowTasks,
    TimeRowTeam,
    TimeReportRow,
    RUBTime,
    TimeReportEntryLogItem,
    ExpRowClients,
    ExpRowProjects,
    ExpRowCategories,
    ExpRowTeam,
    RUBExpense,
    UninvoicedRow,
    BudgetRow,
} from '../api';
import type { GroupByV2, ReportTypeV2 } from '../model/reportsPanelConfig';

export function shouldScopeReportsToPartnerProjects(role?: string | null, position?: string | null): boolean {
    const k = normalizeOrgRoleKey(role);
    if (k.includes('администратор'))
        return false;
    return isPartnerOrgRole(role, position);
}

function readPartnerIdsOnProject(p: TimeManagerClientProjectRow): number[] {
    const raw = p.partnerAuthUserIds ?? p.partner_auth_user_ids ?? [];
    return raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
}

function readParticipantIdsOnProject(p: TimeManagerClientProjectRow): number[] {
    const raw = p.participantAuthUserIds ?? p.participant_auth_user_ids ?? [];
    return raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
}

export function readProjectPartnerAuthUserIds(p: TimeManagerClientProjectRow): number[] {
    return readPartnerIdsOnProject(p);
}

export function readProjectParticipantAuthUserIds(p: TimeManagerClientProjectRow): number[] {
    return readParticipantIdsOnProject(p);
}

export function readProjectTeamAuthUserIds(p: TimeManagerClientProjectRow): number[] {
    return [...new Set([...readPartnerIdsOnProject(p), ...readParticipantIdsOnProject(p)])];
}

export function collectMyParticipatingProjectIds(
    projects: TimeManagerClientProjectRow[],
    authUserId: number,
    accessProjectIds: string[] = [],
): Set<string> {
    const ids = new Set<string>();
    for (const p of projects) {
        const pid = String(p.id ?? '').trim();
        if (!pid)
            continue;
        const isPartner = readPartnerIdsOnProject(p).includes(authUserId);
        const isParticipant = readParticipantIdsOnProject(p).includes(authUserId);
        if (isPartner || isParticipant)
            ids.add(pid);
    }
    for (const raw of accessProjectIds) {
        const pid = String(raw).trim();
        if (pid)
            ids.add(pid);
    }
    return ids;
}

export function collectPartnerProjectIds(projects: TimeManagerClientProjectRow[], authUserId: number): Set<string> {
    return collectMyParticipatingProjectIds(projects, authUserId);
}

export function partnerProjectClientIds(projects: TimeManagerClientProjectRow[], allowedProjectIds: Set<string>): Set<string> {
    const ids = new Set<string>();
    for (const p of projects) {
        const pid = String(p.id ?? '').trim();
        if (!pid || !allowedProjectIds.has(pid))
            continue;
        const cid = String(p.client_id ?? '').trim();
        if (cid)
            ids.add(cid);
    }
    return ids;
}

function entryProjectId(entry: TimeReportEntryLogItem): string {
    return String(entry.project_id ?? '').trim();
}

function filterRubTimeUserByProjects(user: RUBTime, allowedProjectIds: Set<string>): RUBTime | null {
    const entries = user.entries;
    if (Array.isArray(entries) && entries.length > 0) {
        const filtered = entries.filter((e) => {
            const pid = entryProjectId(e);
            return pid && allowedProjectIds.has(pid);
        });
        if (!filtered.length)
            return null;
        let totalHours = 0;
        let billableHours = 0;
        let billableAmount = 0;
        for (const e of filtered) {
            totalHours += Number(e.hours ?? 0);
            billableHours += Number(e.billable_hours ?? e.hours ?? 0);
            billableAmount += Number(e.billable_amount ?? 0);
        }
        return {
            ...user,
            entries: filtered,
            entries_total: filtered.length,
            entries_truncated: false,
            total_hours: totalHours,
            billable_hours: billableHours,
            billable_amount: billableAmount,
        };
    }
    const breakdown = user.project_breakdown;
    if (Array.isArray(breakdown) && breakdown.length > 0) {
        const filtered = breakdown.filter((e) => {
            const pid = entryProjectId(e);
            return pid && allowedProjectIds.has(pid);
        });
        if (!filtered.length)
            return null;
        let totalHours = 0;
        let billableHours = 0;
        let billableAmount = 0;
        for (const e of filtered) {
            totalHours += Number(e.hours ?? 0);
            billableHours += Number(e.billable_hours ?? e.hours ?? 0);
            billableAmount += Number(e.billable_amount ?? 0);
        }
        return {
            ...user,
            project_breakdown: filtered,
            total_hours: totalHours,
            billable_hours: billableHours,
            billable_amount: billableAmount,
        };
    }
    return null;
}

function filterTimeClientRow(row: TimeRowClients, allowedProjectIds: Set<string>): TimeRowClients | null {
    const users = row.users
        .map((u) => filterRubTimeUserByProjects(u, allowedProjectIds))
        .filter((u): u is RUBTime => u != null);
    if (!users.length)
        return null;
    return {
        ...row,
        users,
        total_hours: users.reduce((s, u) => s + (u.total_hours ?? 0), 0),
        billable_hours: users.reduce((s, u) => s + (u.billable_hours ?? 0), 0),
        billable_amount: users.reduce((s, u) => s + (u.billable_amount ?? 0), 0),
    };
}

function filterRubExpenseUserByProjects(user: RUBExpense, allowedProjectIds: Set<string>): RUBExpense | null {
    const pid = String(user.project_id ?? '').trim();
    if (pid && !allowedProjectIds.has(pid))
        return null;
    return user;
}

function filterExpenseClientRow(row: ExpRowClients, allowedProjectIds: Set<string>, allowedClientIds: Set<string> | null): ExpRowClients | null {
    if (allowedClientIds && !allowedClientIds.has(String(row.client_id ?? '').trim()))
        return null;
    const users = row.users
        .map((u) => filterRubExpenseUserByProjects(u, allowedProjectIds))
        .filter((u): u is RUBExpense => u != null);
    if (!users.length)
        return null;
    return {
        ...row,
        users,
        total_amount: users.reduce((s, u) => s + (u.total_amount ?? 0), 0),
        billable_amount: users.reduce((s, u) => s + (u.billable_amount ?? 0), 0),
    };
}

function rowHasAllowedProject(row: { project_id?: string | null }, allowedProjectIds: Set<string>): boolean {
    const pid = String(row.project_id ?? '').trim();
    return Boolean(pid && allowedProjectIds.has(pid));
}

export function filterReportRowsByPartnerProjects<T>(
    rows: T[],
    allowedProjectIds: Set<string>,
    allowedClientIds: Set<string> | null,
    reportType: ReportTypeV2,
    groupBy: GroupByV2,
): T[] {
    if (!allowedProjectIds.size)
        return [];

    if (reportType === 'time') {
        if (groupBy === 'projects') {
            return rows.filter((r) => rowHasAllowedProject(r as { project_id?: string }, allowedProjectIds));
        }
        if (groupBy === 'tasks') {
            return rows.filter((r) => rowHasAllowedProject(r as TimeRowTasks, allowedProjectIds));
        }
        if (groupBy === 'clients') {
            return rows
                .map((r) => filterTimeClientRow(r as TimeRowClients, allowedProjectIds))
                .filter((r): r is TimeRowClients => r != null) as T[];
        }
        if (groupBy === 'team') {
            return rows.filter((r) => {
                const row = r as TimeRowTeam & { users?: RUBTime[] };
                if (Array.isArray(row.users) && row.users.length > 0) {
                    const users = row.users
                        .map((u) => filterRubTimeUserByProjects(u, allowedProjectIds))
                        .filter((u): u is RUBTime => u != null);
                    return users.length > 0;
                }
                return false;
            });
        }
    }

    if (reportType === 'expenses') {
        if (groupBy === 'projects') {
            return rows.filter((r) => rowHasAllowedProject(r as ExpRowProjects, allowedProjectIds));
        }
        if (groupBy === 'clients') {
            return rows
                .map((r) => filterExpenseClientRow(r as ExpRowClients, allowedProjectIds, allowedClientIds))
                .filter((r): r is ExpRowClients => r != null) as T[];
        }
        if (groupBy === 'categories') {
            return rows
                .map((r) => {
                    const row = r as ExpRowCategories;
                    const users = row.users
                        .map((u) => filterRubExpenseUserByProjects(u, allowedProjectIds))
                        .filter((u): u is RUBExpense => u != null);
                    if (!users.length)
                        return null;
                    return {
                        ...row,
                        users,
                        total_amount: users.reduce((s, u) => s + (u.total_amount ?? 0), 0),
                        billable_amount: users.reduce((s, u) => s + (u.billable_amount ?? 0), 0),
                    };
                })
                .filter((r): r is ExpRowCategories => r != null) as T[];
        }
        if (groupBy === 'team') {
            return rows.filter((r) => {
                const row = r as ExpRowTeam & { users?: RUBExpense[] };
                if (!Array.isArray(row.users))
                    return false;
                return row.users.some((u) => {
                    const pid = String(u.project_id ?? '').trim();
                    return !pid || allowedProjectIds.has(pid);
                });
            });
        }
    }

    if (reportType === 'uninvoiced') {
        return rows.filter((r) => rowHasAllowedProject(r as UninvoicedRow, allowedProjectIds));
    }

    if (reportType === 'project-budget') {
        return rows.filter((r) => rowHasAllowedProject(r as BudgetRow, allowedProjectIds));
    }

    return rows;
}

export type { TimeReportRow };
