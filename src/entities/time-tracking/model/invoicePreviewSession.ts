export const INVOICE_PREVIEW_SESSION_KEY = 'tt-invoice-preview-session-v1';

export const OPEN_INVOICE_DETAIL_QUERY = 'open_invoice';

export type InvoicePreviewFormDraftV1 = {
    createClientId: string;
    createProjectId: string;
    unbilledFrom: string;
    unbilledTo: string;
    issueDate: string;
    dueDate: string;
    selTime: string[];
    selExp: string[];
};

export type InvoicePreviewMeta = {
    clientLabel?: string;
    projectLabel?: string;
    invoiceNumber?: string;
    /** ISO YYYY-MM-DD для имени файла */
    issueDateIso?: string;
};

/** Новый счёт из формы создания */
export type InvoicePreviewSessionCreateV1 = {
    v: 1;
    mode: 'create';
    form: InvoicePreviewFormDraftV1;
    meta: InvoicePreviewMeta;
};

/** Уже сохранённый счёт из карточки */
export type InvoicePreviewSessionExistingV1 = {
    v: 1;
    mode: 'existing';
    invoiceId: string;
    meta: InvoicePreviewMeta;
};

export type InvoicePreviewSessionV1 = InvoicePreviewSessionCreateV1 | InvoicePreviewSessionExistingV1;

function isFormDraft(o: unknown): o is InvoicePreviewFormDraftV1 {
    if (!o || typeof o !== 'object')
        return false;
    const r = o as Record<string, unknown>;
    const selTime = r.selTime;
    const selExp = r.selExp;
    return typeof r.createClientId === 'string'
        && typeof r.createProjectId === 'string'
        && typeof r.unbilledFrom === 'string'
        && typeof r.unbilledTo === 'string'
        && typeof r.issueDate === 'string'
        && typeof r.dueDate === 'string'
        && Array.isArray(selTime) && selTime.every((x) => typeof x === 'string')
        && Array.isArray(selExp) && selExp.every((x) => typeof x === 'string');
}

function parseMeta(raw: unknown): InvoicePreviewMeta {
    const meta: InvoicePreviewMeta = {};
    if (!raw || typeof raw !== 'object')
        return meta;
    const m = raw as Record<string, unknown>;
    if (typeof m.clientLabel === 'string' && m.clientLabel.trim())
        meta.clientLabel = m.clientLabel.trim();
    if (typeof m.projectLabel === 'string' && m.projectLabel.trim())
        meta.projectLabel = m.projectLabel.trim();
    if (typeof m.invoiceNumber === 'string' && m.invoiceNumber.trim())
        meta.invoiceNumber = m.invoiceNumber.trim();
    if (typeof m.issueDateIso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(m.issueDateIso))
        meta.issueDateIso = m.issueDateIso.slice(0, 10);
    return meta;
}

export function writeInvoicePreviewSession(payload: InvoicePreviewSessionV1): void {
    try {
        sessionStorage.setItem(INVOICE_PREVIEW_SESSION_KEY, JSON.stringify(payload));
    }
    catch {
    }
}

export function readInvoicePreviewSession(): InvoicePreviewSessionV1 | null {
    try {
        const raw = sessionStorage.getItem(INVOICE_PREVIEW_SESSION_KEY);
        if (!raw)
            return null;
        const o = JSON.parse(raw) as unknown;
        if (!o || typeof o !== 'object')
            return null;
        const rec = o as Record<string, unknown>;
        if (rec.v !== 1)
            return null;
        const meta = parseMeta(rec.meta);
        if (rec.mode === 'existing') {
            const invoiceId = typeof rec.invoiceId === 'string' ? rec.invoiceId.trim() : '';
            if (!invoiceId)
                return null;
            return { v: 1, mode: 'existing', invoiceId, meta };
        }
        if (!isFormDraft(rec.form))
            return null;
        return { v: 1, mode: 'create', form: rec.form, meta };
    }
    catch {
        return null;
    }
}

export function isInvoicePreviewSessionCreate(s: InvoicePreviewSessionV1 | null): s is InvoicePreviewSessionCreateV1 {
    return s != null && s.mode === 'create';
}
