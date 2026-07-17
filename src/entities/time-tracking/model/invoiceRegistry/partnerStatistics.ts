import type { InvoiceRegistryRow, InvoiceRegistryYearId } from './types';
import { INVOICE_REGISTRY_SHEETS } from './columns';
import { loadInvoiceRegistryRows } from './loadSeed';

export const INVOICE_REGISTRY_STATS_YEARS: InvoiceRegistryYearId[] = INVOICE_REGISTRY_SHEETS
    .map((s) => s.year)
    .filter((y): y is InvoiceRegistryYearId => y !== 'checklist');

export type RegistryStatsYearFilter = 'all' | InvoiceRegistryYearId;

export type PartnerCurrencyMap = Record<string, Record<string, number>>;

export type PartnerRegistryStats = {
    invoiced: PartnerCurrencyMap;
    remuneration: PartnerCurrencyMap;
    balance: PartnerCurrencyMap;
    invoiceCount: Record<string, number>;
    rowsProcessed: number;
    rowsWithPartner: number;
    rowsWithRemuneration: number;
};

export type PartnerStatsRow = {
    partner: string;
    currency: string;
    invoiced: number;
    remuneration: number;
    balance: number;
    count: number;
};

const PARTNER_SPLIT_RE = /^([A-Za-zА-Яа-яЁё]{2,5})\s*:\s*([\d\s.,]+)\s*$/;

export function parseRegistryAmount(raw: string): number | null {
    const s = raw.trim();
    if (!s)
        return null;
    let cleaned = s.replace(/\s/g, '');
    if (/,\d{1,2}$/.test(cleaned) && !cleaned.includes('.')) {
        cleaned = cleaned.replace(',', '.');
    }
    else {
        cleaned = cleaned.replace(/,/g, '');
    }
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
}

export function parseAdvanceFeeSplits(text: string): { partner: string; amount: number }[] {
    const out: { partner: string; amount: number }[] = [];
    for (const line of text.split(/\n/)) {
        const m = line.trim().match(PARTNER_SPLIT_RE);
        if (!m)
            continue;
        const amount = parseRegistryAmount(m[2] ?? '');
        if (amount != null && amount > 0)
            out.push({ partner: m[1]!.trim(), amount });
    }
    return out;
}

function parseSingleAdvanceFeeAmount(text: string): number | null {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length !== 1 || lines[0]!.includes(':'))
        return null;
    const amount = parseRegistryAmount(lines[0]!);
    return amount != null && amount > 0 ? amount : null;
}

function normalizeCurrency(raw: string): string {
    const c = raw.trim().toUpperCase();
    return c || '—';
}

function normalizePartner(raw: string): string {
    const p = raw.trim();
    return p || '—';
}

function bump(map: PartnerCurrencyMap, partner: string, currency: string, delta: number): void {
    if (!Number.isFinite(delta) || delta === 0)
        return;
    const p = normalizePartner(partner);
    const c = normalizeCurrency(currency);
    if (!map[p])
        map[p] = {};
    map[p][c] = (map[p][c] ?? 0) + delta;
}

export function aggregatePartnerRegistryStats(rows: InvoiceRegistryRow[]): PartnerRegistryStats {
    const stats: PartnerRegistryStats = {
        invoiced: {},
        remuneration: {},
        balance: {},
        invoiceCount: {},
        rowsProcessed: 0,
        rowsWithPartner: 0,
        rowsWithRemuneration: 0,
    };

    for (const row of rows) {
        const amount = parseRegistryAmount(row.amount ?? '');
        const balance = parseRegistryAmount(row.balance ?? '');
        const currency = normalizeCurrency(row.currency ?? '');
        const partner = normalizePartner(row.partner ?? '');
        const advanceFee = (row.advanceFee ?? '').trim();

        stats.rowsProcessed += 1;

        if (partner !== '—')
            stats.rowsWithPartner += 1;

        if (amount != null && amount > 0 && partner !== '—') {
            bump(stats.invoiced, partner, currency, amount);
            stats.invoiceCount[partner] = (stats.invoiceCount[partner] ?? 0) + 1;
        }

        if (balance != null && balance > 0)
            bump(stats.balance, partner !== '—' ? partner : '—', currency, balance);

        const splits = advanceFee ? parseAdvanceFeeSplits(advanceFee) : [];
        if (splits.length > 0) {
            stats.rowsWithRemuneration += 1;
            for (const split of splits)
                bump(stats.remuneration, split.partner, currency, split.amount);
        }
        else if (advanceFee) {
            const single = parseSingleAdvanceFeeAmount(advanceFee);
            if (single != null && partner !== '—') {
                stats.rowsWithRemuneration += 1;
                bump(stats.remuneration, partner, currency, single);
            }
        }
    }

    return stats;
}

export function flattenPartnerStats(stats: PartnerRegistryStats): PartnerStatsRow[] {
    const keys = new Set<string>();
    const addKeys = (map: PartnerCurrencyMap) => {
        for (const [partner, byCur] of Object.entries(map)) {
            for (const currency of Object.keys(byCur))
                keys.add(`${partner}\0${currency}`);
        }
    };
    addKeys(stats.invoiced);
    addKeys(stats.remuneration);
    addKeys(stats.balance);

    const rows: PartnerStatsRow[] = [];
    for (const key of keys) {
        const [partner, currency] = key.split('\0') as [string, string];
        rows.push({
            partner,
            currency,
            invoiced: stats.invoiced[partner]?.[currency] ?? 0,
            remuneration: stats.remuneration[partner]?.[currency] ?? 0,
            balance: stats.balance[partner]?.[currency] ?? 0,
            count: stats.invoiceCount[partner] ?? 0,
        });
    }

    return rows.sort((a, b) => {
        const profitDiff = (b.remuneration || b.invoiced) - (a.remuneration || a.invoiced);
        if (profitDiff !== 0)
            return profitDiff;
        return a.partner.localeCompare(b.partner, 'ru');
    });
}

export function listCurrenciesFromStats(stats: PartnerRegistryStats): string[] {
    const set = new Set<string>();
    const scan = (map: PartnerCurrencyMap) => {
        for (const byCur of Object.values(map)) {
            for (const [currency, value] of Object.entries(byCur)) {
                if (value > 0)
                    set.add(currency);
            }
        }
    };
    scan(stats.invoiced);
    scan(stats.remuneration);
    scan(stats.balance);
    return [...set].sort((a, b) => a.localeCompare(b));
}

export function partnerTotalsForCurrency(
    stats: PartnerRegistryStats,
    currency: string,
    metric: 'remuneration' | 'invoiced' | 'balance',
): { partner: string; value: number }[] {
    const map = stats[metric];
    const out: { partner: string; value: number }[] = [];
    for (const [partner, byCur] of Object.entries(map)) {
        const value = byCur[currency] ?? 0;
        if (value > 0)
            out.push({ partner, value });
    }
    return out.sort((a, b) => b.value - a.value);
}

export async function loadInvoiceRegistryStatsRows(
    filter: RegistryStatsYearFilter,
): Promise<{ rows: InvoiceRegistryRow[]; years: InvoiceRegistryYearId[] }> {
    const years = filter === 'all'
        ? INVOICE_REGISTRY_STATS_YEARS
        : [filter];
    const chunks = await Promise.all(years.map((y) => loadInvoiceRegistryRows(y)));
    const rows = chunks.flatMap((c) => c.rows);
    return { rows, years };
}
