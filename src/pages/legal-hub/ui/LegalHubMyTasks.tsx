import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { DatePicker, SearchableSelect } from '@shared/ui';
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

export function columnOf(task: Pick<MineTask, 'status' | 'waitingFor' | 'done'>): BoardColumn {
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
        setHideEmptyState(next);
        writeStored(HIDE_EMPTY_KEY, next);
    };
    const [onlyLate, setOnlyLate] = useState(false);
    const [onlyUrgent, setOnlyUrgent] = useState(false);
    const [projectFilter, setProjectFilter] = useState<TaskProjectId | ''>('');
    const [statusFilter, setStatusFilter] = useState<BoardColumn | ''>('');
    const [streamFilter, setStreamFilter] = useState('');
    const [ownerFilter, setOwnerFilter] = useState<TaskPersonId | ''>('');
    const [priorityFilter, setPriorityFilter] = useState<TaskPriorityId | ''>('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filtersRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<string | null>(null);
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
        if (createSignal === seenCreate.current)
            return;
        seenCreate.current = createSignal;
        if (mode === 'mine')
            setComposer(true);
    }, [createSignal, mode]);
    const [adding, setAdding] = useState<BoardColumn | null>(null);
    const [draft, setDraft] = useState('');
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

    const moveTask = (id: string, column: BoardColumn) => {
        setTasks((current) => current.map((task) => {
            if (task.id !== id)
                return task;
            const waitingFor = column === 'waitClient'
                ? (isClientWait(task) ? task.waitingFor : 'Client')
                : column === 'waitGov'
                    ? (task.waitingFor && !isClientWait(task) ? task.waitingFor : undefined)
                    : task.waitingFor;
            return { ...task, done: column === 'done', status: statusOf(column), waitingFor };
        }));
        setDragging(null);
    };

    const addCard = (column: BoardColumn) => {
        const title = draft.trim();
        if (!title)
            return;
        const clientOn = plusDays(4);
        setTasks((current) => [...current, {
            id: `new-${Date.now()}`,
            project: project ?? 'solar',
            title,
            workstream: '—',
            owner: 'ja1',
            reviewer: null,
            status: statusOf(column),
            priority: 'normal',
            reviewOn: null,
            clientOn,
            minutes: 60,
            done: false,
            hours: 1,
            internalOn: clientOn,
            instructions: '',
            approval: false,
        }]);
        setDraft('');
    };

    const canCreate = mode === 'mine';
    const title = project != null ? PROJECT_TITLE[project] : t(mode === 'queue' ? 'legalHub.sideReview' : 'legalHub.myTasks');
    const projectOptions = useMemo(
        () => [{ id: '' as const, label: t('legalHub.boardAllProjects') }, ...TASK_PROJECTS.map((id) => ({ id, label: PROJECT_TITLE[id] }))],
        [t],
    );
    const statusOptions = useMemo(() => {
        const ids: BoardColumn[] = mode === 'queue' ? ['associate', 'partner'] : COLUMNS;
        return [{ id: '' as const, label: t('legalHub.boardAllStatuses') }, ...ids.map((id) => ({ id, label: t(COLUMN_LABEL[id]) }))];
    }, [mode, t]);
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

    const columns: { id: string; label: string; hint: string | null; review: boolean; droppable: boolean; canAdd: boolean; cards: MineTask[] }[] = mode === 'queue'
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
            cards: visible.filter((task) => dueColumnOf(task) === column.id).sort((a, b) => a.clientOn.localeCompare(b.clientOn)),
        }))
        : COLUMNS.map((column) => {
            const sub = COLUMN_SUB[column];
            return {
                id: column,
                label: t(COLUMN_LABEL[column]),
                hint: sub ? t(sub) : null,
                review: LOCKED.includes(column),
                droppable: DROPPABLE.includes(column),
                canAdd: canCreate && QUICK_ADD.includes(column),
                cards: visible
                    .filter((task) => columnOf(task) === column)
                    .sort((a, b) => Number(isLateTask(b)) - Number(isLateTask(a)) || Number(b.priority === 'high') - Number(a.priority === 'high') || a.clientOn.localeCompare(b.clientOn)),
            };
        });
    const shownColumns = columns.filter((column) => !hideEmpty || column.cards.length > 0 || (dragging != null && column.droppable) || adding === column.id);
    const hiddenCount = columns.length - shownColumns.length;

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
                    <h1>{title}</h1>
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
                        <button type="button" className="lh-bt__new" onClick={() => setComposer(true)}>
                            <span aria-hidden>+</span>
                            {t('legalHub.myTasksNew')}
                        </button>
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
            onClose={() => setComposer(false)}
            onCreate={(created) => {
                setTasks((current) => [...current, created]);
                setComposer(false);
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
            <div className="lh-my lh-my--docket lh-my--list">
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
                                                {project == null ? <b>{PROJECT_TITLE[task.project]}</b> : null}
                                                {stream ? <small>{stream}</small> : null}
                                            </span>
                                            <span className="lh-rows__people">
                                                <b>{owner.name}</b>
                                                {reviewer ? <small>→ {reviewer.name}</small> : null}
                                            </span>
                                            <span className={`lh-rows__stage lh-rows__stage--${column}`}>{t(COLUMN_LABEL[column])}</span>
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
            </div>
        );
    }

    return (
        <div className="lh-my lh-my--docket">
            {toolbar}
            {noMatch ?? (
                <div className="lh-my__board">
                    {shownColumns.map((column) => (
                        <BoardColumnView
                            key={column.id}
                            id={column.id}
                            title={column.label}
                            hint={column.hint}
                            review={column.review}
                            cards={column.cards}
                            showProject={project == null}
                            collapsed={collapsed.includes(column.id) && dragging == null}
                            onToggleCollapsed={() => toggleCollapsed(column.id)}
                            droppable={column.droppable}
                            dragging={dragging}
                            adding={adding === column.id}
                            draft={draft}
                            onDraft={setDraft}
                            onStartAdd={() => {
                                setAdding(column.id as BoardColumn);
                                setDraft('');
                            }}
                            onCancelAdd={() => {
                                setAdding(null);
                                setDraft('');
                            }}
                            onAdd={() => addCard(column.id as BoardColumn)}
                            canAdd={column.canAdd}
                            onMove={(id) => moveTask(id, column.id as BoardColumn)}
                            onDragStart={setDragging}
                            onDragEnd={() => setDragging(null)}
                            onOpen={setOpenId}
                        />
                    ))}
                </div>
            )}
            {drawer}
            {dialog}
        </div>
    );
}

