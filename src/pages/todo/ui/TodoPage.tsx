import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import { AnimatedLink, AppPageSettings } from '@shared/ui';
import { routes } from '@shared/config';
import { createAuthenticatedMediaBlobUrl } from '@shared/api';
import { createTodoCard, createTodoColumn, deleteTodoCard, deleteTodoColumn, fetchTodoBoard, patchTodoBoard, patchTodoCard, patchTodoColumn, reorderTodoColumns, type PatchTodoCardPayload, type TodoBoard, type TodoBoardLabel, } from '@entities/todo';
import { resolveCalendarColumnId, unpackBoard } from '@entities/todo/lib/boardMapper';
import { cardDueDateTimeToIso } from '@entities/todo/lib/todoDueAt';
import { buildMonthGrid, type TodoCard, type ArchivedCard, type ColumnId, type TodoColumnListSortMode, } from '@entities/todo/lib/todoUtils';
import { deriveColumnColors, deriveThemeFromImage, type ThemeVars } from '@entities/todo/lib/todoTheme';
import { getCalendarStatus, getCalendarEvents, connectOutlookCalendar, createCalendarEvent, CALENDAR_NOT_CONNECTED_MSG, type CalendarEvent, } from '@entities/todo/lib/calendarApi';
import { getUsers, uploadDesktopBackground, type User } from '@entities/user';
import { buildTodoUserByIdMap, type TodoBoardUsers } from '@entities/todo/lib/todoUserDisplay';
import { setCalendarCache } from '@entities/todo/lib/calendarCache';
import { IconBack, IconImage, IconSettings, IconDownload, IconUpload, IconPlus, IconTrash, } from './TodoIcons';
import { TodoPlanner } from './TodoPlanner';
import { TodoColumn } from './TodoColumn';
import { TodoAddColumnModal } from './TodoAddColumnModal';
import { TodoAddCardModal } from './TodoAddCardModal';
import { TodoCardModal } from './TodoCardModal';
import './TodoPage.css';
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
export function TodoPage() {
    const [plannerCollapsed, setPlannerCollapsed] = useState(false);
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
    } | null>(null);
    const [pendingCardDragActive, setPendingCardDragActive] = useState(false);
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
    const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const columnsScrollRef = useRef<HTMLDivElement | null>(null);
    const panStartXRef = useRef(0);
    const panStartScrollRef = useRef(0);
    const prevRectsRef = useRef<Record<string, DOMRect> | null>(null);
    const dropTargetRef = useRef<ColumnId | null>(null);
    const boardBackgroundSourceUrlRef = useRef<string | null>(null);
    const defaultColumns = deriveColumnColors('#1d4ed8');
    const [themeVars, setThemeVars] = useState<ThemeVars>(() => ({
        isDark: false,
        accent: '#1d4ed8',
        text: '#0f172a',
        muted: 'rgba(15,23,42,0.62)',
        surface: 'rgba(240,241,243,0.94)',
        surface2: 'rgba(232,234,237,0.96)',
        panelBg: '#ffffff',
        border: 'rgba(148,163,184,0.38)',
        shadow: '0 14px 34px rgba(15,23,42,0.18)',
        headerBg: 'rgba(238,240,243,0.95)',
        navShadow: '0 8px 18px rgba(15,23,42,0.12)',
        ...defaultColumns,
    }));
    const [todoUsersList, setTodoUsersList] = useState<User[]>([]);
    const [todoUsersLoading, setTodoUsersLoading] = useState(true);
    const [todoUsersError, setTodoUsersError] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        getUsers(false)
            .then((list) => {
            if (!cancelled) {
                setTodoUsersList(list);
                setTodoUsersError(null);
            }
        })
            .catch((e) => {
            if (!cancelled) {
                setTodoUsersList([]);
                setTodoUsersError(e instanceof Error ? e.message : 'Не удалось загрузить пользователей');
            }
        })
            .finally(() => {
            if (!cancelled)
                setTodoUsersLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const todoBoardUsers = useMemo((): TodoBoardUsers => ({
        byId: buildTodoUserByIdMap(todoUsersList),
        list: todoUsersList,
        loading: todoUsersLoading,
        error: todoUsersError,
    }), [todoUsersList, todoUsersLoading, todoUsersError]);
    const today = useMemo(() => new Date(), []);
    const monthDays = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);
    const monthLabel = currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    const stripHtml = useCallback((html: string): string => {
        const preclean = html
            .replace(/<img\b[^>]*>/gi, ' ')
            .replace(/\s(?:src|href|poster)\s*=\s*"cid:[^"]*"/gi, ' ')
            .replace(/\s(?:src|href|poster)\s*=\s*'cid:[^']*'/gi, ' ')
            .replace(/\surl\(\s*(["']?)cid:[^)"']+\1\s*\)/gi, ' url(none)');
        const text = DOMPurify.sanitize(preclean, { ALLOWED_TAGS: [] });
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
                title: ev.subject ?? 'Событие',
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
    }, [calendarEvents, stripHtml, columnOrder, columnTitles]);
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
    const applyBackground = useCallback((url: string) => {
        const img = new Image();
        img.onload = () => {
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
    }, []);
    const applyBoardFromApi = useCallback((board: TodoBoard) => {
        const { columnOrder: ord, columnTitles: titles, columnColors: colors, collapsedColumns: collapsed, cards: nextCards, boardLabels: labels, } = unpackBoard(board);
        setColumnOrder(ord);
        setColumnTitles(titles);
        setColumnColors(colors);
        setCards(nextCards);
        setCollapsedColumns(collapsed);
        setBoardLabels(labels);
        const apiBg = board.background_url?.trim() || null;
        if (apiBg) {
            if (apiBg !== boardBackgroundSourceUrlRef.current) {
                createAuthenticatedMediaBlobUrl(apiBg)
                    .then((blobUrl) => {
                    boardBackgroundSourceUrlRef.current = apiBg;
                    applyBackground(blobUrl);
                    setBoardError(null);
                })
                    .catch((err: unknown) => {
                    boardBackgroundSourceUrlRef.current = null;
                    setBoardError(err instanceof Error ? err.message : 'Не удалось загрузить фон доски (медиа)');
                });
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
        }
    }, [applyBackground, setBoardError]);
    const commitBoard = useCallback(async (promise: Promise<TodoBoard>): Promise<TodoBoard | null> => {
        try {
            const b = await promise;
            applyBoardFromApi(b);
            setBoardError(null);
            return b;
        }
        catch (e) {
            setBoardError(e instanceof Error ? e.message : 'Ошибка сохранения доски');
            return null;
        }
    }, [applyBoardFromApi]);
    const handlePickBackground = () => {
        fileInputRef.current?.click();
        setMenuOpen(false);
    };
    const handleBackgroundChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        e.target.value = '';
        const blobUrl = URL.createObjectURL(file);
        applyBackground(blobUrl);
        setBgUploading(true);
        try {
            const user = await uploadDesktopBackground(file);
            if (user.desktop_background) {
                await commitBoard(patchTodoBoard({ background_url: user.desktop_background }));
            }
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
            await commitBoard(patchTodoBoard({ background_url: null }));
            setPrevBackground(backgroundImage);
            setBackgroundImage(null);
            setBgTransitioning(false);
            setPrevBackground((prev) => {
                if (prev && prev.startsWith('blob:'))
                    URL.revokeObjectURL(prev);
                return null;
            });
        }
        catch {
        }
    };
    useEffect(() => {
        if (!selectedCard)
            return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape')
            setSelectedCard(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedCard]);
    useEffect(() => {
        let cancelled = false;
        if (!backgroundImage)
            return;
        deriveThemeFromImage(backgroundImage)
            .then((vars) => { if (!cancelled)
            setThemeVars(vars); })
            .catch(() => { });
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
            fetchTodoBoard()
                .then((board) => {
                if (!cancelled) {
                    applyBoardFromApi(board);
                    setBoardError(null);
                }
            })
                .catch((err: unknown) => {
                if (!cancelled) {
                    setBoardError(err instanceof Error ? err.message : 'Не удалось загрузить доску задач');
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
    }, [applyBoardFromApi]);
    useEffect(() => {
        if (calendarConnected)
            setCalendarConnectError(null);
    }, [calendarConnected]);
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
            const msg = err instanceof Error ? err.message : 'Не удалось подключить календарь';
            setCalendarConnectError(msg);
        });
    }, []);
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
            setAddEventError('Укажите название события');
            return;
        }
        if (!addEventDate) {
            setAddEventError('Выберите дату');
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
            setAddEventError(err instanceof Error ? err.message : 'Ошибка создания события');
        }
        finally {
            setAddEventSaving(false);
        }
    }, [addEventSubject, addEventDate, addEventStartTime, addEventEndTime, addEventBody, fetchCalendarEvents]);
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
        if (!title)
            return;
        void commitBoard(createTodoColumn({ title }));
        setAddColumnTitle('');
        setAddColumnOpen(false);
    }, [addColumnTitle, commitBoard]);
    const handleColumnMouseDown = useCallback((e: React.MouseEvent, id: ColumnId) => {
        if (e.button !== 0)
            return;
        if ((e.target as HTMLElement).closest('button'))
            return;
        e.preventDefault();
        const node = columnRefs.current[id];
        if (node) {
            const rect = node.getBoundingClientRect();
            columnDragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            setColumnDragPreviewPosition({ x: rect.left, y: rect.top });
        }
        setDraggingColumn(id);
        setDropTarget(null);
    }, []);
    const handleColumnsAreaMouseDown = useCallback((e: React.MouseEvent) => {
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
        const onMove = (e: MouseEvent) => {
            e.preventDefault();
            const container = columnsScrollRef.current;
            if (!container)
                return;
            const dx = panStartXRef.current - e.clientX;
            container.scrollLeft = panStartScrollRef.current + dx;
        };
        const onUp = () => setIsPanning(false);
        document.addEventListener('mousemove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, [isPanning]);
    useEffect(() => {
        if (draggingColumn === null)
            return;
        const onMove = (e: MouseEvent) => {
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
                if (a >= 0 && b >= 0) {
                    const next = [...order];
                    next[a] = order[b];
                    next[b] = order[a];
                    setColumnOrder(next);
                    void (async () => {
                        const brd = await commitBoard(reorderTodoColumns(next.map(Number)));
                        if (!brd) {
                            try {
                                const fresh = await fetchTodoBoard();
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
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, [draggingColumn, columnOrder, commitBoard, applyBoardFromApi]);
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
    const handleAddCard = useCallback(() => {
        const title = addCardTitle.trim();
        if (!title || !addCardColumn)
            return;
        void commitBoard(createTodoCard(Number(addCardColumn), { title }));
        setAddCardTitle('');
        setAddCardColumn(null);
    }, [addCardTitle, addCardColumn, commitBoard]);
    const handleToggleCollapse = useCallback((cid: string) => {
        const collapsed = !!collapsedColumns[cid];
        void commitBoard(patchTodoColumn(Number(cid), { isCollapsed: !collapsed }));
    }, [collapsedColumns, commitBoard]);
    const handleExpand = useCallback((cid: string) => {
        void commitBoard(patchTodoColumn(Number(cid), { isCollapsed: false }));
    }, [commitBoard]);
    const handleAddCardClick = useCallback((cid: ColumnId) => {
        setAddCardColumn(cid);
        setAddCardTitle('');
    }, []);
    const handleCardClick = useCallback((cid: string, cardId: string) => {
        setSelectedCard({ columnId: cid, cardId });
    }, []);
    const handleCardToggleComplete = useCallback((cid: string, cardId: string) => {
        const card = mergedCards[cid]?.find((c) => c.id === cardId);
        if (!card || card.fromCalendar)
            return;
        void commitBoard(patchTodoCard(Number(cardId), { isCompleted: !card.completed }));
    }, [mergedCards, commitBoard]);
    const handleColumnKeyDown = useCallback((id: ColumnId) => {
        setDraggingColumn(id);
    }, []);
    const handleCardDragStart = useCallback((e: React.MouseEvent, columnId: string, cardId: string, cardRect: DOMRect) => {
        if (e.button !== 0)
            return;
        pendingCardDragRef.current = {
            columnId,
            cardId,
            cardRect,
            startX: e.clientX,
            startY: e.clientY,
        };
        setPendingCardDragActive(true);
    }, []);
    const handleSortCards = useCallback((colId: string, mode: TodoColumnListSortMode) => {
        setColumnListSort((prev) => ({ ...prev, [colId]: mode }));
    }, []);
    const handleToggleHideCompleted = useCallback((colId: string) => {
        setColumnHideCompleted((prev) => ({ ...prev, [colId]: !prev[colId] }));
    }, []);
    const handleRenameColumn = useCallback((colId: string, title: string) => {
        void commitBoard(patchTodoColumn(Number(colId), { title }));
    }, [commitBoard]);
    const handleClearColumn = useCallback(async (colId: string) => {
        const list = cards[colId] || [];
        let lastBoard: TodoBoard | null = null;
        for (const c of list) {
            try {
                lastBoard = await deleteTodoCard(Number(c.id));
            }
            catch {
                break;
            }
        }
        if (lastBoard)
            applyBoardFromApi(lastBoard);
    }, [cards, applyBoardFromApi]);
    const handleDeleteColumn = useCallback((colId: string) => {
        void commitBoard(deleteTodoColumn(Number(colId)));
    }, [commitBoard]);
    const handleMoveCard = useCallback((fromColumnId: string, cardId: string, toColumnId: string) => {
        if (fromColumnId === toColumnId)
            return;
        const card = mergedCards[fromColumnId]?.find((c) => c.id === cardId);
        if (!card)
            return;
        if (card.fromCalendar && card.calendarEventId) {
            setCalendarColumnOverrides((prev) => ({ ...prev, [card.calendarEventId!]: toColumnId }));
        }
        else {
            const manualInTarget = cards[toColumnId]?.length ?? 0;
            void commitBoard(patchTodoCard(Number(cardId), {
                columnId: Number(toColumnId),
                position: manualInTarget,
            }));
        }
    }, [mergedCards, cards, commitBoard]);
    useEffect(() => {
        if (!pendingCardDragActive && draggingCard === null)
            return;
        const DRAG_THRESHOLD = 6;
        const onMove = (e: MouseEvent) => {
            if (draggingCard === null && pendingCardDragRef.current) {
                const { startX, startY, columnId, cardId, cardRect } = pendingCardDragRef.current;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
                    cardDragOffsetRef.current = {
                        x: startX - cardRect.left,
                        y: startY - cardRect.top,
                    };
                    pendingCardDragRef.current = null;
                    setPendingCardDragActive(false);
                    setDragPreviewPosition({ x: cardRect.left, y: cardRect.top });
                    setDraggingCard({ columnId, cardId });
                }
                return;
            }
            if (draggingCard) {
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
                }
                else {
                    dropTargetCardColumnRef.current = null;
                    setDropTargetCardColumn(null);
                }
            }
        };
        const onUp = () => {
            pendingCardDragRef.current = null;
            setPendingCardDragActive(false);
            const target = dropTargetCardColumnRef.current;
            if (draggingCard && target && draggingCard.columnId !== target) {
                handleMoveCard(draggingCard.columnId, draggingCard.cardId, target);
            }
            dropTargetCardColumnRef.current = null;
            setDraggingCard(null);
            setDropTargetCardColumn(null);
            setDragPreviewPosition(null);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, [pendingCardDragActive, draggingCard, columnOrder, handleMoveCard]);
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
        const board = await commitBoard(patchTodoCard(Number(cardId), { isArchived: true }));
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
    }, [mergedCards, commitBoard]);
    const handleRestoreCard = useCallback((archivedCard: ArchivedCard) => {
        const targetCol = columnOrder.includes(archivedCard.fromColumn)
            ? archivedCard.fromColumn
            : columnOrder[0];
        if (!targetCol)
            return;
        void (async () => {
            let board = await commitBoard(createTodoCard(Number(targetCol), {
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
                const b2 = await commitBoard(patchTodoCard(newCard.id, { labelIds: archivedCard.snapshotLabelIds }));
                if (b2)
                    board = b2;
            }
            if (archivedCard.snapshotParticipantUserIds?.length) {
                const b3 = await commitBoard(patchTodoCard(newCard.id, {
                    participantUserIds: archivedCard.snapshotParticipantUserIds,
                }));
                if (b3)
                    board = b3;
            }
            setArchivedCards((prev) => prev.filter((c) => c.id !== archivedCard.id));
        })();
    }, [columnOrder, commitBoard]);
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
        const manualInTarget = cards[targetColumnId]?.length ?? 0;
        const board = await commitBoard(patchTodoCard(Number(selectedCard.cardId), {
            columnId: Number(targetColumnId),
            position: manualInTarget,
        }));
        if (board)
            setSelectedCard({ columnId: targetColumnId, cardId: selectedCard.cardId });
    }, [selectedCard, mergedCards, cards, commitBoard]);
    const handleModalCardUpdate = useCallback((patch: Partial<TodoCard>) => {
        if (!selectedCard || !selectedCardData)
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
        if (Object.keys(payload).length > 0) {
            void commitBoard(patchTodoCard(cardId, payload));
        }
    }, [selectedCard, selectedCardData, commitBoard]);
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
    return (<div className={`todo-page${initialLoading ? ' todo-page--skeleton' : ''}`} style={todoThemeVarsStyle}>
      {boardError && (<div className="todo-page__board-error" role="alert">
          <span className="todo-page__board-error-text">{boardError}</span>
          <button type="button" className="todo-page__board-error-retry" onClick={() => {
                void fetchTodoBoard()
                    .then((b) => {
                    applyBoardFromApi(b);
                    setBoardError(null);
                })
                    .catch((err: unknown) => {
                    setBoardError(err instanceof Error ? err.message : 'Ошибка загрузки');
                });
            }}>
            Повторить
          </button>
        </div>)}
      <header className={`todo-page__header${initialLoading ? ' todo-page__header--skeleton' : ''}`}>
        <div className="todo-page__nav">
          {initialLoading ? (<>
              <div className="todo-page__header-skel todo-page__header-skel--back"/>
              <div className="todo-page__nav-center">
                <div className="todo-page__header-skel todo-page__header-skel--search"/>
              </div>
              <div className="todo-page__nav-right">
                <div className="todo-page__header-skel todo-page__header-skel--btn"/>
                <div className="todo-page__header-skel todo-page__header-skel--btn todo-page__header-skel--icon"/>
              </div>
            </>) : (<>
              <AnimatedLink to={routes.home} className="todo-page__back-link">
                <IconBack />
                <span>Назад</span>
              </AnimatedLink>
              <div className="todo-page__nav-center">
                <div className="todo-page__search-wrap">
                  <svg className="todo-page__search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input className="todo-page__search" placeholder="Поиск задач..." type="search"/>
                </div>
              </div>
              <div className="todo-page__nav-right">
                <button type="button" className={`todo-page__header-btn${archiveOpen ? ' todo-page__header-btn--active' : ''}`} onClick={() => setArchiveOpen((v) => !v)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8"/><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5"/><rect x="2" y="8" width="20" height="13" rx="2"/></svg>
                  <span>Архив</span>
                  {archivedCards.length > 0 && <span className="todo-page__header-badge">{archivedCards.length}</span>}
                </button>
                <div className="todo-page__menu-wrap" ref={menuRef}>
                  <button type="button" className="todo-page__header-btn todo-page__header-btn--icon" aria-label="Дополнительно" onClick={() => setMenuOpen((v) => !v)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                  </button>
                  {menuOpen && (<div className="todo-page__menu-dropdown">
                      <button type="button" className="todo-page__menu-item" onClick={handlePickBackground} disabled={bgUploading}>
                        <span className="todo-page__menu-icon"><IconImage /></span>
                        <span className="todo-page__menu-text">{bgUploading ? 'Загрузка…' : 'Фон рабочей области'}</span>
                      </button>
                      {backgroundImage && (<button type="button" className="todo-page__menu-item todo-page__menu-item--danger" onClick={handleDeleteBackground}>
                          <span className="todo-page__menu-icon"><IconTrash /></span>
                          <span className="todo-page__menu-text">Убрать фон</span>
                        </button>)}
                      <button type="button" className="todo-page__menu-item">
                        <span className="todo-page__menu-icon"><IconSettings /></span>
                        <span className="todo-page__menu-text">Настройки</span>
                      </button>
                      <button type="button" className="todo-page__menu-item">
                        <span className="todo-page__menu-icon"><IconDownload /></span>
                        <span className="todo-page__menu-text">Экспорт данных</span>
                      </button>
                      <button type="button" className="todo-page__menu-item">
                        <span className="todo-page__menu-icon"><IconUpload /></span>
                        <span className="todo-page__menu-text">Импорт данных</span>
                      </button>
                    </div>)}
                </div>
                <AppPageSettings />
              </div>
            </>)}
        </div>
      </header>
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
              <span className="todo-column-drag-preview__dot"/>
              <span className="todo-column-drag-preview__title">{draggingColumnConfig.title}</span>
              <span className="todo-column-drag-preview__count">{draggingColumnCardCount}</span>
            </div>
            {draggingColumnCardCount > 0 && (<div className="todo-column-drag-preview__body">
                <div className="todo-column-drag-preview__stub"/>
                {draggingColumnCardCount > 1 && <div className="todo-column-drag-preview__stub"/>}
                {draggingColumnCardCount > 2 && <div className="todo-column-drag-preview__stub"/>}
              </div>)}
          </div>
        </div>, document.body)}
      <div className="todo-page__body">
        <TodoPlanner plannerCollapsed={plannerCollapsed} setPlannerCollapsed={setPlannerCollapsed} currentMonth={currentMonth} monthDays={monthDays} monthLabel={monthLabel} today={today} onPrevMonth={handlePrevMonth} onNextMonth={handleNextMonth} calendarConnected={calendarConnected} calendarEvents={calendarEvents} calendarConnectError={calendarConnectError} onConnectCalendar={handleConnectCalendar} onAddEvent={handleOpenAddEvent} onEditEvent={() => { }} loading={initialLoading || calendarLoading}/>
        <main className={`todo-page__main ${backgroundImage ? 'todo-page__main--with-bg' : ''}`}>
          {prevBackground && bgTransitioning && (<div className="todo-page__bg-layer todo-page__bg-layer--old" style={{ backgroundImage: `url(${prevBackground})` }}/>)}
          {backgroundImage && (<div className={`todo-page__bg-layer todo-page__bg-layer--new${bgTransitioning ? ' todo-page__bg-layer--entering' : ''}`} style={{ backgroundImage: `url(${backgroundImage})` }}/>)}
          {backgroundImage && <div className="todo-page__bg-overlay"/>}
          <div ref={columnsScrollRef} className={`todo-columns ${isPanning ? 'todo-columns--panning' : ''}`} onMouseDown={handleColumnsAreaMouseDown}>
            {initialLoading ? (<>
                {['today', 'week', 'later'].map((id) => (<div key={id} className="todo-column todo-column--skeleton">
                    <div className="todo-column__head">
                      <div className="todo-column__head-left">
                        <span className="todo-column__dot"/>
                        <div className="todo-skel todo-skel--title"/>
                        <div className="todo-skel todo-skel--badge"/>
                      </div>
                    </div>
                    <div className="todo-column__cards">
                      {Array.from({ length: id === 'today' ? 3 : 2 }).map((_, i) => (<div key={i} className="todo-card todo-card--skeleton">
                          <div className="todo-skel todo-skel--label"/>
                          <div className="todo-skel todo-skel--line"/>
                          <div className="todo-skel todo-skel--line-short"/>
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
                return (<TodoColumn key={id} config={config} todoBoardUsers={todoBoardUsers} isCollapsed={!!isCollapsed} cards={displayCardsByColumn[id] || []} columnProgressDone={progressDone} columnProgressTotal={progressTotal} listSortMode={columnListSort[id] ?? 'server'} hideCompletedFilter={!!columnHideCompleted[id]} isDragging={draggingColumn === id} isDropTarget={dropTarget === id} onColumnMouseDown={handleColumnMouseDown} onColumnKeyDown={handleColumnKeyDown} onToggleCollapse={handleToggleCollapse} onExpand={handleExpand} onAddCardClick={handleAddCardClick} onCardClick={handleCardClick} onCardToggleComplete={handleCardToggleComplete} onSortCards={handleSortCards} onToggleHideCompleted={handleToggleHideCompleted} onRenameColumn={handleRenameColumn} onClearColumn={handleClearColumn} onDeleteColumn={handleDeleteColumn} onCardDragStart={handleCardDragStart} isCardDropTarget={dropTargetCardColumn === id} draggingCard={draggingCard} columnRef={handleColumnRef(id)}/>);
            })}
                <button type="button" className="todo-columns__add" onClick={() => { setAddColumnOpen(true); setAddColumnTitle(''); }} aria-label="Добавить колонку">
                  <IconPlus />
                  <span>Добавьте еще одну колонку</span>
                </button>
              </>)}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBackgroundChange}/>
          {addColumnOpen && (<TodoAddColumnModal title={addColumnTitle} onTitleChange={setAddColumnTitle} onClose={() => { setAddColumnOpen(false); setAddColumnTitle(''); }} onSubmit={handleAddColumn}/>)}
          {addCardColumn && (<TodoAddCardModal columnTitle={columnConfig.find((c) => c.id === addCardColumn)?.title ?? ''} title={addCardTitle} onTitleChange={setAddCardTitle} onClose={() => { setAddCardColumn(null); setAddCardTitle(''); }} onSubmit={handleAddCard}/>)}
          {selectedCard && selectedCardData && (<TodoCardModal card={selectedCardData} columnTitle={columnTitles[selectedCard.columnId] ?? ''} columnId={selectedCard.columnId} columns={modalColumnOptions} boardLabels={boardLabels} todoBoardUsers={todoBoardUsers} cardServerId={Number(selectedCard.cardId)} applyTodoBoard={applyTodoBoard} onMoveToColumn={handleModalMoveToColumn} onClose={() => setSelectedCard(null)} onCardUpdate={handleModalCardUpdate} onArchive={() => handleArchiveCard(selectedCard.columnId, selectedCard.cardId)}/>)}

          <div className={`todo-archive${archiveOpen ? ' todo-archive--open' : ''}`}>
            <div className="todo-archive__header">
              <h3 className="todo-archive__title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8"/><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5"/><rect x="2" y="8" width="20" height="13" rx="2"/></svg>
                Архив
              </h3>
              <button type="button" className="todo-archive__close" onClick={() => setArchiveOpen(false)} aria-label="Закрыть архив">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="todo-archive__search-wrap">
              <svg className="todo-archive__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input className="todo-archive__search" type="search" placeholder="Поиск в архиве..." value={archiveSearch} onChange={(e) => setArchiveSearch(e.target.value)}/>
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
                      <span className="todo-archive__card-from">из «{columnTitles[ac.fromColumn] ?? ac.fromColumn}»</span>
                      <span className="todo-archive__card-date">
                        {new Date(ac.archivedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="todo-archive__card-actions">
                      <button type="button" className="todo-archive__btn todo-archive__btn--restore" onClick={() => handleRestoreCard(ac)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                        Восстановить
                      </button>
                      <button type="button" className="todo-archive__btn todo-archive__btn--delete" onClick={() => handleDeleteArchivedCard(ac.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                        Удалить
                      </button>
                    </div>
                  </div>))}
              {archivedCards.length === 0 && (<div className="todo-archive__empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.6 5H8.4a2 2 0 0 0-1.9 1.3L5 10 3 8"/><path d="M3.5 13H6a2 2 0 0 1 2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0a2 2 0 0 1 2-2h2.5"/><rect x="2" y="8" width="20" height="13" rx="2"/></svg>
                  <p>Архив пуст</p>
                  <span>Архивированные карточки будут отображаться здесь</span>
                </div>)}
              {archivedCards.length > 0 && archiveSearch && archivedCards.filter((c) => c.title.toLowerCase().includes(archiveSearch.toLowerCase())).length === 0 && (<div className="todo-archive__empty">
                  <p>Ничего не найдено</p>
                </div>)}
            </div>

            {archivedCards.length > 0 && (<div className="todo-archive__footer">
                <button type="button" className="todo-archive__clear" onClick={handleClearArchive}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                  Очистить архив ({archivedCards.length})
                </button>
              </div>)}
          </div>
        </main>
      </div>

      {addEventOpen && createPortal(<div className="cal-event-backdrop" style={todoThemeVarsStyle} onClick={() => setAddEventOpen(false)}>
          <form className="cal-event-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmitEvent}>
            <div className="cal-event-modal__head">
              <h3 className="cal-event-modal__title">Новое событие</h3>
              <button type="button" className="cal-event-modal__close" onClick={() => setAddEventOpen(false)} aria-label="Закрыть">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="cal-event-modal__field">
              <label className="cal-event-modal__label">Название</label>
              <input className="cal-event-modal__input" value={addEventSubject} onChange={(e) => setAddEventSubject(e.target.value)} placeholder="Встреча, звонок..." autoFocus/>
            </div>
            <div className="cal-event-modal__field">
              <label className="cal-event-modal__label">Дата</label>
              <input className="cal-event-modal__input" type="date" value={addEventDate} onChange={(e) => setAddEventDate(e.target.value)}/>
            </div>
            <div className="cal-event-modal__row">
              <div className="cal-event-modal__field">
                <label className="cal-event-modal__label">Начало</label>
                <input className="cal-event-modal__input" type="time" value={addEventStartTime} onChange={(e) => setAddEventStartTime(e.target.value)}/>
              </div>
              <div className="cal-event-modal__field">
                <label className="cal-event-modal__label">Конец</label>
                <input className="cal-event-modal__input" type="time" value={addEventEndTime} onChange={(e) => setAddEventEndTime(e.target.value)}/>
              </div>
            </div>
            <div className="cal-event-modal__field">
              <label className="cal-event-modal__label">Описание</label>
              <textarea className="cal-event-modal__input cal-event-modal__textarea" value={addEventBody} onChange={(e) => setAddEventBody(e.target.value)} placeholder="Описание события..." rows={3}/>
            </div>
            {addEventError && <p className="cal-event-modal__error">{addEventError}</p>}
            <div className="cal-event-modal__actions">
              <button type="button" className="cal-event-modal__btn cal-event-modal__btn--cancel" onClick={() => setAddEventOpen(false)}>Отмена</button>
              <button type="submit" className="cal-event-modal__btn cal-event-modal__btn--save" disabled={addEventSaving}>
                {addEventSaving ? 'Сохранение...' : 'Создать событие'}
              </button>
            </div>
          </form>
        </div>, document.body)}
    </div>);
}
