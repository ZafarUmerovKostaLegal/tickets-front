import type { PatchTimeEntryBody, TimeEntryRow, TimeEntryVoidKind, } from '@entities/time-tracking';
import type { TimeExcelPreviewRow, } from './previewExcelTypes';

function hoursToDurationSeconds(h: number): number {
    const x = Number.isFinite(h) ? h : 0;
    return Math.max(0, Math.round(x * 3600));
}
function taskIdForApi(taskId: string): string | null {
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
    return {
        workDate: workDateYmd(row.workDate),
        
        durationSeconds: hoursToDurationSeconds(durationHoursForPatch(row)),
        isBillable: Boolean(row.isBillable),
        projectId: String(row.projectId ?? '').trim() || null,
        taskId: taskIdForApi(row.taskId),
        description: (row.note || row.description || '').trim() || null,
    };
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
    if (tr.created_at != null && String(tr.created_at).trim())
        o.recordedAt = String(tr.created_at);
    const trAny2 = tr as TimeEntryRow & { billableAmount?: unknown };
    const baRaw = tr.billable_amount ?? trAny2.billableAmount;
    if (baRaw != null && String(baRaw).trim() !== '') {
        const x = parseFloat(String(baRaw));
        if (Number.isFinite(x))
            o.amountToPay = x;
    }
    return o;
}
