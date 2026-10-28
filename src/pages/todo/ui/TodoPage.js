import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { AppBackButton, AppHomeLogo, AttentionBanner } from '@shared/ui';
import { routes } from '@shared/config';
import { stripHtmlToText } from '@shared/lib/sanitizeHtml';
import { createTodoBoard, createTodoCard, createTodoColumn, deleteTodoBoard, deleteTodoBoardBackground, deleteTodoCard, deleteTodoColumn, exportTodoBoard, fetchTodoBoardById, fetchTodoBoardCurrent, fetchTodoBoardsList, findNewestCardInColumn, importTodoBoard, invalidateTodoInvites, patchTodoBoard, patchTodoCard, patchTodoColumn, pickPreferredTodoBoardId, putTodoBoardCurrent, reorderTodoCardsInColumn, reorderTodoColumns, uploadTodoBoardBackground, useTodoInvitesBadge, } from '@entities/todo';
import { boardBackgroundStorageKey, pickBoardBackgroundApiPath, resolveBoardBackgroundDisplayUrl, } from '@entities/todo/lib/boardBackgroundUrl';
import { fetchMediaBlob } from '@shared/api';
import { downloadBlob } from '@shared/lib/downloadBlob';
import { resolveCalendarColumnId, unpackBoard } from '@entities/todo/lib/boardMapper';
import { cardDueDateTimeToIso } from '@entities/todo/lib/todoDueAt';
import { buildMonthGrid, } from '@entities/todo/lib/todoUtils';
import { createDefaultTodoThemeVars, deriveThemeFromImage } from '@entities/todo/lib/todoTheme';
import { getCalendarStatus, getCalendarEvents, connectOutlookCalendar, createCalendarEvent, CALENDAR_NOT_CONNECTED_MSG, } from '@entities/todo/lib/calendarApi';
import { loadTodoBoardDisplayUsers } from '@entities/todo/lib/todoDirectoryUsers';
import { useUserPublic } from '@shared/hooks';
import { isHiddenSystemUser } from '@shared/lib';
import { buildTodoUserByIdMap, publicUserAsUser } from '@entities/todo/lib/todoUserDisplay';
import { setCalendarCache } from '@entities/todo/lib/calendarCache';
import { IconImage, IconSettings, IconDownload, IconUpload, IconPlus, IconTrash, } from './TodoIcons';
import { TodoPlanner } from './TodoPlanner';
import { TodoColumn } from './TodoColumn';
import { TodoBoardsBar } from './TodoBoardsBar';
import { formatTodoArchiveClear, formatTodoFromColumn, todoLocaleTag, useI18n } from '@shared/i18n';
import { parseBoardTitleFromNotificationDescription, subscribeNotificationPush, TODO_NOTIFICATION_TYPES, } from '@entities/notification/wsClient';
import { canDeleteTodoBoard, canEditKanbanStructure, isParticipantBoardRole, isViewerBoardRole, } from '@entities/todo/lib/boardRoles';
import { pickBoardIdAfterDelete } from '@entities/todo/lib/pickBoardAfterDelete';
import { showConfirm } from '@shared/ui/app-dialog';
import { showToast } from '@shared/ui/app-toast/appToastGate';
import { TodoInvitesPanel } from './TodoInvitesPanel';
import './TodoPage.css';
const TodoAddColumnModal = lazy(() => import('./TodoAddColumnModal').then((m) => ({ default: m.TodoAddColumnModal })));
const TodoAddCardModal = lazy(() => import('./TodoAddCardModal').then((m) => ({ default: m.TodoAddCardModal })));
const TodoCardModal = lazy(() => import('./TodoCardModal').then((m) => ({ default: m.TodoCardModal })));
const TodoBoardMembersModal = lazy(() => import('./TodoBoardMembersModal').then((m) => ({ default: m.TodoBoardMembersModal })));
function sortKeyTimeForColumnList(c) {
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
        const tail = cal[1];
        let h = 0;
        for (let i = 0; i < tail.length; i += 1)
            h = (h * 31 + tail.charCodeAt(i)) | 0;
        return h;
    }
    const n = Number.parseInt(c.id, 10);
    return Number.isFinite(n) ? n : 0;
}
function resolveCardInsertIndex(clientY, columnId, draggedCardId) {
    const columnEl = document.querySelector(`[data-todo-column-id="${columnId}"]`);
    const cardsEl = columnEl?.querySelector('.todo-column__cards');
    if (!cardsEl)
        return 0;
    const cardEls = Array.from(cardsEl.querySelectorAll('[data-todo-card-id]'));
    const others = cardEls.filter((el) => el.getAttribute('data-todo-card-id') !== draggedCardId);
    for (let i = 0; i < others.length; i += 1) {
        const rect = others[i].getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (clientY < mid)
            return i;
    }
    return others.length;
}
function manualPositionInColumn(displayCards, manualCards, insertIndex, excludeCardId) {
    const manualIds = new Set(manualCards.map((c) => c.id));
    const visible = displayCards
        .filter((c) => c.id !== excludeCardId)
        .map((c) => c.id);
    const clamped = Math.max(0, Math.min(insertIndex, visible.length));
    return visible.slice(0, clamped).filter((id) => manualIds.has(id)).length;
}
function computeManualCardOrderAfterDrop(displayCards, manualCards, draggedCardId, insertIndex) {
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
    const [backgroundImage, setBackgroundImage] = useState(null);
    const [prevBackground, setPrevBackground] = useState(null);
    const [bgTransitioning, setBgTransitioning] = useState(false);
    const [bgUploading, setBgUploading] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [deletingBoard, setDeletingBoard] = useState(false);
    const [navTitleEditing, setNavTitleEditing] = useState(false);
    const [navTitleDraft, setNavTitleDraft] = useState('');
    const [columnOrder, setColumnOrder] = useState([]);
    const [columnTitles, setColumnTitles] = useState({});
    const [columnColors, setColumnColors] = useState({});
    const [boardError, setBoardError] = useState(null);
    const [activeBoardId, setActiveBoardId] = useState(null);
    const [boardSummaries, setBoardSummaries] = useState([]);
    const [boardListError, setBoardListError] = useState(null);
    const [effectiveBoardMyRole, setEffectiveBoardMyRole] = useState(null);
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
    const [collapsedColumns, setCollapsedColumns] = useState({});
    const [columnListSort, setColumnListSort] = useState({});
    const [columnHideCompleted, setColumnHideCompleted] = useState({});
    const [draggingColumn, setDraggingColumn] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [columnDragPreviewPosition, setColumnDragPreviewPosition] = useState(null);
    const columnDragOffsetRef = useRef({ x: 0, y: 0 });
    const [draggingCard, setDraggingCard] = useState(null);
    const [dropTargetCardColumn, setDropTargetCardColumn] = useState(null);
    const dropTargetCardColumnRef = useRef(null);
    const dropTargetCardInsertIndexRef = useRef(0);
    const [dragPreviewPosition, setDragPreviewPosition] = useState(null);
    const cardDragOffsetRef = useRef({ x: 0, y: 0 });
    const pendingCardDragRef = useRef(null);
    const [pendingCardDragActive, setPendingCardDragActive] = useState(false);
    const [touchPressCard, setTouchPressCard] = useState(null);
    const activeCardPointerIdRef = useRef(null);
    const cardDidDragRef = useRef(false);
    const [calendarColumnOverrides, setCalendarColumnOverrides] = useState(() => {
        const CALENDAR_OVERRIDES_KEY = 'todoCalendarColumnOverrides';
        try {
            const raw = localStorage.getItem(CALENDAR_OVERRIDES_KEY);
            if (!raw)
                return {};
            const parsed = JSON.parse(raw);
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
    const [addCardColumn, setAddCardColumn] = useState(null);
    const [addCardTitle, setAddCardTitle] = useState('');
    const [addCardSubmitting, setAddCardSubmitting] = useState(false);
    const [addColumnOpen, setAddColumnOpen] = useState(false);
    const [addColumnTitle, setAddColumnTitle] = useState('');
    const [cards, setCards] = useState({
        today: [],
        week: [],
        later: [],
    });
    const [boardLabels, setBoardLabels] = useState([]);
    const [selectedCard, setSelectedCard] = useState(null);
    const [archivedCards, setArchivedCards] = useState([]);
    const [archivedColumns, setArchivedColumns] = useState([]);
    const [archiveOpen, setArchiveOpen] = useState(false);
    const [archiveSearch, setArchiveSearch] = useState('');
    const [archiveTab, setArchiveTab] = useState('cards');
    const [calendarConnected, setCalendarConnected] = useState(false);
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [calendarConnectError, setCalendarConnectError] = useState(null);
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
    const [addEventError, setAddEventError] = useState(null);
    const [addEventSaving, setAddEventSaving] = useState(false);
    const menuRef = useRef(null);
    const fileInputRef = useRef(null);
    const importFileInputRef = useRef(null);
    const [boardIoBusy, setBoardIoBusy] = useState(null);
    const columnRefs = useRef({});
    const columnsScrollRef = useRef(null);
    const panStartXRef = useRef(0);
    const panStartScrollRef = useRef(0);
    const prevRectsRef = useRef(null);
    const dropTargetRef = useRef(null);
    const boardBackgroundSourceUrlRef = useRef(null);
    const boardBackgroundBoardIdRef = useRef(null);
    const boardSummariesRef = useRef(boardSummaries);
    boardSummariesRef.current = boardSummaries;
    const [themeVars, setThemeVars] = useState(() => createDefaultTodoThemeVars());
    const [todoUsersList, setTodoUsersList] = useState([]);
    const [todoUsersLoading, setTodoUsersLoading] = useState(true);
    const [todoUsersError, setTodoUsersError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        loadTodoBoardDisplayUsers()
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
    const [referencedUserIds, setReferencedUserIds] = useState([]);
    const referencedPublicById = useUserPublic(referencedUserIds);
    const todoBoardUsers = useMemo(() => {
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
    const stripHtml = useCallback((html) => {
        const preclean = html
            .replace(/<img\b[^>]*>/gi, ' ')
            .replace(/\s(?:src|href|poster)\s*=\s*"cid:[^"]*"/gi, ' ')
            .replace(/\s(?:src|href|poster)\s*=\s*'cid:[^']*'/gi, ' ')
            .replace(/\surl\(\s*(["']?)cid:[^)"']+\1\s*\)/gi, ' url(none)');
        const text = stripHtmlToText(preclean);
        return text.replace(/\s+/g, ' ').trim();
    }, []);
    const calendarCardsByColumn = useMemo(() => {
        const result = {};
        for (const id of columnOrder) {
            result[id] = [];
        }
        const expired = [];
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
        const pad2 = (n) => n.toString().padStart(2, '0');
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
            const card = {
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
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target))
                setMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [menuOpen]);
    const applyBackground = useCallback((url, boardId, apiMediaPath, allowBlobFallback = true) => {
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
    const applyBoardFromApi = useCallback((board, summaries) => {
        const boardList = summaries ?? boardSummariesRef.current;
        const { columnOrder: ord, columnTitles: titles, columnColors: colors, collapsedColumns: collapsed, cards: nextCards, boardLabels: labels, archivedCards: nextArchived, archivedColumns: nextArchivedCols, } = unpackBoard(board);
        setColumnOrder(ord);
        setColumnTitles(titles);
        setColumnColors(colors);
        setCards(nextCards);
        setCollapsedColumns(collapsed);
        setBoardLabels(labels);
        setArchivedColumns(nextArchivedCols);
        setArchivedCards((prev) => {
            const calendarKept = prev.filter((c) => c.fromCalendar);
            const calIds = new Set(calendarKept.map((c) => c.id));
            return [...nextArchived.filter((c) => !calIds.has(c.id)), ...calendarKept];
        });
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
                catch (e) {
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
    const commitBoard = useCallback(async (promise) => {
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
            .catch((err) => {
            setBoardSummaries([]);
            setBoardListError(err instanceof Error ? err.message : t('todoPage.errors.loadBoardList'));
        });
    }, [t]);
    const handleSelectTodoBoard = useCallback(async (boardId) => {
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
        catch (e) {
            setBoardError(e instanceof Error ? e.message : t('todoPage.errors.openBoard'));
        }
        finally {
            setInitialLoading(false);
        }
    }, [activeBoardId, applyBoardFromApi, t]);
    const handleCreateTodoBoard = useCallback(async (body) => {
        const b = await commitBoard(createTodoBoard(body));
        if (!b)
            throw new Error(t('todoPage.errors.createBoardFailed'));
        void putTodoBoardCurrent(b.id).catch(() => { });
        await reloadBoardSummaries();
    }, [commitBoard, reloadBoardSummaries, t]);
    const handleDeleteTodoBoard = useCallback(async () => {
        setMenuOpen(false);
        if (activeBoardId == null || deletingBoard)
            return;
        const name = boardSummaries.find((board) => board.id === activeBoardId)?.title.trim() || t('todoPage.page.deleteBoard');
        const ok = await showConfirm({
            title: t('todoPage.page.deleteBoardTitle'),
            message: t('todoPage.page.deleteBoardConfirm').replace('{name}', name),
            confirmLabel: t('todoPage.page.deleteBoard'),
            cancelLabel: t('todoPage.cancel'),
            variant: 'danger',
        });
        if (!ok)
            return;
        setDeletingBoard(true);
        setNavTitleEditing(false);
        try {
            await deleteTodoBoard(activeBoardId);
            const list = await fetchTodoBoardsList();
            const nextId = pickBoardIdAfterDelete(list, activeBoardId);
            if (nextId != null) {
                const next = await fetchTodoBoardById(nextId);
                const remaining = list.items.filter((board) => board.id !== activeBoardId);
                setBoardSummaries(remaining);
                setBoardListError(null);
                setActiveBoardId(next.id);
                applyBoardFromApi(next, remaining);
                void putTodoBoardCurrent(next.id).catch(() => { });
            }
            else {
                const created = await fetchTodoBoardCurrent();
                const refreshed = await fetchTodoBoardsList();
                setBoardSummaries(refreshed.items);
                setBoardListError(null);
                setActiveBoardId(created.id);
                applyBoardFromApi(created, refreshed.items);
            }
            setBoardError(null);
            showToast({ message: t('todoPage.page.boardDeleted'), variant: 'success' });
        }
        catch (e) {
            setBoardError(e instanceof Error ? e.message : t('todoPage.errors.deleteBoard'));
        }
        finally {
            setDeletingBoard(false);
        }
    }, [activeBoardId, applyBoardFromApi, boardSummaries, deletingBoard, t]);
    const handleRenameTodoBoard = useCallback(async (boardId, title) => {
        const name = title.trim();
        if (!name)
            throw new Error(t('todoPage.errors.updateBoard'));
        const b = await patchTodoBoard(boardId, { title: name });
        setBoardSummaries((prev) => prev.map((s) => (s.id === boardId ? { ...s, title: b.title ?? name } : s)));
        if (b.id === activeBoardId)
            applyBoardFromApi(b);
        setBoardError(null);
    }, [activeBoardId, applyBoardFromApi, t]);
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
        catch (e) {
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
    const handleImportFileChange = async (e) => {
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
        catch (err) {
            setBoardError(err instanceof Error ? err.message : t('todoPage.errors.importBoard'));
        }
        finally {
            setBoardIoBusy(null);
            setInitialLoading(false);
        }
    };
    const handleBackgroundChange = async (e) => {
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
        const onKey = (e) => {
            if (e.key === 'Escape')
                setSelectedCard(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedCard]);
    useEffect(() => {
        if (!mobilePlannerOpen)
            return;
        const onKey = (e) => {
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
                    let board;
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
                catch (err) {
                    if (!cancelled)
                        setBoardError(err instanceof Error ? err.message : t('todoPage.errors.loadTodoBoard'));
                }
            })
                .catch((err) => {
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
            .catch((err) => {
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
    const handleOpenAddEvent = useCallback((date) => {
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
    const handleSubmitEvent = useCallback(async (e) => {
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
    const archivedCalIdsRef = useRef(new Set());
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
        const next = new Set();
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
        const result = {};
        const cols = calendarCardsByColumn.columns;
        const calendarByColumn = {};
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
        const out = {};
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
    const moveColumns = useMemo(() => columnConfig.map((c) => ({ id: c.id, title: c.title })), [columnConfig]);
    const handleAddColumn = useCallback(() => {
        const title = addColumnTitle.trim();
        if (!title || activeBoardId == null)
            return;
        void commitBoard(createTodoColumn(activeBoardId, { title }));
        setAddColumnTitle('');
        setAddColumnOpen(false);
    }, [addColumnTitle, activeBoardId, commitBoard]);
    const handleColumnMouseDown = useCallback((e, id) => {
        if (e.pointerType === 'mouse' && e.button !== 0)
            return;
        if (e.target.closest('button'))
            return;
        e.preventDefault();
        const node = columnRefs.current[id];
        if (node) {
            const rect = node.getBoundingClientRect();
            columnDragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            setColumnDragPreviewPosition({ x: rect.left, y: rect.top });
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            }
            catch { }
        }
        setDraggingColumn(id);
        setDropTarget(null);
    }, []);
    const handleColumnsAreaMouseDown = useCallback((e) => {
        if (e.pointerType !== 'mouse')
            return;
        if (e.button !== 0)
            return;
        const el = e.target;
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
        const onMove = (e) => {
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
        const onMove = (e) => {
            e.preventDefault();
            setColumnDragPreviewPosition({
                x: e.clientX - columnDragOffsetRef.current.x,
                y: e.clientY - columnDragOffsetRef.current.y,
            });
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const columnEl = el?.closest?.('[data-todo-column-id]');
            const id = columnEl?.getAttribute('data-todo-column-id');
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
                const rects = {};
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
    const handleToggleCollapse = useCallback((cid) => {
        if (activeBoardId == null)
            return;
        const collapsed = !!collapsedColumns[cid];
        void commitBoard(patchTodoColumn(activeBoardId, Number(cid), { isCollapsed: !collapsed }));
    }, [activeBoardId, collapsedColumns, commitBoard]);
    const handleExpand = useCallback((cid) => {
        if (activeBoardId == null)
            return;
        void commitBoard(patchTodoColumn(activeBoardId, Number(cid), { isCollapsed: false }));
    }, [activeBoardId, commitBoard]);
    const handleAddCardClick = useCallback((cid) => {
        setAddCardColumn(cid);
        setAddCardTitle('');
    }, []);
    const handleCardClick = useCallback((cid, cardId) => {
        if (cardDidDragRef.current) {
            cardDidDragRef.current = false;
            return;
        }
        setSelectedCard({ columnId: cid, cardId });
    }, []);
    const handleCardToggleComplete = useCallback((cid, cardId) => {
        const card = mergedCards[cid]?.find((c) => c.id === cardId);
        if (!card || card.fromCalendar || activeBoardId == null)
            return;
        void commitBoard(patchTodoCard(activeBoardId, Number(cardId), { isCompleted: !card.completed }));
    }, [activeBoardId, mergedCards, commitBoard]);
    const handleColumnKeyDown = useCallback((id) => {
        setDraggingColumn(id);
    }, []);
    const handleCardDragStart = useCallback((e, columnId, cardId, cardRect, fromDragHandle = false) => {
        if (e.pointerType === 'mouse' && e.button !== 0)
            return;
        if (e.pointerType === 'touch' && !fromDragHandle)
            return;
        cardDidDragRef.current = false;
        const pointerElement = (fromDragHandle
            ? e.currentTarget.closest('[data-todo-card-id]')
            : e.currentTarget);
        if (e.pointerType === 'touch') {
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            }
            catch { }
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
    const handleSortCards = useCallback((colId, mode) => {
        setColumnListSort((prev) => ({ ...prev, [colId]: mode }));
    }, []);
    const handleToggleHideCompleted = useCallback((colId) => {
        setColumnHideCompleted((prev) => ({ ...prev, [colId]: !prev[colId] }));
    }, []);
    const handleRenameColumn = useCallback((colId, title) => {
        if (activeBoardId == null)
            return;
        void commitBoard(patchTodoColumn(activeBoardId, Number(colId), { title }));
    }, [activeBoardId, commitBoard]);
    const handleArchiveAllCardsInColumn = useCallback(async (colId) => {
        if (activeBoardId == null)
            return;
        const list = cards[colId] || [];
        let lastBoard = null;
        for (const c of list) {
            try {
                lastBoard = await patchTodoCard(activeBoardId, Number(c.id), { isArchived: true });
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
    const handleArchiveColumn = useCallback((colId) => {
        if (activeBoardId == null)
            return;
        void commitBoard(patchTodoColumn(activeBoardId, Number(colId), { isArchived: true }));
    }, [activeBoardId, commitBoard]);
    const handleRestoreColumn = useCallback((colId) => {
        if (activeBoardId == null)
            return;
        void commitBoard(patchTodoColumn(activeBoardId, Number(colId), { isArchived: false }));
    }, [activeBoardId, commitBoard]);
    const handleDeleteArchivedColumn = useCallback((colId) => {
        if (activeBoardId == null)
            return;
        void commitBoard(deleteTodoColumn(activeBoardId, Number(colId)));
    }, [activeBoardId, commitBoard]);
    const handleDeleteColumn = useCallback((colId) => {
        if (activeBoardId == null)
            return;
        void commitBoard(deleteTodoColumn(activeBoardId, Number(colId)));
    }, [activeBoardId, commitBoard]);
    const handleMoveCard = useCallback((fromColumnId, cardId, toColumnId, insertIndex) => {
        if (fromColumnId === toColumnId || activeBoardId == null)
            return;
        const card = mergedCards[fromColumnId]?.find((c) => c.id === cardId);
        if (!card)
            return;
        if (card.fromCalendar && card.calendarEventId) {
            setCalendarColumnOverrides((prev) => ({ ...prev, [card.calendarEventId]: toColumnId }));
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
    const handleReorderCardsInColumn = useCallback((columnId, cardId, insertIndex) => {
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
        const beginCardDrag = (pending) => {
            activeCardPointerIdRef.current = pending.pointerId;
            try {
                pending.pointerElement?.setPointerCapture(pending.pointerId);
            }
            catch { }
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
        const onMove = (e) => {
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
                const columnEl = el?.closest?.('[data-todo-column-id]');
                const id = columnEl?.getAttribute('data-todo-column-id');
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
                const columnEl = el?.closest?.('[data-todo-column-id]');
                const id = columnEl?.getAttribute('data-todo-column-id');
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
        const onUp = (e) => {
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
    const handleArchiveCard = useCallback(async (columnId, cardId) => {
        const card = mergedCards[columnId]?.find((c) => c.id === cardId);
        if (!card) {
            setSelectedCard(null);
            return;
        }
        if (card.fromCalendar) {
            setSelectedCard(null);
            return;
        }
        if (activeBoardId == null)
            return;
        const board = await commitBoard(patchTodoCard(activeBoardId, Number(cardId), { isArchived: true }));
        if (!board)
            return;
        setSelectedCard(null);
    }, [mergedCards, activeBoardId, commitBoard]);
    const handleRestoreCard = useCallback((archivedCard) => {
        if (activeBoardId == null)
            return;
        if (archivedCard.fromCalendar) {
            setArchivedCards((prev) => prev.filter((c) => c.id !== archivedCard.id));
            return;
        }
        const targetCol = columnOrder.includes(archivedCard.fromColumn)
            ? archivedCard.fromColumn
            : columnOrder[0];
        const payload = { isArchived: false };
        if (targetCol && targetCol !== archivedCard.fromColumn)
            payload.columnId = Number(targetCol);
        void commitBoard(patchTodoCard(activeBoardId, Number(archivedCard.id), payload));
    }, [columnOrder, activeBoardId, commitBoard]);
    const handleDeleteArchivedCard = useCallback((cardId) => {
        const row = archivedCards.find((c) => c.id === cardId);
        if (!row || row.fromCalendar) {
            setArchivedCards((prev) => prev.filter((c) => c.id !== cardId));
            return;
        }
        if (activeBoardId == null)
            return;
        void commitBoard(deleteTodoCard(activeBoardId, Number(cardId)));
    }, [archivedCards, activeBoardId, commitBoard]);
    const handleClearArchive = useCallback(() => {
        if (activeBoardId == null)
            return;
        const bid = activeBoardId;
        const toDelete = archivedCards.filter((c) => !c.fromCalendar);
        void (async () => {
            let lastBoard = null;
            for (const c of toDelete) {
                try {
                    lastBoard = await deleteTodoCard(bid, Number(c.id));
                }
                catch {
                    break;
                }
            }
            if (lastBoard) {
                applyBoardFromApi(lastBoard);
                setActiveBoardId(lastBoard.id);
            }
            setArchivedCards((prev) => prev.filter((c) => c.fromCalendar));
        })();
    }, [activeBoardId, archivedCards, applyBoardFromApi]);
    const handleColumnRef = useCallback((id) => (node) => {
        columnRefs.current[id] = node;
    }, []);
    const selectedCardData = selectedCard ? mergedCards[selectedCard.columnId]?.find((c) => c.id === selectedCard.cardId) : null;
    const modalColumnOptions = useMemo(() => columnOrder.map((id) => ({ id, title: columnTitles[id] ?? '' })), [columnOrder, columnTitles]);
    const handleModalMoveToColumn = useCallback(async (targetColumnId) => {
        if (!selectedCard)
            return;
        if (selectedCard.columnId === targetColumnId)
            return;
        const card = mergedCards[selectedCard.columnId]?.find((c) => c.id === selectedCard.cardId);
        if (!card)
            return;
        if (card.fromCalendar && card.calendarEventId) {
            setCalendarColumnOverrides((prev) => ({ ...prev, [card.calendarEventId]: targetColumnId }));
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
    const handleModalCardUpdate = useCallback((patch) => {
        if (!selectedCard || !selectedCardData || activeBoardId == null)
            return;
        const c = selectedCardData;
        if (c.fromCalendar)
            return;
        const merged = { ...c, ...patch };
        const cardId = Number(selectedCard.cardId);
        const payload = {};
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
    const applyTodoBoard = useCallback((promise) => commitBoard(promise), [commitBoard]);
    const draggingCardData = draggingCard ? mergedCards[draggingCard.columnId]?.find((c) => c.id === draggingCard.cardId) : null;
    const draggingColumnConfig = draggingColumn ? columnConfig.find((c) => c.id === draggingColumn) : null;
    const draggingColumnCardCount = draggingColumn ? (mergedCards[draggingColumn]?.length ?? 0) : 0;
    const todoThemeVarsStyle = useMemo(() => ({
        ['--todo-accent']: themeVars.accent,
        ['--todo-text']: themeVars.text,
        ['--todo-muted']: themeVars.muted,
        ['--todo-surface']: themeVars.surface,
        ['--todo-surface2']: themeVars.surface2,
        ['--todo-panel-bg']: themeVars.panelBg,
        ['--todo-border']: themeVars.border,
        ['--todo-shadow']: themeVars.shadow,
        ['--todo-header-bg']: themeVars.headerBg,
        ['--todo-nav-shadow']: themeVars.navShadow,
        ['--todo-column-today-bg']: themeVars.columnTodayBg,
        ['--todo-column-today-text']: themeVars.columnTodayText,
        ['--todo-column-week-bg']: themeVars.columnWeekBg,
        ['--todo-column-week-text']: themeVars.columnWeekText,
        ['--todo-column-later-bg']: themeVars.columnLaterBg,
        ['--todo-column-later-text']: themeVars.columnLaterText,
        colorScheme: themeVars.isDark ? 'dark' : 'light',
    }), [themeVars]);
    const isParticipantOnlyBoard = isParticipantBoardRole(effectiveBoardMyRole);
    const isViewerOnlyBoard = isViewerBoardRole(effectiveBoardMyRole);
    const structureReadOnly = !canEditKanbanStructure(effectiveBoardMyRole);
    const cardsReadOnly = isViewerOnlyBoard;
    const activeBoardSummary = boardSummaries.find((b) => b.id === activeBoardId);
    const showMembersSettings = canEditKanbanStructure(effectiveBoardMyRole);
    const canDeleteBoard = canDeleteTodoBoard(effectiveBoardMyRole) && activeBoardId != null;
    const handleInviteAccepted = useCallback(async (board) => {
        applyBoardFromApi(board);
        setActiveBoardId(board.id);
        setBoardError(null);
        await reloadBoardSummaries();
    }, [applyBoardFromApi, reloadBoardSummaries]);
    return (_jsxs("div", { className: `todo-page${initialLoading ? ' todo-page--skeleton' : ''}`, style: todoThemeVarsStyle, children: [boardError && (_jsxs("div", { className: "todo-page__board-error", role: "alert", children: [_jsx("span", { className: "todo-page__board-error-text", children: boardError }), _jsx("button", { type: "button", className: "todo-page__board-error-retry", onClick: () => {
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
                                catch (err) {
                                    setBoardError(err instanceof Error ? err.message : t('todoPage.errors.load'));
                                }
                            })();
                        }, children: t('todoPage.retry') })] })), !initialLoading && isParticipantOnlyBoard && (_jsx("div", { className: "todo-page__participant-hint", role: "status", children: t('todoPage.participantViewHint') })), !initialLoading && isViewerOnlyBoard && (_jsx("div", { className: "todo-page__participant-hint todo-page__participant-hint--viewer", role: "status", children: t('todoPage.viewerViewHint') })), _jsx("header", { className: `todo-page__header${initialLoading ? ' todo-page__header--skeleton' : ''}`, children: _jsx("div", { className: "todo-page__nav", children: initialLoading ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "todo-page__header-skel todo-page__header-skel--back" }), _jsx("div", { className: "todo-page__nav-center", children: _jsx("div", { className: "todo-page__header-skel todo-page__header-skel--search" }) }), _jsxs("div", { className: "todo-page__nav-right", children: [_jsx("div", { className: "todo-page__header-skel todo-page__header-skel--btn" }), _jsx("div", { className: "todo-page__header-skel todo-page__header-skel--btn todo-page__header-skel--icon" })] })] })) : (_jsxs(_Fragment, { children: [_jsx(AppBackButton, { to: routes.home, label: t('todoPage.back'), ariaLabel: t('todoPage.backAria'), hideLabelOnMobile: true }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("div", { className: "todo-page__nav-center", children: _jsxs("div", { className: "todo-page__search-wrap", children: [_jsxs("svg", { className: "todo-page__search-icon", width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("path", { d: "m21 21-4.3-4.3" })] }), _jsx("input", { className: "todo-page__search", placeholder: t('todoPage.page.searchTasks'), type: "search" })] }) }), _jsxs("div", { className: "todo-page__nav-right", children: [_jsxs("button", { type: "button", className: `todo-page__header-btn todo-page__header-btn--planner${mobilePlannerOpen ? ' todo-page__header-btn--active' : ''}`, onClick: () => { setMobilePlannerOpen((v) => !v); setArchiveOpen(false); }, "aria-label": t('todoPage.planner.openMobile'), children: [_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), _jsx("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), _jsx("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), _jsx("line", { x1: "3", y1: "10", x2: "21", y2: "10" })] }), _jsx("span", { children: t('todoPage.planner.openMobile') })] }), _jsx(TodoInvitesPanel, { open: invitesOpen, onOpenChange: setInvitesOpen, onAccepted: handleInviteAccepted, onInvitesChanged: () => {
                                            invalidateTodoInvites();
                                            void reloadBoardSummaries();
                                        } }), _jsxs("button", { type: "button", className: `todo-page__header-btn${archiveOpen ? ' todo-page__header-btn--active' : ''}`, onClick: () => { setArchiveOpen((v) => !v); setMobilePlannerOpen(false); }, children: [_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8" }), _jsx("path", { d: "M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5" }), _jsx("rect", { x: "2", y: "8", width: "20", height: "13", rx: "2" })] }), _jsx("span", { children: t('todoPage.page.archive') }), archivedCards.length + archivedColumns.length > 0 && _jsx("span", { className: "todo-page__header-badge", children: archivedCards.length + archivedColumns.length })] }), _jsxs("div", { className: "todo-page__menu-wrap", ref: menuRef, children: [_jsx("button", { type: "button", className: "todo-page__header-btn todo-page__header-btn--icon", "aria-label": t('todoPage.page.more'), onClick: () => setMenuOpen((v) => !v), children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: [_jsx("circle", { cx: "5", cy: "12", r: "2" }), _jsx("circle", { cx: "12", cy: "12", r: "2" }), _jsx("circle", { cx: "19", cy: "12", r: "2" })] }) }), menuOpen && (_jsxs("div", { className: "todo-page__menu-dropdown", children: [!structureReadOnly && (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "todo-page__menu-item", onClick: () => {
                                                                    setMenuOpen(false);
                                                                    if (!activeBoardSummary)
                                                                        return;
                                                                    setNavTitleDraft(activeBoardSummary.title);
                                                                    setNavTitleEditing(true);
                                                                }, children: [_jsx("span", { className: "todo-page__menu-icon", children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" }) }) }), _jsx("span", { className: "todo-page__menu-text", children: t('todoPage.page.renameBoard') })] }), _jsxs("button", { type: "button", className: "todo-page__menu-item", onClick: handlePickBackground, disabled: bgUploading, children: [_jsx("span", { className: "todo-page__menu-icon", children: _jsx(IconImage, {}) }), _jsx("span", { className: "todo-page__menu-text", children: bgUploading ? t('todoPage.loading') : t('todoPage.page.bgWorkspace') })] }), backgroundImage && (_jsxs("button", { type: "button", className: "todo-page__menu-item todo-page__menu-item--danger", onClick: handleDeleteBackground, children: [_jsx("span", { className: "todo-page__menu-icon", children: _jsx(IconTrash, {}) }), _jsx("span", { className: "todo-page__menu-text", children: t('todoPage.page.removeBg') })] }))] })), showMembersSettings && (_jsxs("button", { type: "button", className: "todo-page__menu-item", onClick: () => { setMenuOpen(false); setMembersModalOpen(true); }, children: [_jsx("span", { className: "todo-page__menu-icon", children: _jsx(IconSettings, {}) }), _jsx("span", { className: "todo-page__menu-text", children: t('todoPage.members.menuItem') })] })), _jsxs("button", { type: "button", className: "todo-page__menu-item", onClick: () => void handleExportBoard(), disabled: activeBoardId == null || boardIoBusy != null, children: [_jsx("span", { className: "todo-page__menu-icon", children: _jsx(IconDownload, {}) }), _jsx("span", { className: "todo-page__menu-text", children: boardIoBusy === 'export' ? t('todoPage.page.exporting') : t('todoPage.page.exportData') })] }), _jsxs("button", { type: "button", className: "todo-page__menu-item", onClick: handlePickImport, disabled: boardIoBusy != null, children: [_jsx("span", { className: "todo-page__menu-icon", children: _jsx(IconUpload, {}) }), _jsx("span", { className: "todo-page__menu-text", children: boardIoBusy === 'import' ? t('todoPage.page.importing') : t('todoPage.page.importData') })] }), canDeleteBoard && (_jsxs("button", { type: "button", className: "todo-page__menu-item todo-page__menu-item--danger", onClick: () => void handleDeleteTodoBoard(), disabled: deletingBoard, children: [_jsx("span", { className: "todo-page__menu-icon", children: _jsx(IconTrash, {}) }), _jsx("span", { className: "todo-page__menu-text", children: deletingBoard ? t('todoPage.loading') : t('todoPage.page.deleteBoard') })] }))] }))] })] })] })) }) }), invitesCount > 0 && !invitesOpen ? (_jsx(AttentionBanner, { className: "todo-page__attention", text: t('attentionBanner.todoInvites').replace('{count}', String(invitesCount)), actionLabel: t('attentionBanner.todoInvitesGo'), onAction: () => setInvitesOpen(true) })) : null, draggingCard && dragPreviewPosition && draggingCardData && createPortal(_jsx("div", { className: "todo-card-drag-preview", style: { left: dragPreviewPosition.x, top: dragPreviewPosition.y }, children: _jsxs("div", { className: "todo-card-drag-preview__inner", children: [draggingCardData.fromCalendar && (_jsx("span", { className: "todo-card-drag-preview__badge", children: "Outlook" })), _jsx("span", { className: "todo-card-drag-preview__title", children: draggingCardData.title })] }) }), document.body), draggingColumn && columnDragPreviewPosition && draggingColumnConfig && createPortal(_jsx("div", { className: "todo-column-drag-preview", style: { left: columnDragPreviewPosition.x, top: columnDragPreviewPosition.y }, children: _jsxs("div", { className: "todo-column-drag-preview__inner", style: draggingColumn && columnColors[draggingColumn]
                        ? { '--todo-column-dot': columnColors[draggingColumn] }
                        : undefined, children: [_jsxs("div", { className: "todo-column-drag-preview__head", children: [_jsx("span", { className: "todo-column-drag-preview__dot" }), _jsx("span", { className: "todo-column-drag-preview__title", children: draggingColumnConfig.title }), _jsx("span", { className: "todo-column-drag-preview__count", children: draggingColumnCardCount })] }), draggingColumnCardCount > 0 && (_jsxs("div", { className: "todo-column-drag-preview__body", children: [_jsx("div", { className: "todo-column-drag-preview__stub" }), draggingColumnCardCount > 1 && _jsx("div", { className: "todo-column-drag-preview__stub" }), draggingColumnCardCount > 2 && _jsx("div", { className: "todo-column-drag-preview__stub" })] }))] }) }), document.body), _jsxs("div", { className: `todo-page__body${mobilePlannerOpen ? ' todo-page__body--planner-open' : ''}`, children: [_jsx("div", { className: "todo-page__planner-backdrop", onClick: () => setMobilePlannerOpen(false), "aria-hidden": "true" }), _jsx(TodoPlanner, { plannerCollapsed: plannerCollapsed, setPlannerCollapsed: setPlannerCollapsed, currentMonth: currentMonth, monthDays: monthDays, monthLabel: monthLabel, today: today, onPrevMonth: handlePrevMonth, onNextMonth: handleNextMonth, calendarConnected: calendarConnected, calendarEvents: calendarEvents, calendarConnectError: calendarConnectError, onConnectCalendar: handleConnectCalendar, onAddEvent: handleOpenAddEvent, onEditEvent: () => { }, loading: initialLoading || calendarLoading, onMobileClose: () => setMobilePlannerOpen(false) }), _jsxs("main", { className: `todo-page__main ${backgroundImage ? 'todo-page__main--with-bg' : ''}`, children: [prevBackground && bgTransitioning && (_jsx("div", { className: "todo-page__bg-layer todo-page__bg-layer--old", style: { backgroundImage: `url(${prevBackground})` } })), backgroundImage && (_jsx("div", { className: `todo-page__bg-layer todo-page__bg-layer--new${bgTransitioning ? ' todo-page__bg-layer--entering' : ''}`, style: { backgroundImage: `url(${backgroundImage})` } })), backgroundImage && _jsx("div", { className: "todo-page__bg-overlay" }), activeBoardSummary && (_jsx("div", { className: "todo-page__board-head", children: navTitleEditing && !structureReadOnly ? (_jsx("input", { className: "todo-page__board-title-input", value: navTitleDraft, maxLength: 200, autoFocus: true, "aria-label": t('todoPage.page.renameBoard'), onChange: (e) => setNavTitleDraft(e.target.value), onBlur: () => {
                                        const next = navTitleDraft.trim();
                                        setNavTitleEditing(false);
                                        if (!next || next === activeBoardSummary.title || activeBoardId == null)
                                            return;
                                        void handleRenameTodoBoard(activeBoardId, next).catch((e) => {
                                            setBoardError(e instanceof Error ? e.message : t('todoPage.errors.updateBoard'));
                                        });
                                    }, onKeyDown: (e) => {
                                        if (e.key === 'Enter')
                                            e.target.blur();
                                        if (e.key === 'Escape') {
                                            setNavTitleEditing(false);
                                            setNavTitleDraft(activeBoardSummary.title);
                                        }
                                    } })) : (_jsxs("button", { type: "button", className: "todo-page__board-title", disabled: structureReadOnly, title: structureReadOnly ? undefined : t('todoPage.page.renameBoard'), onClick: () => {
                                        if (structureReadOnly)
                                            return;
                                        setNavTitleDraft(activeBoardSummary.title);
                                        setNavTitleEditing(true);
                                    }, children: [_jsx("span", { className: "todo-page__board-title-text", children: activeBoardSummary.title }), !structureReadOnly && (_jsx("svg", { className: "todo-page__board-title-edit", width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" }) }))] })) })), _jsx("div", { ref: columnsScrollRef, className: `todo-columns ${isPanning ? 'todo-columns--panning' : ''}`, onPointerDown: handleColumnsAreaMouseDown, children: initialLoading ? (_jsx(_Fragment, { children: ['today', 'week', 'later'].map((id) => (_jsxs("div", { className: "todo-column todo-column--skeleton", children: [_jsx("div", { className: "todo-column__head", children: _jsxs("div", { className: "todo-column__head-left", children: [_jsx("span", { className: "todo-column__dot" }), _jsx("div", { className: "todo-skel todo-skel--title" }), _jsx("div", { className: "todo-skel todo-skel--badge" })] }) }), _jsx("div", { className: "todo-column__cards", children: Array.from({ length: id === 'today' ? 3 : 2 }).map((_, i) => (_jsxs("div", { className: "todo-card todo-card--skeleton", children: [_jsx("div", { className: "todo-skel todo-skel--label" }), _jsx("div", { className: "todo-skel todo-skel--line" }), _jsx("div", { className: "todo-skel todo-skel--line-short" })] }, i))) })] }, id))) })) : (_jsxs(_Fragment, { children: [columnOrder.map((id) => {
                                            const config = columnConfig.find((c) => c.id === id);
                                            const isCollapsed = collapsedColumns[id];
                                            const fullCol = mergedCards[id] || [];
                                            const progressDone = fullCol.filter((c) => c.completed).length;
                                            const progressTotal = fullCol.length;
                                            return (_jsx(TodoColumn, { config: config, todoBoardUsers: todoBoardUsers, isCollapsed: !!isCollapsed, cards: displayCardsByColumn[id] || [], columnProgressDone: progressDone, columnProgressTotal: progressTotal, listSortMode: columnListSort[id] ?? 'server', hideCompletedFilter: !!columnHideCompleted[id], isDragging: draggingColumn === id, isDropTarget: dropTarget === id, structureReadOnly: structureReadOnly, cardsReadOnly: cardsReadOnly, onColumnMouseDown: handleColumnMouseDown, onColumnKeyDown: handleColumnKeyDown, onToggleCollapse: handleToggleCollapse, onExpand: handleExpand, onAddCardClick: handleAddCardClick, onCardClick: handleCardClick, onCardToggleComplete: handleCardToggleComplete, onSortCards: handleSortCards, onToggleHideCompleted: handleToggleHideCompleted, onRenameColumn: handleRenameColumn, onArchiveAllCards: handleArchiveAllCardsInColumn, onArchiveColumn: handleArchiveColumn, onDeleteColumn: handleDeleteColumn, onArchiveCard: handleArchiveCard, onMoveCard: handleMoveCard, moveColumns: moveColumns, onCardDragStart: handleCardDragStart, isCardDropTarget: dropTargetCardColumn === id, draggingCard: draggingCard, touchPressCard: touchPressCard, columnRef: handleColumnRef(id) }, id));
                                        }), !structureReadOnly && (_jsxs("button", { type: "button", className: "todo-columns__add", onClick: () => { setAddColumnOpen(true); setAddColumnTitle(''); }, "aria-label": t('todoPage.page.addColumnAria'), children: [_jsx(IconPlus, {}), _jsx("span", { children: t('todoPage.page.addColumn') })] }))] })) }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", style: { display: 'none' }, onChange: handleBackgroundChange }), _jsx("input", { ref: importFileInputRef, type: "file", accept: "application/json,.json", style: { display: 'none' }, onChange: (e) => void handleImportFileChange(e) }), _jsxs(Suspense, { fallback: null, children: [addColumnOpen && (_jsx(TodoAddColumnModal, { title: addColumnTitle, onTitleChange: setAddColumnTitle, onClose: () => { setAddColumnOpen(false); setAddColumnTitle(''); }, onSubmit: handleAddColumn })), addCardColumn && (_jsx(TodoAddCardModal, { columnTitle: columnConfig.find((c) => c.id === addCardColumn)?.title ?? '', title: addCardTitle, onTitleChange: setAddCardTitle, onClose: () => { if (!addCardSubmitting) {
                                            setAddCardColumn(null);
                                            setAddCardTitle('');
                                        } }, onSubmit: () => void handleAddCard(), submitting: addCardSubmitting })), selectedCard && selectedCardData && activeBoardId != null && (_jsx(TodoCardModal, { boardId: activeBoardId, boardReadOnly: cardsReadOnly, card: selectedCardData, columnTitle: columnTitles[selectedCard.columnId] ?? '', columnId: selectedCard.columnId, columns: modalColumnOptions, boardLabels: boardLabels, todoBoardUsers: todoBoardUsers, cardServerId: Number(selectedCard.cardId), applyTodoBoard: applyTodoBoard, onMoveToColumn: handleModalMoveToColumn, onClose: () => setSelectedCard(null), onCardUpdate: handleModalCardUpdate, onArchive: () => handleArchiveCard(selectedCard.columnId, selectedCard.cardId) })), membersModalOpen && activeBoardId != null && (_jsx(TodoBoardMembersModal, { boardId: activeBoardId, boardTitle: activeBoardSummary?.title ?? '', themeVarsStyle: todoThemeVarsStyle, onClose: () => setMembersModalOpen(false), onMembersChanged: () => void reloadBoardSummaries() }))] }), _jsx(TodoBoardsBar, { themeVarsStyle: todoThemeVarsStyle, boards: boardSummaries, currentBoardId: activeBoardId, listError: boardListError, onSelectBoard: handleSelectTodoBoard, onCreateBoard: handleCreateTodoBoard, onRenameBoard: handleRenameTodoBoard }), _jsxs("div", { className: `todo-archive${archiveOpen ? ' todo-archive--open' : ''}`, children: [_jsxs("div", { className: "todo-archive__header", children: [_jsxs("h3", { className: "todo-archive__title", children: [_jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8" }), _jsx("path", { d: "M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5" }), _jsx("rect", { x: "2", y: "8", width: "20", height: "13", rx: "2" })] }), t('todoPage.archive.title')] }), _jsx("button", { type: "button", className: "todo-archive__close", onClick: () => setArchiveOpen(false), "aria-label": t('todoPage.archive.closeAria'), children: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { className: "todo-archive__tabs", children: [_jsxs("button", { type: "button", className: `todo-archive__tab${archiveTab === 'cards' ? ' todo-archive__tab--on' : ''}`, onClick: () => setArchiveTab('cards'), children: [t('todoPage.archive.tabCards'), archivedCards.length > 0 ? ` ${archivedCards.length}` : ''] }), _jsxs("button", { type: "button", className: `todo-archive__tab${archiveTab === 'lists' ? ' todo-archive__tab--on' : ''}`, onClick: () => setArchiveTab('lists'), children: [t('todoPage.archive.tabLists'), archivedColumns.length > 0 ? ` ${archivedColumns.length}` : ''] })] }), _jsxs("div", { className: "todo-archive__search-wrap", children: [_jsxs("svg", { className: "todo-archive__search-icon", width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("path", { d: "m21 21-4.3-4.3" })] }), _jsx("input", { className: "todo-archive__search", type: "search", placeholder: t('todoPage.archive.search'), value: archiveSearch, onChange: (e) => setArchiveSearch(e.target.value) })] }), archiveTab === 'lists' ? (_jsxs("div", { className: "todo-archive__list", children: [archivedColumns
                                                .filter((col) => !archiveSearch || col.title.toLowerCase().includes(archiveSearch.toLowerCase()))
                                                .map((col) => (_jsxs("div", { className: "todo-archive__card", children: [_jsxs("div", { className: "todo-archive__card-header", children: [_jsx("span", { className: "todo-archive__card-title", children: col.title }), _jsx("p", { className: "todo-archive__card-desc", children: t('todoPage.archive.listCardsCount').replace('{count}', String(col.cardCount)) })] }), _jsxs("div", { className: "todo-archive__card-actions", children: [_jsxs("button", { type: "button", className: "todo-archive__btn todo-archive__btn--restore", onClick: () => handleRestoreColumn(col.id), children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "1 4 1 10 7 10" }), _jsx("path", { d: "M3.51 15a9 9 0 1 0 2.13-9.36L1 10" })] }), t('todoPage.archive.restore')] }), _jsxs("button", { type: "button", className: "todo-archive__btn todo-archive__btn--delete", onClick: () => handleDeleteArchivedColumn(col.id), children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M3 6h18" }), _jsx("path", { d: "M8 6V4h8v2" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" })] }), t('todoPage.archive.delete')] })] })] }, col.id))), archivedColumns.length === 0 && (_jsxs("div", { className: "todo-archive__empty", children: [_jsx("p", { children: t('todoPage.archive.emptyLists') }), _jsx("span", { children: t('todoPage.archive.emptyListsHint') })] }))] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "todo-archive__list", children: [archivedCards
                                                        .filter((c) => !archiveSearch || c.title.toLowerCase().includes(archiveSearch.toLowerCase()))
                                                        .map((ac) => (_jsxs("div", { className: "todo-archive__card", children: [_jsxs("div", { className: "todo-archive__card-header", children: [(ac.labels?.length ?? 0) > 0 && (_jsx("div", { className: "todo-archive__card-labels", children: ac.labels.map((l) => (_jsx("span", { className: "todo-archive__label", style: { background: l.color }, children: l.text }, l.id))) })), _jsx("span", { className: "todo-archive__card-title", children: ac.title }), ac.description && (_jsxs("p", { className: "todo-archive__card-desc", children: [ac.description.slice(0, 80), ac.description.length > 80 ? '...' : ''] }))] }), _jsxs("div", { className: "todo-archive__card-meta", children: [_jsx("span", { className: "todo-archive__card-from", children: formatTodoFromColumn(columnTitles[ac.fromColumn] ?? archivedColumns.find((c) => c.id === ac.fromColumn)?.title ?? ac.fromColumn, t) }), _jsx("span", { className: "todo-archive__card-date", children: new Date(ac.archivedAt).toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' }) })] }), _jsxs("div", { className: "todo-archive__card-actions", children: [_jsxs("button", { type: "button", className: "todo-archive__btn todo-archive__btn--restore", onClick: () => handleRestoreCard(ac), children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "1 4 1 10 7 10" }), _jsx("path", { d: "M3.51 15a9 9 0 1 0 2.13-9.36L1 10" })] }), t('todoPage.archive.restore')] }), _jsxs("button", { type: "button", className: "todo-archive__btn todo-archive__btn--delete", onClick: () => handleDeleteArchivedCard(ac.id), children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M3 6h18" }), _jsx("path", { d: "M8 6V4h8v2" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" })] }), t('todoPage.archive.delete')] })] })] }, ac.id))), archivedCards.length === 0 && (_jsxs("div", { className: "todo-archive__empty", children: [_jsxs("svg", { width: "40", height: "40", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8" }), _jsx("path", { d: "M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5" }), _jsx("rect", { x: "2", y: "8", width: "20", height: "13", rx: "2" })] }), _jsx("p", { children: t('todoPage.archive.empty') }), _jsx("span", { children: t('todoPage.archive.emptyHint') })] })), archivedCards.length > 0 && archiveSearch && archivedCards.filter((c) => c.title.toLowerCase().includes(archiveSearch.toLowerCase())).length === 0 && (_jsx("div", { className: "todo-archive__empty", children: _jsx("p", { children: t('todoPage.notFound') }) }))] }), archivedCards.filter((c) => !c.fromCalendar).length > 0 && (_jsx("div", { className: "todo-archive__footer", children: _jsxs("button", { type: "button", className: "todo-archive__clear", onClick: handleClearArchive, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M3 6h18" }), _jsx("path", { d: "M8 6V4h8v2" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" })] }), formatTodoArchiveClear(archivedCards.filter((c) => !c.fromCalendar).length, t)] }) }))] }))] })] })] }), addEventOpen && createPortal(_jsx("div", { className: "cal-event-backdrop", style: todoThemeVarsStyle, children: _jsxs("form", { className: "cal-event-modal", onClick: (e) => e.stopPropagation(), onSubmit: handleSubmitEvent, children: [_jsxs("div", { className: "cal-event-modal__head", children: [_jsx("h3", { className: "cal-event-modal__title", children: t('todoPage.calendarEvent.title') }), _jsx("button", { type: "button", className: "cal-event-modal__close", onClick: () => setAddEventOpen(false), "aria-label": t('todoPage.close'), children: _jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { className: "cal-event-modal__field", children: [_jsx("label", { className: "cal-event-modal__label", children: t('todoPage.calendarEvent.name') }), _jsx("input", { className: "cal-event-modal__input", value: addEventSubject, onChange: (e) => setAddEventSubject(e.target.value), placeholder: t('todoPage.calendarEvent.namePlaceholder'), autoFocus: true })] }), _jsxs("div", { className: "cal-event-modal__field", children: [_jsx("label", { className: "cal-event-modal__label", children: t('todoPage.calendarEvent.date') }), _jsx("input", { className: "cal-event-modal__input", type: "date", value: addEventDate, onChange: (e) => setAddEventDate(e.target.value) })] }), _jsxs("div", { className: "cal-event-modal__row", children: [_jsxs("div", { className: "cal-event-modal__field", children: [_jsx("label", { className: "cal-event-modal__label", children: t('todoPage.calendarEvent.start') }), _jsx("input", { className: "cal-event-modal__input", type: "time", value: addEventStartTime, onChange: (e) => setAddEventStartTime(e.target.value) })] }), _jsxs("div", { className: "cal-event-modal__field", children: [_jsx("label", { className: "cal-event-modal__label", children: t('todoPage.calendarEvent.end') }), _jsx("input", { className: "cal-event-modal__input", type: "time", value: addEventEndTime, onChange: (e) => setAddEventEndTime(e.target.value) })] })] }), _jsxs("div", { className: "cal-event-modal__field", children: [_jsx("label", { className: "cal-event-modal__label", children: t('todoPage.calendarEvent.description') }), _jsx("textarea", { className: "cal-event-modal__input cal-event-modal__textarea", value: addEventBody, onChange: (e) => setAddEventBody(e.target.value), placeholder: t('todoPage.calendarEvent.descriptionPlaceholder'), rows: 3 })] }), addEventError && _jsx("p", { className: "cal-event-modal__error", children: addEventError }), _jsxs("div", { className: "cal-event-modal__actions", children: [_jsx("button", { type: "button", className: "cal-event-modal__btn cal-event-modal__btn--cancel", onClick: () => setAddEventOpen(false), children: t('todoPage.cancel') }), _jsx("button", { type: "submit", className: "cal-event-modal__btn cal-event-modal__btn--save", disabled: addEventSaving, children: addEventSaving ? t('todoPage.saving') : t('todoPage.calendarEvent.create') })] })] }) }), document.body)] }));
}
