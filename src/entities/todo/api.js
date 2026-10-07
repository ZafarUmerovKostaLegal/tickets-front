import { apiFetch } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
import { toTodoBoardBackgroundMediaApiPath } from './lib/boardBackgroundUrl';
const TODOS = '/api/v1/todos';
const LEGACY_BOARD = `${TODOS}/board`;
const BOARDS_LIST_TTL_MS = 2 * 60_000;
const _boardsListCache = createQueryCache({ ttlMs: BOARDS_LIST_TTL_MS });
const BOARDS_LIST_KEY = 'boards-list';
export function invalidateTodoBoardsListCache() {
    _boardsListCache.invalidate();
}
export function todoBoardPath(boardId) {
    return `${TODOS}/boards/${boardId}`;
}
function parseHttpError(status, text) {
    let msg = `Ошибка ${status}`;
    if (!text)
        return new Error(msg);
    try {
        const j = JSON.parse(text);
        const d = j.detail;
        if (typeof d === 'string')
            msg = d;
        else if (Array.isArray(d) && d.length) {
            const first = d[0];
            if (typeof first?.msg === 'string')
                msg = first.msg;
        }
        else if (d && typeof d === 'object' && !Array.isArray(d)) {
            const obj = d;
            const m = typeof obj.message === 'string' ? obj.message : null;
            const hint = typeof obj.hint === 'string' ? obj.hint : null;
            const pg = typeof obj.postgres === 'string' ? obj.postgres : null;
            const parts = [];
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
function numField(o, snake, camel, fallback = 0) {
    const v = o[snake] ?? o[camel];
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}
function boolField(o, snake, camel) {
    const v = o[snake] ?? o[camel];
    return Boolean(v);
}
function strField(o, snake, camel) {
    const v = o[snake] ?? o[camel];
    return typeof v === 'string' ? v : null;
}
function numFieldNullable(o, snake, camel) {
    const v = o[snake] ?? o[camel];
    if (v == null || v === '')
        return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}
export function parseTodoBoardSummary(raw) {
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
function parseBoardJsonText(text) {
    if (!text)
        throw new Error('Пустой ответ сервера');
    const raw = JSON.parse(text);
    const board = raw;
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
async function readBoardResponse(res) {
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    return parseBoardJsonText(text);
}
export function pickPreferredTodoBoardId(data) {
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
async function _fetchTodoBoardsListFromApi() {
    const res = await apiFetch(`${TODOS}/boards`);
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    const raw = JSON.parse(text);
    const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
    const items = itemsRaw.map((x) => parseTodoBoardSummary(x));
    return {
        items,
        current_board_id: numFieldNullable(raw, 'current_board_id', 'currentBoardId'),
        last_selected_board_id: numFieldNullable(raw, 'last_selected_board_id', 'lastSelectedBoardId'),
    };
}
export async function fetchTodoBoardsList() {
    return _boardsListCache.fetch(BOARDS_LIST_KEY, _fetchTodoBoardsListFromApi);
}
export async function putTodoBoardCurrent(boardId) {
    const res = await apiFetch(`${TODOS}/boards/current`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId }),
    });
    return readBoardResponse(res);
}
export async function uploadTodoBoardBackground(boardId, file, init) {
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
function filenameFromContentDisposition(header, fallback) {
    if (!header)
        return fallback;
    const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
    if (utf?.[1]) {
        try {
            return decodeURIComponent(utf[1].trim());
        }
        catch {
            return utf[1].trim();
        }
    }
    const plain = /filename="([^"]+)"/i.exec(header) || /filename=([^;]+)/i.exec(header);
    if (plain?.[1])
        return plain[1].trim().replace(/^["']|["']$/g, '');
    return fallback;
}
/** Скачать доску как JSON (kosta_todos). */
export async function exportTodoBoard(boardId) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/export`);
    if (!res.ok) {
        const text = await res.text();
        throw parseHttpError(res.status, text);
    }
    const blob = await res.blob();
    const filename = filenameFromContentDisposition(res.headers.get('Content-Disposition'), `board-${boardId}.json`);
    return { blob, filename };
}
/** Импорт JSON (наш экспорт или Trello) → новая доска. */
export async function importTodoBoard(file, init) {
    const fd = new FormData();
    fd.append('file', file, file.name || 'board.json');
    const res = await apiFetch(`${TODOS}/boards/import`, {
        method: 'POST',
        body: fd,
        ...init,
    });
    invalidateTodoBoardsListCache();
    return readBoardResponse(res);
}
export async function deleteTodoBoardBackground(boardId) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/background`, { method: 'DELETE' });
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    if (text.trim())
        return parseBoardJsonText(text);
    return fetchTodoBoardById(boardId);
}
export async function fetchTodoBoardCurrent() {
    const res = await apiFetch(`${TODOS}/boards/current`);
    if (res.ok)
        return readBoardResponse(res);
    if (res.status === 404) {
        const leg = await apiFetch(LEGACY_BOARD);
        return readBoardResponse(leg);
    }
    return readBoardResponse(res);
}
export async function fetchTodoBoardById(boardId) {
    const res = await apiFetch(todoBoardPath(boardId));
    return readBoardResponse(res);
}
export async function fetchTodoBoard() {
    return fetchTodoBoardCurrent();
}
export async function createTodoBoard(body) {
    const payload = {
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
export async function deleteTodoBoard(boardId) {
    const res = await apiFetch(todoBoardPath(boardId), { method: 'DELETE' });
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    _boardsListCache.invalidate();
}
function parseTodoBoardInvite(raw) {
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
async function readInvitesListResponse(res) {
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    const raw = JSON.parse(text);
    const items = Array.isArray(raw.items) ? raw.items : [];
    return items.map((x) => parseTodoBoardInvite(x));
}
export async function fetchMyTodoInvites() {
    const res = await apiFetch(`${TODOS}/invites`);
    return readInvitesListResponse(res);
}
export async function acceptTodoInvite(inviteId) {
    const res = await apiFetch(`${TODOS}/invites/${inviteId}/accept`, { method: 'POST' });
    return readBoardResponse(res);
}
export async function declineTodoInvite(inviteId) {
    const res = await apiFetch(`${TODOS}/invites/${inviteId}/decline`, { method: 'POST' });
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
}
export async function revokeTodoInvite(inviteId) {
    const res = await apiFetch(`${TODOS}/invites/${inviteId}/revoke`, { method: 'POST' });
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
}
export async function fetchTodoBoardInvites(boardId) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/invites`);
    return readInvitesListResponse(res);
}
export async function createTodoBoardInvites(boardId, body) {
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
function parseTodoBoardMember(raw) {
    return {
        user_id: numField(raw, 'user_id', 'userId', 0),
        role: strField(raw, 'role', 'role') ?? '',
        joined_at: strField(raw, 'joined_at', 'joinedAt'),
    };
}
async function readMembersListResponse(res) {
    const text = await res.text();
    if (!res.ok)
        throw parseHttpError(res.status, text);
    const raw = JSON.parse(text);
    const items = Array.isArray(raw.items) ? raw.items : [];
    return { items: items.map((x) => parseTodoBoardMember(x)) };
}
export async function fetchTodoBoardMembers(boardId) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/members`);
    return readMembersListResponse(res);
}
export async function addTodoBoardMembers(boardId, body) {
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
export async function patchTodoBoardMemberRole(boardId, memberUserId, role) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/members/${memberUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
    });
    return readMembersListResponse(res);
}
export async function removeTodoBoardMember(boardId, memberUserId) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/members/${memberUserId}`, { method: 'DELETE' });
    return readMembersListResponse(res);
}
export async function patchTodoBoard(boardId, body) {
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
export async function createTodoBoardLabel(boardId, body) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoBoardLabel(boardId, labelId, body) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/labels/${labelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoBoardLabel(boardId, labelId) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/labels/${labelId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function createTodoColumn(boardId, body) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoColumn(boardId, columnId, body) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns/${columnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoColumn(boardId, columnId) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns/${columnId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function reorderTodoColumns(boardId, orderedColumnIds) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_column_ids: orderedColumnIds }),
    });
    return readBoardResponse(res);
}
export async function createTodoCard(boardId, columnId, body) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns/${columnId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoCard(boardId, cardId, body) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoCard(boardId, cardId) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function reorderTodoCardsInColumn(boardId, columnId, orderedCardIds) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/columns/${columnId}/cards/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_card_ids: orderedCardIds, orderedCardIds }),
    });
    return readBoardResponse(res);
}
export async function createTodoChecklistItem(boardId, cardId, body) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/checklist/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function patchTodoChecklistItem(boardId, cardId, itemId, body) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/checklist/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return readBoardResponse(res);
}
export async function deleteTodoChecklistItem(boardId, cardId, itemId) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/checklist/items/${itemId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function reorderTodoChecklist(boardId, cardId, orderedItemIds) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/checklist/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedItemIds }),
    });
    return readBoardResponse(res);
}
export async function uploadTodoCardAttachment(boardId, cardId, file, init) {
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
export async function deleteTodoCardAttachment(boardId, cardId, attachmentId) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/attachments/${attachmentId}`, { method: 'DELETE' });
    return readBoardResponse(res);
}
export async function postTodoCardComment(boardId, cardId, body) {
    const res = await apiFetch(`${todoBoardPath(boardId)}/cards/${cardId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
    });
    return readBoardResponse(res);
}
export function findNewestCardInColumn(board, columnId) {
    const col = board.columns.find((c) => c.id === columnId);
    const cards = col?.cards ?? [];
    if (!cards.length)
        return null;
    return cards.reduce((best, c) => (c.id > best.id ? c : best), cards[0]);
}
