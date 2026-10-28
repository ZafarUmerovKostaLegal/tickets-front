import { foreignUnitsPerUsd, type CbuParsed } from '@entities/expenses/model/cbuRates';
import { mapInvoiceRegistryCurrencyCode } from './currencyCodeMap';
import { formatRegistryAmount, parseRegistryAmount } from './partnerStatistics';
import { parseRegistryDay } from './registryFilters';

export function registryIssueIso(raw: string): string | null {
    const day = parseRegistryDay(raw);
    if (!day)
        return null;
    const month = String(day.month).padStart(2, '0');
    const date = String(day.day).padStart(2, '0');
    return `${day.year}-${month}-${date}`;
}

/** Convert an invoiced amount into USD using the Central Bank rate for that day. */
export function registryAmountUsd(amount: number, currency: string, parsed: CbuParsed | null): number | null {
    if (!Number.isFinite(amount))
        return null;
    if (amount === 0)
        return 0;
    const code = mapInvoiceRegistryCurrencyCode(currency.replace(/\s+/g, ''));
    if (!code)
        return null;
    if (code === 'USD')
        return amount;
    if (!parsed)
        return null;
    const unitsPerUsd = foreignUnitsPerUsd(parsed, code);
    if (unitsPerUsd == null || !(unitsPerUsd > 0))
        return null;
    const usd = amount / unitsPerUsd;
    return Number.isFinite(usd) ? usd : null;
}

export type RegistryUsdRow = {
    id?: string;
    amount?: string;
    currency?: string;
    issueDate?: string;
    amountUsd?: string;
    amountUsdBasis?: string;
};

export function registryUsdRateDates(rows: readonly RegistryUsdRow[]): string[] {
    const dates = new Set<string>();
    for (const row of rows) {
        const amount = parseRegistryAmount(String(row.amount ?? ''));
        if (amount == null || amount === 0)
            continue;
        const code = mapInvoiceRegistryCurrencyCode(String(row.currency ?? '').replace(/\s+/g, ''));
        if (!code || code === 'USD')
            continue;
        const iso = registryIssueIso(String(row.issueDate ?? ''));
        if (iso)
            dates.add(iso);
    }
    return [...dates].sort();
}

export type RegistryUsdSaveItem = {
    id: string;
    amountUsd: string;
    basis: string;
};

function currencyCode(raw: string): string {
    return mapInvoiceRegistryCurrencyCode(raw.replace(/\s+/g, ''));
}

function basisAmount(amount: number): string {
    return String(Math.round(amount * 1e8) / 1e8);
}

function basisKey(basis: string): string {
    const [amount, code, iso] = basis.split('|');
    if (!amount || !code || !iso)
        return '';
    return `${amount}|${code}|${iso}`;
}

function liveUnitsPerUsd(
    row: RegistryUsdRow,
    rates: Readonly<Record<string, CbuParsed>>,
    failed: Readonly<Record<string, true>>,
): number | null {
    const code = currencyCode(String(row.currency ?? ''));
    if (!code || code === 'USD')
        return null;
    const iso = registryIssueIso(String(row.issueDate ?? ''));
    if (!iso || failed[iso])
        return null;
    const parsed = rates[iso];
    if (!parsed)
        return null;
    const unitsPerUsd = foreignUnitsPerUsd(parsed, code);
    if (unitsPerUsd == null || !(unitsPerUsd > 0))
        return null;
    return unitsPerUsd;
}

export function registryUsdBasis(row: RegistryUsdRow): string | null {
    const amount = parseRegistryAmount(String(row.amount ?? ''));
    if (amount == null)
        return null;
    const code = currencyCode(String(row.currency ?? ''));
    if (!code)
        return null;
    const iso = registryIssueIso(String(row.issueDate ?? '')) ?? '-';
    if (code !== 'USD' && iso === '-')
        return null;
    return `${basisAmount(amount)}|${code}|${iso}`;
}

function storedUsd(row: RegistryUsdRow, basis: string | null): string {
    const saved = String(row.amountUsd ?? '').trim();
    const savedBasis = String(row.amountUsdBasis ?? '').trim();
    if (!saved || !basis || basisKey(savedBasis) !== basis)
        return '';
    return saved;
}

