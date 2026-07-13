import { createProjectTask, createTimeEntry, deleteTimeEntry, patchTimeEntry, type CreateTimeEntryBody, type PatchTimeEntryBody, type TimeEntryRow, type TimeEntryVoidKind, } from '@entities/time-tracking';
import { invalidateProjectTasksCache, listProjectTasksCached } from '@entities/time-tracking/lib/projectTasksCache';
import { resolveTimeEntryNotesOnly } from '@entities/time-tracking/lib/timesheetTimerPersist';
import { computeTimePreviewRowAmountToPay } from './reportPreviewPartnerExcel';
import { fetchBillableRateForPreviewRow, resolveBillableRateFromSiblingRows, } from './reportPreviewRowPatch';
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

export type ResolvedProjectTask = {
    taskId: string;
    taskName: string;
};

function normalizeTaskName(name: string): string {
    return String(name ?? '').trim().toLowerCase();
}

export function matchTaskInProjectList(tasks: ReadonlyArray<{ id: string; name: string }>, sourceTaskId: string, sourceTaskName: string): ResolvedProjectTask | null {
    const sid = String(sourceTaskId ?? '').trim();
    const sname = String(sourceTaskName ?? '').trim();
    if (sid && !sid.startsWith('task:')) {
        const byId = tasks.find((x) => String(x.id) === sid);
        if (byId)
            return { taskId: byId.id, taskName: byId.name };
    }
    if (sname) {
        const norm = normalizeTaskName(sname);
        const byName = tasks.find((x) => normalizeTaskName(x.name) === norm);
        if (byName)
            return { taskId: byName.id, taskName: byName.name };
    }
    return null;
}

export async function resolveTaskForTargetProject(args: {
    clientId: string;
    projectId: string;
    sourceTaskId: string;
    sourceTaskName: string;
    createIfMissing?: boolean;
}): Promise<ResolvedProjectTask | null> {
    const cid = String(args.clientId ?? '').trim();
    const pid = String(args.projectId ?? '').trim();
    if (!cid || !pid)
        return null;
    const sid = String(args.sourceTaskId ?? '').trim();
    const sname = String(args.sourceTaskName ?? '').trim();
    if (!sid && !sname)
        return null;
    const tasks = await listProjectTasksCached(cid, pid);
    const matched = matchTaskInProjectList(tasks, sid, sname);
    if (matched)
        return matched;
    if (!sname || args.createIfMissing === false)
        return null;
    try {
        const created = await createProjectTask(cid, pid, { name: sname, billableByDefault: true });
        invalidateProjectTasksCache(cid, pid);
        return { taskId: created.id, taskName: created.name };
    }
    catch {
        return null;
    }
}
function workDateYmd(wd: string): string {
    const s = String(wd ?? '').trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s))
        return s;
    return s || '1970-01-01';
}
function durationHoursForPatch(row: TimeExcelPreviewRow): number {
    const h = Number.isFinite(row.hours) ? row.hours : 0;
    const b = Number.isFinite(row.billableHours) ? row.billableHours : 0;
    if (row.isBillable)
        return Math.max(0, b);
    if (h > 0)
        return h;
    return Math.max(h, b, 0);
}

