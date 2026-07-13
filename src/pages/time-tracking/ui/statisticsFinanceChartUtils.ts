export type FinanceChartMetric = 'hours' | 'money' | 'collection';
export type FinanceChartView = 'chart' | 'table';

export type FinanceChartSeriesMode =
    | 'hours_vs_billable'
    | 'accrued_vs_paid'
    | 'rate'
    | 'paid'
    | 'collection_ratio';

export type FinanceSortKey =
    | 'name'
    | 'hours'
    | 'billableHours'
    | 'accrued'
    | 'paid'
    | 'ratePerHour'
    | 'collectionRatio';

export type FinanceTopN = 5 | 10 | 20 | 0;

export type FinanceChartRow = {
    id: string;
    name: string;
    hours: number;
    billableHours: number;
    accrued: number;
    paid: number;
    ratePerHour: number;
    currency: string;
    
    collectionRatio: number;
};

type CurrencySource = {
    currency?: string | null;
    billable_amount?: number | null;
    paid_amount?: number | null;
    payment?: number | null;
};

function normCurrency(raw: string | null | undefined): string {
    const c = String(raw ?? '').trim().toUpperCase();
    return c || '—';
}

function num(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}

export function computeCollectionRatio(accrued: number, paid: number): number {
    if (accrued > 0)
        return Math.round((paid / accrued) * 1000) / 10;
    if (paid > 0)
        return 100;
    return 0;
}

function withRatio(row: Omit<FinanceChartRow, 'collectionRatio'>): FinanceChartRow {
    return {
        ...row,
        collectionRatio: computeCollectionRatio(row.accrued, row.paid),
    };
}

export function listCurrencies(rows: readonly CurrencySource[]): string[] {
    const totals = new Map<string, number>();
    for (const row of rows) {
        const c = normCurrency(row.currency);
        const weight = Math.abs(num(row.billable_amount))
            + Math.abs(num(row.paid_amount))
            + Math.abs(num(row.payment));
        totals.set(c, (totals.get(c) ?? 0) + weight);
    }
    return [...totals.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([c]) => c);
}

export function pickDefaultCurrency(rows: readonly CurrencySource[]): string | null {
    const list = listCurrencies(rows);
    return list[0] ?? null;
}

export function filterRowsByCurrency<T extends CurrencySource>(
    rows: readonly T[],
    currency: string | null,
): T[] {
    if (!currency)
        return [...rows];
    const want = normCurrency(currency);
    return rows.filter((r) => normCurrency(r.currency) === want);
}

export function teamFinanceToChartRows(
    rows: readonly {
        team_id: string;
        team_name: string;
        hours: number;
        billable_hours: number;
        billable_amount: number;
        paid_amount: number;
        currency: string;
    }[],
): FinanceChartRow[] {
    return rows.map((r) => withRatio({
        id: String(r.team_id || r.team_name || '').trim(),
        name: String(r.team_name || '—').trim() || '—',
        hours: num(r.hours),
        billableHours: num(r.billable_hours),
        accrued: num(r.billable_amount),
        paid: num(r.paid_amount),
        ratePerHour: 0,
        currency: normCurrency(r.currency),
    }));
}

export function hoursVsPaymentToChartRows(
    rows: readonly {
        name: string;
        hours: number;
        payment: number;
        billable_amount?: number;
        currency: string;
    }[],
): FinanceChartRow[] {
    return rows.map((r, i) => withRatio({
        id: `${String(r.name || i)}`,
        name: String(r.name || '—').trim() || '—',
        hours: num(r.hours),
        billableHours: num(r.hours),
        accrued: num(r.billable_amount),
        paid: num(r.payment),
        ratePerHour: 0,
        currency: normCurrency(r.currency),
    }));
}

export function efficiencyToChartRows(
    rows: readonly {
        name: string;
        hours: number;
        payment: number;
        billable_amount?: number;
        rate_per_hour: number;
        currency: string;
    }[],
): FinanceChartRow[] {
    return rows.map((r, i) => withRatio({
        id: `${String(r.name || i)}`,
        name: String(r.name || '—').trim() || '—',
        hours: num(r.hours),
        billableHours: num(r.hours),
        accrued: num(r.billable_amount),
        paid: num(r.payment),
        ratePerHour: num(r.rate_per_hour),
        currency: normCurrency(r.currency),
    }));
}

export function sortFinanceRows(
    rows: readonly FinanceChartRow[],
    key: FinanceSortKey,
    dir: 'asc' | 'desc' = 'desc',
): FinanceChartRow[] {
    const mult = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        if (key === 'name')
            return mult * a.name.localeCompare(b.name, 'ru');
        const av = a[key];
        const bv = b[key];
        if (av === bv)
            return a.name.localeCompare(b.name, 'ru');
        return mult * (av - bv);
    });
}


export function applyFinanceTopN(
    rows: readonly FinanceChartRow[],
    topN: FinanceTopN,
    otherLabel: string,
): FinanceChartRow[] {
    if (!topN || rows.length <= topN)
        return [...rows];
    const head = rows.slice(0, topN);
    const rest = rows.slice(topN);
    if (!rest.length)
        return head;
    const hours = rest.reduce((s, r) => s + r.hours, 0);
    const paid = rest.reduce((s, r) => s + r.paid, 0);
    const accrued = rest.reduce((s, r) => s + r.accrued, 0);
    return [
        ...head,
        withRatio({
            id: '__other__',
            name: otherLabel,
            hours,
            billableHours: rest.reduce((s, r) => s + r.billableHours, 0),
            accrued,
            paid,
            ratePerHour: hours > 0 ? Math.round((paid / hours) * 100) / 100 : 0,
            currency: head[0]?.currency ?? rest[0]?.currency ?? '—',
        }),
    ];
}

export function financeRowsSummary(rows: readonly FinanceChartRow[]): {
    hours: number;
    billableHours: number;
    accrued: number;
    paid: number;
    collectionRatio: number;
} {
    const hours = rows.reduce((s, r) => s + r.hours, 0);
    const billableHours = rows.reduce((s, r) => s + r.billableHours, 0);
    const accrued = rows.reduce((s, r) => s + r.accrued, 0);
    const paid = rows.reduce((s, r) => s + r.paid, 0);
    return {
        hours,
        billableHours,
        accrued,
        paid,
        collectionRatio: computeCollectionRatio(accrued, paid),
    };
}

export function defaultSortKeyForMode(
    seriesMode: FinanceChartSeriesMode,
    metric: FinanceChartMetric,
): FinanceSortKey {
    if (seriesMode === 'rate')
        return 'ratePerHour';
    if (metric === 'collection' || seriesMode === 'collection_ratio')
        return 'collectionRatio';
    if (metric === 'hours')
        return 'hours';
    return 'accrued';
}

export function chartHeightForRows(rowCount: number, min = 220, perRow = 36, max = 560): number {
    if (rowCount <= 0)
        return min;
    return Math.min(max, Math.max(min, 80 + rowCount * perRow));
}

export function shortenCategoryLabel(name: string, max = 22): string {
    const s = name.trim();
    if (s.length <= max)
        return s;
    return `${s.slice(0, Math.max(1, max - 1))}…`;
}