function BoardColumnView({ id, title, hint, review, cards, showProject, collapsed, onToggleCollapsed, droppable, dragging, adding, draft, onDraft, onStartAdd, onCancelAdd, onAdd, canAdd, onMove, onDragStart, onDragEnd, onOpen }: {
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
    adding: boolean;
    draft: string;
    onDraft: (value: string) => void;
    onStartAdd: () => void;
    onCancelAdd: () => void;
    onAdd: () => void;
    canAdd: boolean;
    onMove: (id: string) => void;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
    onOpen: (id: string) => void;
}) {
    const { t } = useI18n();
    const foldLabel = t(collapsed ? 'legalHub.myTasksColumnExpand' : 'legalHub.myTasksColumnCollapse');
    const lateCount = cards.filter((task) => !task.done && dayDelta(task.clientOn) < 0).length;
    if (collapsed) {
        return (
            <section className={`lh-my__col lh-my__col--${id} is-folded`} aria-label={title}>
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
            className={`lh-my__col lh-my__col--${id}${dragging && droppable ? ' is-target' : ''}${dragging && !droppable ? ' is-locked-col' : ''}`}
            aria-label={title}
            onDragOver={(event) => {
                if (!droppable || !dragging)
                    return;
                event.preventDefault();
            }}
            onDrop={(event) => {
                if (!droppable || !dragging)
                    return;
                event.preventDefault();
                onMove(dragging);
            }}
        >
            <header>
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
                <button type="button" className="lh-my__fold-btn" aria-label={foldLabel} title={foldLabel} onClick={onToggleCollapsed}>
                    <FoldIcon />
                </button>
            </header>
            {cards.length === 0 && !adding ? <p className="lh-my__empty">{droppable ? t('legalHub.myTasksDrop') : t('legalHub.myTasksColEmpty')}</p> : null}
            {cards.length > 0 ? (
                <ul>
                    {cards.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            showProject={showProject}
                            draggable={droppable}
                            onDragStart={() => onDragStart(task.id)}
                            onDragEnd={onDragEnd}
                            onOpen={() => onOpen(task.id)}
                        />
                    ))}
                </ul>
            ) : null}
            {canAdd ? (
                <div className="lh-my__quick">
                    {adding ? (
                        <form onSubmit={(event) => {
                            event.preventDefault();
                            onAdd();
                        }}
                        >
                            <textarea
                                autoFocus
                                value={draft}
                                placeholder={t('legalHub.myTasksCardPh')}
                                aria-label={t('legalHub.myTasksTitle')}
                                onChange={(event) => onDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape')
                                        onCancelAdd();
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault();
                                        onAdd();
                                    }
                                }}
                            />
                            <div>
                                <button type="submit" disabled={!draft.trim()}>{t('legalHub.myTasksColumnAdd')}</button>
                                <button type="button" onClick={onCancelAdd}>{t('legalHub.myTasksCancel')}</button>
                            </div>
                        </form>
                    ) : (
                        <button type="button" onClick={onStartAdd}>+ {t('legalHub.myTasksAddCard')}</button>
                    )}
                </div>
            ) : null}
        </section>
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

function TaskCard({ task, showProject, draggable, onDragStart, onDragEnd, onOpen }: {
    task: MineTask;
    showProject: boolean;
    draggable: boolean;
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
            className={`lh-my__card${draggable ? '' : ' is-locked'}${clientLate ? ' is-late' : ''}${task.done ? ' is-done' : ''}`}
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

function NewTaskDialog({ project: fixedProject = null, onClose, onCreate }: {
    project?: TaskProjectId | null;
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
            status: 'todo',
            priority,
            reviewOn: null,
            clientOn,
            minutes: 0,
            done: false,
            hours: 0,
            internalOn,
            instructions: instructions.trim(),
            approval,
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
