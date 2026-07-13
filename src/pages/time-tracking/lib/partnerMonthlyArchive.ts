import type { PartnerReportConfirmationRequest } from '@entities/time-tracking';

export type MonthlyArchiveMonthKey = `${number}-${string}`;

export type MonthlyArchiveMonthFolder = {
    key: MonthlyArchiveMonthKey;
    year: number;
    month: number;
    reports: PartnerReportConfirmationRequest[];
};

export type MonthlyArchiveYearFolder = {
    year: number;
    months: MonthlyArchiveMonthFolder[];
    reportCount: number;
};

/** Группировка по dateTo (конец периода отчёта). */
export function monthKeyFromDateTo(dateTo: string): MonthlyArchiveMonthKey | null {
    const iso = String(dateTo ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso))
        return null;
    const year = Number(iso.slice(0, 4));
    const month = Number(iso.slice(5, 7));
    if (!Number.isFinite(year) || month < 1 || month > 12)
        return null;
    return `${year}-${String(month).padStart(2, '0')}` as MonthlyArchiveMonthKey;
}

export function parseMonthKey(key: string): { year: number; month: number } | null {
    const m = /^(\d{4})-(\d{2})$/.exec(String(key ?? '').trim());
    if (!m)
        return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (!Number.isFinite(year) || month < 1 || month > 12)
        return null;
    return { year, month };
}

export function buildMonthlyArchiveTree(
    reports: readonly PartnerReportConfirmationRequest[],
): MonthlyArchiveYearFolder[] {
    const byMonth = new Map<MonthlyArchiveMonthKey, PartnerReportConfirmationRequest[]>();
    for (const row of reports) {
        const key = monthKeyFromDateTo(row.dateTo);
        if (!key)
            continue;
        const list = byMonth.get(key);
        if (list)
            list.push(row);
        else
            byMonth.set(key, [row]);
    }

    const byYear = new Map<number, MonthlyArchiveMonthFolder[]>();
    for (const [key, list] of byMonth) {
        const parsed = parseMonthKey(key);
        if (!parsed)
            continue;
        const sorted = [...list].sort((a, b) => {
            const byTo = b.dateTo.localeCompare(a.dateTo);
            if (byTo !== 0)
                return byTo;
            return a.title.localeCompare(b.title);
        });
        const folder: MonthlyArchiveMonthFolder = {
            key,
            year: parsed.year,
            month: parsed.month,
            reports: sorted,
        };
        const months = byYear.get(parsed.year);
        if (months)
            months.push(folder);
        else
            byYear.set(parsed.year, [folder]);
    }

    return [...byYear.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([year, months]) => {
            const sortedMonths = [...months].sort((a, b) => b.month - a.month);
            return {
                year,
                months: sortedMonths,
                reportCount: sortedMonths.reduce((n, m) => n + m.reports.length, 0),
            };
        });
}

export function filterReportsByQuery(
    reports: readonly PartnerReportConfirmationRequest[],
    query: string,
    resolveLabels: (row: PartnerReportConfirmationRequest) => { project: string; client: string },
): PartnerReportConfirmationRequest[] {
    const q = query.trim().toLowerCase();
    if (!q)
        return [...reports];
    return reports.filter((r) => {
        const labels = resolveLabels(r);
        const hay = [
            r.title,
            labels.project,
            labels.client,
            r.dateFrom,
            r.dateTo,
            r.projectId,
            r.lastComment?.text ?? '',
        ].join(' ').toLowerCase();
        return hay.includes(q);
    });
}
