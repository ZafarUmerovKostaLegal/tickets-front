import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import type { InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import {
    getLegalInvoiceLabels,
    resolveLocalizedLegalPaymentDisclaimer,
    resolveLocalizedLegalServiceDescription,
    resolveLocalizedLegalThanks,
} from './invoiceLegalPageI18n';
import { parseCoverLetterMoneyAmount, type InvoiceCoverLanguage } from './invoiceCoverLetterI18n';

export type InvoiceLegalBankingFieldKey =
    | 'recipientName'
    | 'legalAddress'
    | 'tin'
    | 'oked'
    | 'bankName'
    | 'bankAddress'
    | 'accountNumber'
    | 'bankCode'
    | 'swift'
    | 'correspondentBank'
    | 'correspondentAccount'
    | 'correspondentBik'
    | 'billToBankName'
    | 'billToSwift';

export type InvoiceLegalServiceLineOverride = {
    description?: string | null;
    amountFormatted?: string | null;
};

export type InvoiceLegalPageOverrides = {
    caseDetailLine?: string | null;
    serviceDescriptionLine?: string | null;
    /** Multiple legal-page service rows (custom billed amount). */
    serviceLines?: InvoiceLegalServiceLineOverride[] | null;
    paymentDisclaimer?: string | null;
    /** Closing line under the totals, e.g. «Благодарим за сотрудничество!». */
    thanksLine?: string | null;
    invoiceNumber?: string | null;
    issueDateDisplay?: string | null;
    dueDateDisplay?: string | null;
    vatAmount?: string | null;
    extraExpensesAmount?: string | null;
    firmAddress?: string | null;
    recipientName?: string | null;
    legalAddress?: string | null;
    tin?: string | null;
    oked?: string | null;
    bankName?: string | null;
    bankAddress?: string | null;
    /** Currency shown in AC / Corr. ACC labels; usually from the selected firm banking profile. */
    accountCurrency?: string | null;
    accountNumber?: string | null;
    bankCode?: string | null;
    swift?: string | null;
    correspondentBank?: string | null;
    correspondentAccount?: string | null;
    correspondentBik?: string | null;
    billToBankName?: string | null;
    billToSwift?: string | null;
};

export type LegalBankingRow = {
    field: InvoiceLegalBankingFieldKey;
    label: string;
    value: string;
};

const BANKING_PLACEHOLDER = '—';

function resolveBankingValue(override?: string | null): string {
    const t = override?.trim();
    return t || BANKING_PLACEHOLDER;
}

export function isBankingPlaceholderValue(value: string | null | undefined): boolean {
    const t = (value ?? '').trim();
    return !t || t === BANKING_PLACEHOLDER || t === '-' || t === '–';
}

export function legalBankingInputValue(override?: string | null): string {
    return override ?? '';
}

export function resolveLegalAccountCurrencyCode(
    packCurrencyCode: string,
    overrides?: InvoiceLegalPageOverrides | null,
): string {
    const fromOverride = (overrides?.accountCurrency ?? '')
        .trim()
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase();
    if (fromOverride)
        return fromOverride;
    return (packCurrencyCode || 'EUR').toUpperCase() || 'EUR';
}

export function legalFirmBankingRows(
    currencyCode: string,
    overrides?: InvoiceLegalPageOverrides | null,
    lang?: InvoiceCoverLanguage | null,
    options?: { omitPlaceholders?: boolean },
): LegalBankingRow[] {
    const cur = resolveLegalAccountCurrencyCode(currencyCode, overrides);
    const labels = getLegalInvoiceLabels(lang);
    // Order matches extended RUB requisites: beneficiary → legal address → TIN/OKED →
    // correspondent block → beneficiary bank → account/SWIFT.
    const rows: LegalBankingRow[] = [
        { field: 'recipientName', label: labels.recipientName, value: resolveBankingValue(overrides?.recipientName) },
        { field: 'legalAddress', label: labels.legalAddress, value: resolveBankingValue(overrides?.legalAddress) },
        { field: 'tin', label: labels.tin, value: resolveBankingValue(overrides?.tin) },
        { field: 'oked', label: labels.oked, value: resolveBankingValue(overrides?.oked) },
        { field: 'correspondentBank', label: labels.correspondentBank, value: resolveBankingValue(overrides?.correspondentBank) },
        { field: 'correspondentAccount', label: labels.correspondentAccount(cur), value: resolveBankingValue(overrides?.correspondentAccount) },
        { field: 'correspondentBik', label: labels.correspondentBik, value: resolveBankingValue(overrides?.correspondentBik) },
        { field: 'bankName', label: labels.bankName, value: resolveBankingValue(overrides?.bankName) },
        { field: 'bankAddress', label: labels.bankAddress, value: resolveBankingValue(overrides?.bankAddress) },
        { field: 'bankCode', label: labels.bankCode, value: resolveBankingValue(overrides?.bankCode) },
        { field: 'accountNumber', label: labels.accountNumber(cur), value: resolveBankingValue(overrides?.accountNumber) },
        { field: 'swift', label: labels.swift, value: resolveBankingValue(overrides?.swift) },
    ];
    if (!options?.omitPlaceholders)
        return rows;
    return rows.filter((row) => !isBankingPlaceholderValue(row.value));
}

export function resolveLegalFirmBankingLines(
    currencyCode: string,
    overrides?: InvoiceLegalPageOverrides | null,
    lang?: InvoiceCoverLanguage | null,
): string[] {
    return legalFirmBankingRows(currencyCode, overrides, lang, { omitPlaceholders: true })
        .map((row) => `${row.label}: ${row.value}`);
}

export function resolveLegalBillToBankName(overrides?: InvoiceLegalPageOverrides | null): string {
    return resolveBankingValue(overrides?.billToBankName);
}

export function resolveLegalBillToSwift(overrides?: InvoiceLegalPageOverrides | null): string {
    return resolveBankingValue(overrides?.billToSwift);
}

export function resolveLegalOverrideText(
    override: string | null | undefined,
    fallback: string,
): string {
    const t = override?.trim();
    return t || fallback;
}

/**
 * EXTRA EXPENSES stays at zero unless the user typed a different amount.
 * A saved value that is only the fixed fee (written when the fee was applied) is ignored.
 */
export function resolveLegalExtraExpensesAmount(
    override: string | null | undefined,
    fixedFeeFormatted: string | null | undefined,
    zeroFallback: string,
): string {
    const saved = override?.trim() ?? '';
    if (!saved)
        return zeroFallback;
    const fee = fixedFeeFormatted?.trim() ?? '';
    if (!fee)
        return saved;
    if (saved === fee)
        return zeroFallback;
    const savedAmt = parseCoverLetterMoneyAmount(saved);
    const feeAmt = parseCoverLetterMoneyAmount(fee);
    if (savedAmt != null && feeAmt != null && Math.abs(savedAmt - feeAmt) < 0.005)
        return zeroFallback;
    return saved;
}

export function resolveLegalCaseDetailLine(
    session: InvoicePreviewSessionV1 | null,
    overrides?: InvoiceLegalPageOverrides | null,
    lang?: InvoiceCoverLanguage | null,
): string {
    const custom = overrides?.caseDetailLine?.trim();
    if (custom)
        return custom;
    return session?.meta.projectLabel?.trim() || getLegalInvoiceLabels(lang).legalServicesFallback;
}

export function resolveLegalServiceDescriptionLine(
    model: InvoiceCoverLetterModel,
    overrides?: InvoiceLegalPageOverrides | null,
): string {
    return resolveLocalizedLegalServiceDescription(model, overrides?.serviceDescriptionLine);
}

export type LegalServiceLineResolved = {
    description: string;
    amountFormatted: string;
};

/** Prefer multi-line overrides; fall back to the single description + services amount. */
export function resolveLegalServiceLines(
    model: InvoiceCoverLetterModel,
    overrides?: InvoiceLegalPageOverrides | null,
): LegalServiceLineResolved[] {
    const raw = overrides?.serviceLines;
    if (Array.isArray(raw) && raw.length > 0) {
        const rows = raw
            .map((ln) => ({
                description: String(ln?.description ?? '').trim(),
                amountFormatted: String(ln?.amountFormatted ?? '').trim(),
            }))
            .filter((ln) => ln.description || ln.amountFormatted);
        if (rows.length > 0)
            return rows;
    }
    return [{
        description: resolveLegalServiceDescriptionLine(model, overrides),
        amountFormatted: model.servicesAmountFormatted?.trim() || model.totalFormatted,
    }];
}

export function resolveLegalPaymentDisclaimer(
    overrides?: InvoiceLegalPageOverrides | null,
    lang?: InvoiceCoverLanguage | null,
): string {
    return resolveLocalizedLegalPaymentDisclaimer(lang, overrides?.paymentDisclaimer);
}

export function resolveLegalThanksLine(
    overrides?: InvoiceLegalPageOverrides | null,
    lang?: InvoiceCoverLanguage | null,
): string {
    return resolveLocalizedLegalThanks(lang, overrides?.thanksLine);
}

export function invoicePreviewPageCount(timeReportChunkCount: number): number {
    return 2 + timeReportChunkCount;
}
