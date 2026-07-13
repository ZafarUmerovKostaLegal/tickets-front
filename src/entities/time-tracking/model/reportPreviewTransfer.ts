import type { ReportFiltersV2 } from '@entities/time-tracking';
import { parseIsoDateLocal, periodToDates, REPORTS_ALL_TIME_DATE_FROM, isoDateLocal } from '@entities/time-tracking/lib/reportsPeriodRange';
import { readInitialReportsRangeState } from '@entities/time-tracking/lib/reportsPrefsStorage';
import { isPeriodGranularity, type PeriodGranularity } from './reportsPanelConfig';
export const REPORT_PREVIEW_TRANSFER_KEY = 'tt-report-preview-v1';
export type ReportPreviewReportType = 'time' | 'expenses' | 'uninvoiced' | 'project-budget';
export type ReportPreviewTimeGroup = 'clients' | 'projects' | 'tasks' | 'team';
export type ReportPreviewExpenseGroup = 'clients' | 'projects' | 'categories' | 'team';

export type ReportPreviewPeriodState = {
    periodGranularity: PeriodGranularity;
    periodAnchorIso: string;
    customRangeActive: boolean;
};

export type ReportPreviewTransferExtras = {
    partnerConfirmationSnapshotId?: string;
    period?: ReportPreviewPeriodState;
    /** Where to navigate after partner sign / leaving preview (path + search). */
    returnTo?: string;
    /** Preview opened from «Сформированные для проверки» — period/dates are fixed. */
    forReviewPreview?: boolean;
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
function partnerConfirmationSnapshotFromUnknown(raw: unknown): Pick<ReportPreviewTransferExtras, 'partnerConfirmationSnapshotId'> {
    if (!raw || typeof raw !== 'object')
        return {};
    const id = String((raw as Record<string, unknown>).partnerConfirmationSnapshotId ?? '').trim();
    return id ? { partnerConfirmationSnapshotId: id } : {};
}

function periodStateFromUnknown(raw: unknown): ReportPreviewPeriodState | undefined {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const period = (raw as Record<string, unknown>).period;
    if (!period || typeof period !== 'object')
        return undefined;
    const p = period as Record<string, unknown>;
    const periodGranularity = p.periodGranularity;
    const periodAnchorIso = typeof p.periodAnchorIso === 'string' ? p.periodAnchorIso.trim() : '';
    if (!isPeriodGranularity(periodGranularity) || !/^\d{4}-\d{2}-\d{2}$/.test(periodAnchorIso))
        return undefined;
    return {
        periodGranularity,
        periodAnchorIso,
        customRangeActive: p.customRangeActive === true,
    };
}

function transferExtrasFromUnknown(raw: unknown): ReportPreviewTransferExtras {
    const period = periodStateFromUnknown(raw);
    const returnTo = raw && typeof raw === 'object'
        ? String((raw as Record<string, unknown>).returnTo ?? '').trim()
        : '';
    const forReviewPreview = raw && typeof raw === 'object'
        ? (raw as Record<string, unknown>).forReviewPreview === true
            || (returnTo.includes('reportsSection=for-review'))
        : false;
    return {
        ...partnerConfirmationSnapshotFromUnknown(raw),
        ...(period ? { period } : {}),
        ...(returnTo ? { returnTo } : {}),
        ...(forReviewPreview ? { forReviewPreview: true } : {}),
    };
}

export function inferReportPreviewPeriodState(dateFrom: string, dateTo: string): ReportPreviewPeriodState & {
    periodDate: Date;
} {
    const prefs = readInitialReportsRangeState();
    if (dateFrom === prefs.dateFrom && dateTo === prefs.dateTo) {
        return {
            periodDate: prefs.periodDate,
            periodGranularity: prefs.periodGranularity,
            periodAnchorIso: isoDateLocal(prefs.periodDate),
            customRangeActive: prefs.customRangeActive,
        };
    }
    const allPreset = periodToDates(new Date(), 'all');
    if (dateFrom === REPORTS_ALL_TIME_DATE_FROM && dateTo === allPreset.dateTo) {
        const today = new Date();
        return {
            periodDate: today,
            periodGranularity: 'all',
            periodAnchorIso: isoDateLocal(today),
            customRangeActive: false,
        };
    }
    const end = parseIsoDateLocal(dateTo) ?? new Date();
    return {
        periodDate: end,
        periodGranularity: prefs.periodGranularity,
        periodAnchorIso: isoDateLocal(end),
        customRangeActive: true,
    };
}

export function resolveReportPreviewPeriodState(dateFrom: string, dateTo: string, period?: ReportPreviewPeriodState | null): {
    periodDate: Date;
    periodGranularity: PeriodGranularity;
    customRangeActive: boolean;
} {
    if (period) {
        const periodDate = parseIsoDateLocal(period.periodAnchorIso) ?? parseIsoDateLocal(dateTo) ?? new Date();
        return {
            periodDate,
            periodGranularity: period.periodGranularity,
            customRangeActive: period.customRangeActive,
        };
    }
    const inferred = inferReportPreviewPeriodState(dateFrom, dateTo);
    return {
        periodDate: inferred.periodDate,
        periodGranularity: inferred.periodGranularity,
        customRangeActive: inferred.customRangeActive,
    };
}

export function normalizeReportPreviewTransfer(raw: ReportPreviewTransferPayload): ReportPreviewTransferV2 {
    const snap = transferExtrasFromUnknown(raw);
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
        const snapExtras = transferExtrasFromUnknown(rec);
        if (rec.v === 2 && typeof rec.reportType === 'string') {
            const rt = rec.reportType;
            if (rt === 'time' && typeof rec.groupBy === 'string') {
                const gbRaw = rec.groupBy as string;
                const groupBy: ReportPreviewTimeGroup = gbRaw === 'clients' || gbRaw === 'projects' || gbRaw === 'tasks' || gbRaw === 'team'
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
