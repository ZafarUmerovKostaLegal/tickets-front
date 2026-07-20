import type { TimeEntryRow, TimeManagerClientTaskRow } from '@entities/time-tracking';
import { parseTimeEntryDescription } from '@entities/time-tracking/lib/timesheetTimerPersist';
import { detectInvoiceDescriptionTaskPrefix } from '@pages/time-tracking/lib/invoiceClientDescription';

export function buildProjectTaskNameByIdMap(tasks: TimeManagerClientTaskRow[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const task of tasks) {
        const id = task.id?.trim();
        const name = task.name?.trim();
        if (id && name)
            map.set(id, name);
    }
    return map;
}

function taskNameFromEntryRecord(entry: TimeEntryRow | null | undefined): string {
    if (!entry)
        return '';
    const r = entry as TimeEntryRow & Record<string, unknown>;
    for (const key of ['task_name', 'taskName', 'task_title', 'taskTitle', 'task']) {
        const v = r[key];
        if (typeof v === 'string' && v.trim())
            return v.trim();
    }
    return '';
}

function taskLineFromEntryDescription(raw: string | null | undefined): string {
    const { taskLine, notes } = parseTimeEntryDescription(raw);
    if (taskLine.trim() && notes.trim())
        return taskLine.trim();
    return '';
}

export type ResolveInvoiceTimeReportTaskLabelInput = {
    entry?: TimeEntryRow | null;
    invoiceLineDescription?: string | null;
    taskNameById?: Map<string, string>;
};

/**
 * Resolves the Task column for invoice time reports.
 * Prefers project task name from `task_id`, then embedded task fields / description storage.
 */
export function resolveInvoiceTimeReportTaskLabel(input: ResolveInvoiceTimeReportTaskLabelInput): string {
    const entry = input.entry ?? null;
    const taskNameById = input.taskNameById;

    const taskId = entry?.task_id?.trim();
    if (taskId && taskNameById?.has(taskId))
        return taskNameById.get(taskId)!;

    const fromRecord = taskNameFromEntryRecord(entry);
    if (fromRecord)
        return fromRecord;

    const fromEntryDescription = taskLineFromEntryDescription(entry?.description);
    if (fromEntryDescription)
        return fromEntryDescription;

    const fromRawDescription = detectInvoiceDescriptionTaskPrefix(entry?.description);
    if (fromRawDescription)
        return fromRawDescription;

    const fromInvoiceLine = detectInvoiceDescriptionTaskPrefix(input.invoiceLineDescription);
    if (fromInvoiceLine)
        return fromInvoiceLine;

    return '';
}
