import type { CreateTimeEntryBody, PatchTimeEntryBody, TimeEntryRow, TimeEntryVoidKind, } from '@entities/time-tracking';
import type { TimeExcelPreviewRow, } from './previewExcelTypes';

function hoursToDurationSeconds(h: number): number {
    const x = Number.isFinite(h) ? h : 0;
    return Math.max(0, Math.round(x * 3600));
}
export function taskIdForApi(taskId: string): string | null {
    const t = String(taskId ?? '').trim();
    if (!t || t.startsWith('task:'))
        return null;
    return t;
}
function workDateYmd(wd: string): string {
    const s = String(wd ?? '').trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s))
        return s;
    return s || '1970-01-01';
}
function durationHoursForPatch(row: TimeExcelPreviewRow): number {
    const b = row.billableHours;
    const h = row.hours;
    if (Number.isFinite(b) && b >= 0)
        return b;
    if (Number.isFinite(h) && h >= 0)
        return h;
    return 0;
}

export function timeExcelPreviewRowToPatchBody(row: TimeExcelPreviewRow): PatchTimeEntryBody {
    const rec = String(row.recordedAt ?? '').trim();
    const out: PatchTimeEntryBody = {
        workDate: workDateYmd(row.workDate),
        durationSeconds: hoursToDurationSeconds(durationHoursForPatch(row)),
        isBillable: Boolean(row.isBillable),
        projectId: String(row.projectId ?? '').trim() || null,
        taskId: taskIdForApi(row.taskId),
        description: (row.note || row.description || '').trim() || null,
    };
    if (rec)
        out.recordedAt = rec;
    return out;
}

export function timeExcelPreviewRowToCreateBody(row: TimeExcelPreviewRow, overrides: {
    workDate: string;
    recordedAt?: string | null;
    durationSecondsOverride?: number;
}): CreateTimeEntryBody {
    let durationSeconds = hoursToDurationSeconds(durationHoursForPatch(row));
    if (typeof overrides.durationSecondsOverride === 'number' && Number.isFinite(overrides.durationSecondsOverride)) {
        durationSeconds = Math.max(0, Math.round(overrides.durationSecondsOverride));
    }
    else if (durationSeconds <= 0)
        durationSeconds = 3600;
    const body: CreateTimeEntryBody = {
        workDate: workDateYmd(overrides.workDate),
        durationSeconds,
        isBillable: Boolean(row.isBillable),
        projectId: String(row.projectId ?? '').trim() || null,
        taskId: taskIdForApi(row.taskId),
        description: (row.note || row.description || '').trim() || null,
    };
    if (overrides.recordedAt != null && String(overrides.recordedAt).trim() !== '') {
        body.recordedAt = String(overrides.recordedAt).trim();
    }
    return body;
}
function parseHoursField(h: string | number): number {
    if (typeof h === 'number')
        return Number.isFinite(h) ? h : 0;
    const v = parseFloat(h);
    return Number.isFinite(v) ? v : 0;
}

export function mergeTimeEntryResponseIntoRow(tr: TimeEntryRow): Partial<TimeExcelPreviewRow> {
    const h = parseHoursField(tr.hours);
    const trAny = tr as TimeEntryRow & { is_voided?: boolean; void_kind?: TimeEntryVoidKind | null };
    const isVoided = Boolean(trAny.is_voided);
    const voidKind: 'rejected' | 'reallocated' | null = isVoided
        ? (trAny.void_kind === 'reallocated' ? 'reallocated' : 'rejected')
        : null;
    const o: Partial<TimeExcelPreviewRow> = {
        workDate: (tr.work_date || '').trim().slice(0, 10),
        hours: h,
        billableHours: h,
        isBillable: tr.is_billable,
        isVoided,
        voidKind,
    };
    if (tr.description != null) {
        const d = String(tr.description);
        o.note = d;
        o.description = d;
    }
    if (tr.project_id != null)
        o.projectId = String(tr.project_id);
    if (tr.task_id != null)
        o.taskId = String(tr.task_id);
    const trRec = tr as TimeEntryRow & { recorded_at?: string | null; recordedAt?: string | null };
    const recRaw = trRec.recorded_at ?? trRec.recordedAt ?? tr.created_at;
    if (recRaw != null && String(recRaw).trim())
        o.recordedAt = String(recRaw).trim();
    const trAny2 = tr as TimeEntryRow & { billableAmount?: unknown };
    const baRaw = tr.billable_amount ?? trAny2.billableAmount;
    if (baRaw != null && String(baRaw).trim() !== '') {
        const x = parseFloat(String(baRaw));
        if (Number.isFinite(x))
            o.amountToPay = x;
    }
    return o;
}

export function previewRowAfterCreate(template: TimeExcelPreviewRow, tr: TimeEntryRow, opts?: { recordedAt?: string | null; }): TimeExcelPreviewRow {
    const merged = mergeTimeEntryResponseIntoRow(tr);
    const trRec = tr as TimeEntryRow & { recorded_at?: string | null; recordedAt?: string | null };
    const fromApi = trRec.recorded_at ?? trRec.recordedAt ?? merged.recordedAt;
    const recordedAt = opts?.recordedAt?.trim()
        || (typeof fromApi === 'string' && fromApi.trim() ? fromApi.trim() : '')
        || template.recordedAt
        || tr.created_at;
    const nextTaskId = String(merged.taskId ?? template.taskId ?? '').trim();
    return {
        ...template,
        ...merged,
        rowKey: `e-${tr.id}`,
        timeEntryId: tr.id,
        rowKind: 'entry',
        sourceEntryCount: 1,
        authUserId: tr.auth_user_id,
        recordedAt: String(recordedAt || ''),
        taskId: nextTaskId,
        taskName: template.taskName,
    };
}
