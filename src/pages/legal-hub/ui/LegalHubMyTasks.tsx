import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { DatePicker, SearchableSelect } from '@shared/ui';
import { createDefaultTodoThemeVars, deriveThemeFromImage, type ThemeVars } from '@entities/todo/lib/todoTheme';
import { LegalHubTaskDrawer } from './LegalHubTaskDrawer';
import { dueText } from './legalHubShared';
import {
    HUB_TASKS,
    MOCK_DONE_IDS,
    PERSON_LABEL,
    PROJECT_LABEL,
    PROJECT_TITLE,
    TASK_PEOPLE,
    TASK_PRIORITIES,
    TASK_PROJECTS,
    type HubTask,
    type TaskPersonId,
    type TaskPriorityId,
    type TaskProjectId,
    type TaskStatusId,
} from './legalHubTasks';

type BoardColumn = 'todo' | 'progress' | 'waitClient' | 'waitGov' | 'associate' | 'partner' | 'changes' | 'done';
export type MineTask = HubTask & {
    done: boolean;
    hours: number;
    internalOn: string;
    instructions: string;
    approval: boolean;
    /** Custom board column. Built-in columns leave this empty. */
    boardColumn?: string;
};

const COLUMNS: BoardColumn[] = ['todo', 'progress', 'waitClient', 'waitGov', 'associate', 'partner', 'changes', 'done'];
const DROPPABLE: BoardColumn[] = ['todo', 'progress', 'waitClient', 'waitGov', 'changes'];
const LOCKED: BoardColumn[] = ['associate', 'partner'];
const QUICK_ADD: BoardColumn[] = ['todo', 'progress'];

const COLUMN_LABEL: Record<BoardColumn, TranslationKey> = {
    todo: 'legalHub.taskStatusTodo',
    progress: 'legalHub.statusInProgress',
    waitClient: 'legalHub.myTasksWaitClient',
    waitGov: 'legalHub.myTasksWaitGov',
    associate: 'legalHub.taskStatusAssociate',
    partner: 'legalHub.taskStagePartner',
    changes: 'legalHub.statusChanges',
    done: 'legalHub.matterDoneCol',
};

const COLUMN_SUB: Partial<Record<BoardColumn, TranslationKey>> = {
    waitClient: 'legalHub.myTasksSubWaitClient',
    waitGov: 'legalHub.myTasksSubWaitGov',
    associate: 'legalHub.myTasksSubAssociate',
    partner: 'legalHub.myTasksSubPartner',
    changes: 'legalHub.myTasksSubChanges',
    done: 'legalHub.myTasksSubDone',
};

const CARD_MONTHS: Record<string, string[]> = {
    ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const PRIORITY_LABEL: Record<TaskPriorityId, TranslationKey> = {
    high: 'legalHub.taskPriorityHigh',
    normal: 'legalHub.taskPriorityNormal',
    low: 'legalHub.taskPriorityLow',
};

const INTERNAL_ON: Record<string, string> = {
    khokimiyat: '2026-10-31',
    'lla-final': '2026-11-01',
    'lla-prep': '2026-10-31',
    allocation: '2026-10-30',
    'tx-easement': '2026-10-31',
    'permit-pack': '2026-11-03',
    'wind-final': '2026-10-31',
    schedule: '2026-11-01',
};

function dayDelta(iso: string): number {
    const [year, month, day] = iso.split('-').map(Number);
    const target = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function isClientWait(task: Pick<HubTask, 'waitingFor'>): boolean {
    const who = (task.waitingFor ?? '').toLowerCase();
    return who.includes('client') || who.includes('клиент');
}

export type DueColumn = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

function dueColumnOf(task: Pick<MineTask, 'clientOn'>): DueColumn {
    const delta = dayDelta(task.clientOn);
    if (delta < 0)
        return 'overdue';
    if (delta === 0)
        return 'today';
    if (delta === 1)
        return 'tomorrow';
    if (delta <= 7)
        return 'week';
    return 'later';
}

function isBuiltin(column: string): column is BoardColumn {
    return (COLUMNS as readonly string[]).includes(column);
}

export function columnOf(task: Pick<MineTask, 'status' | 'waitingFor' | 'done' | 'boardColumn'>): string {
    if (task.boardColumn)
        return task.boardColumn;
    if (task.done)
        return 'done';
    if (task.status === 'changes')
        return 'changes';
    if (task.status === 'wait')
        return isClientWait(task) ? 'waitClient' : 'waitGov';
    if (task.status === 'todo' || task.status === 'progress' || task.status === 'associate' || task.status === 'partner')
        return task.status;
    return 'todo';
}

function statusOf(column: BoardColumn): TaskStatusId {
    if (column === 'waitClient' || column === 'waitGov' || column === 'done')
        return column === 'done' ? 'progress' : 'wait';
    return column;
}

function shortDate(iso: string, locale: string): string {
    const [, month, day] = iso.split('-').map(Number);
    const names = CARD_MONTHS[locale] ?? CARD_MONTHS.en!;
    return `${day ?? ''} ${names[(month ?? 1) - 1] ?? ''}`.trim();
}

function plusDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

export function mineFrom(source: HubTask[]): MineTask[] {
    return source.map((task) => ({
        ...task,
        done: MOCK_DONE_IDS.includes(task.id),
        hours: 4,
        internalOn: INTERNAL_ON[task.id] ?? task.reviewOn ?? task.clientOn,
        instructions: '',
        approval: task.priority === 'high',
    }));
}

const COLLAPSED_KEY = 'lh-board-collapsed';
const HIDE_EMPTY_KEY = 'lh-board-hide-empty';
const VIEW_KEY = 'lh-board-view';
const COLUMN_ORDER_KEY = 'lh-board-column-order';
const CUSTOM_COLUMNS_KEY = 'lh-board-custom-columns';

type CustomColumn = { id: string; title: string };

function readCustomColumns(): CustomColumn[] {
    const stored = readStored<unknown>(CUSTOM_COLUMNS_KEY, []);
    if (!Array.isArray(stored))
        return [];
    return stored.flatMap((item) => {
        if (!item || typeof item !== 'object')
            return [];
        const row = item as { id?: unknown; title?: unknown };
        const id = typeof row.id === 'string' ? row.id.trim() : '';
        const title = typeof row.title === 'string' ? row.title.trim() : '';
        if (!id || !title || isBuiltin(id))
            return [];
        return [{ id, title }];
    });
}

function readColumnOrder(customIds: readonly string[]): string[] {
    const stored = readStored<unknown>(COLUMN_ORDER_KEY, []);
    const list = Array.isArray(stored) ? stored : [];
    const known = new Set<string>([...COLUMNS, ...customIds]);
    const picked = list.filter((id): id is string => typeof id === 'string' && known.has(id));
    return [
        ...picked,
        ...COLUMNS.filter((id) => !picked.includes(id)),
        ...customIds.filter((id) => !picked.includes(id)),
    ];
}

function isLateTask(task: MineTask): boolean {
    return !task.done && dayDelta(task.clientOn) < 0;
}

function readStored<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : (JSON.parse(raw) as T);
    }
    catch {
        return fallback;
    }
}

function writeStored(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch {
        /* storage can be unavailable */
    }
}

function FilterPick<T extends string>({
    label,
    value,
    items,
    noMatch,
    onSelect,
}: {
    label: string;
    value: T | '';
    items: { id: T | ''; label: string }[];
    noMatch: string;
    onSelect: (id: T | '') => void;
}) {
    return (
        <SearchableSelect
            className={`lh-bt__pick${value ? ' is-on' : ''}`}
            buttonClassName="lh-bt__pick-btn"
            portalMinWidth={240}
            aria-label={label}
            placeholder={label}
            emptyListText={label}
            noMatchText={noMatch}
            value={value}
            items={items}
            getOptionValue={(item) => item.id}
            getOptionLabel={(item) => item.label}
            getSearchText={(item) => item.label}
            onSelect={(item) => onSelect(item.id)}
        />
    );
}

