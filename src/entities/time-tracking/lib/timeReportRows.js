export function timeReportPhysicalRowKey(groupBy, row) {
    const cur = String(row.currency ?? '').trim() || '—';
    if (groupBy === 'clients') {
        const r = row;
        if (typeof r.report_group_id === 'string' && r.report_group_id.trim())
            return r.report_group_id.trim();
        return `${r.client_id}|${cur}`;
    }
    if (groupBy === 'tasks') {
        const r = row;
        return `${r.task_id}|${cur}`;
    }
    if (groupBy === 'team') {
        const r = row;
        return `${r.user_id}|${cur}`;
    }
    const r = row;
    return r.project_id;
}
export const timeReportRowKey = timeReportPhysicalRowKey;
function rowCurrencyKey(row) {
    return String(row.currency ?? '').trim().toUpperCase();
}
function rowPrimaryLabel(groupBy, row) {
    if (groupBy === 'clients')
        return String(row.client_name ?? '').trim();
    if (groupBy === 'tasks')
        return String(row.task_name ?? '').trim();
    if (groupBy === 'team')
        return String(row.user_name ?? '').trim();
    return String(row.project_name ?? '').trim();
}
export function sortTimeReportRowsForDisplay(groupBy, rows) {
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
