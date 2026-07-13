import { apiFetch } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
import { toTodoBoardBackgroundMediaApiPath } from './lib/boardBackgroundUrl';

const TODOS = '/api/v1/todos';
const LEGACY_BOARD = `${TODOS}/board`;

const BOARDS_LIST_TTL_MS = 2 * 60_000;
const _boardsListCache = createQueryCache<TodoBoardsListResult>({ ttlMs: BOARDS_LIST_TTL_MS });
const BOARDS_LIST_KEY = 'boards-list';

export function invalidateTodoBoardsListCache(): void {
    _boardsListCache.invalidate();
}

export function todoBoardPath(boardId: number): string {
    return `${TODOS}/boards/${boardId}`;
}

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
    title?: string;
    visibility?: string;
    color?: string | null;

    my_role?: string | null;
    background_url: string | null;
    board_labels: TodoBoardLabel[];
    columns: TodoBoardColumn[];
}
export type TodoBoardSummary = {
    id: number;
    title: string;
    visibility: string;
    color: string | null;
    background_url: string | null;
    sort_order: number;
    is_current: boolean;
    updated_at: string | null;
    my_role: string | null;
};

export type TodoBoardsListResult = {
    items: TodoBoardSummary[];
    current_board_id: number | null;
    last_selected_board_id: number | null;
};

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

function parseHttpError(status: number, text: string): Error {
    let msg = `Ошибка ${status}`;
    if (!text)
        return new Error(msg);
    try {
        const j = JSON.parse(text) as {
            detail?: string | unknown[] | Record<string, unknown>;
        };
        const d = j.detail;
        if (typeof d === 'string')
            msg = d;
        else if (Array.isArray(d) && d.length) {
            const first = d[0] as {
                msg?: string;
            };
            if (typeof first?.msg === 'string')
                msg = first.msg;
        }
        else if (d && typeof d === 'object' && !Array.isArray(d)) {
            const obj = d as Record<string, unknown>;
            const m = typeof obj.message === 'string' ? obj.message : null;
            const hint = typeof obj.hint === 'string' ? obj.hint : null;
            const pg = typeof obj.postgres === 'string' ? obj.postgres : null;
            const parts: string[] = [];
            if (m)
                parts.push(m);
            if (hint)
                parts.push(hint);
            if (pg) {
                const short = pg.length > 800 ? `${pg.slice(0, 800)}…` : pg;
                parts.push(`PostgreSQL: ${short}`);
            }
            if (parts.length)
                msg = parts.join('\n\n');
        }
    }
    catch {
        msg = text.slice(0, 800);
    }
    return new Error(msg);
}

