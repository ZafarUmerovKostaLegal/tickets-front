import { apiFetch } from '@shared/api';
const BASE = '/api/v1/todos/board';
export interface TodoBoardLabel {
    id: number;
    title: string;
    color: string;
    position: number;
}
export interface TodoBoardCardLabel {
    id: number;
    title: string;
    color: string;
}
export interface TodoChecklistItemApi {
    id: number;
    title: string;
    is_done: boolean;
    position: number;
}
export interface TodoCardAttachmentApi {
    id: number;
    original_filename: string;
    mime_type: string | null;
    size_bytes: number;
    media_url: string;
}
export interface TodoCardCommentApi {
    id: number;
    user_id: number;
    body: string;
    created_at: string;
}
export interface TodoBoardCard {
    id: number;
    title: string;
    body: string | null;
    position: number;
    created_at?: string;
    due_at: string | null;
    is_completed: boolean;
    is_archived: boolean;
    labels: TodoBoardCardLabel[];
    checklist: TodoChecklistItemApi[];
    participant_user_ids: number[];
    attachments: TodoCardAttachmentApi[];
    comments: TodoCardCommentApi[];
}
export interface TodoBoardColumn {
    id: number;
    title: string;
    position: number;
    color: string;
    task_count: number;
    is_collapsed?: boolean;
    cards: TodoBoardCard[];
}
export interface TodoBoard {
    id: number;
    user_id: number;
    background_url: string | null;
    board_labels: TodoBoardLabel[];
    columns: TodoBoardColumn[];
}
export type PatchTodoCardPayload = {
    title?: string;
    body?: string | null;
    columnId?: number;
    position?: number;
    dueAt?: string | null;
    isCompleted?: boolean;
    isArchived?: boolean;
    labelIds?: number[];
    participantUserIds?: number[];
};
async function readBoardResponse(res: Response): Promise<TodoBoard> {
    const text = await res.text();
    if (!res.ok) {
        let msg = `Ошибка ${res.status}`;
        try {
            const j = JSON.parse(text) as {
                detail?: string | unknown[];
            };
            if (typeof j.detail === 'string')
                msg = j.detail;
            else if (Array.isArray(j.detail) && j.detail.length) {
                const first = j.detail[0] as {
                    msg?: string;
                };
                if (typeof first?.msg === 'string')
                    msg = first.msg;
            }
        }
        catch {
            if (text)
                msg = text.slice(0, 240);
        }
        throw new Error(msg);
    }
    if (!text) {
        throw new Error('Пустой ответ сервера');
    }
    const raw = JSON.parse(text) as Record<string, unknown>;
    const board = raw as unknown as TodoBoard;
    const bgFromSnake = typeof board.background_url === 'string' ? board.background_url : null;
    const bgFromCamel = typeof raw.backgroundUrl === 'string' ? raw.backgroundUrl : null;
    const bgFromShort = typeof raw.background === 'string' ? raw.background : null;
    const bgPick = bgFromSnake ?? bgFromCamel ?? bgFromShort;
    board.background_url =
        typeof bgPick === 'string' && bgPick.trim() ? bgPick.trim() : null;
    if (!board.board_labels)
        board.board_labels = [];
    for (const col of board.columns ?? []) {
        for (const card of col.cards ?? []) {
            if (!card.labels)
                card.labels = [];
            if (!card.checklist)
                card.checklist = [];
            if (!card.participant_user_ids)
                card.participant_user_ids = [];
            if (!card.attachments)
                card.attachments = [];
            if (!card.comments)
                card.comments = [];
        }
    }
    return board;
}
export async function fetchTodoBoard(): Promise<TodoBoard> {
    const res = await apiFetch(BASE);
    return readBoardResponse(res);
}
export async function patchTodoBoard(body: {
    background_url: string | null;
}): Promise<TodoBoard> {
    const res = await apiFetch(BASE, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function createTodoBoardLabel(body: {
    title: string;
    color?: string;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoBoardLabel(labelId: number, body: {
    title?: string;
    color?: string;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/labels/${labelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoBoardLabel(labelId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/labels/${labelId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function createTodoColumn(body: {
    title: string;
    color?: string;
    insert_at?: number;
    isCollapsed?: boolean;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoColumn(columnId: number, body: {
    title?: string;
    color?: string;
    isCollapsed?: boolean;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/columns/${columnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoColumn(columnId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/columns/${columnId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function reorderTodoColumns(orderedColumnIds: number[]): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/columns/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_column_ids: orderedColumnIds }),
    });
    return readBoardResponse(res);
}
export async function createTodoCard(columnId: number, body: {
    title: string;
    body?: string;
    insert_at?: number;
    dueAt?: string | null;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/columns/${columnId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoCard(cardId: number, body: PatchTodoCardPayload): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoCard(cardId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/cards/${cardId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function reorderTodoCardsInColumn(columnId: number, orderedCardIds: number[]): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/columns/${columnId}/cards/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedCardIds }),
    });
    return readBoardResponse(res);
}
export async function createTodoChecklistItem(cardId: number, body: {
    title: string;
    insert_at?: number;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/cards/${cardId}/checklist/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoChecklistItem(cardId: number, itemId: number, body: {
    title?: string;
    isDone?: boolean;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/cards/${cardId}/checklist/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoChecklistItem(cardId: number, itemId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/cards/${cardId}/checklist/items/${itemId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function reorderTodoChecklist(cardId: number, orderedItemIds: number[]): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/cards/${cardId}/checklist/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedItemIds }),
    });
    return readBoardResponse(res);
}
export async function uploadTodoCardAttachment(cardId: number, file: File, init?: Pick<RequestInit, 'signal'>): Promise<TodoBoard> {
    const fd = new FormData();
    const name = file.name || 'file';
    fd.append('file', file, name);
    const res = await apiFetch(`${BASE}/cards/${cardId}/attachments`, {
        method: 'POST',
        body: fd,
        ...init,
    });
    return readBoardResponse(res);
}
export async function deleteTodoCardAttachment(cardId: number, attachmentId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/cards/${cardId}/attachments/${attachmentId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function postTodoCardComment(cardId: number, body: string): Promise<TodoBoard> {
    const res = await apiFetch(`${BASE}/cards/${cardId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
    });
    return readBoardResponse(res);
}
