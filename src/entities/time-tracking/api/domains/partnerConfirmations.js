import { apiFetch } from '@shared/api';
import { invalidatePartnerReportConfirmationsPendingCache } from '../partnerReportConfirmationsPending';
import { TimeTrackingHttpError, reportsThrowIfNotOk, } from './httpShared';
export function normalizePartnerReviewPriority(raw) {
    const v = String(raw ?? '').trim().toLowerCase();
    if (v === 'red' || v === 'yellow' || v === 'green')
        return v;
    return 'yellow';
}
export function readPartnerConfirmNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
export function parsePartnerReportConfirmationSignature(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const partnerAuthUserId = readPartnerConfirmNum(o.partnerAuthUserId ?? o.partner_auth_user_id);
    const confirmedAt = String(o.confirmedAt ?? o.confirmed_at ?? '').trim();
    if (partnerAuthUserId == null || !confirmedAt)
        return null;
    return { partnerAuthUserId, confirmedAt };
}
export function parsePartnerConfirmedReportComment(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const id = String(o.id ?? '').trim();
    const authUserId = readPartnerConfirmNum(o.authUserId ?? o.auth_user_id ?? o.authorAuthUserId ?? o.author_auth_user_id ?? o.userId ?? o.user_id);
    const text = String(o.text ?? o.body ?? o.comment ?? o.message ?? '').trim();
    const createdAt = String(o.createdAt ?? o.created_at ?? o.created ?? '').trim();
    const updatedRaw = String(o.updatedAt ?? o.updated_at ?? '').trim();
    if (!id || authUserId == null || !text || !createdAt)
        return null;
    return { id, authUserId, text, createdAt, updatedAt: updatedRaw || null };
}
export function parsePartnerConfirmedReportCommentList(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.map(parsePartnerConfirmedReportComment).filter((x) => x != null);
}
export function parsePartnerReportConfirmationRequest(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const id = String(o.id ?? '').trim();
    const snapshotId = String(o.snapshotId ?? o.snapshot_id ?? '').trim();
    const projectId = String(o.projectId ?? o.project_id ?? '').trim();
    const dateFrom = String(o.dateFrom ?? o.date_from ?? '').slice(0, 10);
    const dateTo = String(o.dateTo ?? o.date_to ?? '').slice(0, 10);
    const submittedByAuthUserId = readPartnerConfirmNum(o.submittedByAuthUserId ?? o.submitted_by_auth_user_id);
    if (!id || !snapshotId || !projectId || !dateFrom || !dateTo || submittedByAuthUserId == null)
        return null;
    const reqArr = o.requiredPartnerAuthUserIds ?? o.required_partner_auth_user_ids;
    const pendArr = o.pendingPartnerAuthUserIds ?? o.pending_partner_auth_user_ids;
    const sigRaw = Array.isArray(o.signatures) ? o.signatures : [];
    const invoiceIdRaw = o.invoiceId ?? o.invoice_id ?? o.linkedInvoiceId ?? o.linked_invoice_id;
    const invoiceId = invoiceIdRaw != null && String(invoiceIdRaw).trim()
        ? String(invoiceIdRaw).trim()
        : undefined;
    const requiredPartnerAuthUserIds = (Array.isArray(reqArr) ? reqArr : []).map(readPartnerConfirmNum).filter((x) => x != null);
    const pendingPartnerAuthUserIds = (Array.isArray(pendArr) ? pendArr : []).map(readPartnerConfirmNum).filter((x) => x != null);
    const signatures = sigRaw.map(parsePartnerReportConfirmationSignature).filter((x) => x != null);
    const updatedRaw = o.updatedAt ?? o.updated_at;
    const projectRaw = o.project;
    const clientRaw = o.client;
    const pickEmbed = (source, keys) => {
        for (const key of keys) {
            const value = source[key];
            if (value != null && String(value).trim())
                return String(value).trim();
        }
        return '';
    };
    const projectName = pickEmbed(o, ['projectName', 'project_name'])
        || (projectRaw && typeof projectRaw === 'object'
            ? pickEmbed(projectRaw, ['name', 'title', 'project_name', 'projectName'])
            : '');
    const clientId = pickEmbed(o, ['clientId', 'client_id'])
        || (clientRaw && typeof clientRaw === 'object'
            ? pickEmbed(clientRaw, ['id'])
            : '');
    const clientName = pickEmbed(o, ['clientName', 'client_name'])
        || (clientRaw && typeof clientRaw === 'object'
            ? pickEmbed(clientRaw, ['name', 'title', 'client_name', 'clientName'])
            : '');
    const commentsArrRaw = o.comments;
    const commentsFromArr = Array.isArray(commentsArrRaw)
        ? parsePartnerConfirmedReportCommentList(commentsArrRaw)
        : null;
    const commentsCountRaw = o.commentsCount
        ?? o.comments_count
        ?? o.commentCount
        ?? o.comment_count
        ?? (commentsFromArr != null ? commentsFromArr.length : undefined);
    const commentsCountNum = commentsCountRaw == null || commentsCountRaw === ''
        ? null
        : readPartnerConfirmNum(commentsCountRaw);
    const lastCommentRaw = o.lastComment
        ?? o.last_comment
        ?? o.latestComment
        ?? o.latest_comment
        ?? (commentsFromArr && commentsFromArr.length > 0
            ? commentsFromArr[commentsFromArr.length - 1]
            : undefined);
    const lastComment = lastCommentRaw == null
        ? undefined
        : parsePartnerConfirmedReportComment(lastCommentRaw);
    const entryCountRaw = o.entryCount ?? o.entry_count ?? o.timeEntryCount ?? o.time_entry_count;
    const entryCountNum = entryCountRaw == null || entryCountRaw === ''
        ? null
        : readPartnerConfirmNum(entryCountRaw);
    const isEmptyRaw = o.isEmpty ?? o.is_empty ?? o.empty;
    const isEmpty = isEmptyRaw === true || isEmptyRaw === 'true' || isEmptyRaw === 1 || isEmptyRaw === '1'
        ? true
        : isEmptyRaw === false || isEmptyRaw === 'false' || isEmptyRaw === 0 || isEmptyRaw === '0'
            ? false
            : entryCountNum != null
                ? entryCountNum <= 0
                : undefined;
    return {
        id,
        snapshotId,
        projectId,
        dateFrom,
        dateTo,
        title: String(o.title ?? ''),
        status: String(o.status ?? ''),
        reviewPriority: normalizePartnerReviewPriority(o.reviewPriority ?? o.review_priority),
        submittedByAuthUserId,
        requiredPartnerAuthUserIds,
        pendingPartnerAuthUserIds,
        signatures,
        createdAt: String(o.createdAt ?? o.created_at ?? ''),
        updatedAt: updatedRaw == null || updatedRaw === '' ? null : String(updatedRaw),
        ...(projectName ? { projectName } : {}),
        ...(clientName ? { clientName } : {}),
        ...(clientId ? { clientId } : {}),
        ...(invoiceId ? { invoiceId } : {}),
        ...(commentsCountNum != null ? { commentsCount: Math.max(0, Math.trunc(commentsCountNum)) } : {}),
        ...(lastCommentRaw === null
            ? { lastComment: null }
            : lastComment
                ? { lastComment }
                : {}),
        ...(entryCountNum != null ? { entryCount: Math.max(0, Math.trunc(entryCountNum)) } : {}),
        ...(isEmpty != null ? { isEmpty } : {}),
    };
}
export function parsePartnerReportConfirmationRequestList(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.map(parsePartnerReportConfirmationRequest).filter((x) => x != null);
}
export function parsePriorityCounts(raw) {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const o = raw;
    const num = (v) => Math.max(0, Math.trunc(Number(v) || 0));
    return {
        all: num(o.all),
        red: num(o.red),
        yellow: num(o.yellow),
        green: num(o.green),
    };
}
export function parsePartnerPendingListPage(raw) {
    if (Array.isArray(raw)) {
        const items = parsePartnerReportConfirmationRequestList(raw);
        return { items, page: 1, pageSize: Math.max(items.length, 1), total: items.length };
    }
    if (!raw || typeof raw !== 'object')
        return { items: [], page: 1, pageSize: 50, total: 0 };
    const o = raw;
    const items = parsePartnerReportConfirmationRequestList(o.items ?? o.results ?? []);
    const page = Math.max(1, Math.trunc(Number(o.page) || 1));
    const pageSize = Math.max(1, Math.min(200, Math.trunc(Number(o.pageSize ?? o.page_size) || 50)));
    const totalRaw = Number(o.total);
    const total = Number.isFinite(totalRaw) ? Math.max(0, Math.trunc(totalRaw)) : items.length;
    const priorityCounts = parsePriorityCounts(o.priorityCounts ?? o.priority_counts);
    return {
        items,
        page,
        pageSize,
        total,
        ...(priorityCounts ? { priorityCounts } : {}),
    };
}
export const partnerConfirmationsPendingInflight = new Map();
let partnerConfirmationsConfirmedInflight = null;
export function pendingListCacheKey(options) {
    const scope = options?.scope === 'all' ? 'all' : 'mine';
    const priority = options?.priority ?? '';
    const page = Math.max(1, Math.trunc(options?.page ?? 1));
    const pageSize = Math.max(1, Math.min(200, Math.trunc(options?.pageSize ?? 50)));
    return `${scope}|${priority}|${page}|${pageSize}`;
}
export function invalidatePartnerReportConfirmationsCache() {
    partnerConfirmationsPendingInflight.clear();
    partnerConfirmationsConfirmedInflight = null;
    invalidatePartnerReportConfirmationsPendingCache();
}
export async function listPartnerReportConfirmationsPending(options) {
    const scope = options?.scope === 'all' ? 'all' : 'mine';
    const page = Math.max(1, Math.trunc(options?.page ?? 1));
    const pageSize = Math.max(1, Math.min(200, Math.trunc(options?.pageSize ?? 50)));
    const priority = options?.priority ?? null;
    const key = pendingListCacheKey({ scope, priority, page, pageSize });
    if (!partnerConfirmationsPendingInflight.has(key)) {
        const params = new URLSearchParams();
        if (scope === 'all')
            params.set('scope', 'all');
        if (priority)
            params.set('priority', priority);
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));
        const qs = params.toString();
        const inflight = (async () => {
            const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/pending?${qs}`);
            await reportsThrowIfNotOk(res);
            return parsePartnerPendingListPage(await res.json());
        })().catch((err) => {
            partnerConfirmationsPendingInflight.delete(key);
            throw err;
        });
        partnerConfirmationsPendingInflight.set(key, inflight);
    }
    return partnerConfirmationsPendingInflight.get(key);
}
/** Первая страница (до 200) — для поиска заявки по проекту/периоду вне панели «на проверке». */
export async function listPartnerReportConfirmationsPendingItems(options) {
    const page = await listPartnerReportConfirmationsPending({
        scope: options?.scope,
        page: 1,
        pageSize: 200,
    });
    return page.items;
}
export async function patchPartnerReportConfirmationPriority(requestId, reviewPriority) {
    const rid = String(requestId ?? '').trim();
    if (!rid)
        throw new Error('Не указан запрос подтверждения');
    const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/${encodeURIComponent(rid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewPriority }),
    });
    await reportsThrowIfNotOk(res);
    const parsed = parsePartnerReportConfirmationRequest(await res.json());
    if (!parsed)
        throw new TimeTrackingHttpError(500, 'Некорректный ответ сервера');
    invalidatePartnerReportConfirmationsCache();
    return parsed;
}
export async function listPartnerReportConfirmationsConfirmed(filters) {
    if (filters?.dateFrom?.trim() || filters?.dateTo?.trim() || filters?.before?.trim()) {
        const p = new URLSearchParams();
        if (filters?.dateFrom?.trim())
            p.set('dateFrom', filters.dateFrom.trim().slice(0, 10));
        if (filters?.dateTo?.trim())
            p.set('dateTo', filters.dateTo.trim().slice(0, 10));
        if (filters?.before?.trim())
            p.set('before', filters.before.trim().slice(0, 10));
        const qs = p.toString();
        const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/confirmed${qs ? `?${qs}` : ''}`);
        await reportsThrowIfNotOk(res);
        return parsePartnerReportConfirmationRequestList(await res.json());
    }
    if (!partnerConfirmationsConfirmedInflight) {
        partnerConfirmationsConfirmedInflight = (async () => {
            const res = await apiFetch('/api/v1/time-tracking/reports/partner-confirmations/confirmed');
            await reportsThrowIfNotOk(res);
            return parsePartnerReportConfirmationRequestList(await res.json());
        })().catch((err) => {
            partnerConfirmationsConfirmedInflight = null;
            throw err;
        });
    }
    return partnerConfirmationsConfirmedInflight;
}
export async function submitPartnerReportConfirmation(body) {
    const res = await apiFetch('/api/v1/time-tracking/reports/partner-confirmations/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            snapshotId: body.snapshotId.trim(),
            projectId: body.projectId.trim(),
            dateFrom: body.dateFrom.slice(0, 10),
            dateTo: body.dateTo.slice(0, 10),
        }),
    });
    await reportsThrowIfNotOk(res);
    const parsed = parsePartnerReportConfirmationRequest(await res.json());
    if (!parsed)
        throw new TimeTrackingHttpError(500, 'Некорректный ответ сервера');
    invalidatePartnerReportConfirmationsCache();
    return parsed;
}
export async function submitPartnerReportConfirmationFromPreview(body) {
    const res = await apiFetch('/api/v1/time-tracking/reports/partner-confirmations/submit-from-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            projectId: body.projectId.trim(),
            dateFrom: body.dateFrom.slice(0, 10),
            dateTo: body.dateTo.slice(0, 10),
        }),
    });
    await reportsThrowIfNotOk(res);
    const parsed = parsePartnerReportConfirmationRequest(await res.json());
    if (!parsed)
        throw new TimeTrackingHttpError(500, 'Некорректный ответ сервера');
    invalidatePartnerReportConfirmationsCache();
    return parsed;
}
export async function confirmPartnerReportConfirmation(requestId) {
    const rid = String(requestId ?? '').trim();
    if (!rid)
        throw new Error('Не указан запрос подтверждения');
    const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/${encodeURIComponent(rid)}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
    await reportsThrowIfNotOk(res);
    const parsed = parsePartnerReportConfirmationRequest(await res.json());
    if (!parsed)
        throw new TimeTrackingHttpError(500, 'Некорректный ответ сервера');
    invalidatePartnerReportConfirmationsCache();
    return parsed;
}
export async function deletePartnerReportConfirmation(requestId) {
    const rid = String(requestId ?? '').trim();
    if (!rid)
        throw new Error('Не указан запрос подтверждения');
    const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/${encodeURIComponent(rid)}`, {
        method: 'DELETE',
    });
    await reportsThrowIfNotOk(res);
    invalidatePartnerReportConfirmationsCache();
}
export async function revokePartnerReportConfirmationSignature(requestId, partnerAuthUserId) {
    const rid = String(requestId ?? '').trim();
    const pid = Number(partnerAuthUserId);
    if (!rid)
        throw new Error('Не указан запрос подтверждения');
    if (!Number.isFinite(pid) || pid <= 0)
        throw new Error('Не указан партнёр');
    const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/${encodeURIComponent(rid)}/signatures/${encodeURIComponent(String(pid))}`, { method: 'DELETE' });
    await reportsThrowIfNotOk(res);
    const parsed = parsePartnerReportConfirmationRequest(await res.json());
    if (!parsed)
        throw new TimeTrackingHttpError(500, 'Некорректный ответ сервера');
    invalidatePartnerReportConfirmationsCache();
    return parsed;
}
export async function listPartnerConfirmationComments(requestId) {
    const rid = String(requestId ?? '').trim();
    if (!rid)
        throw new Error('Не указан запрос подтверждения');
    const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/${encodeURIComponent(rid)}/comments`);
    await reportsThrowIfNotOk(res);
    return parsePartnerConfirmedReportCommentList(await res.json());
}
export async function createPartnerConfirmationComment(requestId, text) {
    const rid = String(requestId ?? '').trim();
    const bodyText = String(text ?? '').trim();
    if (!rid)
        throw new Error('Не указан запрос подтверждения');
    if (!bodyText)
        throw new Error('Текст комментария не может быть пустым');
    const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/${encodeURIComponent(rid)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bodyText }),
    });
    await reportsThrowIfNotOk(res);
    const parsed = parsePartnerConfirmedReportComment(await res.json());
    if (!parsed)
        throw new TimeTrackingHttpError(500, 'Некорректный ответ сервера');
    invalidatePartnerReportConfirmationsCache();
    return parsed;
}
export async function patchPartnerConfirmationComment(requestId, commentId, text) {
    const rid = String(requestId ?? '').trim();
    const cid = String(commentId ?? '').trim();
    const bodyText = String(text ?? '').trim();
    if (!rid)
        throw new Error('Не указан запрос подтверждения');
    if (!cid)
        throw new Error('Не указан комментарий');
    if (!bodyText)
        throw new Error('Текст комментария не может быть пустым');
    const res = await apiFetch(`/api/v1/time-tracking/reports/partner-confirmations/${encodeURIComponent(rid)}/comments/${encodeURIComponent(cid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bodyText }),
    });
    await reportsThrowIfNotOk(res);
    const parsed = parsePartnerConfirmedReportComment(await res.json());
    if (!parsed)
        throw new TimeTrackingHttpError(500, 'Некорректный ответ сервера');
    invalidatePartnerReportConfirmationsCache();
    return parsed;
}
