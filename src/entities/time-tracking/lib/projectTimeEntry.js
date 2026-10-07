export function isProjectClosedForTimeEntry(project, asOfYmd) {
    const status = String(project.status ?? '').trim().toLowerCase();
    if (status === 'archived' || status === 'paused')
        return true;
    const archived = project.isArchived === true || project.is_archived === true;
    if (archived)
        return true;
    const paused = project.isPaused === true || project.is_paused === true;
    if (paused)
        return true;
    const end = (project.endDate ?? project.end_date ?? '').trim().slice(0, 10);
    return Boolean(end && end < asOfYmd);
}
export function todayYmdUtc() {
    return new Date().toISOString().slice(0, 10);
}
export function isActiveTimeManagerClientRow(c) {
    return !(c.is_archived === true || c.isArchived === true);
}
export function isActiveTimeManagerProjectRow(p, asOfYmd = todayYmdUtc()) {
    const status = String(p.status ?? '').trim().toLowerCase();
    if (status === 'archived' || status === 'paused')
        return false;
    return !isProjectClosedForTimeEntry(p, asOfYmd);
}
export function collectClientIdsFromProjects(projects) {
    const ids = new Set();
    for (const p of projects) {
        const cid = String(p.client_id ?? p.clientId ?? '').trim();
        if (cid)
            ids.add(cid);
    }
    return ids;
}
