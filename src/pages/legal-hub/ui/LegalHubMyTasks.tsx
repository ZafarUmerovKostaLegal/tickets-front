import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { DatePicker, SearchableSelect } from '@shared/ui';
import { LegalHubTaskDrawer } from './LegalHubTaskDrawer';
import { ATTENTION_LABEL, attentionRank, attentionReason, DueBadge, HeadActions, type AttentionReason } from './legalHubShared';
import {
    HUB_TASKS,
    MOCK_DONE_IDS,
    PERSON_LABEL,
    PROJECT_LABEL,
    TASK_PEOPLE,
    TASK_PRIORITIES,
    TASK_PROJECTS,
    type HubTask,
    type TaskPersonId,
    type TaskPriorityId,
    type TaskProjectId,
    type TaskStatusId,
} from './legalHubTasks';

type BoardColumn = 'todo' | 'progress' | 'wait' | 'associate' | 'partner';
type MineTask = HubTask & {
    done: boolean;
    hours: number;
    internalOn: string;
    instructions: string;
    approval: boolean;
    lane?: string;
};
type ExtraColumn = { id: string; title: string };

const COLUMNS: BoardColumn[] = ['todo', 'progress', 'wait', 'associate', 'partner'];
const DROPPABLE: BoardColumn[] = ['todo', 'progress', 'wait'];

const COLUMN_LABEL: Record<BoardColumn, TranslationKey> = {
    todo: 'legalHub.taskStatusTodo',
    progress: 'legalHub.statusInProgress',
    wait: 'legalHub.statusWaiting',
    associate: 'legalHub.taskStatusAssociate',
    partner: 'legalHub.taskStatusPartner',
};

const STATUS_LABEL: Record<TaskStatusId, TranslationKey> = {
    partner: 'legalHub.taskStatusPartner',
    progress: 'legalHub.statusInProgress',
    wait: 'legalHub.statusWaiting',
    changes: 'legalHub.statusChanges',
    associate: 'legalHub.taskStatusAssociate',
    todo: 'legalHub.taskStatusTodo',
};

const PRIORITY_LABEL: Record<TaskPriorityId, TranslationKey> = {
    high: 'legalHub.taskPriorityHigh',
    normal: 'legalHub.taskPriorityNormal',
    low: 'legalHub.taskPriorityLow',
};

const PROJECT_ORDER: TaskProjectId[] = ['solar', 'wind', 'infrastructure', 'bess', 'healthcare'];

