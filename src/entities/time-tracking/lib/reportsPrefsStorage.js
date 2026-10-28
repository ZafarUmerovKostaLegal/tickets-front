import { REPORTS_PREFS_STORAGE_KEY, isPeriodGranularity, } from '@entities/time-tracking/model/reportsPanelConfig';
import { parseIsoDateLocal, periodToDates, clampReportsDateRange } from './reportsPeriodRange';
export function readReportsPrefsFromStorage() {
    if (typeof window === 'undefined')
        return null;
    try {
        const raw = window.localStorage.getItem(REPORTS_PREFS_STORAGE_KEY);
        if (!raw)
            return null;
        const o = JSON.parse(raw);
        if (o?.v !== 1)
            return null;
        return o;
    }
    catch {
        return null;
    }
}
export function writeReportsPrefsToStorage(p) {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(REPORTS_PREFS_STORAGE_KEY, JSON.stringify(p));
    }
    catch {
    }
}
export function readInitialReportsRangeState() {
    const saved = readReportsPrefsFromStorage();
    const iso = saved?.periodAnchorIso;
    const pd = iso ? parseIsoDateLocal(iso) : null;
    const periodDate = pd ?? new Date();
    const periodGranularity = saved && isPeriodGranularity(saved.periodGranularity) ? saved.periodGranularity : 'month';
    const preset = periodToDates(periodDate, periodGranularity);
    const cr = Boolean(saved?.customRange &&
        typeof saved.rangeDateFrom === 'string' &&
        typeof saved.rangeDateTo === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(saved.rangeDateFrom) &&
        /^\d{4}-\d{2}-\d{2}$/.test(saved.rangeDateTo));
    if (cr && saved?.rangeDateFrom && saved?.rangeDateTo) {
        const clamped = clampReportsDateRange(saved.rangeDateFrom, saved.rangeDateTo);
        return {
            periodDate,
            periodGranularity,
            dateFrom: clamped.dateFrom,
            dateTo: clamped.dateTo,
            customRangeActive: true,
        };
    }
    return {
        periodDate,
        periodGranularity,
        dateFrom: preset.dateFrom,
        dateTo: preset.dateTo,
        customRangeActive: false,
    };
}
