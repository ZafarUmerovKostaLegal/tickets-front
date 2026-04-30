import type { ReportFiltersV2 } from '@entities/time-tracking';
export const REPORT_PREVIEW_TRANSFER_KEY = 'tt-report-preview-v1';
export type ReportPreviewReportType = 'time' | 'expenses' | 'uninvoiced' | 'project-budget';
export type ReportPreviewTimeGroup = 'clients' | 'projects';
export type ReportPreviewExpenseGroup = 'clients' | 'projects' | 'categories' | 'team';
/** UUID снимка отчёта, связанного с записью партнёрского подтверждения (для подсказок UI). */
export type ReportPreviewTransferExtras = {
    partnerConfirmationSnapshotId?: string;
};
export type ReportPreviewTransferV2 = ({
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
    reportType: 'uninvoiced';
    filters: ReportFiltersV2;
} | {
    v: 2;
    reportType: 'project-budget';
    filters: ReportFiltersV2;
}) & ReportPreviewTransferExtras;
export type ReportPreviewTransferV1 = {
    v: 1;
    filters: ReportFiltersV2;
} & ReportPreviewTransferExtras;
export type ReportPreviewTransferPayload = ReportPreviewTransferV2 | ReportPreviewTransferV1;
function partnerConfirmationSnapshotFromUnknown(raw: unknown): ReportPreviewTransferExtras {
    if (!raw || typeof raw !== 'object')
        return {};
    const id = String((raw as Record<string, unknown>).partnerConfirmationSnapshotId ?? '').trim();
    return id ? { partnerConfirmationSnapshotId: id } : {};
}
export function normalizeReportPreviewTransfer(raw: ReportPreviewTransferPayload): ReportPreviewTransferV2 {
    const snap = partnerConfirmationSnapshotFromUnknown(raw);
    if (raw.v === 2) {
        const r = raw as ReportPreviewTransferV2 | {
            v: 2;
            reportType: string;
            groupBy?: ReportPreviewExpenseGroup;
            filters: ReportFiltersV2;
        };
        if (r.reportType === 'confirmed-expenses' && r.groupBy != null)
            return { v: 2, reportType: 'expenses', groupBy: r.groupBy, filters: { ...r.filters, confirmed_payment_only: true }, ...snap };
        return { ...(raw as ReportPreviewTransferV2), ...snap };
    }
    return {
        v: 2,
        reportType: 'time',
        groupBy: 'projects',
        filters: raw.filters,
        ...snap,
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
        const snapExtras = partnerConfirmationSnapshotFromUnknown(rec);
        if (rec.v === 2 && typeof rec.reportType === 'string') {
            const rt = rec.reportType;
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
                    ...snapExtras,
                };
            }
            if (rt === 'expenses' && typeof rec.groupBy === 'string') {
                return {
                    v: 2,
                    reportType: 'expenses',
                    groupBy: rec.groupBy as ReportPreviewExpenseGroup,
                    filters,
                    ...snapExtras,
                };
            }
            if (rt === 'confirmed-expenses' && typeof rec.groupBy === 'string') {
                return {
                    v: 2,
                    reportType: 'expenses',
                    groupBy: rec.groupBy as ReportPreviewExpenseGroup,
                    filters: { ...filters, confirmed_payment_only: true },
                    ...snapExtras,
                };
            }
            if (rt === 'uninvoiced') {
                return { v: 2, reportType: 'uninvoiced', filters, ...snapExtras };
            }
            if (rt === 'project-budget') {
                return { v: 2, reportType: 'project-budget', filters, ...snapExtras };
            }
        }
        if (rec.v === 1) {
            return { v: 1, filters, ...snapExtras };
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