function numField(o: Record<string, unknown>, snake: string, camel: string, fallback = 0): number {
    const v = o[snake] ?? o[camel];
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function boolField(o: Record<string, unknown>, snake: string, camel: string): boolean {
    const v = o[snake] ?? o[camel];
    return Boolean(v);
}

function strField(o: Record<string, unknown>, snake: string, camel: string): string | null {
    const v = o[snake] ?? o[camel];
    return typeof v === 'string' ? v : null;
}

function numFieldNullable(o: Record<string, unknown>, snake: string, camel: string): number | null {
    const v = o[snake] ?? o[camel];
    if (v == null || v === '')
        return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

export function parseTodoBoardSummary(raw: Record<string, unknown>): TodoBoardSummary {
    const bg = toTodoBoardBackgroundMediaApiPath(strField(raw, 'background_url', 'backgroundUrl'));
    return {
        id: numField(raw, 'id', 'id', 0),
        title: strField(raw, 'title', 'title') ?? '',
        visibility: strField(raw, 'visibility', 'visibility') ?? 'personal',
        color: strField(raw, 'color', 'color'),
        background_url: bg,
        sort_order: numField(raw, 'sort_order', 'sortOrder', 0),
        is_current: boolField(raw, 'is_current', 'isCurrent'),
        updated_at: strField(raw, 'updated_at', 'updatedAt'),
        my_role: strField(raw, 'my_role', 'myRole'),
    };
}

function parseBoardJsonText(text: string): TodoBoard {
    if (!text)
        throw new Error('Пустой ответ сервера');
    const raw = JSON.parse(text) as Record<string, unknown>;
    const board = raw as unknown as TodoBoard;
    const bgFromSnake = typeof board.background_url === 'string' ? board.background_url : null;
    const bgFromCamel = typeof raw.backgroundUrl === 'string' ? raw.backgroundUrl : null;
    const bgFromShort = typeof raw.background === 'string' ? raw.background : null;
    const bgPick = bgFromSnake ?? bgFromCamel ?? bgFromShort;
    board.background_url = toTodoBoardBackgroundMediaApiPath(bgPick);
    if (typeof raw.title === 'string')
        board.title = raw.title;
    if (typeof raw.visibility === 'string')
        board.visibility = raw.visibility;
    if (raw.color != null)
        board.color = typeof raw.color === 'string' ? raw.color : null;
    const roleRaw = raw.my_role ?? raw.myRole;
    if (typeof roleRaw === 'string' && roleRaw.trim())
        board.my_role = roleRaw.trim();
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

async function readBoardResponse(res: Response): Promise<TodoBoard> {
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    return parseBoardJsonText(text);
}


export function pickPreferredTodoBoardId(data: TodoBoardsListResult): number | null {
    const items = data.items;
    if (!items.length)
        return null;
    const ids = new Set(items.map((b) => b.id));
    if (data.last_selected_board_id != null && ids.has(data.last_selected_board_id))
        return data.last_selected_board_id;
    if (data.current_board_id != null && ids.has(data.current_board_id))
        return data.current_board_id;
    return items[0].id;
}

async function _fetchTodoBoardsListFromApi(): Promise<TodoBoardsListResult> {
    const res = await apiFetch(`${TODOS}/boards`);
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    const raw = JSON.parse(text) as Record<string, unknown>;
    const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
    const items = itemsRaw.map((x) => parseTodoBoardSummary(x as Record<string, unknown>));
    return {
        items,
        current_board_id: numFieldNullable(raw, 'current_board_id', 'currentBoardId'),
        last_selected_board_id: numFieldNullable(raw, 'last_selected_board_id', 'lastSelectedBoardId'),
    };
}

export async function fetchTodoBoardsList(): Promise<TodoBoardsListResult> {
    return _boardsListCache.fetch(BOARDS_LIST_KEY, _fetchTodoBoardsListFromApi);
}


export async function putTodoBoardCurrent(boardId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${TODOS}/boards/current`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId }),
    });
    return readBoardResponse(res);
}

export async function uploadTodoBoardBackground(boardId: number, file: File, init?: Pick<RequestInit, 'signal'>): Promise<TodoBoard> {
    const fd = new FormData();
    const name = file.name || 'file';
    fd.append('file', file, name);
    const res = await apiFetch(`${todoBoardPath(boardId)}/background`, {
        method: 'POST',
        body: fd,
        ...init,
    });
    return readBoardResponse(res);
}

export async function deleteTodoBoardBackground(boardId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/background`, { method: 'DELETE' });
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    if (text.trim())
        return parseBoardJsonText(text);
    return fetchTodoBoardById(boardId);
}


export async function fetchTodoBoardCurrent(): Promise<TodoBoard> {
    const res = await apiFetch(`${TODOS}/boards/current`);
    if (res.ok)
        return readBoardResponse(res);
    if (res.status === 404) {
        const leg = await apiFetch(LEGACY_BOARD);
        return readBoardResponse(leg);
    }
    return readBoardResponse(res);
}

export async function fetchTodoBoardById(boardId: number): Promise<TodoBoard> {
    const res = await apiFetch(todoBoardPath(boardId));
    return readBoardResponse(res);
}


export async function fetchTodoBoard(): Promise<TodoBoard> {
    return fetchTodoBoardCurrent();
}


export type CreateTodoBoardBody = {
    title?: string;
    visibility: 'personal' | 'shared';
    color?: string | null;
    memberUserIds?: number[];
    instantAddMembers?: boolean;
};

export async function createTodoBoard(body: CreateTodoBoardBody): Promise<TodoBoard> {
    const payload: Record<string, unknown> = {
        visibility: body.visibility,
        memberUserIds: body.memberUserIds ?? [],
        instantAddMembers: body.instantAddMembers ?? false,
    };
    const t = body.title?.trim();
    if (t)
        payload.title = t;
    if (body.color !== undefined && body.color !== null)
        payload.color = body.color;
    const res = await apiFetch(`${TODOS}/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const board = await readBoardResponse(res);
    _boardsListCache.invalidate();
    return board;
}


export async function deleteTodoBoard(boardId: number): Promise<void> {
    const res = await apiFetch(todoBoardPath(boardId), { method: 'DELETE' });
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    _boardsListCache.invalidate();
}

export type TodoBoardInvite = {
    id: number;
    board_id: number;
    board_title: string;
    inviter_user_id: number;
    role_offered: string;
    status: string;
    message: string | null;
    created_at: string;
    expires_at: string | null;
};

function parseTodoBoardInvite(raw: Record<string, unknown>): TodoBoardInvite {
    return {
        id: numField(raw, 'id', 'id', 0),
        board_id: numField(raw, 'board_id', 'boardId', 0),
        board_title: strField(raw, 'board_title', 'boardTitle') ?? '',
        inviter_user_id: numField(raw, 'inviter_user_id', 'inviterUserId', 0),
        role_offered: strField(raw, 'role_offered', 'roleOffered') ?? '',
        status: strField(raw, 'status', 'status') ?? '',
        message: strField(raw, 'message', 'message'),
        created_at: strField(raw, 'created_at', 'createdAt') ?? '',
        expires_at: strField(raw, 'expires_at', 'expiresAt'),
    };
}

async function readInvitesListResponse(res: Response): Promise<TodoBoardInvite[]> {
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    const raw = JSON.parse(text) as {
        items?: unknown[];
    };
    const items = Array.isArray(raw.items) ? raw.items : [];
    return items.map((x) => parseTodoBoardInvite(x as Record<string, unknown>));
}


export async function fetchMyTodoInvites(): Promise<TodoBoardInvite[]> {
    const res = await apiFetch(`${TODOS}/invites`);
    return readInvitesListResponse(res);
}

export async function acceptTodoInvite(inviteId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${TODOS}/invites/${inviteId}/accept`, { method: 'POST' });
    return readBoardResponse(res);
}

export async function declineTodoInvite(inviteId: number): Promise<void> {
    const res = await apiFetch(`${TODOS}/invites/${inviteId}/decline`, { method: 'POST' });
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
}

export async function revokeTodoInvite(inviteId: number): Promise<void> {
    const res = await apiFetch(`${TODOS}/invites/${inviteId}/revoke`, { method: 'POST' });
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
}


export async function fetchTodoBoardInvites(boardId: number): Promise<TodoBoardInvite[]> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/invites`);
    return readInvitesListResponse(res);
}

export type CreateTodoBoardInvitesBody = {
    userIds: number[];
    role?: 'editor' | 'viewer';
    message?: string | null;
};


export async function createTodoBoardInvites(boardId: number, body: CreateTodoBoardInvitesBody): Promise<TodoBoardInvite[]> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userIds: body.userIds,
            role: body.role ?? 'editor',
            message: body.message ?? undefined,
        }),
    });
    return readInvitesListResponse(res);
}

export type TodoBoardMember = {
    user_id: number;
    role: string;
    joined_at: string | null;
};

export type TodoBoardMembersList = {
    items: TodoBoardMember[];
};

function parseTodoBoardMember(raw: Record<string, unknown>): TodoBoardMember {
    return {
        user_id: numField(raw, 'user_id', 'userId', 0),
        role: strField(raw, 'role', 'role') ?? '',
        joined_at: strField(raw, 'joined_at', 'joinedAt'),
    };
}

async function readMembersListResponse(res: Response): Promise<TodoBoardMembersList> {
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    const raw = JSON.parse(text) as { items?: unknown[] };
    const items = Array.isArray(raw.items) ? raw.items : [];
    return { items: items.map((x) => parseTodoBoardMember(x as Record<string, unknown>)) };
}


export async function fetchTodoBoardMembers(boardId: number): Promise<TodoBoardMembersList> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/members`);
    return readMembersListResponse(res);
}