function ruRateDate(raw: string): string {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (iso)
        return `${iso[3]}.${iso[2]}.${iso[1]}`;
    return raw.trim();
}

function formatFx(value: number, digits: number): string {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

function hintFromUnits(code: string, unitsPerUsd: number, dateLabel: string): string {
    const when = dateLabel ? ` на ${dateLabel}` : '';
    if (code === 'UZS')
        return `1 USD = ${formatFx(unitsPerUsd, unitsPerUsd >= 100 ? 2 : 4)} UZS${when}`;
    const usdPerUnit = 1 / unitsPerUsd;
    return `1 ${code} = ${formatFx(usdPerUnit, usdPerUnit >= 1 ? 4 : 6)} USD${when}`;
}

function savedUnits(row: RegistryUsdRow, basis: string | null): number | null {
    if (!basis)
        return null;
    const savedBasis = String(row.amountUsdBasis ?? '').trim();
    if (basisKey(savedBasis) !== basis)
        return null;
    const raw = savedBasis.split('|')[3];
    if (!raw)
        return null;
    const units = Number(raw);
    return Number.isFinite(units) && units > 0 ? units : null;
}

/** Rate used for the dollar cell, for the hover tooltip. */
export function registryUsdRateHint(
    row: RegistryUsdRow,
    rates: Readonly<Record<string, CbuParsed>>,
    failed: Readonly<Record<string, true>>,
): string {
    const amount = parseRegistryAmount(String(row.amount ?? ''));
    if (amount == null)
        return '';
    const code = currencyCode(String(row.currency ?? ''));
    if (!code)
        return '';
    if (code === 'USD')
        return '1 USD = 1 USD';
    const basis = registryUsdBasis(row);
    const iso = registryIssueIso(String(row.issueDate ?? ''));
    const parsed = iso && !failed[iso] ? rates[iso] : undefined;
    const live = liveUnitsPerUsd(row, rates, failed);
    if (live != null)
        return hintFromUnits(code, live, ruRateDate(parsed?.rateDateRu || iso || ''));
    const remembered = savedUnits(row, basis);
    if (remembered == null)
        return '';
    const savedDate = basis?.split('|')[2] ?? '';
    return hintFromUnits(code, remembered, savedDate === '-' ? '' : ruRateDate(savedDate));
}

export function formatRegistryAmountUsd(
    row: RegistryUsdRow,
    rates: Readonly<Record<string, CbuParsed>>,
    failed: Readonly<Record<string, true>>,
): string {
    const amount = parseRegistryAmount(String(row.amount ?? ''));
    if (amount == null)
        return '';
    const code = currencyCode(String(row.currency ?? ''));
    if (!code)
        return '';
    const basis = registryUsdBasis(row);
    const remembered = storedUsd(row, basis);
    if (code === 'USD' || amount === 0)
        return formatRegistryAmount(amount);
    const iso = registryIssueIso(String(row.issueDate ?? ''));
    if (!iso || failed[iso])
        return remembered || '—';
    const parsed = rates[iso];
    if (!parsed)
        return remembered || '…';
    const usd = registryAmountUsd(amount, code, parsed);
    return usd == null ? (remembered || '—') : formatRegistryAmount(usd);
}

const SAVED_USD = /^\d{1,3}(?:,\d{3})*\.\d{2}$/;

export function registryUsdPersistItem(
    row: RegistryUsdRow,
    rates: Readonly<Record<string, CbuParsed>>,
    failed: Readonly<Record<string, true>>,
): RegistryUsdSaveItem | null {
    const id = String(row.id ?? '').trim();
    const key = registryUsdBasis(row);
    if (!id || !key)
        return null;
    const shown = formatRegistryAmountUsd(row, rates, failed);
    if (!SAVED_USD.test(shown))
        return null;
    const units = liveUnitsPerUsd(row, rates, failed);
    const basis = units == null ? key : `${key}|${basisAmount(units)}`;
    const savedBasis = String(row.amountUsdBasis ?? '').trim();
    const sameAmount = shown === String(row.amountUsd ?? '').trim();
    const sameBasis = basis === savedBasis || (units == null && basisKey(savedBasis) === key);
    if (sameAmount && sameBasis)
        return null;
    return { id, amountUsd: shown, basis };
}
