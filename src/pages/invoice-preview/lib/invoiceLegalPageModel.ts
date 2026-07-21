import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import type { InvoiceCoverLetterModel } from './invoiceCoverLetterModel';
import {
    getLegalInvoiceLabels,
    resolveLocalizedLegalPaymentDisclaimer,
    resolveLocalizedLegalServiceDescription,
} from './invoiceLegalPageI18n';
import type { InvoiceCoverLanguage } from './invoiceCoverLetterI18n';

export type InvoiceLegalBankingFieldKey =
    | 'tin'
    | 'bankName'
    | 'bankAddress'
    | 'accountNumber'
    | 'bankCode'
    | 'swift'
    | 'correspondentBank'
    | 'correspondentAccount'
    | 'billToBankName'
    | 'billToSwift';

export type InvoiceLegalPageOverrides = {
    caseDetailLine?: string | null;
    serviceDescriptionLine?: string | null;
    paymentDisclaimer?: string | null;
    invoiceNumber?: string | null;
    issueDateDisplay?: string | null;
    dueDateDisplay?: string | null;
    vatAmount?: string | null;
    extraExpensesAmount?: string | null;
    firmAddress?: string | null;
    tin?: string | null;
    bankName?: string | null;
    bankAddress?: string | null;
    accountNumber?: string | null;
    bankCode?: string | null;
    swift?: string | null;
    correspondentBank?: string | null;
    correspondentAccount?: string | null;
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

export function legalBankingInputValue(override?: string | null): string {
    return override ?? '';
}

export function legalFirmBankingRows(
    currencyCode: string,
    overrides?: InvoiceLegalPageOverrides | null,
    lang?: InvoiceCoverLanguage | null,
): LegalBankingRow[] {
    const cur = (currencyCode || 'EUR').toUpperCase();
    const labels = getLegalInvoiceLabels(lang);
    return [
        { field: 'tin', label: labels.tin, value: resolveBankingValue(overrides?.tin) },
        { field: 'bankName', label: labels.bankName, value: resolveBankingValue(overrides?.bankName) },
        { field: 'bankAddress', label: labels.bankAddress, value: resolveBankingValue(overrides?.bankAddress) },
        { field: 'accountNumber', label: labels.accountNumber(cur), value: resolveBankingValue(overrides?.accountNumber) },
        { field: 'bankCode', label: labels.bankCode, value: resolveBankingValue(overrides?.bankCode) },
        { field: 'swift', label: labels.swift, value: resolveBankingValue(overrides?.swift) },
        { field: 'correspondentBank', label: labels.correspondentBank, value: resolveBankingValue(overrides?.correspondentBank) },
        { field: 'correspondentAccount', label: labels.correspondentAccount(cur), value: resolveBankingValue(overrides?.correspondentAccount) },
    ];
}

export function resolveLegalFirmBankingLines(
    currencyCode: string,
    overrides?: InvoiceLegalPageOverrides | null,
    lang?: InvoiceCoverLanguage | null,
): string[] {
    return legalFirmBankingRows(currencyCode, overrides, lang).map((row) => `${row.label}: ${row.value}`);
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

export function resolveLegalPaymentDisclaimer(
    overrides?: InvoiceLegalPageOverrides | null,
    lang?: InvoiceCoverLanguage | null,
): string {
    return resolveLocalizedLegalPaymentDisclaimer(lang, overrides?.paymentDisclaimer);
}

export function invoicePreviewPageCount(timeReportChunkCount: number): number {
    return 2 + timeReportChunkCount;
}
