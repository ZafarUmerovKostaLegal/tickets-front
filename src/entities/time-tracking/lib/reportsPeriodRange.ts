import type { PeriodGranularity } from '@entities/time-tracking/model/reportsPanelConfig';


export const REPORTS_ALL_TIME_DATE_FROM = '2000-01-01';

export function reportsAllTimeDateTo(reference = new Date()): string {
    return isoDateLocal(reference);
}

export function reportsYearStartIso(reference = new Date()): string {
    return `${reference.getFullYear()}-01-01`;
}

export function reportsYtdRange(reference = new Date()): {
    dateFrom: string;
    dateTo: string;
} {
    return {
        dateFrom: reportsYearStartIso(reference),
        dateTo: isoDateLocal(reference),
    };
}

export function dayBeforeIso(iso: string): string | null {
    const d = parseIsoDateLocal(iso);
    if (!d)
        return null;
    d.setDate(d.getDate() - 1);
    return isoDateLocal(d);
}

export function isoDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function parseIsoDateLocal(iso: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso))
        return null;
    const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d))
        return null;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

export function periodToDates(date: Date, g: PeriodGranularity): {
    dateFrom: string;
    dateTo: string;
} {
    const pad = (n: number) => String(n).padStart(2, '0');
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
        return { dateFrom: REPORTS_ALL_TIME_DATE_FROM, dateTo: reportsAllTimeDateTo() };
    }
    return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
}

export function formatPeriodLabel(date: Date, g: PeriodGranularity): string {
    if (g === 'all')
        return 'За всё время';
    const { dateFrom, dateTo } = periodToDates(date, g);
    const fmt = (s: string, year = false) => {
        const d = new Date(s + 'T00:00:00');
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
    };
    const labels: Record<Exclude<PeriodGranularity, 'all'>, string> = {
        week: 'Эта неделя',
        month: 'Этот месяц',
        quarter: 'Этот квартал',
        year: 'Этот год',
    };
    return `${labels[g]}: ${fmt(dateFrom)} — ${fmt(dateTo, true)}`;
}

export function formatIsoDateLabel(iso: string, locale = 'ru-RU'): string {
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatIsoRangeTitle(from: string, to: string, opts?: {
    prefix?: boolean;
    locale?: string;
}): string {
    const locale = opts?.locale ?? 'ru-RU';
    const fmt = (s: string) => formatIsoDateLabel(s, locale);
    const range = `${fmt(from)} — ${fmt(to)}`;
    if (opts?.prefix === false)
        return range;
    return `Период: ${range}`;
}
