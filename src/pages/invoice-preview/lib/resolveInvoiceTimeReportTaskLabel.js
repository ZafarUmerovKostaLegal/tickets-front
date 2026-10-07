import { parseTimeEntryDescription } from '@entities/time-tracking/lib/timesheetTimerPersist';
import { detectInvoiceDescriptionTaskPrefix } from '@pages/time-tracking/lib/invoiceClientDescription';
export function buildProjectTaskNameByIdMap(tasks) {
    const map = new Map();
    for (const task of tasks) {
        const id = task.id?.trim();
        const name = task.name?.trim();
        if (id && name)
            map.set(id, name);
    }
    return map;
}
function taskNameFromEntryRecord(entry) {
    if (!entry)
        return '';
    const r = entry;
    for (const key of ['task_name', 'taskName', 'task_title', 'taskTitle', 'task']) {
        const v = r[key];
        if (typeof v === 'string' && v.trim())
            return v.trim();
    }
    return '';
}
function taskLineFromEntryDescription(raw) {
    const { taskLine, notes } = parseTimeEntryDescription(raw);
    if (taskLine.trim() && notes.trim())
        return taskLine.trim();
    return '';
}
/**
 * Resolves the Task column for invoice time reports.
 * Prefers project task name from `task_id`, then embedded task fields / description storage.
 */
export function resolveInvoiceTimeReportTaskLabel(input) {
    const entry = input.entry ?? null;
    const taskNameById = input.taskNameById;
    const taskId = entry?.task_id?.trim();
    if (taskId && taskNameById?.has(taskId))
        return taskNameById.get(taskId);
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
