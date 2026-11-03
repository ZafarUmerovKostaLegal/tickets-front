import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { LegalHubTaskDrawer } from './LegalHubTaskDrawer';
import {
    HUB_TASKS,
    PERSON_LABEL,
    PROJECT_LABEL,
    TASK_PROJECTS,
    type HubTask,
    type TaskPriorityId,
    type TaskProjectId,
    type TaskStatusId,
} from './legalHubTasks';

type BoardColumn = 'todo' | 'progress' | 'wait' | 'associate' | 'partner' | 'changes';

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

const PRIORITY_LABEL: Record<TaskPriorityId, TranslationKey> = {
    high: 'legalHub.taskPriorityHigh',
    normal: 'legalHub.taskPriorityNormal',
    low: 'legalHub.taskPriorityLow',
};

const PROJECT_TITLE: Record<TaskProjectId, string> = {
    solar: 'Project A — Solar',
    wind: 'Project B — Wind',
    healthcare: 'Project E — Healthcare',
    infrastructure: 'Project C — Infrastructure',
    bess: 'Project D — BESS',
};

const CARD_MONTHS: Record<string, string[]> = {
    ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
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

export function LegalHubProjects({
    query,
    source,
}: {
    query: string;
    source?: HubTask[] | null;
}) {
    const { t } = useI18n();
    const [tasks, setTasks] = useState<HubTask[]>(() => [...(source ?? HUB_TASKS)]);
    const [selected, setSelected] = useState<TaskProjectId>(() => TASK_PROJECTS[0]!);
    const [openId, setOpenId] = useState<string | null>(null);
    const [dragging, setDragging] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<BoardColumn[]>([]);

    useEffect(() => {
        setTasks([...(source ?? HUB_TASKS)]);
    }, [source]);

    const needle = query.trim().toLowerCase();
    const projectTabs = useMemo(() => TASK_PROJECTS.map((id) => {
        const count = tasks.filter((task) => task.project === id).length;
        return { id, title: PROJECT_TITLE[id], label: PROJECT_LABEL[id], count };
    }), [tasks]);

    const boardTasks = useMemo(() => {
        const scoped = tasks.filter((task) => task.project === selected);
        if (!needle)
            return scoped;
        return scoped.filter((task) => {
            const hay = `${task.title} ${task.workstream} ${PERSON_LABEL[task.owner].name} ${task.reviewer ? PERSON_LABEL[task.reviewer].name : ''}`.toLowerCase();
            return hay.includes(needle);
        });
    }, [needle, selected, tasks]);

    const openTask = tasks.find((task) => task.id === openId) ?? null;
    const totals = {
        open: boardTasks.length,
        review: boardTasks.filter(isReview).length,
        overdue: boardTasks.filter(isOverdue).length,
    };

    const moveTask = (taskId: string, column: BoardColumn) => {
        setTasks((current) => current.map((task) => (
            task.id === taskId ? { ...task, status: column } : task
        )));
        setDragging(null);
    };

    return (
        <div className="lh-projects">
            <p className="lh-projects__hint">{t('legalHub.projectsHint')}</p>
            <div className="lh-projects__tabs" role="tablist" aria-label={t('legalHub.projects')}>
                {projectTabs.map((tab) => {
                    const active = tab.id === selected;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`lh-projects__tab${active ? ' is-active' : ''}${tab.count === 0 ? ' is-empty' : ''}`}
                            onClick={() => {
                                setSelected(tab.id);
                                setDragging(null);
                            }}
                        >
                            <strong>{tab.title}</strong>
                            <em>{tab.count}</em>
                        </button>
                    );
                })}
            </div>

            <header className="lh-projects__board-head">
                <div>
                    <h2 className="lh-projects__board-title">{PROJECT_TITLE[selected]}</h2>
                    <p className="lh-projects__board-sub">{PROJECT_LABEL[selected]} · {t('legalHub.projectsBoard')}</p>
                </div>
                <ul className="lh-projects__board-stats">
                    <li><strong>{totals.open}</strong><span>{t('legalHub.projectsOpenTasks')}</span></li>
                    <li><strong>{totals.review}</strong><span>{t('legalHub.projectsInReview')}</span></li>
                    <li className={totals.overdue > 0 ? 'is-due' : undefined}><strong>{totals.overdue}</strong><span>{t('legalHub.projectsOverdue')}</span></li>
                </ul>
            </header>

            {boardTasks.length === 0 && !needle ? (
                <p className="lh-projects__empty">{t('legalHub.projectsBoardEmpty')}</p>
            ) : boardTasks.length === 0 ? (
                <p className="lh-projects__empty">{t('legalHub.projectsEmpty')}</p>
            ) : (
                <div className="lh-projects__board lh-my__board is-wide">
                    {COLUMNS.map((column) => {
                        const cards = boardTasks.filter((task) => columnOf(task.status) === column);
                        const folded = collapsed.includes(column);
                        return (
                            <BoardColumnView
                                key={column}
                                title={t(COLUMN_LABEL[column])}
                                cards={cards}
                                collapsed={folded}
                                droppable={DROPPABLE.includes(column)}
                                dragging={dragging}
                                onToggle={() => setCollapsed((current) => (
                                    current.includes(column)
                                        ? current.filter((id) => id !== column)
                                        : [...current, column]
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

            {openTask ? <LegalHubTaskDrawer key={openTask.id} task={openTask} owner={null} onClose={() => setOpenId(null)} /> : null}
        </div>
    );
}

function BoardColumnView({
    title,
    cards,
    collapsed,
    droppable,
    dragging,
    onToggle,
    onDragStart,
    onDragEnd,
    onMove,
    onOpen,
}: {
    title: string;
    cards: HubTask[];
    collapsed: boolean;
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
                    <button type="button" className="lh-my__col-fold" aria-label={foldLabel} aria-expanded={!collapsed} tabIndex={collapsed ? -1 : 0} onClick={onToggle}>
                        <CollapseIcon />
                    </button>
                </span>
            </header>
            {cards.length === 0 ? <p>{t('legalHub.myTasksDrop')}</p> : (
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
            className={`lh-my__card${draggable ? '' : ' is-locked'}`}
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

function CollapseIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M10 8l-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 8l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
