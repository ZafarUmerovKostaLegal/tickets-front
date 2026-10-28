import { apiFetch } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
import { reportCacheInvalidateAll as _invalidateReportCache } from '../../lib/reportApiCache';
import { throwIfNotOk } from './httpShared';
export function readTimeTrackingUserStr(v) {
    if (v == null)
        return null;
    const s = String(v).trim();
    return s.length > 0 ? s : null;
}
export function normalizeTimeTrackingUserRow(raw) {
    if (raw == null || typeof raw !== 'object')
        return null;
    const o = raw;
    const id = Number(o.id ?? o.auth_user_id ?? o.authUserId);
    if (!Number.isFinite(id) || id <= 0)
        return null;
    const email = readTimeTrackingUserStr(o.email) ?? '';
    const position = readTimeTrackingUserStr(o.position) ??
        readTimeTrackingUserStr(o.jobTitle) ??
        readTimeTrackingUserStr(o.job_title) ??
        null;
    const whRaw = o.weekly_capacity_hours ?? o.weeklyCapacityHours;
    const weekly_capacity_hours = typeof whRaw === 'string' || typeof whRaw === 'number' ? whRaw : undefined;
    const transferRaw = o.can_transfer_time_without_project_access
        ?? o.canTransferTimeWithoutProjectAccess;
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
        display_name: o.display_name != null ? readTimeTrackingUserStr(o.display_name) : readTimeTrackingUserStr(o.displayName),
        picture: o.picture != null ? readTimeTrackingUserStr(o.picture) : null,
        role: readTimeTrackingUserStr(o.role) ?? undefined,
        position,
        initials: readTimeTrackingUserStr(o.initials),
        is_blocked: Boolean(o.is_blocked ?? o.isBlocked),
        is_archived: Boolean(o.is_archived ?? o.isArchived),
        is_manual: o.is_manual === true || o.isManual === true
            ? true
            : id >= 2_000_000_000 ? true : undefined,
        ...(can_transfer_time_without_project_access != null
            ? { can_transfer_time_without_project_access }
            : {}),
        weekly_capacity_hours,
        created_at: readTimeTrackingUserStr(o.created_at) ?? readTimeTrackingUserStr(o.createdAt) ?? '',
        updated_at: o.updated_at != null || o.updatedAt != null
            ? (readTimeTrackingUserStr(o.updated_at) ?? readTimeTrackingUserStr(o.updatedAt))
            : null,
    };
}
const timeTrackingUsersCache = createQueryCache({
    ttlMs: 60_000,
    staleWhileRevalidateMs: 4 * 60_000,
    maxEntries: 1,
});
export async function upsertTimeTrackingUser(user, options) {
    const email = (user.email ?? '').trim();
    if (!email) {
        throw new Error('У пользователя нет email — запрос синхронизации не пройдёт валидацию на gateway');
    }
    const ttRole = user.time_tracking_role;
    const rolePayload = ttRole === 'user' || ttRole === 'manager' ? ttRole : '';
    const body = {
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
    invalidateTimeTrackingUsersCache();
}
export async function deleteTimeTrackingUser(authUserId) {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}`, { method: 'DELETE' });
    await throwIfNotOk(res);
    invalidateTimeTrackingUsersCache();
}
export async function getTimeTrackingUser(authUserId) {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}`);
    await throwIfNotOk(res);
    const row = normalizeTimeTrackingUserRow(await res.json());
    if (!row)
        throw new Error('Пользователь не найден в учёте времени');
    return row;
}
export async function createManualTimeTrackingUser(body) {
    const name = body.displayName.trim();
    if (!name)
        throw new Error('Укажите имя сотрудника');
    const payload = { displayName: name };
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
    invalidateTimeTrackingUsersCache();
    return { ...row, is_manual: true };
}
export async function patchTimeTrackingUserWeeklyCapacity(authUserId, weeklyCapacityHours) {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/weekly-capacity-hours`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyCapacityHours }),
    });
    await throwIfNotOk(res);
    const row = normalizeTimeTrackingUserRow(await res.json());
    if (!row)
        throw new Error('Не удалось обновить норму часов');
    invalidateTimeTrackingUsersCache();
    return row;
}
export async function patchTimeTrackingUserTransferWithoutProjectAccess(authUserId, enabled) {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/transfer-without-project-access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
    });
    await throwIfNotOk(res);
    const row = normalizeTimeTrackingUserRow(await res.json());
    if (!row)
        throw new Error('Не удалось обновить право на перенос');
    invalidateTimeTrackingUsersCache();
    return row;
}
export async function listTimeTrackingUsers(signal) {
    return fetchTimeTrackingUsersCached(signal);
}
export async function fetchTimeTrackingUsersImpl(signal) {
    const res = await apiFetch('/api/v1/time-tracking/users', { signal, getReuseWindowMs: 5_000 });
    await throwIfNotOk(res);
    const raw = await res.json();
    let arr = [];
    if (Array.isArray(raw)) {
        arr = raw;
    }
    else if (raw && typeof raw === 'object') {
        const o = raw;
        if (Array.isArray(o.items))
            arr = o.items;
        else if (Array.isArray(o.data))
            arr = o.data;
    }
    return arr.map((item) => normalizeTimeTrackingUserRow(item)).filter((x) => x != null);
}
export function fetchTimeTrackingUsersCached(signal) {
    return timeTrackingUsersCache.fetch('all', (sharedSignal) => fetchTimeTrackingUsersImpl(sharedSignal), { signal });
}
export function invalidateTimeTrackingUsersCache() {
    timeTrackingUsersCache.invalidate();
}
export async function submitWeeklyTime(authUserId, workDate) {
    const body = workDate?.trim() ? { workDate: workDate.trim().slice(0, 10) } : {};
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/weekly-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    _invalidateReportCache();
    const raw = (await res.json());
    return {
        authUserId: Number(raw.authUserId ?? raw.auth_user_id),
        weekStart: String(raw.weekStart ?? raw.week_start ?? ''),
        weekEnd: String(raw.weekEnd ?? raw.week_end ?? ''),
        status: String(raw.status ?? 'submitted'),
        created: Boolean(raw.created),
    };
}
export async function listWeeklySubmissions(authUserId, from, to) {
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
    const raw = await res.json();
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((item) => {
        const o = (item && typeof item === 'object' ? item : {});
        return {
            authUserId: Number(o.authUserId ?? o.auth_user_id ?? authUserId),
            weekStart: String(o.weekStart ?? o.week_start ?? ''),
            weekEnd: String(o.weekEnd ?? o.week_end ?? ''),
            status: String(o.status ?? 'submitted'),
            created: Boolean(o.created),
        };
    });
}
export function normalizeHourlyRateRow(r) {
    const o = r;
    const project_id = o.applies_to_project_id ?? o.appliesToProjectId ?? o.project_id ?? o.projectId ?? null;
    return { ...o, applies_to_project_id: project_id, project_id, projectId: project_id };
}
export async function listHourlyRates(authUserId, kind, options) {
    const qs = new URLSearchParams({ kind });
    if (options?.projectId)
        qs.set('projectId', String(options.projectId));
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates?${qs}`);
    await throwIfNotOk(res);
    const raw = (await res.json());
    return Array.isArray(raw) ? raw.map((row) => normalizeHourlyRateRow(row)) : [];
}
export async function createHourlyRate(authUserId, body) {
    const payload = {
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
    return normalizeHourlyRateRow((await res.json()));
}
export async function patchHourlyRate(authUserId, rateId, patch) {
    const body = {};
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
    return normalizeHourlyRateRow((await res.json()));
}
export async function deleteHourlyRate(authUserId, rateId) {
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/hourly-rates/${encodeURIComponent(rateId)}`, {
        method: 'DELETE',
    });
    await throwIfNotOk(res);
    _invalidateReportCache();
}
export async function changeHourlyRateFrom(authUserId, body) {
    const payload = {
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
    const raw = (await res.json());
    const pick = (k1, k2) => {
        const v = raw[k1] ?? raw[k2];
        return v && typeof v === 'object' ? normalizeHourlyRateRow(v) : null;
    };
    _invalidateReportCache();
    return {
        new_rate: pick('new_rate', 'newRate'),
        closed_rate: pick('closed_rate', 'closedRate'),
        before_rate: pick('before_rate', 'beforeRate'),
        updated_rate: pick('updated_rate', 'updatedRate'),
    };
}
