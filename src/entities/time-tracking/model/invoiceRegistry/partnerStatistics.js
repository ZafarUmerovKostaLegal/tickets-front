import { INVOICE_REGISTRY_SHEETS } from './columns';
import { loadInvoiceRegistryRows } from './loadSeed';
import { mapInvoiceRegistryCurrencyCode } from './currencyCodeMap';
import { mapInvoiceRegistryPartnerCode } from './partnerCodeMap';
export const INVOICE_REGISTRY_STATS_YEARS = INVOICE_REGISTRY_SHEETS
    .map((s) => s.year)
    .filter((y) => y !== 'checklist' && y !== '2026-system');
const PARTNER_SPLIT_RE = /^([A-Za-zА-Яа-яЁё]{2,5})\s*:\s*([\d\s.,]+)\s*$/;
/** Parse registry money cells that may use US (`5,881.50`) or EU (`5.881,50`) separators. */
export function parseRegistryAmount(raw) {
    let s = raw.trim();
    if (!s)
        return null;
    s = s.replace(/\s/g, '').replace(/\u00a0/g, '');
    if (!s || /^[-—–]+$/.test(s))
        return null;
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
        // Both separators: the rightmost is the decimal separator.
        if (lastComma > lastDot) {
            // 5.881,50 → 5881.50
            s = s.replace(/\./g, '').replace(',', '.');
        }
        else {
            // 5,881.50 → 5881.50
            s = s.replace(/,/g, '');
        }
    }
    else if (lastComma >= 0) {
        const frac = s.length - lastComma - 1;
        if (frac === 1 || frac === 2) {
            // 5881,50 → decimal comma
            s = s.replace(',', '.');
        }
        else {
            // 5,881,500 → thousand commas
            s = s.replace(/,/g, '');
        }
    }
    else if (lastDot >= 0) {
        const dotCount = (s.match(/\./g) ?? []).length;
        if (dotCount > 1) {
            // 5.881.500 → thousand dots
            s = s.replace(/\./g, '');
        }
        else if (s.endsWith('.')) {
            // trailing dot
            s = s.slice(0, -1);
        }
        // else single decimal point — keep as-is (incl. float tails like 4576.224357896251)
    }
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : null;
}
/** Display/store format: `5,881.50` (en-US, always 2 fraction digits). */
export function formatRegistryAmount(n) {
    if (!Number.isFinite(n))
        return '';
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
/**
 * Format a registry amount cell for display.
 * Empty / non-numeric values are returned unchanged.
 */
export function formatRegistryAmountCell(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return '';
    const n = parseRegistryAmount(trimmed);
    if (n == null)
        return raw;
    return formatRegistryAmount(n);
}
export function isInvoiceRegistryMoneyColumnKey(key) {
    return key === 'amount' || key === 'balance';
}
/** Visual lines for «Пред.вознаграждение»: partner code and one or more amounts. */
export function formatAdvanceFeeLines(raw) {
    const out = [];
    for (const line of raw.split(/\n/)) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        const match = trimmed.match(/^([A-Za-zА-Яа-яЁё]{2,6})\s*:\s*(.+)$/);
        if (!match) {
            out.push({ text: trimmed });
            continue;
        }
        const partner = mapInvoiceRegistryPartnerCode(match[1] ?? '');
        const amounts = (match[2] ?? '')
            .split(';')
            .map((part) => {
            const piece = part.trim();
            const amount = parseRegistryAmount(piece);
            return amount != null ? formatRegistryAmount(amount) : piece;
        })
            .filter(Boolean);
        if (!partner || amounts.length === 0) {
            out.push({ text: trimmed });
            continue;
        }
        out.push({ partner, amounts });
    }
    return out;
}
export function parseAdvanceFeeSplits(text) {
    const out = [];
    for (const line of text.split(/\n/)) {
        const m = line.trim().match(PARTNER_SPLIT_RE);
        if (!m)
            continue;
        const amount = parseRegistryAmount(m[2] ?? '');
        if (amount != null && amount > 0)
            out.push({ partner: mapInvoiceRegistryPartnerCode(m[1].trim()), amount });
    }
    return out;
}
function parseSingleAdvanceFeeAmount(text) {
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length !== 1 || lines[0].includes(':'))
        return null;
    const amount = parseRegistryAmount(lines[0]);
    return amount != null && amount > 0 ? amount : null;
}
function normalizeCurrency(raw) {
    const c = mapInvoiceRegistryCurrencyCode(raw);
    return c || '—';
}
function normalizePartner(raw) {
    const p = mapInvoiceRegistryPartnerCode(raw.trim());
    return p || '—';
}
function bump(map, partner, currency, delta) {
    if (!Number.isFinite(delta) || delta === 0)
        return;
    const p = normalizePartner(partner);
    const c = normalizeCurrency(currency);
    if (!map[p])
        map[p] = {};
    map[p][c] = (map[p][c] ?? 0) + delta;
}
export function aggregatePartnerRegistryStats(rows) {
    const stats = {
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
export function flattenPartnerStats(stats) {
    const keys = new Set();
    const addKeys = (map) => {
        for (const [partner, byCur] of Object.entries(map)) {
            for (const currency of Object.keys(byCur))
                keys.add(`${partner}\0${currency}`);
        }
    };
    addKeys(stats.invoiced);
    addKeys(stats.remuneration);
    addKeys(stats.balance);
    const rows = [];
    for (const key of keys) {
        const [partner, currency] = key.split('\0');
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
export function listCurrenciesFromStats(stats) {
    const set = new Set();
    const scan = (map) => {
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
export function partnerTotalsForCurrency(stats, currency, metric) {
    const map = stats[metric];
    const out = [];
    for (const [partner, byCur] of Object.entries(map)) {
        const value = byCur[currency] ?? 0;
        if (value > 0)
            out.push({ partner, value });
    }
    return out.sort((a, b) => b.value - a.value);
}
function sumMetricForCurrency(map, currency) {
    let total = 0;
    for (const byCur of Object.values(map))
        total += byCur[currency] ?? 0;
    return total;
}
export function totalsForCurrency(stats, currency) {
    return {
        currency,
        invoiced: sumMetricForCurrency(stats.invoiced, currency),
        remuneration: sumMetricForCurrency(stats.remuneration, currency),
        balance: sumMetricForCurrency(stats.balance, currency),
    };
}
export function listCurrencyTotals(stats) {
    return listCurrenciesFromStats(stats).map((currency) => totalsForCurrency(stats, currency));
}
/** Sum all positive registry `amount` values by currency (partner not required). */
export function sumInvoicedByCurrency(rows) {
    const totals = {};
    for (const row of rows) {
        const amount = parseRegistryAmount(row.amount ?? '');
        if (amount == null || amount <= 0)
            continue;
        const currency = normalizeCurrency(row.currency ?? '');
        if (currency === '—')
            continue;
        totals[currency] = (totals[currency] ?? 0) + amount;
    }
    return Object.entries(totals)
        .map(([currency, invoiced]) => ({ currency, invoiced }))
        .sort((a, b) => b.invoiced - a.invoiced || a.currency.localeCompare(b.currency));
}
/** Pivot: partner × currency invoiced totals (only rows with a partner). */
export function sumInvoicedByPartnerCurrency(rows) {
    const byPartner = {};
    const currencyTotals = {};
    for (const row of rows) {
        const amount = parseRegistryAmount(row.amount ?? '');
        if (amount == null || amount <= 0)
            continue;
        const partner = normalizePartner(row.partner ?? '');
        if (partner === '—')
            continue;
        const currency = normalizeCurrency(row.currency ?? '');
        if (currency === '—')
            continue;
        if (!byPartner[partner])
            byPartner[partner] = {};
        byPartner[partner][currency] = (byPartner[partner][currency] ?? 0) + amount;
        currencyTotals[currency] = (currencyTotals[currency] ?? 0) + amount;
    }
    const currencies = Object.entries(currencyTotals)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([currency]) => currency);
    const partners = Object.entries(byPartner)
        .map(([partner, amounts]) => ({ partner, amounts }))
        .sort((a, b) => {
        const aMax = Math.max(0, ...Object.values(a.amounts));
        const bMax = Math.max(0, ...Object.values(b.amounts));
        if (bMax !== aMax)
            return bMax - aMax;
        return a.partner.localeCompare(b.partner, 'ru');
    });
    return { currencies, partners };
}
export async function loadInvoiceRegistryStatsRows(filter) {
    const years = filter === 'all'
        ? INVOICE_REGISTRY_STATS_YEARS
        : [filter];
    const chunks = await Promise.all(years.map((y) => loadInvoiceRegistryRows(y)));
    const rows = chunks.flatMap((c) => c.rows);
    return { rows, years };
}
