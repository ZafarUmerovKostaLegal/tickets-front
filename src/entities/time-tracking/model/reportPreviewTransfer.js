import { parseIsoDateLocal, periodToDates, REPORTS_ALL_TIME_DATE_FROM, REPORTS_MAX_RANGE_DAYS, isoDateLocal, clampReportsDateRange, } from '@entities/time-tracking/lib/reportsPeriodRange';
import { readInitialReportsRangeState } from '@entities/time-tracking/lib/reportsPrefsStorage';
import { isPeriodGranularity } from './reportsPanelConfig';
export const REPORT_PREVIEW_TRANSFER_KEY = 'tt-report-preview-v1';
export const REPORT_PREVIEW_TRANSFER_PARAM = 'ttPreviewTransfer';
const REPORT_PREVIEW_TRANSFER_LOCAL_PREFIX = 'tt-rp-xfer-';
function partnerConfirmationSnapshotFromUnknown(raw) {
    if (!raw || typeof raw !== 'object')
        return {};
    const id = String(raw.partnerConfirmationSnapshotId ?? '').trim();
    return id ? { partnerConfirmationSnapshotId: id } : {};
}
function periodStateFromUnknown(raw) {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const period = raw.period;
    if (!period || typeof period !== 'object')
        return undefined;
    const p = period;
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
function transferExtrasFromUnknown(raw) {
    const period = periodStateFromUnknown(raw);
    const returnTo = raw && typeof raw === 'object'
        ? String(raw.returnTo ?? '').trim()
        : '';
    const forReviewPreview = raw && typeof raw === 'object'
        ? raw.forReviewPreview === true
            || (returnTo.includes('reportsSection=for-review'))
        : false;
    return {
        ...partnerConfirmationSnapshotFromUnknown(raw),
        ...(period ? { period } : {}),
        ...(returnTo ? { returnTo } : {}),
        ...(forReviewPreview ? { forReviewPreview: true } : {}),
    };
}
export function inferReportPreviewPeriodState(dateFrom, dateTo) {
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
    const fromIso = dateFrom.slice(0, 10);
    const toIso = dateTo.slice(0, 10);
    // Legacy "all time" used absolute floor 2000-01-01; also accept current clamped all-preset.
    if ((fromIso === REPORTS_ALL_TIME_DATE_FROM || fromIso === allPreset.dateFrom)
        && (toIso === allPreset.dateTo || fromIso === REPORTS_ALL_TIME_DATE_FROM)) {
        const end = parseIsoDateLocal(toIso) ?? new Date();
        return {
            periodDate: end,
            periodGranularity: 'all',
            periodAnchorIso: isoDateLocal(end),
            customRangeActive: false,
        };
    }
    const from = parseIsoDateLocal(fromIso);
    const to = parseIsoDateLocal(toIso);
    if (from && to) {
        const spanDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
        if (spanDays > REPORTS_MAX_RANGE_DAYS && fromIso === REPORTS_ALL_TIME_DATE_FROM) {
            return {
                periodDate: to,
                periodGranularity: 'all',
                periodAnchorIso: isoDateLocal(to),
                customRangeActive: false,
            };
        }
    }
    const end = parseIsoDateLocal(toIso) ?? new Date();
    return {
        periodDate: end,
        periodGranularity: prefs.periodGranularity,
        periodAnchorIso: isoDateLocal(end),
        customRangeActive: true,
    };
}
export function resolveReportPreviewPeriodState(dateFrom, dateTo, period) {
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
export function normalizeReportPreviewTransfer(raw) {
    const snap = transferExtrasFromUnknown(raw);
    let normalized;
    if (raw.v === 2) {
        const r = raw;
        if (r.reportType === 'confirmed-expenses' && r.groupBy != null) {
            normalized = { v: 2, reportType: 'expenses', groupBy: r.groupBy, filters: { ...r.filters, confirmed_payment_only: true }, ...snap };
        }
        else {
            normalized = { ...raw, ...snap };
        }
    }
    else {
        normalized = {
            v: 2,
            reportType: 'time',
            groupBy: 'projects',
            filters: raw.filters,
            ...snap,
        };
    }
    const clamped = clampReportsDateRange(normalized.filters.dateFrom, normalized.filters.dateTo);
    if (clamped.dateFrom !== normalized.filters.dateFrom || clamped.dateTo !== normalized.filters.dateTo) {
        normalized = {
            ...normalized,
            filters: {
                ...normalized.filters,
                dateFrom: clamped.dateFrom,
                dateTo: clamped.dateTo,
            },
        };
    }
    return normalized;
}
export function writeReportPreviewTransfer(payload) {
    try {
        sessionStorage.setItem(REPORT_PREVIEW_TRANSFER_KEY, JSON.stringify(payload));
    }
    catch {
    }
}
function persistReportPreviewTransferToSession(payload) {
    try {
        sessionStorage.setItem(REPORT_PREVIEW_TRANSFER_KEY, JSON.stringify(payload));
    }
    catch {
    }
}
/** Store payload for a new browser tab (sessionStorage is not shared between tabs). */
export function buildReportPreviewTransferUrl(payload, previewPath) {
    const id = `${REPORT_PREVIEW_TRANSFER_LOCAL_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    try {
        localStorage.setItem(id, JSON.stringify(payload));
    }
    catch {
        writeReportPreviewTransfer(payload);
        return previewPath;
    }
    const sep = previewPath.includes('?') ? '&' : '?';
    return `${previewPath}${sep}${REPORT_PREVIEW_TRANSFER_PARAM}=${encodeURIComponent(id)}`;
}
function parseReportPreviewTransferJson(raw) {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object')
        return null;
    const rec = o;
    if (!rec.filters || typeof rec.filters !== 'object')
        return null;
    const f = rec.filters;
    const filters = coerceReportFiltersPeriod(f);
    if (!filters)
        return null;
    const snapExtras = transferExtrasFromUnknown(rec);
    if (rec.v === 2 && typeof rec.reportType === 'string') {
        const rt = rec.reportType;
        if (rt === 'time' && typeof rec.groupBy === 'string') {
            const gbRaw = rec.groupBy;
            const groupBy = gbRaw === 'clients' || gbRaw === 'projects' || gbRaw === 'tasks' || gbRaw === 'team'
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
                groupBy: rec.groupBy,
                filters,
                ...snapExtras,
            };
        }
        if (rt === 'confirmed-expenses' && typeof rec.groupBy === 'string') {
            return {
                v: 2,
                reportType: 'expenses',
                groupBy: rec.groupBy,
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
function readReportPreviewTransferFromLocalParam() {
    if (typeof window === 'undefined')
        return null;
    try {
        const params = new URLSearchParams(window.location.search);
        const transferId = params.get(REPORT_PREVIEW_TRANSFER_PARAM)?.trim() ?? '';
        if (!transferId.startsWith(REPORT_PREVIEW_TRANSFER_LOCAL_PREFIX))
            return null;
        const raw = localStorage.getItem(transferId);
        if (!raw)
            return null;
        const parsed = parseReportPreviewTransferJson(raw);
        if (parsed) {
            persistReportPreviewTransferToSession(parsed);
            localStorage.removeItem(transferId);
            const url = new URL(window.location.href);
            url.searchParams.delete(REPORT_PREVIEW_TRANSFER_PARAM);
            const next = `${url.pathname}${url.search}${url.hash}`;
            window.history.replaceState(window.history.state, '', next);
        }
        return parsed;
    }
    catch {
        return null;
    }
}
function coerceReportFiltersPeriod(f) {
    const dateFrom = (typeof f.dateFrom === 'string' && f.dateFrom.trim()) ||
        (typeof f.from === 'string' && f.from.trim()) ||
        '';
    const dateTo = (typeof f.dateTo === 'string' && f.dateTo.trim()) ||
        (typeof f.to === 'string' && f.to.trim()) ||
        '';
    if (!dateFrom || !dateTo)
        return null;
    const rest = { ...f };
    delete rest.from;
    delete rest.to;
    return { ...rest, dateFrom, dateTo };
}
export function readReportPreviewTransfer() {
    const fromLocalParam = readReportPreviewTransferFromLocalParam();
    if (fromLocalParam)
        return fromLocalParam;
    try {
        const raw = sessionStorage.getItem(REPORT_PREVIEW_TRANSFER_KEY);
        if (!raw)
            return null;
        return parseReportPreviewTransferJson(raw);
    }
    catch {
        return null;
    }
}
export function clearReportPreviewTransfer() {
    try {
        sessionStorage.removeItem(REPORT_PREVIEW_TRANSFER_KEY);
    }
    catch {
    }
}
