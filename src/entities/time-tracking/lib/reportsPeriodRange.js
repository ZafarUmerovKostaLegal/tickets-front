/** Absolute floor for "all time" (never earlier than this calendar day). */
export const REPORTS_ALL_TIME_DATE_FROM = '2000-01-01';
/** Must match backend reports period guard in time_tracking presentation/routes/reports.py */
export const REPORTS_MAX_RANGE_DAYS = 3650;
export function reportsAllTimeDateTo(reference = new Date()) {
    return isoDateLocal(reference);
}
/** Earliest dateFrom for "За всё время" that stays within REPORTS_MAX_RANGE_DAYS. */
export function reportsAllTimeDateFrom(reference = new Date()) {
    const to = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
    const from = new Date(to);
    from.setDate(from.getDate() - REPORTS_MAX_RANGE_DAYS);
    const floor = parseIsoDateLocal(REPORTS_ALL_TIME_DATE_FROM);
    if (floor && from < floor)
        return REPORTS_ALL_TIME_DATE_FROM;
    return isoDateLocal(from);
}
/**
 * Clamp [dateFrom, dateTo] so the span is at most REPORTS_MAX_RANGE_DAYS
 * (keeps dateTo, moves dateFrom forward when needed).
 */
export function clampReportsDateRange(dateFrom, dateTo) {
    const from = parseIsoDateLocal(dateFrom.slice(0, 10));
    const to = parseIsoDateLocal(dateTo.slice(0, 10));
    if (!from || !to)
        return { dateFrom: dateFrom.slice(0, 10), dateTo: dateTo.slice(0, 10) };
    let d0 = from;
    let d1 = to;
    if (d1 < d0) {
        const tmp = d0;
        d0 = d1;
        d1 = tmp;
    }
    const spanDays = Math.round((d1.getTime() - d0.getTime()) / 86_400_000);
    if (spanDays <= REPORTS_MAX_RANGE_DAYS)
        return { dateFrom: isoDateLocal(d0), dateTo: isoDateLocal(d1) };
    const clampedFrom = new Date(d1);
    clampedFrom.setDate(clampedFrom.getDate() - REPORTS_MAX_RANGE_DAYS);
    return { dateFrom: isoDateLocal(clampedFrom), dateTo: isoDateLocal(d1) };
}
export function reportsYearStartIso(reference = new Date()) {
    return `${reference.getFullYear()}-01-01`;
}
export function reportsYtdRange(reference = new Date()) {
    return {
        dateFrom: reportsYearStartIso(reference),
        dateTo: isoDateLocal(reference),
    };
}
export function dayBeforeIso(iso) {
    const d = parseIsoDateLocal(iso);
    if (!d)
        return null;
    d.setDate(d.getDate() - 1);
    return isoDateLocal(d);
}
export function isoDateLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
export function parseIsoDateLocal(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso))
        return null;
    const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
        return null;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
}
export function periodToDates(date, g) {
    const pad = (n) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = date.getMonth();
    if (g === 'week') {
        const d = new Date(date);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        const end = new Date(d);
        end.setDate(d.getDate() + 6);
        return {
            dateFrom: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
            dateTo: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
        };
    }
    if (g === 'month') {
        const last = new Date(y, m + 1, 0).getDate();
        return { dateFrom: `${y}-${pad(m + 1)}-01`, dateTo: `${y}-${pad(m + 1)}-${pad(last)}` };
    }
    if (g === 'quarter') {
        const q = Math.floor(m / 3);
        const sm = q * 3;
        const em = sm + 2;
        const last = new Date(y, em + 1, 0).getDate();
        return { dateFrom: `${y}-${pad(sm + 1)}-01`, dateTo: `${y}-${pad(em + 1)}-${pad(last)}` };
    }
    if (g === 'all') {
        return {
            dateFrom: reportsAllTimeDateFrom(date),
            dateTo: reportsAllTimeDateTo(date),
        };
    }
    return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
}
export function formatPeriodLabel(date, g) {
    if (g === 'all')
        return 'За всё время';
    const { dateFrom, dateTo } = periodToDates(date, g);
    const fmt = (s, year = false) => {
        const d = new Date(s + 'T00:00:00');
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
    };
    const labels = {
        week: 'Эта неделя',
        month: 'Этот месяц',
        quarter: 'Этот квартал',
        year: 'Этот год',
    };
    return `${labels[g]}: ${fmt(dateFrom)} — ${fmt(dateTo, true)}`;
}
export function formatIsoDateLabel(iso, locale = 'ru-RU') {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}
export function formatIsoRangeTitle(from, to, opts) {
    const locale = opts?.locale ?? 'ru-RU';
    const fmt = (s) => formatIsoDateLabel(s, locale);
    const range = `${fmt(from)} — ${fmt(to)}`;
    if (opts?.prefix === false)
        return range;
    return `Период: ${range}`;
}
