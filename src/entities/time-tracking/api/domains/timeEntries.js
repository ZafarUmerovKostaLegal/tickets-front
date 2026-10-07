import { apiFetch } from '@shared/api';
import { absorbTimeEntryRowEditUnlockHint, recordTimeEntryEditUnlockExpiry } from '../../lib/timeEntryEditUnlockStorage';
import { reportCacheInvalidateAll as _invalidateReportCache } from '../../lib/reportApiCache';
import { throwIfNotOk } from './httpShared';
export function pickTimeEntryStr(obj, keys) {
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === 'string' && v.trim())
            return v.trim();
    }
    return null;
}
export function normalizeTimeEntryRow(r) {
    const o = { ...r };
    const voidedAt = pickTimeEntryStr(o, ['voided_at', 'voidedAt']);
    const vk = pickTimeEntryStr(o, ['void_kind', 'voidKind']);
    const isVoidFlag = o.is_voided === true || o.isVoided === true;
    const is_voided = Boolean(voidedAt) || isVoidFlag;
    const void_kind = is_voided
        ? (vk === 'reallocated' ? 'reallocated' : 'rejected')
        : null;
    const project_name = pickTimeEntryStr(o, ['project_name', 'projectName'])
        ?? (typeof o.project === 'object' && o.project != null
            ? pickTimeEntryStr(o.project, ['name', 'title', 'project_name', 'projectName'])
            : null);
    const client_name = pickTimeEntryStr(o, ['client_name', 'clientName'])
        ?? (typeof o.client === 'object' && o.client != null
            ? pickTimeEntryStr(o.client, ['name', 'title', 'client_name', 'clientName'])
            : null);
    const client_id = pickTimeEntryStr(o, ['client_id', 'clientId'])
        ?? (typeof o.client === 'object' && o.client != null
            ? pickTimeEntryStr(o.client, ['id', 'client_id', 'clientId'])
            : null);
    const normalized = {
        ...o,
        voided_at: voidedAt,
        void_kind,
        is_voided,
        project_name,
        client_name,
        client_id,
    };
    absorbTimeEntryRowEditUnlockHint(normalized);
    return normalized;
}
export async function listTimeEntries(authUserId, from, to) {
    const qs = new URLSearchParams({ from, to });
    const primary = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries?${qs}`);
    const mapRows = (raw) => raw.map(normalizeTimeEntryRow);
    if (primary.ok)
        return mapRows((await primary.json()));
    await throwIfNotOk(primary);
    return mapRows((await primary.json()));
}
export async function createTimeEntry(authUserId, body) {
    const payload = {
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
    return normalizeTimeEntryRow((await res.json()));
}
export async function patchTimeEntry(authUserId, entryId, patch) {
    const body = { ...patch };
    if (body.durationSeconds != null && body.durationSeconds < 1)
        delete body.durationSeconds;
    const res = await apiFetch(`/api/v1/time-tracking/users/${authUserId}/time-entries/${encodeURIComponent(entryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    _invalidateReportCache();
    return normalizeTimeEntryRow((await res.json()));
}
export async function fetchTimeEntry(authUserId, entryId) {
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
    return normalizeTimeEntryRow((await res.json()));
}
export function normalizeTimeEntryEditUnlockGrant(raw) {
    const num = (v) => {
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
export async function parseUnlockGrantResponse(res) {
    const raw = (await res.json());
    const out = normalizeTimeEntryEditUnlockGrant(raw);
    recordTimeEntryEditUnlockExpiry(out.authUserId, out.workDate, out.expiresAt);
    return out;
}
export async function grantTimeEntryEditUnlock(authUserId, workDateYmd) {
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
export async function deleteTimeEntry(authUserId, entryId, options) {
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
        return normalizeTimeEntryRow(JSON.parse(text));
    }
    catch {
        return null;
    }
}
