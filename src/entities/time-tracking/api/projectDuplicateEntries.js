import { apiFetch } from '@shared/api';
import { reportCacheInvalidateAll } from '../lib/reportApiCache';
function pickStr(o, ...keys) {
    for (const k of keys) {
        const v = o[k];
        if (v != null && String(v).trim())
            return String(v).trim();
    }
    return '';
}
function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
function normalizeDuplicateRow(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const entryId = pickStr(o, 'entry_id', 'entryId');
    const authUserId = num(o.auth_user_id ?? o.authUserId);
    if (!entryId || authUserId <= 0)
        return null;
    return {
        entry_id: entryId,
        auth_user_id: authUserId,
        user_name: pickStr(o, 'user_name', 'userName'),
        user_initials: pickStr(o, 'user_initials', 'userInitials') || null,
        work_date: pickStr(o, 'work_date', 'workDate'),
        task_id: pickStr(o, 'task_id', 'taskId') || null,
        task_name: pickStr(o, 'task_name', 'taskName'),
        description: pickStr(o, 'description'),
        hours: num(o.hours),
        rounded_hours: num(o.rounded_hours ?? o.roundedHours),
        is_billable: o.is_billable === true || o.isBillable === true,
        billable_amount: num(o.billable_amount ?? o.billableAmount),
        currency: pickStr(o, 'currency') || 'USD',
        created_at: pickStr(o, 'created_at', 'createdAt') || null,
    };
}
function normalizeDuplicateGroup(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const entriesRaw = o.entries;
    const entries = Array.isArray(entriesRaw)
        ? entriesRaw.map(normalizeDuplicateRow).filter((x) => x != null)
        : [];
    if (entries.length === 0)
        return null;
    return {
        group_id: pickStr(o, 'group_id', 'groupId'),
        group_label: pickStr(o, 'group_label', 'groupLabel'),
        auth_user_id: num(o.auth_user_id ?? o.authUserId),
        user_name: pickStr(o, 'user_name', 'userName'),
        user_initials: pickStr(o, 'user_initials', 'userInitials') || null,
        work_date: pickStr(o, 'work_date', 'workDate'),
        task_id: pickStr(o, 'task_id', 'taskId') || null,
        task_name: pickStr(o, 'task_name', 'taskName'),
        description: pickStr(o, 'description'),
        rounded_hours: num(o.rounded_hours ?? o.roundedHours),
        billable_amount: num(o.billable_amount ?? o.billableAmount),
        currency: pickStr(o, 'currency') || 'USD',
        entries_in_group: num(o.entries_in_group ?? o.entriesInGroup) || entries.length,
        entries,
    };
}
export function normalizeProjectDuplicateScanResult(raw) {
    const empty = {
        groups: [],
        summary: { group_count: 0, entry_count: 0, user_count: 0 },
    };
    if (!raw || typeof raw !== 'object')
        return empty;
    const o = raw;
    const groupsRaw = o.groups;
    const groups = Array.isArray(groupsRaw)
        ? groupsRaw.map(normalizeDuplicateGroup).filter((x) => x != null)
        : [];
    const summaryRaw = (o.summary ?? {});
    return {
        groups,
        summary: {
            group_count: num(summaryRaw.group_count ?? summaryRaw.groupCount) || groups.length,
            entry_count: num(summaryRaw.entry_count ?? summaryRaw.entryCount),
            user_count: num(summaryRaw.user_count ?? summaryRaw.userCount),
        },
    };
}
export async function fetchProjectDuplicateTimeEntries(clientId, projectId, opts) {
    const params = new URLSearchParams();
    if (opts?.dateFrom)
        params.set('dateFrom', opts.dateFrom);
    if (opts?.dateTo)
        params.set('dateTo', opts.dateTo);
    const qs = params.toString();
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}/duplicate-time-entries${qs ? `?${qs}` : ''}`);
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Не удалось проверить дубликаты');
    }
    return normalizeProjectDuplicateScanResult(await res.json());
}
export async function archiveProjectDuplicateEntries(clientId, projectId, entries) {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}/duplicate-time-entries/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            entries: entries.map((e) => ({
                authUserId: e.authUserId,
                entryId: e.entryId,
                duplicateGroupId: e.duplicateGroupId,
                userName: e.userName,
                taskName: e.taskName,
            })),
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Не удалось архивировать записи');
    }
    const data = await res.json();
    reportCacheInvalidateAll();
    return {
        archived_count: num(data.archived_count ?? data.archivedCount),
        skipped_count: num(data.skipped_count ?? data.skippedCount),
    };
}
export async function listProjectArchivedTimeEntries(clientId, projectId, includeRestored = false) {
    const params = includeRestored ? '?includeRestored=true' : '';
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}/archived-time-entries${params}`);
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Не удалось загрузить архив');
    }
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((raw) => {
        const o = (raw ?? {});
        return {
            archive_id: pickStr(o, 'archive_id', 'archiveId'),
            time_entry_id: pickStr(o, 'time_entry_id', 'timeEntryId'),
            auth_user_id: num(o.auth_user_id ?? o.authUserId),
            project_id: pickStr(o, 'project_id', 'projectId') || null,
            client_id: pickStr(o, 'client_id', 'clientId') || null,
            duplicate_group_id: pickStr(o, 'duplicate_group_id', 'duplicateGroupId') || null,
            archived_at: pickStr(o, 'archived_at', 'archivedAt') || null,
            restored_at: pickStr(o, 'restored_at', 'restoredAt') || null,
            is_restored: o.is_restored === true || o.isRestored === true,
            work_date: pickStr(o, 'work_date', 'workDate'),
            user_name: pickStr(o, 'user_name', 'userName'),
            task_name: pickStr(o, 'task_name', 'taskName'),
            description: pickStr(o, 'description'),
            hours: pickStr(o, 'hours'),
            rounded_hours: pickStr(o, 'rounded_hours', 'roundedHours'),
        };
    }).filter((r) => r.archive_id);
}
export async function restoreProjectArchivedTimeEntry(clientId, projectId, archiveId) {
    const res = await apiFetch(`/api/v1/time-tracking/clients/${encodeURIComponent(clientId)}/projects/${encodeURIComponent(projectId)}/archived-time-entries/${encodeURIComponent(archiveId)}/restore`, { method: 'POST' });
    if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail ?? 'Не удалось восстановить запись');
    }
    reportCacheInvalidateAll();
}
