import { apiFetch } from '@shared/api';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { absorbTimeEntryRowEditUnlockHint, recordTimeEntryEditUnlockExpiry } from './lib/timeEntryEditUnlockStorage';
import { pickAllowedSnapshotOverrides } from './lib/reportSnapshotOverrides';
import type { User } from '@entities/user';

export type PaginatedResult<T> = {
    items: T[];
    total: number;
    limit: number;
    offset: number;
};
export type TimeTrackingPaginationParams = {
    limit: number;
    offset?: number;
};

function parseTimeTrackingPagedResponse<T>(raw: unknown, mapItem: (item: unknown) => T | null, request: {
    limit: number;
    offset: number;
}): PaginatedResult<T> {
    if (Array.isArray(raw)) {
        const items = raw.map(mapItem).filter((x): x is T => x != null);
        if (request.limit > 0) {
            return {
                items,
                total: Number.POSITIVE_INFINITY,
                limit: request.limit,
                offset: request.offset,
            };
        }
        return {
            items,
            total: items.length,
            limit: request.limit,
            offset: request.offset,
        };
    }
    if (raw && typeof raw === 'object' && 'items' in raw) {
        const o = raw as Record<string, unknown>;
        const arr = o.items;
        if (!Array.isArray(arr)) {
            return {
                items: [],
                total: 0,
                limit: request.limit,
                offset: request.offset,
            };
        }
        const items = arr.map(mapItem).filter((x): x is T => x != null);
        const totalRaw = typeof o.total === 'number' ? o.total : Number(o.total);
        const limitRaw = typeof o.limit === 'number' ? o.limit : Number(o.limit);
        const offsetRaw = typeof o.offset === 'number' ? o.offset : Number(o.offset);
        return {
            items,
            total: Number.isFinite(totalRaw) ? totalRaw : items.length,
            limit: Number.isFinite(limitRaw) ? limitRaw : request.limit,
            offset: Number.isFinite(offsetRaw) ? offsetRaw : request.offset,
        };
    }
    return {
        items: [],
        total: 0,
        limit: request.limit,
        offset: request.offset,
    };
}

function unwrapTimeTrackingListArray(raw: unknown): unknown[] | null {
    if (Array.isArray(raw))
        return raw;
    if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).items))
        return (raw as Record<string, unknown>).items as unknown[];
    return null;
}
const PROJECTS_FOR_EXPENSES_PAGE_SIZE = 500;
export type HourlyRateKind = 'billable' | 'cost';
export type TimeTrackingUserRow = {
    id: number;
    email: string;
    display_name?: string | null;
    picture?: string | null;
    
    role?: string;
    
    position?: string | null;
    is_blocked: boolean;
    is_archived: boolean;
    weekly_capacity_hours?: string | number;
    created_at: string;
    updated_at?: string | null;
};
function readTimeTrackingUserStr(v: unknown): string | null {
    if (v == null)
        return null;
    const s = String(v).trim();
    return s.length > 0 ? s : null;
}

export function normalizeTimeTrackingUserRow(raw: unknown): TimeTrackingUserRow | null {
    if (raw == null || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = Number(o.id);
    if (!Number.isFinite(id))
        return null;
    const email = readTimeTrackingUserStr(o.email) ?? '';
    const position = readTimeTrackingUserStr(o.position) ??
        readTimeTrackingUserStr((o as { jobTitle?: unknown }).jobTitle) ??
        readTimeTrackingUserStr((o as { job_title?: unknown }).job_title) ??
        null;
    const whRaw = o.weekly_capacity_hours ?? (o as { weeklyCapacityHours?: unknown }).weeklyCapacityHours;
    const weekly_capacity_hours: string | number | undefined =
        typeof whRaw === 'string' || typeof whRaw === 'number' ? whRaw : undefined;
    return {
        id,
        email,
        display_name: o.display_name != null ? readTimeTrackingUserStr(o.display_name) : readTimeTrackingUserStr((o as { displayName?: unknown }).displayName),
        picture: o.picture != null ? readTimeTrackingUserStr(o.picture) : null,
        role: readTimeTrackingUserStr(o.role) ?? undefined,
        position,
        is_blocked: Boolean(o.is_blocked ?? (o as { isBlocked?: unknown }).isBlocked),
        is_archived: Boolean(o.is_archived ?? (o as { isArchived?: unknown }).isArchived),
        weekly_capacity_hours,
        created_at: readTimeTrackingUserStr(o.created_at) ?? readTimeTrackingUserStr((o as { createdAt?: unknown }).createdAt) ?? '',
        updated_at: o.updated_at != null || (o as { updatedAt?: unknown }).updatedAt != null
            ? (readTimeTrackingUserStr(o.updated_at) ?? readTimeTrackingUserStr((o as { updatedAt?: unknown }).updatedAt))
            : null,
    };
}

export type TimeEntryVoidKind = 'rejected' | 'reallocated';
export type TimeEntryRow = {
    id: string;
    auth_user_id: number;
    work_date: string;
    hours: string | number;
    duration_seconds?: number;
    is_billable: boolean;
    project_id: string | null;
    task_id: string | null;
    description: string | null;
    recorded_at?: string | null;
    created_at: string;
    updated_at: string | null;
    
    voided_at?: string | null;
    voidedAt?: string | null;
    voided_by_auth_user_id?: number | null;
    voidedByAuthUserId?: number | null;
    void_kind?: TimeEntryVoidKind | null;
    voidKind?: TimeEntryVoidKind | null;
    is_voided?: boolean;
    isVoided?: boolean;
    billable_amount?: number | string | null;
    billable_currency?: string | null;
    billable_fx_as_of?: string | null;
    rate_source_amount?: number | string | null;
    rate_source_currency?: string | null;
    fx_cross_rate?: number | string | null;
    fx_rate_date?: string | null;
    fx_rate_source?: string | null;
    
    edit_unlock_expires_at?: string | null;
    editUnlockExpiresAt?: string | null;
    time_entry_edit_unlock_expires_at?: string | null;
    timeEntryEditUnlockExpiresAt?: string | null;
    billableAmount?: number | string | null;
    billableCurrency?: string | null;
    billableFxAsOf?: string | null;
    rateSourceAmount?: number | string | null;
    rateSourceCurrency?: string | null;
    fxCrossRate?: number | string | null;
    fxRateDate?: string | null;
    fxRateSource?: string | null;
};
function pickTimeEntryStr(obj: Record<string, unknown>, keys: string[]): string | null {
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === 'string' && v.trim())
            return v.trim();
    }
    return null;
}

export function normalizeTimeEntryRow(r: TimeEntryRow): TimeEntryRow {
    const o = { ...r } as TimeEntryRow & Record<string, unknown>;
    const voidedAt = pickTimeEntryStr(o, ['voided_at', 'voidedAt']);
    const vk = pickTimeEntryStr(o, ['void_kind', 'voidKind']);
    const isVoidFlag = o.is_voided === true || o.isVoided === true;
    const is_voided = Boolean(voidedAt) || isVoidFlag;
    const void_kind: TimeEntryVoidKind | null = is_voided
        ? (vk === 'reallocated' ? 'reallocated' : 'rejected')
        : null;
    const normalized: TimeEntryRow = {
        ...o,
        voided_at: voidedAt,
        void_kind,
        is_voided,
    };
    absorbTimeEntryRowEditUnlockHint(normalized as TimeEntryRow & Record<string, unknown>);
    return normalized;
}
export type HourlyRateRow = {
    id: string;
    auth_user_id: number;
    rate_kind: HourlyRateKind;
    amount: string | number;
    currency: string;
    valid_from: string | null;
    valid_to: string | null;
    created_at: string;
    updated_at: string | null;
    
    project_id?: string | null;
    projectId?: string | null;
};
function formatApiDetail(detail: unknown): string | null {
    if (detail == null)
        return null;
    if (typeof detail === 'string')
        return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((item) => {
                if (typeof item === 'string')
                    return item;
                if (item && typeof item === 'object' && 'msg' in item) {
                    const m = (item as {
                        msg?: unknown;
                    }).msg;
                    if (typeof m === 'string')
                        return m;
                }
                try {
                    return JSON.stringify(item);
                }
                catch {
                    return String(item);
                }
            })
            .join('; ');
    }
    if (typeof detail === 'object') {
        try {
            return JSON.stringify(detail);
        }
        catch {
            return String(detail);
        }
    }
    return String(detail);
}

export class TimeTrackingHttpError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = 'TimeTrackingHttpError';
        this.status = status;
    }
}
export function isTimeTrackingHttpError(e: unknown, status?: number): e is TimeTrackingHttpError {
    return e instanceof TimeTrackingHttpError && (status === undefined || e.status === status);
}
function normalizeLegacyTimeTrackingUsersError(message: string): string {
    const m = String(message ?? '').trim();
    if (!m)
        return m;
    if (/only administrators and office managers can view time tracking users/i.test(m))
        return 'Нет доступа к списку сотрудников.';
    return m;
}
async function throwIfNotOk(res: Response): Promise<Response> {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        const text = await res.text();
        const trimmed = text.trim();
        let fromDetail: string | null = null;
        if (trimmed) {
            try {
                const j = JSON.parse(text) as {
                    detail?: unknown;
                    message?: unknown;
                };
                fromDetail = formatApiDetail(j.detail);
                if (fromDetail)
                    msg = fromDetail;
                else if (typeof j.message === 'string' && j.message)
                    msg = j.message;
                else
                    msg = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed;
            }
            catch {
                msg = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed;
            }
        }
        if (res.status === 403) {
            msg = fromDetail ||
                (trimmed && msg !== `HTTP ${res.status}` ? msg : '') ||
                'Недостаточно прав для этой операции (403). Это ограничение доступа, а не сбой сети — обратитесь к администратору.';
        }
        if (res.status >= 500) {
            console.error('[time-tracking api]', res.status, msg);
        }
        throw new TimeTrackingHttpError(res.status, normalizeLegacyTimeTrackingUsersError(msg));
    }
    return res;
}
export type UpsertTimeTrackingUserOptions = {
    weeklyCapacityHours?: number;
};
export async function upsertTimeTrackingUser(user: User, options?: UpsertTimeTrackingUserOptions): Promise<void> {
    const email = (user.email ?? '').trim();
    if (!email) {
        throw new Error('У пользователя нет email — запрос синхронизации не пройдёт валидацию на gateway');
    }
    const ttRole = user.time_tracking_role;
    const rolePayload = ttRole === 'user' || ttRole === 'manager' ? ttRole : '';
    const body: Record<string, unknown> = {
        auth_user_id: user.id,
        email,
        display_name: user.display_name,
        picture: user.picture,
        role: rolePayload,
        is_blocked: user.is_blocked,
        is_archived: user.is_archived,
    };
    if (options?.weeklyCapacityHours !== undefined) {
        body.weekly_capacity_hours = options.weeklyCapacityHours;
    }
    const res = await apiFetch('/api/v1/time-tracking/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
}

export async function deleteTimeTrackingUser(authUserId: number): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}
export async function listTimeTrackingUsers(): Promise<TimeTrackingUserRow[]> {
    const res = await apiFetch('/api/v1/time-tracking/users');
    await throwIfNotOk(res);
    const raw: unknown = await res.json();
    const arr: unknown[] = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items)
            ? (raw as { items: unknown[] }).items
            : [];
    return arr.map((item) => normalizeTimeTrackingUserRow(item)).filter((x): x is TimeTrackingUserRow => x != null);
}
export type TeamWorkloadSummary = {
    total_hours: string | number;
    team_capacity_hours: string | number;
    team_weekly_capacity_hours?: string | number;
    billable_hours: string | number;
    non_billable_hours: string | number;
    team_workload_percent: number;
};
export type TeamWorkloadMember = {
    auth_user_id: number;
    display_name?: string | null;
    email: string;
    picture?: string | null;
    capacity_hours: string | number;
    total_hours: string | number;
    billable_hours: string | number;
    non_billable_hours: string | number;
    workload_percent: number;
};
export type TeamWorkloadResponse = {
    date_from: string;
    date_to: string;
    period_days: number;
    summary: TeamWorkloadSummary;
    members: TeamWorkloadMember[];
    project_id?: string | null;
    client_id?: string | null;
    project_name?: string | null;
};
export async function getTeamWorkload(from: string, to: string, options?: {
    includeArchived?: boolean;
}): Promise<TeamWorkloadResponse> {
    const qs = new URLSearchParams({ from, to });
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    const res = await apiFetch(`/api/v1/time-tracking/team-workload?${qs}`);
    await throwIfNotOk(res);
    return (await res.json()) as TeamWorkloadResponse;
}
export async function getProjectTeamWorkload(clientId: string, projectId: string, from: string, to: string, options?: {
    includeArchived?: boolean;
}): Promise<TeamWorkloadResponse> {
    const qs = new URLSearchParams({ from, to });
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}/team-workload?${qs}`);
    await throwIfNotOk(res);
    return (await res.json()) as TeamWorkloadResponse;
}
export async function listTimeEntries(authUserId: number, from: string, to: string): Promise<TimeEntryRow[]> {
    const qs = new URLSearchParams({ from, to });
    const primary = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries?${qs}`);
    const mapRows = (raw: TimeEntryRow[]) => raw.map(normalizeTimeEntryRow);
    if (primary.ok)
        return mapRows((await primary.json()) as TimeEntryRow[]);
    if (primary.status === 404) {
        const alias = await apiFetch(`/api/v1/users/${authUserId}/time-entries?${qs}`);
        await throwIfNotOk(alias);
        return mapRows((await alias.json()) as TimeEntryRow[]);
    }
    await throwIfNotOk(primary);
    return mapRows((await primary.json()) as TimeEntryRow[]);
}
export type CreateTimeEntryBody = {
    workDate: string;
    durationSeconds: number;
    isBillable?: boolean;
    projectId?: string | null;
    taskId?: string | null;
    description?: string | null;
    billableFxAsOf?: string | null;
    recordedAt?: string | null;
};
export async function createTimeEntry(authUserId: number, body: CreateTimeEntryBody): Promise<TimeEntryRow> {
    const payload: Record<string, unknown> = {
        workDate: body.workDate,
        durationSeconds: body.durationSeconds,
        isBillable: body.isBillable ?? true,
        projectId: body.projectId ?? null,
        description: body.description ?? null,
    };
    if (body.taskId != null)
        payload.taskId = body.taskId;
    if (body.recordedAt != null && String(body.recordedAt).trim() !== '') {
        payload.recordedAt = String(body.recordedAt).trim();
    }
    if (body.billableFxAsOf != null && String(body.billableFxAsOf).trim() !== '') {
        payload.billableFxAsOf = String(body.billableFxAsOf).trim();
    }
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    return normalizeTimeEntryRow((await res.json()) as TimeEntryRow);
}
export type PatchTimeEntryBody = {
    workDate?: string;
    durationSeconds?: number;
    isBillable?: boolean;
    projectId?: string | null;
    taskId?: string | null;
    description?: string | null;
    billableFxAsOf?: string | null;
    recordedAt?: string | null;
};
export async function patchTimeEntry(authUserId: number, entryId: string, patch: PatchTimeEntryBody): Promise<TimeEntryRow> {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries/${encodeURIComponent(entryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    });
    await throwIfNotOk(res);
    return normalizeTimeEntryRow((await res.json()) as TimeEntryRow);
}

/** GET одной записи по владельцу (для подстановки в time report по timeEntryId из строки счёта). */
export async function fetchTimeEntry(authUserId: number, entryId: string): Promise<TimeEntryRow | null> {
    const uid = String(entryId ?? '').trim();
    if (!uid)
        return null;
    let res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries/${encodeURIComponent(uid)}`, {
        method: 'GET',
    });
    if (res.status === 404) {
        res = await apiFetch(`/api/v1/users/${authUserId}/time-entries/${encodeURIComponent(uid)}`, {
            method: 'GET',
        });
    }
    if (res.status === 404)
        return null;
    await throwIfNotOk(res);
    return normalizeTimeEntryRow((await res.json()) as TimeEntryRow);
}

export type TimeEntryEditUnlockGrantOut = {
    authUserId: number;
    workDate: string;
    grantedByAuthUserId: number;
    expiresAt: string;
    createdAt: string;
};

function normalizeTimeEntryEditUnlockGrant(raw: Record<string, unknown>): TimeEntryEditUnlockGrantOut {
    const num = (v: unknown): number => {
        if (typeof v === 'number' && Number.isFinite(v))
            return v;
        const n = Number(v);
        return Number.isFinite(n) ? n : NaN;
    };
    return {
        authUserId: num(raw.authUserId ?? raw.auth_user_id),
        workDate: String(raw.workDate ?? raw.work_date ?? '').trim().slice(0, 10),
        grantedByAuthUserId: num(raw.grantedByAuthUserId ?? raw.granted_by_auth_user_id),
        expiresAt: String(raw.expiresAt ?? raw.expires_at ?? ''),
        createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    };
}

async function parseUnlockGrantResponse(res: Response): Promise<TimeEntryEditUnlockGrantOut> {
    const raw = (await res.json()) as Record<string, unknown>;
    const out = normalizeTimeEntryEditUnlockGrant(raw);
    recordTimeEntryEditUnlockExpiry(out.authUserId, out.workDate, out.expiresAt);
    return out;
}

export async function grantTimeEntryEditUnlock(authUserId: number, workDateYmd: string): Promise<TimeEntryEditUnlockGrantOut> {
    const wd = workDateYmd.trim().slice(0, 10);
    const body = JSON.stringify({ workDate: wd });
    let res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entry-edit-unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
    });
    if (!res.ok && res.status === 404) {
        res = await apiFetch(`/api/v1/users/${authUserId}/time-entry-edit-unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }
    await throwIfNotOk(res);
    return parseUnlockGrantResponse(res);
}

export type DeleteTimeEntryOptions = {
    voidKind?: TimeEntryVoidKind;
};

