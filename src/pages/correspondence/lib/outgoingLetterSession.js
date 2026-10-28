export const OUTGOING_LETTER_SESSION_KEY = 'corr-outgoing-letter-draft-v1';
function isDraftComment(raw) {
    if (!raw || typeof raw !== 'object')
        return false;
    const c = raw;
    return typeof c.id === 'string'
        && typeof c.quote === 'string'
        && typeof c.body === 'string'
        && typeof c.authorName === 'string'
        && typeof c.createdAt === 'string'
        && typeof c.resolved === 'boolean'
        && (c.authorUserId === null || typeof c.authorUserId === 'number');
}
function parseDraftComments(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.filter(isDraftComment).map((c) => ({
        id: c.id,
        quote: c.quote,
        body: c.body,
        authorName: c.authorName,
        authorUserId: c.authorUserId ?? null,
        createdAt: c.createdAt,
        resolved: Boolean(c.resolved),
        selectionJson: typeof c.selectionJson === 'string' ? c.selectionJson : null,
    }));
}
export function newOutgoingLetterCommentId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        return `cmt_${crypto.randomUUID()}`;
    return `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
const filesBySessionId = new Map();
function newSessionId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        return crypto.randomUUID();
    return `ol_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function isCoverModel(raw) {
    if (!raw || typeof raw !== 'object')
        return false;
    const m = raw;
    return typeof m.recipientCompany === 'string'
        && typeof m.issueDateIso === 'string'
        && typeof m.letterDateDisplay === 'string'
        && typeof m.attentionName === 'string'
        && Array.isArray(m.recipientAddressLines);
}
export function formatAttachmentSizeLabel(size) {
    if (size > 1048576)
        return `${(size / 1048576).toFixed(1)} МБ`;
    return `${Math.max(1, Math.round(size / 1024))} КБ`;
}
export function writeOutgoingLetterDraft(input) {
    const sessionId = (input.sessionId || '').trim() || newSessionId();
    const attachmentMeta = input.attachmentMeta
        ?? input.files.map((f, i) => ({
            id: `att_${i}_${f.name}`,
            name: f.name,
            sizeLabel: formatAttachmentSizeLabel(f.size),
        }));
    const draft = {
        v: 1,
        sessionId,
        subject: input.subject.trim(),
        letterDateIso: input.letterDateIso.slice(0, 10),
        coverModel: input.coverModel,
        attachmentMeta,
        comments: input.comments ?? [],
        serverDocumentId: input.serverDocumentId?.trim() || null,
    };
    filesBySessionId.set(sessionId, [...input.files]);
    try {
        sessionStorage.setItem(OUTGOING_LETTER_SESSION_KEY, JSON.stringify(draft));
    }
    catch {
    }
    return sessionId;
}
export function readOutgoingLetterDraft() {
    try {
        const raw = sessionStorage.getItem(OUTGOING_LETTER_SESSION_KEY);
        if (!raw)
            return null;
        const o = JSON.parse(raw);
        if (!o || typeof o !== 'object')
            return null;
        const rec = o;
        if (rec.v !== 1)
            return null;
        const sessionId = typeof rec.sessionId === 'string' ? rec.sessionId.trim() : '';
        const subject = typeof rec.subject === 'string' ? rec.subject : '';
        const letterDateIso = typeof rec.letterDateIso === 'string' ? rec.letterDateIso.slice(0, 10) : '';
        if (!sessionId || !/^\d{4}-\d{2}-\d{2}$/.test(letterDateIso) || !isCoverModel(rec.coverModel))
            return null;
        const attachmentMeta = Array.isArray(rec.attachmentMeta)
            ? rec.attachmentMeta.filter((a) => a && typeof a.id === 'string' && typeof a.name === 'string')
            : [];
        const serverDocumentId = typeof rec.serverDocumentId === 'string' && /^[0-9a-f-]{36}$/i.test(rec.serverDocumentId.trim())
            ? rec.serverDocumentId.trim()
            : null;
        return {
            v: 1,
            sessionId,
            subject,
            letterDateIso,
            coverModel: rec.coverModel,
            attachmentMeta,
            comments: parseDraftComments(rec.comments),
            serverDocumentId,
        };
    }
    catch {
        return null;
    }
}
export function getOutgoingLetterDraftFiles(sessionId) {
    return [...(filesBySessionId.get(sessionId) ?? [])];
}
export function setOutgoingLetterDraftFiles(sessionId, files) {
    filesBySessionId.set(sessionId, [...files]);
}
export function clearOutgoingLetterDraft() {
    try {
        const raw = sessionStorage.getItem(OUTGOING_LETTER_SESSION_KEY);
        if (raw) {
            const o = JSON.parse(raw);
            if (o?.sessionId)
                filesBySessionId.delete(o.sessionId);
        }
    }
    catch {
    }
    try {
        sessionStorage.removeItem(OUTGOING_LETTER_SESSION_KEY);
    }
    catch {
    }
}
export function resolveOutgoingCounterparty(coverModel) {
    return (coverModel.recipientCompany || '').trim();
}
export function isOutgoingLetterDraftValid(subject, coverModel) {
    if (!subject.trim())
        return { ok: false, message: 'Укажите тему письма.' };
    const counterparty = resolveOutgoingCounterparty(coverModel);
    if (!counterparty || counterparty === 'Company Name')
        return { ok: false, message: 'Укажите получателя.' };
    return { ok: true };
}
