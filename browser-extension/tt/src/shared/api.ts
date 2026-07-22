import type { ExtUser, TimerSnapshot } from './types';
import { todayYmd } from './format';

type TimeEntryRow = {
    id: string;
    workDate?: string;
    durationSeconds?: number;
    description?: string | null;
    projectId?: string | null;
    taskId?: string | null;
    isBillable?: boolean;
    projectName?: string | null;
    clientName?: string | null;
};

async function apiFetch(apiBase: string, token: string, path: string, init: RequestInit = {}): Promise<Response> {
    const base = apiBase.replace(/\/$/, '');
    const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = new Headers(init.headers);
    const bearer = token.trim();
    if (bearer)
        headers.set('Authorization', `Bearer ${bearer}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type'))
        headers.set('Content-Type', 'application/json');
    return fetch(url, { ...init, headers, credentials: 'include' });
}

export async function fetchMe(apiBase: string, token: string): Promise<ExtUser> {
    const res = await apiFetch(apiBase, token, '/api/v1/users/me');
    if (!res.ok)
        throw new Error(`Auth failed (${res.status})`);
    const data = await res.json() as Record<string, unknown>;
    return {
        id: Number(data.id),
        email: String(data.email ?? ''),
        display_name: String(data.display_name ?? data.displayName ?? ''),
        role: String(data.role ?? ''),
        time_tracking_role: (data.time_tracking_role ?? data.timeTrackingRole ?? null) as ExtUser['time_tracking_role'],
    };
}

export async function listTodayEntries(apiBase: string, token: string, userId: number): Promise<TimeEntryRow[]> {
    const day = todayYmd();
    const qs = new URLSearchParams({ from: day, to: day });
    const res = await apiFetch(apiBase, token, `/api/v1/time-tracking/users/${userId}/time-entries?${qs}`);
    if (!res.ok)
        return [];
    return (await res.json()) as TimeEntryRow[];
}

export function rowToSnapshot(row: TimeEntryRow): TimerSnapshot {
    const desc = (row.description ?? '').trim();
    const taskLine = desc.split('\n')[0]?.trim() ?? '';
    const notes = desc.includes('\n') ? desc.slice(desc.indexOf('\n') + 1).trim() : '';
    return {
        id: row.id,
        date: row.workDate?.slice(0, 10) ?? todayYmd(),
        project: row.projectName ?? '',
        client: row.clientName ?? '',
        projectId: row.projectId ?? undefined,
        taskId: row.taskId ?? undefined,
        task: taskLine,
        notes,
        hours: (row.durationSeconds ?? 0) / 3600,
        durationSeconds: row.durationSeconds ?? 0,
        billable: row.isBillable ?? true,
    };
}

export async function createTimeEntry(
    apiBase: string,
    token: string,
    userId: number,
    body: {
        workDate: string;
        durationSeconds: number;
        isBillable?: boolean;
        projectId?: string | null;
        taskId?: string | null;
        description?: string | null;
    },
): Promise<TimeEntryRow> {
    const res = await apiFetch(apiBase, token, `/api/v1/time-tracking/users/${userId}/time-entries`, {
        method: 'POST',
        body: JSON.stringify({
            workDate: body.workDate,
            durationSeconds: body.durationSeconds,
            isBillable: body.isBillable ?? true,
            projectId: body.projectId ?? null,
            taskId: body.taskId ?? null,
            description: body.description ?? null,
        }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Create failed (${res.status})`);
    }
    return (await res.json()) as TimeEntryRow;
}

export async function patchTimeEntry(
    apiBase: string,
    token: string,
    userId: number,
    entryId: string,
    patch: { durationSeconds: number },
): Promise<TimeEntryRow> {
    const res = await apiFetch(apiBase, token, `/api/v1/time-tracking/users/${userId}/time-entries/${encodeURIComponent(entryId)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Update failed (${res.status})`);
    }
    return (await res.json()) as TimeEntryRow;
}

export async function sumTodayHours(apiBase: string, token: string, userId: number): Promise<number> {
    const rows = await listTodayEntries(apiBase, token, userId);
    return rows.reduce((s, r) => s + (r.durationSeconds ?? 0), 0) / 3600;
}
