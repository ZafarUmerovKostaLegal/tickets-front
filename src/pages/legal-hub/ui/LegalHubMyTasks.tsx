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
    taskDrawerDetail,
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

export function LegalHubMyTasks({
    query,
    source = null,
    layout = 'list',
    mode = 'mine',
    project = null,
    tasks: tasksProp,
    onTasks,
    createSignal = 0,
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
    const [dragging, setDragging] = useState<string | null>(null);
    const [composer, setComposer] = useState(false);
    const seenCreate = useRef(createSignal);
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

    const scoped = useMemo(() => tasks.filter((task) => project == null || task.project === project), [project, tasks]);
    const visible = useMemo(() => scoped.filter((task) => {
        if (mode === 'queue' && (task.done || (task.status !== 'associate' && task.status !== 'partner')))
            return false;
        if (layout === 'list' && task.done)
            return false;
        if (!needle)
            return true;
        const owner = PERSON_LABEL[task.owner].name;
        const reviewer = task.reviewer ? PERSON_LABEL[task.reviewer].name : '';
        return `${task.title} ${PROJECT_LABEL[task.project]} ${task.workstream} ${owner} ${reviewer}`.toLowerCase().includes(needle);
    }), [layout, mode, needle, scoped]);

    const moveTask = (id: string, column: BoardColumn) => {
        setTasks((current) => current.map((task) => {
            if (task.id !== id)
                return task;
            const waitingFor = column === 'waitClient'
                ? (isClientWait(task) ? task.waitingFor : 'Client')
                : column === 'waitGov'
                    ? (task.waitingFor && !isClientWait(task) ? task.waitingFor : task.waitingFor)
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
            project: 'solar',
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
        setAdding(null);
    };

    const listed = [...visible].sort((a, b) => a.clientOn.localeCompare(b.clientOn));

    if (layout === 'list') {
        const emptyTitle = mode === 'queue' ? t('legalHub.queueEmptyTitle') : t('legalHub.myTasksEmptyTitle');
        const emptyText = mode === 'queue' ? t('legalHub.queueEmptyText') : t('legalHub.myTasksEmptyText');
        return (
            <div className="lh-rows">
                {listed.length === 0 ? (
                    <div className="lh-rows__empty">
                        <strong>{emptyTitle}</strong>
                        <p>{emptyText}</p>
                    </div>
                ) : (
                    <>
                        <p className="lh-rows__intro">{t(mode === 'queue' ? 'legalHub.queueIntro' : 'legalHub.myTasksIntro')}</p>
                        <ul>
                            {listed.map((task) => {
                                const column = columnOf(task);
                                const owner = PERSON_LABEL[task.owner];
                                const reviewer = task.reviewer ? PERSON_LABEL[task.reviewer] : null;
                                const late = dayDelta(task.clientOn) < 0;
                                const soon = !late && dayDelta(task.clientOn) <= 1;
                                return (
                                    <li key={task.id}>
                                        <button type="button" className="lh-rows__item" onClick={() => setOpenId(task.id)}>
                                            <span className="lh-rows__text">
                                                <strong>{task.title}</strong>
                                                <small>
                                                    {PROJECT_TITLE[task.project]}
                                                    {' · '}
                                                    {owner.name}
                                                    {reviewer ? ` → ${reviewer.name}` : ''}
                                                </small>
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
                    </>
                )}
                {openTask ? (
                    <LegalHubTaskDrawer key={openTask.id} task={openTask} owner={null} onClose={() => setOpenId(null)} />
                ) : null}
            </div>
        );
    }

    if (mode === 'queue') {
        const dueColumns: { id: DueColumn; label: TranslationKey; hint: TranslationKey }[] = [
            { id: 'overdue', label: 'legalHub.queueDueOverdue', hint: 'legalHub.queueDueSubOverdue' },
            { id: 'today', label: 'legalHub.queueDueToday', hint: 'legalHub.queueDueSubToday' },
            { id: 'tomorrow', label: 'legalHub.queueDueTomorrow', hint: 'legalHub.queueDueSubTomorrow' },
            { id: 'week', label: 'legalHub.queueDueWeek', hint: 'legalHub.queueDueSubWeek' },
            { id: 'later', label: 'legalHub.queueDueLater', hint: 'legalHub.queueDueSubLater' },
        ];
        return (
            <div className="lh-my lh-my--docket">
                <div className="lh-my__board">
                    {dueColumns.map((column) => (
                        <BoardColumnView
                            key={column.id}
                            id={column.id}
                            title={t(column.label)}
                            hint={t(column.hint)}
                            review={false}
                            cards={visible
                                .filter((task) => dueColumnOf(task) === column.id)
                                .sort((a, b) => a.clientOn.localeCompare(b.clientOn))}
                            droppable={false}
                            dragging={null}
                            adding={false}
                            draft=""
                            onDraft={() => undefined}
                            onStartAdd={() => undefined}
                            onCancelAdd={() => undefined}
                            onAdd={() => undefined}
                            canAdd={false}
                            onMove={() => undefined}
                            onDragStart={() => undefined}
                            onDragEnd={() => undefined}
                            onOpen={setOpenId}
                        />
                    ))}
                </div>
                {openTask ? (
                    <LegalHubTaskDrawer key={openTask.id} task={openTask} owner={null} onClose={() => setOpenId(null)} />
                ) : null}
            </div>
        );
    }

    return (
        <div className="lh-my lh-my--docket">
            <div className="lh-my__board">
                {COLUMNS.map((column) => {
                    const cards = visible
                        .filter((task) => columnOf(task) === column)
                        .sort((a, b) => Number(dayDelta(b.clientOn) < 0) - Number(dayDelta(a.clientOn) < 0) || Number(b.priority === 'high') - Number(a.priority === 'high') || a.clientOn.localeCompare(b.clientOn));
                    const sub = COLUMN_SUB[column];
                    return (
                        <BoardColumnView
                            key={column}
                            id={column}
                            title={t(COLUMN_LABEL[column])}
                            hint={sub ? t(sub) : null}
                            review={LOCKED.includes(column)}
                            cards={cards}
                            droppable={DROPPABLE.includes(column)}
                            dragging={dragging}
                            adding={adding === column}
                            draft={draft}
                            onDraft={setDraft}
                            onStartAdd={() => {
                                setAdding(column);
                                setDraft('');
                            }}
                            onCancelAdd={() => {
                                setAdding(null);
                                setDraft('');
                            }}
                            onAdd={() => addCard(column)}
                            canAdd={project == null && QUICK_ADD.includes(column)}
                            onMove={(id) => moveTask(id, column)}
                            onDragStart={setDragging}
                            onDragEnd={() => setDragging(null)}
                            onOpen={setOpenId}
                        />
                    );
                })}
            </div>
            {openTask ? (
                <LegalHubTaskDrawer key={openTask.id} task={openTask} owner={null} onClose={() => setOpenId(null)} />
            ) : null}
            {composer ? (
                <NewTaskDialog
                    onClose={() => setComposer(false)}
                    onCreate={(draft) => {
                        setTasks((current) => [...current, draft]);
                        setComposer(false);
                    }}
                />
            ) : null}
        </div>
    );
}

function BoardColumnView({ id, title, hint, review, cards, droppable, dragging, adding, draft, onDraft, onStartAdd, onCancelAdd, onAdd, canAdd, onMove, onDragStart, onDragEnd, onOpen }: {
    id: string;
    title: string;
    hint: string | null;
    review: boolean;
    cards: MineTask[];
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
    return (
        <section
            className={`lh-my__col lh-my__col--${id}${dragging && droppable ? ' is-target' : ''}${dragging && !droppable ? ' is-locked-col' : ''}`}
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
                <span className="lh-my__col-title">
                    <strong>{title}</strong>
                    <em>{cards.length}</em>
                </span>
                {review ? (
                    <span className="lh-my__lock" title={hint ?? undefined}>
                        <LockIcon />
                    </span>
                ) : null}
            </header>
            {cards.length === 0 ? <p className="lh-my__empty">{droppable ? t('legalHub.myTasksDrop') : t('legalHub.myTasksColEmpty')}</p> : (
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

function TaskCard({ task, draggable, onDragStart, onDragEnd, onOpen }: {
    task: MineTask;
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
    const soon = !clientLate && dayDelta(task.clientOn) <= 1;
    const detail = taskDrawerDetail(task);
    const checksDone = detail.checks.filter((item) => item.done).length;
    const hours = task.hours || Math.max(1, Math.round(task.minutes / 60));
    const due = `${shortDate(task.clientOn, locale)} · ${dueText(dayDelta(task.clientOn), t)}`;
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
            <span className="lh-my__tags">
                {task.priority === 'high' ? <span className="lh-my__chip lh-my__chip--hot">{t('legalHub.myTasksUrgent')}</span> : null}
                <span className="lh-my__chip">{PROJECT_LABEL[task.project]}</span>
                {task.workstream && task.workstream !== '—' ? <span className="lh-my__chip lh-my__chip--soft">{task.workstream}</span> : null}
            </span>
            <strong>{task.title}</strong>
            {task.status === 'wait' && task.waitingFor ? (
                <span className="lh-my__wait">
                    {t(isClientWait(task) ? 'legalHub.myTasksWaitClientWho' : 'legalHub.myTasksWaitGovWho')}: {task.waitingFor}
                </span>
            ) : null}
            {(task.status === 'associate' || task.status === 'partner') && reviewer ? (
                <span className="lh-my__review">
                    <span className={`lh-tasks__avatar lh-tasks__avatar--${task.reviewer}`}>{reviewer.code}</span>
                    {t('legalHub.myTasksOnReview').replace('{name}', reviewer.name)}
                </span>
            ) : null}
            {task.status === 'changes' ? <span className="lh-my__review lh-my__review--back">{t('legalHub.myTasksSubChanges')}</span> : null}
            <span className="lh-my__facts">
                {detail.checks.length > 0 ? <span>{checksDone}/{detail.checks.length}</span> : null}
                {detail.files.length > 0 ? <span>{detail.files.length}</span> : null}
                {detail.comments.length > 0 ? <span>{detail.comments.length}</span> : null}
                <span>{t('legalHub.myTasksHoursShort').replace('{count}', String(hours))}</span>
            </span>
            <span className="lh-my__card-foot">
                <span className={`lh-my__duepill${clientLate ? ' is-late' : ''}${soon ? ' is-soon' : ''}`}>{due}</span>
                <span className="lh-my__pair">
                    <span className={`lh-tasks__avatar lh-tasks__avatar--${task.owner}`} title={owner.name}>{owner.code}</span>
                    {reviewer ? (
                        <>
                            <span className="lh-my__arrow" aria-hidden>→</span>
                            <span className={`lh-tasks__avatar lh-tasks__avatar--${task.reviewer}`} title={reviewer.name}>{reviewer.code}</span>
                        </>
                    ) : null}
                </span>
            </span>
        </li>
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