export async function deleteTimeEntry(authUserId: number, entryId: string, options?: DeleteTimeEntryOptions): Promise<TimeEntryRow | null> {
    const voidKind = options?.voidKind;
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries/${encodeURIComponent(entryId)}`, {
        method: 'DELETE',
        ...(voidKind != null
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voidKind }),
            }
            : {}),
    });
    await throwIfNotOk(res);
    if (res.status === 204)
        return null;
    const text = await res.text();
    if (!text.trim())
        return null;
    return normalizeTimeEntryRow(JSON.parse(text) as TimeEntryRow);
}
function normalizeHourlyRateRow(r: HourlyRateRow): HourlyRateRow {
    const o = r as HourlyRateRow & { project_id?: string | null; projectId?: string | null };
    const project_id = o.project_id ?? o.projectId ?? null;
    return { ...o, project_id, projectId: project_id };
}
export async function listHourlyRates(authUserId: number, kind: HourlyRateKind, options?: {
    projectId?: string | null;
}): Promise<HourlyRateRow[]> {
    const qs = new URLSearchParams({ kind });
    if (options?.projectId)
        qs.set('projectId', String(options.projectId));
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates?${qs}`);
    await throwIfNotOk(res);
    const raw = (await res.json()) as HourlyRateRow[];
    return Array.isArray(raw) ? raw.map((row) => normalizeHourlyRateRow(row)) : [];
}
export async function createHourlyRate(authUserId: number, body: {
    rateKind: HourlyRateKind;
    amount: string;
    currency: string;
    validFrom: string | null;
    validTo: string | null;
    projectId?: string | null;
}): Promise<HourlyRateRow> {
    const payload: Record<string, unknown> = {
        rateKind: body.rateKind,
        amount: body.amount,
        currency: body.currency,
        validFrom: body.validFrom,
        validTo: body.validTo,
    };
    if (body.projectId != null && String(body.projectId).trim() !== '')
        payload.projectId = String(body.projectId).trim();
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    return normalizeHourlyRateRow((await res.json()) as HourlyRateRow);
}
export async function patchHourlyRate(authUserId: number, rateId: string, patch: {
    amount?: string;
    currency?: string;
    validFrom?: string | null;
    validTo?: string | null;
    projectId?: string | null;
}): Promise<HourlyRateRow> {
    const body: Record<string, unknown> = {};
    if (patch.amount !== undefined)
        body.amount = patch.amount;
    if (patch.currency !== undefined)
        body.currency = patch.currency;
    if (patch.validFrom !== undefined)
        body.validFrom = patch.validFrom;
    if (patch.validTo !== undefined)
        body.validTo = patch.validTo;
    if (patch.projectId !== undefined)
        body.projectId = patch.projectId;
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates/${encodeURIComponent(rateId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    return normalizeHourlyRateRow((await res.json()) as HourlyRateRow);
}
export async function deleteHourlyRate(authUserId: number, rateId: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates/${encodeURIComponent(rateId)}`, {
        method: 'DELETE',
    });
    await throwIfNotOk(res);
}
export type UserProjectAccessOut = {
    projectIds: string[];
};
function parseUserProjectAccess(raw: unknown): UserProjectAccessOut {
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
export async function getUserProjectAccess(authUserId: number): Promise<UserProjectAccessOut> {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/project-access`);
    await throwIfNotOk(res);
    return parseUserProjectAccess(await res.json());
}

export async function putUserProjectAccess(authUserId: number, projectIds: string[]): Promise<UserProjectAccessOut> {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/project-access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds }),
    });
    await throwIfNotOk(res);
    return parseUserProjectAccess(await res.json());
}
const PROJECT_ACCESS_FETCH_BATCH = 12;
export async function listUsersWithProjectAccessToProject(projectId: string): Promise<TimeManagerProjectDashboardTeamMember[]> {
    const users = await listTimeTrackingUsers();
    const active = users.filter((u) => !u.is_archived && !u.is_blocked);
    const out: TimeManagerProjectDashboardTeamMember[] = [];
    for (let i = 0; i < active.length; i += PROJECT_ACCESS_FETCH_BATCH) {
        const chunk = active.slice(i, i + PROJECT_ACCESS_FETCH_BATCH);
        const chunkResults = await Promise.all(chunk.map(async (u) => {
            try {
                const { projectIds } = await getUserProjectAccess(u.id);
                if (!projectIds.includes(projectId))
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

/** Партнёры (орг. роль), у которых в TT выдан доступ к указанному проекту. */
export async function listPartnerUsersWithProjectAccessToProject(projectId: string): Promise<ProjectPartnerAccessRow[]> {
    const pid = String(projectId ?? '').trim();
    if (!pid)
        return [];
    const users = await listTimeTrackingUsers();
    const candidates = users.filter((u) => !u.is_archived && !u.is_blocked && isPartnerOrgRole(u.role, u.position));
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
export type TimeManagerClientContactRow = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    sort_order: number | null;
};
export type TimeManagerClientRow = {
    id: string;
    name: string;
    address: string | null;
    currency: string;
    invoice_due_mode: string;
    invoice_due_days_after_issue: number | null;
    tax_percent: string | number | null;
    tax2_percent: string | number | null;
    discount_percent: string | number | null;
    created_at: string;
    updated_at: string | null;
    phone?: string | null;
    email?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    is_archived?: boolean;
    extra_contacts?: TimeManagerClientContactRow[];
};
function readStr(v: unknown): string | null {
    if (v == null || v === '')
        return null;
    return String(v);
}
function readNumOrNull(v: unknown): number | null {
    if (v == null || v === '')
        return null;
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : null;
}
function readPercentField(v: unknown): string | number | null {
    if (v == null || v === '')
        return null;
    if (typeof v === 'number' || typeof v === 'string')
        return v;
    return null;
}
function normalizeTimeManagerContact(raw: unknown): TimeManagerClientContactRow | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = o.id != null ? String(o.id) : '';
    if (!id)
        return null;
    return {
        id,
        name: readStr(o.name) ?? '',
        phone: readStr(o.phone),
        email: readStr(o.email),
        sort_order: readNumOrNull(o.sortOrder ?? o.sort_order),
    };
}
export function normalizeTimeManagerClient(raw: unknown): TimeManagerClientRow {
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const extraRaw = o.extraContacts ?? o.extra_contacts;
    const extra: TimeManagerClientContactRow[] = Array.isArray(extraRaw)
        ? extraRaw.map(normalizeTimeManagerContact).filter((x): x is TimeManagerClientContactRow => x != null)
        : [];
    return {
        id: o.id != null ? String(o.id) : '',
        name: readStr(o.name) ?? '',
        address: readStr(o.address),
        currency: readStr(o.currency) ?? 'USD',
        invoice_due_mode: readStr(o.invoiceDueMode ?? o.invoice_due_mode) ?? 'custom',
        invoice_due_days_after_issue: readNumOrNull(o.invoiceDueDaysAfterIssue ?? o.invoice_due_days_after_issue),
        tax_percent: readPercentField(o.taxPercent ?? o.tax_percent),
        tax2_percent: readPercentField(o.tax2Percent ?? o.tax2_percent),
        discount_percent: readPercentField(o.discountPercent ?? o.discount_percent),
        created_at: readStr(o.createdAt ?? o.created_at) ?? '',
        updated_at: readStr(o.updatedAt ?? o.updated_at),
        phone: readStr(o.phone),
        email: readStr(o.email),
        contact_name: readStr(o.contactName ?? o.contact_name),
        contact_phone: readStr(o.contactPhone ?? o.contact_phone),
        contact_email: readStr(o.contactEmail ?? o.contact_email),
        is_archived: Boolean(o.isArchived ?? o.is_archived),
        extra_contacts: extra.length > 0 ? extra : undefined,
    };
}
export type TimeManagerClientCreatePayload = {
    name: string;
    address?: string | null;
    currency?: string;
    invoiceDueMode?: string;
    invoiceDueDaysAfterIssue?: number | null;
    taxPercent?: number | null;
    tax2Percent?: number | null;
    discountPercent?: number | null;
    phone?: string | null;
    email?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    isArchived?: boolean;
};
export type TimeManagerClientPatchPayload = {
    name?: string;
    address?: string | null;
    currency?: string;
    invoiceDueMode?: string;
    invoiceDueDaysAfterIssue?: number | null;
    taxPercent?: number | null;
    tax2Percent?: number | null;
    discountPercent?: number | null;
    phone?: string | null;
    email?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    isArchived?: boolean;
};
function clientCreateJson(body: TimeManagerClientCreatePayload): Record<string, unknown> {
    return {
        name: body.name,
        address: body.address ?? null,
        currency: body.currency ?? 'USD',
        invoiceDueMode: body.invoiceDueMode ?? 'custom',
        invoiceDueDaysAfterIssue: body.invoiceDueDaysAfterIssue ?? null,
        taxPercent: body.taxPercent ?? null,
        tax2Percent: body.tax2Percent ?? null,
        discountPercent: body.discountPercent ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        contactName: body.contactName ?? null,
        contactPhone: body.contactPhone ?? null,
        contactEmail: body.contactEmail ?? null,
        isArchived: body.isArchived ?? false,
        is_archived: body.isArchived ?? false,
    };
}
function clientPatchJson(patch: TimeManagerClientPatchPayload): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined)
        payload.name = patch.name;
    if (patch.address !== undefined)
        payload.address = patch.address;
    if (patch.currency !== undefined)
        payload.currency = patch.currency;
    if (patch.invoiceDueMode !== undefined)
        payload.invoiceDueMode = patch.invoiceDueMode;
    if (patch.invoiceDueDaysAfterIssue !== undefined)
        payload.invoiceDueDaysAfterIssue = patch.invoiceDueDaysAfterIssue;
    if (patch.taxPercent !== undefined)
        payload.taxPercent = patch.taxPercent;
    if (patch.tax2Percent !== undefined)
        payload.tax2Percent = patch.tax2Percent;
    if (patch.discountPercent !== undefined)
        payload.discountPercent = patch.discountPercent;
    if (patch.phone !== undefined)
        payload.phone = patch.phone;
    if (patch.email !== undefined)
        payload.email = patch.email;
    if (patch.contactName !== undefined)
        payload.contactName = patch.contactName;
    if (patch.contactPhone !== undefined)
        payload.contactPhone = patch.contactPhone;
    if (patch.contactEmail !== undefined)
        payload.contactEmail = patch.contactEmail;
    if (patch.isArchived !== undefined) {
        payload.isArchived = patch.isArchived;
        payload.is_archived = patch.isArchived;
    }
    return payload;
}
export async function listTimeManagerClients(includeArchived?: boolean): Promise<TimeManagerClientRow[]>;
export async function listTimeManagerClients(includeArchived: boolean, pagination: TimeTrackingPaginationParams): Promise<PaginatedResult<TimeManagerClientRow>>;
export async function listTimeManagerClients(includeArchived = false, pagination?: TimeTrackingPaginationParams): Promise<TimeManagerClientRow[] | PaginatedResult<TimeManagerClientRow>> {
    const qs = new URLSearchParams();
    if (includeArchived)
        qs.set('includeArchived', 'true');
    if (pagination) {
        qs.set('limit', String(pagination.limit));
        qs.set('offset', String(pagination.offset ?? 0));
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/clients${suffix}`);
    await throwIfNotOk(res);
    const raw = await res.json();
    if (pagination) {
        const off = pagination.offset ?? 0;
        return parseTimeTrackingPagedResponse(raw, (item) => normalizeTimeManagerClient(item), {
            limit: pagination.limit,
            offset: off,
        });
    }
    const arr = unwrapTimeTrackingListArray(raw);
    if (!arr)
        return [];
    return arr.map(normalizeTimeManagerClient);
}
export async function getTimeManagerClient(clientId: string): Promise<TimeManagerClientRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}`);
    await throwIfNotOk(res);
    return normalizeTimeManagerClient(await res.json());
}
export async function createTimeManagerClient(body: TimeManagerClientCreatePayload): Promise<TimeManagerClientRow> {
    const res = await apiFetch('/api/v1/time-tracking/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientCreateJson(body)),
    });
    await throwIfNotOk(res);
    return normalizeTimeManagerClient(await res.json());
}
export async function patchTimeManagerClient(clientId: string, patch: TimeManagerClientPatchPayload): Promise<TimeManagerClientRow> {
    const payload = clientPatchJson(patch);
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    return normalizeTimeManagerClient(await res.json());
}
export async function deleteTimeManagerClient(clientId: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}
export type TimeManagerClientContactCreatePayload = {
    name: string;
    phone?: string | null;
    email?: string | null;
    sortOrder?: number | null;
};
export type TimeManagerClientContactPatchPayload = {
    name?: string;
    phone?: string | null;
    email?: string | null;
    sortOrder?: number | null;
};
export async function listClientContacts(clientId: string): Promise<TimeManagerClientContactRow[]> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/contacts`);
    await throwIfNotOk(res);
    const raw = await res.json();
    if (!Array.isArray(raw))
        return [];
    return raw.map(normalizeTimeManagerContact).filter((x): x is TimeManagerClientContactRow => x != null);
}
export async function createClientContact(clientId: string, body: TimeManagerClientContactCreatePayload): Promise<TimeManagerClientContactRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: body.name,
            phone: body.phone ?? null,
            email: body.email ?? null,
            sortOrder: body.sortOrder ?? null,
        }),
    });
    await throwIfNotOk(res);
    const row = normalizeTimeManagerContact(await res.json());
    if (!row)
        throw new Error('Некорректный ответ при создании контакта');
    return row;
}
export async function patchClientContact(clientId: string, contactId: string, patch: TimeManagerClientContactPatchPayload): Promise<TimeManagerClientContactRow> {
    const p: Record<string, unknown> = {};
    if (patch.name !== undefined)
        p.name = patch.name;
    if (patch.phone !== undefined)
        p.phone = patch.phone;
    if (patch.email !== undefined)
        p.email = patch.email;
    if (patch.sortOrder !== undefined)
        p.sortOrder = patch.sortOrder;
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contactId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    await throwIfNotOk(res);
    const row = normalizeTimeManagerContact(await res.json());
    if (!row)
        throw new Error('Некорректный ответ при обновлении контакта');
    return row;
}
export async function deleteClientContact(clientId: string, contactId: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/contacts/${encodeURIComponent(contactId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}
export type TimeManagerClientTaskRow = {
    id: string;

    /** Проект, к которому относится задача (ответ gateway / TT). */
    project_id: string;
    name: string;
    default_billable_rate: string | number | null;
    billable_by_default: boolean;
    created_at: string;
    updated_at: string | null;
};
export type TimeManagerClientTaskCreatePayload = {
    name: string;
    defaultBillableRate?: number | null;
    billableByDefault?: boolean;
};
export type TimeManagerClientTaskPatchPayload = {
    name?: string;
    defaultBillableRate?: number | null;
    billableByDefault?: boolean;
};
function normalizeTimeManagerProjectTask(raw: unknown): TimeManagerClientTaskRow {
    const r = raw as Record<string, unknown>;
    const projectIdRaw = r.project_id ?? r.projectId;
    return {
        id: String(r.id ?? ''),
        project_id: String(projectIdRaw ?? ''),
        name: String(r.name ?? ''),
        default_billable_rate: (r.default_billable_rate ?? r.defaultBillableRate ?? null) as string | number | null,
        billable_by_default: Boolean(r.billable_by_default ?? r.billableByDefault),
        created_at: String(r.created_at ?? r.createdAt ?? ''),
        updated_at: r.updated_at != null
            ? String(r.updated_at)
            : r.updatedAt != null
                ? String(r.updatedAt)
                : null,
    };
}
function projectTasksCollectionPath(clientId: string, projectId: string): string {
    return `/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}/tasks`;
}
/** Список задач в контексте проекта (не клиента). */
export async function listProjectTasks(clientId: string, projectId: string): Promise<TimeManagerClientTaskRow[]> {
    const res = await apiFetch(projectTasksCollectionPath(clientId, projectId));
    await throwIfNotOk(res);
    const body = await res.json();
    if (!Array.isArray(body))
        return [];
    return body.map(normalizeTimeManagerProjectTask);
}
export async function getProjectTask(clientId: string, projectId: string, taskId: string): Promise<TimeManagerClientTaskRow> {
    const res = await apiFetch(`${projectTasksCollectionPath(clientId, projectId)}/${encodeURIComponent(taskId)}`);
    await throwIfNotOk(res);
    return normalizeTimeManagerProjectTask(await res.json());
}
export async function createProjectTask(clientId: string, projectId: string, body: TimeManagerClientTaskCreatePayload): Promise<TimeManagerClientTaskRow> {
    const res = await apiFetch(projectTasksCollectionPath(clientId, projectId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: body.name,
            defaultBillableRate: body.defaultBillableRate ?? null,
            billableByDefault: body.billableByDefault ?? true,
        }),
    });
    await throwIfNotOk(res);
    return normalizeTimeManagerProjectTask(await res.json());
}
export async function patchProjectTask(clientId: string, projectId: string, taskId: string, patch: TimeManagerClientTaskPatchPayload): Promise<TimeManagerClientTaskRow> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined)
        payload.name = patch.name;
    if (patch.defaultBillableRate !== undefined)
        payload.defaultBillableRate = patch.defaultBillableRate;
    if (patch.billableByDefault !== undefined)
        payload.billableByDefault = patch.billableByDefault;
    const res = await apiFetch(`${projectTasksCollectionPath(clientId, projectId)}/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    return normalizeTimeManagerProjectTask(await res.json());
}
export async function deleteProjectTask(clientId: string, projectId: string, taskId: string): Promise<void> {
    const res = await apiFetch(`${projectTasksCollectionPath(clientId, projectId)}/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}
export type TimeManagerClientExpenseCategoryRow = {
    id: string;
    client_id: string;
    name: string;
    has_unit_price: boolean;
    is_archived: boolean;
    sort_order: number | null;
    created_at: string;
    updated_at: string | null;
    usage_count: number;
    deletable: boolean;
};
export type TimeManagerClientExpenseCategoryCreatePayload = {
    name: string;
    hasUnitPrice?: boolean;
    sortOrder?: number | null;
};
export type TimeManagerClientExpenseCategoryPatchPayload = {
    name?: string;
    hasUnitPrice?: boolean;
    isArchived?: boolean;
    sortOrder?: number | null;
};
export async function listClientExpenseCategories(clientId: string, options?: {
    includeArchived?: boolean;
}): Promise<TimeManagerClientExpenseCategoryRow[]> {
    const qs = new URLSearchParams();
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories${suffix}`);
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientExpenseCategoryRow[];
}
export async function getClientExpenseCategory(clientId: string, categoryId: string): Promise<TimeManagerClientExpenseCategoryRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories/${encodeURIComponent(categoryId)}`);
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientExpenseCategoryRow;
}
export async function createClientExpenseCategory(clientId: string, body: TimeManagerClientExpenseCategoryCreatePayload): Promise<TimeManagerClientExpenseCategoryRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: body.name,
            hasUnitPrice: body.hasUnitPrice ?? false,
            sortOrder: body.sortOrder ?? null,
        }),
    });
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientExpenseCategoryRow;
}
export async function patchClientExpenseCategory(clientId: string, categoryId: string, patch: TimeManagerClientExpenseCategoryPatchPayload): Promise<TimeManagerClientExpenseCategoryRow> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined)
        payload.name = patch.name;
    if (patch.hasUnitPrice !== undefined)
        payload.hasUnitPrice = patch.hasUnitPrice;
    if (patch.isArchived !== undefined)
        payload.isArchived = patch.isArchived;
    if (patch.sortOrder !== undefined)
        payload.sortOrder = patch.sortOrder;
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories/${encodeURIComponent(categoryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientExpenseCategoryRow;
}
export async function deleteClientExpenseCategory(clientId: string, categoryId: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/expense-categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}
export type TimeTrackingProjectForExpense = {
    id: string;
    name: string;
    code: string | null;
    clientId: string;
    clientName: string;
    isArchived: boolean;
    
    currency?: string | null;
    projectType?: string | null;
    endDate?: string | null;
};
function normalizeProjectForExpense(raw: Record<string, unknown>): TimeTrackingProjectForExpense | null {
    const id = raw.id != null ? String(raw.id).trim() : '';
    if (!id)
        return null;
    const codeRaw = raw.code;
    const codeStr = codeRaw == null || codeRaw === '' ? '' : String(codeRaw).trim();
    const curRaw = raw.currency ?? raw.projectCurrency ?? raw.project_currency;
    const cur = curRaw != null && String(curRaw).trim() ? String(curRaw).trim().toUpperCase() : null;
    const pt = raw.projectType ?? raw.project_type;
    const end = raw.endDate ?? raw.end_date;
    return {
        id,
        name: String(raw.name ?? '').trim() || '—',
        code: codeStr || null,
        clientId: String(raw.clientId ?? raw.client_id ?? '').trim(),
        clientName: String(raw.clientName ?? raw.client_name ?? '').trim() || '—',
        isArchived: raw.isArchived === true || raw.is_archived === true,
        currency: cur,
        projectType: pt != null && String(pt).trim() ? String(pt).trim() : null,
        endDate: end != null && String(end).trim() ? String(end).trim() : null,
    };
}
export async function listProjectsForExpenses(options?: {
    includeArchived?: boolean;
}): Promise<TimeTrackingProjectForExpense[]>;
export async function listProjectsForExpenses(options: {
    includeArchived?: boolean;
} & TimeTrackingPaginationParams): Promise<PaginatedResult<TimeTrackingProjectForExpense>>;
export async function listProjectsForExpenses(options?: {
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
}): Promise<TimeTrackingProjectForExpense[] | PaginatedResult<TimeTrackingProjectForExpense>> {
    const qs = new URLSearchParams();
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    if (options?.limit != null) {
        qs.set('limit', String(options.limit));
        qs.set('offset', String(options.offset ?? 0));
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/projects-for-expenses${suffix}`);
    await throwIfNotOk(res);
    const raw = await res.json();
    if (options?.limit != null) {
        const off = options.offset ?? 0;
        return parseTimeTrackingPagedResponse(raw, (item) => {
            if (!item || typeof item !== 'object')
                return null;
            return normalizeProjectForExpense(item as Record<string, unknown>);
        }, { limit: options.limit, offset: off });
    }
    const arr = unwrapTimeTrackingListArray(raw);
    if (!arr)
        return [];
    const out: TimeTrackingProjectForExpense[] = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object')
            continue;
        const row = normalizeProjectForExpense(item as Record<string, unknown>);
        if (row)
            out.push(row);
    }
    return out;
}
export type ProjectExpenseCategoryRow = {
    id: string;
    name: string;
    hasUnitPrice: boolean;
    isArchived: boolean;
};
function normalizeProjectExpenseCategory(raw: Record<string, unknown>): ProjectExpenseCategoryRow | null {
    const id = raw.id != null ? String(raw.id).trim() : '';
    if (!id)
        return null;
    return {
        id,
        name: String(raw.name ?? '').trim() || '—',
        hasUnitPrice: raw.hasUnitPrice === true || raw.has_unit_price === true,
        isArchived: raw.isArchived === true || raw.is_archived === true,
    };
}
export async function listProjectExpenseCategories(projectId: string, options?: {
    includeArchived?: boolean;
}): Promise<ProjectExpenseCategoryRow[]> {
    const qs = new URLSearchParams();
    if (options?.includeArchived)
        qs.set('includeArchived', 'true');
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/projects/${encodeURIComponent(projectId)}/expense-categories${suffix}`);
    await throwIfNotOk(res);
    const arr = (await res.json()) as unknown[];
    if (!Array.isArray(arr))
        return [];
    const out: ProjectExpenseCategoryRow[] = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object')
            continue;
        const row = normalizeProjectExpenseCategory(item as Record<string, unknown>);
        if (row)
            out.push(row);
    }
    return out;
}
export type TimeManagerProjectCurrency = 'USD' | 'UZS' | 'EUR' | 'RUB' | 'GBP';

export const TIME_TRACKING_PROJECT_CURRENCIES: readonly TimeManagerProjectCurrency[] = ['USD', 'UZS', 'EUR', 'RUB', 'GBP'];
export type TimeManagerClientProjectRow = {
    id: string;
    client_id: string;
    name: string;
    code: string | null;
    currency?: string | null;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
    report_visibility: string;
    project_type: string;
    billable_rate_type: string | null;
    
    project_billable_rate_amount?: string | number | null;
    budget_type: string | null;
    budget_amount: string | number | null;
    /** Плановый денежный бюджет для прогресса (T&M / non_billable), если жёсткий budget_amount не задан или дополнительно к нему. */
    progress_budget_amount?: string | number | null;
    budget_hours: string | number | null;
    budget_resets_every_month: boolean;
    budget_includes_expenses: boolean;
    send_budget_alerts: boolean;
    budget_alert_threshold_percent: string | number | null;
    fixed_fee_amount: string | number | null;
    usage_count: number;
    deletable: boolean;
    created_at: string;
    updated_at: string | null;
    /** New backend-ready budget fields for project lists/details. */
    budgetDisplayValue?: string | number | null;
    budgetSpentValue?: string | number | null;
    budgetRemainingValue?: string | number | null;
    budgetProgressPercent?: string | number | null;
    loggedHoursValue?: string | number | null;
    hasBudgetConfigured?: boolean | null;
    /** Snake_case compatibility (if serializer returns underscored keys). */
    budget_display_value?: string | number | null;
    budget_spent_value?: string | number | null;
    budget_remaining_value?: string | number | null;
    budget_progress_percent?: string | number | null;
    logged_hours_value?: string | number | null;
    has_budget_configured?: boolean | null;
};


export function readTimeManagerProjectBillableRateAmount(row: TimeManagerClientProjectRow & { projectBillableRateAmount?: string | number | null }): string {
    const raw = row.project_billable_rate_amount ?? row.projectBillableRateAmount;
    if (raw == null || String(raw).trim() === '')
        return '';
    return String(raw);
}
export type TimeManagerProjectDashboardTotals = {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: number;
    internalCostAmount: number;
    internalCostsComplete: boolean;
    unbilledAmount: number;
    expenseAmountUzs: number;
    /**
     * Сумма `equivalent_amount` по заявкам — в деньгах проекта (`GET …/dashboard` → `expense_equivalent_total`).
     * Для отображения основной суммы расходов на карточке проекта использовать это поле, не `expenseAmountUzs`.
     */
    expenseEquivalentTotal: number;
    /** @deprecated Дублирует `expenseEquivalentTotal`; оставлено для совместимости. */
    expenseAmountProject?: number;
    expenseCount: number;
};
export type TimeManagerProjectDashboardProgressWeek = {
    weekStart: string;
    cumulativeBillableAmount: number;
};
export type TimeManagerProjectDashboardHoursWeek = {
    weekStart: string;
    hours: number;
    billableHours?: number;
    nonBillableHours?: number;
};
export type TimeManagerProjectDashboardTask = {
    taskId: string;
    name: string;
    billable: boolean;
    hours: number;
    billableAmount: number;
    internalCostAmount: number;
};
export type TimeManagerProjectDashboardTeamMember = {
    userId: string;
    name: string;
    hours: number;
    billableHours?: number;
    nonBillableHours?: number;
    billableAmount?: number;
    internalCostAmount?: number;
};
export type TimeManagerProjectDashboardInvoice = {
    id: string;
    issuedAt?: string;
    amount: number;
    currency: string;
    status?: string;
};

export type TimeManagerProjectDashboardBudgetSlice = {
    budget: number;
    spent: number;
    remaining: number;
    percentUsed: number | null;
};


export type TimeManagerProjectDashboardBudget = {
    hasBudget: boolean;
    budgetBy: 'none' | 'money' | 'hours' | 'hours_and_money';
    currency: string;
    
    budget: number;
    spent: number;
    remaining: number;
    percentUsed: number | null;
    
    money?: TimeManagerProjectDashboardBudgetSlice;
    hours?: TimeManagerProjectDashboardBudgetSlice;
    percentUsedMoney?: number | null;
    percentUsedHours?: number | null;
};
export type TimeManagerProjectDashboard = {
    currency?: string;
    totals: TimeManagerProjectDashboardTotals;
    progressByWeek: TimeManagerProjectDashboardProgressWeek[];
    hoursByWeek: TimeManagerProjectDashboardHoursWeek[];
    tasks: TimeManagerProjectDashboardTask[];
    team: TimeManagerProjectDashboardTeamMember[];
    invoices: TimeManagerProjectDashboardInvoice[];
    budget?: TimeManagerProjectDashboardBudget | null;
};
function dashNum(v: unknown, fallback = 0): number {
    if (v == null || v === '')
        return fallback;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : fallback;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
}
function dashStr(v: unknown): string | undefined {
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
function dashBool(v: unknown, fallback: boolean): boolean {
    if (typeof v === 'boolean')
        return v;
    return fallback;
}
export function normalizeProjectDashboard(raw: unknown): TimeManagerProjectDashboard {
    const emptyTotals: TimeManagerProjectDashboardTotals = {
        totalHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        billableAmount: 0,
        internalCostAmount: 0,
        internalCostsComplete: true,
        unbilledAmount: 0,
        expenseAmountUzs: 0,
        expenseEquivalentTotal: 0,
        expenseCount: 0,
    };
    if (!raw || typeof raw !== 'object') {
        return {
            totals: emptyTotals,
            progressByWeek: [],
            hoursByWeek: [],
            tasks: [],
            team: [],
            invoices: [],
        };
    }
    const o = raw as Record<string, unknown>;
    const tr = (o.totals && typeof o.totals === 'object' ? o.totals : {}) as Record<string, unknown>;
    const expenseAmountUzs = dashNum(tr.expense_amount_uzs ?? tr.expenseAmountUzs);
    const uzsRaw = tr.expense_amount_uzs ?? tr.expenseAmountUzs;
    const hasExplicitUzs = uzsRaw != null && String(uzsRaw).trim() !== '';
    const pickEquivFromTotals = (): number | undefined => {
        const keys = [
            'expense_equivalent_total',
            'expenseEquivalentTotal',
            'total_equivalent_amount',
            'totalEquivalentAmount',
            'expense_amount_project',
            'expenseAmountProject',
            'expense_amount_in_project',
            'expenseAmountInProject',
        ] as const;
        for (const k of keys) {
            const v = tr[k];
            if (v != null && String(v).trim() !== '') {
                const n = dashNum(v);
                if (Number.isFinite(n))
                    return n;
            }
        }
        const uni = tr.expense_amount ?? tr.expenseAmount;
        if (!hasExplicitUzs && uni != null && String(uni).trim() !== '') {
            const n = dashNum(uni);
            if (Number.isFinite(n))
                return n;
        }
        return undefined;
    };
    const equivResolved = pickEquivFromTotals();
    const expenseEquivalentTotal = equivResolved ?? 0;
    const totals: TimeManagerProjectDashboardTotals = {
        totalHours: dashNum(tr.total_hours ?? tr.totalHours),
        billableHours: dashNum(tr.billable_hours ?? tr.billableHours),
        nonBillableHours: dashNum(tr.non_billable_hours ?? tr.nonBillableHours),
        billableAmount: dashNum(tr.billable_amount ?? tr.billableAmount),
        internalCostAmount: dashNum(tr.internal_cost_amount ?? tr.internalCostAmount),
        internalCostsComplete: dashBool(tr.internal_costs_complete ?? tr.internalCostsComplete, true),
        unbilledAmount: dashNum(tr.unbilled_amount ?? tr.unbilledAmount),
        expenseAmountUzs,
        expenseEquivalentTotal,
        expenseAmountProject: expenseEquivalentTotal,
        expenseCount: Math.round(dashNum(tr.expense_count ?? tr.expenseCount)),
    };
    const progressRaw = o.progress_by_week ?? o.progressByWeek;
    const progressByWeek: TimeManagerProjectDashboardProgressWeek[] = Array.isArray(progressRaw)
        ? progressRaw.map((item) => {
            const x = item as Record<string, unknown>;
            const ws = dashStr(x.week_start ?? x.weekStart) ?? '';
            return {
                weekStart: ws,
                cumulativeBillableAmount: dashNum(x.cumulative_billable_amount ?? x.cumulativeBillableAmount),
            };
        })
        : [];
    const hoursRaw = o.hours_by_week ?? o.hoursByWeek;
    const hoursByWeek: TimeManagerProjectDashboardHoursWeek[] = Array.isArray(hoursRaw)
        ? hoursRaw.map((item) => {
            const x = item as Record<string, unknown>;
            const ws = dashStr(x.week_start ?? x.weekStart) ?? '';
            return {
                weekStart: ws,
                hours: dashNum(x.hours),
                billableHours: dashNum(x.billable_hours ?? x.billableHours),
                nonBillableHours: dashNum(x.non_billable_hours ?? x.nonBillableHours),
            };
        })
        : [];
    const tasksRaw = o.tasks;
    const tasks: TimeManagerProjectDashboardTask[] = Array.isArray(tasksRaw)
        ? tasksRaw.map((item) => {
            const x = item as Record<string, unknown>;
            const id = dashStr(x.task_id ?? x.taskId) ?? '';
            const name = dashStr(x.name) ?? '—';
            return {
                taskId: id || `task-${Math.random().toString(36).slice(2)}`,
                name,
                billable: dashBool(x.billable, true),
                hours: dashNum(x.hours),
                billableAmount: dashNum(x.billable_amount ?? x.billableAmount),
                internalCostAmount: dashNum(x.internal_cost_amount ?? x.internalCostAmount),
            };
        })
        : [];
    const teamRaw = o.team ?? o.team_members ?? o.members ?? o.project_team;
    const team: TimeManagerProjectDashboardTeamMember[] = Array.isArray(teamRaw)
        ? teamRaw.map((item) => {
            const x = item as Record<string, unknown>;
            const uid = dashStr(x.user_id ?? x.userId) ?? '';
            return {
                userId: uid || `user-${Math.random().toString(36).slice(2)}`,
                name: dashStr(x.name) ?? '—',
                hours: dashNum(x.hours),
                billableHours: dashNum(x.billable_hours ?? x.billableHours),
                nonBillableHours: dashNum(x.non_billable_hours ?? x.nonBillableHours),
                billableAmount: dashNum(x.billable_amount ?? x.billableAmount),
                internalCostAmount: dashNum(x.internal_cost_amount ?? x.internalCostAmount),
            };
        })
        : [];
    const invRaw = o.invoices;
    const invoices: TimeManagerProjectDashboardInvoice[] = Array.isArray(invRaw)
        ? invRaw.map((item) => {
            const x = item as Record<string, unknown>;
            const id = dashStr(x.id) ?? '';
            return {
                id: id || `inv-${Math.random().toString(36).slice(2)}`,
                issuedAt: dashStr(x.issued_at ?? x.issuedAt),
                amount: dashNum(x.amount),
                currency: dashStr(x.currency) ?? 'USD',
                status: dashStr(x.status),
            };
        })
        : [];
    let budget: TimeManagerProjectDashboardBudget | undefined;
    const bRaw = o.budget;
    const readPct = (v: unknown): number | null => {
        if (v == null || v === '')
            return null;
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : null;
    };
    const readBudgetSlice = (raw: unknown): TimeManagerProjectDashboardBudgetSlice | null => {
        if (raw == null || typeof raw !== 'object')
            return null;
        const x = raw as Record<string, unknown>;
        return {
            budget: dashNum(x.budget ?? x.limit),
            spent: dashNum(x.spent),
            remaining: dashNum(x.remaining),
            percentUsed: readPct(x.percent_used ?? x.percentUsed),
        };
    };
    if (bRaw && typeof bRaw === 'object') {
        const b = bRaw as Record<string, unknown>;
        const hasBudget = dashBool(b.has_budget ?? b.hasBudget, false);
        const by = String(b.budget_by ?? b.budgetBy ?? '').toLowerCase().replace(/-/g, '_');
        const cur = dashStr(b.currency) ?? dashStr(o.currency) ?? 'USD';
        const pctRoot = readPct(b.percent_used ?? b.percentUsed);
        if (!hasBudget || by === 'none' || by === '') {
            budget = undefined;
        }
        else if (by === 'hours_and_money' || by === 'hoursandmoney') {
            const money = readBudgetSlice(b.budgetMoney ?? b.budget_money)
                ?? readBudgetSlice(b.money);
            const hours = readBudgetSlice(b.hoursBudget ?? b.hours_budget)
                ?? (b.budgetHours != null && typeof b.budgetHours === 'object'
                    ? readBudgetSlice(b.budgetHours)
                    : readBudgetSlice(b.hours));
            if (money && hours) {
                budget = {
                    hasBudget,
                    budgetBy: 'hours_and_money',
                    currency: cur,
                    budget: money.budget,
                    spent: money.spent,
                    remaining: money.remaining,
                    percentUsed: pctRoot,
                    money,
                    hours,
                    percentUsedMoney: readPct(b.percent_used_money ?? b.percentUsedMoney) ?? money.percentUsed,
                    percentUsedHours: readPct(b.percent_used_hours ?? b.percentUsedHours) ?? hours.percentUsed,
                };
            }
        }
        if (!budget && hasBudget && by !== 'none' && by !== '' && by !== 'hours_and_money' && by !== 'hoursandmoney') {
            const budgetBy: 'money' | 'hours' = by === 'hours' ? 'hours' : 'money';
            budget = {
                hasBudget,
                budgetBy,
                currency: cur,
                budget: dashNum(b.budget),
                spent: dashNum(b.spent),
                remaining: dashNum(b.remaining),
                percentUsed: pctRoot,
            };
        }
    }
    return {
        currency: dashStr(o.currency),
        totals,
        progressByWeek,
        hoursByWeek,
        tasks,
        team,
        invoices,
        ...(budget ? { budget } : {}),
    };
}
export type ProjectDashboardQuery = {
    dateFrom?: string;
    dateTo?: string;
};
export async function getClientProjectDashboard(clientId: string, projectId: string, query?: ProjectDashboardQuery): Promise<TimeManagerProjectDashboard | null> {
    const qs = new URLSearchParams();
    if (query?.dateFrom) {
        qs.set('dateFrom', query.dateFrom);
        qs.set('date_from', query.dateFrom);
    }
    if (query?.dateTo) {
        qs.set('dateTo', query.dateTo);
        qs.set('date_to', query.dateTo);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}/dashboard${suffix}`);
    if (res.status === 404)
        return null;
    await throwIfNotOk(res);
    let body: unknown;
    try {
        body = await res.json();
    }
    catch {
        return null;
    }
    return normalizeProjectDashboard(body);
}
export type TimeManagerClientProjectCodeHint = {
    last_code: string | null;
    suggested_next: string | null;
};
export type TimeManagerInitialProjectAccessMember = {
    authUserId: number;
    /** Сумма billable за час для этого участника на проекте; валюта = валюта проекта. */
    billableHourlyAmount?: number | string | null;
};
export type TimeManagerClientProjectCreatePayload = {
    name: string;
    code?: string | null;
    currency?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
    reportVisibility?: string;
    projectType?: string;
    billableRateType?: string | null;
    
    projectBillableRateAmount?: string | number | null;
    budgetType?: string | null;
    budgetAmount?: string | number | null;
    progressBudgetAmount?: string | number | null;
    budgetHours?: string | number | null;
    budgetResetsEveryMonth?: boolean;
    budgetIncludesExpenses?: boolean;
    sendBudgetAlerts?: boolean;
    budgetAlertThresholdPercent?: string | number | null;
    fixedFeeAmount?: string | number | null;

    /** `auth_user_id` — сразу выдать доступ к проекту при создании (gateway → TT). */
    initialTimeTrackingUserAuthIds?: number[];
    /**
     * Billable за час по проекту в том же порядке, что и `initialTimeTrackingUserAuthIds` (та же длина).
     * Несовместимо с непустым `initialProjectAccessMembers`.
     */
    initialTimeTrackingUserBillableHourlyAmounts?: (number | null)[];
    /**
     * Участники со ставкой на проекте; непустой список на бэкенде задаёт состав команды
     * (вместо отдельного initialTimeTrackingUserAuthIds).
     */
    initialProjectAccessMembers?: TimeManagerInitialProjectAccessMember[];
};
export type TimeManagerClientProjectPatchPayload = {
    name?: string;
    code?: string | null;
    currency?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
    reportVisibility?: string;
    projectType?: string;
    billableRateType?: string | null;
    projectBillableRateAmount?: string | number | null;
    budgetType?: string | null;
    budgetAmount?: string | number | null;
    progressBudgetAmount?: string | number | null;
    budgetHours?: string | number | null;
    budgetResetsEveryMonth?: boolean;
    budgetIncludesExpenses?: boolean;
    sendBudgetAlerts?: boolean;
    budgetAlertThresholdPercent?: string | number | null;
    fixedFeeAmount?: string | number | null;
};
function projectCreateBody(body: TimeManagerClientProjectCreatePayload): Record<string, unknown> {
    const o: Record<string, unknown> = { name: body.name };
    const members = body.initialProjectAccessMembers ?? [];
    const hasMembers = members.length > 0;
    const hasParallelBillableAmounts = body.initialTimeTrackingUserBillableHourlyAmounts != null
        && body.initialTimeTrackingUserBillableHourlyAmounts.length > 0;
    if (hasMembers && hasParallelBillableAmounts) {
        throw new Error(
            'Нельзя одновременно передавать initialProjectAccessMembers и initialTimeTrackingUserBillableHourlyAmounts',
        );
    }
    if (body.code !== undefined)
        o.code = body.code;
    if (body.currency !== undefined && body.currency !== null && String(body.currency).trim()) {
        o.currency = String(body.currency).trim();
    }
    if (body.startDate !== undefined)
        o.startDate = body.startDate;
    if (body.endDate !== undefined)
        o.endDate = body.endDate;
    if (body.notes !== undefined)
        o.notes = body.notes;
    if (body.reportVisibility !== undefined)
        o.reportVisibility = body.reportVisibility;
    if (body.projectType !== undefined)
        o.projectType = body.projectType;
    if (body.billableRateType !== undefined)
        o.billableRateType = body.billableRateType;
    if (body.projectBillableRateAmount !== undefined)
        o.projectBillableRateAmount = body.projectBillableRateAmount;
    if (body.budgetType !== undefined)
        o.budgetType = body.budgetType;
    if (body.budgetAmount !== undefined)
        o.budgetAmount = body.budgetAmount;
    if (body.progressBudgetAmount !== undefined)
        o.progressBudgetAmount = body.progressBudgetAmount;
    if (body.budgetHours !== undefined)
        o.budgetHours = body.budgetHours;
    if (body.budgetResetsEveryMonth !== undefined)
        o.budgetResetsEveryMonth = body.budgetResetsEveryMonth;
    if (body.budgetIncludesExpenses !== undefined)
        o.budgetIncludesExpenses = body.budgetIncludesExpenses;
    if (body.sendBudgetAlerts !== undefined)
        o.sendBudgetAlerts = body.sendBudgetAlerts;
    if (body.budgetAlertThresholdPercent !== undefined)
        o.budgetAlertThresholdPercent = body.budgetAlertThresholdPercent;
    if (body.fixedFeeAmount !== undefined)
        o.fixedFeeAmount = body.fixedFeeAmount;
    if (hasMembers) {
        o.initialProjectAccessMembers = members.map((m) => {
            const row: Record<string, unknown> = { authUserId: m.authUserId };
            if (m.billableHourlyAmount != null && m.billableHourlyAmount !== '') {
                const raw = typeof m.billableHourlyAmount === 'number'
                    ? m.billableHourlyAmount
                    : parseFloat(String(m.billableHourlyAmount).replace(',', '.'));
                if (Number.isFinite(raw))
                    row.billableHourlyAmount = raw;
            }
            return row;
        });
    }
    else if (body.initialTimeTrackingUserAuthIds != null && body.initialTimeTrackingUserAuthIds.length > 0) {
        const rawIds = body.initialTimeTrackingUserAuthIds.filter((n) => Number.isFinite(n) && n > 0);
        const amtsIn = body.initialTimeTrackingUserBillableHourlyAmounts;
        const useAmts = amtsIn != null && amtsIn.length > 0;
        if (useAmts && amtsIn.length !== rawIds.length) {
            throw new Error(
                'initialTimeTrackingUserBillableHourlyAmounts должны совпадать по длине с initialTimeTrackingUserAuthIds',
            );
        }
        const seen = new Set<number>();
        const ids: number[] = [];
        const amtsOut: (number | null)[] = [];
        for (let i = 0; i < rawIds.length; i++) {
            const id = rawIds[i];
            if (seen.has(id))
                continue;
            seen.add(id);
            ids.push(id);
            if (useAmts) {
                const x = amtsIn[i];
                amtsOut.push(x != null && Number.isFinite(x) ? x : null);
            }
        }
        o.initialTimeTrackingUserAuthIds = ids;
        if (useAmts)
            o.initialTimeTrackingUserBillableHourlyAmounts = amtsOut;
    }
    return o;
}
function projectPatchBody(patch: TimeManagerClientProjectPatchPayload): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    if (patch.name !== undefined)
        o.name = patch.name;
    if (patch.code !== undefined)
        o.code = patch.code;
    if (patch.currency !== undefined)
        o.currency = patch.currency;
    if (patch.startDate !== undefined)
        o.startDate = patch.startDate;
    if (patch.endDate !== undefined)
        o.endDate = patch.endDate;
    if (patch.notes !== undefined)
        o.notes = patch.notes;
    if (patch.reportVisibility !== undefined)
        o.reportVisibility = patch.reportVisibility;
    if (patch.projectType !== undefined)
        o.projectType = patch.projectType;
    if (patch.billableRateType !== undefined)
        o.billableRateType = patch.billableRateType;
    if (patch.projectBillableRateAmount !== undefined)
        o.projectBillableRateAmount = patch.projectBillableRateAmount;
    if (patch.budgetType !== undefined)
        o.budgetType = patch.budgetType;
    if (patch.budgetAmount !== undefined)
        o.budgetAmount = patch.budgetAmount;
    if (patch.progressBudgetAmount !== undefined)
        o.progressBudgetAmount = patch.progressBudgetAmount;
    if (patch.budgetHours !== undefined)
        o.budgetHours = patch.budgetHours;
    if (patch.budgetResetsEveryMonth !== undefined)
        o.budgetResetsEveryMonth = patch.budgetResetsEveryMonth;
    if (patch.budgetIncludesExpenses !== undefined)
        o.budgetIncludesExpenses = patch.budgetIncludesExpenses;
    if (patch.sendBudgetAlerts !== undefined)
        o.sendBudgetAlerts = patch.sendBudgetAlerts;
    if (patch.budgetAlertThresholdPercent !== undefined)
        o.budgetAlertThresholdPercent = patch.budgetAlertThresholdPercent;
    if (patch.fixedFeeAmount !== undefined)
        o.fixedFeeAmount = patch.fixedFeeAmount;
    return o;
}
export async function getClientProjectCodeHint(clientId: string): Promise<TimeManagerClientProjectCodeHint> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/code-hint`);
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientProjectCodeHint;
}
export async function listClientProjects(clientId: string): Promise<TimeManagerClientProjectRow[]>;
export async function listClientProjects(clientId: string, pagination: TimeTrackingPaginationParams): Promise<PaginatedResult<TimeManagerClientProjectRow>>;
export async function listClientProjects(clientId: string, pagination?: TimeTrackingPaginationParams): Promise<TimeManagerClientProjectRow[] | PaginatedResult<TimeManagerClientProjectRow>> {
    const qs = new URLSearchParams();
    if (pagination) {
        qs.set('limit', String(pagination.limit));
        qs.set('offset', String(pagination.offset ?? 0));
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects${suffix}`);
    await throwIfNotOk(res);
    const raw = await res.json();
    if (pagination) {
        const off = pagination.offset ?? 0;
        return parseTimeTrackingPagedResponse(raw, (item) => item as TimeManagerClientProjectRow, {
            limit: pagination.limit,
            offset: off,
        });
    }
    const arr = unwrapTimeTrackingListArray(raw);
    if (!arr)
        return [];
    return arr as TimeManagerClientProjectRow[];
}
const TIME_TRACKING_MERGE_PAGE_SIZE = 500;
async function mergeTimeTrackingOffsetPages<T>(fetchPage: (offset: number) => Promise<PaginatedResult<T>>): Promise<T[]> {
    const acc: T[] = [];
    let offset = 0;
    while (true) {
        const page = await fetchPage(offset);
        acc.push(...page.items);
        if (page.items.length === 0)
            break;
        offset += page.items.length;
        if (Number.isFinite(page.total) && offset >= page.total)
            break;
        if (page.items.length < page.limit)
            break;
    }
    return acc;
}
export async function listAllTimeManagerClientsMerged(includeArchived = false): Promise<TimeManagerClientRow[]> {
    const acc = await mergeTimeTrackingOffsetPages((offset) => listTimeManagerClients(includeArchived, {
        limit: TIME_TRACKING_MERGE_PAGE_SIZE,
        offset,
    }) as Promise<PaginatedResult<TimeManagerClientRow>>);
    acc.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    return acc;
}
export async function listAllClientProjectsForClientMerged(clientId: string): Promise<TimeManagerClientProjectRow[]> {
    const acc = await mergeTimeTrackingOffsetPages((offset) => listClientProjects(clientId, {
        limit: TIME_TRACKING_MERGE_PAGE_SIZE,
        offset,
    }) as Promise<PaginatedResult<TimeManagerClientProjectRow>>);
    acc.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    return acc;
}
export async function getClientProject(clientId: string, projectId: string): Promise<TimeManagerClientProjectRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}`);
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientProjectRow;
}
export async function createClientProject(clientId: string, body: TimeManagerClientProjectCreatePayload): Promise<TimeManagerClientProjectRow> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectCreateBody(body)),
    });
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientProjectRow;
}
export async function patchClientProject(clientId: string, projectId: string, patch: TimeManagerClientProjectPatchPayload): Promise<TimeManagerClientProjectRow> {
    const payload = projectPatchBody(patch);
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    return (await res.json()) as TimeManagerClientProjectRow;
}
export async function deleteClientProject(clientId: string, projectId: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}
function projectForExpenseToPickerStub(p: TimeTrackingProjectForExpense): TimeManagerClientProjectRow {
    const cur = (p.currency ?? '').trim().toUpperCase();
    const safeCur = TIME_TRACKING_PROJECT_CURRENCIES.includes(cur as TimeManagerProjectCurrency) ? cur : 'USD';
    return {
        id: p.id,
        client_id: p.clientId,
        name: p.name,
        code: p.code,
        currency: safeCur,
        start_date: null,
        end_date: p.endDate ?? null,
        notes: null,
        report_visibility: '',
        project_type: (p.projectType ?? '').trim() || 'time_and_materials',
        billable_rate_type: null,
        project_billable_rate_amount: null,
        budget_type: null,
        budget_amount: null,
        progress_budget_amount: null,
        budget_hours: null,
        budget_resets_every_month: false,
        budget_includes_expenses: false,
        send_budget_alerts: false,
        budget_alert_threshold_percent: null,
        fixed_fee_amount: null,
        usage_count: 0,
        deletable: false,
        created_at: '',
        updated_at: null,
    };
}
async function fetchAllProjectsForExpensesMerged(options?: {
    includeArchived?: boolean;
}): Promise<TimeTrackingProjectForExpense[]> {
    return mergeTimeTrackingOffsetPages((offset) => listProjectsForExpenses({
        ...options,
        limit: PROJECTS_FOR_EXPENSES_PAGE_SIZE,
        offset,
    }) as Promise<PaginatedResult<TimeTrackingProjectForExpense>>);
}
export async function listAllClientProjectsForPicker(): Promise<TimeManagerClientProjectRow[]> {
    const flat = await fetchAllProjectsForExpensesMerged({ includeArchived: true });
    if (flat.length === 0)
        return [];
    const sorted = [...flat].sort((a, b) => {
        const cmp = a.clientName.localeCompare(b.clientName, 'ru', { sensitivity: 'base' });
        if (cmp !== 0)
            return cmp;
        return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
    });
    return sorted.map(projectForExpenseToPickerStub);
}
export function isForbiddenError(e: unknown): boolean {
    return (e instanceof Error &&
        /\b403\b|HTTP\s*403|Недостаточно прав|доступны только администраторам|доступны администраторам|доступа к проектам/i.test(e.message));
}
export type ReportTypeIdApi = 'time' | 'contractor' | 'uninvoiced';
export type ReportGroupIdApi = 'tasks' | 'clients' | 'projects' | 'team';
export type ReportSortId = 'date_asc' | 'date_desc' | 'hours_asc' | 'hours_desc';
export type ReportsMeta = {
    reportTypes: ReportTypeIdApi[];
    groupOptions: ReportGroupIdApi[];
    pageSizeMax: number;
    currencies: string[];
};
export type ReportsFilterUser = {
    id: number;
    displayName: string;
    email: string;
};
export type ReportMoneyAmount = {
    value: number;
    currency: string;
};
export type ReportsSummaryTime = {
    reportType: 'time';
    period: {
        dateFrom: string;
        dateTo: string;
    };
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: ReportMoneyAmount;
    unbilledAmount: ReportMoneyAmount;
};
export type ReportsSummaryContractor = {
    reportType: 'contractor';
    period: {
        dateFrom: string;
        dateTo: string;
    };
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: ReportMoneyAmount;
    contractorHours: number;
    contractorCost: ReportMoneyAmount;
};
export type ReportsSummaryUninvoiced = {
    reportType: 'uninvoiced';
    period: {
        dateFrom: string;
        dateTo: string;
    };
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: ReportMoneyAmount;
    uninvoicedHours: number;
    amountToInvoice: ReportMoneyAmount;
};
export type ReportsSummary = ReportsSummaryTime | ReportsSummaryContractor | ReportsSummaryUninvoiced;
export type ReportsTableParams = {
    reportType: ReportTypeIdApi;
    dateFrom: string;
    dateTo: string;
    group?: ReportGroupIdApi;
    sort?: ReportSortId;
    page?: number;
    pageSize?: number;
    userIds?: number[];
    projectIds?: string[];
    clientIds?: string[];
    includeFixedFeeProjects?: boolean;
};
export type ReportRowAggregate = {
    projectId?: string;
    clientId?: string;
    clientName?: string;
    taskId?: string;
    userId?: number;
    name: string;
    code?: string | null;
    hours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: number;
    currency: string;
    invoicedAmount: number;
};
export type ReportTableRow = ReportRowAggregate;
export type ReportsTableResponse = {
    rows: ReportTableRow[];
    totalCount: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
};
export type ReportSavedViewFilters = Omit<ReportsTableParams, 'page' | 'pageSize'>;
export type ReportSavedView = {
    id: string;
    name: string;
    ownerUserId: number;
    filters: ReportSavedViewFilters;
    createdAt: string;
    updatedAt: string | null;
};
export type ReportSnapshotRow = {
    id: string;
    sortOrder: number;
    sourceType: string;
    sourceId: string;
    data: Record<string, unknown>;
    
    effective?: Record<string, unknown> | null;
    overrides: Record<string, unknown> | null;
    editedByUserId: number | null;
    editedAt: string | null;
};
export type ReportSnapshot = {
    id: string;
    name: string;
    reportType: ReportTypeIdApi;
    groupBy: ReportGroupIdApi | null;
    filters: Record<string, unknown>;
    version: number;
    createdByUserId: number;
    createdAt: string;
    updatedAt: string | null;
    rowCount: number;
    rows?: ReportSnapshotRow[];
};
async function reportsThrowIfNotOk(res: Response): Promise<void> {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const j = (await res.clone().json()) as {
                detail?: string;
                message?: string;
            };
            if (j.detail)
                msg = j.detail;
            else if (j.message)
                msg = j.message;
        }
        catch { }
        if (res.status === 401 && msg === 'HTTP 401')
            msg = 'Требуется вход или сессия истекла';
        else if (res.status === 403 && msg === 'HTTP 403')
            msg = 'Нет доступа к этой операции';
        throw new TimeTrackingHttpError(res.status, normalizeLegacyTimeTrackingUsersError(msg));
    }
}
function buildReportsQs(params: ReportsTableParams & {
    format?: string;
}): string {
    const qs = new URLSearchParams();
    qs.set('reportType', params.reportType);
    qs.set('dateFrom', params.dateFrom);
    qs.set('dateTo', params.dateTo);
    qs.set('from', params.dateFrom);
    qs.set('to', params.dateTo);
    if (params.group)
        qs.set('group', params.group);
    if (params.sort)
        qs.set('sort', params.sort);
    if (params.page != null)
        qs.set('page', String(params.page));
    if (params.pageSize != null)
        qs.set('pageSize', String(params.pageSize));
    if (params.userIds?.length)
        qs.set('userIds', params.userIds.join(','));
    if (params.projectIds?.length)
        qs.set('projectIds', params.projectIds.join(','));
    if (params.clientIds?.length)
        qs.set('clientIds', params.clientIds.join(','));
    if (params.includeFixedFeeProjects != null)
        qs.set('includeFixedFeeProjects', String(params.includeFixedFeeProjects));
    if (params.format)
        qs.set('format', params.format);
    return qs.toString();
}
export async function fetchReportsMeta(): Promise<ReportsMeta> {
    const res = await apiFetch('/api/v1/time-tracking/reports/meta');
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportsMeta>;
}
export async function fetchReportsUsersForFilter(): Promise<ReportsFilterUser[]> {
    const res = await apiFetch('/api/v1/time-tracking/reports/users-for-filter');
    await reportsThrowIfNotOk(res);
    const raw = (await res.json()) as unknown[];
    return raw.map((item) => {
        const o = item as Record<string, unknown>;
        const id = Number(o.id ?? o.authUserId ?? o.auth_user_id);
        const displayName = String(o.displayName ?? o.display_name ?? '').trim();
        const email = String(o.email ?? '');
        return {
            id: Number.isFinite(id) ? id : 0,
            displayName: displayName || email || `user ${id}`,
            email,
        };
    });
}
export async function fetchReportsSummary(params: Pick<ReportsTableParams, 'reportType' | 'dateFrom' | 'dateTo' | 'userIds' | 'projectIds' | 'clientIds' | 'includeFixedFeeProjects'>): Promise<ReportsSummary> {
    const qs = buildReportsQs({ ...params, group: undefined, sort: undefined });
    const res = await apiFetch(`/api/v1/time-tracking/reports/summary?${qs}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportsSummary>;
}
export async function fetchReportsTable(params: ReportsTableParams): Promise<ReportsTableResponse> {
    const qs = buildReportsQs(params);
    const res = await apiFetch(`/api/v1/time-tracking/reports/table?${qs}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportsTableResponse>;
}
export async function exportReportsTable(params: ReportsTableParams & {
    format: 'csv' | 'json';
}): Promise<{
    blob: Blob;
    filename: string;
}> {
    const qs = buildReportsQs(params);
    const res = await apiFetch(`/api/v1/time-tracking/reports/table/export?${qs}`);
    await reportsThrowIfNotOk(res);
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    const filename = cd.split('filename=')[1]?.replace(/"/g, '').trim() || `report.${params.format}`;
    return { blob, filename };
}
export async function listReportSavedViews(ownerUserId?: number): Promise<ReportSavedView[]> {
    const qs = ownerUserId != null ? `?ownerUserId=${ownerUserId}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/reports/saved-views${qs}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSavedView[]>;
}
export async function createReportSavedView(body: {
    name: string;
    filters: ReportSavedViewFilters;
}, ownerUserId?: number): Promise<ReportSavedView> {
    const qs = ownerUserId != null ? `?ownerUserId=${ownerUserId}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/reports/saved-views${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSavedView>;
}
export async function updateReportSavedView(id: string, body: Partial<{
    name: string;
    filters: ReportSavedViewFilters;
}>): Promise<ReportSavedView> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/saved-views/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSavedView>;
}
export async function deleteReportSavedView(id: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/saved-views/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await reportsThrowIfNotOk(res);
}
export async function listReportSnapshots(createdByUserId?: number): Promise<ReportSnapshot[]> {
    const qs = createdByUserId != null ? `?createdByUserId=${createdByUserId}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots${qs}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSnapshot[]>;
}
export async function createReportSnapshot(body: {
    name: string;
    reportType: ReportTypeIdApi;
    groupBy?: ReportGroupIdApi | null;
    filters: ReportSavedViewFilters;
}, createdByUserId?: number): Promise<ReportSnapshot> {
    const qs = createdByUserId != null ? `?createdByUserId=${createdByUserId}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSnapshot>;
}
export async function getReportSnapshot(id: string): Promise<ReportSnapshot> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots/${encodeURIComponent(id)}`);
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSnapshot>;
}
export async function patchReportSnapshotRow(snapshotId: string, rowId: string, overrides: Record<string, unknown>, editedByUserId?: number): Promise<ReportSnapshotRow> {
    const qs = editedByUserId != null ? `?editedByUserId=${editedByUserId}` : '';
    const safe = pickAllowedSnapshotOverrides(overrides);
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots/${encodeURIComponent(snapshotId)}/rows/${encodeURIComponent(rowId)}${qs}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: safe }),
    });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSnapshotRow>;
}
export async function rebuildReportSnapshot(id: string): Promise<ReportSnapshot> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots/${encodeURIComponent(id)}/rebuild-from-source`, { method: 'POST' });
    await reportsThrowIfNotOk(res);
    return res.json() as Promise<ReportSnapshot>;
}
export async function deleteReportSnapshot(id: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await reportsThrowIfNotOk(res);
}
export async function exportReportSnapshot(id: string, format: 'csv' | 'json'): Promise<{
    blob: Blob;
    filename: string;
}> {
    const res = await apiFetch(`/api/v1/time-tracking/reports/snapshots/${encodeURIComponent(id)}/export?format=${format}`);
    await reportsThrowIfNotOk(res);
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    const filename = cd.split('filename=')[1]?.replace(/"/g, '').trim() || `snapshot-${id}.${format}`;
    return { blob, filename };
}

/** Ответы POST/GGET partner-confirmations (camelCase, см. Gateway / FRONTEND_INTEGRATION.md). */
export type PartnerReportConfirmationSignature = {
    partnerAuthUserId: number;
    confirmedAt: string;
};
export type PartnerReportConfirmationRequest = {
    id: string;
    snapshotId: string;
    projectId: string;
    dateFrom: string;
    dateTo: string;
    title: string;
    status: string;
    submittedByAuthUserId: number;
    requiredPartnerAuthUserIds: number[];
    pendingPartnerAuthUserIds: number[];
    /** Если бэкенд отдаёт — счёт, созданный из этого подтверждённого периода. */
    invoiceId?: string;
    signatures: PartnerReportConfirmationSignature[];
    createdAt: string;
    updatedAt: string | null;
};
function readPartnerConfirmNum(v: unknown): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function parsePartnerReportConfirmationSignature(raw: unknown): PartnerReportConfirmationSignature | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const partnerAuthUserId = readPartnerConfirmNum(o.partnerAuthUserId ?? o.partner_auth_user_id);
    const confirmedAt = String(o.confirmedAt ?? o.confirmed_at ?? '').trim();
    if (partnerAuthUserId == null || !confirmedAt)
        return null;
    return { partnerAuthUserId, confirmedAt };
}
export function parsePartnerReportConfirmationRequest(raw: unknown): PartnerReportConfirmationRequest | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = String(o.id ?? '').trim();
    const snapshotId = String(o.snapshotId ?? o.snapshot_id ?? '').trim();
    const projectId = String(o.projectId ?? o.project_id ?? '').trim();
    const dateFrom = String(o.dateFrom ?? o.date_from ?? '').slice(0, 10);
    const dateTo = String(o.dateTo ?? o.date_to ?? '').slice(0, 10);
    const submittedByAuthUserId = readPartnerConfirmNum(o.submittedByAuthUserId ?? o.submitted_by_auth_user_id);
    if (!id || !snapshotId || !projectId || !dateFrom || !dateTo || submittedByAuthUserId == null)
        return null;
    const reqArr = o.requiredPartnerAuthUserIds ?? o.required_partner_auth_user_ids;
    const pendArr = o.pendingPartnerAuthUserIds ?? o.pending_partner_auth_user_ids;
    const sigRaw = Array.isArray(o.signatures) ? o.signatures : [];
    const invoiceIdRaw = o.invoiceId ?? o.invoice_id ?? o.linkedInvoiceId ?? o.linked_invoice_id;
    const invoiceId = invoiceIdRaw != null && String(invoiceIdRaw).trim()
        ? String(invoiceIdRaw).trim()
        : undefined;
    const requiredPartnerAuthUserIds = (Array.isArray(reqArr) ? reqArr : []).map(readPartnerConfirmNum).filter((x): x is number => x != null);
    const pendingPartnerAuthUserIds = (Array.isArray(pendArr) ? pendArr : []).map(readPartnerConfirmNum).filter((x): x is number => x != null);
    const signatures = sigRaw.map(parsePartnerReportConfirmationSignature).filter((x): x is PartnerReportConfirmationSignature => x != null);
    const updatedRaw = o.updatedAt ?? o.updated_at;
    return {
        id,
        snapshotId,
        projectId,
        dateFrom,
        dateTo,
        title: String(o.title ?? ''),
        status: String(o.status ?? ''),
        submittedByAuthUserId,
        requiredPartnerAuthUserIds,
        pendingPartnerAuthUserIds,
        signatures,
        createdAt: String(o.createdAt ?? o.created_at ?? ''),
        updatedAt: updatedRaw == null || updatedRaw === '' ? null : String(updatedRaw),
        ...(invoiceId ? { invoiceId } : {}),
    };
}
function parsePartnerReportConfirmationRequestList(raw: unknown): PartnerReportConfirmationRequest[] {
    if (!Array.isArray(raw))
        return [];
    return raw.map(parsePartnerReportConfirmationRequest).filter((x): x is PartnerReportConfirmationRequest => x != null);
}
export async function listPartnerReportConfirmationsPending(): Promise<PartnerReportConfirmationRequest[]> {
    const res = await apiFetch('/api/v1/time-tracking/reports/partner-confirmations/pending');
    await reportsThrowIfNotOk(res);
    return parsePartnerReportConfirmationRequestList(await res.json());
}
export async function listPartnerReportConfirmationsConfirmed(): Promise<PartnerReportConfirmationRequest[]> {
    const res = await apiFetch('/api/v1/time-tracking/reports/partner-confirmations/confirmed');
    await reportsThrowIfNotOk(res);
    return parsePartnerReportConfirmationRequestList(await res.json());
}
export async function submitPartnerReportConfirmation(body: {
    snapshotId: string;
    projectId: string;
    dateFrom: string;
    dateTo: string;
}): Promise<PartnerReportConfirmationRequest> {
    const res = await apiFetch('/api/v1/time-tracking/reports/partner-confirmations/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            snapshotId: body.snapshotId.trim(),
            projectId: body.projectId.trim(),
            dateFrom: body.dateFrom.slice(0, 10),
            dateTo: body.dateTo.slice(0, 10),
        }),
    });
    await reportsThrowIfNotOk(res);
    const parsed = parsePartnerReportConfirmationRequest(await res.json());
    if (!parsed)
        throw new TimeTrackingHttpError(500, 'Некорректный ответ сервера');
    return parsed;
}
/** Создаёт на сервере снимок отчёта по проекту и запись подтверждения за период (если ещё нет дубликата). */
export async function submitPartnerReportConfirmationFromPreview(body: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
}): Promise<PartnerReportConfirmationRequest> {
    const res = await apiFetch('/api/v1/time-tracking/reports/partner-confirmations/submit-from-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            projectId: body.projectId.trim(),
            dateFrom: body.dateFrom.slice(0, 10),
            dateTo: body.dateTo.slice(0, 10),
        }),
    });
    await reportsThrowIfNotOk(res);
    const parsed = parsePartnerReportConfirmationRequest(await res.json());
    if (!parsed)
        throw new TimeTrackingHttpError(500, 'Некорректный ответ сервера');
    return parsed;
}
export async function confirmPartnerReportConfirmation(requestId: string): Promise<PartnerReportConfirmationRequest> {
    const rid = String(requestId ?? '').trim();
    if (!rid)
        throw new Error('Не указан запрос подтверждения');
    const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/${encodeURIComponent(rid)}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
    await reportsThrowIfNotOk(res);
    const parsed = parsePartnerReportConfirmationRequest(await res.json());
    if (!parsed)
        throw new TimeTrackingHttpError(500, 'Некорректный ответ сервера');
    return parsed;
}
export type InvoiceUiStatus = 'draft' | 'sent' | 'viewed' | 'partial_paid' | 'paid' | 'canceled' | 'overdue';
export type InvoiceLineDto = {
    id: string;
    sortOrder: number;
    lineKind: string;
    description: string | null;
    quantity: number;
    unitAmount: number;
    lineTotal: number;
    timeEntryId: string | null;
    expenseRequestId: string | null;
    /** ISO дата работы — с бэка для строк времени (без лишних GET time-entry) */
    timeEntryWorkDate?: string | null;
    /** Автор записи времени для сводки/инициалов */
    timeAuthorAuthUserId?: number | null;
    /** ISO дата заявки расхода (не путать с timeEntryWorkDate) */
    expenseDate?: string | null;
};
export type InvoicePaymentDto = {
    id: string;
    amount: number;
    paymentMethod: string | null;
    note: string | null;
    recordedByAuthUserId: number;
    paidAt: string;
    createdAt: string;
};
export type InvoiceDto = {
    id: string;
    clientId: string;
    projectId: string | null;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    currency: string;
    status: InvoiceUiStatus;
    storedStatus: string;
    subtotal: number;
    discountPercent: number | null;
    taxPercent: number | null;
    tax2Percent: number | null;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    clientNote: string | null;
    internalNote: string | null;
    sentAt: string | null;
    lastSentAt: string | null;
    viewedAt: string | null;
    canceledAt: string | null;
    createdByAuthUserId: number;
    createdAt: string;
    updatedAt: string | null;
    lines?: InvoiceLineDto[];
    payments?: InvoicePaymentDto[];

    partnerBillingPeriodFrom?: string | null;
    partnerBillingPeriodTo?: string | null;
    partnerConfirmationSnapshotId?: string | null;

    requiresPaymentConfirmationDocument?: boolean;
    paymentConfirmationDocumentUrl?: string | null;
    paymentConfirmationRecordedAt?: string | null;
};
export type UnbilledTimeEntryDto = {
    id: string;
    authUserId: number;
    workDate: string;
    hours: number;
    roundedHours?: number;
    durationSeconds?: number;
    description: string | null;
    billableAmount: number;
    currency: string;
};
export type UnbilledExpenseEntryDto = {
    id: string;
    expenseDate: string;
    description: string | null;
    equivalentAmount: number;
    status: string;
};
export type InvoiceListParams = {
    clientId?: string;
    projectId?: string;
    status?: InvoiceUiStatus | string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
    
    includeTotalCount?: boolean;
    /** Тройка параметров биллинга: при полном наборе бэкенд может вернуть пустой список без подтверждения партнёров (§ FRONTEND_INVOICE_PARTNER_CONFIRMATION). */
    partnerBillingProjectId?: string;
    partnerBillingPeriodFrom?: string;
    partnerBillingPeriodTo?: string;
};
export type InvoicesListResponse = {
    items: InvoiceDto[];
    limit: number;
    offset: number;
    totalCount?: number;
    /** Список пуст сознательно: нет fully_confirmed по проекту и периоду. */
    partnerConfirmationBlocked?: boolean;
};
export type InvoicesStatsCurrencyRow = {
    count: number;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
};
export type InvoicesAggregatedStats = {
    totalInvoices: number;
    byEffectiveStatus: Record<string, number>;
    byCurrency: Record<string, InvoicesStatsCurrencyRow>;
    totals: {
        totalAmount: number;
        amountPaid: number;
        balanceDue: number;
    };
    unpaidInvoicesCount: number;
    openBalanceDue: number;
    isCapped: boolean;
    cappedAt?: number;
};
export type InvoiceLineCreateInput = {
    lineKind: 'manual' | 'time' | 'expense';
    description?: string | null;
    quantity?: number | null;
    unitAmount?: number | null;
    lineTotal?: number | null;
    timeEntryId?: string | null;
    expenseRequestId?: string | null;
};
export type InvoiceCreateInput = {
    clientId: string;
    projectId?: string | null;
    issueDate: string;
    dueDate: string;
    currency?: string | null;
    taxPercent?: number | null;
    tax2Percent?: number | null;
    discountPercent?: number | null;
    clientNote?: string | null;
    internalNote?: string | null;
    timeEntryIds?: string[];
    expenseIds?: string[];
    lines?: InvoiceLineCreateInput[];
    /** Совпадают с dateFrom/dateTo подтверждённого отчёта при наличии time/expense/project lines (camelCase для API). */
    partnerBillingPeriodFrom?: string;
    partnerBillingPeriodTo?: string;
};
export type InvoicePatchInput = {
    issueDate?: string;
    dueDate?: string;
    clientNote?: string | null;
    internalNote?: string | null;
    taxPercent?: number | null;
    tax2Percent?: number | null;
    discountPercent?: number | null;
    projectId?: string | null;
    lines?: Record<string, unknown>[] | null;
};
export type InvoicePaymentInput = {
    amount?: number | string | null;
    paidAt?: string | null;
    paymentMethod?: string | null;
    note?: string | null;
};
export type InvoicePaymentConfirmationInput = {
    documentUrl?: string;
    document_url?: string;
};
export type InvoiceAuditEntryDto = {
    id: string;
    action: string;
    detail: string | null;
    actorAuthUserId: number;
    createdAt: string;
};
function buildInvoiceListQs(p: InvoiceListParams): string {
    const qs = new URLSearchParams();
    if (p.clientId)
        qs.set('clientId', p.clientId);
    if (p.projectId)
        qs.set('projectId', p.projectId);
    if (p.status)
        qs.set('status', p.status);
    if (p.dateFrom)
        qs.set('dateFrom', p.dateFrom);
    if (p.dateTo)
        qs.set('dateTo', p.dateTo);
    if (p.limit != null)
        qs.set('limit', String(p.limit));
    if (p.offset != null)
        qs.set('offset', String(p.offset));
    if (p.includeTotalCount)
        qs.set('includeTotalCount', 'true');
    if (p.partnerBillingProjectId?.trim())
        qs.set('partnerBillingProjectId', p.partnerBillingProjectId.trim());
    if (p.partnerBillingPeriodFrom?.trim())
        qs.set('partnerBillingPeriodFrom', p.partnerBillingPeriodFrom.trim().slice(0, 10));
    if (p.partnerBillingPeriodTo?.trim())
        qs.set('partnerBillingPeriodTo', p.partnerBillingPeriodTo.trim().slice(0, 10));
    const s = qs.toString();
    return s ? `?${s}` : '';
}
function buildInvoiceStatsQs(p: Omit<InvoiceListParams, 'limit' | 'offset' | 'includeTotalCount'>): string {
    const qs = new URLSearchParams();
    if (p.clientId)
        qs.set('clientId', p.clientId);
    if (p.projectId)
        qs.set('projectId', p.projectId);
    if (p.status)
        qs.set('status', p.status);
    if (p.dateFrom)
        qs.set('dateFrom', p.dateFrom);
    if (p.dateTo)
        qs.set('dateTo', p.dateTo);
    if (p.partnerBillingProjectId?.trim())
        qs.set('partnerBillingProjectId', p.partnerBillingProjectId.trim());
    if (p.partnerBillingPeriodFrom?.trim())
        qs.set('partnerBillingPeriodFrom', p.partnerBillingPeriodFrom.trim().slice(0, 10));
    if (p.partnerBillingPeriodTo?.trim())
        qs.set('partnerBillingPeriodTo', p.partnerBillingPeriodTo.trim().slice(0, 10));
    const s = qs.toString();
    return s ? `?${s}` : '';
}
function parseInvoicesAggregatedStats(raw: unknown): InvoicesAggregatedStats {
    const empty: InvoicesAggregatedStats = {
        totalInvoices: 0,
        byEffectiveStatus: {},
        byCurrency: {},
        totals: { totalAmount: 0, amountPaid: 0, balanceDue: 0 },
        unpaidInvoicesCount: 0,
        openBalanceDue: 0,
        isCapped: false,
    };
    if (!raw || typeof raw !== 'object')
        return empty;
    const o = raw as Record<string, unknown>;
    const byEff = o.byEffectiveStatus ?? o.by_effective_status;
    const byCur = o.byCurrency ?? o.by_currency;
    const totalsRaw = o.totals;
    const out: InvoicesAggregatedStats = {
        ...empty,
        totalInvoices: typeof o.totalInvoices === 'number' ? o.totalInvoices : Number(o.totalInvoices ?? o.total_invoices) || 0,
        unpaidInvoicesCount: typeof o.unpaidInvoicesCount === 'number'
            ? o.unpaidInvoicesCount
            : Number(o.unpaidInvoicesCount ?? o.unpaid_invoices_count) || 0,
        openBalanceDue: dashNum(o.openBalanceDue ?? o.open_balance_due),
        isCapped: o.isCapped === true || o.is_capped === true,
        cappedAt: typeof o.cappedAt === 'number' ? o.cappedAt : (typeof o.capped_at === 'number' ? o.capped_at : undefined),
    };
    if (byEff && typeof byEff === 'object' && !Array.isArray(byEff)) {
        const m: Record<string, number> = {};
        for (const [k, v] of Object.entries(byEff as Record<string, unknown>))
            m[k] = typeof v === 'number' ? v : Number(v) || 0;
        out.byEffectiveStatus = m;
    }
    if (byCur && typeof byCur === 'object' && !Array.isArray(byCur)) {
        const cur: Record<string, InvoicesStatsCurrencyRow> = {};
        for (const [code, row] of Object.entries(byCur as Record<string, unknown>)) {
            if (!row || typeof row !== 'object')
                continue;
            const r = row as Record<string, unknown>;
            cur[code] = {
                count: typeof r.count === 'number' ? r.count : Number(r.count) || 0,
                totalAmount: dashNum(r.totalAmount ?? r.total_amount),
                amountPaid: dashNum(r.amountPaid ?? r.amount_paid),
                balanceDue: dashNum(r.balanceDue ?? r.balance_due),
            };
        }
        out.byCurrency = cur;
    }
    if (totalsRaw && typeof totalsRaw === 'object') {
        const t = totalsRaw as Record<string, unknown>;
        out.totals = {
            totalAmount: dashNum(t.totalAmount ?? t.total_amount),
            amountPaid: dashNum(t.amountPaid ?? t.amount_paid),
            balanceDue: dashNum(t.balanceDue ?? t.balance_due),
        };
    }
    return out;
}
export async function fetchUnbilledTimeEntries(params: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
}): Promise<UnbilledTimeEntryDto[]> {
    const qs = new URLSearchParams({
        projectId: params.projectId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
    });
    const res = await apiFetch(`/api/v1/time-tracking/invoices/unbilled-time?${qs}`, invoiceApiFetchInit);
    await throwIfNotOk(res);
    return res.json() as Promise<UnbilledTimeEntryDto[]>;
}
export async function fetchUnbilledExpenses(params: {
    projectId: string;
    dateFrom: string;
    dateTo: string;
}): Promise<UnbilledExpenseEntryDto[]> {
    const qs = new URLSearchParams({
        projectId: params.projectId,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
    });
    const res = await apiFetch(`/api/v1/time-tracking/invoices/unbilled-expenses?${qs}`, invoiceApiFetchInit);
    await throwIfNotOk(res);
    return res.json() as Promise<UnbilledExpenseEntryDto[]>;
}
function readPartnerConfirmationBlocked(o: Record<string, unknown>): boolean {
    const v = o.partnerConfirmationBlocked ?? o.partner_confirmation_blocked;
    return v === true || v === 'true';
}

/** Сервер для счётов отдаёт Cache-Control: no-store; не берём данные счетов из кэша fetch. */
const invoiceApiFetchInit: RequestInit = { cache: 'no-store' };

export async function listInvoices(params?: InvoiceListParams): Promise<InvoicesListResponse> {
    const normalizeItem = (row: unknown): InvoiceDto => {
        try {
            return normalizeInvoiceDto(row);
        }
        catch {
            return row as InvoiceDto;
        }
    };
    const res = await apiFetch(`/api/v1/time-tracking/invoices${buildInvoiceListQs(params ?? {})}`, invoiceApiFetchInit);
    await throwIfNotOk(res);
    const raw = await res.json();
    if (Array.isArray(raw)) {
        return {
            items: raw.map(normalizeItem),
            limit: params?.limit ?? raw.length,
            offset: params?.offset ?? 0,
            partnerConfirmationBlocked: false,
        };
    }
    if (!raw || typeof raw !== 'object')
        return { items: [], limit: params?.limit ?? 0, offset: params?.offset ?? 0, partnerConfirmationBlocked: false };
    const o = raw as Record<string, unknown>;
    const itemsRaw = o.items;
    const itemsRawArr = Array.isArray(itemsRaw) ? itemsRaw : [];
    const items = itemsRawArr.map(normalizeItem);
    const limit = typeof o.limit === 'number' ? o.limit : Number(o.limit) || (params?.limit ?? 0);
    const offset = typeof o.offset === 'number' ? o.offset : Number(o.offset) || (params?.offset ?? 0);
    const tcRaw = o.totalCount ?? o.total_count;
    const totalCount = tcRaw != null && String(tcRaw).trim() !== '' && Number.isFinite(Number(tcRaw))
        ? Number(tcRaw)
        : undefined;
    const partnerConfirmationBlocked = readPartnerConfirmationBlocked(o);
    return {
        items,
        limit,
        offset,
        ...(totalCount != null ? { totalCount } : {}),
        ...(partnerConfirmationBlocked ? { partnerConfirmationBlocked: true } : {}),
    };
}
export async function getInvoicesAggregatedStats(params?: Omit<InvoiceListParams, 'limit' | 'offset' | 'includeTotalCount'>): Promise<InvoicesAggregatedStats> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/stats${buildInvoiceStatsQs(params ?? {})}`, invoiceApiFetchInit);
    await throwIfNotOk(res);
    const raw = await res.json();
    return parseInvoicesAggregatedStats(raw);
}

