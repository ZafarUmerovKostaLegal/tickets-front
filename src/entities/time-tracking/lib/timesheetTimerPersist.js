import { MIN_ENTRY_SECONDS } from '@shared/lib/formatTrackingHours';
import { createTimeEntry, patchTimeEntry, upsertTimeTrackingUser } from '../api';
import { isClosedReportingWeekEditingBlockedForSubject } from './timeEntryEditUnlockStorage';
const stopInFlight = new Set();
export function isDraftTimeEntryId(id) {
    return id.startsWith('te_');
}
export function buildTimeEntryDescription(task, notes) {
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
export function parseTimeEntryDescription(raw) {
    const s = (raw ?? '').trim();
    if (!s.length)
        return { taskLine: '', notes: '' };
    const idx = s.indexOf('\n');
    if (idx === -1)
        return { taskLine: s, notes: '' };
    return { taskLine: s.slice(0, idx).trim(), notes: s.slice(idx + 1).trim() };
}
export function resolveTimeEntryNotesOnly(raw, taskName) {
    const { taskLine, notes } = parseTimeEntryDescription(raw);
    if (notes.trim())
        return notes;
    const line = taskLine.trim();
    if (!line)
        return '';
    const task = (taskName ?? '').trim();
    if (task && line.toLowerCase() === task.toLowerCase())
        return '';
    return line;
}
function snapshotWorkDate(snapshot) {
    const raw = snapshot.date?.trim().slice(0, 10);
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw))
        return raw;
    return null;
}
export async function persistTimesheetTimerStopToApi(options) {
    const { authUserId, entryId, snapshot, user } = options;
    const durationSeconds = Math.max(0, Math.trunc(options.totalDurationSeconds));
    if (!user?.id)
        return { saved: false, reason: 'no_user' };
    if (durationSeconds < MIN_ENTRY_SECONDS)
        return { saved: false, reason: 'too_short' };
    const workDate = snapshotWorkDate(snapshot);
    if (!workDate)
        return { saved: false, reason: 'invalid' };
    if (isClosedReportingWeekEditingBlockedForSubject(authUserId, workDate, options.canOverrideWeeklyLock ?? false)) {
        return { saved: false, reason: 'blocked' };
    }
    if (stopInFlight.has(entryId))
        return { saved: false, reason: 'in_flight' };
    stopInFlight.add(entryId);
    try {
        await upsertTimeTrackingUser(user);
        if (isDraftTimeEntryId(entryId)) {
            const row = await createTimeEntry(authUserId, {
                workDate,
                durationSeconds,
                isBillable: snapshot.billable ?? true,
                projectId: snapshot.projectId ?? null,
                taskId: snapshot.taskId ?? null,
                description: buildTimeEntryDescription(snapshot.task ?? '', snapshot.notes ?? ''),
            });
            return { saved: true, serverEntryId: row.id, row };
        }
        const row = await patchTimeEntry(authUserId, entryId, { durationSeconds });
        return { saved: true, serverEntryId: entryId, row };
    }
    finally {
        stopInFlight.delete(entryId);
    }
}
