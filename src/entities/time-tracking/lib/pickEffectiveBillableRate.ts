

import type { HourlyRateRow } from '../api';

function d0(s: string | null | undefined): string | null {
    return s && String(s).trim() ? String(s).slice(0, 10) : null;
}

export function hourlyRateEffectiveOnDate(r: HourlyRateRow, when: Date = new Date()): boolean {
    const today = when.toISOString().slice(0, 10);
    const from = d0(r.valid_from);
    const to = d0(r.valid_to);
    if (from && today < from)
        return false;
    if (to && today > to)
        return false;
    return true;
}

function rateProjectId(r: HourlyRateRow): string | null {
    const pid = r.project_id ?? r.projectId ?? null;
    if (pid == null || String(pid).trim() === '')
        return null;
    return String(pid).trim();
}

function sortPreferLatestValidFrom(a: HourlyRateRow, b: HourlyRateRow): number {
    const af = a.valid_from ? String(a.valid_from) : '';
    const bf = b.valid_from ? String(b.valid_from) : '';
    if (af !== bf)
        return bf.localeCompare(af);
    return String(b.id).localeCompare(String(a.id));
}

function pickFromPool(pool: HourlyRateRow[], projectCurrency: string, when: Date): HourlyRateRow | null {
    if (pool.length === 0)
        return null;
    let active = pool.filter((r) => hourlyRateEffectiveOnDate(r, when));
    if (active.length === 0)
        active = pool.slice();
    const cur = (projectCurrency || 'USD').trim().toUpperCase();
    const curMatch = active.filter((r) => (r.currency || '').trim().toUpperCase() === cur);
    const candidates = (curMatch.length > 0 ? curMatch : active).slice();
    candidates.sort(sortPreferLatestValidFrom);
    return candidates[0] ?? null;
}

export type EffectiveBillableRatePick = {
    row: HourlyRateRow;
    source: 'project' | 'global';
};


export function pickEffectiveBillableRateForProject(
    rows: HourlyRateRow[],
    projectId: string,
    projectCurrency: string,
    when: Date = new Date(),
): EffectiveBillableRatePick | null {
    const pid = (projectId || '').trim();
    if (pid) {
        const projectRows = rows.filter((r) => rateProjectId(r) === pid);
        const projectPick = pickFromPool(projectRows, projectCurrency, when);
        if (projectPick)
            return { row: projectPick, source: 'project' };
    }
    const globalRows = rows.filter((r) => rateProjectId(r) == null);
    const globalPick = pickFromPool(globalRows, projectCurrency, when);
    if (globalPick)
        return { row: globalPick, source: 'global' };
    return null;
}

export function parseHourlyRateAmount(row: HourlyRateRow): number {
    const amt = typeof row.amount === 'number' ? row.amount : parseFloat(String(row.amount));
    return Number.isFinite(amt) ? amt : NaN;
}