const INVOICE_AGGR_BALANCE_EPS = 1e-6;
const INVOICE_AGGR_PAGE = 500;
const INVOICE_AGGR_MAX_OFFSET = 250_000;

/**
 * Деньги и счётчики по фильтру без отменённых счетов (эффективный `status`).
 * Нужен для таблицы «Суммы по валютам», если /stats включает canceled.
 */
export async function aggregateInvoicesMoneyExcludingCanceled(params?: Omit<InvoiceListParams, 'limit' | 'offset' | 'includeTotalCount'>): Promise<{
    byCurrency: Record<string, InvoicesStatsCurrencyRow>;
    unpaidInvoicesCount: number;
    openBalanceDue: number;
}> {
    const p = params ?? {};
    const byCurrency: Record<string, InvoicesStatsCurrencyRow> = {};
    let unpaidInvoicesCount = 0;
    let openBalanceDue = 0;
    let offset = 0;
    for (;;) {
        const r = await listInvoices({
            ...p,
            limit: INVOICE_AGGR_PAGE,
            offset,
            includeTotalCount: false,
        });
        for (const inv of r.items) {
            const st = String(inv.status ?? '').toLowerCase();
            if (st === 'canceled' || st === 'cancelled')
                continue;
            const cur = (inv.currency && inv.currency.trim()) ? inv.currency.trim() : 'UZS';
            const prev = byCurrency[cur] ?? {
                count: 0,
                totalAmount: 0,
                amountPaid: 0,
                balanceDue: 0,
            };
            prev.count += 1;
            prev.totalAmount += Number(inv.totalAmount) || 0;
            prev.amountPaid += Number(inv.amountPaid) || 0;
            prev.balanceDue += Number(inv.balanceDue) || 0;
            byCurrency[cur] = prev;
            const bd = Number(inv.balanceDue) || 0;
            if (bd > INVOICE_AGGR_BALANCE_EPS) {
                unpaidInvoicesCount += 1;
                openBalanceDue += bd;
            }
        }
        if (r.items.length < INVOICE_AGGR_PAGE)
            break;
        offset += INVOICE_AGGR_PAGE;
        if (offset > INVOICE_AGGR_MAX_OFFSET)
            break;
    }
    return { byCurrency, unpaidInvoicesCount, openBalanceDue };
}

