import { apiFetch } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
import { BASE } from './lib/constants';
import { buildTicketsQuery } from './lib/query';
import { parseApiError } from './lib/parseError';
import { normalizeTicketPriorityForApi } from './lib/ticketPriority';
const TICKET_STATIC_TTL_MS = 30 * 60_000;
const _statusesCache = createQueryCache({
    ttlMs: TICKET_STATIC_TTL_MS,
    storageKey: 'statuses',
});
const _prioritiesCache = createQueryCache({
    ttlMs: TICKET_STATIC_TTL_MS,
    storageKey: 'priorities',
});
export function invalidateTicketStaticCache() {
    _statusesCache.invalidate();
    _prioritiesCache.invalidate();
}
export function getAttachmentUrl(attachmentPath) {
    const raw = attachmentPath.startsWith('/') ? attachmentPath.slice(1) : attachmentPath;
    if (!raw || /[\s#?]/.test(raw) || /[/\\]{2,}/.test(raw)) {
        throw new Error('Некорректный путь вложения');
    }
    const segments = raw.split('/').filter(Boolean);
    if (segments.some((s) => s === '..' || s === '.')) {
        throw new Error('Некорректный путь вложения');
    }
    const safe = segments.map((seg) => encodeURIComponent(seg)).join('/');
    return `${BASE}/attachments/${safe}`;
}
export async function getStatuses() {
    return _statusesCache.fetch('statuses', async () => {
        const res = await apiFetch(`${BASE}/statuses`);
        if (!res.ok)
            throw new Error(await parseApiError(res, 'Failed to fetch statuses'));
        return res.json();
    });
}
export async function getPriorities() {
    return _prioritiesCache.fetch('priorities', async () => {
        const res = await apiFetch(`${BASE}/priorities`);
        if (!res.ok)
            throw new Error(await parseApiError(res, 'Failed to fetch priorities'));
        return res.json();
    });
}
export async function getTickets(params = {}) {
    const query = buildTicketsQuery(params);
    const res = await apiFetch(`${BASE}${query ? `?${query}` : ''}`);
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to fetch tickets'));
    return res.json();
}
export async function getTicket(uuid) {
    const res = await apiFetch(`${BASE}/${uuid}`);
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to fetch ticket'));
    return res.json();
}
export async function createTicket(data) {
    const form = new FormData();
    form.append('theme', data.theme);
    form.append('description', data.description);
    form.append('category', data.category);
    form.append('priority', normalizeTicketPriorityForApi(data.priority));
    if (data.attachment)
        form.append('attachment', data.attachment);
    const res = await apiFetch(BASE, { method: 'POST', body: form });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to create ticket'));
    return res.json();
}
export async function updateTicket(uuid, data) {
    const { attachment, ...rest } = data;
    if (rest.priority !== undefined)
        rest.priority = normalizeTicketPriorityForApi(rest.priority);
    if (attachment instanceof File) {
        const form = new FormData();
        for (const [key, val] of Object.entries(rest)) {
            if (val === undefined)
                continue;
            if (val === null) {
                form.append(key, '');
                continue;
            }
            form.append(key, String(val));
        }
        form.append('attachment', attachment);
        const res = await apiFetch(`${BASE}/${uuid}`, { method: 'PATCH', body: form });
        if (!res.ok)
            throw new Error(await parseApiError(res, 'Failed to update ticket'));
        return res.json();
    }
    const res = await apiFetch(`${BASE}/${uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
    });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to update ticket'));
    return res.json();
}
export async function submitTicketForApproval(uuid, partnerUserId) {
    const res = await apiFetch(`${BASE}/${uuid}/submit-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerUserId }),
    });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to submit ticket for approval'));
    return res.json();
}
export async function approveTicket(uuid) {
    const res = await apiFetch(`${BASE}/${uuid}/approve`, { method: 'POST' });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to approve ticket'));
    return res.json();
}
export async function rejectTicket(uuid, comment) {
    const res = await apiFetch(`${BASE}/${uuid}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
    });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to reject ticket'));
    return res.json();
}
export async function archiveTicket(uuid, isArchived = true) {
    const res = await apiFetch(`${BASE}/${uuid}/archive?is_archived=${isArchived}`, { method: 'PATCH' });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to archive ticket'));
    return res.json();
}
export async function getComments(ticketUuid) {
    const res = await apiFetch(`${BASE}/${ticketUuid}/comments`);
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to fetch comments'));
    return res.json();
}
export async function addComment(ticketUuid, content) {
    const res = await apiFetch(`${BASE}/${ticketUuid}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to add comment'));
    return res.json();
}
export async function updateComment(ticketUuid, commentId, content) {
    const res = await apiFetch(`${BASE}/${ticketUuid}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to update comment'));
    return res.json();
}
