import { apiFetch } from '@shared/api';
import {
    normalizeCorrespondenceDocument,
    normalizeCorrespondenceStats,
} from './lib/normalize';
import type {
    CorrespondenceDocument,
    CorrespondenceListResponse,
    CorrespondenceStats,
    CreateOutgoingDraftBody,
    ListCorrespondenceParams,
    PatchCorrespondenceBody,
    RegisterIncomingBody,
    RegisterOutgoingBody,
} from './model/types';

const PREFIX = '/api/v1/correspondence';

export class CorrespondenceHttpError extends Error {
    readonly status: number;
    readonly hint?: string;

    constructor(status: number, message: string, hint?: string) {
        super(message);
        this.name = 'CorrespondenceHttpError';
        this.status = status;
        this.hint = hint;
    }
}

export function isCorrespondenceHttpError(e: unknown, status?: number): e is CorrespondenceHttpError {
    return e instanceof CorrespondenceHttpError && (status === undefined || e.status === status);
}

export function correspondenceErrorMessage(err: unknown, fallback: string): string {
    if (isCorrespondenceHttpError(err)) {
        if (err.hint)
            return `${err.message}\n\n${err.hint}`;
        return err.message;
    }
    return err instanceof Error ? err.message : fallback;
}

async function throwIfNotOk(res: Response): Promise<Response> {
    if (res.ok)
        return res;
    let msg = `HTTP ${res.status}`;
    let hint: string | undefined;
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed) {
        try {
            const j = JSON.parse(text) as { detail?: unknown; message?: unknown; hint?: unknown };
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

function buildListQuery(params: ListCorrespondenceParams = {}): string {
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
    const s = qs.toString();
    return s ? `?${s}` : '';
}

export async function listCorrespondence(params: ListCorrespondenceParams = {}, signal?: AbortSignal): Promise<CorrespondenceListResponse> {
    const res = await apiFetch(`${PREFIX}/${buildListQuery(params)}`, { signal });
    await throwIfNotOk(res);
    const raw = await res.json() as {
        items?: unknown[];
        total?: number;
        skip?: number;
        limit?: number;
    };
    const items = Array.isArray(raw.items)
        ? raw.items.map(normalizeCorrespondenceDocument).filter((x): x is CorrespondenceDocument => x != null)
        : [];
    return {
        items,
        total: typeof raw.total === 'number' ? raw.total : items.length,
        skip: typeof raw.skip === 'number' ? raw.skip : params.skip ?? 0,
        limit: typeof raw.limit === 'number' ? raw.limit : params.limit ?? 8,
    };
}

export async function fetchCorrespondenceStats(signal?: AbortSignal): Promise<CorrespondenceStats> {
    const res = await apiFetch(`${PREFIX}/stats`, { signal });
    await throwIfNotOk(res);
    return normalizeCorrespondenceStats(await res.json());
}

export async function fetchCorrespondenceDocument(id: string): Promise<CorrespondenceDocument> {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(id)}`);
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}

export async function registerIncomingCorrespondence(body: RegisterIncomingBody): Promise<CorrespondenceDocument> {
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

export async function registerOutgoingCorrespondence(body: RegisterOutgoingBody): Promise<CorrespondenceDocument> {
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

export async function createOutgoingDraft(body: CreateOutgoingDraftBody): Promise<CorrespondenceDocument> {
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

export async function submitOutgoingForReview(id: string, partnerUserId: number): Promise<CorrespondenceDocument> {
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

export async function approveOutgoingCorrespondence(id: string): Promise<CorrespondenceDocument> {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(id)}/approve`, { method: 'POST' });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}

export async function rejectOutgoingCorrespondence(id: string, comment: string): Promise<CorrespondenceDocument> {
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

export async function patchCorrespondence(id: string, body: PatchCorrespondenceBody): Promise<CorrespondenceDocument> {
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

export async function archiveCorrespondence(id: string): Promise<CorrespondenceDocument> {
    const res = await apiFetch(`${PREFIX}/${encodeURIComponent(id)}/archive`, { method: 'POST' });
    await throwIfNotOk(res);
    const doc = normalizeCorrespondenceDocument(await res.json());
    if (!doc)
        throw new CorrespondenceHttpError(500, 'Некорректный ответ сервера');
    return doc;
}

export async function fetchCorrespondenceAttachmentBlob(
    documentId: string,
    attachmentId: string,
): Promise<{ blob: Blob; contentType: string | null }> {
    const res = await apiFetch(
        `${PREFIX}/${encodeURIComponent(documentId)}/attachments/${encodeURIComponent(attachmentId)}/file`,
    );
    await throwIfNotOk(res);
    return {
        blob: await res.blob(),
        contentType: res.headers.get('Content-Type'),
    };
}

export async function openCorrespondenceAttachmentInNewTab(documentId: string, attachmentId: string): Promise<void> {
    const { blob } = await fetchCorrespondenceAttachmentBlob(documentId, attachmentId);
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
        URL.revokeObjectURL(url);
        throw new Error('Браузер заблокировал новую вкладку. Разрешите всплывающие окна для этого сайта.');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
}
