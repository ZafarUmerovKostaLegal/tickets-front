import { apiFetch } from '@shared/api';
import { getApiBaseUrl, upgradeUrlToPageSecurity } from '@shared/config';
import { normalizeCorrespondenceComment, normalizeCorrespondenceDocument, normalizeCorrespondenceStats, } from './lib/normalize';
const PREFIX = '/api/v1/correspondence';
/** Turn mint response url (absolute or relative) into a phone-scannable absolute URL. */
export function resolveCorrespondenceDownloadQrUrl(urlFromApi) {
    const raw = (urlFromApi || '').trim();
    if (!raw)
        return '';
    if (/^https?:\/\//i.test(raw))
        return upgradeUrlToPageSecurity(raw);
    const base = (getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
    if (!base)
        return raw.startsWith('/') ? raw : `/${raw}`;
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return upgradeUrlToPageSecurity(`${base}${path}`);
}
export class CorrespondenceHttpError extends Error {
    status;
    hint;
    constructor(status, message, hint) {
        super(message);
        this.name = 'CorrespondenceHttpError';
        this.status = status;
        this.hint = hint;
    }
}
export function isCorrespondenceHttpError(e, status) {
    return e instanceof CorrespondenceHttpError && (status === undefined || e.status === status);
}
export function correspondenceErrorMessage(err, fallback) {
    if (isCorrespondenceHttpError(err)) {
        if (err.hint)
            return `${err.message}\n\n${err.hint}`;
        return err.message;
    }
    return err instanceof Error ? err.message : fallback;
}
async function throwIfNotOk(res) {
    if (res.ok)
        return res;
    let msg = `HTTP ${res.status}`;
    let hint;
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed) {
        try {
            const j = JSON.parse(text);
            if (typeof j.hint === 'string' && j.hint.trim())
                hint = j.hint.trim();
            if (typeof j.detail === 'string' && j.detail.trim())
                msg = j.detail.trim();
            else if (typeof j.message === 'string' && j.message.trim())
                msg = j.message.trim();
            else
                msg = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed;
        }
        catch {
            msg = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed;
        }
    }
    if (res.status === 503 && !hint) {
        hint = 'Запустите на бэкенде: docker compose up -d gateway correspondence correspondence_db. Проверка: GET /health/correspondence';
    }
    throw new CorrespondenceHttpError(res.status, msg, hint);
}
function buildListQuery(params = {}) {
    const qs = new URLSearchParams();
    if (params.direction)
        qs.set('direction', params.direction);
    if (params.status)
        qs.set('status', params.status);
    if (params.statusGroup)
        qs.set('statusGroup', params.statusGroup);
    if (params.docType?.length)
        qs.set('docType', params.docType.join(','));
    if (params.q?.trim())
        qs.set('q', params.q.trim());
    if (params.skip != null)
        qs.set('skip', String(params.skip));
    if (params.limit != null)
        qs.set('limit', String(params.limit));
    if (params.includeArchived)
        qs.set('includeArchived', 'true');
    if (params.registeredOnly)
        qs.set('registeredOnly', 'true');
    if (params.partnerUserId != null && params.partnerUserId > 0)
        qs.set('partnerUserId', String(params.partnerUserId));
    if (params.responsibleUserId != null && params.responsibleUserId > 0)
        qs.set('responsibleUserId', String(params.responsibleUserId));
    if (params.dateFrom?.trim())
        qs.set('dateFrom', params.dateFrom.trim().slice(0, 10));
    if (params.dateTo?.trim())
        qs.set('dateTo', params.dateTo.trim().slice(0, 10));
    const s = qs.toString();
    return s ? `?${s}` : '';
}
export async function listCorrespondence(params = {}, signal) {
    const res = await apiFetch(`${PREFIX}/${buildListQuery(params)}`, { signal });
    await throwIfNotOk(res);
    const raw = await res.json();
    const items = Array.isArray(raw.items)
        ? raw.items.map(normalizeCorrespondenceDocument).filter((x) => x != null)
        : [];
    return {
        items,
        total: typeof raw.total === 'number' ? raw.total : items.length,
        skip: typeof raw.skip === 'number' ? raw.skip : params.skip ?? 0,
        limit: typeof raw.limit === 'number' ? raw.limit : params.limit ?? 8,
    };
}
export async function fetchCorrespondenceStats(signal) {
    const res = await apiFetch(`${PREFIX}/stats`, { signal });
    await throwIfNotOk(res);
    return normalizeCorrespondenceStats(await res.json());
}
export async function fetchCorrespondenceDocument(id) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(id)}`);
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}
export async function registerIncomingCorrespondence(body) {
    const form = new FormData();
    form.append('partnerUserId', String(body.partnerUserId));
    form.append('counterparty', body.counterparty);
    form.append('subject', body.subject);
    form.append('docType', body.docType);
    if (body.comment?.trim())
        form.append('comment', body.comment.trim());
    for (const file of body.scanFiles)
        form.append('files', file);
    const res = await apiFetch(`${PREFIX}/incoming`, { method: 'POST', body: form });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}
export async function registerOutgoingCorrespondence(body) {
    const form = new FormData();
    form.append('counterparty', body.counterparty);
    form.append('subject', body.subject);
    form.append('docType', body.docType);
    if (body.comment?.trim())
        form.append('comment', body.comment.trim());
    for (const file of body.attachmentFiles ?? [])
        form.append('files', file);
    const res = await apiFetch(`${PREFIX}/outgoing`, { method: 'POST', body: form });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}
export async function createOutgoingDraft(body) {
    const form = new FormData();
    form.append('counterparty', body.counterparty);
    form.append('subject', body.subject);
    form.append('docType', body.docType);
    if (body.comment?.trim())
        form.append('comment', body.comment.trim());
    if (body.partnerUserId != null && body.partnerUserId > 0)
        form.append('partnerUserId', String(body.partnerUserId));
    for (const file of body.attachmentFiles ?? [])
        form.append('files', file);
    const res = await apiFetch(`${PREFIX}/outgoing/draft`, { method: 'POST', body: form });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}
export async function submitOutgoingForReview(id, partnerUserId) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(id)}/submit-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerUserId }),
    });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}
export async function approveOutgoingCorrespondence(id) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(id)}/approve`, { method: 'POST' });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}
export async function acknowledgeIncomingCorrespondence(id) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(id)}/acknowledge`, { method: 'POST' });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}
export async function rejectOutgoingCorrespondence(id, comment) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
    });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}
export async function patchCorrespondence(id, body) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}
export async function archiveCorrespondence(id) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(id)}/archive`, { method: 'POST' });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}
export async function deleteCorrespondence(id) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}
export async function mintCorrespondenceDownloadQr(documentId, attachmentId) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(documentId)}/download-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attachmentId ? { attachmentId } : {}),
    });
    await throwIfNotOk(res);
    const raw = await res.json();
    const url = String(raw.url ?? '').trim();
    const expiresAt = Number(raw.expiresAt ?? raw.expires_at ?? 0);
    const aidRaw = raw.attachmentId ?? raw.attachment_id;
    const aid = typeof aidRaw === 'string' && aidRaw.trim() ? aidRaw.trim() : null;
    const did = String(raw.documentId ?? raw.document_id ?? documentId).trim();
    if (!url)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера (QR)');
    return {
        url: resolveCorrespondenceDownloadQrUrl(url),
        expiresAt,
        attachmentId: aid,
        documentId: did,
    };
}
export async function fetchCorrespondenceAttachmentBlob(documentId, attachmentId) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(documentId)}/attachments/${encodeURIComponent(attachmentId)}/file`);
    await throwIfNotOk(res);
    return {
        blob: await res.blob(),
        contentType: res.headers.get('Content-Type'),
    };
}
export async function fetchCorrespondenceAttachmentPreviewBlob(documentId, attachmentId) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(documentId)}/attachments/${encodeURIComponent(attachmentId)}/preview`);
    await throwIfNotOk(res);
    return {
        blob: await res.blob(),
        contentType: res.headers.get('Content-Type'),
    };
}
export async function listCorrespondenceComments(documentId, signal) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(documentId)}/comments`, { signal });
    await throwIfNotOk(res);
    const raw = await res.json();
    const items = Array.isArray(raw.items) ? raw.items : [];
    return items
        .map(normalizeCorrespondenceComment)
        .filter((x) => x != null);
}
export async function createCorrespondenceComment(documentId, body) {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(documentId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
    });
    await throwIfNotOk(res);
    const comment = normalizeCorrespondenceComment(await res.json());
    if (!comment)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return comment;
}
export async function openCorrespondenceAttachmentInNewTab(documentId, attachmentId) {
    const { blob } = await fetchCorrespondenceAttachmentBlob(documentId, attachmentId);
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
        URL.revokeObjectURL(url);
        throw new Error('Браузер заблокировал новую вкладку. Разрешите всплывающие окна для этого сайта.');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
}
export async function uploadCorrespondenceAttachment(documentId, file, attachmentKind = 'attachment') {
    const form = new FormData();
    form.append('file', file);
    form.append('attachmentKind', attachmentKind);
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(documentId)}/attachments`, {
        method: 'POST',
        body: form,
    });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}
export async function downloadCorrespondenceAttachment(documentId, attachmentId, fileName) {
    const { blob } = await fetchCorrespondenceAttachmentBlob(documentId, attachmentId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (fileName || 'document').trim() || 'document';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
