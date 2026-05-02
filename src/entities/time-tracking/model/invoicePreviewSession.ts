export const INVOICE_PREVIEW_SESSION_KEY = 'tt-invoice-preview-session-v1';

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

export type InvoicePreviewSessionV1 = {
    v: 1;
    form: InvoicePreviewFormDraftV1;
    meta: {
        clientLabel?: string;
        projectLabel?: string;
    };
};

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
        if (rec.v !== 1 || !isFormDraft(rec.form))
            return null;
        const metaRaw = rec.meta;
        const meta: InvoicePreviewSessionV1['meta'] = {};
        if (metaRaw && typeof metaRaw === 'object') {
            const m = metaRaw as Record<string, unknown>;
            if (typeof m.clientLabel === 'string' && m.clientLabel.trim())
                meta.clientLabel = m.clientLabel.trim();
            if (typeof m.projectLabel === 'string' && m.projectLabel.trim())
                meta.projectLabel = m.projectLabel.trim();
        }
        return { v: 1, form: rec.form, meta };
    }
    catch {
        return null;
    }
}
