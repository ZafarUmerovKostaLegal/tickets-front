import { getLegalInvoiceLabels, resolveLocalizedLegalPaymentDisclaimer, resolveLocalizedLegalServiceDescription, } from './invoiceLegalPageI18n';
const BANKING_PLACEHOLDER = '—';
function resolveBankingValue(override) {
    const t = override?.trim();
    return t || BANKING_PLACEHOLDER;
}
export function isBankingPlaceholderValue(value) {
    const t = (value ?? '').trim();
    return !t || t === BANKING_PLACEHOLDER || t === '-' || t === '–';
}
export function legalBankingInputValue(override) {
    return override ?? '';
}
export function resolveLegalAccountCurrencyCode(packCurrencyCode, overrides) {
    const fromOverride = (overrides?.accountCurrency ?? '')
        .trim()
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase();
    if (fromOverride)
        return fromOverride;
    return (packCurrencyCode || 'EUR').toUpperCase() || 'EUR';
}
export function legalFirmBankingRows(currencyCode, overrides, lang, options) {
    const cur = resolveLegalAccountCurrencyCode(currencyCode, overrides);
    const labels = getLegalInvoiceLabels(lang);
    const rows = [
        { field: 'tin', label: labels.tin, value: resolveBankingValue(overrides?.tin) },
        { field: 'bankName', label: labels.bankName, value: resolveBankingValue(overrides?.bankName) },
        { field: 'bankAddress', label: labels.bankAddress, value: resolveBankingValue(overrides?.bankAddress) },
        { field: 'accountNumber', label: labels.accountNumber(cur), value: resolveBankingValue(overrides?.accountNumber) },
        { field: 'bankCode', label: labels.bankCode, value: resolveBankingValue(overrides?.bankCode) },
        { field: 'swift', label: labels.swift, value: resolveBankingValue(overrides?.swift) },
        { field: 'correspondentBank', label: labels.correspondentBank, value: resolveBankingValue(overrides?.correspondentBank) },
        { field: 'correspondentAccount', label: labels.correspondentAccount(cur), value: resolveBankingValue(overrides?.correspondentAccount) },
    ];
    if (!options?.omitPlaceholders)
        return rows;
    return rows.filter((row) => !isBankingPlaceholderValue(row.value));
}
export function resolveLegalFirmBankingLines(currencyCode, overrides, lang) {
    return legalFirmBankingRows(currencyCode, overrides, lang, { omitPlaceholders: true })
        .map((row) => `${row.label}: ${row.value}`);
}
export function resolveLegalBillToBankName(overrides) {
    return resolveBankingValue(overrides?.billToBankName);
}
export function resolveLegalBillToSwift(overrides) {
    return resolveBankingValue(overrides?.billToSwift);
}
export function resolveLegalOverrideText(override, fallback) {
    const t = override?.trim();
    return t || fallback;
}
export function resolveLegalCaseDetailLine(session, overrides, lang) {
    const custom = overrides?.caseDetailLine?.trim();
    if (custom)
        return custom;
    return session?.meta.projectLabel?.trim() || getLegalInvoiceLabels(lang).legalServicesFallback;
}
export function resolveLegalServiceDescriptionLine(model, overrides) {
    return resolveLocalizedLegalServiceDescription(model, overrides?.serviceDescriptionLine);
}
export function resolveLegalPaymentDisclaimer(overrides, lang) {
    return resolveLocalizedLegalPaymentDisclaimer(lang, overrides?.paymentDisclaimer);
}
export function invoicePreviewPageCount(timeReportChunkCount) {
    return 2 + timeReportChunkCount;
}
