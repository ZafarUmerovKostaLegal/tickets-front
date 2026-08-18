const INTERNAL_TASK_RE = /kosta\s+legal\s+internal|внутренние\s+дела\s+kosta\s+legal/i;

export function isKostaLegalInternalTask(taskName: string, taskId = ''): boolean {
    const name = String(taskName ?? '').trim();
    const id = String(taskId ?? '').trim();
    if (INTERNAL_TASK_RE.test(name))
        return true;
    if (INTERNAL_TASK_RE.test(id.replace(/^task:/i, '')))
        return true;
    return false;
}
