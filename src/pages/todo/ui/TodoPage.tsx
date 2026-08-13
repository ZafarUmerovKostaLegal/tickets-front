import { lazy, Suspense, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AttentionBanner } from '@shared/ui';
import { routes } from '@shared/config';
import { stripHtmlToText } from '@shared/lib/sanitizeHtml';
import { createTodoBoard, createTodoCard, createTodoColumn, deleteTodoBoardBackground, deleteTodoCard, deleteTodoColumn, exportTodoBoard, fetchTodoBoardById, fetchTodoBoardCurrent, fetchTodoBoardsList, findNewestCardInColumn, importTodoBoard, invalidateTodoInvites, patchTodoCard, patchTodoColumn, pickPreferredTodoBoardId, putTodoBoardCurrent, reorderTodoCardsInColumn, reorderTodoColumns, uploadTodoBoardBackground, useTodoInvitesBadge, type CreateTodoBoardBody, type PatchTodoCardPayload, type TodoBoard, type TodoBoardLabel, type TodoBoardSummary, } from '@entities/todo';
import { boardBackgroundStorageKey, pickBoardBackgroundApiPath, resolveBoardBackgroundDisplayUrl, } from '@entities/todo/lib/boardBackgroundUrl';
import { fetchMediaBlob } from '@shared/api';
import { downloadBlob } from '@shared/lib/downloadBlob';
import { resolveCalendarColumnId, unpackBoard } from '@entities/todo/lib/boardMapper';
import { cardDueDateTimeToIso } from '@entities/todo/lib/todoDueAt';
import { buildMonthGrid, type TodoCard, type ArchivedCard, type ColumnId, type TodoColumnListSortMode, } from '@entities/todo/lib/todoUtils';
import { createDefaultTodoThemeVars, deriveThemeFromImage } from '@entities/todo/lib/todoTheme';
import { getCalendarStatus, getCalendarEvents, connectOutlookCalendar, createCalendarEvent, CALENDAR_NOT_CONNECTED_MSG, type CalendarEvent, } from '@entities/todo/lib/calendarApi';
import type { User } from '@entities/user';
import { listColleaguesAsUsers } from '@entities/contacts';
import { useUserPublic } from '@shared/hooks';
import { isHiddenSystemUser } from '@shared/lib';
import { buildTodoUserByIdMap, publicUserAsUser, type TodoBoardUsers } from '@entities/todo/lib/todoUserDisplay';
import { setCalendarCache } from '@entities/todo/lib/calendarCache';
import { IconImage, IconSettings, IconDownload, IconUpload, IconPlus, IconTrash, } from './TodoIcons';
import { TodoPlanner } from './TodoPlanner';
import { TodoColumn } from './TodoColumn';
import { TodoBoardsBar } from './TodoBoardsBar';
import { formatTodoArchiveClear, formatTodoFromColumn, todoLocaleTag, useI18n } from '@shared/i18n';
import {
    parseBoardTitleFromNotificationDescription,
    subscribeNotificationPush,
    TODO_NOTIFICATION_TYPES,
} from '@entities/notification/wsClient';
import {
    canEditKanbanStructure,
    canManageBoardMembers,
    isParticipantBoardRole,
    isViewerBoardRole,
} from '@entities/todo/lib/boardRoles';
import { showToast } from '@shared/ui/app-toast/appToastGate';
import { TodoInvitesPanel } from './TodoInvitesPanel';
import './TodoPage.css';

