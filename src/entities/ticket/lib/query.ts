import type { TicketsParams } from '../model/types';
export function buildTicketsQuery(params: TicketsParams): string {
    const q = new URLSearchParams();
    if (params.skip != null)
        q.set('skip', String(params.skip));
    if (params.limit != null)
        q.set('limit', String(params.limit));
    if (params.status != null)
        q.set('status', params.status);
    if (params.priority != null)
        q.set('priority', params.priority);
    if (params.category != null)
        q.set('category', params.category);
    if (params.include_archived != null)
        q.set('include_archived', String(params.include_archived));
    return q.toString();
}
export function buildTicketsPayload(params: TicketsParams): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (params.skip != null)
        payload.skip = params.skip;
    if (params.limit != null)
        payload.limit = params.limit;
    if (params.status != null)
        payload.status = params.status;
    if (params.priority != null)
        payload.priority = params.priority;
    if (params.category != null)
        payload.category = params.category;
    if (params.include_archived != null)
        payload.include_archived = params.include_archived;
    return payload;
}