export function timeExcelPreviewRowToPatchBody(row: TimeExcelPreviewRow): PatchTimeEntryBody {
    const rec = String(row.recordedAt ?? '').trim();
    const durationSeconds = hoursToDurationSeconds(durationHoursForPatch(row));
    const out: PatchTimeEntryBody = {
        workDate: workDateYmd(row.workDate),
        isBillable: Boolean(row.isBillable),
        projectId: String(row.projectId ?? '').trim() || null,
        taskId: taskIdForApi(row.taskId),
        description: (row.note || row.description || '').trim() || null,
    };
    if (durationSeconds >= 1)
        out.durationSeconds = durationSeconds;
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

export function mergeTimeEntryResponseIntoRow(tr: TimeEntryRow, rowContext?: Pick<TimeExcelPreviewRow, 'taskName'>): Partial<TimeExcelPreviewRow> {
    const h = parseHoursField(tr.hours);
    const trAny = tr as TimeEntryRow & { is_voided?: boolean; void_kind?: TimeEntryVoidKind | null };
    const isVoided = Boolean(trAny.is_voided);
    const voidKind: 'rejected' | 'reallocated' | null = isVoided
        ? (trAny.void_kind === 'reallocated' ? 'reallocated' : 'rejected')
        : null;
    const o: Partial<TimeExcelPreviewRow> = {
        workDate: (tr.work_date || '').trim().slice(0, 10),
        hours: h,
        billableHours: tr.is_billable ? h : 0,
        isBillable: tr.is_billable,
        isVoided,
        voidKind,
    };
    if (tr.description != null) {
        const trAny = tr as TimeEntryRow & { task_name?: string | null; task?: string | null };
        const taskName = rowContext?.taskName?.trim()
            || String(trAny.task_name ?? trAny.task ?? '').trim();
        const d = resolveTimeEntryNotesOnly(String(tr.description), taskName);
        o.note = d;
        o.description = d;
    }
    if (tr.project_id != null)
        o.projectId = String(tr.project_id);
    if (tr.task_id != null)
        o.taskId = String(tr.task_id);
    const trRec = tr as TimeEntryRow & { recorded_at?: string | null; recordedAt?: string | null };
    const recRaw = trRec.recorded_at ?? trRec.recordedAt;
    if (recRaw != null && String(recRaw).trim())
        o.recordedAt = String(recRaw).trim();
    const trAny2 = tr as TimeEntryRow & {
        billableAmount?: unknown;
        billableRate?: unknown;
        billable_rate?: unknown;
        rateSourceAmount?: unknown;
    };
    const baRaw = tr.billable_amount ?? trAny2.billableAmount;
    if (baRaw != null && String(baRaw).trim() !== '') {
        const x = parseFloat(String(baRaw));
        if (Number.isFinite(x))
            o.amountToPay = x;
    }
    const brRaw = trAny2.billable_rate ?? trAny2.billableRate ?? tr.rate_source_amount ?? trAny2.rateSourceAmount;
    if (brRaw != null && String(brRaw).trim() !== '') {
        const x = typeof brRaw === 'number' ? brRaw : parseFloat(String(brRaw));
        if (Number.isFinite(x) && x >= 0)
            o.billableRate = x;
    }
    return o;
}

export function syncTimeEntryServerOwnersFromRows(ownerByEntryId: Map<string, number>, rows: TimeExcelPreviewRow[]): void {
    ownerByEntryId.clear();
    for (const r of rows) {
        if (r.rowKind !== 'entry')
            continue;
        const entryId = String(r.timeEntryId ?? '').trim();
        if (!entryId)
            continue;
        ownerByEntryId.set(entryId, r.authUserId);
    }
}

export function registerTimeEntryServerOwner(ownerByEntryId: Map<string, number>, entryId: string, authUserId: number): void {
    const id = entryId.trim();
    if (!id)
        return;
    ownerByEntryId.set(id, authUserId);
}

export function serverAuthUserIdForTimeEntry(ownerByEntryId: Map<string, number>, entryId: string, fallback: number): number {
    const id = entryId.trim();
    if (!id)
        return fallback;
    return ownerByEntryId.get(id) ?? fallback;
}

export async function reassignTimeExcelPreviewRowToUser(row: TimeExcelPreviewRow, targetAuthUserId: number, serverAuthUserId: number): Promise<TimeExcelPreviewRow> {
    if (targetAuthUserId === serverAuthUserId)
        throw new Error('reassignTimeExcelPreviewRowToUser: target equals server owner');
    const entryId = String(row.timeEntryId ?? '').trim();
    if (!entryId)
        throw new Error('reassignTimeExcelPreviewRowToUser: missing timeEntryId');
    const wd = workDateYmd(row.workDate);
    const rec = String(row.recordedAt ?? '').trim();
    const createBody = timeExcelPreviewRowToCreateBody(row, {
        workDate: wd,
        recordedAt: rec || null,
    });
    const created = await createTimeEntry(targetAuthUserId, createBody);
    try {
        await deleteTimeEntry(serverAuthUserId, entryId);
    }
    catch (e) {
        try {
            await deleteTimeEntry(targetAuthUserId, created.id);
        }
        catch {
        }
        throw e;
    }
    return previewRowAfterCreate({
        ...row,
        authUserId: targetAuthUserId,
        billableRate: 0,
        amountToPay: 0,
    }, created, { recordedAt: rec || null });
}

export async function persistTimeExcelPreviewRow(row: TimeExcelPreviewRow, serverAuthUserId: number): Promise<{
    row: TimeExcelPreviewRow;
    serverAuthUserId: number;
}> {
    const entryId = String(row.timeEntryId ?? '').trim();
    if (!entryId)
        throw new Error('persistTimeExcelPreviewRow: missing timeEntryId');
    if (row.authUserId !== serverAuthUserId) {
        const reassigned = await reassignTimeExcelPreviewRowToUser(row, row.authUserId, serverAuthUserId);
        const enriched = await enrichTimePreviewRowBillableRate(reassigned);
        return { row: enriched, serverAuthUserId: row.authUserId };
    }
    const updated = await patchTimeEntry(row.authUserId, entryId, timeExcelPreviewRowToPatchBody(row));
    const merged = mergeTimeEntryResponseIntoRow(updated, row);
    const savedRow = { ...row, ...merged };
    return {
        row: {
            ...savedRow,
            amountToPay: computeTimePreviewRowAmountToPay(savedRow),
        },
        serverAuthUserId: row.authUserId,
    };
}

export function previewRowAfterCreate(template: TimeExcelPreviewRow, tr: TimeEntryRow, opts?: { recordedAt?: string | null; }): TimeExcelPreviewRow {
    const merged = mergeTimeEntryResponseIntoRow(tr, template);
    const ownerChanged = tr.auth_user_id !== template.authUserId;
    const trRec = tr as TimeEntryRow & { recorded_at?: string | null; recordedAt?: string | null };
    const fromApi = trRec.recorded_at ?? trRec.recordedAt ?? merged.recordedAt;
    const recordedAt = opts?.recordedAt?.trim()
        || (typeof fromApi === 'string' && fromApi.trim() ? fromApi.trim() : '')
        || template.recordedAt
        || tr.created_at;
    const nextTaskId = String(merged.taskId ?? template.taskId ?? '').trim();
    const next: TimeExcelPreviewRow = {
        ...template,
        ...(ownerChanged ? { billableRate: 0, amountToPay: 0 } : {}),
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
    let billableRate = Number.isFinite(next.billableRate) ? next.billableRate : 0;
    const bh = Number.isFinite(next.billableHours) ? next.billableHours : 0;
    const ba = next.amountToPay != null && Number.isFinite(next.amountToPay) ? next.amountToPay : 0;
    if (billableRate <= 0 && bh > 0 && ba > 0)
        billableRate = Math.round((ba / bh) * 10000) / 10000;
    const withRate: TimeExcelPreviewRow = billableRate > 0 && billableRate !== next.billableRate
        ? { ...next, billableRate }
        : next;
    return {
        ...withRate,
        amountToPay: computeTimePreviewRowAmountToPay(withRate),
    };
}

export async function enrichTimePreviewRowBillableRate(row: TimeExcelPreviewRow, siblingRows?: TimeExcelPreviewRow[]): Promise<TimeExcelPreviewRow> {
    let rate = Number.isFinite(row.billableRate) ? row.billableRate : 0;
    if (rate <= 0 && siblingRows?.length) {
        const sibling = resolveBillableRateFromSiblingRows(siblingRows, row.authUserId, row.projectId, row.rowKey);
        if (sibling != null && sibling > 0)
            rate = sibling;
    }
    if (rate <= 0) {
        const fetched = await fetchBillableRateForPreviewRow(row.authUserId, row.projectId, row.currency);
        if (fetched != null && fetched > 0)
            rate = fetched;
    }
    if (rate <= 0 || rate === row.billableRate)
        return row;
    const next = { ...row, billableRate: rate };
    return { ...next, amountToPay: computeTimePreviewRowAmountToPay(next) };
}
