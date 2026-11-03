import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { LegalHubTaskDrawer } from './LegalHubTaskDrawer';
import { DueBadge } from './legalHubShared';
import {
    HUB_TASKS,
    PERSON_LABEL,
    PROJECT_LABEL,
    PROJECT_TITLE,
    TASK_PROJECTS,
    type HubTask,
    type TaskPriorityId,
    type TaskProjectId,
    type TaskStatusId,
} from './legalHubTasks';

type BoardColumn = 'todo' | 'progress' | 'wait' | 'associate' | 'partner' | 'changes';
type Health = 'risk' | 'changes' | 'review' | 'wait' | 'active' | 'empty';

const COLUMNS: BoardColumn[] = ['todo', 'progress', 'wait', 'associate', 'partner', 'changes'];
const DROPPABLE: BoardColumn[] = ['todo', 'progress', 'wait', 'changes'];

const COLUMN_LABEL: Record<BoardColumn, TranslationKey> = {
    todo: 'legalHub.taskStatusTodo',
    progress: 'legalHub.statusInProgress',
    wait: 'legalHub.statusWaiting',
    associate: 'legalHub.taskStatusAssociate',
    partner: 'legalHub.taskStatusPartner',
    changes: 'legalHub.statusChanges',
};

const HEALTH_LABEL: Record<Health, TranslationKey> = {
    risk: 'legalHub.projectsHealthRisk',
    changes: 'legalHub.projectsHealthChanges',
    review: 'legalHub.projectsHealthReview',
    wait: 'legalHub.projectsHealthWait',
    active: 'legalHub.projectsHealthActive',
    empty: 'legalHub.projectsHealthEmpty',
};

const PRIORITY_LABEL: Record<TaskPriorityId, TranslationKey> = {
    high: 'legalHub.taskPriorityHigh',
    normal: 'legalHub.taskPriorityNormal',
    low: 'legalHub.taskPriorityLow',
};

const HEALTH_ORDER: Health[] = ['risk', 'changes', 'review', 'wait', 'active', 'empty'];

const CARD_MONTHS: Record<string, string[]> = {
    ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

type ProjectSummary = {
    id: TaskProjectId;
    title: string;
    label: string;
    tasks: HubTask[];
    counts: Record<BoardColumn, number>;
    overdue: number;
    review: number;
    health: Health;
    next: HubTask | null;
    workstreams: { name: string; tasks: HubTask[] }[];
};

function dayDelta(iso: string): number {
    const [year, month, day] = iso.split('-').map(Number);
    const target = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function formatCardDate(iso: string, locale: string): string {
    const [, month, day] = iso.split('-').map(Number);
    const names = CARD_MONTHS[locale] ?? CARD_MONTHS.en!;
    return `${day ?? ''} ${names[(month ?? 1) - 1] ?? ''}`.trim();
}

function columnOf(status: TaskStatusId): BoardColumn {
    if (COLUMNS.includes(status as BoardColumn))
        return status as BoardColumn;
    return 'todo';
}

function isReview(task: HubTask): boolean {
    return task.status === 'associate' || task.status === 'partner' || task.status === 'changes';
}

function isOverdue(task: HubTask): boolean {
    return dayDelta(task.clientOn) < 0;
}

function healthOf(tasks: HubTask[]): Health {
    if (tasks.length === 0)
        return 'empty';
    if (tasks.some(isOverdue))
        return 'risk';
    if (tasks.some((task) => task.status === 'changes'))
        return 'changes';
    if (tasks.some((task) => task.status === 'associate' || task.status === 'partner'))
        return 'review';
    if (tasks.some((task) => task.status === 'wait'))
        return 'wait';
    return 'active';
}

function summarize(id: TaskProjectId, tasks: HubTask[]): ProjectSummary {
    const scoped = tasks.filter((task) => task.project === id);
    const counts = Object.fromEntries(COLUMNS.map((column) => [column, 0])) as Record<BoardColumn, number>;
    for (const task of scoped)
        counts[columnOf(task.status)] += 1;
    const byStream = new Map<string, HubTask[]>();
    for (const task of scoped) {
        const list = byStream.get(task.workstream) ?? [];
        list.push(task);
        byStream.set(task.workstream, list);
    }
    const next = [...scoped].sort((a, b) => a.clientOn.localeCompare(b.clientOn))[0] ?? null;
    return {
        id,
        title: PROJECT_TITLE[id],
        label: PROJECT_LABEL[id],
        tasks: scoped,
        counts,
        overdue: scoped.filter(isOverdue).length,
        review: scoped.filter(isReview).length,
        health: healthOf(scoped),
        next,
        workstreams: [...byStream.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], 'en'))
            .map(([name, streamTasks]) => ({
                name,
                tasks: [...streamTasks].sort((a, b) => COLUMNS.indexOf(columnOf(a.status)) - COLUMNS.indexOf(columnOf(b.status))),
            })),
    };
}