/** Нормализует строки счёта из ответа API (camelCase / snake_case, разные имена массива). */
function normalizeInvoiceLineDto(raw: unknown, fallbackIdx: number): InvoiceLineDto {
    const r = (raw != null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const pickStr = (...keys: string[]): string => {
        for (const k of keys) {
            const v = r[k];
            if (v == null || v === '')
                continue;
            const s = String(v).trim();
            if (s.length)
                return s;
        }
        return '';
    };
    const pickNum = (...keys: string[]): number => {
        for (const k of keys) {
            const v = r[k];
            if (typeof v === 'number' && Number.isFinite(v))
                return v;
            if (typeof v === 'string' && v.trim() !== '') {
                const n = Number(v.replace(',', '.'));
                if (Number.isFinite(n))
                    return n;
            }
        }
        return 0;
    };
    const id = pickStr('id', 'lineId', 'line_id');
    const lk = pickStr('lineKind', 'line_kind', 'kind', 'lineType', 'line_type').toLowerCase();
    const descRaw = r.description ?? r.line_description ?? r.lineDescription;
    let description: string | null = null;
    if (typeof descRaw === 'string')
        description = descRaw.trim() || null;
    else if (descRaw != null)
        description = String(descRaw).trim() || null;
    const timeEntryPick = pickStr('timeEntryId', 'time_entry_id', 'timeEntryID') || null;
    const expensePick = pickStr('expenseRequestId', 'expense_request_id', 'expenseId', 'expense_id') || null;

    const wdRaw = pickStr('timeEntryWorkDate', 'time_entry_work_date');
    const wdSlice = wdRaw.slice(0, 10);
    const timeEntryWorkDate = /^\d{4}-\d{2}-\d{2}$/.test(wdSlice) ? wdSlice : undefined;

    const expDateRaw = pickStr(
        'expenseDate',
        'expense_date',
        'expenseExpenseDate',
        'expense_expense_date',
        'expenseRequestDate',
        'expense_request_date',
        'incurred_date',
        'incurredDate',
    );
    const expSlice = expDateRaw.slice(0, 10);
    const expenseDate = /^\d{4}-\d{2}-\d{2}$/.test(expSlice) ? expSlice : undefined;

    let timeAuthorAuthUserId: number | undefined = undefined;
    for (const k of ['timeAuthorAuthUserId', 'time_author_auth_user_id'] as const) {
        const v = r[k];
        if (typeof v === 'number' && Number.isFinite(v)) {
            timeAuthorAuthUserId = Math.trunc(v);
            break;
        }
        if (typeof v === 'string' && v.trim() !== '') {
            const n = Number(v.trim());
            if (Number.isFinite(n)) {
                timeAuthorAuthUserId = Math.trunc(n);
                break;
            }
        }
    }

    const lineKindExplicit = lk && lk !== '' ? lk : 'other';

    let lineKindResolved = lineKindExplicit;
    if (timeEntryPick || lineKindExplicit === 'time')
        lineKindResolved = 'time';
    else if (expensePick || lineKindExplicit === 'expense')
        lineKindResolved = 'expense';
    else if (lineKindExplicit === 'manual')
        lineKindResolved = 'manual';

    const sortRaw = r.sortOrder ?? r.sort_order ?? fallbackIdx;

    return {
        id: id.length ? id : `line-${fallbackIdx}`,
        sortOrder: typeof sortRaw === 'number' && Number.isFinite(sortRaw) ? sortRaw : Number(sortRaw) || fallbackIdx,
        lineKind: lineKindResolved,
        description,
        quantity: pickNum('quantity', 'qty', 'hours_quantity'),
        unitAmount: pickNum('unitAmount', 'unit_amount', 'rate', 'hourly_rate'),
        lineTotal: pickNum('lineTotal', 'line_total', 'total', 'amount', 'billable_amount'),
        timeEntryId: timeEntryPick,
        expenseRequestId: expensePick,
        ...(timeEntryWorkDate !== undefined ? { timeEntryWorkDate } : {}),
        ...(timeAuthorAuthUserId !== undefined ? { timeAuthorAuthUserId } : {}),
        ...(expenseDate !== undefined ? { expenseDate } : {}),
    };
}

function pickInvoicePartnerStr(o: Record<string, unknown>, keys: readonly string[]): string | undefined {
    for (const k of keys) {
        const v = o[k];
        if (v == null || v === '')
            continue;
        const s = String(v).trim();
        if (s)
            return s;
    }
    return undefined;
}

function pickInvoicePartnerDateSlice(o: Record<string, unknown>, keys: readonly string[]): string | undefined {
    const raw = pickInvoicePartnerStr(o, keys);
    const s = raw ? raw.trim().slice(0, 10) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

/** Приводит полный объект счёта к ожидаемому клиентом виду (особенно `lines`). */
function normalizeInvoiceDto(raw: unknown): InvoiceDto {
    if (!raw || typeof raw !== 'object')
        throw new Error('Invoice API: в ответе нет объекта счёта');
    const invoice = raw as InvoiceDto;
    const o = raw as Record<string, unknown>;
    const linesSrc = o.lines
        ?? o.line_items
        ?? o.lineItems
        ?? o.LineItems
        ?? o.invoice_lines
        ?? o.invoiceLines;
    const linesArr = Array.isArray(linesSrc) ? linesSrc : [];
    const lines = linesArr.map((row, idx) => normalizeInvoiceLineDto(row, idx));
    const pf = pickInvoicePartnerDateSlice(o, ['partnerBillingPeriodFrom', 'partner_billing_period_from']);
    const pt = pickInvoicePartnerDateSlice(o, ['partnerBillingPeriodTo', 'partner_billing_period_to']);
    const pcs = pickInvoicePartnerStr(o, ['partnerConfirmationSnapshotId', 'partner_confirmation_snapshot_id', 'reportSnapshotId', 'report_snapshot_id']);
    const rpcdRaw = o.requiresPaymentConfirmationDocument ?? o.requires_payment_confirmation_document;
    const requiresPaymentConfirmationDocument = rpcdRaw === true || rpcdRaw === 'true'
        ? true
        : rpcdRaw === false || rpcdRaw === 'false'
            ? false
            : undefined;
    const pcDocUrl = pickInvoicePartnerStr(o, ['paymentConfirmationDocumentUrl', 'payment_confirmation_document_url']);
    const pcRecAt = pickInvoicePartnerStr(o, ['paymentConfirmationRecordedAt', 'payment_confirmation_recorded_at']);
    return {
        ...invoice,
        lines,
        ...(pf ? { partnerBillingPeriodFrom: pf } : {}),
        ...(pt ? { partnerBillingPeriodTo: pt } : {}),
        ...(pcs ? { partnerConfirmationSnapshotId: pcs } : {}),
        ...(requiresPaymentConfirmationDocument !== undefined ? { requiresPaymentConfirmationDocument } : {}),
        ...(pcDocUrl ? { paymentConfirmationDocumentUrl: pcDocUrl } : {}),
        ...(pcRecAt ? { paymentConfirmationRecordedAt: pcRecAt } : {}),
    };
}

export async function createInvoice(body: InvoiceCreateInput): Promise<InvoiceDto> {
    const res = await apiFetch('/api/v1/time-tracking/invoices', {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function getInvoice(id: string, includePayments = true): Promise<InvoiceDto> {
    const qs = includePayments ? '?includePayments=true' : '?includePayments=false';
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}${qs}`, invoiceApiFetchInit);
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function getInvoiceAudit(id: string): Promise<InvoiceAuditEntryDto[]> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/audit`, invoiceApiFetchInit);
    await throwIfNotOk(res);
    return res.json() as Promise<InvoiceAuditEntryDto[]>;
}
export async function patchInvoice(id: string, body: InvoicePatchInput): Promise<InvoiceDto> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}`, {
        ...invoiceApiFetchInit,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function sendInvoice(id: string): Promise<InvoiceDto> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/send`, {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function markInvoiceViewed(id: string): Promise<InvoiceDto> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/mark-viewed`, {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function registerInvoicePayment(id: string, body: InvoicePaymentInput = {}): Promise<InvoiceDto> {
    const payload: Record<string, unknown> = {};
    if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
        payload.amount = body.amount;
    }
    if (body.paidAt != null && String(body.paidAt).trim() !== '') {
        payload.paidAt = body.paidAt;
    }
    if (body.paymentMethod != null && String(body.paymentMethod).trim() !== '') {
        payload.paymentMethod = body.paymentMethod;
    }
    if (body.note != null && String(body.note).trim() !== '') {
        payload.note = body.note;
    }
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/payments`, {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function submitInvoicePaymentConfirmation(id: string, body: InvoicePaymentConfirmationInput): Promise<InvoiceDto> {
    const documentUrl = String(body.documentUrl ?? body.document_url ?? '').trim();
    if (!documentUrl)
        throw new Error('Не указана ссылка на документ подтверждения оплаты.');
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/payment-confirmation`, {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentUrl, document_url: documentUrl }),
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function cancelInvoice(id: string): Promise<InvoiceDto> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}/cancel`, {
        ...invoiceApiFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });
    await throwIfNotOk(res);
    return normalizeInvoiceDto(await res.json());
}
export async function deleteDraftInvoice(id: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/invoices/${encodeURIComponent(id)}`, {
        ...invoiceApiFetchInit,
        method: 'DELETE',
    });
    await throwIfNotOk(res);
}
export type ReportPagination = {
    page: number;
    per_page: number;
    total_pages: number;
    total_entries: number;
    next_page: number | null;
    previous_page: number | null;
};
export type ReportMeta = {
    report_type: string;
    group_by: string | null;
    from: string;
    to: string;
    generated_at: string;
};
export type ReportResponse<T> = {
    results: T[];
    pagination: ReportPagination;
    meta: ReportMeta;
};

export type ReportFiltersV2 = {
    dateFrom: string;
    dateTo: string;
    client_id?: string;
    project_id?: string;
    user_id?: string;
    task_id?: string;
    is_billable?: boolean;
    include_fixed_fee?: boolean;
    page?: number;
    per_page?: number;
    
    pageSizeMax?: number;
    
    confirmed_payment_only?: boolean;
};

export type TimeReportEntryLogItem = {
    
    id?: string | null;
    work_date: string;
    recorded_at: string;
    hours: number;
    billable_hours?: number | null;
    billable_amount?: number | null;
    
    amount_to_pay?: number | null;
    billable_currency?: string | null;
    billableCurrency?: string | null;
    currency?: string | null;
    task_id?: string | null;
    task_name?: string | null;
    project_id?: string | null;
    project_name?: string | null;
    project_code?: string | null;
    client_id?: string | null;
    client_name?: string | null;
    notes?: string | null;
    description?: string | null;
    is_billable?: boolean | null;
    billable?: boolean | null;
    time_entry_id?: string | null;
    task_billable_by_default?: boolean | null;
    is_invoiced?: boolean | null;
    is_paid?: boolean | null;
    is_week_submitted?: boolean | null;
    employee_name?: string | null;
    employee_position?: string | null;
    auth_user_id?: number | null;
    billable_rate?: number | null;
    cost_rate?: number | null;
    cost_amount?: number | null;
    external_reference_url?: string | null;
    invoice_id?: string | null;
    invoice_number?: string | null;
    
    source_entry_count?: number | null;
    voided_at?: string | null;
    voided_by_auth_user_id?: number | null;
    void_kind?: string | null;
    is_voided?: boolean | null;
};

export type TimeReportEntryLine = TimeReportEntryLogItem;
export type RUBTime = {
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    total_hours: number;
    billable_hours: number;
    billable_amount: number;
    currency: string;
    last_recorded_at?: string | null;
    entries?: TimeReportEntryLogItem[];
    entries_total?: number;
    entries_truncated?: boolean;
    
    project_breakdown?: TimeReportEntryLogItem[];
};
export type RUBExpense = {
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    total_amount: number;
    billable_amount: number;
    /** Стадия заявки (черновик, согласование, отклонён и т.д.). */
    status?: string | null;
    expense_status?: string | null;
};
export type RUBUninvoiced = {
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    uninvoiced_hours: number;
    uninvoiced_amount: number;
    currency: string;
};
export type RUBBudget = {
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    hours_logged: number;
    amount_logged: number;
    currency?: string;
};
export type TimeRowClients = {
    client_id: string;
    client_name: string;
    
    report_group_id?: string;
    
    group_currency?: string;
    total_hours: number;
    billable_hours: number;
    currency: string;
    billable_amount: number;
    last_recorded_at?: string | null;
    users: RUBTime[];
};
export type TimeRowProjects = TimeRowClients & {
    project_id: string;
    project_name: string;
};

export type TimeReportGroupPath = 'clients' | 'projects';
export type ExpRowClients = {
    client_id: string;
    client_name: string;
    total_amount: number;
    billable_amount: number;
    currency: string;
    
    report_group_id?: string;
    group_currency?: string;
    users: RUBExpense[];
};
export type ExpRowProjects = ExpRowClients & {
    project_id: string;
    project_name: string;
};
export type ExpRowCategories = {
    expense_category_id: string | null;
    expense_category_name: string;
    total_amount: number;
    billable_amount: number;
    currency: string;
    users: RUBExpense[];
};
export type ExpRowTeam = {
    user_id: number;
    user_name: string;
    avatar_url: string | null;
    is_contractor: boolean;
    total_amount: number;
    billable_amount: number;
    currency: string;
};
export type UninvoicedRow = {
    client_id: string;
    client_name: string;
    project_id: string;
    project_name: string;
    currency: string;
    total_hours: number;
    uninvoiced_hours: number;
    uninvoiced_expenses: number;
    uninvoiced_amount: number;
    users: RUBUninvoiced[];
};
export type BudgetRow = {
    client_id: string;
    client_name: string;
    project_id: string;
    project_name: string;
    budget_is_monthly: boolean;
    budget_by: 'none' | 'hours' | 'money' | 'hours_and_money';
    /** Если false или отсутствует — строки без лимита (см. API). */
    has_budget?: boolean;
    is_active: boolean;
    budget: number;
    budget_spent: number;
    budget_remaining: number;
    /** Процент прогресса из API (camel/snake); для hours_and_money на бэке это max(hours,money). */
    progress_percent?: number;
    currency?: string;
    /** При budget_by === hours_and_money — лимиты по часам (если отдаёт API отдельно). */
    budget_hours_budget?: number;
    budget_hours_spent?: number;
    budget_hours_remaining?: number;
    /** При budget_by === hours_and_money — лимиты по деньгам. */
    budget_money_budget?: number;
    budget_money_spent?: number;
    budget_money_remaining?: number;
    users: RUBBudget[];
};
const REPORT_ENTRY_LOG_CAMEL_TO_SNAKE: readonly [
    string,
    string
][] = [
        ['workDate', 'work_date'],
        ['recordedAt', 'recorded_at'],
        ['billableHours', 'billable_hours'],
        ['billableAmount', 'billable_amount'],
        ['taskName', 'task_name'],
        ['taskId', 'task_id'],
        ['taskTitle', 'task_title'],
        ['projectName', 'project_name'],
        ['projectId', 'project_id'],
        ['clientName', 'client_name'],
        ['clientId', 'client_id'],
        ['billableCurrency', 'billable_currency'],
        ['isBillable', 'is_billable'],
        ['timeEntryId', 'time_entry_id'],
        ['workDescription', 'work_description'],
        ['Description', 'description'],
        ['Notes', 'notes'],
        ['Memo', 'memo'],
        ['taskSummary', 'task_summary'],
        ['taskLabel', 'task_label'],
        ['activityName', 'activity_name'],
        ['ticketTitle', 'ticket_title'],
        ['taskBillableByDefault', 'task_billable_by_default'],
        ['isInvoiced', 'is_invoiced'],
        ['isPaid', 'is_paid'],
        ['isWeekSubmitted', 'is_week_submitted'],
        ['employeeName', 'employee_name'],
        ['employeePosition', 'employee_position'],
        ['authUserId', 'auth_user_id'],
        ['billableRate', 'billable_rate'],
        ['amountToPay', 'amount_to_pay'],
        ['costRate', 'cost_rate'],
        ['costAmount', 'cost_amount'],
        ['externalReferenceUrl', 'external_reference_url'],
        ['invoiceId', 'invoice_id'],
        ['invoiceNumber', 'invoice_number'],
        ['projectCode', 'project_code'],
        ['sourceEntryCount', 'source_entry_count'],
        ['voidedAt', 'voided_at'],
        ['voidedByAuthUserId', 'voided_by_auth_user_id'],
        ['voidKind', 'void_kind'],
        ['isVoided', 'is_voided'],
    ];
const REPORT_ENTRY_LOG_NEST_KEYS = [
    'time_entry',
    'timeEntry',
    'entry',
    'payload',
    'item',
    'record',
    'data',
    'meta',
] as const;
function mergeReportEntryNestedFields(merged: Record<string, unknown>): void {
    for (const nk of REPORT_ENTRY_LOG_NEST_KEYS) {
        const inner = merged[nk];
        if (inner == null || typeof inner !== 'object' || Array.isArray(inner))
            continue;
        const rec = inner as Record<string, unknown>;
        for (const [k, v] of Object.entries(rec)) {
            if (v === undefined)
                continue;
            const cur = merged[k];
            const curEmpty = cur === undefined ||
                cur === null ||
                cur === '' ||
                (typeof cur === 'string' && !String(cur).trim());
            if (curEmpty)
                merged[k] = v;
        }
        delete merged[nk];
    }
}

function reportJsonSnakeScalarEmpty(v: unknown): boolean {
    if (v === undefined || v === null)
        return true;
    if (typeof v === 'string' && !v.trim())
        return true;
    return false;
}
function coerceReportNumber(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && v.trim() !== '') {
        const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}
function parseReportHoursField(v: unknown): number | undefined {
    const n = coerceReportNumber(v);
    if (n !== undefined)
        return n;
    if (typeof v === 'string' && v.includes(':')) {
        const parts = v.split(':').map((x) => parseInt(x.trim(), 10));
        const hh = parts[0];
        const mm = parts[1] ?? 0;
        if (Number.isFinite(hh) && Number.isFinite(mm))
            return hh + mm / 60;
    }
    return undefined;
}
function normalizeReportEntryLogItem(entry: unknown): unknown {
    if (entry == null || typeof entry !== 'object' || Array.isArray(entry))
        return entry;
    const merged: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
    mergeReportEntryNestedFields(merged);
    for (const [camel, snake] of REPORT_ENTRY_LOG_CAMEL_TO_SNAKE) {
        if (Object.prototype.hasOwnProperty.call(merged, camel)) {
            if (reportJsonSnakeScalarEmpty(merged[snake]))
                merged[snake] = merged[camel];
            delete merged[camel];
        }
    }
    const hoursParsed = parseReportHoursField(merged.hours ?? merged.duration);
    if (hoursParsed !== undefined)
        merged.hours = hoursParsed;
    delete merged.duration;
    const bh = coerceReportNumber(merged.billable_hours);
    if (bh !== undefined)
        merged.billable_hours = bh;
    const ba = coerceReportNumber(merged.billable_amount);
    if (ba !== undefined)
        merged.billable_amount = ba;
    const pickStr = (key: string): string | undefined => {
        const v = merged[key];
        return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const notes0 = pickStr('notes');
    const desc0 = pickStr('description');
    const altText = pickStr('note') ??
        pickStr('comment') ??
        pickStr('memo') ??
        pickStr('message') ??
        pickStr('body') ??
        pickStr('work_description') ??
        pickStr('activity_notes') ??
        pickStr('public_notes') ??
        pickStr('private_notes') ??
        pickStr('narrative') ??
        pickStr('details');
    if (!notes0 && !desc0 && altText) {
        merged.notes = altText;
        merged.description = altText;
    }
    else {
        if (!notes0 && desc0)
            merged.notes = desc0;
        if (!desc0 && notes0)
            merged.description = notes0;
        if (!notes0 && typeof merged.note === 'string' && merged.note.trim())
            merged.notes = merged.note.trim();
        if (!desc0 && typeof merged.comment === 'string' && merged.comment.trim()) {
            merged.description = merged.comment.trim();
        }
    }
    delete merged.note;
    delete merged.comment;
    delete merged.memo;
    delete merged.message;
    delete merged.body;
    delete merged.activity_notes;
    delete merged.work_description;
    delete merged.public_notes;
    delete merged.private_notes;
    delete merged.narrative;
    if (typeof merged.details === 'string')
        delete merged.details;
    if (!merged.task_name && typeof merged.task_title === 'string' && merged.task_title.trim()) {
        merged.task_name = merged.task_title.trim();
    }
    delete merged.task_title;
    if (!merged.task_name && typeof merged.task_summary === 'string' && merged.task_summary.trim()) {
        merged.task_name = merged.task_summary.trim();
    }
    delete merged.task_summary;
    if (!merged.task_name && typeof merged.task_label === 'string' && merged.task_label.trim()) {
        merged.task_name = merged.task_label.trim();
    }
    delete merged.task_label;
    if (!merged.task_name && typeof merged.activity_name === 'string' && merged.activity_name.trim()) {
        merged.task_name = merged.activity_name.trim();
    }
    delete merged.activity_name;
    if (!merged.task_name && typeof merged.ticket_title === 'string' && merged.ticket_title.trim()) {
        merged.task_name = merged.ticket_title.trim();
    }
    delete merged.ticket_title;
    const proj = merged.project;
    if (proj && typeof proj === 'object' && !Array.isArray(proj)) {
        const rec = proj as Record<string, unknown>;
        if (!merged.project_name) {
            const pn = rec.name ?? rec.project_name ?? rec.title;
            if (typeof pn === 'string' && pn.trim())
                merged.project_name = pn;
        }
        if (!merged.project_id) {
            const pid = rec.id ?? rec.project_id ?? rec.projectId;
            if (pid != null && String(pid).trim())
                merged.project_id = String(pid).trim();
        }
    }
    delete merged.project;
    const task = merged.task;
    if (!merged.task_name && typeof task === 'string' && task.trim()) {
        merged.task_name = task.trim();
    }
    else if (!merged.task_name && task && typeof task === 'object' && !Array.isArray(task)) {
        const rec = task as Record<string, unknown>;
        const tn = rec.name ?? rec.task_name ?? rec.title ?? rec.label;
        if (typeof tn === 'string' && tn.trim())
            merged.task_name = tn.trim();
    }
    delete merged.task;
    const cli = merged.client;
    if (cli && typeof cli === 'object' && !Array.isArray(cli)) {
        const rec = cli as Record<string, unknown>;
        if (!merged.client_name) {
            const cn = rec.name ?? rec.client_name ?? rec.title;
            if (typeof cn === 'string' && cn.trim())
                merged.client_name = cn;
        }
        if (!merged.client_id) {
            const cid = rec.id ?? rec.client_id ?? rec.clientId;
            if (cid != null && String(cid).trim())
                merged.client_id = String(cid).trim();
        }
    }
    delete merged.client;
    const ib = merged.is_billable;
    if (ib !== undefined && ib !== null && typeof ib !== 'boolean') {
        const s = String(ib).trim().toLowerCase();
        merged.is_billable = s === 'true' || s === '1' || s === 'yes' || s === 'on';
    }
    const entryId = merged.id ?? merged.time_entry_id;
    if (entryId != null && String(entryId).trim() !== '') {
        const sid = String(entryId).trim();
        merged.time_entry_id = sid;
        merged.id = sid;
    }
    for (const nk of ['amount_to_pay', 'billable_rate', 'cost_rate', 'cost_amount']) {
        const c = coerceReportNumber(merged[nk]);
        if (c !== undefined)
            merged[nk] = c;
    }
    const sec = coerceReportNumber(merged.source_entry_count);
    if (sec !== undefined)
        merged.source_entry_count = Math.max(0, Math.round(sec));
    const auid = coerceReportNumber(merged.auth_user_id);
    if (auid !== undefined)
        merged.auth_user_id = Math.round(auid);
    return merged;
}
const REPORT_V2_CAMEL_TO_SNAKE: readonly [
    string,
    string
][] = [
        ['totalHours', 'total_hours'],
        ['billableHours', 'billable_hours'],
        ['billableAmount', 'billable_amount'],
        ['clientId', 'client_id'],
        ['clientName', 'client_name'],
        ['projectId', 'project_id'],
        ['projectName', 'project_name'],
        ['taskId', 'task_id'],
        ['taskName', 'task_name'],
        ['taskTitle', 'task_name'],
        ['userId', 'user_id'],
        ['userName', 'user_name'],
        ['avatarUrl', 'avatar_url'],
        ['weeklyCapacity', 'weekly_capacity'],
        ['isContractor', 'is_contractor'],
        ['totalAmount', 'total_amount'],
        ['expenseCategoryId', 'expense_category_id'],
        ['expenseCategoryName', 'expense_category_name'],
        ['uninvoicedHours', 'uninvoiced_hours'],
        ['uninvoicedAmount', 'uninvoiced_amount'],
        ['uninvoicedExpenses', 'uninvoiced_expenses'],
        ['budgetIsMonthly', 'budget_is_monthly'],
        ['budgetBy', 'budget_by'],
        ['hasBudget', 'has_budget'],
        ['isActive', 'is_active'],
        ['budgetAmount', 'budget'],
        ['budgetSpent', 'budget_spent'],
        ['budgetRemaining', 'budget_remaining'],
        ['progressPercent', 'progress_percent'],
        ['budgetHoursBudget', 'budget_hours_budget'],
        ['budgetHoursSpent', 'budget_hours_spent'],
        ['budgetHoursRemaining', 'budget_hours_remaining'],
        ['budgetMoneyBudget', 'budget_money_budget'],
        ['budgetMoneySpent', 'budget_money_spent'],
        ['budgetMoneyRemaining', 'budget_money_remaining'],
        ['hoursLogged', 'hours_logged'],
        ['amountLogged', 'amount_logged'],
        ['entriesTotal', 'entries_total'],
        ['entriesTruncated', 'entries_truncated'],
        ['projectBreakdown', 'project_breakdown'],
        ['reportGroupId', 'report_group_id'],
        ['groupCurrency', 'group_currency'],
        ['expenseStatus', 'expense_status'],
        ['workflowStatus', 'workflow_status'],
    ];

function scrubExpenseReportAggregateRow(merged: Record<string, unknown>): void {
    if (!Array.isArray(merged.users))
        return;
    if ('total_hours' in merged || 'uninvoiced_hours' in merged)
        return;
    const ta = coerceReportNumber(merged.total_amount);
    const ba = coerceReportNumber(merged.billable_amount);
    if (ta === undefined && ba === undefined)
        return;
    if ('hours_logged' in merged && 'amount_logged' in merged && !('total_amount' in merged))
        return;
    if ('client_id' in merged)
        merged.client_id = merged.client_id == null || merged.client_id === '' ? '' : String(merged.client_id).trim();
    if ('project_id' in merged)
        merged.project_id = merged.project_id == null || merged.project_id === '' ? '' : String(merged.project_id).trim();
    if ('client_name' in merged)
        merged.client_name = merged.client_name == null ? '' : String(merged.client_name).trim();
    if ('project_name' in merged)
        merged.project_name = merged.project_name == null ? '' : String(merged.project_name).trim();
    if ('expense_category_name' in merged)
        merged.expense_category_name = merged.expense_category_name == null ? '' : String(merged.expense_category_name).trim();
}

function scrubRubExpenseRollupUser(merged: Record<string, unknown>): Record<string, unknown> {
    const uid = merged.user_id;
    const hasUser = uid != null && (typeof uid === 'number' || typeof uid === 'string');
    if (!hasUser || 'total_hours' in merged)
        return merged;
    const hasExpenseAmounts = coerceReportNumber(merged.total_amount) !== undefined
        || coerceReportNumber(merged.billable_amount) !== undefined;
    if (!hasExpenseAmounts)
        return merged;
    merged.user_name = merged.user_name == null ? '' : String(merged.user_name).trim();
    const st = merged.status ?? merged.expense_status ?? merged.workflow_status;
    if (st != null && String(st).trim())
        merged.status = String(st).trim();
    return merged;
}

function normalizeReportV2RowDeep(row: unknown): unknown {
    if (row == null || typeof row !== 'object')
        return row;
    if (Array.isArray(row))
        return row.map(normalizeReportV2RowDeep);
    const merged: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    for (const [camel, snake] of REPORT_V2_CAMEL_TO_SNAKE) {
        if (Object.prototype.hasOwnProperty.call(merged, camel)) {
            if (reportJsonSnakeScalarEmpty(merged[snake]))
                merged[snake] = merged[camel];
            delete merged[camel];
        }
    }
    const projRow = merged.project;
    if (projRow && typeof projRow === 'object' && !Array.isArray(projRow)) {
        const rec = projRow as Record<string, unknown>;
        if (reportJsonSnakeScalarEmpty(merged.project_name)) {
            const pn = rec.name ?? rec.project_name ?? rec.title ?? rec.projectName;
            if (typeof pn === 'string' && pn.trim())
                merged.project_name = pn.trim();
        }
        if (reportJsonSnakeScalarEmpty(merged.project_id)) {
            const pid = rec.id ?? rec.project_id ?? rec.projectId;
            if (pid != null && String(pid).trim())
                merged.project_id = String(pid).trim();
        }
    }
    delete merged.project;
    const cliRow = merged.client;
    if (cliRow && typeof cliRow === 'object' && !Array.isArray(cliRow)) {
        const rec = cliRow as Record<string, unknown>;
        if (reportJsonSnakeScalarEmpty(merged.client_name)) {
            const cn = rec.name ?? rec.client_name ?? rec.title ?? rec.clientName;
            if (typeof cn === 'string' && cn.trim())
                merged.client_name = cn.trim();
        }
        if (reportJsonSnakeScalarEmpty(merged.client_id)) {
            const cid = rec.id ?? rec.client_id ?? rec.clientId;
            if (cid != null && String(cid).trim())
                merged.client_id = String(cid).trim();
        }
    }
    delete merged.client;
    const taskRow = merged.task;
    if (taskRow && typeof taskRow === 'object' && !Array.isArray(taskRow)) {
        const rec = taskRow as Record<string, unknown>;
        if (reportJsonSnakeScalarEmpty(merged.task_name)) {
            const tn = rec.name ?? rec.task_name ?? rec.title ?? rec.taskName ?? rec.label;
            if (typeof tn === 'string' && tn.trim())
                merged.task_name = tn.trim();
        }
        if (reportJsonSnakeScalarEmpty(merged.task_id)) {
            const tid = rec.id ?? rec.task_id ?? rec.taskId;
            if (tid != null && String(tid).trim())
                merged.task_id = String(tid).trim();
        }
    }
    delete merged.task;
    if (reportJsonSnakeScalarEmpty(merged.task_name) && !reportJsonSnakeScalarEmpty(merged.task_id)) {
        for (const k of ['task_title', 'activity_name', 'title', 'label']) {
            const v = merged[k];
            if (typeof v === 'string' && v.trim()) {
                merged.task_name = v.trim();
                delete merged[k];
                break;
            }
        }
    }
    if (Array.isArray(merged.users)) {
        merged.users = merged.users.map((u) => normalizeReportV2RowDeep(u));
    }
    if (Array.isArray(merged.entries)) {
        merged.entries = merged.entries.map((e) => normalizeReportEntryLogItem(e));
    }
    if (Array.isArray(merged.project_breakdown)) {
        merged.project_breakdown = merged.project_breakdown.map((e) => normalizeReportEntryLogItem(e)) as unknown[];
    }
    scrubExpenseReportAggregateRow(merged);
    return scrubRubExpenseRollupUser(merged);
}
function normalizeReportV2Response<T>(data: ReportResponse<T>): ReportResponse<T> {
    const p = data.pagination as unknown as Record<string, unknown>;
    const pagination: ReportPagination = {
        page: Number(p?.page ?? 1),
        per_page: Number(p?.per_page ?? p?.perPage ?? 100),
        total_pages: Number(p?.total_pages ?? p?.totalPages ?? 1),
        total_entries: Number(p?.total_entries ?? p?.totalEntries ?? 0),
        next_page: (p?.next_page ?? p?.nextPage ?? null) as number | null,
        previous_page: (p?.previous_page ?? p?.previousPage ?? null) as number | null,
    };
    const m = data.meta as unknown as Record<string, unknown>;
    const meta: ReportMeta = {
        report_type: String(m?.report_type ?? m?.reportType ?? ''),
        group_by: (m?.group_by ?? m?.groupBy ?? null) as string | null,
        from: String(m?.from ?? m?.date_from ?? m?.dateFrom ?? ''),
        to: String(m?.to ?? m?.date_to ?? m?.dateTo ?? ''),
        generated_at: String(m?.generated_at ?? m?.generatedAt ?? ''),
    };
    return {
        ...data,
        pagination,
        meta,
        results: (data.results ?? []).map((r) => normalizeReportV2RowDeep(r)) as T[],
    };
}
function buildReportV2Qs(filters: ReportFiltersV2): string {
    const p = new URLSearchParams();
    p.set('dateFrom', filters.dateFrom);
    p.set('dateTo', filters.dateTo);
    p.set('from', filters.dateFrom);
    p.set('to', filters.dateTo);
    const clientId = filters.client_id?.trim();
    if (clientId)
        p.set('client_id', clientId);
    const projectId = filters.project_id?.trim();
    if (projectId)
        p.set('project_id', projectId);
    const uidParam = filters.user_id?.trim();
    if (uidParam)
        p.set('user_id', uidParam);
    const tid = filters.task_id?.trim();
    if (tid)
        p.set('task_id', tid);
    if (filters.is_billable !== undefined)
        p.set('is_billable', String(filters.is_billable));
    if (filters.include_fixed_fee === false)
        p.set('include_fixed_fee', 'false');
    if (filters.confirmed_payment_only === true)
        p.set('confirmed_payment_only', 'true');
    p.set('page', String(filters.page ?? 1));
    const cap = filters.pageSizeMax != null && filters.pageSizeMax > 0
        ? Math.min(filters.pageSizeMax, 5000)
        : 500;
    const pp = Math.min(Math.max(filters.per_page ?? 100, 1), cap);
    p.set('per_page', String(pp));
    return p.toString();
}
export async function fetchTimeReport(groupBy: TimeReportGroupPath, filters: ReportFiltersV2): Promise<ReportResponse<TimeRowClients | TimeRowProjects>> {
    const qs = buildReportV2Qs(filters);
    const res = await apiFetch(`/api/v1/time-tracking/reports/time/${groupBy}?${qs}`);
    await reportsThrowIfNotOk(res);
    const data = (await res.json()) as ReportResponse<TimeRowClients | TimeRowProjects>;
    return normalizeReportV2Response(data);
}
function reportV2ListChunkSize(filters: { pageSizeMax?: number }): number {
    const c = filters.pageSizeMax != null && filters.pageSizeMax > 0
        ? Math.min(filters.pageSizeMax, 5000)
        : 500;
    return Math.min(500, c);
}
async function fetchAllTimeReportPagesForGroup<T>(groupBy: TimeReportGroupPath, filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<T[]> {
    const maxIter = Math.min(Math.max(options?.maxPages ?? 250, 1), 500);
    const out: T[] = [];
    let page = 1;
    const perChunk = reportV2ListChunkSize(filters);
    for (let i = 0; i < maxIter; i++) {
        const data = await fetchTimeReport(groupBy, { ...filters, page, per_page: perChunk } as ReportFiltersV2);
        out.push(...(data.results as T[]));
        const np = data.pagination.next_page;
        if (np == null || page >= data.pagination.total_pages)
            break;
        page = np;
    }
    return out;
}
export function fetchAllTimeReportClientRows(filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<TimeRowClients[]> {
    return fetchAllTimeReportPagesForGroup<TimeRowClients>('clients', filters, options);
}
export function fetchAllTimeReportProjectRows(filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<TimeRowProjects[]> {
    return fetchAllTimeReportPagesForGroup<TimeRowProjects>('projects', filters, options);
}
async function fetchAllPagedReportRows<T>(fetchPage: (page: number, perPage: number) => Promise<ReportResponse<T>>, options?: {
    maxPages?: number;
    perPage?: number;
}): Promise<T[]> {
    const maxIter = Math.min(Math.max(options?.maxPages ?? 250, 1), 500);
    const perPage = Math.min(Math.max(options?.perPage ?? 500, 1), 500);
    const out: T[] = [];
    let page = 1;
    for (let i = 0; i < maxIter; i++) {
        const data = await fetchPage(page, perPage);
        out.push(...data.results);
        const np = data.pagination.next_page;
        if (np == null || page >= data.pagination.total_pages)
            break;
        page = np;
    }
    return out;
}
export async function fetchAllExpenseReportRows(groupBy: 'clients' | 'projects' | 'categories' | 'team', filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<ExpRowClients[] | ExpRowProjects[] | ExpRowCategories[] | ExpRowTeam[]> {
    const perPage = reportV2ListChunkSize(filters);
    const rows = await fetchAllPagedReportRows<ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam>((page, perPg) => fetchExpenseReport(groupBy, { ...filters, page, per_page: perPg } as ReportFiltersV2), { ...options, perPage });
    return rows as ExpRowClients[] | ExpRowProjects[] | ExpRowCategories[] | ExpRowTeam[];
}
export async function fetchAllUninvoicedReportRows(filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<UninvoicedRow[]> {
    const perPage = reportV2ListChunkSize(filters);
    return fetchAllPagedReportRows((page, perPg) => fetchUninvoicedReport({ ...filters, page, per_page: perPg } as ReportFiltersV2), { ...options, perPage });
}
export async function fetchAllBudgetReportRows(filters: Omit<ReportFiltersV2, 'page' | 'per_page'>, options?: {
    maxPages?: number;
}): Promise<BudgetRow[]> {
    const perPage = reportV2ListChunkSize(filters);
    return fetchAllPagedReportRows((page, perPg) => fetchBudgetReport({ ...filters, page, per_page: perPg } as ReportFiltersV2), { ...options, perPage });
}
export async function fetchExpenseReport(groupBy: 'clients' | 'projects' | 'categories' | 'team', filters: ReportFiltersV2): Promise<ReportResponse<ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam>> {
    const qs = buildReportV2Qs(filters);
    const res = await apiFetch(`/api/v1/time-tracking/reports/expenses/${groupBy}?${qs}`);
    await reportsThrowIfNotOk(res);
    const data = (await res.json()) as ReportResponse<ExpRowClients | ExpRowProjects | ExpRowCategories | ExpRowTeam>;
    return normalizeReportV2Response(data);
}
export async function fetchUninvoicedReport(filters: ReportFiltersV2): Promise<ReportResponse<UninvoicedRow>> {
    const qs = buildReportV2Qs(filters);
    const res = await apiFetch(`/api/v1/time-tracking/reports/uninvoiced?${qs}`);
    await reportsThrowIfNotOk(res);
    const data = (await res.json()) as ReportResponse<UninvoicedRow>;
    return normalizeReportV2Response(data);
}
function coerceBudgetReportNumeric(v: unknown): number | undefined {
    if (v == null || v === '')
        return undefined;
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : undefined;
    const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
}
/** Нормализация строки отчёта «Бюджет проектов» под контракт FRONTEND_PROJECT_BUDGET. */
export function finalizeBudgetReportRow(row: BudgetRow): BudgetRow {
    const raw = row as Record<string, unknown>;
    const nestedBudget = raw.budget && typeof raw.budget === 'object' && !Array.isArray(raw.budget)
        ? raw.budget as Record<string, unknown>
        : null;
    const byRaw = String(row.budget_by ?? raw.budgetBy ?? nestedBudget?.budgetBy ?? '').toLowerCase().replace(/-/g, '_');
    let budget_by: BudgetRow['budget_by'] = 'none';
    if (byRaw === 'hours')
        budget_by = 'hours';
    else if (byRaw === 'money')
        budget_by = 'money';
    else if (byRaw === 'hours_and_money' || byRaw === 'hoursandmoney')
        budget_by = 'hours_and_money';
    const hb = coerceBudgetReportNumeric(raw.budget_hours_budget) ??
        coerceBudgetReportNumeric(raw.budgetHoursBudget) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_hours_budget) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetHoursBudget);
    const hs = coerceBudgetReportNumeric(raw.budget_hours_spent) ??
        coerceBudgetReportNumeric(raw.budgetHoursSpent) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_hours_spent) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetHoursSpent);
    const hr = coerceBudgetReportNumeric(raw.budget_hours_remaining) ??
        coerceBudgetReportNumeric(raw.budgetHoursRemaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_hours_remaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetHoursRemaining);
    const mb = coerceBudgetReportNumeric(raw.budget_money_budget) ??
        coerceBudgetReportNumeric(raw.budgetMoneyBudget) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_money_budget) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetMoneyBudget);
    const ms = coerceBudgetReportNumeric(raw.budget_money_spent) ??
        coerceBudgetReportNumeric(raw.budgetMoneySpent) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_money_spent) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetMoneySpent);
    const mr = coerceBudgetReportNumeric(raw.budget_money_remaining) ??
        coerceBudgetReportNumeric(raw.budgetMoneyRemaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_money_remaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetMoneyRemaining);
    const budgetAmount = coerceBudgetReportNumeric(raw.budgetAmount) ??
        coerceBudgetReportNumeric(raw.budget_amount) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetAmount) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_amount) ??
        coerceBudgetReportNumeric(raw.budget);
    const budgetSpent = coerceBudgetReportNumeric(raw.budgetSpent) ??
        coerceBudgetReportNumeric(raw.budget_spent_amount) ??
        coerceBudgetReportNumeric(raw.budget_spent) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetSpent) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_spent_amount) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_spent);
    const budgetRemaining = coerceBudgetReportNumeric(raw.budgetRemaining) ??
        coerceBudgetReportNumeric(raw.budget_remaining_amount) ??
        coerceBudgetReportNumeric(raw.budget_remaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budgetRemaining) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_remaining_amount) ??
        coerceBudgetReportNumeric(nestedBudget?.budget_remaining);
    const progressPercent = coerceBudgetReportNumeric(raw.progressPercent) ??
        coerceBudgetReportNumeric(raw.progress_percent) ??
        coerceBudgetReportNumeric(nestedBudget?.progressPercent) ??
        coerceBudgetReportNumeric(nestedBudget?.progress_percent);
    if (budget_by === 'none') {
        const hasHoursAxis = Number.isFinite(hb) || Number.isFinite(hs) || Number.isFinite(hr);
        const hasMoneyAxis = Number.isFinite(mb) || Number.isFinite(ms) || Number.isFinite(mr)
            || Number.isFinite(budgetAmount) || Number.isFinite(budgetSpent) || Number.isFinite(budgetRemaining);
        budget_by = hasHoursAxis && hasMoneyAxis
            ? 'hours_and_money'
            : hasHoursAxis
                ? 'hours'
                : hasMoneyAxis
                    ? 'money'
                    : 'none';
    }
    const explicitHas = raw.has_budget ?? raw.hasBudget;
    const has_budget = explicitHas === true
        ? true
        : explicitHas === false
            ? false
            : budget_by !== 'none' && (
                (Number.isFinite(budgetAmount) && (budgetAmount as number) > 0)
                || (Number.isFinite(hb) && (hb as number) > 0)
                || (Number.isFinite(mb) && (mb as number) > 0)
            );
    return {
        ...row,
        budget_by,
        has_budget,
        ...(budgetAmount !== undefined ? { budget: budgetAmount } : {}),
        ...(budgetSpent !== undefined ? { budget_spent: budgetSpent } : {}),
        ...(budgetRemaining !== undefined ? { budget_remaining: budgetRemaining } : {}),
        ...(progressPercent !== undefined ? { progress_percent: progressPercent } : {}),
        ...(hb !== undefined ? { budget_hours_budget: hb } : {}),
        ...(hs !== undefined ? { budget_hours_spent: hs } : {}),
        ...(hr !== undefined ? { budget_hours_remaining: hr } : {}),
        ...(mb !== undefined ? { budget_money_budget: mb } : {}),
        ...(ms !== undefined ? { budget_money_spent: ms } : {}),
        ...(mr !== undefined ? { budget_money_remaining: mr } : {}),
    };
}
export async function fetchBudgetReport(filters: ReportFiltersV2): Promise<ReportResponse<BudgetRow>> {
    const qs = buildReportV2Qs(filters);
    const res = await apiFetch(`/api/v1/time-tracking/reports/project-budget?${qs}`);
    await reportsThrowIfNotOk(res);
    const data = (await res.json()) as ReportResponse<BudgetRow>;
    const norm = normalizeReportV2Response(data);
    return {
        ...norm,
        results: norm.results.map((r) => finalizeBudgetReportRow(r as BudgetRow)),
    };
}
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function parseFilenameFromContentDisposition(header: string | null): string | null {
    if (!header)
        return null;
    const star = header.match(/filename\*=(?:UTF-8|utf-8)''([^;\s]+)/i);
    if (star?.[1]) {
        try {
            return decodeURIComponent(star[1].replace(/^"+|"+$/g, ''));
        }
        catch {
            return star[1];
        }
    }
    const quoted = header.match(/filename\s*=\s*"((?:[^"\\]|\\.)*)"/i);
    if (quoted?.[1])
        return quoted[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const plain = header.match(/filename\s*=\s*([^;\s]+)/i);
    if (plain?.[1])
        return plain[1].replace(/^"+|"+$/g, '');
    return null;
}
function defaultReportExportFilename(reportType: 'time' | 'expenses' | 'uninvoiced' | 'project-budget', groupBy: string | null, from: string, to: string, ext: string, filters?: ReportFiltersV2): string {
    const slugBase = filters?.confirmed_payment_only === true && reportType === 'expenses'
        ? 'expenses_confirmed_payment'
        : reportType;
    const slug = groupBy ? `${slugBase}_${groupBy}` : slugBase;
    return `${slug}_${from}_${to}.${ext}`;
}
export type ReportExportOptions = {
    
    timeExport?: 'detail' | 'summary';
};
export async function exportReportV2(reportType: 'time' | 'expenses' | 'uninvoiced' | 'project-budget', groupBy: string | null, filters: ReportFiltersV2, format: 'csv' | 'xlsx', exportOpts?: ReportExportOptions): Promise<void> {
    const apiSegment = reportType;
    const mergedFilters: ReportFiltersV2 = filters;
    const base = '/api/v1/time-tracking/reports';
    const path = groupBy ? `/${apiSegment}/${groupBy}/export` : `/${apiSegment}/export`;
    const p = new URLSearchParams();
    p.set('format', format);
    p.set('dateFrom', mergedFilters.dateFrom);
    p.set('dateTo', mergedFilters.dateTo);
    p.set('from', mergedFilters.dateFrom);
    p.set('to', mergedFilters.dateTo);
    if (reportType === 'time' && exportOpts?.timeExport)
        p.set('export', exportOpts.timeExport);
    if (mergedFilters.client_id?.trim())
        p.set('client_id', mergedFilters.client_id.trim());
    if (mergedFilters.project_id?.trim())
        p.set('project_id', mergedFilters.project_id.trim());
    const uidExport = mergedFilters.user_id?.trim();
    if (uidExport)
        p.set('user_id', uidExport);
    if (mergedFilters.task_id?.trim())
        p.set('task_id', mergedFilters.task_id.trim());
    if (mergedFilters.is_billable !== undefined)
        p.set('is_billable', String(mergedFilters.is_billable));
    if (mergedFilters.include_fixed_fee === false)
        p.set('include_fixed_fee', 'false');
    if (mergedFilters.confirmed_payment_only === true)
        p.set('confirmed_payment_only', 'true');
    const accept = format === 'xlsx'
        ? `${XLSX_MIME}, application/octet-stream, */*`
        : 'text/csv, text/plain, application/octet-stream, */*';
    const res = await apiFetch(`${base}${path}?${p.toString()}`, {
        headers: { Accept: accept },
    });
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const j = (await res.clone().json()) as {
                detail?: string;
                message?: string;
            };
            if (j.detail)
                msg = j.detail;
            else if (j.message)
                msg = j.message;
        }
        catch {
            try {
                const t = await res.text();
                if (t && t.length < 500)
                    msg = t;
            }
            catch { }
        }
        throw new Error(msg);
    }
    const buf = await res.arrayBuffer();
    const ctRaw = res.headers.get('content-type') ?? '';
    const ctLower = ctRaw.toLowerCase();
    if (ctLower.includes('application/json') || ctLower.includes('text/html')) {
        const t = new TextDecoder('utf-8').decode(buf);
        let msg = 'Сервер вернул ответ без файла';
        try {
            const j = JSON.parse(t) as {
                detail?: string;
                message?: string;
            };
            if (j.detail)
                msg = j.detail;
            else if (j.message)
                msg = j.message;
        }
        catch {
            if (t.length < 600)
                msg = t;
        }
        throw new Error(msg);
    }
    if (format === 'xlsx' && buf.byteLength > 0) {
        const sig = new Uint8Array(buf.slice(0, 4));
        const isZip = sig[0] === 0x50 && sig[1] === 0x4b && (sig[2] === 0x03 || sig[2] === 0x05 || sig[2] === 0x07);
        if (!isZip) {
            const t = new TextDecoder('utf-8').decode(buf);
            if (t.trimStart().startsWith('{')) {
                let detail = 'Ошибка выгрузки Excel';
                try {
                    const j = JSON.parse(t) as {
                        detail?: string;
                    };
                    if (j.detail)
                        detail = j.detail;
                }
                catch { }
                throw new Error(detail);
            }
            throw new Error('Ответ сервера не похож на файл Excel (.xlsx). Проверьте, что бэкенд отдаёт XLSX для format=xlsx.');
        }
    }
    let mime = format === 'xlsx' ? XLSX_MIME : 'text/csv;charset=utf-8';
    if (format === 'xlsx' && ctLower.includes('spreadsheet')) {
        mime = ctRaw.split(';')[0].trim();
    }
    else if (format === 'csv' && ctLower.includes('text/csv')) {
        mime = `${ctRaw.split(';')[0].trim()};charset=utf-8`;
    }
    const blob = new Blob([buf], { type: mime });
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    let filename = parseFilenameFromContentDisposition(res.headers.get('content-disposition')) ??
        defaultReportExportFilename(reportType, groupBy, mergedFilters.dateFrom, mergedFilters.dateTo, ext, mergedFilters);
    if (!filename.toLowerCase().endsWith(`.${ext}`)) {
        filename = `${filename.replace(/\.(csv|xlsx|xls)$/i, '')}.${ext}`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
