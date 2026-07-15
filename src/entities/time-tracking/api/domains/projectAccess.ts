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

export function invalidateUserProjectAccessCache(authUserId?: number): void {
    if (authUserId != null) {
        userProjectAccessInflight.delete(Math.round(authUserId));
        return;
    }
    userProjectAccessInflight.clear();
}

export function invalidateProjectAccessPickCache(projectId?: string): void {
    if (projectId != null) {
        projectAccessPickInflight.delete(String(projectId).trim());
        return;
    }
    projectAccessPickInflight.clear();
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
export const PROJECT_ACCESS_FETCH_BATCH = 12;
export async function listUsersWithProjectAccessToProject(projectId: string): Promise<TimeManagerProjectDashboardTeamMember[]> {
    const pid = String(projectId ?? '').trim();
    if (!pid)
        return [];
    const users = await listTimeTrackingUsers();
    const active = users.filter((u) => !u.is_archived && !u.is_blocked);
    const out: TimeManagerProjectDashboardTeamMember[] = [];
    for (let i = 0; i < active.length; i += PROJECT_ACCESS_FETCH_BATCH) {
        const chunk = active.slice(i, i + PROJECT_ACCESS_FETCH_BATCH);
        const chunkResults = await Promise.all(chunk.map(async (u) => {
            try {
                const { projectIds } = await getUserProjectAccess(u.id);
                const hasProject = projectIds.some((x) => String(x).trim() === pid);
                if (!hasProject)
                    return null;
                const name = (u.display_name?.trim() || u.email || `Пользователь ${u.id}`).trim();
                return {
                    userId: String(u.id),
                    name,
                    hours: 0,
                    billableHours: 0,
                    nonBillableHours: 0,
                } satisfies TimeManagerProjectDashboardTeamMember;
            }
            catch {
                return null;
            }
        }));
        for (const r of chunkResults) {
            if (r)
                out.push(r);
        }
    }
    out.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    return out;
}

export type ProjectPartnerAccessRow = {
    authUserId: number;
    displayName: string;
    position: string;
};

export async function listProjectAccessPickRows(
    projectId: string,
    includeUser: (u: TimeTrackingUserRow) => boolean,
): Promise<ProjectPartnerAccessRow[]> {
    const pid = String(projectId ?? '').trim();
    if (!pid)
        return [];
    const users = await listTimeTrackingUsers();
    const candidates = users.filter((u) => !u.is_archived && !u.is_blocked && includeUser(u));
    const out: ProjectPartnerAccessRow[] = [];
    for (let i = 0; i < candidates.length; i += PROJECT_ACCESS_FETCH_BATCH) {
        const chunk = candidates.slice(i, i + PROJECT_ACCESS_FETCH_BATCH);
        const chunkResults = await Promise.all(chunk.map(async (u) => {
            try {
                const { projectIds } = await getUserProjectAccess(u.id);
                const hasProject = projectIds.some((x) => String(x).trim() === pid);
                if (!hasProject)
                    return null;
                const displayName = (u.display_name?.trim() || u.email || `Пользователь ${u.id}`).trim();
                const position = (u.position?.trim() ?? '').trim();
                return {
                    authUserId: u.id,
                    displayName,
                    position,
                } satisfies ProjectPartnerAccessRow;
            }
            catch {
                return null;
            }
        }));
        for (const r of chunkResults) {
            if (r)
                out.push(r);
        }
    }
    out.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru', { sensitivity: 'base' }));
    return out;
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
            const accessFallback = await listProjectAccessPickRows(pid, () => true);
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
        listProjectAccessPickRows(pid, () => true).catch(() => [] as ProjectPartnerAccessRow[]),
        listTimeTrackingUsers(),
    ]);
    const partnerIds = new Set(users
        .filter((u) => !u.is_archived && !u.is_blocked && isPartnerOrgRole(u.role, u.position))
        .map((u) => u.id));
    const accessPartners = members.filter((m) => partnerIds.has(m.authUserId));
    return listProjectPartnersFromProjectDefinition(pid, accessPartners);
}