export function LegalHubProjects({
    query,
    source,
    selected,
    onSelect,
}: {
    query: string;
    source?: HubTask[] | null;
    selected: TaskProjectId | null;
    onSelect: (id: TaskProjectId | null) => void;
}) {
    const { t, locale } = useI18n();
    const [tasks, setTasks] = useState<HubTask[]>(() => [...(source ?? HUB_TASKS)]);
    const [healthFilter, setHealthFilter] = useState<Health | ''>('');
    const [focusColumn, setFocusColumn] = useState<BoardColumn | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<BoardColumn[]>([]);

    useEffect(() => {
        setTasks([...(source ?? HUB_TASKS)]);
    }, [source]);

    useEffect(() => {
        setFocusColumn(null);
        setDragging(null);
    }, [selected]);

    const needle = query.trim().toLowerCase();
    const projects = useMemo(() => TASK_PROJECTS
        .map((id) => summarize(id, tasks))
        .sort((a, b) => {
            const byHealth = HEALTH_ORDER.indexOf(a.health) - HEALTH_ORDER.indexOf(b.health);
            if (byHealth !== 0)
                return byHealth;
            return (a.next?.clientOn ?? '9999').localeCompare(b.next?.clientOn ?? '9999');
        }), [tasks]);
    const matched = useMemo(() => {
        if (!needle)
            return projects;
        return projects.filter((project) => {
            const hay = `${project.title} ${project.label} ${project.workstreams.map((stream) => stream.name).join(' ')} ${project.tasks.map((task) => task.title).join(' ')}`.toLowerCase();
            return hay.includes(needle);
        });
    }, [needle, projects]);
    const visible = healthFilter ? matched.filter((project) => project.health === healthFilter) : matched;
    const healthCounts = HEALTH_ORDER
        .map((health) => ({ health, count: matched.filter((project) => project.health === health).length }))
        .filter((row) => row.count > 0);
    const current = selected == null ? null : projects.find((project) => project.id === selected) ?? null;
    const boardTasks = useMemo(() => {
        if (current == null)
            return [];
        if (!needle)
            return current.tasks;
        return current.tasks.filter((task) => {
            const hay = `${task.title} ${task.workstream} ${PERSON_LABEL[task.owner].name} ${task.reviewer ? PERSON_LABEL[task.reviewer].name : ''}`.toLowerCase();
            return hay.includes(needle);
        });
    }, [current, needle]);
    const openTask = tasks.find((task) => task.id === openId) ?? null;

    const moveTask = (taskId: string, column: BoardColumn) => {
        setTasks((list) => list.map((task) => (task.id === taskId ? { ...task, status: column } : task)));
        setDragging(null);
    };

    return (
        <div className={`lh-projects${current ? ' lh-projects--workspace' : ''}`}>
            {current == null ? (
                <>
                    <div className="lh-projects__tools">
                        {healthCounts.length > 1 ? (
                            <div className="lh-chips" role="group" aria-label={t('legalHub.taskColStatus')}>
                                <button
                                    type="button"
                                    className={`lh-chip${healthFilter === '' ? ' is-on' : ''}`}
                                    aria-pressed={healthFilter === ''}
                                    onClick={() => setHealthFilter('')}
                                >
                                    {t('legalHub.projectsAll')}
                                    <em>{matched.length}</em>
                                </button>
                                {healthCounts.map((row) => (
                                    <button
                                        key={row.health}
                                        type="button"
                                        className={`lh-chip lh-chip--${row.health}${healthFilter === row.health ? ' is-on' : ''}`}
                                        aria-pressed={healthFilter === row.health}
                                        onClick={() => setHealthFilter((value) => (value === row.health ? '' : row.health))}
                                    >
                                        <i aria-hidden />
                                        {t(HEALTH_LABEL[row.health])}
                                        <em>{row.count}</em>
                                    </button>
                                ))}
                            </div>
                        ) : <span />}
                        <StageLegend />
                    </div>
                    {visible.length === 0 ? (
                        <p className="lh-projects__empty">{t('legalHub.projectsEmpty')}</p>
                    ) : (
                        <ul className="lh-projects__list">
                            {visible.map((project) => (
                                <li key={project.id}>
                                    <button type="button" className={`lh-projects__card is-${project.health}`} onClick={() => onSelect(project.id)}>
                                        <span className="lh-projects__card-top">
                                            <span className={`lh-projects__health is-${project.health}`}>{t(HEALTH_LABEL[project.health])}</span>
                                            <span className="lh-projects__card-count">{t('legalHub.projectsTaskCount').replace('{count}', String(project.tasks.length))}</span>
                                            <span className="lh-projects__card-go" aria-hidden><ForwardIcon /></span>
                                        </span>
                                        <strong className="lh-projects__card-title">{project.title}</strong>
                                        <StageBar counts={project.counts} />
                                        <span className="lh-projects__card-metrics">
                                            <span><strong>{project.review}</strong> {t('legalHub.projectsInReview').toLowerCase()}</span>
                                            <span className={project.overdue > 0 ? 'is-due' : ''}>
                                                <strong>{project.overdue}</strong> {t('legalHub.projectsOverdue').toLowerCase()}
                                            </span>
                                        </span>
                                        {project.next ? (
                                            <span className="lh-projects__card-next">
                                                <span className="lh-projects__card-next-date">
                                                    {formatCardDate(project.next.clientOn, locale)}
                                                    <DueBadge iso={project.next.clientOn} />
                                                </span>
                                                <span className="lh-projects__card-next-title">{project.next.title}</span>
                                            </span>
                                        ) : (
                                            <span className="lh-projects__card-next is-empty">{t('legalHub.projectsNoDeadline')}</span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            ) : (
                <div className="lh-projects__workspace">
                    <header className="lh-projects__board-head">
                        <div>
                            <span className={`lh-projects__health is-${current.health}`}>{t(HEALTH_LABEL[current.health])}</span>
                            <p className="lh-projects__board-sub">
                                {current.label}
                                {current.next
                                    ? ` · ${t('legalHub.projectsNext').replace('{date}', formatCardDate(current.next.clientOn, locale)).replace('{title}', current.next.title)}`
                                    : ''}
                            </p>
                        </div>
                        <ul className="lh-projects__board-stats">
                            <li><strong>{current.tasks.length}</strong><span>{t('legalHub.projectsOpenTasks')}</span></li>
                            <li><strong>{current.review}</strong><span>{t('legalHub.projectsInReview')}</span></li>
                            <li className={current.overdue > 0 ? 'is-due' : undefined}><strong>{current.overdue}</strong><span>{t('legalHub.projectsOverdue')}</span></li>
                        </ul>
                    </header>
                    <ProjectMap
                        project={current}
                        focus={focusColumn}
                        onFocus={(column) => setFocusColumn((currentColumn) => (currentColumn === column ? null : column))}
                        onOpenTask={setOpenId}
                    />
                    <h3 className="lh-projects__board-label">{t('legalHub.projectsBoard')}</h3>
                    {boardTasks.length === 0 ? (
                        <p className="lh-projects__empty">{needle ? t('legalHub.myTasksEmpty') : t('legalHub.projectsBoardEmpty')}</p>
                    ) : (
                        <div className="lh-projects__board lh-my__board is-wide">
                            {COLUMNS.map((column) => {
                                const cards = boardTasks.filter((task) => columnOf(task.status) === column);
                                const folded = collapsed.includes(column);
                                const dimmed = focusColumn != null && focusColumn !== column;
                                return (
                                    <BoardColumnView
                                        key={column}
                                        column={column}
                                        title={t(COLUMN_LABEL[column])}
                                        cards={cards}
                                        collapsed={folded}
                                        dimmed={dimmed}
                                        droppable={DROPPABLE.includes(column)}
                                        dragging={dragging}
                                        onToggle={() => setCollapsed((list) => (
                                            list.includes(column) ? list.filter((id) => id !== column) : [...list, column]
                                        ))}
                                        onDragStart={setDragging}
                                        onDragEnd={() => setDragging(null)}
                                        onMove={(taskId) => moveTask(taskId, column)}
                                        onOpen={setOpenId}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
            {openTask ? <LegalHubTaskDrawer key={openTask.id} task={openTask} owner={null} onClose={() => setOpenId(null)} /> : null}
        </div>
    );
}

function StageLegend() {
    const { t } = useI18n();
    return (
        <ul className="lh-legend" aria-label={t('legalHub.projectsMapHint')}>
            {COLUMNS.map((column) => (
                <li key={column}>
                    <i className={`lh-legend__dot is-${column}`} aria-hidden />
                    {t(COLUMN_LABEL[column])}
                </li>
            ))}
        </ul>
    );
}

function StageBar({ counts }: { counts: Record<BoardColumn, number> }) {
    const { t } = useI18n();
    const total = COLUMNS.reduce((sum, column) => sum + counts[column], 0);
    const summary = COLUMNS
        .filter((column) => counts[column] > 0)
        .map((column) => t('legalHub.projectsSegment').replace('{label}', t(COLUMN_LABEL[column])).replace('{count}', String(counts[column])))
        .join(' · ');
    return (
        <span className="lh-projects__bar" role="img" aria-label={summary || t('legalHub.projectsHealthEmpty')} title={summary}>
            {COLUMNS.filter((column) => total === 0 || counts[column] > 0).map((column) => (
                <span
                    key={column}
                    className={`lh-projects__bar-seg is-${column}${total === 0 ? ' is-empty' : ''}`}
                    style={{ flexGrow: total === 0 ? 1 : counts[column] }}
                />
            ))}
        </span>
    );
}

function ProjectMap({
    project,
    focus,
    onFocus,
    onOpenTask,
}: {
    project: ProjectSummary;
    focus: BoardColumn | null;
    onFocus: (column: BoardColumn) => void;
    onOpenTask: (id: string) => void;
}) {
    const { t } = useI18n();
    return (
        <section className="lh-projects__map" aria-label={t('legalHub.projectsMap')}>
            <header className="lh-projects__map-head">
                <div>
                    <h3>{t('legalHub.projectsMap')}</h3>
                    <p>{t('legalHub.projectsMapHint')}</p>
                </div>
            </header>
            <ol className="lh-projects__stages">
                {COLUMNS.map((column, index) => {
                    const count = project.counts[column];
                    const active = count > 0;
                    const selected = focus === column;
                    return (
                        <li key={column} className={`lh-projects__stage is-${column}${active ? ' is-live' : ''}${selected ? ' is-selected' : ''}`}>
                            {index > 0 ? <span className="lh-projects__stage-line" aria-hidden /> : null}
                            <button type="button" onClick={() => onFocus(column)} aria-pressed={selected}>
                                <strong>{count}</strong>
                                <span>{t(COLUMN_LABEL[column])}</span>
                            </button>
                        </li>
                    );
                })}
            </ol>
            {project.workstreams.length > 0 ? (
                <ul className="lh-projects__streams">
                    {project.workstreams.map((stream) => (
                        <li key={stream.name}>
                            <span className="lh-projects__stream-name">{stream.name}</span>
                            <span className="lh-projects__stream-tasks">
                                {stream.tasks.map((task) => (
                                    <button
                                        key={task.id}
                                        type="button"
                                        className={`lh-projects__chip is-${columnOf(task.status)}${isOverdue(task) ? ' is-late' : ''}`}
                                        onClick={() => onOpenTask(task.id)}
                                    >
                                        {task.title}
                                    </button>
                                ))}
                            </span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </section>
    );
}

function BoardColumnView({
    column,
    title,
    cards,
    collapsed,
    dimmed,
    droppable,
    dragging,
    onToggle,
    onDragStart,
    onDragEnd,
    onMove,
    onOpen,
}: {
    column: BoardColumn;
    title: string;
    cards: HubTask[];
    collapsed: boolean;
    dimmed: boolean;
    droppable: boolean;
    dragging: string | null;
    onToggle: () => void;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
    onMove: (id: string) => void;
    onOpen: (id: string) => void;
}) {
    const { t } = useI18n();
    const foldLabel = t(collapsed ? 'legalHub.myTasksColumnExpand' : 'legalHub.myTasksColumnCollapse');
    return (
        <section
            className={`lh-my__col lh-my__col--${column}${collapsed ? ' is-collapsed' : ''}${dimmed ? ' is-dimmed' : ''}${dragging && droppable ? ' is-target' : ''}`}
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
                    <button type="button" className="lh-my__col-fold" aria-label={foldLabel} aria-expanded={!collapsed} tabIndex={collapsed ? -1 : 0} onClick={onToggle}>
                        <CollapseIcon />
                    </button>
                </span>
            </header>
            {cards.length === 0 ? <p>{droppable ? t('legalHub.myTasksDrop') : t('legalHub.queueEmpty')}</p> : (
                <ul>
                    {cards.map((task) => (
                        <ProjectTaskCard
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

function ProjectTaskCard({
    task,
    draggable,
    onDragStart,
    onDragEnd,
    onOpen,
}: {
    task: HubTask;
    draggable: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    onOpen: () => void;
}) {
    const { t, locale } = useI18n();
    const dragged = useRef(false);
    const person = PERSON_LABEL[task.owner];
    const clientLate = dayDelta(task.clientOn) < 0;
    return (
        <li
            className={`lh-my__card${draggable ? '' : ' is-locked'}${clientLate ? ' is-late' : ''}`}
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
            <span className="lh-my__card-meta">{task.workstream}</span>
            <DueBadge iso={task.clientOn} className="lh-my__card-due" />
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

function ForwardIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 6 6 6-6 6" />
        </svg>
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
