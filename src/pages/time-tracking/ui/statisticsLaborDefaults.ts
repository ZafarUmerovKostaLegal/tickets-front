import type { StatisticsLaborFilters } from './statisticsLaborTypes';

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function formatYmd(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function defaultStatisticsLaborFilters(): StatisticsLaborFilters {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
        partnerId: '',
        teamId: '',
        clientId: '',
        projectId: '',
        workTypeId: '',
        lawyerId: '',
        projectStatusId: '',
        dateFrom: formatYmd(monthStart),
        dateTo: formatYmd(today),
        activeProjectsOnly: false,
    };
}
