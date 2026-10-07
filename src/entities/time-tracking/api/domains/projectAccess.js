import { apiFetch } from '@shared/api';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { reportCacheInvalidateAll as _invalidateReportCache } from '../../lib/reportApiCache';
import { throwIfNotOk } from './httpShared';
import { listTimeTrackingUsers } from './usersAndRates';
import { listAllClientProjectsMerged, } from './projects';
export function parseUserProjectAccess(raw) {
    if (!raw || typeof raw !== 'object')
        return { projectIds: [] };
    const o = raw;
    const ids = o.projectIds ?? o.project_ids;
    if (!Array.isArray(ids))
        return { projectIds: [] };
    return { projectIds: ids.map(String) };
}
export const userProjectAccessInflight = new Map();
export const projectAccessPickInflight = new Map();
/** One reverse lookup per project instead of N× GET /users/{id}/project-access. */
const projectAssigneesInflight = new Map();
export function invalidateUserProjectAccessCache(authUserId) {
    if (authUserId != null) {
        userProjectAccessInflight.delete(Math.round(authUserId));
        return;
    }
    userProjectAccessInflight.clear();
}
export function invalidateProjectAccessPickCache(projectId) {
    if (projectId != null) {
        const key = String(projectId).trim();
        projectAccessPickInflight.delete(key);
        projectAssigneesInflight.delete(key);
        return;
    }
    projectAccessPickInflight.clear();
    projectAssigneesInflight.clear();
}
export async function fetchUserProjectAccess(authUserId) {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/project-access`);
    await throwIfNotOk(res);
    return parseUserProjectAccess(await res.json());
}
export async function getUserProjectAccess(authUserId) {
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
export async function putUserProjectAccess(authUserId, projectIds, options) {
    const body = { projectIds };
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
function parseProjectAssigneesPayload(raw) {
    const root = raw && typeof raw === 'object' ? raw : {};
    const list = Array.isArray(raw)
        ? raw
        : (root.assignees ?? root.items ?? root.users);
    if (!Array.isArray(list))
        return [];
    const out = [];
    const seen = new Set();
    for (const item of list) {
        if (!item || typeof item !== 'object')
            continue;
        const o = item;
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
export async function fetchProjectAccessUsers(projectId) {
    const pid = String(projectId ?? '').trim();
    if (!pid)
        return [];
    let pending = projectAssigneesInflight.get(pid);
    if (!pending) {
        pending = (async () => {
            const res = await apiFetch(`/api/v1/time-tracking/projects/${encodeURIComponent(pid)}/time-tracking-assignees`);
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
export async function listUsersWithProjectAccessToProject(projectId) {
    const rows = await fetchProjectAccessUsers(projectId);
    return rows.map((r) => ({
        userId: String(r.authUserId),
        name: r.displayName,
        hours: 0,
        billableHours: 0,
        nonBillableHours: 0,
    }));
}
export async function listProjectAccessPickRows(projectId, includeUser) {
    const rows = await fetchProjectAccessUsers(projectId);
    if (!includeUser)
        return rows;
    const users = await listTimeTrackingUsers().catch(() => []);
    if (users.length === 0)
        return rows;
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.filter((r) => {
        const u = byId.get(r.authUserId);
        return u ? includeUser(u) : true;
    });
}
export async function findTimeManagerClientProjectById(projectId) {
    const pid = projectId.trim();
    if (!pid)
        return null;
    const rows = await listAllClientProjectsMerged(true);
    return rows.find((p) => String(p.id ?? '').trim() === pid) ?? null;
}
export function readProjectPartnerAuthUserIdsFromRow(p) {
    const raw = p.partnerAuthUserIds ?? p.partner_auth_user_ids ?? [];
    return raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
}
export function readProjectTeamAuthUserIdsFromRow(p) {
    const partnerRaw = p.partnerAuthUserIds ?? p.partner_auth_user_ids ?? [];
    const participantRaw = p.participantAuthUserIds ?? p.participant_auth_user_ids ?? [];
    const ids = [...partnerRaw, ...participantRaw].map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
    return [...new Set(ids)];
}
export function projectPartnerAccessRowsFromAuthUserIds(authUserIds, users) {
    const userById = new Map(users.map((u) => [u.id, u]));
    const out = [];
    const seen = new Set();
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
export function mergeProjectPartnerAccessRows(primary, extra) {
    const byId = new Map();
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
export async function listProjectTeamMembersFromProjectDefinition(projectId, accessFallback) {
    const project = await findTimeManagerClientProjectById(projectId);
    if (!project)
        return accessFallback;
    const users = await listTimeTrackingUsers();
    const fromProject = projectPartnerAccessRowsFromAuthUserIds(readProjectTeamAuthUserIdsFromRow(project), users);
    if (fromProject.length === 0)
        return accessFallback;
    return mergeProjectPartnerAccessRows(fromProject, accessFallback);
}
export async function listProjectPartnersFromProjectDefinition(projectId, accessPartnersFallback) {
    const project = await findTimeManagerClientProjectById(projectId);
    if (!project)
        return accessPartnersFallback;
    const users = await listTimeTrackingUsers();
    const fromProject = projectPartnerAccessRowsFromAuthUserIds(readProjectPartnerAuthUserIdsFromRow(project), users);
    if (fromProject.length === 0)
        return accessPartnersFallback;
    return mergeProjectPartnerAccessRows(fromProject, accessPartnersFallback);
}
export async function listUsersWithProjectAccessToProjectForPick(projectId) {
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
export async function listPartnerUsersWithProjectAccessToProject(projectId) {
    const pid = String(projectId ?? '').trim();
    if (!pid)
        return [];
    const [members, users] = await Promise.all([
        fetchProjectAccessUsers(pid).catch(() => []),
        listTimeTrackingUsers(),
    ]);
    const partnerIds = new Set(users
        .filter((u) => !u.is_archived && !u.is_blocked && isPartnerOrgRole(u.role, u.position))
        .map((u) => u.id));
    const accessPartners = members.filter((m) => partnerIds.has(m.authUserId));
    return listProjectPartnersFromProjectDefinition(pid, accessPartners);
}