function taskCountKey(count: number): TranslationKey {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20)
        return 'legalHub.myTasksCountMany';
    if (n1 === 1)
        return 'legalHub.myTasksCountOne';
    if (n1 >= 2 && n1 <= 4)
        return 'legalHub.myTasksCountFew';
    return 'legalHub.myTasksCountMany';
}

export function LegalHubMyTasks({
    query,
    source = null,
    layout = 'list',
    mode = 'mine',
    project = null,
    tasks: tasksProp,
    onTasks,
    createSignal = 0,
    onBack,
}: {
    query: string;
    source?: HubTask[] | null;
    layout?: 'list' | 'board';
    mode?: 'mine' | 'queue';
    project?: TaskProjectId | null;
    tasks?: MineTask[];
    onTasks?: (tasks: MineTask[]) => void;
    /** Bumps from the top-bar + button. */
    createSignal?: number;
    /** Project board: return to the list of projects. */
    onBack?: () => void;
}) {
    const { t, locale } = useI18n();
    const [inner, setInner] = useState<MineTask[]>(() => mineFrom(source ?? HUB_TASKS));
    const tasks = tasksProp ?? inner;
    const setTasks = (updater: MineTask[] | ((current: MineTask[]) => MineTask[])) => {
        const next = typeof updater === 'function' ? updater(tasks) : updater;
        if (onTasks)
            onTasks(next);
        else
            setInner(next);
    };
    const viewKey = `${VIEW_KEY}-${mode}`;
    const [view, setViewState] = useState<'list' | 'board'>(() => {
        const stored = readStored<string | null>(viewKey, null);
        return stored === 'list' || stored === 'board' ? stored : layout;
    });
    const setView = (next: 'list' | 'board') => {
        setViewState(next);
        writeStored(viewKey, next);
    };
    const [collapsed, setCollapsedState] = useState<string[]>(() => readStored<string[]>(COLLAPSED_KEY, ['done']));
    const toggleCollapsed = (id: string) => {
        setCollapsedState((current) => {
            const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
            writeStored(COLLAPSED_KEY, next);
            return next;
        });
    };
    const [hideEmpty, setHideEmptyState] = useState<boolean>(() => readStored<boolean>(HIDE_EMPTY_KEY, false));
    const setHideEmpty = (next: boolean) => {
        flip.current = 'columns';
        setHideEmptyState(next);
        writeStored(HIDE_EMPTY_KEY, next);
    };
    const [customColumns, setCustomColumns] = useState<CustomColumn[]>(readCustomColumns);
    const [columnOrder, setColumnOrder] = useState<string[]>(() => readColumnOrder(readCustomColumns().map((column) => column.id)));
    const [columnDrag, setColumnDrag] = useState<string | null>(null);
    const [columnOver, setColumnOver] = useState<string | null>(null);
    const [onlyLate, setOnlyLate] = useState(false);
    const [onlyUrgent, setOnlyUrgent] = useState(false);
    const [projectFilter, setProjectFilter] = useState<TaskProjectId | ''>('');
    const [statusFilter, setStatusFilter] = useState('');
    const [streamFilter, setStreamFilter] = useState('');
    const [ownerFilter, setOwnerFilter] = useState<TaskPersonId | ''>('');
    const [priorityFilter, setPriorityFilter] = useState<TaskPriorityId | ''>('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filtersRef = useRef<HTMLDivElement>(null);
    const boardScope = project ?? 'mine';
    const titleKey = `lh-board-title-${boardScope}`;
    const bgKey = `lh-board-bg-${boardScope}`;
    const [boardTitle, setBoardTitle] = useState('');
    const [renaming, setRenaming] = useState(false);
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [themeVars, setThemeVars] = useState<ThemeVars | null>(null);
    const [boardMenuOpen, setBoardMenuOpen] = useState(false);
    const [membersOpen, setMembersOpen] = useState(false);
    const boardMenuRef = useRef<HTMLDivElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState<string | null>(null);
    const boardRef = useRef<HTMLDivElement>(null);
    const flip = useRef<null | 'cards' | 'columns'>(null);
    const cardBoxes = useRef(new Map<string, { left: number; top: number }>());
    const colBoxes = useRef(new Map<string, { left: number; top: number }>());
    const [composer, setComposer] = useState(false);
    const seenCreate = useRef(createSignal);
    useEffect(() => {
        if (!filtersOpen)
            return;
        const onPointer = (event: MouseEvent) => {
            if (!filtersRef.current?.contains(event.target as Node))
                setFiltersOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setFiltersOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [filtersOpen]);
    useEffect(() => {
        const storedTitle = readStored<unknown>(titleKey, '');
        setBoardTitle(typeof storedTitle === 'string' ? storedTitle : '');
        setRenaming(false);
        const storedBg = readStored<unknown>(bgKey, '');
        setBackgroundImage(typeof storedBg === 'string' && storedBg.startsWith('data:image/') ? storedBg : null);
    }, [bgKey, titleKey]);
    useEffect(() => {
        if (!boardMenuOpen)
            return;
        const onPointer = (event: MouseEvent) => {
            if (!boardMenuRef.current?.contains(event.target as Node))
                setBoardMenuOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setBoardMenuOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [boardMenuOpen]);
    useEffect(() => {
        let cancelled = false;
        if (!backgroundImage) {
            setThemeVars(null);
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
        return () => {
            cancelled = true;
        };
    }, [backgroundImage]);
    useEffect(() => {
        if (createSignal === seenCreate.current)
            return;
        seenCreate.current = createSignal;
        if (mode === 'mine') {
            setComposeColumn(null);
            setComposer(true);
        }
    }, [createSignal, mode]);
    const [composeColumn, setComposeColumn] = useState<string | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);
    const needle = query.trim().toLowerCase();
    const openTask = tasks.find((task) => task.id === openId) ?? null;

    const scoped = useMemo(() => tasks.filter((task) => {
        if (project != null && task.project !== project)
            return false;
        if (mode === 'queue' && (task.done || (task.status !== 'associate' && task.status !== 'partner')))
            return false;
        if (view === 'list' && task.done)
            return false;
        return true;
    }), [mode, project, tasks, view]);
    const visible = useMemo(() => scoped.filter((task) => {
        if (projectFilter && task.project !== projectFilter)
            return false;
        if (statusFilter && columnOf(task) !== statusFilter)
            return false;
        if (streamFilter && task.workstream !== streamFilter)
            return false;
        if (ownerFilter && task.owner !== ownerFilter)
            return false;
        if (priorityFilter && task.priority !== priorityFilter)
            return false;
        if (onlyLate && !isLateTask(task))
            return false;
        if (onlyUrgent && task.priority !== 'high')
            return false;
        if (!needle)
            return true;
        const owner = PERSON_LABEL[task.owner].name;
        const reviewer = task.reviewer ? PERSON_LABEL[task.reviewer].name : '';
        return `${task.title} ${PROJECT_LABEL[task.project]} ${task.workstream} ${owner} ${reviewer}`.toLowerCase().includes(needle);
    }), [needle, onlyLate, onlyUrgent, ownerFilter, priorityFilter, projectFilter, scoped, statusFilter, streamFilter]);
    const lateCount = scoped.filter(isLateTask).length;
    const urgentCount = scoped.filter((task) => !task.done && task.priority === 'high').length;
    const filtersOn = Boolean(onlyLate || onlyUrgent || projectFilter || statusFilter || streamFilter || ownerFilter || priorityFilter);
    const resetFilters = () => {
        setOnlyLate(false);
        setOnlyUrgent(false);
        setProjectFilter('');
        setStatusFilter('');
        setStreamFilter('');
        setOwnerFilter('');
        setPriorityFilter('');
    };

    const moveTask = (id: string, column: string) => {
        flip.current = 'cards';
        setTasks((current) => current.map((task) => {
            if (task.id !== id)
                return task;
            if (!isBuiltin(column))
                return { ...task, boardColumn: column, done: false };
            const waitingFor = column === 'waitClient'
                ? (isClientWait(task) ? task.waitingFor : 'Client')
                : column === 'waitGov'
                    ? (task.waitingFor && !isClientWait(task) ? task.waitingFor : undefined)
                    : task.waitingFor;
            return { ...task, boardColumn: undefined, done: column === 'done', status: statusOf(column), waitingFor };
        }));
        setDragging(null);
    };

    const reorderColumns = (from: string, to: string) => {
        if (from === to)
            return;
        flip.current = 'columns';
        setColumnOrder((current) => {
            const fromIndex = current.indexOf(from);
            const toIndex = current.indexOf(to);
            if (fromIndex < 0 || toIndex < 0)
                return current;
            const next = [...current];
            const [item] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, item!);
            writeStored(COLUMN_ORDER_KEY, next);
            return next;
        });
        setColumnDrag(null);
        setColumnOver(null);
    };

    const addColumn = (title: string) => {
        const name = title.trim();
        if (!name)
            return;
        const id = `c-${Date.now().toString(36)}`;
        flip.current = 'columns';
        setCustomColumns((current) => {
            const next = [...current, { id, title: name }];
            writeStored(CUSTOM_COLUMNS_KEY, next);
            return next;
        });
        setColumnOrder((current) => {
            const next = [...current, id];
            writeStored(COLUMN_ORDER_KEY, next);
            return next;
        });
        requestAnimationFrame(() => {
            const board = boardRef.current;
            if (board)
                board.scrollLeft = board.scrollWidth;
        });
    };

    const removeColumn = (id: string) => {
        flip.current = 'columns';
        setCustomColumns((current) => {
            const next = current.filter((column) => column.id !== id);
            writeStored(CUSTOM_COLUMNS_KEY, next);
            return next;
        });
        setColumnOrder((current) => {
            const next = current.filter((column) => column !== id);
            writeStored(COLUMN_ORDER_KEY, next);
            return next;
        });
        setTasks((current) => current.map((task) => (
            task.boardColumn === id ? { ...task, boardColumn: undefined } : task
        )));
    };

    const openComposer = (column: string | null) => {
        setComposeColumn(column);
        setComposer(true);
    };
    const closeComposer = () => {
        setComposer(false);
        setComposeColumn(null);
    };

    useLayoutEffect(() => {
        const board = boardRef.current;
        if (!board)
            return;
        const kind = flip.current;
        flip.current = null;
        const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const place = (node: HTMLElement) => {
            const nodeBox = node.getBoundingClientRect();
            const boardBox = board.getBoundingClientRect();
            return {
                left: nodeBox.left - boardBox.left + board.scrollLeft,
                top: nodeBox.top - boardBox.top + board.scrollTop,
            };
        };
        const sync = (selector: string, attr: string, store: Map<string, { left: number; top: number }>, animate: boolean) => {
            board.querySelectorAll<HTMLElement>(selector).forEach((node) => {
                const id = node.getAttribute(attr);
                if (!id)
                    return;
                const next = place(node);
                const prev = store.get(id);
                if (animate && motion && prev) {
                    const dx = prev.left - next.left;
                    const dy = prev.top - next.top;
                    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                        node.animate(
                            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
                            { duration: animate && attr === 'data-col' ? 320 : 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
                        );
                    }
                }
                store.set(id, next);
            });
        };
        sync('[data-col]', 'data-col', colBoxes.current, kind === 'columns');
        sync('[data-card]', 'data-card', cardBoxes.current, kind === 'cards');
    });

    useEffect(() => {
        const board = boardRef.current;
        if (!board || view !== 'board')
            return;
        let pan: { x: number; left: number; pointerId: number } | null = null;
        const onDown = (event: PointerEvent) => {
            if (event.button !== 0)
                return;
            const target = event.target;
            if (!(target instanceof Element))
                return;
            if (target.closest('button, a, input, textarea, select, label, [draggable="true"], .lh-my__card, .lh-my__adder'))
                return;
            const rect = board.getBoundingClientRect();
            if (event.clientY >= rect.bottom - 18)
                return;
            event.preventDefault();
            pan = { x: event.clientX, left: board.scrollLeft, pointerId: event.pointerId };
            board.classList.add('is-panning');
            board.setPointerCapture(event.pointerId);
        };
        const onMove = (event: PointerEvent) => {
            if (!pan || event.pointerId !== pan.pointerId)
                return;
            board.scrollLeft = pan.left - (event.clientX - pan.x);
        };
        const onUp = (event: PointerEvent) => {
            if (!pan || event.pointerId !== pan.pointerId)
                return;
            pan = null;
            board.classList.remove('is-panning');
        };
        board.addEventListener('pointerdown', onDown);
        board.addEventListener('pointermove', onMove);
        board.addEventListener('pointerup', onUp);
        board.addEventListener('pointercancel', onUp);
        return () => {
            board.classList.remove('is-panning');
            board.removeEventListener('pointerdown', onDown);
            board.removeEventListener('pointermove', onMove);
            board.removeEventListener('pointerup', onUp);
            board.removeEventListener('pointercancel', onUp);
        };
    }, [view]);

    useEffect(() => {
        if (!dragging && !columnDrag)
            return;
        const board = boardRef.current;
        if (!board)
            return;
        let dx = 0;
        let frame = 0;
        const onOver = (event: globalThis.DragEvent) => {
            const rect = board.getBoundingClientRect();
            const edge = 72;
            if (event.clientX < rect.left + edge)
                dx = -16;
            else if (event.clientX > rect.right - edge)
                dx = 16;
            else
                dx = 0;
        };
        const tick = () => {
            if (dx)
                board.scrollLeft += dx;
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        window.addEventListener('dragover', onOver);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('dragover', onOver);
        };
    }, [columnDrag, dragging]);

    const canCreate = mode === 'mine';
    const title = project != null ? PROJECT_TITLE[project] : t(mode === 'queue' ? 'legalHub.sideReview' : 'legalHub.myTasks');
    const projectOptions = useMemo(
        () => [{ id: '' as const, label: t('legalHub.boardAllProjects') }, ...TASK_PROJECTS.map((id) => ({ id, label: PROJECT_TITLE[id] }))],
        [t],
    );
    const statusOptions = useMemo(() => {
        const ids: string[] = mode === 'queue' ? ['associate', 'partner'] : [...COLUMNS, ...customColumns.map((column) => column.id)];
        return [{ id: '' as const, label: t('legalHub.boardAllStatuses') }, ...ids.map((id) => ({
            id,
            label: customColumns.find((column) => column.id === id)?.title ?? (isBuiltin(id) ? t(COLUMN_LABEL[id]) : id),
        }))];
    }, [customColumns, mode, t]);
    const streamOptions = useMemo(() => {
        const names = [...new Set(scoped.map((task) => task.workstream).filter((name) => name && name !== '—'))];
        names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return [{ id: '', label: t('legalHub.boardAllStreams') }, ...names.map((name) => ({ id: name, label: name }))];
    }, [scoped, t]);
    const ownerOptions = useMemo(
        () => [{ id: '' as const, label: t('legalHub.boardAllOwners') }, ...TASK_PEOPLE.map((id) => ({ id, label: PERSON_LABEL[id].name }))],
        [t],
    );
    const priorityOptions = useMemo(
        () => [{ id: '' as const, label: t('legalHub.boardAllPriorities') }, ...TASK_PRIORITIES.map((id) => ({ id, label: t(PRIORITY_LABEL[id]) }))],
        [t],
    );

    type BoardColumnModel = { id: string; label: string; hint: string | null; review: boolean; droppable: boolean; canAdd: boolean; custom: boolean; cards: MineTask[] };
    const columns: BoardColumnModel[] = mode === 'queue'
        ? ([
            { id: 'overdue', label: 'legalHub.queueDueOverdue', hint: 'legalHub.queueDueSubOverdue' },
            { id: 'today', label: 'legalHub.queueDueToday', hint: 'legalHub.queueDueSubToday' },
            { id: 'tomorrow', label: 'legalHub.queueDueTomorrow', hint: 'legalHub.queueDueSubTomorrow' },
            { id: 'week', label: 'legalHub.queueDueWeek', hint: 'legalHub.queueDueSubWeek' },
            { id: 'later', label: 'legalHub.queueDueLater', hint: 'legalHub.queueDueSubLater' },
        ] as { id: DueColumn; label: TranslationKey; hint: TranslationKey }[]).map((column) => ({
            id: column.id,
            label: t(column.label),
            hint: t(column.hint),
            review: false,
            droppable: false,
            canAdd: false,
            custom: false,
            cards: visible.filter((task) => dueColumnOf(task) === column.id).sort((a, b) => a.clientOn.localeCompare(b.clientOn)),
        }))
        : columnOrder.flatMap((column): BoardColumnModel[] => {
            const custom = customColumns.find((item) => item.id === column);
            const cards = visible
                .filter((task) => columnOf(task) === column)
                .sort((a, b) => Number(isLateTask(b)) - Number(isLateTask(a)) || Number(b.priority === 'high') - Number(a.priority === 'high') || a.clientOn.localeCompare(b.clientOn));
            if (custom) {
                return [{
                    id: custom.id,
                    label: custom.title,
                    hint: null,
                    review: false,
                    droppable: true,
                    canAdd: canCreate,
                    custom: true,
                    cards,
                }];
            }
            if (!isBuiltin(column))
                return [];
            const sub = COLUMN_SUB[column];
            return [{
                id: column,
                label: t(COLUMN_LABEL[column]),
                hint: sub ? t(sub) : null,
                review: LOCKED.includes(column),
                droppable: DROPPABLE.includes(column),
                canAdd: canCreate && QUICK_ADD.includes(column),
                custom: false,
                cards,
            }];
        });
    const shownColumns = columns.filter((column) => !hideEmpty || column.custom || column.cards.length > 0 || (dragging != null && column.droppable));
    const hiddenCount = columns.length - shownColumns.length;
    const shownTitle = boardTitle.trim() || title;
    const themeStyle: CSSProperties | undefined = themeVars ? {
        ['--app-text' as string]: themeVars.text,
        ['--app-muted' as string]: themeVars.muted,
        ['--app-text-dim' as string]: themeVars.muted,
        ['--app-surface' as string]: themeVars.panelBg,
        ['--app-bg-soft' as string]: themeVars.surface,
        ['--app-border' as string]: themeVars.border,
        ['--app-accent' as string]: themeVars.accent,
        ['--lh-menu-bg' as string]: themeVars.surface2,
        colorScheme: themeVars.isDark ? 'dark' : 'light',
    } : undefined;
    const photo = backgroundImage ? (
        <>
            <div className="lh-my__photo" style={{ backgroundImage: `url(${backgroundImage})` }} />
            <div className="lh-my__photo-shade" />
        </>
    ) : null;
    const members = [...new Set(tasks.flatMap((task) => [task.owner, task.reviewer].filter((id): id is NonNullable<typeof id> => Boolean(id))))]
        .map((id) => PERSON_LABEL[id]);
    const saveTitle = (next: string) => {
        const name = next.trim();
        setBoardTitle(name);
        setRenaming(false);
        writeStored(titleKey, name);
    };
    const onBackgroundFile = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file)
            return;
        if (!file.type.startsWith('image/') || file.size > 2.5 * 1024 * 1024) {
            window.alert(t('legalHub.boardBgTooBig'));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const url = typeof reader.result === 'string' ? reader.result : '';
            if (!url.startsWith('data:image/'))
                return;
            setBackgroundImage(url);
            writeStored(bgKey, url);
        };
        reader.readAsDataURL(file);
    };
    const removeBackground = () => {
        setBackgroundImage(null);
        setThemeVars(null);
        writeStored(bgKey, '');
    };
    const exportBoard = () => {
        const payload = {
            v: 1,
            title: boardTitle,
            columns: customColumns,
            order: columnOrder,
            tasks,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(shownTitle || 'board').replace(/[^\w\u0400-\u04FF-]+/g, '-').slice(0, 40)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };
    const importBoard = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result)) as {
                    title?: unknown;
                    columns?: unknown;
                    order?: unknown;
                    tasks?: unknown;
                };
                if (!Array.isArray(parsed.tasks))
                    throw new Error('tasks');
                const nextTasks = parsed.tasks.filter((task): task is MineTask => {
                    if (!task || typeof task !== 'object')
                        return false;
                    const row = task as MineTask;
                    return typeof row.id === 'string' && typeof row.title === 'string';
                });
                if (nextTasks.length === 0)
                    throw new Error('empty');
                setTasks(nextTasks);
                if (Array.isArray(parsed.columns)) {
                    const nextColumns = parsed.columns.flatMap((item) => {
                        if (!item || typeof item !== 'object')
                            return [];
                        const row = item as CustomColumn;
                        return typeof row.id === 'string' && typeof row.title === 'string' ? [{ id: row.id, title: row.title }] : [];
                    });
                    setCustomColumns(nextColumns);
                    writeStored(CUSTOM_COLUMNS_KEY, nextColumns);
                }
                if (Array.isArray(parsed.order)) {
                    const nextOrder = parsed.order.filter((id): id is string => typeof id === 'string');
                    if (nextOrder.length > 0) {
                        setColumnOrder(nextOrder);
                        writeStored(COLUMN_ORDER_KEY, nextOrder);
                    }
                }
                if (typeof parsed.title === 'string')
                    saveTitle(parsed.title);
            }
            catch {
                window.alert(t('legalHub.boardImportBad'));
            }
        };
        reader.readAsText(file);
    };
    const deleteBoard = () => {
        if (!window.confirm(t('legalHub.boardDeleteConfirm')))
            return;
        setTasks(mineFrom(source ?? HUB_TASKS));
        setCustomColumns([]);
        writeStored(CUSTOM_COLUMNS_KEY, []);
        setColumnOrder([...COLUMNS]);
        writeStored(COLUMN_ORDER_KEY, [...COLUMNS]);
        saveTitle('');
        removeBackground();
    };

    const toolbar = (
        <div className="lh-bt">
            <div className="lh-bt__head">
                <div className="lh-bt__title">
                    {project != null && onBack ? (
                        <nav className="lh-bt__crumbs" aria-label={t('legalHub.projects')}>
                            <button type="button" onClick={onBack}>{t('legalHub.projectsBack')}</button>
                            <span aria-hidden>/</span>
                        </nav>
                    ) : null}
                    {renaming && mode === 'mine' ? (
                        <input
                            className="lh-bt__rename"
                            value={boardTitle}
                            autoFocus
                            aria-label={t('legalHub.boardRename')}
                            onChange={(event) => setBoardTitle(event.target.value)}
                            onBlur={() => saveTitle(boardTitle)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter')
                                    (event.target as HTMLInputElement).blur();
                                if (event.key === 'Escape') {
                                    setBoardTitle(readStored<string>(titleKey, ''));
                                    setRenaming(false);
                                }
                            }}
                        />
                    ) : <h1>{shownTitle}</h1>}
                    <span className="lh-bt__meta">
                        {t(taskCountKey(visible.filter((task) => !task.done).length)).replace('{count}', String(visible.filter((task) => !task.done).length))}
                        {lateCount > 0 ? <em>{t('legalHub.boardLate').replace('{count}', String(lateCount))}</em> : null}
                    </span>
                </div>
                <div className="lh-bt__actions">
                    <div className="lh-bt__menu" ref={filtersRef}>
                        <button type="button" className={`lh-bt__filter${filtersOpen || filtersOn ? ' is-on' : ''}`} aria-expanded={filtersOpen} aria-haspopup="dialog" onClick={() => setFiltersOpen((value) => !value)}>
                            <IconFilter />
                            {t('legalHub.boardFilters')}
                            {filtersOn ? <em>{[onlyLate, onlyUrgent, projectFilter, statusFilter, streamFilter, ownerFilter, priorityFilter].filter(Boolean).length}</em> : null}
                        </button>
                        {filtersOpen ? (
                            <div className="lh-bt__panel" role="dialog" aria-label={t('legalHub.boardFilters')}>
                                <div className="lh-bt__chips">
                                    <button type="button" className={`lh-bt__chip lh-bt__chip--late${onlyLate ? ' is-on' : ''}`} aria-pressed={onlyLate} disabled={lateCount === 0 && !onlyLate} onClick={() => setOnlyLate((value) => !value)}>
                                        <i aria-hidden />
                                        {t('legalHub.boardFilterLate')}
                                        <em>{lateCount}</em>
                                    </button>
                                    <button type="button" className={`lh-bt__chip${onlyUrgent ? ' is-on' : ''}`} aria-pressed={onlyUrgent} disabled={urgentCount === 0 && !onlyUrgent} onClick={() => setOnlyUrgent((value) => !value)}>
                                        <IconFlag />
                                        {t('legalHub.boardFilterUrgent')}
                                        <em>{urgentCount}</em>
                                    </button>
                                </div>
                                {project == null ? (
                                    <FilterPick label={t('legalHub.taskColProject')} value={projectFilter} items={projectOptions} noMatch={t('legalHub.teamNoMatch')} onSelect={setProjectFilter} />
                                ) : null}
                                <FilterPick label={t('legalHub.taskColStatus')} value={statusFilter} items={statusOptions} noMatch={t('legalHub.teamNoMatch')} onSelect={setStatusFilter} />
                                <FilterPick label={t('legalHub.taskColWorkstream')} value={streamFilter} items={streamOptions} noMatch={t('legalHub.teamNoMatch')} onSelect={setStreamFilter} />
                                <FilterPick label={t('legalHub.taskColOwner')} value={ownerFilter} items={ownerOptions} noMatch={t('legalHub.teamNoMatch')} onSelect={setOwnerFilter} />
                                <FilterPick label={t('legalHub.taskColPriority')} value={priorityFilter} items={priorityOptions} noMatch={t('legalHub.teamNoMatch')} onSelect={setPriorityFilter} />
                                {view === 'board' ? (
                                    <label className={`lh-bt__toggle${hideEmpty ? ' is-on' : ''}`}>
                                        <input type="checkbox" checked={hideEmpty} onChange={(event) => setHideEmpty(event.target.checked)} />
                                        {t('legalHub.boardHideEmpty')}
                                        {hideEmpty && hiddenCount > 0 ? <em>{t('legalHub.boardHiddenCount').replace('{count}', String(hiddenCount))}</em> : null}
                                    </label>
                                ) : null}
                                {filtersOn ? (
                                    <button type="button" className="lh-bt__reset" onClick={resetFilters}>{t('legalHub.myTasksClear')}</button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    <div className="lh-bt__seg" role="group" aria-label={t('legalHub.viewAria')}>
                        <button type="button" className={view === 'board' ? 'is-on' : ''} aria-pressed={view === 'board'} onClick={() => setView('board')}>
                            <IconBoard />
                            {t('legalHub.boardViewBoard')}
                        </button>
                        <button type="button" className={view === 'list' ? 'is-on' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')}>
                            <IconList />
                            {t('legalHub.boardViewList')}
                        </button>
                    </div>
                    {canCreate ? (
                        <button type="button" className="lh-bt__new" onClick={() => openComposer(null)}>
                            <span aria-hidden>+</span>
                            {t('legalHub.myTasksNew')}
                        </button>
                    ) : null}
                    {mode === 'mine' ? (
                        <div className="lh-board-menu" ref={boardMenuRef}>
                            <button type="button" className={`lh-board-menu__btn${boardMenuOpen ? ' is-on' : ''}`} aria-label={t('legalHub.boardMenu')} aria-expanded={boardMenuOpen} onClick={() => setBoardMenuOpen((value) => !value)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                            </button>
                            {boardMenuOpen ? (
                                <div className="lh-board-menu__drop" role="menu">
                                    <button type="button" className="lh-board-menu__item" onClick={() => { setBoardMenuOpen(false); setRenaming(true); }}>
                                        <MenuIcon d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                        {t('legalHub.boardRename')}
                                    </button>
                                    <button type="button" className="lh-board-menu__item" onClick={() => { setBoardMenuOpen(false); bgInputRef.current?.click(); }}>
                                        <MenuIcon d="M4 5h16v14H4zM8 11l2.5 3 2-2.5L16 16H8z" />
                                        {t('legalHub.boardBg')}
                                    </button>
                                    {backgroundImage ? (
                                        <button type="button" className="lh-board-menu__item is-danger" onClick={() => { setBoardMenuOpen(false); removeBackground(); }}>
                                            <MenuIcon d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
                                            {t('legalHub.boardRemoveBg')}
                                        </button>
                                    ) : null}
                                    <button type="button" className="lh-board-menu__item" onClick={() => { setBoardMenuOpen(false); setMembersOpen(true); }}>
                                        <MenuIcon d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM4 20a8 8 0 0 1 16 0" />
                                        {t('legalHub.boardMembers')}
                                    </button>
                                    <button type="button" className="lh-board-menu__item" onClick={() => { setBoardMenuOpen(false); exportBoard(); }}>
                                        <MenuIcon d="M12 4v10M8 10l4 4 4-4M5 19h14" />
                                        {t('legalHub.boardExport')}
                                    </button>
                                    <button type="button" className="lh-board-menu__item" onClick={() => { setBoardMenuOpen(false); importInputRef.current?.click(); }}>
                                        <MenuIcon d="M12 20V10M8 14l4-4 4 4M5 5h14" />
                                        {t('legalHub.boardImport')}
                                    </button>
                                    <button type="button" className="lh-board-menu__item is-danger" onClick={() => { setBoardMenuOpen(false); deleteBoard(); }}>
                                        <MenuIcon d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
                                        {t('legalHub.boardDelete')}
                                    </button>
                                </div>
                            ) : null}
                            <input ref={bgInputRef} type="file" accept="image/*" hidden onChange={onBackgroundFile} />
                            <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={importBoard} />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );

    const drawer = openTask ? (
        <LegalHubTaskDrawer key={openTask.id} task={openTask} owner={null} onClose={() => setOpenId(null)} />
    ) : null;
    const dialog = composer ? (
        <NewTaskDialog
            project={project}
            column={composeColumn}
            onClose={closeComposer}
            onCreate={(created) => {
                setTasks((current) => [...current, created]);
                closeComposer();
            }}
        />
    ) : null;
    const noMatch = visible.length === 0 && (filtersOn || needle) ? (
        <div className="lh-rows__empty">
            <strong>{t('legalHub.boardNoMatch')}</strong>
            {filtersOn ? <button type="button" className="lh-bt__reset" onClick={resetFilters}>{t('legalHub.myTasksClear')}</button> : null}
        </div>
    ) : null;

    if (view === 'list') {
        const listed = [...visible].sort((a, b) => a.clientOn.localeCompare(b.clientOn));
        const emptyTitle = mode === 'queue' ? t('legalHub.queueEmptyTitle') : t('legalHub.myTasksEmptyTitle');
        const emptyText = mode === 'queue' ? t('legalHub.queueEmptyText') : t('legalHub.myTasksEmptyText');
        return (
            <div className={`lh-my lh-my--docket lh-my--list${backgroundImage ? ' lh-my--photo' : ''}`} style={themeStyle}>
                {photo}
                {toolbar}
                <div className={`lh-rows${project == null ? '' : ' lh-rows--one'}`}>
                    {noMatch ?? (listed.length === 0 ? (
                        <div className="lh-rows__empty">
                            <strong>{emptyTitle}</strong>
                            <p>{emptyText}</p>
                        </div>
                    ) : (
                        <ul>
                            {listed.map((task) => {
                                const column = columnOf(task);
                                const owner = PERSON_LABEL[task.owner];
                                const reviewer = task.reviewer ? PERSON_LABEL[task.reviewer] : null;
                                const stream = task.workstream && task.workstream !== '—' ? task.workstream : '';
                                const late = dayDelta(task.clientOn) < 0;
                                const soon = !late && dayDelta(task.clientOn) <= 1;
                                return (
                                    <li key={task.id}>
                                        <button type="button" className={`lh-rows__item${late ? ' is-late' : ''}`} onClick={() => setOpenId(task.id)}>
                                            <span className="lh-rows__text">
                                                <strong>
                                                    {task.priority === 'high' ? <span className="lh-rows__flag" title={t('legalHub.myTasksUrgent')}><IconFlag /></span> : null}
                                                    {task.title}
                                                </strong>
                                                <small className="lh-rows__meta">
                                                    {project == null ? `${PROJECT_TITLE[task.project]} · ` : ''}
                                                    {stream ? `${stream} · ` : ''}
                                                    {owner.name}
                                                    {reviewer ? ` → ${reviewer.name}` : ''}
                                                </small>
                                            </span>
                                            <span className="lh-rows__project">
                                                {project == null ? <b>{PROJECT_TITLE[task.project]}</b> : <b>{stream || '—'}</b>}
                                                {project == null ? <small>{stream || '\u00a0'}</small> : null}
                                            </span>
                                            <span className="lh-rows__people">
                                                <b>{owner.name}</b>
                                                <small>{reviewer ? `→ ${reviewer.name}` : '\u00a0'}</small>
                                            </span>
                                            <span className={`lh-rows__stage lh-rows__stage--${column}`}>{customColumns.find((item) => item.id === column)?.title ?? (isBuiltin(column) ? t(COLUMN_LABEL[column]) : column)}</span>
                                            <span className={`lh-my__duepill${late ? ' is-late' : ''}${soon ? ' is-soon' : ''}`}>
                                                {shortDate(task.clientOn, locale)} · {dueText(dayDelta(task.clientOn), t)}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ))}
                </div>
                {drawer}
                {dialog}
                {membersOpen ? <BoardMembersDialog people={members} onClose={() => setMembersOpen(false)} /> : null}
            </div>
        );
    }

    return (
        <div className={`lh-my lh-my--docket${backgroundImage ? ' lh-my--photo' : ''}`} style={themeStyle}>
            {photo}
            {toolbar}
            {noMatch ?? (
                <div className="lh-my__board" ref={boardRef}>
                    {shownColumns.map((column) => (
                        <BoardColumnView
                            key={column.id}
                            id={column.id}
                            title={column.label}
                            hint={column.hint}
                            review={column.review}
                            cards={column.cards}
                            showProject={project == null}
                            collapsed={collapsed.includes(column.id) && dragging == null && columnDrag == null}
                            onToggleCollapsed={() => toggleCollapsed(column.id)}
                            droppable={column.droppable}
                            dragging={dragging}
                            reorderable={mode === 'mine'}
                            columnDrag={columnDrag}
                            columnOver={columnOver === column.id}
                            onColumnDragStart={setColumnDrag}
                            onColumnDragEnd={() => {
                                setColumnDrag(null);
                                setColumnOver(null);
                            }}
                            onColumnOver={setColumnOver}
                            onColumnDrop={reorderColumns}
                            onAdd={() => openComposer(column.id as BoardColumn)}
                            canAdd={column.canAdd}
                            onMove={(id) => moveTask(id, column.id)}
                            onDragStart={setDragging}
                            onDragEnd={() => setDragging(null)}
                            onOpen={setOpenId}
                            onRemove={column.custom ? () => removeColumn(column.id) : undefined}
                        />
                    ))}
                    {mode === 'mine' ? <ColumnAdder onCreate={addColumn} /> : null}
                </div>
            )}
            {drawer}
            {dialog}
            {membersOpen ? <BoardMembersDialog people={members} onClose={() => setMembersOpen(false)} /> : null}
        </div>
    );
}

function MenuIcon({ d }: { d: string }) {
    return (
        <span className="lh-board-menu__icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
            </svg>
        </span>
    );
}

function BoardMembersDialog({ people, onClose }: { people: { code: string; name: string }[]; onClose: () => void }) {
    const { t } = useI18n();
    return createPortal(
        <div className="lh-my__overlay" role="presentation" onMouseDown={onClose}>
            <div className="lh-my__dialog lh-board-members" role="dialog" aria-modal="true" aria-labelledby="lh-board-members-title" onMouseDown={(event) => event.stopPropagation()}>
                <header>
                    <h2 id="lh-board-members-title">{t('legalHub.boardMembers')}</h2>
                </header>
                {people.length === 0 ? <p>{t('legalHub.boardMembersEmpty')}</p> : (
                    <ul>
                        {people.map((person) => (
                            <li key={person.code}>
                                <b>{person.code}</b>
                                <span>{person.name}</span>
                            </li>
                        ))}
                    </ul>
                )}
                <footer>
                    <button type="button" onClick={onClose}>{t('legalHub.myTasksCancel')}</button>
                </footer>
            </div>
        </div>,
        document.body,
    );
}

function BoardColumnView({ id, title, hint, review, cards, showProject, collapsed, onToggleCollapsed, droppable, dragging, reorderable, columnDrag, columnOver, onColumnDragStart, onColumnDragEnd, onColumnOver, onColumnDrop, onAdd, canAdd, onMove, onDragStart, onDragEnd, onOpen, onRemove }: {
    id: string;
    title: string;
    hint: string | null;
    review: boolean;
    cards: MineTask[];
    showProject: boolean;
    collapsed: boolean;
    onToggleCollapsed: () => void;
    droppable: boolean;
    dragging: string | null;
    reorderable: boolean;
    columnDrag: string | null;
    columnOver: boolean;
    onColumnDragStart: (id: string) => void;
    onColumnDragEnd: () => void;
    onColumnOver: (id: string | null) => void;
    onColumnDrop: (from: string, to: string) => void;
    onAdd: () => void;
    canAdd: boolean;
    onMove: (id: string) => void;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
    onOpen: (id: string) => void;
    onRemove?: () => void;
}) {
    const { t } = useI18n();
    const foldLabel = t(collapsed ? 'legalHub.myTasksColumnExpand' : 'legalHub.myTasksColumnCollapse');
    const moveLabel = t('legalHub.boardMoveColumn');
    const lateCount = cards.filter((task) => !task.done && dayDelta(task.clientOn) < 0).length;
    const onDragOver = (event: DragEvent) => {
        if (columnDrag) {
            if (reorderable && columnDrag !== id) {
                event.preventDefault();
                onColumnOver(id);
            }
            return;
        }
        if (!droppable || !dragging)
            return;
        event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
        if (columnDrag) {
            event.preventDefault();
            onColumnDrop(columnDrag, id);
            return;
        }
        if (!droppable || !dragging)
            return;
        event.preventDefault();
        onMove(dragging);
    };
    const grip = reorderable ? (
        <ColumnGrip
            label={moveLabel}
            folded={collapsed}
            onDragStart={() => onColumnDragStart(id)}
            onDragEnd={onColumnDragEnd}
        />
    ) : null;
    if (collapsed) {
        return (
            <section
                className={`lh-my__col lh-my__col--${id} is-folded${columnDrag === id ? ' is-col-dragging' : ''}${columnOver ? ' is-target' : ''}`}
                data-col={id}
                aria-label={title}
                onDragOver={onDragOver}
                onDragLeave={(event) => {
                    if (!columnDrag || event.currentTarget.contains(event.relatedTarget as Node))
                        return;
                    onColumnOver(null);
                }}
                onDrop={onDrop}
            >
                {grip}
                <button type="button" className="lh-my__fold-spine" aria-label={`${foldLabel}: ${title}`} title={foldLabel} onClick={onToggleCollapsed}>
                    <span className={`lh-my__dot lh-my__dot--${id}`} aria-hidden />
                    <em className={lateCount > 0 ? 'is-late' : ''}>{cards.length}</em>
                    <span className="lh-my__fold-label">{title}</span>
                </button>
            </section>
        );
    }
    return (
        <section
            className={`lh-my__col lh-my__col--${id}${columnDrag === id ? ' is-col-dragging' : ''}${columnOver || (dragging && droppable) ? ' is-target' : ''}${dragging && !droppable && !columnDrag ? ' is-locked-col' : ''}`}
            data-col={id}
            aria-label={title}
            onDragOver={onDragOver}
            onDragLeave={(event) => {
                if (!columnDrag || event.currentTarget.contains(event.relatedTarget as Node))
                    return;
                onColumnOver(null);
            }}
            onDrop={onDrop}
        >
            <header>
                {grip}
                <span className={`lh-my__dot lh-my__dot--${id}`} aria-hidden />
                <span className="lh-my__col-title" title={hint ?? undefined}>
                    <strong>{title}</strong>
                    <em>{cards.length}</em>
                </span>
                {review ? (
                    <span className="lh-my__lock" title={hint ?? undefined}>
                        <LockIcon />
                    </span>
                ) : null}
                {onRemove ? (
                    <button type="button" className="lh-my__col-remove" aria-label={t('legalHub.boardRemoveColumn')} title={t('legalHub.boardRemoveColumn')} onClick={onRemove}>×</button>
                ) : null}
                <button type="button" className="lh-my__fold-btn" aria-label={foldLabel} title={foldLabel} onClick={onToggleCollapsed}>
                    <FoldIcon />
                </button>
            </header>
            {cards.length === 0 ? <p className="lh-my__empty">{droppable ? t('legalHub.myTasksDrop') : t('legalHub.myTasksColEmpty')}</p> : null}
            {cards.length > 0 ? (
                <ul>
                    {cards.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            showProject={showProject}
                            draggable={droppable && !columnDrag}
                            lifting={dragging === task.id}
                            onDragStart={() => onDragStart(task.id)}
                            onDragEnd={onDragEnd}
                            onOpen={() => onOpen(task.id)}
                        />
                    ))}
                </ul>
            ) : null}
            {canAdd ? (
                <div className="lh-my__quick">
                    <button type="button" onClick={onAdd}>+ {t('legalHub.myTasksAddCard')}</button>
                </div>
            ) : null}
        </section>
    );
}

function ColumnGrip({ label, folded, onDragStart, onDragEnd }: {
    label: string;
    folded: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
}) {
    return (
        <button
            type="button"
            className={`lh-my__col-grip${folded ? ' lh-my__col-grip--fold' : ''}`}
            draggable
            aria-label={label}
            title={label}
            onClick={(event) => event.stopPropagation()}
            onDragStart={(event) => {
                event.stopPropagation();
                event.dataTransfer.setData('application/x-lh-column', '1');
                event.dataTransfer.effectAllowed = 'move';
                onDragStart();
            }}
            onDragEnd={(event) => {
                event.stopPropagation();
                onDragEnd();
            }}
        >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="9" cy="7" r="1.4" />
                <circle cx="15" cy="7" r="1.4" />
                <circle cx="9" cy="12" r="1.4" />
                <circle cx="15" cy="12" r="1.4" />
                <circle cx="9" cy="17" r="1.4" />
                <circle cx="15" cy="17" r="1.4" />
            </svg>
        </button>
    );
}

function LockIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.2" />
        </svg>
    );
}

function FoldIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m11 7-5 5 5 5" />
            <path d="m18 7-5 5 5 5" />
        </svg>
    );
}

function IconFilter() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 5h16l-6 7v6l-4 2v-8z" />
        </svg>
    );
}

function IconBoard() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="5" height="16" rx="1.5" />
            <rect x="10" y="4" width="5" height="11" rx="1.5" />
            <rect x="17" y="4" width="4" height="7" rx="1.5" />
        </svg>
    );
}

