import type { LaborStatisticsMeta } from '@entities/time-tracking';
import type { StatisticsLaborFilters } from './statisticsLaborTypes';

export function scopedStatisticsProjects(meta: LaborStatisticsMeta | null, filters: StatisticsLaborFilters) {
    const all = meta?.projects ?? [];
    if (!filters.clientId)
        return all;
    return all.filter((p) => p.client_id === filters.clientId);
}

export function clientIdForProject(meta: LaborStatisticsMeta | null, projectId: string): string {
    if (!projectId)
        return '';
    const project = meta?.projects?.find((p) => p.id === projectId);
    return project?.client_id ?? '';
}

export function patchStatisticsFilters(
    filters: StatisticsLaborFilters,
    meta: LaborStatisticsMeta | null,
    partial: Partial<StatisticsLaborFilters>,
): StatisticsLaborFilters {
    const next = { ...filters, ...partial };

    if (partial.projectId !== undefined && partial.projectId) {
        const clientId = clientIdForProject(meta, partial.projectId);
        if (clientId)
            next.clientId = clientId;
    }

    if (partial.clientId !== undefined) {
        const projects = scopedStatisticsProjects(meta, { ...next, clientId: partial.clientId });
        if (next.projectId && !projects.some((p) => p.id === next.projectId))
            next.projectId = '';
    }

    return next;
}

export type ActiveStatisticsFilterChip = {
    key: keyof StatisticsLaborFilters;
    label: string;
    value: string;
};

export function activeStatisticsFilterChips(
    filters: StatisticsLaborFilters,
    meta: LaborStatisticsMeta | null,
    labels: {
        partner: string;
        team: string;
        client: string;
        project: string;
        workType: string;
        lawyer: string;
        status: string;
        activeOnly: string;
    },
): ActiveStatisticsFilterChip[] {
    const chips: ActiveStatisticsFilterChip[] = [];
    const pick = (list: { id: string; name: string }[] | undefined, id: string) =>
        list?.find((item) => item.id === id)?.name ?? id;

    if (filters.partnerId)
        chips.push({ key: 'partnerId', label: labels.partner, value: pick(meta?.partners, filters.partnerId) });
    if (filters.teamId)
        chips.push({ key: 'teamId', label: labels.team, value: pick(meta?.teams, filters.teamId) });
    if (filters.clientId)
        chips.push({ key: 'clientId', label: labels.client, value: pick(meta?.clients, filters.clientId) });
    if (filters.projectId)
        chips.push({ key: 'projectId', label: labels.project, value: pick(meta?.projects, filters.projectId) });
    if (filters.workTypeId)
        chips.push({ key: 'workTypeId', label: labels.workType, value: pick(meta?.work_types, filters.workTypeId) });
    if (filters.lawyerId)
        chips.push({ key: 'lawyerId', label: labels.lawyer, value: pick(meta?.lawyers, filters.lawyerId) });
    if (filters.projectStatusId)
        chips.push({ key: 'projectStatusId', label: labels.status, value: pick(meta?.project_statuses, filters.projectStatusId) });
    if (filters.activeProjectsOnly)
        chips.push({ key: 'activeProjectsOnly', label: labels.activeOnly, value: '✓' });

    return chips;
}
