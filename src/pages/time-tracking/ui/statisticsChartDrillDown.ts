import type { LaborStatisticsMeta } from '@entities/time-tracking';
import type { StatisticsLaborFilters } from './statisticsLaborTypes';
import { patchStatisticsFilters } from './statisticsFilterScope';
import type { StackedBarRow } from './statisticsChartTypes';

export type StatisticsChartDrillKind = 'lawyer' | 'project' | 'client' | 'projectStatus' | 'team';

function norm(s: string): string {
    return s.trim().toLowerCase();
}

function pickByName(
    options: { id: string; name: string }[] | undefined,
    row: StackedBarRow,
): string | null {
    if (row.id)
        return row.id;
    if (!options?.length)
        return null;
    const exact = options.find((o) => o.name === row.name);
    if (exact)
        return exact.id;
    const n = norm(row.name);
    const ci = options.find((o) => norm(o.name) === n);
    return ci?.id ?? null;
}

export function applyStatisticsChartDrillDown(
    kind: StatisticsChartDrillKind,
    row: StackedBarRow,
    filters: StatisticsLaborFilters,
    meta: LaborStatisticsMeta | null,
): StatisticsLaborFilters | null {
    if (kind === 'lawyer') {
        const lawyerId = pickByName(meta?.lawyers, row);
        return lawyerId ? patchStatisticsFilters(filters, meta, { lawyerId }) : null;
    }
    if (kind === 'project') {
        const projectId = pickByName(meta?.projects, row);
        return projectId ? patchStatisticsFilters(filters, meta, { projectId }) : null;
    }
    if (kind === 'client') {
        const clientId = pickByName(meta?.clients, row);
        return clientId ? patchStatisticsFilters(filters, meta, { clientId }) : null;
    }
    if (kind === 'team') {
        const teamId = pickByName(meta?.teams, row);
        return teamId ? patchStatisticsFilters(filters, meta, { teamId }) : null;
    }
    const projectStatusId = pickByName(meta?.project_statuses, row);
    return projectStatusId ? patchStatisticsFilters(filters, meta, { projectStatusId }) : null;
}
