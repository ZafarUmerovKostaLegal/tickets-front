import { apiFetch } from '@shared/api';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { reportCacheInvalidateAll as _invalidateReportCache } from '../../lib/reportApiCache';
import { throwIfNotOk } from './httpShared';
import { listTimeTrackingUsers, type TimeTrackingUserRow } from './usersAndRates';
import {
    listAllClientProjectsMerged,
    type TimeManagerClientProjectRow,
    type TimeManagerProjectDashboardTeamMember,
} from './projects';

export type UserProjectAccessOut = {
    projectIds: string[];
};
export function parseUserProjectAccess(raw: unknown): UserProjectAccessOut {
    if (!raw || typeof raw !== 'object')
        return { projectIds: [] };
    const o = raw as {
        projectIds?: unknown;
        project_ids?: unknown;
    };
    const ids = o.projectIds ?? o.project_ids;
    if (!Array.isArray(ids))
        return { projectIds: [] };
    return { projectIds: ids.map(String) };
}

export const userProjectAccessInflight = new Map<number, Promise<UserProjectAccessOut>>();
export const projectAccessPickInflight = new Map<string, Promise<ProjectPartnerAccessRow[]>>();
/** One reverse lookup per project instead of N× GET /users/{id}/project-access. */
const projectAssigneesInflight = new Map<string, Promise<ProjectPartnerAccessRow[]>>();

export function invalidateUserProjectAccessCache(authUserId?: number): void {
    if (authUserId != null) {
        userProjectAccessInflight.delete(Math.round(authUserId));
        return;
    }
    userProjectAccessInflight.clear();
}

export function invalidateProjectAccessPickCache(projectId?: string): void {
    if (projectId != null) {
        const key = String(projectId).trim();
        projectAccessPickInflight.delete(key);
        projectAssigneesInflight.delete(key);
        return;
    }
    projectAccessPickInflight.clear();
    projectAssigneesInflight.clear();
}