export type AddTodoBoardMembersBody = {
    userIds: number[];
    role?: 'editor' | 'viewer';
    instant?: boolean;
};


export async function addTodoBoardMembers(boardId: number, body: AddTodoBoardMembersBody): Promise<TodoBoardMembersList> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userIds: body.userIds,
            role: body.role ?? 'editor',
            instant: body.instant ?? true,
        }),
    });
    return readMembersListResponse(res);
}


export async function patchTodoBoardMemberRole(boardId: number, memberUserId: number, role: 'editor' | 'viewer'): Promise<TodoBoardMembersList> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/members/${memberUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
    });
    return readMembersListResponse(res);
}


export async function removeTodoBoardMember(boardId: number, memberUserId: number): Promise<TodoBoardMembersList> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/members/${memberUserId}`, { method: 'DELETE' });
    return readMembersListResponse(res);
}

export type PatchTodoBoardBody = {
    backgroundUrl?: string | null;
    title?: string;
    color?: string | null;
    visibility?: 'personal' | 'shared';
};

export async function patchTodoBoard(boardId: number, body: PatchTodoBoardBody): Promise<TodoBoard> {
    const res = await apiFetch(todoBoardPath(boardId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const board = await readBoardResponse(res);
    if (body.title !== undefined || body.visibility !== undefined || body.color !== undefined) {
        _boardsListCache.invalidate();
    }
    return board;
}

export async function createTodoBoardLabel(boardId: number, body: {
    title: string;
    color?: string;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoBoardLabel(boardId: number, labelId: number, body: {
    title?: string;
    color?: string;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/labels/${labelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoBoardLabel(boardId: number, labelId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/labels/${labelId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function createTodoColumn(boardId: number, body: {
    title: string;
    color?: string;
    insert_at?: number;
    isCollapsed?: boolean;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoColumn(boardId: number, columnId: number, body: {
    title?: string;
    color?: string;
    isCollapsed?: boolean;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns/${columnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoColumn(boardId: number, columnId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns/${columnId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function reorderTodoColumns(boardId: number, orderedColumnIds: number[]): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_column_ids: orderedColumnIds }),
    });
    return readBoardResponse(res);
}
export async function createTodoCard(boardId: number, columnId: number, body: {
    title: string;
    body?: string;
    insert_at?: number;
    dueAt?: string | null;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns/${columnId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoCard(boardId: number, cardId: number, body: PatchTodoCardPayload): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoCard(boardId: number, cardId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function reorderTodoCardsInColumn(boardId: number, columnId: number, orderedCardIds: number[]): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns/${columnId}/cards/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_card_ids: orderedCardIds, orderedCardIds }),
    });
    return readBoardResponse(res);
}
export async function createTodoChecklistItem(boardId: number, cardId: number, body: {
    title: string;
    insert_at?: number;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/checklist/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoChecklistItem(boardId: number, cardId: number, itemId: number, body: {
    title?: string;
    isDone?: boolean;
}): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/checklist/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoChecklistItem(boardId: number, cardId: number, itemId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/checklist/items/${itemId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function reorderTodoChecklist(boardId: number, cardId: number, orderedItemIds: number[]): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/checklist/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedItemIds }),
    });
    return readBoardResponse(res);
}
export async function uploadTodoCardAttachment(boardId: number, cardId: number, file: File, init?: Pick<RequestInit, 'signal'>): Promise<TodoBoard> {
    const fd = new FormData();
    const name = file.name || 'file';
    fd.append('file', file, name);
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/attachments`, {
        method: 'POST',
        body: fd,
        ...init,
    });
    return readBoardResponse(res);
}
export async function deleteTodoCardAttachment(boardId: number, cardId: number, attachmentId: number): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/attachments/${attachmentId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function postTodoCardComment(boardId: number, cardId: number, body: string): Promise<TodoBoard> {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
    });
    return readBoardResponse(res);
}


export function findNewestCardInColumn(board: TodoBoard, columnId: number): TodoBoardCard | null {
    const col = board.columns.find((c) => c.id === columnId);
    const cards = col?.cards ?? [];
    if (!cards.length)
        return null;
    return cards.reduce((best, c) => (c.id > best.id ? c : best), cards[0]!);
}
