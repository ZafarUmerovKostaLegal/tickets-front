import type { TodoBoard, TodoBoardCard, TodoBoardLabel } from '@entities/todo';
import { splitCardBody } from '@entities/todo/lib/todoCardBodyCodec';
import { isoDueToParts } from '@entities/todo/lib/todoDueAt';
import type { ArchivedCard, ArchivedColumn, TodoCard, TodoCardAttachment, TodoCardComment } from '@entities/todo/lib/todoUtils';
function mapApiAttachmentsList(raw: unknown): TodoCardAttachment[] {
    if (!Array.isArray(raw))
        return [];
    const out: TodoCardAttachment[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object')
            continue;
        const a = item as Record<string, unknown>;
        const id = a.id;
        if (id === undefined || id === null)
            continue;
        const idStr = String(id);
        const nameRaw = a.original_filename ?? a.originalFilename;
        const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : 'Вложение';
        const mimeRaw = a.mime_type ?? a.mimeType;
        const mimeType = typeof mimeRaw === 'string' && mimeRaw ? mimeRaw : undefined;
        const sizeRaw = a.size_bytes ?? a.sizeBytes;
        const sizeBytes = typeof sizeRaw === 'number' && Number.isFinite(sizeRaw)
            ? sizeRaw
            : Number(sizeRaw) || undefined;
        const mediaRaw = a.media_url ?? a.mediaUrl;
        const mediaUrl = typeof mediaRaw === 'string' && mediaRaw.trim() ? mediaRaw.trim() : undefined;
        out.push({ id: idStr, name, mimeType, sizeBytes, mediaUrl });
    }
    return out;
}
export function apiCardToTodoCard(c: TodoBoardCard): TodoCard {
    const { description, extras } = splitCardBody(c.body);
    const dueParts = isoDueToParts(c.due_at);
    const labelsFromApi = c.labels?.map((l) => ({
        id: String(l.id),
        text: l.title,
        color: l.color,
    })) ?? [];
    const checklistFromApi = c.checklist?.map((it) => ({
        id: String(it.id),
        text: it.title,
        done: it.is_done,
        position: it.position,
    })) ?? [];
    const attachmentsFromApi = mapApiAttachmentsList(c.attachments as unknown);
    const commentsFromApi: TodoCardComment[] | undefined = c.comments && c.comments.length > 0
        ? c.comments.map((cm) => ({
            id: String(cm.id),
            userId: cm.user_id,
            body: cm.body,
            createdAt: cm.created_at,
        }))
        : undefined;
    const fromApi = c.participant_user_ids?.length ? [...c.participant_user_ids] : undefined;
    const fromLegacy = extras.members
        ?.map((x) => Number(x))
        .filter((n) => !Number.isNaN(n));
    const participantUserIdsRaw = fromApi?.length ? fromApi : fromLegacy?.length ? fromLegacy : undefined;
    const participantUserIds = participantUserIdsRaw?.length ? participantUserIdsRaw : undefined;
    return {
        id: String(c.id),
        title: c.title,
        ...(c.created_at ? { createdAt: c.created_at } : {}),
        description: description || undefined,
        completed: c.is_completed,
        dueDate: dueParts.dueDate ?? extras.dueDate,
        dueTime: dueParts.dueTime ?? extras.dueTime,
        startDate: extras.startDate,
        startTime: extras.startTime,
        dueAtIso: dueParts.dueAtIso,
        labels: labelsFromApi.length ? labelsFromApi : extras.labels,
        checklist: checklistFromApi.length ? checklistFromApi : extras.checklist,
        attachments: attachmentsFromApi.length ? attachmentsFromApi : extras.attachments,
        participantUserIds: participantUserIds?.length ? participantUserIds : undefined,
        comments: commentsFromApi,
    };
}
function columnIsCollapsed(col: TodoBoard['columns'][number]): boolean {
    const o = col as {
        is_collapsed?: boolean;
        isCollapsed?: boolean;
    };
    if (typeof o.is_collapsed === 'boolean')
        return o.is_collapsed;
    if (typeof o.isCollapsed === 'boolean')
        return o.isCollapsed;
    return false;
}
function columnIsArchived(col: TodoBoard['columns'][number]): boolean {
    const o = col as {
        is_archived?: boolean;
        isArchived?: boolean;
    };
    return o.is_archived === true || o.isArchived === true;
}
function cardIsArchived(c: TodoBoardCard): boolean {
    return c.is_archived === true;
}
function toArchivedCard(c: TodoBoardCard, columnId: string): ArchivedCard {
    const todo = apiCardToTodoCard(c);
    const snapshotLabelIds = c.labels?.map((l) => l.id).filter((n) => Number.isFinite(n));
    const snapshotParticipantUserIds = c.participant_user_ids?.length ? [...c.participant_user_ids] : undefined;
    return {
        ...todo,
        archivedAt: c.created_at ?? new Date().toISOString(),
        fromColumn: columnId,
        snapshotLabelIds: snapshotLabelIds?.length ? snapshotLabelIds : undefined,
        snapshotParticipantUserIds,
        snapshotDueAt: c.due_at ?? undefined,
    };
}
export function unpackBoard(board: TodoBoard): {
    columnOrder: string[];
    columnTitles: Record<string, string>;
    columnColors: Record<string, string>;
    collapsedColumns: Record<string, boolean>;
    cards: Record<string, TodoCard[]>;
    boardLabels: TodoBoardLabel[];
    archivedCards: ArchivedCard[];
    archivedColumns: ArchivedColumn[];
} {
    const sortedCols = [...board.columns].sort((a, b) => a.position - b.position);
    const columnOrder: string[] = [];
    const columnTitles: Record<string, string> = {};
    const columnColors: Record<string, string> = {};
    const collapsedColumns: Record<string, boolean> = {};
    const cards: Record<string, TodoCard[]> = {};
    const archivedCards: ArchivedCard[] = [];
    const archivedColumns: ArchivedColumn[] = [];
    const boardLabels = [...(board.board_labels ?? [])].sort((a, b) => a.position - b.position);
    for (const col of sortedCols) {
        const id = String(col.id);
        columnTitles[id] = col.title;
        columnColors[id] = col.color;
        collapsedColumns[id] = columnIsCollapsed(col);
        const sortedCards = [...col.cards].sort((a, b) => a.position - b.position);
        for (const c of sortedCards) {
            if (cardIsArchived(c))
                archivedCards.push(toArchivedCard(c, id));
        }
        if (columnIsArchived(col)) {
            archivedColumns.push({
                id,
                title: col.title,
                color: col.color,
                cardCount: sortedCards.filter((c) => !cardIsArchived(c)).length,
            });
            continue;
        }
        columnOrder.push(id);
        cards[id] = sortedCards.filter((c) => !cardIsArchived(c)).map(apiCardToTodoCard);
    }
    return { columnOrder, columnTitles, columnColors, collapsedColumns, cards, boardLabels, archivedCards, archivedColumns };
}
export function resolveCalendarColumnId(slot: 'today' | 'week' | 'later', columnOrder: string[], columnTitles: Record<string, string>): string | undefined {
    const titleNeedle: Record<typeof slot, string> = {
        today: 'сегодня',
        week: 'на этой неделе',
        later: 'позже',
    };
    const needle = titleNeedle[slot];
    const byTitle = columnOrder.find((id) => (columnTitles[id] ?? '').toLowerCase().trim() === needle);
    if (byTitle)
        return byTitle;
    const idx = slot === 'today' ? 0 : slot === 'week' ? 1 : 2;
    return columnOrder[idx];
}
