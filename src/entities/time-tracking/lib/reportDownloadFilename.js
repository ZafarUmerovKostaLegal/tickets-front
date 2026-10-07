export function sanitizeReportDownloadPart(value) {
    return value.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ');
}
export function buildReportDownloadFilename(input) {
    const client = sanitizeReportDownloadPart(input.clientName ?? '');
    const project = sanitizeReportDownloadPart(input.projectName ?? '');
    const df = String(input.dateFrom ?? '').trim().slice(0, 10);
    const dt = String(input.dateTo ?? '').trim().slice(0, 10);
    const period = df && dt ? `${df}-${dt}` : '';
    const parts = [client, project, period].filter((part) => part.length > 0);
    const ext = String(input.extension ?? 'xlsx').replace(/^\./, '').toLowerCase() || 'xlsx';
    const base = parts.join(' - ').slice(0, 180) || 'Report';
    return `${base}.${ext}`;
}
export function reportExportProjectFallback(reportType, groupBy) {
    const typeLabels = {
        time: 'Время',
        expenses: 'Расходы',
        uninvoiced: 'Не выставлено',
        'project-budget': 'Бюджет',
    };
    const base = typeLabels[reportType];
    return groupBy ? `${base} (${groupBy})` : base;
}
export function resolveReportDownloadLabelsFromExcelRows(rows, fallback) {
    for (const row of rows) {
        const clientName = String(row.clientName ?? '').trim();
        const projectName = String(row.projectName ?? '').trim();
        if (clientName && projectName)
            return { clientName, projectName };
    }
    for (const row of rows) {
        const clientName = String(row.clientName ?? '').trim();
        const projectName = String(row.projectName ?? '').trim();
        if (clientName || projectName) {
            return {
                clientName: clientName || String(fallback?.clientName ?? '').trim(),
                projectName: projectName || String(fallback?.projectName ?? '').trim(),
            };
        }
    }
    return {
        clientName: String(fallback?.clientName ?? '').trim(),
        projectName: String(fallback?.projectName ?? '').trim(),
    };
}
