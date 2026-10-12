import type { TimeEntryRow, TimeManagerClientTaskRow } from '@entities/time-tracking';

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

export type ResolveInvoiceTimeReportTaskLabelInput = {
    entry?: TimeEntryRow | null;
    invoiceLineDescription?: string | null;
    taskNameById?: Map<string, string>;
    /** Task name loaded with the time entry (DB), not parsed from the note. */
    storedTaskName?: string | null;
};

/**
 * Task column is the linked task name (the same value as in the time report).
 * The note is never used as the task, even when it looks like one.
 */
export function resolveInvoiceTimeReportTaskLabel(input: ResolveInvoiceTimeReportTaskLabelInput): string {
    const entry = input.entry ?? null;
    const taskNameById = input.taskNameById;

    const stored = (input.storedTaskName ?? '').trim() || taskNameFromEntryRecord(entry);
    if (stored)
        return stored;

    const taskId = (entry?.task_id ?? '').trim();
    if (taskId && taskNameById?.has(taskId))
        return taskNameById.get(taskId)!;

    return '';
}
