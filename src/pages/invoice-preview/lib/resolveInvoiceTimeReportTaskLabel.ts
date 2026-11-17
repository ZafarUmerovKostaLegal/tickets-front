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
    storedTaskName?: string | null;
    taskId?: string | null;
};

function sameText(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function labelIsTheNote(label: string, entry: TimeEntryRow | null, invoiceLineDescription: string | null | undefined): boolean {
    const note = (entry?.description ?? invoiceLineDescription ?? '').trim();
    if (!label || !note)
        return false;
    const firstLine = note.split(/\r?\n/)[0]?.trim() ?? '';
    return sameText(label, note) || sameText(label, firstLine);
}

export function resolveInvoiceTimeReportTaskLabel(input: ResolveInvoiceTimeReportTaskLabelInput): string {
    const entry = input.entry ?? null;
    const taskNameById = input.taskNameById;

    const stored = (input.storedTaskName ?? '').trim() || taskNameFromEntryRecord(entry);
    const taskId = (entry?.task_id ?? input.taskId ?? '').trim();
    const linked = taskId && taskNameById?.has(taskId) ? taskNameById.get(taskId)! : '';
    const storedIsNote = Boolean(stored) && labelIsTheNote(stored, entry, input.invoiceLineDescription);

    if (stored && !storedIsNote)
        return stored;
    if (linked)
        return linked;
    return '';
}
