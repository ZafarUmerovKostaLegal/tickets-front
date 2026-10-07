import { resolveLegalFirmBankingLines } from './invoiceLegalPageModel';
export const TIME_REPORT_DETAIL_ROWS = 14;
export const TIME_REPORT_SUMMARY_ROWS = 5;
function isoToday() {
    return new Date().toISOString().slice(0, 10);
}
export function packResolveIssueIso(session) {
    if (!session)
        return isoToday();
    if (session.mode === 'existing')
        return session.meta.issueDateIso?.slice(0, 10) ?? isoToday();
    return session.form.issueDate.slice(0, 10);
}
/** Billing period month anchor (prefer period end); falls back to issue date. */
export function packResolveBillingPeriodIso(session, model) {
    const fromModel = String(model?.billingPeriodIso ?? '').trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromModel))
        return fromModel;
    const issue = packResolveIssueIso(session);
    if (!session)
        return issue;
    if (session.mode === 'create') {
        const to = session.form.unbilledTo?.trim().slice(0, 10);
        const from = session.form.unbilledFrom?.trim().slice(0, 10);
        if (to && /^\d{4}-\d{2}-\d{2}$/.test(to))
            return to;
        if (from && /^\d{4}-\d{2}-\d{2}$/.test(from))
            return from;
        return issue;
    }
    const to = session.meta.billingPeriodTo?.trim().slice(0, 10);
    const from = session.meta.billingPeriodFrom?.trim().slice(0, 10);
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to))
        return to;
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from))
        return from;
    return issue;
}
export function packResolveDueIso(session, issueIso) {
    if (session?.mode === 'create')
        return session.form.dueDate.slice(0, 10);
    const metaDue = session?.meta?.dueDateIso?.slice(0, 10);
    if (metaDue && /^\d{4}-\d{2}-\d{2}$/.test(metaDue))
        return metaDue;
    return issueIso;
}
export { formatLegalRibbonDate as packUppercaseRibbonDate } from './invoiceLegalPageI18n';
export { formatLegalRibbonPeriodMonth as packUppercaseRibbonPeriodMonth } from './invoiceLegalPageI18n';
export function packInvoiceNumberDisplay(session) {
    const n = session?.meta.invoiceNumber?.trim();
    return n ?? 'KL-XXXX-00/00';
}
export function packCurrencyCode(model) {
    const t = model.totalFormatted.trim().split(/\s+/)[0];
    return t?.replace(/[^A-Za-z]/g, '').toUpperCase() || 'EUR';
}
export function packZeroCommaAmount(model) {
    return `${packCurrencyCode(model)} 0.00`;
}
export function packCaseDetailLine(session, fallback = 'Legal services') {
    return session?.meta.projectLabel?.trim() || fallback;
}
export function packFirmBankingLines(currencyCode) {
    return resolveLegalFirmBankingLines(currencyCode, null);
}
