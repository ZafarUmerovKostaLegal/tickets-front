import { apiFetch } from '@shared/api';
import type { User } from '@entities/user';
import { reportCacheInvalidateAll as _invalidateReportCache } from '../../lib/reportApiCache';
import { throwIfNotOk } from './httpShared';

export type HourlyRateKind = 'billable' | 'cost';
export type TimeTrackingUserRow = {
    id: number;
    email: string;
    display_name?: string | null;
    picture?: string | null;
    role?: string;
    position?: string | null;
    initials?: string | null;
    is_blocked: boolean;
    is_archived: boolean;
    is_manual?: boolean;
    can_transfer_time_without_project_access?: boolean;
    weekly_capacity_hours?: string | number;
    created_at: string;
    updated_at?: string | null;
};
export type ManualTimeTrackingUserCreateBody = {
    displayName: string;
    email?: string;
    position?: string;
    isArchived?: boolean;
    weeklyCapacityHours?: number;
};
export function readTimeTrackingUserStr(v: unknown): string | null {
    if (v == null)
        return null;
    const s = String(v).trim();
    return s.length > 0 ? s : null;
}

export function normalizeTimeTrackingUserRow(raw: unknown): TimeTrackingUserRow | null {
    if (raw == null || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = Number(o.id ?? o.auth_user_id ?? (o as { authUserId?: unknown }).authUserId);
    if (!Number.isFinite(id) || id <= 0)
        return null;
    const email = readTimeTrackingUserStr(o.email) ?? '';
    const position = readTimeTrackingUserStr(o.position) ??
        readTimeTrackingUserStr((o as { jobTitle?: unknown }).jobTitle) ??
        readTimeTrackingUserStr((o as { job_title?: unknown }).job_title) ??
        null;
    const whRaw = o.weekly_capacity_hours ?? (o as { weeklyCapacityHours?: unknown }).weeklyCapacityHours;
    const weekly_capacity_hours: string | number | undefined =
        typeof whRaw === 'string' || typeof whRaw === 'number' ? whRaw : undefined;
    const transferRaw = o.can_transfer_time_without_project_access
        ?? (o as { canTransferTimeWithoutProjectAccess?: unknown }).canTransferTimeWithoutProjectAccess;
    const can_transfer_time_without_project_access = transferRaw === true
        || transferRaw === 'true'
        || transferRaw === 1
        || transferRaw === '1'
            ? true
            : transferRaw === false || transferRaw === 'false' || transferRaw === 0 || transferRaw === '0'
                ? false
                : undefined;
    return {
        id,
        email,
        display_name: o.display_name != null ? readTimeTrackingUserStr(o.display_name) : readTimeTrackingUserStr((o as { displayName?: unknown }).displayName),
        picture: o.picture != null ? readTimeTrackingUserStr(o.picture) : null,
        role: readTimeTrackingUserStr(o.role) ?? undefined,
        position,
        initials: readTimeTrackingUserStr(o.initials),
        is_blocked: Boolean(o.is_blocked ?? (o as { isBlocked?: unknown }).isBlocked),
        is_archived: Boolean(o.is_archived ?? (o as { isArchived?: unknown }).isArchived),
        is_manual: o.is_manual === true || (o as { isManual?: unknown }).isManual === true
            ? true
            : id >= 2_000_000_000 ? true : undefined,
        ...(can_transfer_time_without_project_access != null
            ? { can_transfer_time_without_project_access }
            : {}),
        weekly_capacity_hours,
        created_at: readTimeTrackingUserStr(o.created_at) ?? readTimeTrackingUserStr((o as { createdAt?: unknown }).createdAt) ?? '',
        updated_at: o.updated_at != null || (o as { updatedAt?: unknown }).updatedAt != null
            ? (readTimeTrackingUserStr(o.updated_at) ?? readTimeTrackingUserStr((o as { updatedAt?: unknown }).updatedAt))
            : null,
    };
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
    
    applies_to_project_id?: string | null;
    project_id?: string | null;
    projectId?: string | null;
};

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

export async function getTimeTrackingUser(authUserId: number): Promise<TimeTrackingUserRow> {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}`);
    await throwIfNotOk(res);
    const row = normalizeTimeTrackingUserRow(await res.json());
    if (!row)
        throw new Error('Пользователь не найден в учёте времени');
    return row;
}

export async function createManualTimeTrackingUser(body: ManualTimeTrackingUserCreateBody): Promise<TimeTrackingUserRow> {
    const name = body.displayName.trim();
    if (!name)
        throw new Error('Укажите имя сотрудника');
    const payload: Record<string, unknown> = { displayName: name };
    const email = body.email?.trim();
    if (email)
        payload.email = email;
    const position = body.position?.trim();
    if (position)
        payload.position = position;
    if (body.isArchived !== undefined)
        payload.isArchived = body.isArchived;
    if (body.weeklyCapacityHours !== undefined)
        payload.weeklyCapacityHours = body.weeklyCapacityHours;
    const res = await apiFetch('/api/v1/time-tracking/users/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    const row = normalizeTimeTrackingUserRow(await res.json());
    if (!row)
        throw new Error('Некорректный ответ сервера');
    return { ...row, is_manual: true };
}

export async function patchTimeTrackingUserWeeklyCapacity(authUserId: number, weeklyCapacityHours: number): Promise<TimeTrackingUserRow> {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/weekly-capacity-hours`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyCapacityHours }),
    });
    await throwIfNotOk(res);
    const row = normalizeTimeTrackingUserRow(await res.json());
    if (!row)
        throw new Error('Не удалось обновить норму часов');
    return row;
}

