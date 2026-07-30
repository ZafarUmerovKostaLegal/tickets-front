import { apiFetch } from '@shared/api';
import { absorbTimeEntryRowEditUnlockHint, recordTimeEntryEditUnlockExpiry } from '../../lib/timeEntryEditUnlockStorage';
import { reportCacheInvalidateAll as _invalidateReportCache } from '../../lib/reportApiCache';
import { throwIfNotOk } from './httpShared';

export type TimeEntryVoidKind = 'rejected' | 'reallocated';
export type TimeEntryRow = {
    id: string;
    auth_user_id: number;
    work_date: string;
    hours: string | number;
    duration_seconds?: number;
    is_billable: boolean;
    project_id: string | null;
    project_name?: string | null;
    client_id?: string | null;
    client_name?: string | null;
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
    scope_color?: string | null;
    scopeColor?: string | null;
};
export function pickTimeEntryStr(obj: Record<string, unknown>, keys: string[]): string | null {
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
    const project_name = pickTimeEntryStr(o, ['project_name', 'projectName'])
        ?? (typeof o.project === 'object' && o.project != null
            ? pickTimeEntryStr(o.project as Record<string, unknown>, ['name', 'title', 'project_name', 'projectName'])
            : null);
    const client_name = pickTimeEntryStr(o, ['client_name', 'clientName'])
        ?? (typeof o.client === 'object' && o.client != null
            ? pickTimeEntryStr(o.client as Record<string, unknown>, ['name', 'title', 'client_name', 'clientName'])
            : null);
    const client_id = pickTimeEntryStr(o, ['client_id', 'clientId'])
        ?? (typeof o.client === 'object' && o.client != null
            ? pickTimeEntryStr(o.client as Record<string, unknown>, ['id', 'client_id', 'clientId'])
            : null);
    const normalized: TimeEntryRow = {
        ...o,
        voided_at: voidedAt,
        void_kind,
        is_voided,
        project_name,
        client_name,
        client_id,
    };
    absorbTimeEntryRowEditUnlockHint(normalized as TimeEntryRow & Record<string, unknown>);
    return normalized;
}

export async function listTimeEntries(authUserId: number, from: string, to: string): Promise<TimeEntryRow[]> {
    const qs = new URLSearchParams({ from, to });
    const primary = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries?${qs}`);
    const mapRows = (raw: TimeEntryRow[]) => raw.map(normalizeTimeEntryRow);
    if (primary.ok)
        return mapRows((await primary.json()) as TimeEntryRow[]);
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
    _invalidateReportCache();
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
    /** Report Scope highlight (#RRGGBB); null clears. */
    scopeColor?: string | null;
};
export async function patchTimeEntry(authUserId: number, entryId: string, patch: PatchTimeEntryBody): Promise<TimeEntryRow> {
    const body: PatchTimeEntryBody = { ...patch };
    if (body.durationSeconds != null && body.durationSeconds < 1)
        delete body.durationSeconds;
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries/${encodeURIComponent(entryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    _invalidateReportCache();
    return normalizeTimeEntryRow((await res.json()) as TimeEntryRow);
}

export async function fetchTimeEntry(authUserId: number, entryId: string): Promise<TimeEntryRow | null> {
    const uid = String(entryId ?? '').trim();
    if (!uid)
        return null;
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries/${encodeURIComponent(uid)}`, {
        method: 'GET',
    });
    // Do not probe legacy `/api/v1/users/...` — that doubles console 404 noise on prod.
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

export function normalizeTimeEntryEditUnlockGrant(raw: Record<string, unknown>): TimeEntryEditUnlockGrantOut {
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

export async function parseUnlockGrantResponse(res: Response): Promise<TimeEntryEditUnlockGrantOut> {
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
    _invalidateReportCache();
    if (res.status === 204)
        return null;
    const text = await res.text();
    if (!text.trim())
        return null;
    try {
        return normalizeTimeEntryRow(JSON.parse(text) as TimeEntryRow);
    }
    catch {
        return null;
    }
}
