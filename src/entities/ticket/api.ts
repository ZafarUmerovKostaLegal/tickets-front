import { apiFetch } from '@shared/api';
import type { Comment, PriorityItem, StatusItem, Ticket, TicketsParams, } from './model/types';
import { BASE } from './lib/constants';
import { buildTicketsQuery } from './lib/query';
import { parseApiError } from './lib/parseError';
export function getAttachmentUrl(attachmentPath: string): string {
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
export async function getStatuses(): Promise<StatusItem[]> {
    const res = await apiFetch(`${BASE}/statuses`);
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to fetch statuses'));
    return res.json();
}
export async function getPriorities(): Promise<PriorityItem[]> {
    const res = await apiFetch(`${BASE}/priorities`);
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to fetch priorities'));
    return res.json();
}
export async function getTickets(params: TicketsParams = {}): Promise<Ticket[]> {
    const query = buildTicketsQuery(params);
    const res = await apiFetch(`${BASE}${query ? `?${query}` : ''}`);
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to fetch tickets'));
    return res.json();
}
export async function getTicket(uuid: string): Promise<Ticket> {
    const res = await apiFetch(`${BASE}/${uuid}`);
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to fetch ticket'));
    return res.json();
}
export type CreateTicketData = {
    theme: string;
    description: string;
    category: string;
    priority: string;
    attachment?: File;
};
export async function createTicket(data: CreateTicketData): Promise<Ticket> {
    const form = new FormData();
    form.append('theme', data.theme);
    form.append('description', data.description);
    form.append('category', data.category);
    form.append('priority', data.priority);
    if (data.attachment)
        form.append('attachment', data.attachment);
    const res = await apiFetch(BASE, { method: 'POST', body: form });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to create ticket'));
    return res.json();
}
export type UpdateTicketData = Partial<Pick<Ticket, 'theme' | 'description' | 'attachment_path' | 'status' | 'category' | 'priority'>>;
export async function updateTicket(uuid: string, data: UpdateTicketData): Promise<Ticket> {
    const res = await apiFetch(`${BASE}/${uuid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to update ticket'));
    return res.json();
}
export async function archiveTicket(uuid: string, isArchived = true): Promise<Ticket> {
    const res = await apiFetch(`${BASE}/${uuid}/archive?is_archived=${isArchived}`, { method: 'PATCH' });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to archive ticket'));
    return res.json();
}
export async function getComments(ticketUuid: string): Promise<Comment[]> {
    const res = await apiFetch(`${BASE}/${ticketUuid}/comments`);
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to fetch comments'));
    return res.json();
}
export async function addComment(ticketUuid: string, content: string): Promise<Comment> {
    const res = await apiFetch(`${BASE}/${ticketUuid}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to add comment'));
    return res.json();
}
export async function updateComment(ticketUuid: string, commentId: number, content: string): Promise<Comment> {
    const res = await apiFetch(`${BASE}/${ticketUuid}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
    if (!res.ok)
        throw new Error(await parseApiError(res, 'Failed to update comment'));
    return res.json();
}