export async function patchTimeTrackingUserTransferWithoutProjectAccess(
    authUserId: number,
    enabled: boolean,
): Promise<TimeTrackingUserRow> {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/transfer-without-project-access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
    });
    await throwIfNotOk(res);
    const row = normalizeTimeTrackingUserRow(await res.json());
    if (!row)
        throw new Error('Не удалось обновить право на перенос');
    return row;
}

export async function listTimeTrackingUsers(): Promise<TimeTrackingUserRow[]> {
    return fetchTimeTrackingUsersCached();
}

let timeTrackingUsersInflight: Promise<TimeTrackingUserRow[]> | null = null;

export async function fetchTimeTrackingUsersImpl(): Promise<TimeTrackingUserRow[]> {
    const res = await apiFetch('/api/v1/time-tracking/users');
    await throwIfNotOk(res);
    const raw: unknown = await res.json();
    let arr: unknown[] = [];
    if (Array.isArray(raw)) {
        arr = raw;
    }
    else if (raw && typeof raw === 'object') {
        const o = raw as { items?: unknown[]; data?: unknown[] };
        if (Array.isArray(o.items))
            arr = o.items;
        else if (Array.isArray(o.data))
            arr = o.data;
    }
    return arr.map((item) => normalizeTimeTrackingUserRow(item)).filter((x): x is TimeTrackingUserRow => x != null);
}

export function fetchTimeTrackingUsersCached(): Promise<TimeTrackingUserRow[]> {
    if (!timeTrackingUsersInflight) {
        timeTrackingUsersInflight = fetchTimeTrackingUsersImpl().catch((err) => {
            timeTrackingUsersInflight = null;
            throw err;
        });
    }
    return timeTrackingUsersInflight;
}

export function invalidateTimeTrackingUsersCache(): void {
    timeTrackingUsersInflight = null;
}

