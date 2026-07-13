import type { InvoicePreviewSessionV1 } from '@entities/time-tracking/model/invoicePreviewSession';
import { INVOICE_PAYMENT_DISCLAIMER, packCaseDetailLine } from './invoicePreviewPackShared';
import type { InvoiceCoverLetterModel } from './invoiceCoverLetterModel';

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
): LegalBankingRow[] {
    const cur = (currencyCode || 'EUR').toUpperCase();
    return [
        { field: 'tin', label: 'TIN', value: resolveBankingValue(overrides?.tin) },
        { field: 'bankName', label: 'Bank name', value: resolveBankingValue(overrides?.bankName) },
        { field: 'bankAddress', label: 'Bank address', value: resolveBankingValue(overrides?.bankAddress) },
        { field: 'accountNumber', label: `AC (${cur})`, value: resolveBankingValue(overrides?.accountNumber) },
        { field: 'bankCode', label: 'Bank code', value: resolveBankingValue(overrides?.bankCode) },
        { field: 'swift', label: 'SWIFT', value: resolveBankingValue(overrides?.swift) },
        { field: 'correspondentBank', label: 'Correspondent bank', value: resolveBankingValue(overrides?.correspondentBank) },
        { field: 'correspondentAccount', label: `Corr. ACC (${cur})`, value: resolveBankingValue(overrides?.correspondentAccount) },
    ];
}

export function resolveLegalFirmBankingLines(
    currencyCode: string,
    overrides?: InvoiceLegalPageOverrides | null,
): string[] {
    return legalFirmBankingRows(currencyCode, overrides).map((row) => `${row.label}: ${row.value}`);
}

export function resolveLegalBillToBankName(overrides?: InvoiceLegalPageOverrides | null): string {
    return resolveBankingValue(overrides?.billToBankName);
}

export function resolveLegalBillToSwift(overrides?: InvoiceLegalPageOverrides | null): string {
    return resolveBankingValue(overrides?.billToSwift);
}

export function resolveLegalCaseDetailLine(
    session: InvoicePreviewSessionV1 | null,
    overrides?: InvoiceLegalPageOverrides | null,
): string {
    const custom = overrides?.caseDetailLine?.trim();
    if (custom)
        return custom;
    return packCaseDetailLine(session);
}

export function resolveLegalServiceDescriptionLine(
    model: InvoiceCoverLetterModel,
    overrides?: InvoiceLegalPageOverrides | null,
): string {
    const custom = overrides?.serviceDescriptionLine?.trim();
    if (custom)
        return custom;
    return `Legal services rendered in ${model.servicesMonthYear}`;
}

export function resolveLegalPaymentDisclaimer(
    overrides?: InvoiceLegalPageOverrides | null,
): string {
    const custom = overrides?.paymentDisclaimer?.trim();
    if (custom)
        return custom;
    return INVOICE_PAYMENT_DISCLAIMER;
}

export function invoicePreviewPageCount(timeReportChunkCount: number): number {
    return 2 + timeReportChunkCount;
}
