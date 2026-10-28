import { foreignUnitsPerUsd } from '@entities/expenses/model/cbuRates';
import { mapInvoiceRegistryCurrencyCode } from './currencyCodeMap';
import { formatRegistryAmount, parseRegistryAmount } from './partnerStatistics';
import { parseRegistryDay } from './registryFilters';
export function registryIssueIso(raw) {
    const day = parseRegistryDay(raw);
    if (!day)
        return null;
    const month = String(day.month).padStart(2, '0');
    const date = String(day.day).padStart(2, '0');
    return `${day.year}-${month}-${date}`;
}
/** Convert an invoiced amount into USD using the Central Bank rate for that day. */
export function registryAmountUsd(amount, currency, parsed) {
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
export function registryUsdRateDates(rows) {
    const dates = new Set();
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
function currencyCode(raw) {
    return mapInvoiceRegistryCurrencyCode(raw.replace(/\s+/g, ''));
}
function basisAmount(amount) {
    return String(Math.round(amount * 1e8) / 1e8);
}
export function registryUsdBasis(row) {
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
function storedUsd(row, basis) {
    const saved = String(row.amountUsd ?? '').trim();
    const savedBasis = String(row.amountUsdBasis ?? '').trim();
    if (!saved || !basis || savedBasis !== basis)
        return '';
    return saved;
}
export function formatRegistryAmountUsd(row, rates, failed) {
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
export function registryUsdPersistItem(row, rates, failed) {
    const id = String(row.id ?? '').trim();
    const basis = registryUsdBasis(row);
    if (!id || !basis)
        return null;
    const shown = formatRegistryAmountUsd(row, rates, failed);
    if (!SAVED_USD.test(shown))
        return null;
    if (shown === String(row.amountUsd ?? '').trim() && basis === String(row.amountUsdBasis ?? '').trim())
        return null;
    return { id, amountUsd: shown, basis };
}