export async function fetchUserProjectAccess(authUserId: number): Promise<UserProjectAccessOut> {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/project-access`);
    await throwIfNotOk(res);
    return parseUserProjectAccess(await res.json());
}

export async function getUserProjectAccess(authUserId: number): Promise<UserProjectAccessOut> {
    const id = Math.round(authUserId);
    if (!Number.isFinite(id) || id <= 0)
        return { projectIds: [] };
    let pending = userProjectAccessInflight.get(id);
    if (!pending) {
        pending = fetchUserProjectAccess(id).catch((err) => {
            userProjectAccessInflight.delete(id);
            throw err;
        });
        userProjectAccessInflight.set(id, pending);
    }
    return pending;
}

export type PutUserProjectAccessOptions = {
    projectBillableHourlyAmountsByProjectId?: Record<string, string | number>;
};

export async function putUserProjectAccess(
    authUserId: number,
    projectIds: string[],
    options?: PutUserProjectAccessOptions,
): Promise<UserProjectAccessOut> {
    const body: Record<string, unknown> = { projectIds };
    const rates = options?.projectBillableHourlyAmountsByProjectId;
    if (rates && Object.keys(rates).length > 0) {
        body.projectBillableHourlyAmountsByProjectId = rates;
    }
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/project-access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    if (rates && Object.keys(rates).length > 0)
        _invalidateReportCache();
    invalidateUserProjectAccessCache(authUserId);
    invalidateProjectAccessPickCache();
    return parseUserProjectAccess(await res.json());
}

export type ProjectPartnerAccessRow = {
    authUserId: number;
    displayName: string;
    position: string;
};

function parseProjectAssigneesPayload(raw: unknown): ProjectPartnerAccessRow[] {
    const root = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const list = Array.isArray(raw)
        ? raw
        : (root.assignees ?? root.items ?? root.users);
    if (!Array.isArray(list))
        return [];
    const out: ProjectPartnerAccessRow[] = [];
    const seen = new Set<number>();
    for (const item of list) {
        if (!item || typeof item !== 'object')
            continue;
        const o = item as Record<string, unknown>;
        const authUserId = Number(o.authUserId ?? o.auth_user_id);
        if (!Number.isFinite(authUserId) || authUserId <= 0 || seen.has(authUserId))
            continue;
        if (o.isArchived === true || o.is_archived === true)
            continue;
        if (o.isBlocked === true || o.is_blocked === true)
            continue;
        seen.add(authUserId);
        const displayName = String(o.displayName ?? o.display_name ?? o.email ?? `Пользователь ${authUserId}`).trim()
            || `Пользователь ${authUserId}`;
        const position = String(o.position ?? '').trim();
        out.push({ authUserId, displayName, position });
    }
    out.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru', { sensitivity: 'base' }));
    return out;
}

/** Single reverse lookup: users who have access to the project. */
export async function fetchProjectAccessUsers(projectId: string): Promise<ProjectPartnerAccessRow[]> {
    const pid = String(projectId ?? '').trim();
    if (!pid)
        return [];
    let pending = projectAssigneesInflight.get(pid);
    if (!pending) {
        pending = (async () => {
            const res = await apiFetch(
                `/api/v1/time-tracking/projects/${encodeURIComponent(pid)}/time-tracking-assignees`,
            );
            await throwIfNotOk(res);
            return parseProjectAssigneesPayload(await res.json());
        })().catch((err) => {
            projectAssigneesInflight.delete(pid);
            throw err;
        });
        projectAssigneesInflight.set(pid, pending);
    }
    return pending;
}

export async function listUsersWithProjectAccessToProject(projectId: string): Promise<TimeManagerProjectDashboardTeamMember[]> {
    const rows = await fetchProjectAccessUsers(projectId);
    return rows.map((r) => ({
        userId: String(r.authUserId),
        name: r.displayName,
        hours: 0,
        billableHours: 0,
        nonBillableHours: 0,
    }));
}

export async function listProjectAccessPickRows(
    projectId: string,
    includeUser?: (u: TimeTrackingUserRow) => boolean,
): Promise<ProjectPartnerAccessRow[]> {
    const rows = await fetchProjectAccessUsers(projectId);
    if (!includeUser)
        return rows;
    const users = await listTimeTrackingUsers().catch(() => [] as TimeTrackingUserRow[]);
    if (users.length === 0)
        return rows;
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.filter((r) => {
        const u = byId.get(r.authUserId);
        return u ? includeUser(u) : true;
    });
}

export async function findTimeManagerClientProjectById(projectId: string): Promise<TimeManagerClientProjectRow | null> {
    const pid = projectId.trim();
    if (!pid)
        return null;
    const rows = await listAllClientProjectsMerged(true);
    return rows.find((p) => String(p.id ?? '').trim() === pid) ?? null;
}

export function readProjectPartnerAuthUserIdsFromRow(p: TimeManagerClientProjectRow): number[] {
    const raw = p.partnerAuthUserIds ?? p.partner_auth_user_ids ?? [];
    return raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
}

export function readProjectTeamAuthUserIdsFromRow(p: TimeManagerClientProjectRow): number[] {
    const partnerRaw = p.partnerAuthUserIds ?? p.partner_auth_user_ids ?? [];
    const participantRaw = p.participantAuthUserIds ?? p.participant_auth_user_ids ?? [];
    const ids = [...partnerRaw, ...participantRaw].map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    return [...new Set(ids)];
}

export function projectPartnerAccessRowsFromAuthUserIds(
    authUserIds: readonly number[],
    users: readonly TimeTrackingUserRow[],
): ProjectPartnerAccessRow[] {
    const userById = new Map(users.map((u) => [u.id, u]));
    const out: ProjectPartnerAccessRow[] = [];
    const seen = new Set<number>();
    for (const rawId of authUserIds) {
        const id = Number(rawId);
        if (!Number.isFinite(id) || id <= 0 || seen.has(id))
            continue;
        seen.add(id);
        const u = userById.get(id);
        const displayName = (u?.display_name?.trim() || u?.email || `Пользователь ${id}`).trim();
        const position = (u?.position?.trim() ?? '').trim();
        out.push({ authUserId: id, displayName, position });
    }
    out.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru', { sensitivity: 'base' }));
    return out;
}

export function mergeProjectPartnerAccessRows(
    primary: readonly ProjectPartnerAccessRow[],
    extra: readonly ProjectPartnerAccessRow[],
): ProjectPartnerAccessRow[] {
    const byId = new Map<number, ProjectPartnerAccessRow>();
    for (const row of extra) {
        if (row.authUserId > 0)
            byId.set(row.authUserId, row);
    }
    for (const row of primary) {
        if (row.authUserId > 0)
            byId.set(row.authUserId, row);
    }
    return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru', { sensitivity: 'base' }));
}

export async function listProjectTeamMembersFromProjectDefinition(
    projectId: string,
    accessFallback: ProjectPartnerAccessRow[],
): Promise<ProjectPartnerAccessRow[]> {
    const project = await findTimeManagerClientProjectById(projectId);
    if (!project)
        return accessFallback;
    const users = await listTimeTrackingUsers();
    const fromProject = projectPartnerAccessRowsFromAuthUserIds(readProjectTeamAuthUserIdsFromRow(project), users);
    if (fromProject.length === 0)
        return accessFallback;
    return mergeProjectPartnerAccessRows(fromProject, accessFallback);
}

export async function listProjectPartnersFromProjectDefinition(
    projectId: string,
    accessPartnersFallback: ProjectPartnerAccessRow[],
): Promise<ProjectPartnerAccessRow[]> {
    const project = await findTimeManagerClientProjectById(projectId);
    if (!project)
        return accessPartnersFallback;
    const users = await listTimeTrackingUsers();
    const fromProject = projectPartnerAccessRowsFromAuthUserIds(readProjectPartnerAuthUserIdsFromRow(project), users);
    if (fromProject.length === 0)
        return accessPartnersFallback;
    return mergeProjectPartnerAccessRows(fromProject, accessPartnersFallback);
}

export async function listUsersWithProjectAccessToProjectForPick(projectId: string): Promise<ProjectPartnerAccessRow[]> {
    const pid = String(projectId ?? '').trim();
    if (!pid)
        return [];
    let pending = projectAccessPickInflight.get(pid);
    if (!pending) {
        pending = (async () => {
            const accessFallback = await listProjectAccessPickRows(pid);
            return listProjectTeamMembersFromProjectDefinition(pid, accessFallback);
        })().catch((err) => {
            projectAccessPickInflight.delete(pid);
            throw err;
        });
        projectAccessPickInflight.set(pid, pending);
    }
    return pending;
}

export async function listPartnerUsersWithProjectAccessToProject(projectId: string): Promise<ProjectPartnerAccessRow[]> {
    const pid = String(projectId ?? '').trim();
    if (!pid)
        return [];
    const [members, users] = await Promise.all([
        fetchProjectAccessUsers(pid).catch(() => [] as ProjectPartnerAccessRow[]),
        listTimeTrackingUsers(),
    ]);
    const partnerIds = new Set(users
        .filter((u) => !u.is_archived && !u.is_blocked && isPartnerOrgRole(u.role, u.position))
        .map((u) => u.id));
    const accessPartners = members.filter((m) => partnerIds.has(m.authUserId));
    return listProjectPartnersFromProjectDefinition(pid, accessPartners);
}
