import { createTimeEntry, patchTimeEntry, rowToSnapshot, listTodayEntries } from './api';
import { MIN_ENTRY_SECONDS } from './constants';
import { baseDurationSeconds, elapsedSeconds, isDraftEntryId, todayYmd } from './format';
import type { AuthState, TimerPayload, TimerSnapshot } from './types';

function buildDescription(task: string, notes: string): string | null {
    const t = task.trim();
    const n = notes.trim();
    if (!t && !n)
        return null;
    if (!t)
        return n;
    if (!n)
        return t;
    return `${t}\n${n}`;
}

export function makeDraftPayload(auth: AuthState, snapshot: TimerSnapshot, baseSeconds = 0): TimerPayload {
    const date = snapshot.date?.slice(0, 10) || todayYmd();
    return {
        v: 1,
        authUserId: auth.user.id,
        entryId: `te_ext_${Date.now()}`,
        startedAt: Date.now(),
        paused: false,
        snapshot: {
            ...snapshot,
            date,
            durationSeconds: baseSeconds,
            hours: baseSeconds / 3600,
        },
    };
}

export async function resolveRecentSnapshot(auth: AuthState): Promise<TimerSnapshot | null> {
    const rows = await listTodayEntries(auth.apiBase, auth.token, auth.user.id);
    if (!rows.length) {
        const stored = await chrome.storage.local.get('kl_tt_last_snapshot');
        const snap = stored.kl_tt_last_snapshot as TimerSnapshot | undefined;
        return snap ?? null;
    }
    const last = rows[rows.length - 1];
    const snap = rowToSnapshot(last);
    await chrome.storage.local.set({ kl_tt_last_snapshot: snap });
    return snap;
}

export async function stopTimer(auth: AuthState, payload: TimerPayload): Promise<{ ok: true } | { ok: false; reason: string }> {
    const durationSeconds = elapsedSeconds(payload);
    if (durationSeconds < MIN_ENTRY_SECONDS)
        return { ok: false, reason: 'Минимум 1 минута' };
    const snap = payload.snapshot;
    const workDate = snap.date?.slice(0, 10) || todayYmd();
    const description = buildDescription(snap.task ?? '', snap.notes ?? '');

    if (isDraftEntryId(payload.entryId)) {
        await createTimeEntry(auth.apiBase, auth.token, auth.user.id, {
            workDate,
            durationSeconds,
            isBillable: snap.billable ?? true,
            projectId: snap.projectId ?? null,
            taskId: snap.taskId ?? null,
            description,
        });
    }
    else {
        await patchTimeEntry(auth.apiBase, auth.token, auth.user.id, payload.entryId, { durationSeconds });
    }
    await chrome.storage.local.set({ kl_tt_last_snapshot: snap });
    return { ok: true };
}

export function payloadFromPageStorage(raw: string, userId: number): TimerPayload | null {
    try {
        const o = JSON.parse(raw) as Partial<TimerPayload>;
        if (o.v !== 1 || o.authUserId !== userId || typeof o.entryId !== 'string' || typeof o.startedAt !== 'number' || !o.snapshot)
            return null;
        return o as TimerPayload;
    }
    catch {
        return null;
    }
}

export function toPageStoragePayload(payload: TimerPayload): string {
    return JSON.stringify({
        ...payload,
        snapshot: {
            ...payload.snapshot,
            durationSeconds: baseDurationSeconds(payload.snapshot),
            hours: baseDurationSeconds(payload.snapshot) / 3600,
        },
    });
}
