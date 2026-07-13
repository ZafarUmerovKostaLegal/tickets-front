import type { TimeReportRow, TimeRowClients, TimeRowProjects, TimeRowTasks, TimeRowTeam } from '@entities/time-tracking';
import type { TimeGroup } from '@entities/time-tracking/model/reportsPanelConfig';

export function timeReportPhysicalRowKey(groupBy: TimeGroup, row: TimeReportRow): string {
    const cur = String(row.currency ?? '').trim() || '—';
    if (groupBy === 'clients') {
        const r = row as TimeRowClients;
        if (typeof r.report_group_id === 'string' && r.report_group_id.trim())
            return r.report_group_id.trim();
        return `${r.client_id}|${cur}`;
    }
    if (groupBy === 'tasks') {
        const r = row as TimeRowTasks;
        return `${r.task_id}|${cur}`;
    }
    if (groupBy === 'team') {
        const r = row as TimeRowTeam;
        return `${r.user_id}|${cur}`;
    }
    const r = row as TimeRowProjects;
    return r.project_id;
}

export const timeReportRowKey = timeReportPhysicalRowKey;

function rowCurrencyKey(row: { currency?: string }): string {
    return String(row.currency ?? '').trim().toUpperCase();
}

function rowPrimaryLabel(groupBy: TimeGroup, row: TimeReportRow): string {
    if (groupBy === 'clients')
        return String((row as TimeRowClients).client_name ?? '').trim();
    if (groupBy === 'tasks')
        return String((row as TimeRowTasks).task_name ?? '').trim();
    if (groupBy === 'team')
        return String((row as TimeRowTeam).user_name ?? '').trim();
    return String((row as TimeRowProjects).project_name ?? '').trim();
}

export function sortTimeReportRowsForDisplay(groupBy: TimeGroup, rows: TimeReportRow[]): TimeReportRow[] {
    if (groupBy === 'projects')
        return rows;
    const copy = rows.slice();
    copy.sort((a, b) => {
        const ca = rowCurrencyKey(a);
        const cb = rowCurrencyKey(b);
        if (ca !== cb)
            return ca.localeCompare(cb, 'en');
        const la = rowPrimaryLabel(groupBy, a);
        const lb = rowPrimaryLabel(groupBy, b);
        return la.localeCompare(lb, 'ru', { sensitivity: 'base' });
    });
    return copy;
}