function IconList() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
    );
}

function IconFlag() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 21V4" />
            <path d="M5 4h11l-2 4 2 4H5" />
        </svg>
    );
}

function TaskCard({ task, showProject, draggable, lifting, onDragStart, onDragEnd, onOpen }: {
    task: MineTask;
    showProject: boolean;
    draggable: boolean;
    lifting: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    onOpen: () => void;
}) {
    const { t, locale } = useI18n();
    const dragged = useRef(false);
    const owner = PERSON_LABEL[task.owner];
    const reviewer = task.reviewer ? PERSON_LABEL[task.reviewer] : null;
    const clientLate = !task.done && dayDelta(task.clientOn) < 0;
    const soon = !task.done && !clientLate && dayDelta(task.clientOn) <= 1;
    const due = `${shortDate(task.clientOn, locale)} · ${task.done ? t('legalHub.taskStageApproved') : dueText(dayDelta(task.clientOn), t)}`;
    const context = [showProject ? PROJECT_LABEL[task.project] : '', task.workstream && task.workstream !== '—' ? task.workstream : ''].filter(Boolean).join(' · ');
    return (
        <li
            data-card={task.id}
            className={`lh-my__card${draggable ? '' : ' is-locked'}${lifting ? ' is-lifting' : ''}${clientLate ? ' is-late' : ''}${task.done ? ' is-done' : ''}`}
            title={draggable ? t('legalHub.cardDragHint') : t('legalHub.myTasksLocked')}
            draggable={draggable}
            tabIndex={0}
            role="button"
            aria-label={`${task.title}. ${due}`}
            onDragStart={() => {
                dragged.current = true;
                onDragStart();
            }}
            onDragEnd={() => {
                onDragEnd();
                window.setTimeout(() => {
                    dragged.current = false;
                }, 0);
            }}
            onClick={() => {
                if (dragged.current)
                    return;
                onOpen();
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen();
                }
            }}
        >
            <strong>
                {task.priority === 'high' && !task.done ? <span className="lh-my__hot" title={t('legalHub.myTasksUrgent')}><IconFlag /></span> : null}
                {task.title}
            </strong>
            {context ? <span className="lh-my__context">{context}</span> : null}
            <span className="lh-my__card-foot">
                <span className={`lh-my__duepill${clientLate ? ' is-late' : ''}${soon ? ' is-soon' : ''}${task.done ? ' is-done' : ''}`}>{due}</span>
                <span className={`lh-tasks__avatar lh-tasks__avatar--${task.owner}`} title={reviewer ? `${owner.name} → ${reviewer.name}` : owner.name}>{owner.code}</span>
            </span>
        </li>
    );
}

