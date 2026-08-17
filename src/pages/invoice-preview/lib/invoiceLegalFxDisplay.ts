import type { InvoiceCoverLanguage } from './invoiceCoverLetterModel';
import type { InvoiceLegalPageOverrides } from './invoiceLegalPageModel';
import { getLegalInvoiceLabels } from './invoiceLegalPageI18n';

/** Primary total with optional FX equivalent in parentheses. */
export function formatLegalTotalWithFxAlt(
    primaryFormatted: string,
    overrides?: InvoiceLegalPageOverrides | null,
): string {
    const primary = (primaryFormatted ?? '').trim();
    const alt = overrides?.fxAltAmountFormatted?.trim();
    if (!primary)
        return alt || '';
    if (!alt)
        return primary;
    return `${primary} (${alt})`;
}

/** Right-side value for the exchange-rate totals row (no label prefix). */
export function formatLegalExchangeRateValue(
    overrides?: InvoiceLegalPageOverrides | null,
    lang?: InvoiceCoverLanguage | null,
): string | null {
    const rate = String(overrides?.fxRate ?? '').trim();
    const base = String(overrides?.fxBaseCurrency ?? '').trim().toUpperCase();
    const quote = String(overrides?.fxQuoteCurrency ?? '').trim().toUpperCase();
    if (!rate || !base || !quote)
        return null;
    const labels = getLegalInvoiceLabels(lang);
    const dateRaw = overrides?.fxRateDate?.trim().slice(0, 10) ?? '';
    const dateDisp = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
        ? dateRaw.split('-').reverse().join('.')
        : '';
    const ratePart = labels.exchangeRateValue(base, rate, quote);
    return dateDisp ? `${ratePart} (${dateDisp})` : ratePart;
}

/** Full exchange-rate line including label (for plain-text contexts). */
export function formatLegalExchangeRateLine(
    overrides?: InvoiceLegalPageOverrides | null,
    lang?: InvoiceCoverLanguage | null,
): string | null {
    const value = formatLegalExchangeRateValue(overrides, lang);
    if (!value)
        return null;
    const labels = getLegalInvoiceLabels(lang);
    return `${labels.exchangeRate}: ${value}`;
}

export function hasLegalFxDisplay(overrides?: InvoiceLegalPageOverrides | null): boolean {
    return Boolean(
        overrides?.fxAltAmountFormatted?.trim()
        || (overrides?.fxRate && overrides?.fxBaseCurrency && overrides?.fxQuoteCurrency),
    );
}