const TodoAddColumnModal = lazy(() => import('./TodoAddColumnModal').then((m) => ({ default: m.TodoAddColumnModal })));
const TodoAddCardModal = lazy(() => import('./TodoAddCardModal').then((m) => ({ default: m.TodoAddCardModal })));
const TodoCardModal = lazy(() => import('./TodoCardModal').then((m) => ({ default: m.TodoCardModal })));
const TodoBoardMembersModal = lazy(() => import('./TodoBoardMembersModal').then((m) => ({ default: m.TodoBoardMembersModal })));
function sortKeyTimeForColumnList(c: TodoCard): number {
    if (c.createdAt) {
        const t = new Date(c.createdAt).getTime();
        if (!Number.isNaN(t))
            return t;
    }
    if (c.fromCalendar && c.dueDate?.trim()) {
        const tm = c.dueTime?.trim() ? `T${c.dueTime}` : 'T12:00';
        const t = new Date(`${c.dueDate}${tm}`).getTime();
        if (!Number.isNaN(t))
            return t;
    }
    const cal = /^cal-(.+)$/i.exec(c.id);
    if (cal) {
        const tail = cal[1]!;
        let h = 0;
        for (let i = 0; i < tail.length; i += 1)
            h = (h * 31 + tail.charCodeAt(i)) | 0;
        return h;
    }
    const n = Number.parseInt(c.id, 10);
    return Number.isFinite(n) ? n : 0;
}
function resolveCardInsertIndex(clientY: number, columnId: string, draggedCardId: string): number {
    const columnEl = document.querySelector(`[data-todo-column-id="${columnId}"]`);
    const cardsEl = columnEl?.querySelector('.todo-column__cards');
    if (!cardsEl)
        return 0;
    const cardEls = Array.from(cardsEl.querySelectorAll('[data-todo-card-id]')) as HTMLElement[];
    const others = cardEls.filter((el) => el.getAttribute('data-todo-card-id') !== draggedCardId);
    for (let i = 0; i < others.length; i += 1) {
        const rect = others[i].getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (clientY < mid)
            return i;
    }
    return others.length;
}
function manualPositionInColumn(displayCards: TodoCard[], manualCards: TodoCard[], insertIndex: number, excludeCardId?: string): number {
    const manualIds = new Set(manualCards.map((c) => c.id));
    const visible = displayCards
        .filter((c) => c.id !== excludeCardId)
        .map((c) => c.id);
    const clamped = Math.max(0, Math.min(insertIndex, visible.length));
    return visible.slice(0, clamped).filter((id) => manualIds.has(id)).length;
}
function computeManualCardOrderAfterDrop(displayCards: TodoCard[], manualCards: TodoCard[], draggedCardId: string, insertIndex: number): number[] | null {
    const manualIds = new Set(manualCards.map((c) => c.id));
    if (!manualIds.has(draggedCardId))
        return null;
    const firstManualIdx = displayCards.findIndex((c) => manualIds.has(c.id));
    const effectiveInsert = firstManualIdx < 0
        ? insertIndex
        : Math.max(insertIndex, firstManualIdx);
    const visibleIds = displayCards.map((c) => c.id);
    const without = visibleIds.filter((id) => id !== draggedCardId);
    const clamped = Math.max(0, Math.min(effectiveInsert, without.length));
    without.splice(clamped, 0, draggedCardId);
    const newManualOrder = without.filter((id) => manualIds.has(id)).map((id) => Number(id));
    const oldManualOrder = manualCards.map((c) => Number(c.id));
    if (newManualOrder.length !== oldManualOrder.length)
        return null;
    if (newManualOrder.join(',') === oldManualOrder.join(','))
        return null;
    return newManualOrder;
}
export function TodoPage() {
    const { t, locale } = useI18n();
    const [searchParams, setSearchParams] = useSearchParams();
    const { count: invitesCount } = useTodoInvitesBadge(true);
    const dateLocale = todoLocaleTag(locale);
    const [plannerCollapsed, setPlannerCollapsed] = useState(false);
    const [mobilePlannerOpen, setMobilePlannerOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [prevBackground, setPrevBackground] = useState<string | null>(null);
    const [bgTransitioning, setBgTransitioning] = useState(false);
    const [bgUploading, setBgUploading] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [columnOrder, setColumnOrder] = useState<ColumnId[]>([]);
    const [columnTitles, setColumnTitles] = useState<Record<string, string>>({});
    const [columnColors, setColumnColors] = useState<Record<string, string>>({});
    const [boardError, setBoardError] = useState<string | null>(null);
    const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
    const [boardSummaries, setBoardSummaries] = useState<TodoBoardSummary[]>([]);
    const [boardListError, setBoardListError] = useState<string | null>(null);

    const [effectiveBoardMyRole, setEffectiveBoardMyRole] = useState<string | null>(null);
    const [invitesOpen, setInvitesOpen] = useState(() => searchParams.get('invites') === '1');
    useEffect(() => {
        if (searchParams.get('invites') !== '1')
            return;
        setInvitesOpen(true);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('invites');
            return next;
        }, { replace: true });
    }, [searchParams, setSearchParams]);
    const [membersModalOpen, setMembersModalOpen] = useState(false);
    const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
    const [columnListSort, setColumnListSort] = useState<Record<string, TodoColumnListSortMode>>({});
    const [columnHideCompleted, setColumnHideCompleted] = useState<Record<string, boolean>>({});
    const [draggingColumn, setDraggingColumn] = useState<ColumnId | null>(null);
    const [dropTarget, setDropTarget] = useState<ColumnId | null>(null);
    const [columnDragPreviewPosition, setColumnDragPreviewPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const columnDragOffsetRef = useRef({ x: 0, y: 0 });
    const [draggingCard, setDraggingCard] = useState<{
        columnId: string;
        cardId: string;
    } | null>(null);
    const [dropTargetCardColumn, setDropTargetCardColumn] = useState<ColumnId | null>(null);
    const dropTargetCardColumnRef = useRef<ColumnId | null>(null);
    const dropTargetCardInsertIndexRef = useRef(0);
    const [dragPreviewPosition, setDragPreviewPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const cardDragOffsetRef = useRef({ x: 0, y: 0 });
    const pendingCardDragRef = useRef<{
        columnId: string;
        cardId: string;
        cardRect: DOMRect;
        startX: number;
        startY: number;
        pointerId: number;
        pointerType: string;
        pointerElement: Element | null;
        fromDragHandle: boolean;
    } | null>(null);
    const [pendingCardDragActive, setPendingCardDragActive] = useState(false);
    const [touchPressCard, setTouchPressCard] = useState<{
        columnId: string;
        cardId: string;
    } | null>(null);
    const activeCardPointerIdRef = useRef<number | null>(null);
    const cardDidDragRef = useRef(false);
    const [calendarColumnOverrides, setCalendarColumnOverrides] = useState<Record<string, ColumnId>>(() => {
        const CALENDAR_OVERRIDES_KEY = 'todoCalendarColumnOverrides';
        try {
            const raw = localStorage.getItem(CALENDAR_OVERRIDES_KEY);
            if (!raw)
                return {};
            const parsed = JSON.parse(raw) as Record<string, string>;
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        }
        catch {
            return {};
        }
    });
    const calendarOverridesKey = 'todoCalendarColumnOverrides';
    useEffect(() => {
        try {
            localStorage.setItem(calendarOverridesKey, JSON.stringify(calendarColumnOverrides));
        }
        catch {
        }
    }, [calendarColumnOverrides]);
    const [isPanning, setIsPanning] = useState(false);
    const [addCardColumn, setAddCardColumn] = useState<ColumnId | null>(null);
    const [addCardTitle, setAddCardTitle] = useState('');
    const [addCardSubmitting, setAddCardSubmitting] = useState(false);
    const [addColumnOpen, setAddColumnOpen] = useState(false);
    const [addColumnTitle, setAddColumnTitle] = useState('');
    const [cards, setCards] = useState<Record<string, TodoCard[]>>({
        today: [],
        week: [],
        later: [],
    });
    const [boardLabels, setBoardLabels] = useState<TodoBoardLabel[]>([]);
    const [selectedCard, setSelectedCard] = useState<{
        columnId: string;
        cardId: string;
    } | null>(null);
    const [archivedCards, setArchivedCards] = useState<ArchivedCard[]>([]);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [archiveSearch, setArchiveSearch] = useState('');
    const [calendarConnected, setCalendarConnected] = useState(false);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [calendarConnectError, setCalendarConnectError] = useState<string | null>(null);
    const calendarEventsFetchLock = useRef(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [, setSplashOut] = useState(false);
    const [, setSplashDone] = useState(false);
    const [addEventOpen, setAddEventOpen] = useState(false);
    const [addEventSubject, setAddEventSubject] = useState('');
    const [addEventDate, setAddEventDate] = useState('');
    const [addEventStartTime, setAddEventStartTime] = useState('09:00');
    const [addEventEndTime, setAddEventEndTime] = useState('10:00');
    const [addEventBody, setAddEventBody] = useState('');
    const [addEventError, setAddEventError] = useState<string | null>(null);
    const [addEventSaving, setAddEventSaving] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const importFileInputRef = useRef<HTMLInputElement | null>(null);
    const [boardIoBusy, setBoardIoBusy] = useState<'export' | 'import' | null>(null);
    const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const columnsScrollRef = useRef<HTMLDivElement | null>(null);
    const panStartXRef = useRef(0);
    const panStartScrollRef = useRef(0);
    const prevRectsRef = useRef<Record<string, DOMRect> | null>(null);
    const dropTargetRef = useRef<ColumnId | null>(null);
    const boardBackgroundSourceUrlRef = useRef<string | null>(null);
    const boardBackgroundBoardIdRef = useRef<number | null>(null);
    const boardSummariesRef = useRef(boardSummaries);
    boardSummariesRef.current = boardSummaries;
    const [themeVars, setThemeVars] = useState(() => createDefaultTodoThemeVars());
    const [todoUsersList, setTodoUsersList] = useState<User[]>([]);
    const [todoUsersLoading, setTodoUsersLoading] = useState(true);
    const [todoUsersError, setTodoUsersError] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        listColleaguesAsUsers()
            .then((list) => {
                if (!cancelled) {
                    setTodoUsersList(list.filter((u) => !isHiddenSystemUser(u)));
                    setTodoUsersError(null);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setTodoUsersList([]);
                    setTodoUsersError(e instanceof Error ? e.message : t('todoPage.errors.loadUsers'));
                }
            })
            .finally(() => {
                if (!cancelled)
                    setTodoUsersLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [t]);
    const [referencedUserIds, setReferencedUserIds] = useState<number[]>([]);
    const referencedPublicById = useUserPublic(referencedUserIds);
    const todoBoardUsers = useMemo((): TodoBoardUsers => {
        const byId = buildTodoUserByIdMap(todoUsersList);
        for (const [id, pub] of referencedPublicById) {
            if (byId.has(id))
                continue;
            byId.set(id, publicUserAsUser(id, pub));
        }
        return {
            byId,
            list: todoUsersList,
            loading: todoUsersLoading,
            error: todoUsersError,
        };
    }, [todoUsersList, todoUsersLoading, todoUsersError, referencedPublicById]);
    const today = useMemo(() => new Date(), []);
    const monthDays = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);
    const monthLabel = currentMonth.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
    const stripHtml = useCallback((html: string): string => {
        const preclean = html
            .replace(/<img\b[^>]*>/gi, ' ')
            .replace(/\s(?:src|href|poster)\s*=\s*"cid:[^"]*"/gi, ' ')
            .replace(/\s(?:src|href|poster)\s*=\s*'cid:[^']*'/gi, ' ')
            .replace(/\surl\(\s*(["']?)cid:[^)"']+\1\s*\)/gi, ' url(none)');
        const text = stripHtmlToText(preclean);
        return text.replace(/\s+/g, ' ').trim();
    }, []);
    const calendarCardsByColumn = useMemo(() => {
        const result: Record<string, TodoCard[]> = {};
        for (const id of columnOrder) {
            result[id] = [];
        }
        const expired: ArchivedCard[] = [];
        if (!calendarEvents.length)
            return { columns: result, expired };
        const todayCol = resolveCalendarColumnId('today', columnOrder, columnTitles);
        const weekCol = resolveCalendarColumnId('week', columnOrder, columnTitles);
        const laterCol = resolveCalendarColumnId('later', columnOrder, columnTitles);
        const fallbackFrom = todayCol ?? columnOrder[0] ?? '';
        const now = new Date();
        const nowMs = now.getTime();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        const weekDay = todayStart.getDay();
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - ((weekDay + 6) % 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const pad2 = (n: number) => n.toString().padStart(2, '0');
        for (const ev of calendarEvents) {
            if (!ev.start?.dateTime)
                continue;
            let dt = ev.start.dateTime;
            if (ev.start.timeZone === 'UTC' && !dt.endsWith('Z') && !dt.includes('+'))
                dt += 'Z';
            const d = new Date(dt);
            if (isNaN(d.getTime()))
                continue;
            let endMs = d.getTime();
            let timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
            if (ev.end?.dateTime) {
                let edt = ev.end.dateTime;
                if (ev.end.timeZone === 'UTC' && !edt.endsWith('Z') && !edt.includes('+'))
                    edt += 'Z';
                const e = new Date(edt);
                if (!isNaN(e.getTime())) {
                    timeStr += ` – ${pad2(e.getHours())}:${pad2(e.getMinutes())}`;
                    endMs = e.getTime();
                }
            }
            const card: TodoCard = {
                id: `cal-${ev.id}`,
                title: ev.subject ?? t('todoPage.eventDefault'),
                description: ev.body?.content ? stripHtml(ev.body.content) : '',
                fromCalendar: true,
                calendarEventId: ev.id,
                calendarTime: timeStr,
                dueDate: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
                dueTime: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
            };
            if (endMs < nowMs) {
                expired.push({
                    ...card,
                    completed: true,
                    archivedAt: new Date(endMs).toISOString(),
                    fromColumn: fallbackFrom,
                });
                continue;
            }
            if (d >= todayStart && d < todayEnd) {
                if (todayCol)
                    result[todayCol].push(card);
            }
            else if (d >= weekStart && d < weekEnd) {
                if (weekCol)
                    result[weekCol].push(card);
            }
            else if (laterCol) {
                result[laterCol].push(card);
            }
        }
        for (const id of columnOrder) {
            result[id].sort((a, b) => (a.dueTime ?? '').localeCompare(b.dueTime ?? ''));
        }
        expired.sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''));
        return { columns: result, expired };
    }, [calendarEvents, stripHtml, columnOrder, columnTitles, t]);
    const handlePrevMonth = useCallback(() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)), []);
    const handleNextMonth = useCallback(() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)), []);
    useEffect(() => {
        if (!menuOpen)
            return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node))
                setMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [menuOpen]);
    const applyBackground = useCallback((url: string, boardId: number, apiMediaPath?: string | null, allowBlobFallback = true) => {
        const img = new Image();
        img.onerror = () => {
            if (boardBackgroundBoardIdRef.current !== boardId)
                return;
            if (allowBlobFallback && apiMediaPath && !url.startsWith('blob:')) {
                const storageKey = boardBackgroundStorageKey(apiMediaPath);
                if (storageKey) {
                    void fetchMediaBlob(storageKey)
                        .then((blobUrl) => {
                            if (boardBackgroundBoardIdRef.current !== boardId)
                                return;
                            applyBackground(blobUrl, boardId, apiMediaPath, false);
                        })
                        .catch(() => {
                            if (boardBackgroundBoardIdRef.current !== boardId)
                                return;
                            boardBackgroundSourceUrlRef.current = null;
                            setBoardError(t('todoPage.errors.loadBoardBg'));
                        });
                    return;
                }
            }
            boardBackgroundSourceUrlRef.current = null;
            setBoardError(t('todoPage.errors.loadBoardBg'));
        };
        img.onload = () => {
            if (boardBackgroundBoardIdRef.current !== boardId)
                return;
            setBoardError(null);
            setPrevBackground((prev) => prev);
            setBackgroundImage((prev) => {
                setPrevBackground(prev);
                return url;
            });
            setBgTransitioning(true);
            setTimeout(() => {
                setBgTransitioning(false);
                setPrevBackground((prev) => {
                    if (prev && prev.startsWith('blob:'))
                        URL.revokeObjectURL(prev);
                    return null;
                });
            }, 1300);
        };
        img.src = url;
    }, [setBoardError, t]);
    const applyBoardFromApi = useCallback((board: TodoBoard, summaries?: TodoBoardSummary[]) => {
        const boardList = summaries ?? boardSummariesRef.current;
        const { columnOrder: ord, columnTitles: titles, columnColors: colors, collapsedColumns: collapsed, cards: nextCards, boardLabels: labels, } = unpackBoard(board);
        setColumnOrder(ord);
        setColumnTitles(titles);
        setColumnColors(colors);
        setCards(nextCards);
        setCollapsedColumns(collapsed);
        setBoardLabels(labels);
        const fromBoard = typeof board.my_role === 'string' && board.my_role.trim() ? board.my_role.trim() : null;
        const fromSummaryRaw = boardList.find((s) => s.id === board.id)?.my_role;
        const fromSummary = typeof fromSummaryRaw === 'string' && fromSummaryRaw.trim() ? fromSummaryRaw.trim() : null;
        setEffectiveBoardMyRole(fromBoard ?? fromSummary);
        const apiBg = pickBoardBackgroundApiPath(board, boardList);
        const boardChanged = board.id !== boardBackgroundBoardIdRef.current;
        const urlChanged = apiBg !== boardBackgroundSourceUrlRef.current;
        boardBackgroundBoardIdRef.current = board.id;
        if (apiBg) {
            if (boardChanged || urlChanged) {
                try {
                    const publicUrl = resolveBoardBackgroundDisplayUrl(apiBg);
                    if (publicUrl) {
                        boardBackgroundSourceUrlRef.current = apiBg;
                        applyBackground(publicUrl, board.id, apiBg);
                    }
                    else {
                        boardBackgroundSourceUrlRef.current = null;
                        setBoardError(t('todoPage.errors.boardBgUrl'));
                    }
                }
                catch (e: unknown) {
                    boardBackgroundSourceUrlRef.current = null;
                    setBoardError(e instanceof Error ? e.message : t('todoPage.errors.boardBgInvalid'));
                }
            }
        }
        else {
            boardBackgroundSourceUrlRef.current = null;
            setBackgroundImage((prev) => {
                if (prev && prev.startsWith('blob:'))
                    URL.revokeObjectURL(prev);
                return null;
            });
            setPrevBackground(null);
            setBgTransitioning(false);
            setThemeVars(createDefaultTodoThemeVars());
        }
    }, [applyBackground, setBoardError, t]);
    const commitBoard = useCallback(async (promise: Promise<TodoBoard>): Promise<TodoBoard | null> => {
        try {
            const b = await promise;
            applyBoardFromApi(b);
            setActiveBoardId(b.id);
            setBoardError(null);
            return b;
        }
        catch (e) {
            setBoardError(e instanceof Error ? e.message : t('todoPage.errors.saveBoard'));
            return null;
        }
    }, [applyBoardFromApi, t]);
    const reloadBoardSummaries = useCallback(() => {
        return fetchTodoBoardsList()
            .then((data) => {
                setBoardSummaries(data.items);
                setBoardListError(null);
            })
            .catch((err: unknown) => {
                setBoardSummaries([]);
                setBoardListError(err instanceof Error ? err.message : t('todoPage.errors.loadBoardList'));
            });
    }, [t]);
    const handleSelectTodoBoard = useCallback(async (boardId: number) => {
        if (boardId === activeBoardId)
            return;
        setInitialLoading(true);
        try {
            const [b, list] = await Promise.all([fetchTodoBoardById(boardId), fetchTodoBoardsList()]);
            setBoardSummaries(list.items);
            setBoardListError(null);
            applyBoardFromApi(b, list.items);
            setActiveBoardId(b.id);
            setBoardError(null);
            void putTodoBoardCurrent(boardId).catch(() => { });
        }
        catch (e: unknown) {
            setBoardError(e instanceof Error ? e.message : t('todoPage.errors.openBoard'));
        }
        finally {
            setInitialLoading(false);
        }
    }, [activeBoardId, applyBoardFromApi, t]);
    const handleCreateTodoBoard = useCallback(async (body: CreateTodoBoardBody) => {
        const b = await commitBoard(createTodoBoard(body));
        if (!b)
            throw new Error(t('todoPage.errors.createBoardFailed'));
        void putTodoBoardCurrent(b.id).catch(() => { });
        await reloadBoardSummaries();
    }, [commitBoard, reloadBoardSummaries, t]);
    const handlePickBackground = () => {
        fileInputRef.current?.click();
        setMenuOpen(false);
    };
    const handleExportBoard = useCallback(async () => {
        setMenuOpen(false);
        if (activeBoardId == null || boardIoBusy)
            return;
        setBoardIoBusy('export');
        try {
            const { blob, filename } = await exportTodoBoard(activeBoardId);
            downloadBlob(blob, filename);
            setBoardError(null);
        }
        catch (e: unknown) {
            setBoardError(e instanceof Error ? e.message : t('todoPage.errors.exportBoard'));
        }
        finally {
            setBoardIoBusy(null);
        }
    }, [activeBoardId, boardIoBusy, t]);
    const handlePickImport = () => {
        importFileInputRef.current?.click();
        setMenuOpen(false);
    };
    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || boardIoBusy)
            return;
        const name = (file.name || '').toLowerCase();
        if (!name.endsWith('.json')) {
            setBoardError(t('todoPage.errors.importJsonOnly'));
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            setBoardError(t('todoPage.errors.fileTooLarge'));
            return;
        }
        setBoardIoBusy('import');
        setInitialLoading(true);
        try {
            const board = await importTodoBoard(file);
            const list = await fetchTodoBoardsList();
            setBoardSummaries(list.items);
            setBoardListError(null);
            applyBoardFromApi(board, list.items);
            setActiveBoardId(board.id);
            setBoardError(null);
            void putTodoBoardCurrent(board.id).catch(() => { });
        }
        catch (err: unknown) {
            setBoardError(err instanceof Error ? err.message : t('todoPage.errors.importBoard'));
        }
        finally {
            setBoardIoBusy(null);
            setInitialLoading(false);
        }
    };
    const handleBackgroundChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        e.target.value = '';
        const blobUrl = URL.createObjectURL(file);
        if (activeBoardId != null) {
            boardBackgroundBoardIdRef.current = activeBoardId;
            applyBackground(blobUrl, activeBoardId, null);
        }
        setBgUploading(true);
        try {
            if (activeBoardId != null)
                await commitBoard(uploadTodoBoardBackground(activeBoardId, file));
        }
        catch {
        }
        finally {
            setBgUploading(false);
        }
    };
    const handleDeleteBackground = async () => {
        setMenuOpen(false);
        try {
            if (activeBoardId != null)
                await commitBoard(deleteTodoBoardBackground(activeBoardId));
            else {
                setBackgroundImage((prev) => {
                    if (prev && prev.startsWith('blob:'))
                        URL.revokeObjectURL(prev);
                    return null;
                });
                setThemeVars(createDefaultTodoThemeVars());
            }
            setBgTransitioning(false);
            setPrevBackground(null);
        }
        catch {
        }
    };
    useEffect(() => {
        if (!selectedCard)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setSelectedCard(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedCard]);
    useEffect(() => {
        if (!mobilePlannerOpen)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                setMobilePlannerOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [mobilePlannerOpen]);
    useEffect(() => {
        let cancelled = false;
        if (!backgroundImage) {
            setThemeVars(createDefaultTodoThemeVars());
            return;
        }
        deriveThemeFromImage(backgroundImage)
            .then((vars) => {
                if (!cancelled)
                    setThemeVars(vars);
            })
            .catch(() => {
                if (!cancelled)
                    setThemeVars(createDefaultTodoThemeVars());
            });
        return () => { cancelled = true; };
    }, [backgroundImage]);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const calendar = params.get('calendar');
        if (calendar === 'connected') {
            setCalendarConnected(true);
            window.history.replaceState({}, '', window.location.pathname);
        }
        if (calendar === 'error') {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);
    useEffect(() => {
        let cancelled = false;
        setInitialLoading(true);
        Promise.all([
            fetchTodoBoardsList()
                .then(async (data) => {
                    if (cancelled)
                        return;
                    setBoardSummaries(data.items);
                    setBoardListError(null);
                    try {
                        const preferredId = pickPreferredTodoBoardId(data);
                        let board: TodoBoard;
                        if (preferredId != null) {
                            board = await fetchTodoBoardById(preferredId);
                            if (cancelled)
                                return;
                            setActiveBoardId(board.id);
                            applyBoardFromApi(board, data.items);
                        }
                        else {
                            board = await fetchTodoBoardCurrent();
                            if (cancelled)
                                return;
                            setActiveBoardId(board.id);
                            applyBoardFromApi(board, data.items);
                        }
                        setBoardError(null);
                    }
                    catch (err: unknown) {
                        if (!cancelled)
                            setBoardError(err instanceof Error ? err.message : t('todoPage.errors.loadTodoBoard'));
                    }
                })
                .catch((err: unknown) => {
                    if (!cancelled) {
                        setBoardSummaries([]);
                        setBoardListError(err instanceof Error ? err.message : t('todoPage.errors.loadBoardList'));
                    }
                }),
            getCalendarStatus()
                .then(({ connected, detail }) => {
                    if (!cancelled) {
                        setCalendarConnected(connected);
                        setCalendarConnectError(connected ? null : detail ?? null);
                        setCalendarCache([], connected);
                    }
                })
                .catch(() => {
                    if (!cancelled) {
                        setCalendarConnected(false);
                        setCalendarConnectError(null);
                    }
                }),
        ]).finally(() => {
            if (!cancelled) {
                setInitialLoading(false);
                setSplashOut(true);
                setTimeout(() => setSplashDone(true), 500);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [applyBoardFromApi, t]);
    useEffect(() => {
        if (calendarConnected)
            setCalendarConnectError(null);
    }, [calendarConnected]);
    useEffect(() => {
        return subscribeNotificationPush((n) => {
            const kind = (n.notification_type ?? '').trim().toLowerCase();
            if (kind !== TODO_NOTIFICATION_TYPES.boardAdded
                && kind !== TODO_NOTIFICATION_TYPES.boardInvited
                && kind !== TODO_NOTIFICATION_TYPES.cardAssigned)
                return;
            const text = (n.title || n.description || '').trim();
            if (text)
                showToast({ message: text, variant: 'info' });
            void reloadBoardSummaries();
            if (kind === TODO_NOTIFICATION_TYPES.boardInvited) {
                invalidateTodoInvites();
                setInvitesOpen(true);
            }
            const titleFromDesc = parseBoardTitleFromNotificationDescription(n.description ?? '');
            if (titleFromDesc && (kind === TODO_NOTIFICATION_TYPES.boardAdded || kind === TODO_NOTIFICATION_TYPES.boardInvited)) {
                void fetchTodoBoardsList().then((data) => {
                    const match = data.items.find((b) => b.title.trim() === titleFromDesc);
                    if (match)
                        void handleSelectTodoBoard(match.id);
                }).catch(() => { });
            }
        });
    }, [reloadBoardSummaries, handleSelectTodoBoard]);
    const fetchCalendarEvents = useCallback(() => {
        if (!calendarConnected)
            return;
        if (calendarEventsFetchLock.current)
            return;
        calendarEventsFetchLock.current = true;
        setCalendarLoading(true);
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const viewMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const viewMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);
        const rangeStart = new Date(Math.min(todayStart.getTime(), viewMonthStart.getTime()));
        rangeStart.setMonth(rangeStart.getMonth() - 1);
        rangeStart.setHours(0, 0, 0, 0);
        const rangeEnd = new Date(Math.max(today.getTime(), viewMonthEnd.getTime()));
        rangeEnd.setMonth(rangeEnd.getMonth() + 1);
        rangeEnd.setHours(0, 0, 0, 0);
        getCalendarEvents(rangeStart.toISOString(), rangeEnd.toISOString())
            .then((events) => {
                setCalendarEvents(events);
                setCalendarCache(events, true);
            })
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : '';
                if (msg === CALENDAR_NOT_CONNECTED_MSG) {
                    setCalendarConnected(false);
                    setCalendarCache([], false);
                }
            })
            .finally(() => {
                calendarEventsFetchLock.current = false;
                setCalendarLoading(false);
            });
    }, [calendarConnected, currentMonth]);
    useEffect(() => { fetchCalendarEvents(); }, [fetchCalendarEvents]);
    const handleConnectCalendar = useCallback(() => {
        setCalendarConnectError(null);
        connectOutlookCalendar().catch((err) => {
            const msg = err instanceof Error ? err.message : t('todoPage.errors.connectCalendar');
            setCalendarConnectError(msg);
        });
    }, [t]);
    const handleOpenAddEvent = useCallback((date: Date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        setAddEventDate(`${y}-${m}-${d}`);
        setAddEventSubject('');
        setAddEventStartTime('09:00');
        setAddEventEndTime('10:00');
        setAddEventBody('');
        setAddEventError(null);
        setAddEventOpen(true);
    }, []);
    const handleSubmitEvent = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const subject = addEventSubject.trim();
        if (!subject) {
            setAddEventError(t('todoPage.errors.eventTitleRequired'));
            return;
        }
        if (!addEventDate) {
            setAddEventError(t('todoPage.errors.eventDateRequired'));
            return;
        }
        setAddEventSaving(true);
        setAddEventError(null);
        try {
            const startISO = `${addEventDate}T${addEventStartTime}:00`;
            const endISO = `${addEventDate}T${addEventEndTime}:00`;
            await createCalendarEvent({
                subject,
                start: new Date(startISO).toISOString(),
                end: new Date(endISO).toISOString(),
                body: addEventBody.trim() || undefined,
            });
            setAddEventOpen(false);
            fetchCalendarEvents();
        }
        catch (err) {
            setAddEventError(err instanceof Error ? err.message : t('todoPage.errors.createEvent'));
        }
        finally {
            setAddEventSaving(false);
        }
    }, [addEventSubject, addEventDate, addEventStartTime, addEventEndTime, addEventBody, fetchCalendarEvents, t]);
    const archivedCalIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const { expired } = calendarCardsByColumn;
        if (expired.length === 0)
            return;
        const newExpired = expired.filter(e => !archivedCalIdsRef.current.has(e.id));
        if (newExpired.length === 0)
            return;
        newExpired.forEach(e => archivedCalIdsRef.current.add(e.id));
        setArchivedCards(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const toAdd = newExpired.filter(c => !existingIds.has(c.id));
            return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
        });
    }, [calendarCardsByColumn]);
    useEffect(() => {
        const next = new Set<number>();
        for (const colId of columnOrder) {
            const list = cards[colId];
            if (!list)
                continue;
            for (const card of list) {
                if (card.participantUserIds) {
                    for (const uid of card.participantUserIds) {
                        if (uid > 0)
                            next.add(uid);
                    }
                }
                if (card.comments) {
                    for (const cm of card.comments) {
                        if (cm.userId > 0)
                            next.add(cm.userId);
                    }
                }
            }
        }
        const sorted = Array.from(next).sort((a, b) => a - b);
        setReferencedUserIds((prev) => {
            if (prev.length === sorted.length && prev.every((v, i) => v === sorted[i]))
                return prev;
            return sorted;
        });
    }, [cards, columnOrder]);
    const mergedCards = useMemo(() => {
        const result: Record<string, TodoCard[]> = {};
        const cols = calendarCardsByColumn.columns;
        const calendarByColumn: Record<string, TodoCard[]> = {};
        for (const id of columnOrder) {
            calendarByColumn[id] = [];
        }
        for (const colId of columnOrder) {
            const list = cols[colId] || [];
            for (const card of list) {
                const eventId = card.calendarEventId;
                const targetCol = eventId && calendarColumnOverrides[eventId] != null
                    ? calendarColumnOverrides[eventId]
                    : colId;
                if (columnOrder.includes(targetCol)) {
                    calendarByColumn[targetCol].push(card);
                }
            }
        }
        for (const id of columnOrder) {
            const manual = cards[id] || [];
            const calendar = calendarByColumn[id] || [];
            result[id] = [...calendar, ...manual];
        }
        return result;
    }, [cards, calendarCardsByColumn, columnOrder, calendarColumnOverrides]);
    const displayCardsByColumn = useMemo(() => {
        const out: Record<string, TodoCard[]> = {};
        for (const id of columnOrder) {
            let list = [...(mergedCards[id] ?? [])];
            if (columnHideCompleted[id]) {
                list = list.filter((c) => !c.completed);
            }
            const mode = columnListSort[id] ?? 'server';
            if (mode === 'server') {
                out[id] = list;
                continue;
            }
            switch (mode) {
                case 'az':
                    list.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
                    break;
                case 'za':
                    list.sort((a, b) => b.title.localeCompare(a.title, 'ru'));
                    break;
                case 'newest':
                    list.sort((a, b) => sortKeyTimeForColumnList(b) - sortKeyTimeForColumnList(a));
                    break;
                case 'oldest':
                    list.sort((a, b) => sortKeyTimeForColumnList(a) - sortKeyTimeForColumnList(b));
                    break;
                case 'done':
                    list.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));
                    break;
                default:
                    break;
            }
            out[id] = list;
        }
        return out;
    }, [mergedCards, columnOrder, columnListSort, columnHideCompleted]);
    const columnConfig = useMemo(() => columnOrder.map((id) => ({
        id,
        title: columnTitles[id] ?? id,
        collapsedLabel: `${columnTitles[id] ?? id} ${(displayCardsByColumn[id] || []).length}`,
        dotColor: columnColors[id],
    })), [columnOrder, columnTitles, columnColors, displayCardsByColumn]);
    const handleAddColumn = useCallback(() => {
        const title = addColumnTitle.trim();
        if (!title || activeBoardId == null)
            return;
        void commitBoard(createTodoColumn(activeBoardId, { title }));
        setAddColumnTitle('');
        setAddColumnOpen(false);
    }, [addColumnTitle, activeBoardId, commitBoard]);
    const handleColumnMouseDown = useCallback((e: React.PointerEvent, id: ColumnId) => {
        if (e.pointerType === 'mouse' && e.button !== 0)
            return;
        if ((e.target as HTMLElement).closest('button'))
            return;
        e.preventDefault();
        const node = columnRefs.current[id];
        if (node) {
            const rect = node.getBoundingClientRect();
            columnDragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            setColumnDragPreviewPosition({ x: rect.left, y: rect.top });
            try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch {}
        }
        setDraggingColumn(id);
        setDropTarget(null);
    }, []);
    const handleColumnsAreaMouseDown = useCallback((e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse')
            return;
        if (e.button !== 0)
            return;
        const el = e.target as HTMLElement;
        if (el.closest('.todo-column__head') || el.closest('.todo-columns__add') || el.closest('.todo-card') || el.closest('button'))
            return;
        const container = columnsScrollRef.current;
        if (!container)
            return;
        e.preventDefault();
        panStartXRef.current = e.clientX;
        panStartScrollRef.current = container.scrollLeft;
        setIsPanning(true);
    }, []);
    useEffect(() => {
        if (!isPanning)
            return;
        const onMove = (e: PointerEvent) => {
            e.preventDefault();
            const container = columnsScrollRef.current;
            if (!container)
                return;
            const dx = panStartXRef.current - e.clientX;
            container.scrollLeft = panStartScrollRef.current + dx;
        };
        const onUp = () => setIsPanning(false);
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
        return () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onUp);
        };
    }, [isPanning]);
    useEffect(() => {
        if (draggingColumn === null)
            return;
        const onMove = (e: PointerEvent) => {
            e.preventDefault();
            setColumnDragPreviewPosition({
                x: e.clientX - columnDragOffsetRef.current.x,
                y: e.clientY - columnDragOffsetRef.current.y,
            });
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const columnEl = el?.closest?.('[data-todo-column-id]') as HTMLElement | null;
            const id = columnEl?.getAttribute('data-todo-column-id') as ColumnId | null;
            if (id && id !== draggingColumn) {
                dropTargetRef.current = id;
                setDropTarget(id);
            }
            else {
                dropTargetRef.current = null;
                setDropTarget(null);
            }
        };
        const onUp = () => {
            const target = dropTargetRef.current;
            if (draggingColumn && target && draggingColumn !== target) {
                const rects: Record<string, DOMRect> = {};
                columnOrder.forEach((id) => {
                    const node = columnRefs.current[id];
                    if (node)
                        rects[id] = node.getBoundingClientRect();
                });
                prevRectsRef.current = rects;
                const order = columnOrder;
                const a = order.indexOf(draggingColumn);
                const b = order.indexOf(target);
                if (a >= 0 && b >= 0 && activeBoardId != null) {
                    const next = [...order];
                    next[a] = order[b];
                    next[b] = order[a];
                    setColumnOrder(next);
                    const bid = activeBoardId;
                    void (async () => {
                        const brd = await commitBoard(reorderTodoColumns(bid, next.map(Number)));
                        if (!brd) {
                            try {
                                const fresh = await fetchTodoBoardById(bid);
                                applyBoardFromApi(fresh);
                            }
                            catch {
                            }
                        }
                    })();
                }
            }
            dropTargetRef.current = null;
            setDraggingColumn(null);
            setDropTarget(null);
            setColumnDragPreviewPosition(null);
        };
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
        return () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onUp);
        };
    }, [draggingColumn, columnOrder, commitBoard, applyBoardFromApi, activeBoardId]);
    useEffect(() => {
        if (!prevRectsRef.current)
            return;
        const oldRects = prevRectsRef.current;
        prevRectsRef.current = null;
        columnOrder.forEach((id) => {
            const el = columnRefs.current[id];
            if (!el || !oldRects[id])
                return;
            const newRect = el.getBoundingClientRect();
            const dx = oldRects[id].left - newRect.left;
            el.style.transition = 'none';
            el.style.transform = `translateX(${dx}px)`;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    el.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                    el.style.transform = 'translateX(0)';
                    const onEnd = () => {
                        el.style.transition = '';
                        el.style.transform = '';
                        el.removeEventListener('transitionend', onEnd);
                    };
                    el.addEventListener('transitionend', onEnd);
                });
            });
        });
    }, [columnOrder]);
    const handleAddCard = useCallback(async () => {
        const title = addCardTitle.trim();
        if (!title || !addCardColumn || activeBoardId == null || addCardSubmitting)
            return;
        const columnKey = addCardColumn;
        const columnId = Number(addCardColumn);
        setAddCardSubmitting(true);
        try {
            const board = await commitBoard(createTodoCard(activeBoardId, columnId, { title }));
            if (!board)
                return;
            const newCard = findNewestCardInColumn(board, columnId);
            setAddCardTitle('');
            setAddCardColumn(null);
            if (newCard)
                setSelectedCard({ columnId: columnKey, cardId: String(newCard.id) });
        }
        finally {
            setAddCardSubmitting(false);
        }
    }, [addCardTitle, addCardColumn, activeBoardId, addCardSubmitting, commitBoard]);
    const handleToggleCollapse = useCallback((cid: string) => {
        if (activeBoardId == null)
            return;
        const collapsed = !!collapsedColumns[cid];
        void commitBoard(patchTodoColumn(activeBoardId, Number(cid), { isCollapsed: !collapsed }));
    }, [activeBoardId, collapsedColumns, commitBoard]);
    const handleExpand = useCallback((cid: string) => {
        if (activeBoardId == null)
            return;
        void commitBoard(patchTodoColumn(activeBoardId, Number(cid), { isCollapsed: false }));
    }, [activeBoardId, commitBoard]);
    const handleAddCardClick = useCallback((cid: ColumnId) => {
        setAddCardColumn(cid);
        setAddCardTitle('');
    }, []);
    const handleCardClick = useCallback((cid: string, cardId: string) => {
        if (cardDidDragRef.current) {
            cardDidDragRef.current = false;
            return;
        }
        setSelectedCard({ columnId: cid, cardId });
    }, []);
    const handleCardToggleComplete = useCallback((cid: string, cardId: string) => {
        const card = mergedCards[cid]?.find((c) => c.id === cardId);
        if (!card || card.fromCalendar || activeBoardId == null)
            return;
        void commitBoard(patchTodoCard(activeBoardId, Number(cardId), { isCompleted: !card.completed }));
    }, [activeBoardId, mergedCards, commitBoard]);
    const handleColumnKeyDown = useCallback((id: ColumnId) => {
        setDraggingColumn(id);
    }, []);
    const handleCardDragStart = useCallback((e: React.PointerEvent, columnId: string, cardId: string, cardRect: DOMRect, fromDragHandle = false) => {
        if (e.pointerType === 'mouse' && e.button !== 0)
            return;
        if (e.pointerType === 'touch' && !fromDragHandle)
            return;
        cardDidDragRef.current = false;
        const pointerElement = (fromDragHandle
            ? (e.currentTarget as Element).closest('[data-todo-card-id]')
            : e.currentTarget) as Element | null;
        if (e.pointerType === 'touch') {
            try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch {}
        }
        pendingCardDragRef.current = {
            columnId,
            cardId,
            cardRect,
            startX: e.clientX,
            startY: e.clientY,
            pointerId: e.pointerId,
            pointerType: e.pointerType,
            pointerElement,
            fromDragHandle,
        };
        setPendingCardDragActive(true);
        if (e.pointerType === 'touch')
            setTouchPressCard({ columnId, cardId });
    }, []);
    const handleSortCards = useCallback((colId: string, mode: TodoColumnListSortMode) => {
        setColumnListSort((prev) => ({ ...prev, [colId]: mode }));
    }, []);
    const handleToggleHideCompleted = useCallback((colId: string) => {
        setColumnHideCompleted((prev) => ({ ...prev, [colId]: !prev[colId] }));
    }, []);
    const handleRenameColumn = useCallback((colId: string, title: string) => {
        if (activeBoardId == null)
            return;
        void commitBoard(patchTodoColumn(activeBoardId, Number(colId), { title }));
    }, [activeBoardId, commitBoard]);
    const handleClearColumn = useCallback(async (colId: string) => {
        if (activeBoardId == null)
            return;
        const list = cards[colId] || [];
        let lastBoard: TodoBoard | null = null;
        for (const c of list) {
            try {
                lastBoard = await deleteTodoCard(activeBoardId, Number(c.id));
            }
            catch {
                break;
            }
        }
        if (lastBoard) {
            applyBoardFromApi(lastBoard);
            setActiveBoardId(lastBoard.id);
        }
    }, [activeBoardId, cards, applyBoardFromApi]);
    const handleDeleteColumn = useCallback((colId: string) => {
        if (activeBoardId == null)
            return;
        void commitBoard(deleteTodoColumn(activeBoardId, Number(colId)));
    }, [activeBoardId, commitBoard]);
    const handleMoveCard = useCallback((fromColumnId: string, cardId: string, toColumnId: string, insertIndex?: number) => {
        if (fromColumnId === toColumnId || activeBoardId == null)
            return;
        const card = mergedCards[fromColumnId]?.find((c) => c.id === cardId);
        if (!card)
            return;
        if (card.fromCalendar && card.calendarEventId) {
            setCalendarColumnOverrides((prev) => ({ ...prev, [card.calendarEventId!]: toColumnId }));
        }
        else {
            const targetManual = cards[toColumnId] ?? [];
            const targetDisplay = displayCardsByColumn[toColumnId] ?? [];
            const position = insertIndex == null
                ? targetManual.length
                : manualPositionInColumn(targetDisplay, targetManual, insertIndex);
            void commitBoard(patchTodoCard(activeBoardId, Number(cardId), {
                columnId: Number(toColumnId),
                position,
            }));
        }
    }, [activeBoardId, mergedCards, cards, displayCardsByColumn, commitBoard]);
    const handleReorderCardsInColumn = useCallback((columnId: string, cardId: string, insertIndex: number) => {
        if (activeBoardId == null)
            return;
        if ((columnListSort[columnId] ?? 'server') !== 'server' || columnHideCompleted[columnId])
            return;
        const manual = cards[columnId] ?? [];
        const display = displayCardsByColumn[columnId] ?? [];
        const orderedIds = computeManualCardOrderAfterDrop(display, manual, cardId, insertIndex);
        if (!orderedIds)
            return;
        void commitBoard(reorderTodoCardsInColumn(activeBoardId, Number(columnId), orderedIds));
    }, [activeBoardId, cards, columnHideCompleted, columnListSort, displayCardsByColumn, commitBoard]);
    useEffect(() => {
        if (!pendingCardDragActive && draggingCard === null)
            return;
        const MOUSE_DRAG_THRESHOLD = 8;
        const TOUCH_DRAG_THRESHOLD = 4;
        const beginCardDrag = (pending: NonNullable<typeof pendingCardDragRef.current>) => {
            activeCardPointerIdRef.current = pending.pointerId;
            try { pending.pointerElement?.setPointerCapture(pending.pointerId); } catch {}
            cardDragOffsetRef.current = {
                x: pending.startX - pending.cardRect.left,
                y: pending.startY - pending.cardRect.top,
            };
            pendingCardDragRef.current = null;
            setPendingCardDragActive(false);
            setTouchPressCard(null);
            cardDidDragRef.current = true;
            setDragPreviewPosition({ x: pending.cardRect.left, y: pending.cardRect.top });
            setDraggingCard({ columnId: pending.columnId, cardId: pending.cardId });
        };
        const onMove = (e: PointerEvent) => {
            if (activeCardPointerIdRef.current !== null && e.pointerId !== activeCardPointerIdRef.current)
                return;
            if (draggingCard === null && pendingCardDragRef.current) {
                const pending = pendingCardDragRef.current;
                if (e.pointerId !== pending.pointerId)
                    return;
                const dx = e.clientX - pending.startX;
                const dy = e.clientY - pending.startY;
                const threshold = pending.pointerType === 'touch' ? TOUCH_DRAG_THRESHOLD : MOUSE_DRAG_THRESHOLD;
                if (Math.sqrt(dx * dx + dy * dy) <= threshold)
                    return;
                if (pending.pointerType === 'touch')
                    e.preventDefault();
                beginCardDrag(pending);
                setDragPreviewPosition({
                    x: e.clientX - cardDragOffsetRef.current.x,
                    y: e.clientY - cardDragOffsetRef.current.y,
                });
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const columnEl = el?.closest?.('[data-todo-column-id]') as HTMLElement | null;
                const id = columnEl?.getAttribute('data-todo-column-id') as ColumnId | null;
                if (id && columnOrder.includes(id)) {
                    dropTargetCardColumnRef.current = id;
                    setDropTargetCardColumn(id);
                    dropTargetCardInsertIndexRef.current = resolveCardInsertIndex(e.clientY, id, pending.cardId);
                }
                return;
            }
            if (draggingCard) {
                if (activeCardPointerIdRef.current !== null && e.pointerId !== activeCardPointerIdRef.current)
                    return;
                e.preventDefault();
                setDragPreviewPosition({
                    x: e.clientX - cardDragOffsetRef.current.x,
                    y: e.clientY - cardDragOffsetRef.current.y,
                });
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const columnEl = el?.closest?.('[data-todo-column-id]') as HTMLElement | null;
                const id = columnEl?.getAttribute('data-todo-column-id') as ColumnId | null;
                if (id && columnOrder.includes(id)) {
                    dropTargetCardColumnRef.current = id;
                    setDropTargetCardColumn(id);
                    dropTargetCardInsertIndexRef.current = resolveCardInsertIndex(e.clientY, id, draggingCard.cardId);
                }
                else {
                    dropTargetCardColumnRef.current = null;
                    setDropTargetCardColumn(null);
                    dropTargetCardInsertIndexRef.current = 0;
                }
            }
        };
        const onUp = (e: PointerEvent) => {
            if (pendingCardDragRef.current && e.pointerId !== pendingCardDragRef.current.pointerId)
                return;
            if (activeCardPointerIdRef.current !== null && e.pointerId !== activeCardPointerIdRef.current)
                return;
            const wasDragging = draggingCard !== null;
            pendingCardDragRef.current = null;
            setPendingCardDragActive(false);
            setTouchPressCard(null);
            const target = dropTargetCardColumnRef.current;
            const insertIndex = dropTargetCardInsertIndexRef.current;
            if (draggingCard && target) {
                if (draggingCard.columnId === target) {
                    handleReorderCardsInColumn(target, draggingCard.cardId, insertIndex);
                }
                else {
                    handleMoveCard(draggingCard.columnId, draggingCard.cardId, target, insertIndex);
                }
            }
            if (wasDragging)
                cardDidDragRef.current = true;
            dropTargetCardColumnRef.current = null;
            dropTargetCardInsertIndexRef.current = 0;
            activeCardPointerIdRef.current = null;
            setDraggingCard(null);
            setDropTargetCardColumn(null);
            setDragPreviewPosition(null);
        };
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
        return () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.removeEventListener('pointercancel', onUp);
        };
    }, [pendingCardDragActive, draggingCard, columnOrder, handleMoveCard, handleReorderCardsInColumn]);
    const handleArchiveCard = useCallback(async (columnId: string, cardId: string) => {
        const card = mergedCards[columnId]?.find((c) => c.id === cardId);
        if (!card) {
            setSelectedCard(null);
            return;
        }
        if (card.fromCalendar) {
            setSelectedCard(null);
            return;
        }
        const snapshotLabelIds = card.labels
            ?.map((l) => Number(l.id))
            .filter((n) => !Number.isNaN(n));
        const snapshotParticipantUserIds = card.participantUserIds && card.participantUserIds.length > 0
            ? [...card.participantUserIds]
            : undefined;
        const snapshotDueAt = card.dueAtIso ?? cardDueDateTimeToIso(card.dueDate, card.dueTime) ?? null;
        if (activeBoardId == null)
            return;
        const board = await commitBoard(patchTodoCard(activeBoardId, Number(cardId), { isArchived: true }));
        if (board) {
            setArchivedCards((a) => [
                {
                    ...card,
                    archivedAt: new Date().toISOString(),
                    fromColumn: columnId,
                    snapshotLabelIds: snapshotLabelIds?.length ? snapshotLabelIds : undefined,
                    snapshotParticipantUserIds,
                    snapshotDueAt,
                },
                ...a,
            ]);
        }
        setSelectedCard(null);
    }, [mergedCards, activeBoardId, commitBoard]);
    const handleRestoreCard = useCallback((archivedCard: ArchivedCard) => {
        const targetCol = columnOrder.includes(archivedCard.fromColumn)
            ? archivedCard.fromColumn
            : columnOrder[0];
        if (!targetCol || activeBoardId == null)
            return;
        const bid = activeBoardId;
        void (async () => {
            let board = await commitBoard(createTodoCard(bid, Number(targetCol), {
                title: archivedCard.title,
                body: archivedCard.description ?? undefined,
                dueAt: archivedCard.snapshotDueAt ?? undefined,
            }));
            if (!board)
                return;
            const col = board.columns.find((c) => String(c.id) === targetCol);
            const list = col?.cards ?? [];
            const newCard = list.length > 0 ? list.reduce((best, c) => (c.id > best.id ? c : best), list[0]!) : null;
            if (!newCard) {
                setArchivedCards((prev) => prev.filter((c) => c.id !== archivedCard.id));
                return;
            }
            if (archivedCard.snapshotLabelIds?.length) {
                const b2 = await commitBoard(patchTodoCard(bid, newCard.id, { labelIds: archivedCard.snapshotLabelIds }));
                if (b2)
                    board = b2;
            }
            if (archivedCard.snapshotParticipantUserIds?.length) {
                const b3 = await commitBoard(patchTodoCard(bid, newCard.id, {
                    participantUserIds: archivedCard.snapshotParticipantUserIds,
                }));
                if (b3)
                    board = b3;
            }
            setArchivedCards((prev) => prev.filter((c) => c.id !== archivedCard.id));
        })();
    }, [columnOrder, activeBoardId, commitBoard]);
    const handleDeleteArchivedCard = useCallback((cardId: string) => {
        setArchivedCards((prev) => prev.filter((c) => c.id !== cardId));
    }, []);
    const handleClearArchive = useCallback(() => {
        setArchivedCards([]);
    }, []);
    const handleColumnRef = useCallback((id: string) => (node: HTMLDivElement | null) => {
        columnRefs.current[id] = node;
    }, []);
    const selectedCardData = selectedCard ? mergedCards[selectedCard.columnId]?.find((c) => c.id === selectedCard.cardId) : null;
    const modalColumnOptions = useMemo(() => columnOrder.map((id) => ({ id, title: columnTitles[id] ?? '' })), [columnOrder, columnTitles]);
    const handleModalMoveToColumn = useCallback(async (targetColumnId: string) => {
        if (!selectedCard)
            return;
        if (selectedCard.columnId === targetColumnId)
            return;
        const card = mergedCards[selectedCard.columnId]?.find((c) => c.id === selectedCard.cardId);
        if (!card)
            return;
        if (card.fromCalendar && card.calendarEventId) {
            setCalendarColumnOverrides((prev) => ({ ...prev, [card.calendarEventId!]: targetColumnId }));
            setSelectedCard({ columnId: targetColumnId, cardId: selectedCard.cardId });
            return;
        }
        if (activeBoardId == null)
            return;
        const manualInTarget = cards[targetColumnId]?.length ?? 0;
        const board = await commitBoard(patchTodoCard(activeBoardId, Number(selectedCard.cardId), {
            columnId: Number(targetColumnId),
            position: manualInTarget,
        }));
        if (board)
            setSelectedCard({ columnId: targetColumnId, cardId: selectedCard.cardId });
    }, [selectedCard, mergedCards, cards, activeBoardId, commitBoard]);
    const handleModalCardUpdate = useCallback((patch: Partial<TodoCard>) => {
        if (!selectedCard || !selectedCardData || activeBoardId == null)
            return;
        const c = selectedCardData;
        if (c.fromCalendar)
            return;
        const merged: TodoCard = { ...c, ...patch };
        const cardId = Number(selectedCard.cardId);
        const payload: PatchTodoCardPayload = {};
        if (patch.title !== undefined)
            payload.title = merged.title;
        if (patch.description !== undefined) {
            payload.body = merged.description?.length ? merged.description : null;
        }
        if (patch.completed !== undefined)
            payload.isCompleted = !!merged.completed;
        if (patch.dueDate !== undefined || patch.dueTime !== undefined) {
            payload.dueAt = merged.dueDate?.trim()
                ? cardDueDateTimeToIso(merged.dueDate, merged.dueTime)
                : null;
        }
        if (patch.attachments !== undefined) {
            setCards((prev) => {
                const colId = selectedCard.columnId;
                const list = prev[colId];
                if (!list)
                    return prev;
                return {
                    ...prev,
                    [colId]: list.map((card) => card.id === selectedCard.cardId
                        ? { ...card, attachments: patch.attachments }
                        : card),
                };
            });
            return;
        }
        if (Object.keys(payload).length > 0) {
            void commitBoard(patchTodoCard(activeBoardId, cardId, payload));
        }
    }, [selectedCard, selectedCardData, activeBoardId, commitBoard]);
    const applyTodoBoard = useCallback((promise: Promise<TodoBoard>) => commitBoard(promise), [commitBoard]);
    const draggingCardData = draggingCard ? mergedCards[draggingCard.columnId]?.find((c) => c.id === draggingCard.cardId) : null;
    const draggingColumnConfig = draggingColumn ? columnConfig.find((c) => c.id === draggingColumn) : null;
    const draggingColumnCardCount = draggingColumn ? (mergedCards[draggingColumn]?.length ?? 0) : 0;
    const todoThemeVarsStyle = useMemo(() => ({
        ['--todo-accent' as string]: themeVars.accent,
        ['--todo-text' as string]: themeVars.text,
        ['--todo-muted' as string]: themeVars.muted,
        ['--todo-surface' as string]: themeVars.surface,
        ['--todo-surface2' as string]: themeVars.surface2,
        ['--todo-panel-bg' as string]: themeVars.panelBg,
        ['--todo-border' as string]: themeVars.border,
        ['--todo-shadow' as string]: themeVars.shadow,
        ['--todo-header-bg' as string]: themeVars.headerBg,
        ['--todo-nav-shadow' as string]: themeVars.navShadow,
        ['--todo-column-today-bg' as string]: themeVars.columnTodayBg,
        ['--todo-column-today-text' as string]: themeVars.columnTodayText,
        ['--todo-column-week-bg' as string]: themeVars.columnWeekBg,
        ['--todo-column-week-text' as string]: themeVars.columnWeekText,
        ['--todo-column-later-bg' as string]: themeVars.columnLaterBg,
        ['--todo-column-later-text' as string]: themeVars.columnLaterText,
        colorScheme: themeVars.isDark ? ('dark' as const) : ('light' as const),
    }) as React.CSSProperties, [themeVars]);
    const isParticipantOnlyBoard = isParticipantBoardRole(effectiveBoardMyRole);
    const isViewerOnlyBoard = isViewerBoardRole(effectiveBoardMyRole);
    const structureReadOnly = !canEditKanbanStructure(effectiveBoardMyRole);
    const cardsReadOnly = isViewerOnlyBoard;
    const activeBoardSummary = boardSummaries.find((b) => b.id === activeBoardId);
    const showMembersSettings = canManageBoardMembers(effectiveBoardMyRole)
        && (activeBoardSummary?.visibility?.toLowerCase() === 'shared' || false);
    const handleInviteAccepted = useCallback(async (board: TodoBoard) => {
        applyBoardFromApi(board);
        setActiveBoardId(board.id);
        setBoardError(null);
        await reloadBoardSummaries();
    }, [applyBoardFromApi, reloadBoardSummaries]);
    return (<div className={`todo-page${initialLoading ? ' todo-page--skeleton' : ''}`} style={todoThemeVarsStyle}>
        {boardError && (<div className="todo-page__board-error" role="alert">
            <span className="todo-page__board-error-text">{boardError}</span>
            <button type="button" className="todo-page__board-error-retry" onClick={() => {
                void (async () => {
                    try {
                        if (activeBoardId != null) {
                            const b = await fetchTodoBoardById(activeBoardId);
                            applyBoardFromApi(b);
                            setActiveBoardId(b.id);
                            setBoardError(null);
                            await reloadBoardSummaries();
                            return;
                        }
                        const list = await fetchTodoBoardsList();
                        if (!list.items.length) {
                            const b = await fetchTodoBoardCurrent();
                            applyBoardFromApi(b, list.items);
                            setActiveBoardId(b.id);
                            setBoardError(null);
                            await reloadBoardSummaries();
                            return;
                        }
                        setBoardSummaries(list.items);
                        setBoardListError(null);
                        const pref = pickPreferredTodoBoardId(list);
                        const b = pref != null ? await fetchTodoBoardById(pref) : await fetchTodoBoardCurrent();
                        applyBoardFromApi(b, list.items);
                        setActiveBoardId(b.id);
                        setBoardError(null);
                    }
                    catch (err: unknown) {
                        setBoardError(err instanceof Error ? err.message : t('todoPage.errors.load'));
                    }
                })();
            }}>
                {t('todoPage.retry')}
            </button>
        </div>)}
        {!initialLoading && isParticipantOnlyBoard && (<div className="todo-page__participant-hint" role="status">
            {t('todoPage.participantViewHint')}
        </div>)}
        {!initialLoading && isViewerOnlyBoard && (<div className="todo-page__participant-hint todo-page__participant-hint--viewer" role="status">
            {t('todoPage.viewerViewHint')}
        </div>)}
        <header className={`todo-page__header${initialLoading ? ' todo-page__header--skeleton' : ''}`}>
            <div className="todo-page__nav">
                {initialLoading ? (<>
                    <div className="todo-page__header-skel todo-page__header-skel--back" />
                    <div className="todo-page__nav-center">
                        <div className="todo-page__header-skel todo-page__header-skel--search" />
                    </div>
                    <div className="todo-page__nav-right">
                        <div className="todo-page__header-skel todo-page__header-skel--btn" />
                        <div className="todo-page__header-skel todo-page__header-skel--btn todo-page__header-skel--icon" />
                    </div>
                </>) : (<>
                    <AppBackButton to={routes.home} label={t('todoPage.back')} ariaLabel={t('todoPage.backAria')} hideLabelOnMobile />
                    <AppHomeLogo withSeparator />
                    <div className="todo-page__nav-center">
                        {activeBoardSummary && (
                            <span className="todo-page__nav-title" aria-hidden="true">
                                {activeBoardSummary.title}
                            </span>
                        )}
                        <div className="todo-page__search-wrap">
                            <svg className="todo-page__search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                            <input className="todo-page__search" placeholder={t('todoPage.page.searchTasks')} type="search" />
                        </div>
                    </div>
                    <div className="todo-page__nav-right">
                        <button type="button" className={`todo-page__header-btn todo-page__header-btn--planner${mobilePlannerOpen ? ' todo-page__header-btn--active' : ''}`} onClick={() => { setMobilePlannerOpen((v) => !v); setArchiveOpen(false); }} aria-label={t('todoPage.planner.openMobile')}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                            <span>{t('todoPage.planner.openMobile')}</span>
                        </button>
                        <TodoInvitesPanel
                            open={invitesOpen}
                            onOpenChange={setInvitesOpen}
                            onAccepted={handleInviteAccepted}
                            onInvitesChanged={() => {
                                invalidateTodoInvites();
                                void reloadBoardSummaries();
                            }}
                        />
                        <button type="button" className={`todo-page__header-btn${archiveOpen ? ' todo-page__header-btn--active' : ''}`} onClick={() => { setArchiveOpen((v) => !v); setMobilePlannerOpen(false); }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8" /><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5" /><rect x="2" y="8" width="20" height="13" rx="2" /></svg>
                            <span>{t('todoPage.page.archive')}</span>
                            {archivedCards.length > 0 && <span className="todo-page__header-badge">{archivedCards.length}</span>}
                        </button>
                        <div className="todo-page__menu-wrap" ref={menuRef}>
                            <button type="button" className="todo-page__header-btn todo-page__header-btn--icon" aria-label={t('todoPage.page.more')} onClick={() => setMenuOpen((v) => !v)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                            </button>
                            {menuOpen && (<div className="todo-page__menu-dropdown">
                                {!structureReadOnly && (<>
                                    <button type="button" className="todo-page__menu-item" onClick={handlePickBackground} disabled={bgUploading}>
                                        <span className="todo-page__menu-icon"><IconImage /></span>
                                        <span className="todo-page__menu-text">{bgUploading ? t('todoPage.loading') : t('todoPage.page.bgWorkspace')}</span>
                                    </button>
                                    {backgroundImage && (<button type="button" className="todo-page__menu-item todo-page__menu-item--danger" onClick={handleDeleteBackground}>
                                        <span className="todo-page__menu-icon"><IconTrash /></span>
                                        <span className="todo-page__menu-text">{t('todoPage.page.removeBg')}</span>
                                    </button>)}
                                </>)}
                                {showMembersSettings && (<button type="button" className="todo-page__menu-item" onClick={() => { setMenuOpen(false); setMembersModalOpen(true); }}>
                                    <span className="todo-page__menu-icon"><IconSettings /></span>
                                    <span className="todo-page__menu-text">{t('todoPage.members.menuItem')}</span>
                                </button>)}
                                <button type="button" className="todo-page__menu-item" onClick={() => void handleExportBoard()} disabled={activeBoardId == null || boardIoBusy != null}>
                                    <span className="todo-page__menu-icon"><IconDownload /></span>
                                    <span className="todo-page__menu-text">{boardIoBusy === 'export' ? t('todoPage.page.exporting') : t('todoPage.page.exportData')}</span>
                                </button>
                                <button type="button" className="todo-page__menu-item" onClick={handlePickImport} disabled={boardIoBusy != null}>
                                    <span className="todo-page__menu-icon"><IconUpload /></span>
                                    <span className="todo-page__menu-text">{boardIoBusy === 'import' ? t('todoPage.page.importing') : t('todoPage.page.importData')}</span>
                                </button>
                            </div>)}
                        </div>
                    </div>
                </>)}
            </div>
        </header>
        {invitesCount > 0 && !invitesOpen ? (
            <AttentionBanner
                className="todo-page__attention"
                text={t('attentionBanner.todoInvites').replace('{count}', String(invitesCount))}
                actionLabel={t('attentionBanner.todoInvitesGo')}
                onAction={() => setInvitesOpen(true)}
            />
        ) : null}
        {draggingCard && dragPreviewPosition && draggingCardData && createPortal(<div className="todo-card-drag-preview" style={{ left: dragPreviewPosition.x, top: dragPreviewPosition.y }}>
            <div className="todo-card-drag-preview__inner">
                {draggingCardData.fromCalendar && (<span className="todo-card-drag-preview__badge">Outlook</span>)}
                <span className="todo-card-drag-preview__title">{draggingCardData.title}</span>
            </div>
        </div>, document.body)}
        {draggingColumn && columnDragPreviewPosition && draggingColumnConfig && createPortal(<div className="todo-column-drag-preview" style={{ left: columnDragPreviewPosition.x, top: columnDragPreviewPosition.y }}>
            <div className="todo-column-drag-preview__inner" style={draggingColumn && columnColors[draggingColumn]
                ? ({ '--todo-column-dot': columnColors[draggingColumn] } as React.CSSProperties)
                : undefined}>
                <div className="todo-column-drag-preview__head">
                    <span className="todo-column-drag-preview__dot" />
                    <span className="todo-column-drag-preview__title">{draggingColumnConfig.title}</span>
                    <span className="todo-column-drag-preview__count">{draggingColumnCardCount}</span>
                </div>
                {draggingColumnCardCount > 0 && (<div className="todo-column-drag-preview__body">
                    <div className="todo-column-drag-preview__stub" />
                    {draggingColumnCardCount > 1 && <div className="todo-column-drag-preview__stub" />}
                    {draggingColumnCardCount > 2 && <div className="todo-column-drag-preview__stub" />}
                </div>)}
            </div>
        </div>, document.body)}
        <div className={`todo-page__body${mobilePlannerOpen ? ' todo-page__body--planner-open' : ''}`}>
            <div className="todo-page__planner-backdrop" onClick={() => setMobilePlannerOpen(false)} aria-hidden="true" />
            <TodoPlanner plannerCollapsed={plannerCollapsed} setPlannerCollapsed={setPlannerCollapsed} currentMonth={currentMonth} monthDays={monthDays} monthLabel={monthLabel} today={today} onPrevMonth={handlePrevMonth} onNextMonth={handleNextMonth} calendarConnected={calendarConnected} calendarEvents={calendarEvents} calendarConnectError={calendarConnectError} onConnectCalendar={handleConnectCalendar} onAddEvent={handleOpenAddEvent} onEditEvent={() => { }} loading={initialLoading || calendarLoading} onMobileClose={() => setMobilePlannerOpen(false)} />
            <main className={`todo-page__main ${backgroundImage ? 'todo-page__main--with-bg' : ''}`}>
                {prevBackground && bgTransitioning && (<div className="todo-page__bg-layer todo-page__bg-layer--old" style={{ backgroundImage: `url(${prevBackground})` }} />)}
                {backgroundImage && (<div className={`todo-page__bg-layer todo-page__bg-layer--new${bgTransitioning ? ' todo-page__bg-layer--entering' : ''}`} style={{ backgroundImage: `url(${backgroundImage})` }} />)}
                {backgroundImage && <div className="todo-page__bg-overlay" />}
                <div ref={columnsScrollRef} className={`todo-columns ${isPanning ? 'todo-columns--panning' : ''}`} onPointerDown={handleColumnsAreaMouseDown}>
                    {initialLoading ? (<>
                        {['today', 'week', 'later'].map((id) => (<div key={id} className="todo-column todo-column--skeleton">
                            <div className="todo-column__head">
                                <div className="todo-column__head-left">
                                    <span className="todo-column__dot" />
                                    <div className="todo-skel todo-skel--title" />
                                    <div className="todo-skel todo-skel--badge" />
                                </div>
                            </div>
                            <div className="todo-column__cards">
                                {Array.from({ length: id === 'today' ? 3 : 2 }).map((_, i) => (<div key={i} className="todo-card todo-card--skeleton">
                                    <div className="todo-skel todo-skel--label" />
                                    <div className="todo-skel todo-skel--line" />
                                    <div className="todo-skel todo-skel--line-short" />
                                </div>))}
                            </div>
                        </div>))}
                    </>) : (<>
                        {columnOrder.map((id) => {
                            const config = columnConfig.find((c) => c.id === id)!;
                            const isCollapsed = collapsedColumns[id];
                            const fullCol = mergedCards[id] || [];
                            const progressDone = fullCol.filter((c) => c.completed).length;
                            const progressTotal = fullCol.length;
                            return (<TodoColumn key={id} config={config} todoBoardUsers={todoBoardUsers} isCollapsed={!!isCollapsed} cards={displayCardsByColumn[id] || []} columnProgressDone={progressDone} columnProgressTotal={progressTotal} listSortMode={columnListSort[id] ?? 'server'} hideCompletedFilter={!!columnHideCompleted[id]} isDragging={draggingColumn === id} isDropTarget={dropTarget === id} structureReadOnly={structureReadOnly} cardsReadOnly={cardsReadOnly} onColumnMouseDown={handleColumnMouseDown} onColumnKeyDown={handleColumnKeyDown} onToggleCollapse={handleToggleCollapse} onExpand={handleExpand} onAddCardClick={handleAddCardClick} onCardClick={handleCardClick} onCardToggleComplete={handleCardToggleComplete} onSortCards={handleSortCards} onToggleHideCompleted={handleToggleHideCompleted} onRenameColumn={handleRenameColumn} onClearColumn={handleClearColumn} onDeleteColumn={handleDeleteColumn} onCardDragStart={handleCardDragStart} isCardDropTarget={dropTargetCardColumn === id} draggingCard={draggingCard} touchPressCard={touchPressCard} columnRef={handleColumnRef(id)} />);
                        })}
                        {!structureReadOnly && (<button type="button" className="todo-columns__add" onClick={() => { setAddColumnOpen(true); setAddColumnTitle(''); }} aria-label={t('todoPage.page.addColumnAria')}>
                            <IconPlus />
                            <span>{t('todoPage.page.addColumn')}</span>
                        </button>)}
                    </>)}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBackgroundChange} />
                <input ref={importFileInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => void handleImportFileChange(e)} />
                <Suspense fallback={null}>
                    {addColumnOpen && (<TodoAddColumnModal title={addColumnTitle} onTitleChange={setAddColumnTitle} onClose={() => { setAddColumnOpen(false); setAddColumnTitle(''); }} onSubmit={handleAddColumn} />)}
                    {addCardColumn && (<TodoAddCardModal columnTitle={columnConfig.find((c) => c.id === addCardColumn)?.title ?? ''} title={addCardTitle} onTitleChange={setAddCardTitle} onClose={() => { if (!addCardSubmitting) { setAddCardColumn(null); setAddCardTitle(''); } }} onSubmit={() => void handleAddCard()} submitting={addCardSubmitting} />)}
                    {selectedCard && selectedCardData && activeBoardId != null && (<TodoCardModal boardId={activeBoardId} boardReadOnly={cardsReadOnly} card={selectedCardData} columnTitle={columnTitles[selectedCard.columnId] ?? ''} columnId={selectedCard.columnId} columns={modalColumnOptions} boardLabels={boardLabels} todoBoardUsers={todoBoardUsers} cardServerId={Number(selectedCard.cardId)} applyTodoBoard={applyTodoBoard} onMoveToColumn={handleModalMoveToColumn} onClose={() => setSelectedCard(null)} onCardUpdate={handleModalCardUpdate} onArchive={() => handleArchiveCard(selectedCard.columnId, selectedCard.cardId)} />)}
                    {membersModalOpen && activeBoardId != null && (<TodoBoardMembersModal boardId={activeBoardId} boardTitle={activeBoardSummary?.title ?? ''} themeVarsStyle={todoThemeVarsStyle} onClose={() => setMembersModalOpen(false)} onMembersChanged={() => void reloadBoardSummaries()} />)}
                </Suspense>

                <TodoBoardsBar themeVarsStyle={todoThemeVarsStyle} boards={boardSummaries} currentBoardId={activeBoardId} listError={boardListError} onSelectBoard={handleSelectTodoBoard} onCreateBoard={handleCreateTodoBoard} />

                <div className={`todo-archive${archiveOpen ? ' todo-archive--open' : ''}`}>
                    <div className="todo-archive__header">
                        <h3 className="todo-archive__title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8" /><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5" /><rect x="2" y="8" width="20" height="13" rx="2" /></svg>
                            {t('todoPage.archive.title')}
                        </h3>
                        <button type="button" className="todo-archive__close" onClick={() => setArchiveOpen(false)} aria-label={t('todoPage.archive.closeAria')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>

                    <div className="todo-archive__search-wrap">
                        <svg className="todo-archive__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                        <input className="todo-archive__search" type="search" placeholder={t('todoPage.archive.search')} value={archiveSearch} onChange={(e) => setArchiveSearch(e.target.value)} />
                    </div>

                    <div className="todo-archive__list">
                        {archivedCards
                            .filter((c) => !archiveSearch || c.title.toLowerCase().includes(archiveSearch.toLowerCase()))
                            .map((ac) => (<div key={ac.id} className="todo-archive__card">
                                <div className="todo-archive__card-header">
                                    {(ac.labels?.length ?? 0) > 0 && (<div className="todo-archive__card-labels">
                                        {ac.labels!.map((l) => (<span key={l.id} className="todo-archive__label" style={{ background: l.color }}>{l.text}</span>))}
                                    </div>)}
                                    <span className="todo-archive__card-title">{ac.title}</span>
                                    {ac.description && (<p className="todo-archive__card-desc">{ac.description.slice(0, 80)}{ac.description.length > 80 ? '...' : ''}</p>)}
                                </div>
                                <div className="todo-archive__card-meta">
                                    <span className="todo-archive__card-from">{formatTodoFromColumn(columnTitles[ac.fromColumn] ?? ac.fromColumn, t)}</span>
                                    <span className="todo-archive__card-date">
                                        {new Date(ac.archivedAt).toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                </div>
                                <div className="todo-archive__card-actions">
                                    <button type="button" className="todo-archive__btn todo-archive__btn--restore" onClick={() => handleRestoreCard(ac)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                                        {t('todoPage.archive.restore')}
                                    </button>
                                    <button type="button" className="todo-archive__btn todo-archive__btn--delete" onClick={() => handleDeleteArchivedCard(ac.id)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                                        {t('todoPage.archive.delete')}
                                    </button>
                                </div>
                            </div>))}
                        {archivedCards.length === 0 && (<div className="todo-archive__empty">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8" /><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5" /><rect x="2" y="8" width="20" height="13" rx="2" /></svg>
                            <p>{t('todoPage.archive.empty')}</p>
                            <span>{t('todoPage.archive.emptyHint')}</span>
                        </div>)}
                        {archivedCards.length > 0 && archiveSearch && archivedCards.filter((c) => c.title.toLowerCase().includes(archiveSearch.toLowerCase())).length === 0 && (<div className="todo-archive__empty">
                            <p>{t('todoPage.notFound')}</p>
                        </div>)}
                    </div>

                    {archivedCards.length > 0 && (<div className="todo-archive__footer">
                        <button type="button" className="todo-archive__clear" onClick={handleClearArchive}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                            {formatTodoArchiveClear(archivedCards.length, t)}
                        </button>
                    </div>)}
                </div>
            </main>
        </div>

        {addEventOpen && createPortal(<div className="cal-event-backdrop" style={todoThemeVarsStyle}>
            <form className="cal-event-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmitEvent}>
                <div className="cal-event-modal__head">
                    <h3 className="cal-event-modal__title">{t('todoPage.calendarEvent.title')}</h3>
                    <button type="button" className="cal-event-modal__close" onClick={() => setAddEventOpen(false)} aria-label={t('todoPage.close')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>
                <div className="cal-event-modal__field">
                    <label className="cal-event-modal__label">{t('todoPage.calendarEvent.name')}</label>
                    <input className="cal-event-modal__input" value={addEventSubject} onChange={(e) => setAddEventSubject(e.target.value)} placeholder={t('todoPage.calendarEvent.namePlaceholder')} autoFocus />
                </div>
                <div className="cal-event-modal__field">
                    <label className="cal-event-modal__label">{t('todoPage.calendarEvent.date')}</label>
                    <input className="cal-event-modal__input" type="date" value={addEventDate} onChange={(e) => setAddEventDate(e.target.value)} />
                </div>
                <div className="cal-event-modal__row">
                    <div className="cal-event-modal__field">
                        <label className="cal-event-modal__label">{t('todoPage.calendarEvent.start')}</label>
                        <input className="cal-event-modal__input" type="time" value={addEventStartTime} onChange={(e) => setAddEventStartTime(e.target.value)} />
                    </div>
                    <div className="cal-event-modal__field">
                        <label className="cal-event-modal__label">{t('todoPage.calendarEvent.end')}</label>
                        <input className="cal-event-modal__input" type="time" value={addEventEndTime} onChange={(e) => setAddEventEndTime(e.target.value)} />
                    </div>
                </div>
                <div className="cal-event-modal__field">
                    <label className="cal-event-modal__label">{t('todoPage.calendarEvent.description')}</label>
                    <textarea className="cal-event-modal__input cal-event-modal__textarea" value={addEventBody} onChange={(e) => setAddEventBody(e.target.value)} placeholder={t('todoPage.calendarEvent.descriptionPlaceholder')} rows={3} />
                </div>
                {addEventError && <p className="cal-event-modal__error">{addEventError}</p>}
                <div className="cal-event-modal__actions">
                    <button type="button" className="cal-event-modal__btn cal-event-modal__btn--cancel" onClick={() => setAddEventOpen(false)}>{t('todoPage.cancel')}</button>
                    <button type="submit" className="cal-event-modal__btn cal-event-modal__btn--save" disabled={addEventSaving}>
                        {addEventSaving ? t('todoPage.saving') : t('todoPage.calendarEvent.create')}
                    </button>
                </div>
            </form>
        </div>, document.body)}
    </div>);
}
