
export function isProjectClosedForTimeEntry(
    project: {
        isArchived?: boolean;
        is_archived?: boolean;
        isPaused?: boolean;
        is_paused?: boolean;
        endDate?: string | null;
        end_date?: string | null;
        status?: string;
    },
    asOfYmd: string,
): boolean {
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

export function todayYmdUtc(): string {
    return new Date().toISOString().slice(0, 10);
}

export function isActiveTimeManagerClientRow(c: {
    is_archived?: boolean;
    isArchived?: boolean;
}): boolean {
    return !(c.is_archived === true || c.isArchived === true);
}

export function isActiveTimeManagerProjectRow(
    p: {
        isArchived?: boolean;
        is_archived?: boolean;
        isPaused?: boolean;
        is_paused?: boolean;
        endDate?: string | null;
        end_date?: string | null;
        status?: string;
    },
    asOfYmd: string = todayYmdUtc(),
): boolean {
    const status = String(p.status ?? '').trim().toLowerCase();
    if (status === 'archived' || status === 'paused')
        return false;
    return !isProjectClosedForTimeEntry(p, asOfYmd);
}

export function collectClientIdsFromProjects(
    projects: ReadonlyArray<{ client_id?: string; clientId?: string }>,
): Set<string> {
    const ids = new Set<string>();
    for (const p of projects) {
        const cid = String(p.client_id ?? p.clientId ?? '').trim();
        if (cid)
            ids.add(cid);
    }
    return ids;
}