function ColumnAdder({ onCreate }: { onCreate: (title: string) => void }) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const submit = () => {
        const name = title.trim();
        if (!name)
            return;
        onCreate(name);
        setTitle('');
        setOpen(false);
    };
    if (!open) {
        return (
            <div className="lh-my__adder">
                <button type="button" className="lh-my__add" onClick={() => setOpen(true)}>+ {t('legalHub.boardAddColumn')}</button>
            </div>
        );
    }
    return (
        <div className="lh-my__adder">
            <form onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
            >
                <input
                    autoFocus
                    value={title}
                    placeholder={t('legalHub.boardColumnName')}
                    aria-label={t('legalHub.boardColumnName')}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setTitle('');
                            setOpen(false);
                        }
                    }}
                />
                <div className="lh-my__adder-actions">
                    <button type="submit" disabled={!title.trim()}>{t('legalHub.boardAddColumn')}</button>
                    <button type="button" onClick={() => { setTitle(''); setOpen(false); }}>{t('legalHub.myTasksCancel')}</button>
                </div>
            </form>
        </div>
    );
}

function NewTaskDialog({ project: fixedProject = null, column = null, onClose, onCreate }: {
    project?: TaskProjectId | null;
    column?: string | null;
    onClose: () => void;
    onCreate: (task: MineTask) => void;
}) {
    const { t } = useI18n();
    const [title, setTitle] = useState('');
    const [project, setProject] = useState<TaskProjectId>(fixedProject ?? 'solar');
    const [workstream, setWorkstream] = useState('Land / LLA');
    const [internalOn, setInternalOn] = useState(() => plusDays(2));
    const [clientOn, setClientOn] = useState(() => plusDays(4));
    const [priority, setPriority] = useState<TaskPriorityId>('normal');
    const [owner, setOwner] = useState<TaskPersonId>('ja1');
    const [approval, setApproval] = useState(false);
    const [instructions, setInstructions] = useState('');
    const [error, setError] = useState('');
    const projects = TASK_PROJECTS.map((id) => ({ id, label: PROJECT_LABEL[id] }));
    const people = TASK_PEOPLE.map((id) => ({ id, label: PERSON_LABEL[id].name }));
    const priorities = TASK_PRIORITIES.map((id) => ({ id, label: t(PRIORITY_LABEL[id]) }));

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape')
                return;
            if (document.querySelector('.ttp-pop, .tsp-srch--open'))
                return;
            onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const submit = () => {
        if (!title.trim()) {
            setError(t('legalHub.myTasksTitleRequired'));
            return;
        }
        if (!clientOn) {
            setError(t('legalHub.myTasksDateRequired'));
            return;
        }
        onCreate({
            id: `new-${Date.now()}`,
            project,
            title: title.trim(),
            workstream: workstream.trim() || '—',
            owner,
            reviewer: approval ? 'partner' : null,
            status: column && isBuiltin(column) ? statusOf(column) : 'todo',
            priority,
            reviewOn: null,
            clientOn,
            minutes: 0,
            done: false,
            hours: 0,
            internalOn,
            instructions: instructions.trim(),
            approval,
            boardColumn: column && !isBuiltin(column) ? column : undefined,
        });
    };

    return createPortal(
        <div className="lh-my__overlay" role="presentation" onMouseDown={onClose}>
            <form
                className="lh-my__dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="lh-new-task-title"
                onMouseDown={(event) => event.stopPropagation()}
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <header>
                    <h2 id="lh-new-task-title">{t('legalHub.myTasksNew')}</h2>
                    <button type="button" className="lh-drawer__close" aria-label={t('legalHub.taskDrawerClose')} onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                            <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                    </button>
                </header>
                <label className="lh-drawer__field">
                    <span>{t('legalHub.myTasksTitle')}</span>
                    <input className="lh-drawer__input" autoFocus value={title} placeholder={t('legalHub.myTasksTitlePh')} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <div className="lh-drawer__grid">
                    <label className="lh-drawer__field">
                        <span>{t('legalHub.taskColProject')}</span>
                        <SearchableSelect
                            portalDropdown
                            portalZIndex={6000}
                            buttonClassName="lh-drawer__pick"
                            aria-label={t('legalHub.taskColProject')}
                            placeholder={t('legalHub.taskColProject')}
                            emptyListText={t('legalHub.taskFilterAll')}
                            noMatchText={t('legalHub.teamNoMatch')}
                            value={project}
                            items={projects}
                            getOptionValue={(item) => item.id}
                            getOptionLabel={(item) => item.label}
                            getSearchText={(item) => item.label}
                            onSelect={(item) => setProject(item.id)}
                        />
                    </label>
                    <label className="lh-drawer__field">
                        <span>{t('legalHub.taskColWorkstream')}</span>
                        <input className="lh-drawer__input" value={workstream} onChange={(event) => setWorkstream(event.target.value)} />
                    </label>
                    <DateField label={t('legalHub.taskFieldInternal')} value={internalOn} onChange={setInternalOn} />
                    <DateField label={t('legalHub.taskFieldClient')} value={clientOn} onChange={setClientOn} />
                    <label className="lh-drawer__field">
                        <span>{t('legalHub.taskColPriority')}</span>
                        <SearchableSelect
                            portalDropdown
                            portalZIndex={6000}
                            buttonClassName="lh-drawer__pick"
                            aria-label={t('legalHub.taskColPriority')}
                            placeholder={t('legalHub.taskColPriority')}
                            emptyListText={t('legalHub.taskFilterAll')}
                            noMatchText={t('legalHub.teamNoMatch')}
                            value={priority}
                            items={priorities}
                            getOptionValue={(item) => item.id}
                            getOptionLabel={(item) => item.label}
                            getSearchText={(item) => item.label}
                            onSelect={(item) => setPriority(item.id)}
                        />
                    </label>
                    <label className="lh-drawer__field">
                        <span>{t('legalHub.taskFieldOwner')}</span>
                        <SearchableSelect
                            portalDropdown
                            portalZIndex={6000}
                            buttonClassName="lh-drawer__pick"
                            aria-label={t('legalHub.taskFieldOwner')}
                            placeholder={t('legalHub.taskFieldOwner')}
                            emptyListText={t('legalHub.taskFilterAll')}
                            noMatchText={t('legalHub.teamNoMatch')}
                            value={owner}
                            items={people}
                            getOptionValue={(item) => item.id}
                            getOptionLabel={(item) => item.label}
                            getSearchText={(item) => item.label}
                            onSelect={(item) => setOwner(item.id)}
                        />
                    </label>
                </div>
                <label className="lh-my__check">
                    <input type="checkbox" checked={approval} onChange={(event) => setApproval(event.target.checked)} />
                    {t('legalHub.myTasksApproval')}
                </label>
                <label className="lh-drawer__field">
                    <span>{t('legalHub.taskFieldInstructions')}</span>
                    <textarea className="lh-drawer__area" rows={3} value={instructions} placeholder={t('legalHub.myTasksInstructionsPh')} onChange={(event) => setInstructions(event.target.value)} />
                </label>
                {error ? <p className="lh-my__error">{error}</p> : null}
                <footer>
                    <button type="button" onClick={onClose}>{t('legalHub.myTasksCancel')}</button>
                    <button type="submit">{t('legalHub.myTasksCreate')}</button>
                </footer>
            </form>
        </div>,
        document.body,
    );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
    const id = label.replace(/\s+/g, '-');
    return (
        <div className="lh-drawer__field">
            <span id={id}>{label}</span>
            <DatePicker
                portal
                portalZIndex={6000}
                className="lh-drawer__calendar"
                buttonClassName="lh-drawer__date"
                aria-labelledby={id}
                title={label}
                emptyLabel="—"
                value={value}
                onChange={onChange}
            />
        </div>
    );
}
