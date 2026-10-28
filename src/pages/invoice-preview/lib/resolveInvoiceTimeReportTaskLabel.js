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
function sameText(a, b) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}
/** True when a stored label is actually the time-entry note, not the project task. */
function labelIsTheNote(label, entry, invoiceLineDescription) {
    const note = (entry?.description ?? invoiceLineDescription ?? '').trim();
    if (!label || !note)
        return false;
    const firstLine = note.split(/\r?\n/)[0]?.trim() ?? '';
    return sameText(label, note) || sameText(label, firstLine);
}
/**
 * Task column is the linked task name (the same value as in the time report).
 * The note is never used as the task, even when it looks like one.
 */
export function resolveInvoiceTimeReportTaskLabel(input) {
    const entry = input.entry ?? null;
    const taskNameById = input.taskNameById;
    const stored = (input.storedTaskName ?? '').trim() || taskNameFromEntryRecord(entry);
    const taskId = (entry?.task_id ?? input.taskId ?? '').trim();
    const linked = taskId && taskNameById?.has(taskId) ? taskNameById.get(taskId) : '';
    const storedIsNote = Boolean(stored) && labelIsTheNote(stored, entry, input.invoiceLineDescription);
    if (stored && !storedIsNote)
        return stored;
    if (linked)
        return linked;
    return '';
}
