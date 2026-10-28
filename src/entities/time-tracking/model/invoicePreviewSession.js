export const INVOICE_PREVIEW_SESSION_KEY = 'tt-invoice-preview-session-v1';
export const OPEN_INVOICE_DETAIL_QUERY = 'open_invoice';
function isFormDraft(o) {
    if (!o || typeof o !== 'object')
        return false;
    const r = o;
    const selTime = r.selTime;
    const selExp = r.selExp;
    return typeof r.createClientId === 'string'
        && typeof r.createProjectId === 'string'
        && typeof r.unbilledFrom === 'string'
        && typeof r.unbilledTo === 'string'
        && typeof r.issueDate === 'string'
        && typeof r.dueDate === 'string'
        && Array.isArray(selTime) && selTime.every((x) => typeof x === 'string')
        && Array.isArray(selExp) && selExp.every((x) => typeof x === 'string')
        && (r.invoiceNumber === undefined || typeof r.invoiceNumber === 'string');
}
function parseMeta(raw) {
    const meta = {};
    if (!raw || typeof raw !== 'object')
        return meta;
    const m = raw;
    if (typeof m.clientLabel === 'string' && m.clientLabel.trim())
        meta.clientLabel = m.clientLabel.trim();
    if (typeof m.projectLabel === 'string' && m.projectLabel.trim())
        meta.projectLabel = m.projectLabel.trim();
    if (typeof m.invoiceNumber === 'string' && m.invoiceNumber.trim())
        meta.invoiceNumber = m.invoiceNumber.trim();
    if (typeof m.issueDateIso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(m.issueDateIso))
        meta.issueDateIso = m.issueDateIso.slice(0, 10);
    if (typeof m.dueDateIso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(m.dueDateIso))
        meta.dueDateIso = m.dueDateIso.slice(0, 10);
    if (typeof m.billingPeriodFrom === 'string' && /^\d{4}-\d{2}-\d{2}/.test(m.billingPeriodFrom))
        meta.billingPeriodFrom = m.billingPeriodFrom.slice(0, 10);
    if (typeof m.billingPeriodTo === 'string' && /^\d{4}-\d{2}-\d{2}/.test(m.billingPeriodTo))
        meta.billingPeriodTo = m.billingPeriodTo.slice(0, 10);
    return meta;
}
function parseDocumentOverrides(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return undefined;
    return raw;
}
export function writeInvoicePreviewSession(payload) {
    try {
        sessionStorage.setItem(INVOICE_PREVIEW_SESSION_KEY, JSON.stringify(payload));
    }
    catch {
    }
}
export function readInvoicePreviewSession() {
    try {
        const raw = sessionStorage.getItem(INVOICE_PREVIEW_SESSION_KEY);
        if (!raw)
            return null;
        const o = JSON.parse(raw);
        if (!o || typeof o !== 'object')
            return null;
        const rec = o;
        if (rec.v !== 1)
            return null;
        const meta = parseMeta(rec.meta);
        const documentOverrides = parseDocumentOverrides(rec.documentOverrides);
        if (rec.mode === 'existing') {
            const invoiceId = typeof rec.invoiceId === 'string' ? rec.invoiceId.trim() : '';
            if (!invoiceId)
                return null;
            return {
                v: 1,
                mode: 'existing',
                invoiceId,
                meta,
                ...(documentOverrides ? { documentOverrides } : {}),
            };
        }
        if (!isFormDraft(rec.form))
            return null;
        return {
            v: 1,
            mode: 'create',
            form: rec.form,
            meta,
            ...(documentOverrides ? { documentOverrides } : {}),
        };
    }
    catch {
        return null;
    }
}
export function isInvoicePreviewSessionCreate(s) {
    return s != null && s.mode === 'create';
}