const BOARD_TITLE: Record<TaskProjectId, string> = {
    solar: 'Project A — Solar',
    wind: 'Project B — Wind',
    infrastructure: 'Project C — Infrastructure',
    bess: 'Project D — BESS',
    healthcare: 'Project E — Healthcare',
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

function isOverdue(task: MineTask): boolean {
    if (task.done)
        return false;
    return [task.clientOn, task.internalOn, task.reviewOn, task.followUpOn].some((iso) => iso != null && iso !== '' && dayDelta(iso) < 0);
}

function columnOf(status: TaskStatusId): BoardColumn {
    if (status === 'changes')
        return 'progress';
    if (status === 'todo' || status === 'progress' || status === 'wait' || status === 'associate' || status === 'partner')
        return status;
    return 'todo';
}

function mineFrom(source: HubTask[]): MineTask[] {
    return source.map((task) => ({
        ...task,
        done: MOCK_DONE_IDS.includes(task.id),
        hours: 4,
        internalOn: INTERNAL_ON[task.id] ?? task.reviewOn ?? task.clientOn,
        instructions: '',
        approval: task.priority === 'high',
    }));
}

export function LegalHubMyTasks({ query, source = null }: { query: string; source?: HubTask[] | null }) {
    const { t } = useI18n();
    const [tasks, setTasks] = useState<MineTask[]>(() => mineFrom(source ?? HUB_TASKS));
    const [mode, setMode] = useState<'status' | 'project'>('status');
    const [project, setProject] = useState('');
    const [waiting, setWaiting] = useState('');
    const [priority, setPriority] = useState('');
    const [dates, setDates] = useState('');
    const [showDone, setShowDone] = useState(false);
    const [stat, setStat] = useState<'' | 'wait' | 'review' | 'changes' | 'due'>('');
    const [focus, setFocus] = useState(false);
    const [collapsed, setCollapsed] = useState<string[]>(['infrastructure', 'bess', 'healthcare']);
    const [dragging, setDragging] = useState<string | null>(null);
    const [composer, setComposer] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);
    const [extraColumns, setExtraColumns] = useState<ExtraColumn[]>([]);
    const [columnDraft, setColumnDraft] = useState<string | null>(null);
    const [folded, setFolded] = useState<string[]>([]);
    const needle = query.trim().toLowerCase();
    const openTask = tasks.find((task) => task.id === openId) ?? null;

    const attention = useMemo(
        () => tasks
            .flatMap((task) => {
                const reason = task.done ? null : attentionReason(task);
                return reason == null ? [] : [{ task, reason }];
            })
            .sort((a, b) => attentionRank(a.reason) - attentionRank(b.reason) || a.task.clientOn.localeCompare(b.task.clientOn)),
        [tasks],
    );
    const listed = useMemo(() => tasks.filter((task) => {
        if (project && task.project !== project)
            return false;
        if (waiting === 'none' && task.reviewer != null)
            return false;
        if (waiting && waiting !== 'none' && task.reviewer !== waiting)
            return false;
        if (priority && task.priority !== priority)
            return false;
        if (dates === 'overdue' && dayDelta(task.clientOn) >= 0 && !(task.reviewOn && dayDelta(task.reviewOn) < 0))
            return false;
        if (dates === 'week' && (dayDelta(task.clientOn) < 0 || dayDelta(task.clientOn) > 7))
            return false;
        if (stat === 'wait' && task.status !== 'wait')
            return false;
        if (stat === 'review' && task.status !== 'associate' && task.status !== 'partner')
            return false;
        if (stat === 'changes' && task.status !== 'changes')
            return false;
        if (stat === 'due' && (dayDelta(task.clientOn) < 0 || dayDelta(task.clientOn) > 7))
            return false;
        if (focus && !attention.some((item) => item.task.id === task.id))
            return false;
        if (!needle)
            return true;
        const owner = PERSON_LABEL[task.owner].name;
        const reviewer = task.reviewer ? PERSON_LABEL[task.reviewer].name : '';
        return `${task.title} ${PROJECT_LABEL[task.project]} ${task.workstream} ${owner} ${reviewer}`.toLowerCase().includes(needle);
    }), [attention, dates, focus, needle, priority, project, stat, tasks, waiting]);
    const visible = useMemo(() => listed.filter((task) => showDone || !task.done), [listed, showDone]);

    const activeCount = tasks.filter((task) => !task.done).length;
    const waitCount = tasks.filter((task) => task.status === 'wait' && !task.done).length;
    const reviewCount = tasks.filter((task) => (task.status === 'associate' || task.status === 'partner') && !task.done).length;
    const changesCount = tasks.filter((task) => task.status === 'changes' && !task.done).length;
    const dueCount = tasks.filter((task) => !task.done && dayDelta(task.clientOn) >= 0 && dayDelta(task.clientOn) <= 7).length;
    const hasFilters = Boolean(project || waiting || priority || dates || showDone || stat || focus);
    const totalCount = tasks.filter((task) => showDone || !task.done).length;
    const resetFilters = () => {
        setProject('');
        setWaiting('');
        setPriority('');
        setDates('');
        setShowDone(false);
        setStat('');
        setFocus(false);
    };
    const projectOptions = TASK_PROJECTS.map((id) => ({ id, label: PROJECT_LABEL[id] }));
    const peopleOptions = TASK_PEOPLE.map((id) => ({ id, label: PERSON_LABEL[id].name }));
    const priorityOptions = TASK_PRIORITIES.map((id) => ({ id, label: t(PRIORITY_LABEL[id]) }));
    const dateOptions = [
        { id: 'overdue', label: t('legalHub.myTasksDatesOverdue') },
        { id: 'week', label: t('legalHub.myTasksDatesWeek') },
    ];
    const waitingOptions = [
        { id: 'none', label: t('legalHub.taskNoReviewer') },
        ...peopleOptions,
    ];

    const laneOf = (task: MineTask) => task.lane && extraColumns.some((column) => column.id === task.lane) ? task.lane : columnOf(task.status);
    const moveTask = (id: string, column: string) => {
        setTasks((current) => current.map((task) => {
            if (task.id !== id)
                return task;
            if (COLUMNS.includes(column as BoardColumn))
                return { ...task, lane: undefined, status: column as TaskStatusId };
            return { ...task, lane: column };
        }));
        setDragging(null);
    };
    const addColumn = (title: string) => {
        const name = title.trim();
        if (!name)
            return;
        setExtraColumns((current) => [...current, { id: `col-${Date.now()}`, title: name }]);
        setColumnDraft(null);
    };
    const removeColumn = (id: string) => {
        setExtraColumns((current) => current.filter((column) => column.id !== id));
        setFolded((current) => current.filter((item) => item !== id));
        setTasks((current) => current.map((task) => task.lane === id ? { ...task, lane: undefined } : task));
    };
    const toggleFold = (id: string) => {
        setFolded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    };

    return (
        <div className="lh-my">
            <HeadActions>
                <button type="button" className="lh-temp__open lh-primary" onClick={() => setComposer(true)}>
                    <span aria-hidden>+</span>
                    {t('legalHub.myTasksNew')}
                </button>
            </HeadActions>
            {attention.length > 0 ? (
                <AttentionPanel
                    items={attention}
                    focus={focus}
                    onToggleFocus={() => setFocus((value) => !value)}
                    onOpen={setOpenId}
                />
            ) : null}
            <ul className="lh-my__stats">
                <StatButton label={t('legalHub.statTasks')} value={activeCount} tone="accent" pressed={stat === ''} onClick={() => setStat('')} />
                <StatButton label={t('legalHub.statusWaiting')} value={waitCount} tone="wait" pressed={stat === 'wait'} onClick={() => setStat((current) => current === 'wait' ? '' : 'wait')} />
                <StatButton label={t('legalHub.statReview')} value={reviewCount} tone="review" pressed={stat === 'review'} onClick={() => setStat((current) => current === 'review' ? '' : 'review')} />
                <StatButton label={t('legalHub.statusChanges')} value={changesCount} tone="changes" pressed={stat === 'changes'} onClick={() => setStat((current) => current === 'changes' ? '' : 'changes')} />
                <StatButton label={t('legalHub.statDue')} value={dueCount} tone="due" pressed={stat === 'due'} onClick={() => setStat((current) => current === 'due' ? '' : 'due')} />
            </ul>
            <div className="lh-my__controls">
                <div className="lh-view" role="group" aria-label={t('legalHub.viewAria')}>
                    <button type="button" className={mode === 'project' ? 'is-active' : ''} aria-pressed={mode === 'project'} onClick={() => setMode('project')}>
                        {t('legalHub.myTasksByProject')}
                    </button>
                    <button type="button" className={mode === 'status' ? 'is-active' : ''} aria-pressed={mode === 'status'} onClick={() => setMode('status')}>
                        {t('legalHub.myTasksByStatus')}
                    </button>
                </div>
                <div className="lh-my__filters">
                    <FilterSelect label={t('legalHub.taskColProject')} value={project} options={projectOptions} onChange={setProject} />
                    <FilterSelect label={t('legalHub.myTasksFilterWaiting')} value={waiting} options={waitingOptions} onChange={setWaiting} />
                    <FilterSelect label={t('legalHub.taskColPriority')} value={priority} options={priorityOptions} onChange={setPriority} />
                    <FilterSelect label={t('legalHub.myTasksFilterDates')} value={dates} options={dateOptions} onChange={setDates} />
                    <label className="lh-my__check">
                        <input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} />
                        {t('legalHub.myTasksShowDone')}
                    </label>
                </div>
                <div className="lh-my__summary" aria-live="polite">
                    <span>{t('legalHub.myTasksShown').replace('{shown}', String(visible.length)).replace('{total}', String(totalCount))}</span>
                    {hasFilters ? (
                        <button type="button" className="lh-tasks__reset" onClick={resetFilters}>
                            {t('legalHub.myTasksClear')}
                        </button>
                    ) : null}
                </div>
                {mode === 'project' ? (
                    <div className="lh-my__fold">
                        <button type="button" onClick={() => setCollapsed([])}>{t('legalHub.myTasksExpand')}</button>
                        <button type="button" onClick={() => setCollapsed(TASK_PROJECTS.filter((id) => visible.some((task) => task.project === id)))}>
                            {t('legalHub.myTasksCollapse')}
                        </button>
                    </div>
                ) : null}
            </div>
            {visible.length === 0 ? (
                <div className="lh-empty">
                    <p>{t('legalHub.myTasksEmpty')}</p>
                    {hasFilters ? (
                        <button type="button" className="lh-tasks__reset" onClick={resetFilters}>{t('legalHub.myTasksClear')}</button>
                    ) : null}
                </div>
            ) : null}
            {mode === 'status' && visible.length > 0 ? <p className="lh-my__hint">{t('legalHub.myTasksDragHint')}</p> : null}
            {mode === 'status' && visible.length > 0 ? (
                <div className={`lh-my__board${extraColumns.length > 0 ? ' is-wide' : ''}`}>
                    {COLUMNS.map((column) => (
                        <BoardColumnView
                            key={column}
                            title={t(COLUMN_LABEL[column])}
                            cards={visible.filter((task) => laneOf(task) === column)}
                            droppable={DROPPABLE.includes(column)}
                            dragging={dragging}
                            collapsed={folded.includes(column)}
                            onToggle={() => toggleFold(column)}
                            onAdd={() => setComposer(true)}
                            addLabel={t('legalHub.myTasksNew')}
                            onMove={(id) => moveTask(id, column)}
                            onDragStart={setDragging}
                            onDragEnd={() => setDragging(null)}
                            onOpen={setOpenId}
                        />
                    ))}
                    {extraColumns.map((column) => (
                        <BoardColumnView
                            key={column.id}
                            title={column.title}
                            cards={visible.filter((task) => laneOf(task) === column.id)}
                            droppable
                            dragging={dragging}
                            collapsed={folded.includes(column.id)}
                            onToggle={() => toggleFold(column.id)}
                            onAdd={() => setComposer(true)}
                            addLabel={t('legalHub.myTasksNew')}
                            onMove={(id) => moveTask(id, column.id)}
                            onDragStart={setDragging}
                            onDragEnd={() => setDragging(null)}
                            onOpen={setOpenId}
                            onRemove={() => removeColumn(column.id)}
                            removeLabel={t('legalHub.myTasksColumnRemove')}
                        />
                    ))}
                    <div className="lh-my__adder">
                        {columnDraft == null ? (
                            <button type="button" className="lh-my__add" onClick={() => setColumnDraft('')}>
                                <span aria-hidden>+</span>
                                {t('legalHub.myTasksColumn')}
                            </button>
                        ) : (
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    addColumn(columnDraft);
                                }}
                            >
                                <input
                                    autoFocus
                                    value={columnDraft}
                                    placeholder={t('legalHub.myTasksColumnName')}
                                    aria-label={t('legalHub.myTasksColumnName')}
                                    onChange={(event) => setColumnDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape')
                                            setColumnDraft(null);
                                    }}
                                />
                                <div className="lh-my__adder-actions">
                                    <button type="submit" disabled={!columnDraft.trim()}>{t('legalHub.myTasksColumnAdd')}</button>
                                    <button type="button" onClick={() => setColumnDraft(null)}>{t('legalHub.myTasksCancel')}</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            ) : null}
            {mode === 'project' && visible.length > 0 ? (
                <div className="lh-my__groups">
                    {PROJECT_ORDER.filter((id) => visible.some((task) => task.project === id)).map((id) => (
                        <ProjectGroup
                            key={id}
                            id={id}
                            open={!collapsed.includes(id)}
                            rows={visible.filter((task) => task.project === id)}
                            pool={listed.filter((task) => task.project === id)}
                            onToggle={() => setCollapsed((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                            onOpen={setOpenId}
                        />
                    ))}
                </div>
            ) : null}
            {openTask ? (
                <LegalHubTaskDrawer key={openTask.id} task={openTask} owner={null} onClose={() => setOpenId(null)} />
            ) : null}
            {composer ? (
                <NewTaskDialog
                    onClose={() => setComposer(false)}
                    onCreate={(draft) => {
                        setTasks((current) => [...current, draft]);
                        setComposer(false);
                        setMode('status');
                    }}
                />
            ) : null}
        </div>
    );
}

function BoardColumnView({ title, cards, droppable, dragging, collapsed, onToggle, onAdd, addLabel, onMove, onDragStart, onDragEnd, onOpen, onRemove, removeLabel }: {
    title: string;
    cards: MineTask[];
    droppable: boolean;
    dragging: string | null;
    collapsed: boolean;
    onToggle: () => void;
    onAdd: () => void;
    addLabel: string;
    onMove: (id: string) => void;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
    onOpen: (id: string) => void;
    onRemove?: () => void;
    removeLabel?: string;
}) {
    const { t } = useI18n();
    const foldLabel = t(collapsed ? 'legalHub.myTasksColumnExpand' : 'legalHub.myTasksColumnCollapse');
    return (
        <section
            className={`lh-my__col${collapsed ? ' is-collapsed' : ''}${dragging && droppable ? ' is-target' : ''}`}
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
                <span className="lh-my__col-title">
                    <strong>{title}</strong>
                    <em>{cards.length}</em>
                </span>
                <span className="lh-my__col-meta">
                    <button type="button" className="lh-my__col-add" aria-label={addLabel} tabIndex={collapsed ? -1 : 0} onClick={onAdd}>
                        +
                    </button>
                    <button type="button" className="lh-my__col-fold" aria-label={foldLabel} aria-expanded={!collapsed} tabIndex={collapsed ? -1 : 0} onClick={onToggle}>
                        <CollapseIcon />
                    </button>
                    {onRemove ? (
                        <button type="button" className="lh-my__col-remove" aria-label={removeLabel} tabIndex={collapsed ? -1 : 0} onClick={onRemove}>
                            ×
                        </button>
                    ) : null}
                </span>
            </header>
            {cards.length === 0 ? <p>{droppable ? t('legalHub.myTasksDrop') : t('legalHub.queueEmpty')}</p> : (
                <ul>
                    {cards.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            draggable={droppable}
                            onDragStart={() => onDragStart(task.id)}
                            onDragEnd={onDragEnd}
                            onOpen={() => onOpen(task.id)}
                        />
                    ))}
                </ul>
            )}
            <button type="button" className="lh-my__col-spine" aria-label={foldLabel} tabIndex={collapsed ? 0 : -1} onClick={onToggle}>
                <CollapseIcon />
                <span>{title}</span>
                <em>{cards.length}</em>
            </button>
        </section>
    );
}

function CollapseIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M10 8l-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 8l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function AttentionPanel({ items, focus, onToggleFocus, onOpen }: {
    items: { task: MineTask; reason: AttentionReason }[];
    focus: boolean;
    onToggleFocus: () => void;
    onOpen: (id: string) => void;
}) {
    const { t, locale } = useI18n();
    const shown = items.slice(0, 4);
    const rest = items.length - shown.length;
    return (
        <section className="lh-attn" aria-labelledby="lh-attn-title">
            <header className="lh-attn__head">
                <span className="lh-attn__icon" aria-hidden>!</span>
                <div className="lh-attn__text">
                    <h2 id="lh-attn-title">
                        {t('legalHub.myTasksAttentionTitle')}
                        <em>{items.length}</em>
                    </h2>
                    <p>{t('legalHub.myTasksAttentionHint')}</p>
                </div>
                <button type="button" className={`lh-attn__toggle${focus ? ' is-on' : ''}`} aria-pressed={focus} onClick={onToggleFocus}>
                    {focus ? t('legalHub.myTasksAttentionAll') : t('legalHub.myTasksAttentionOnly')}
                </button>
            </header>
            <ul className="lh-attn__list">
                {shown.map(({ task, reason }) => (
                    <li key={task.id}>
                        <button type="button" className="lh-attn__item" onClick={() => onOpen(task.id)}>
                            <span className={`lh-attn__reason lh-attn__reason--${reason}`}>{t(ATTENTION_LABEL[reason])}</span>
                            <span className="lh-attn__title">{task.title}</span>
                            <span className="lh-attn__meta">
                                {PROJECT_LABEL[task.project]} · {formatCardDate(task.clientOn, locale)}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
            {rest > 0 && !focus ? (
                <button type="button" className="lh-attn__more" onClick={onToggleFocus}>
                    {t('legalHub.myTasksAttentionMore').replace('{count}', String(rest))}
                </button>
            ) : null}
        </section>
    );
}

function StatButton({ label, value, tone, pressed, onClick }: {
    label: string;
    value: number;
    tone: string;
    pressed: boolean;
    onClick: () => void;
}) {
    return (
        <li>
            <button type="button" className={`lh-stat lh-stat--${tone}${pressed ? ' is-selected' : ''}`} aria-pressed={pressed} onClick={onClick}>
                <span className="lh-stat__body">
                    <strong className="lh-stat__value">{value}</strong>
                    <span className="lh-stat__label">{label}</span>
                </span>
            </button>
        </li>
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

const CARD_MONTHS: Record<string, string[]> = {
    ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

function formatDay(iso: string, locale: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
        day: 'numeric',
        month: 'short',
    });
}

function formatCardDate(iso: string, locale: string): string {
    const [, month, day] = iso.split('-').map(Number);
    const names = CARD_MONTHS[locale] ?? CARD_MONTHS.en!;
    return `${day ?? ''} ${names[(month ?? 1) - 1] ?? ''}`.trim();
}

function waitingName(task: MineTask): string | null {
    if (task.status === 'todo' || task.status === 'progress' || task.status === 'changes')
        return null;
    if (task.waitingFor)
        return task.waitingFor;
    return task.reviewer ? PERSON_LABEL[task.reviewer].name : null;
}

function ProjectGroup({ id, open, rows, pool, onToggle, onOpen }: {
    id: TaskProjectId;
    open: boolean;
    rows: MineTask[];
    pool: MineTask[];
    onToggle: () => void;
    onOpen: (id: string) => void;
}) {
    const { t } = useI18n();
    const done = pool.filter((task) => task.done).length;
    const progress = t('legalHub.myTasksProgress').replace('{done}', String(done)).replace('{total}', String(pool.length));
    const count = t(taskCountKey(rows.length)).replace('{count}', String(rows.length));
    const width = pool.length === 0 ? 0 : Math.round((done / pool.length) * 100);
    return (
        <section className="lh-my__group">
            <button type="button" className="lh-my__group-head" aria-expanded={open} onClick={onToggle}>
                <span className="lh-my__group-title">
                    <ChevronIcon open={open} />
                    <span className={`lh-tasks__project lh-tasks__project--${id}`}>
                        <FolderIcon />
                        <span>{BOARD_TITLE[id]}</span>
                    </span>
                    <span className="lh-my__meter">
                        <span>{progress}</span>
                        <span className="lh-my__meter-track" aria-hidden>
                            <span style={{ width: `${width}%` }} />
                        </span>
                    </span>
                </span>
                <span>{count}</span>
            </button>
            {open ? (
                <table className="lh-my__table">
                    <thead>
                        <tr>
                            <th>{t('legalHub.taskColTitle')}</th>
                            <th>{t('legalHub.taskColStatus')}</th>
                            <th>{t('legalHub.taskColPriority')}</th>
                            <th>{t('legalHub.taskFieldInternal')}</th>
                            <th>{t('legalHub.taskColClient')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((task) => (
                            <ProjectRow key={task.id} task={task} onOpen={() => onOpen(task.id)} />
                        ))}
                    </tbody>
                </table>
            ) : null}
        </section>
    );
}

function ProjectRow({ task, onOpen }: { task: MineTask; onOpen: () => void }) {
    const { t, locale } = useI18n();
    const waiting = waitingName(task);
    const follow = task.followUpOn;
    const followLate = follow != null && dayDelta(follow) < 0;
    const followLabel = follow == null
        ? null
        : followLate
            ? t('legalHub.myTasksFollowDue')
            : t('legalHub.myTasksFollowOn').replace('{date}', formatDay(follow, locale));
    return (
        <tr
            className={`${task.done ? 'is-done' : ''}${isOverdue(task) ? ' is-late' : ''}`}
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.key === 'Enter')
                    onOpen();
            }}
        >
            <td>
                <span className="lh-my__stream">
                    {task.workstream}
                    {task.important ? <span className="lh-my__important">{t('legalHub.myTasksImportant')}</span> : null}
                    {isOverdue(task) ? <span className="lh-my__late">{t('legalHub.myTasksLate')}</span> : null}
                </span>
                <span className="lh-tasks__title">{task.title}</span>
            </td>
            <td>
                <span className="lh-my__status">
                    <span className={`lh-tasks__pill lh-tasks__pill--${task.status}`}>{t(STATUS_LABEL[task.status])}</span>
                    {waiting ? <span className="lh-my__sub">{t('legalHub.myTasksWaitingFor').replace('{name}', waiting)}</span> : null}
                    {followLabel ? <span className={`lh-my__sub${followLate ? ' is-hot' : ''}`}>{followLabel}</span> : null}
                </span>
            </td>
            <td>
                <span className={`lh-tasks__pill lh-tasks__pill--priority-${task.priority}`}>{t(PRIORITY_LABEL[task.priority])}</span>
            </td>
            <td><Deadline iso={task.internalOn} /></td>
            <td><Deadline iso={task.clientOn} /></td>
        </tr>
    );
}

function Deadline({ iso }: { iso: string }) {
    const { t, locale } = useI18n();
    const delta = dayDelta(iso);
    const tone = delta <= 0 ? 'hot' : delta <= 2 ? 'soon' : 'calm';
    const hint = delta < 0
        ? t('legalHub.taskOverdue').replace('{count}', String(-delta))
        : delta === 0
            ? t('legalHub.taskToday')
            : t('legalHub.taskDaysLeft').replace('{count}', String(delta));
    return (
        <span className="lh-tasks__date">
            <span>{formatDay(iso, locale)}</span>
            <span className={`lh-tasks__delta lh-tasks__delta--${tone}`}>{hint}</span>
        </span>
    );
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg className={`lh-my__chevron${open ? ' is-open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
function TaskCard({ task, draggable, onDragStart, onDragEnd, onOpen }: {
    task: MineTask;
    draggable: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    onOpen: () => void;
}) {
    const { t, locale } = useI18n();
    const dragged = useRef(false);
    const person = PERSON_LABEL[task.owner];
    const clientLate = !task.done && dayDelta(task.clientOn) < 0;
    return (
        <li
            className={`lh-my__card${draggable ? '' : ' is-locked'}${clientLate ? ' is-late' : ''}${task.done ? ' is-done' : ''}`}
            title={draggable ? undefined : t('legalHub.myTasksLocked')}
            draggable={draggable}
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
        >
            <strong>{task.title}</strong>
            <span className="lh-my__card-meta">{PROJECT_LABEL[task.project]} · {task.workstream}</span>
            {task.done ? null : <DueBadge iso={task.clientOn} className="lh-my__card-due" />}
            <span className="lh-my__card-foot">
                {task.priority === 'normal' ? <span /> : (
                    <span className={`lh-my__prio lh-my__prio--${task.priority}`}>
                        <i aria-hidden />
                        {t(PRIORITY_LABEL[task.priority])}
                    </span>
                )}
                <span className="lh-my__card-end">
                    <span className={clientLate ? 'is-late' : ''}>{formatCardDate(task.clientOn, locale)}</span>
                    <span className={`lh-tasks__avatar lh-tasks__avatar--${task.owner}`} title={person.name}>{person.code}</span>
                </span>
            </span>
        </li>
    );
}

function FilterSelect({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: { id: string; label: string }[];
    onChange: (id: string) => void;
}) {
    const { t } = useI18n();
    const items = useMemo(() => [{ id: '', label: t('legalHub.taskFilterAll') }, ...options], [options, t]);
    return (
        <label className={`lh-my__filter${value ? ' is-set' : ''}`}>
            <span>{label}</span>
            <SearchableSelect
                portalDropdown
                portalZIndex={40}
                buttonClassName="lh-tasks__pick"
                placeholder={t('legalHub.taskFilterAll')}
                emptyListText={t('legalHub.taskFilterAll')}
                noMatchText={t('legalHub.teamNoMatch')}
                aria-label={label}
                value={value}
                items={items}
                getOptionValue={(item) => item.id}
                getOptionLabel={(item) => item.label}
                getSearchText={(item) => item.label}
                onSelect={(item) => onChange(item.id)}
            />
        </label>
    );
}

function FolderIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10z" />
        </svg>
    );
}

function NewTaskDialog({ onClose, onCreate }: {
    onClose: () => void;
    onCreate: (task: MineTask) => void;
}) {
    const { t } = useI18n();
    const [title, setTitle] = useState('');
    const [project, setProject] = useState<TaskProjectId>('solar');
    const [workstream, setWorkstream] = useState('Land / LLA');
    const [internalOn, setInternalOn] = useState('2026-11-01');
    const [clientOn, setClientOn] = useState('2026-11-04');
    const [priority, setPriority] = useState<TaskPriorityId>('normal');
    const [owner, setOwner] = useState<TaskPersonId>('ja1');
    const [hours, setHours] = useState('4');
    const [minutes, setMinutes] = useState('60');
    const [approval, setApproval] = useState(false);
    const [instructions, setInstructions] = useState('');
    const [error, setError] = useState('');
    const projects = TASK_PROJECTS.map((id) => ({ id, label: PROJECT_LABEL[id] }));
    const people = TASK_PEOPLE.map((id) => ({ id, label: PERSON_LABEL[id].name }));
    const priorities = TASK_PRIORITIES.map((id) => ({ id, label: t(PRIORITY_LABEL[id]) }));

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
            minutes: Number(minutes) || 0,
            done: false,
            hours: Number(hours) || 0,
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
                    <button type="button" className="lh-drawer__close" aria-label={t('legalHub.taskDrawerClose')} onClick={onClose}>×</button>
                </header>
                <label className="lh-drawer__field">
                    <span>{t('legalHub.myTasksTitle')}</span>
                    <input className="lh-drawer__input" value={title} placeholder={t('legalHub.myTasksTitlePh')} onChange={(event) => setTitle(event.target.value)} />
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
                    <label className="lh-drawer__field">
                        <span>{t('legalHub.myTasksHours')}</span>
                        <input className="lh-drawer__input" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value.replace(/[^\d]/g, '').slice(0, 3))} />
                    </label>
                    <label className="lh-drawer__field">
                        <span>{t('legalHub.taskFieldMinutes')}</span>
                        <input className="lh-drawer__input" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value.replace(/[^\d]/g, '').slice(0, 4))} />
                    </label>
                </div>
                <label className="lh-my__check">
                    <input type="checkbox" checked={approval} onChange={(event) => setApproval(event.target.checked)} />
                    {t('legalHub.myTasksApproval')}
                </label>
                <label className="lh-drawer__field lh-drawer__field--stack">
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