export type WeeklySubmissionResult = {
    authUserId: number;
    weekStart: string;
    weekEnd: string;
    status: string;
    created: boolean;
};
export async function submitWeeklyTime(authUserId: number, workDate?: string): Promise<WeeklySubmissionResult> {
    const body = workDate?.trim() ? { workDate: workDate.trim().slice(0, 10) } : {};
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/weekly-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    _invalidateReportCache();
    const raw = (await res.json()) as Record<string, unknown>;
    return {
        authUserId: Number(raw.authUserId ?? raw.auth_user_id),
        weekStart: String(raw.weekStart ?? raw.week_start ?? ''),
        weekEnd: String(raw.weekEnd ?? raw.week_end ?? ''),
        status: String(raw.status ?? 'submitted'),
        created: Boolean(raw.created),
    };
}
export async function listWeeklySubmissions(
    authUserId: number,
    from?: string,
    to?: string,
): Promise<WeeklySubmissionResult[]> {
    const qs = new URLSearchParams();
    const df = from?.trim().slice(0, 10);
    const dt = to?.trim().slice(0, 10);
    if (df)
        qs.set('from', df);
    if (dt)
        qs.set('to', dt);
    const suffix = qs.toString() ? `?${qs}` : '';
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/weekly-submissions${suffix}`);
    await throwIfNotOk(res);
    const raw = await res.json() as unknown;
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((item) => {
        const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return {
            authUserId: Number(o.authUserId ?? o.auth_user_id ?? authUserId),
            weekStart: String(o.weekStart ?? o.week_start ?? ''),
            weekEnd: String(o.weekEnd ?? o.week_end ?? ''),
            status: String(o.status ?? 'submitted'),
            created: Boolean(o.created),
        };
    });
}

export function normalizeHourlyRateRow(r: HourlyRateRow): HourlyRateRow {
    const o = r as HourlyRateRow & { applies_to_project_id?: string | null; appliesToProjectId?: string | null; project_id?: string | null; projectId?: string | null };
    const project_id = o.applies_to_project_id ?? o.appliesToProjectId ?? o.project_id ?? o.projectId ?? null;
    return { ...o, applies_to_project_id: project_id, project_id, projectId: project_id };
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
    appliesToProjectId?: string | null;
    projectId?: string | null;
}): Promise<HourlyRateRow> {
    const payload: Record<string, unknown> = {
        rateKind: body.rateKind,
        amount: body.amount,
        currency: body.currency,
        validFrom: body.validFrom?.trim() || null,
        validTo: body.validTo?.trim() || null,
    };
    const appliesTo = body.appliesToProjectId ?? body.projectId;
    if (appliesTo != null && String(appliesTo).trim() !== '')
        payload.appliesToProjectId = String(appliesTo).trim();
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    _invalidateReportCache();
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
    _invalidateReportCache();
    return normalizeHourlyRateRow((await res.json()) as HourlyRateRow);
}
export async function deleteHourlyRate(authUserId: number, rateId: string): Promise<void> {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates/${encodeURIComponent(rateId)}`, {
        method: 'DELETE',
    });
    await throwIfNotOk(res);
    _invalidateReportCache();
}

export type HourlyRateChangeFromResult = {
    new_rate: HourlyRateRow | null;
    closed_rate: HourlyRateRow | null;
    before_rate: HourlyRateRow | null;
    updated_rate: HourlyRateRow | null;
};

export async function changeHourlyRateFrom(authUserId: number, body: {
    rateKind: HourlyRateKind;
    appliesToProjectId?: string | null;
    effectiveFrom: string;
    amount: number;
    currency?: string;
    sourceRateId?: string;
}): Promise<HourlyRateChangeFromResult> {
    const payload: Record<string, unknown> = {
        rateKind: body.rateKind,
        effectiveFrom: body.effectiveFrom,
        amount: body.amount,
    };
    const projectId = body.appliesToProjectId != null ? String(body.appliesToProjectId).trim() : '';
    if (projectId)
        payload.appliesToProjectId = projectId;
    if (body.currency && body.currency.trim())
        payload.currency = body.currency.trim();
    if (body.sourceRateId && body.sourceRateId.trim())
        payload.sourceRateId = body.sourceRateId.trim();
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates/change-from`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    await throwIfNotOk(res);
    const raw = (await res.json()) as Record<string, unknown>;
    const pick = (k1: string, k2: string): HourlyRateRow | null => {
        const v = raw[k1] ?? raw[k2];
        return v && typeof v === 'object' ? normalizeHourlyRateRow(v as HourlyRateRow) : null;
    };
    _invalidateReportCache();
    return {
        new_rate: pick('new_rate', 'newRate'),
        closed_rate: pick('closed_rate', 'closedRate'),
        before_rate: pick('before_rate', 'beforeRate'),
        updated_rate: pick('updated_rate', 'updatedRate'),
    };
}
