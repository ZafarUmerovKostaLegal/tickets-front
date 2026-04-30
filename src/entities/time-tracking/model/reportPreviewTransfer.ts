import type { ReportFiltersV2 } from '@entities/time-tracking';
export const REPORT_PREVIEW_TRANSFER_KEY = 'tt-report-preview-v1';
export type ReportPreviewReportType = 'time' | 'expenses' | 'confirmed-expenses' | 'uninvoiced' | 'project-budget';
export type ReportPreviewTimeGroup = 'clients' | 'projects';
export type ReportPreviewExpenseGroup = 'clients' | 'projects' | 'categories' | 'team';
export type ReportPreviewTransferV2 = {
    v: 2;
    reportType: 'time';
    groupBy: ReportPreviewTimeGroup;
    filters: ReportFiltersV2;
} | {
    v: 2;
    reportType: 'expenses';
    groupBy: ReportPreviewExpenseGroup;
    filters: ReportFiltersV2;
} | {
    v: 2;
    reportType: 'confirmed-expenses';
    groupBy: ReportPreviewExpenseGroup;
    filters: ReportFiltersV2;
} | {
    v: 2;
    reportType: 'uninvoiced';
    filters: ReportFiltersV2;
} | {
    v: 2;
    reportType: 'project-budget';
    filters: ReportFiltersV2;
};
export type ReportPreviewTransferV1 = {
    v: 1;
    filters: ReportFiltersV2;
};
export type ReportPreviewTransferPayload = ReportPreviewTransferV2 | ReportPreviewTransferV1;
export function normalizeReportPreviewTransfer(raw: ReportPreviewTransferPayload): ReportPreviewTransferV2 {
    if (raw.v === 2)
        return raw;
    return {
        v: 2,
        reportType: 'time',
        groupBy: 'projects',
        filters: raw.filters,
    };
}
export function writeReportPreviewTransfer(payload: ReportPreviewTransferV2): void {
    try {
        sessionStorage.setItem(REPORT_PREVIEW_TRANSFER_KEY, JSON.stringify(payload));
    }
    catch {
    }
}
function coerceReportFiltersPeriod(f: Record<string, unknown>): ReportFiltersV2 | null {
    const dateFrom = (typeof f.dateFrom === 'string' && f.dateFrom.trim()) ||
        (typeof f.from === 'string' && f.from.trim()) ||
        '';
    const dateTo = (typeof f.dateTo === 'string' && f.dateTo.trim()) ||
        (typeof f.to === 'string' && f.to.trim()) ||
        '';
    if (!dateFrom || !dateTo)
        return null;
    const rest = { ...(f as unknown as Record<string, unknown>) };
    delete rest.from;
    delete rest.to;
    return { ...(rest as unknown as ReportFiltersV2), dateFrom, dateTo };
}
export function readReportPreviewTransfer(): ReportPreviewTransferPayload | null {
    try {
        const raw = sessionStorage.getItem(REPORT_PREVIEW_TRANSFER_KEY);
        if (!raw)
            return null;
        const o = JSON.parse(raw) as unknown;
        if (!o || typeof o !== 'object')
            return null;
        const rec = o as Record<string, unknown>;
        if (!rec.filters || typeof rec.filters !== 'object')
            return null;
        const f = rec.filters as Record<string, unknown>;
        const filters = coerceReportFiltersPeriod(f);
        if (!filters)
            return null;
        if (rec.v === 2 && typeof rec.reportType === 'string') {
            const rt = rec.reportType as ReportPreviewReportType;
            if (rt === 'time' && typeof rec.groupBy === 'string') {
                const gbRaw = rec.groupBy as string;
                const groupBy: ReportPreviewTimeGroup = gbRaw === 'clients' || gbRaw === 'projects'
                    ? gbRaw
                    : 'projects';
                return {
                    v: 2,
                    reportType: 'time',
                    groupBy,
                    filters,
                };
            }
            if (rt === 'expenses' && typeof rec.groupBy === 'string') {
                return {
                    v: 2,
                    reportType: 'expenses',
                    groupBy: rec.groupBy as ReportPreviewExpenseGroup,
                    filters,
                };
            }
            if (rt === 'confirmed-expenses' && typeof rec.groupBy === 'string') {
                return {
                    v: 2,
                    reportType: 'confirmed-expenses',
                    groupBy: rec.groupBy as ReportPreviewExpenseGroup,
                    filters,
                };
            }
            if (rt === 'uninvoiced') {
                return { v: 2, reportType: 'uninvoiced', filters };
            }
            if (rt === 'project-budget') {
                return { v: 2, reportType: 'project-budget', filters };
            }
        }
        if (rec.v === 1) {
            return { v: 1, filters };
        }
        return null;
    }
    catch {
        return null;
    }
}
export function clearReportPreviewTransfer(): void {
    try {
        sessionStorage.removeItem(REPORT_PREVIEW_TRANSFER_KEY);
    }
    catch {
    }
}
