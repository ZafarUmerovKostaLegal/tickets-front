import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { DatePicker, SearchableSelect } from '@shared/ui';
import {
    HUB_TASKS,
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
};

const COLUMNS: BoardColumn[] = ['todo', 'progress', 'wait', 'associate', 'partner'];
const DROPPABLE: BoardColumn[] = ['todo', 'progress', 'wait'];

const COLUMN_LABEL: Record<BoardColumn, TranslationKey> = {
    todo: 'legalHub.taskStatusTodo',
    progress: 'legalHub.statusInProgress',
    wait: 'legalHub.statusWaiting',
    associate: 'legalHub.taskStatusAssociate',
    partner: 'legalHub.taskStatusPartner',
};

const COLUMN_DOT: Record<BoardColumn, string> = {
    todo: 'todo',
    progress: 'progress',
    wait: 'wait',
    associate: 'associate',
    partner: 'partner',
};

function dayDelta(iso: string): number {
    const [year, month, day] = iso.split('-').map(Number);
    const target = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function columnOf(status: TaskStatusId): BoardColumn {
    if (status === 'changes')
        return 'progress';
    if (status === 'todo' || status === 'progress' || status === 'wait' || status === 'associate' || status === 'partner')
        return status;
    return 'todo';
}

function seedTasks(): MineTask[] {
    return HUB_TASKS.map((task) => ({
        ...task,
        done: false,
        hours: 4,
        internalOn: task.reviewOn ?? task.clientOn,
        instructions: '',
        approval: task.priority === 'high',
    }));
}

export function LegalHubMyTasks({ query }: { query: string }) {
    const { t } = useI18n();
    const [tasks, setTasks] = useState<MineTask[]>(seedTasks);
    const [mode, setMode] = useState<'status' | 'project'>('status');
    const [project, setProject] = useState('');
    const [waiting, setWaiting] = useState('');
    const [priority, setPriority] = useState('');
    const [dates, setDates] = useState('');
    const [showDone, setShowDone] = useState(false);
    const [stat, setStat] = useState<'' | 'wait' | 'review' | 'changes' | 'due'>('');
    const [focus, setFocus] = useState(false);
    const [collapsed, setCollapsed] = useState<string[]>([]);
    const [dragging, setDragging] = useState<string | null>(null);
    const [composer, setComposer] = useState(false);
    const needle = query.trim().toLowerCase();

    const attention = useMemo(
        () => tasks.filter((task) => !task.done && (task.status === 'changes' || task.status === 'wait' || (task.reviewOn != null && dayDelta(task.reviewOn) < 0))),
        [tasks],
    );
    const visible = useMemo(() => tasks.filter((task) => {
        if (!showDone && task.done)
            return false;
        if (showDone && !task.done && stat === '' && !focus && !project && !waiting && !priority && !dates && !needle)
            return true;
        if (task.done && !showDone)
            return false;
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
        if (focus && !attention.some((item) => item.id === task.id))
            return false;
        if (!needle)
            return true;
        const owner = PERSON_LABEL[task.owner].name;
        const reviewer = task.reviewer ? PERSON_LABEL[task.reviewer].name : '';
        return `${task.title} ${PROJECT_LABEL[task.project]} ${task.workstream} ${owner} ${reviewer}`.toLowerCase().includes(needle);
    }), [attention, dates, focus, needle, priority, project, showDone, stat, tasks, waiting]);

    const activeCount = tasks.filter((task) => !task.done).length;
    const waitCount = tasks.filter((task) => task.status === 'wait' && !task.done).length;
    const reviewCount = tasks.filter((task) => (task.status === 'associate' || task.status === 'partner') && !task.done).length;
    const changesCount = tasks.filter((task) => task.status === 'changes' && !task.done).length;
    const dueCount = tasks.filter((task) => !task.done && dayDelta(task.clientOn) >= 0 && dayDelta(task.clientOn) <= 7).length;
    const filtersOn = Boolean(project || waiting || priority || dates || showDone || stat || focus);
    const projectOptions = TASK_PROJECTS.map((id) => ({ id, label: PROJECT_LABEL[id] }));
    const peopleOptions = TASK_PEOPLE.map((id) => ({ id, label: PERSON_LABEL[id].name }));
    const priorityOptions = TASK_PRIORITIES.map((id) => ({ id, label: t(id === 'high' ? 'legalHub.taskPriorityHigh' : 'legalHub.taskPriorityNormal') }));
    const dateOptions = [
        { id: 'overdue', label: t('legalHub.myTasksDatesOverdue') },
        { id: 'week', label: t('legalHub.myTasksDatesWeek') },
    ];
    const waitingOptions = [
        { id: 'none', label: t('legalHub.taskNoReviewer') },
        ...peopleOptions,
    ];

    const moveTask = (id: string, column: BoardColumn) => {
        setTasks((current) => current.map((task) => task.id === id ? { ...task, status: column } : task));
        setDragging(null);
    };

    return (
        <div className="lh-my">
            <div className="lh-my__toolbar">
                <p>{t('legalHub.myTasksHint')}</p>
                <button type="button" className="lh-temp__open" onClick={() => setComposer(true)}>
                    <span aria-hidden>+</span>
                    {t('legalHub.myTasksNew')}
                </button>
            </div>
            <ul className="lh-my__stats">
                <StatButton label={t('legalHub.statTasks')} value={activeCount} tone="accent" pressed={stat === ''} onClick={() => setStat('')} />
                <StatButton label={t('legalHub.statusWaiting')} value={waitCount} tone="wait" pressed={stat === 'wait'} onClick={() => setStat((current) => current === 'wait' ? '' : 'wait')} />
                <StatButton label={t('legalHub.statReview')} value={reviewCount} tone="review" pressed={stat === 'review'} onClick={() => setStat((current) => current === 'review' ? '' : 'review')} />
                <StatButton label={t('legalHub.statusChanges')} value={changesCount} tone="changes" pressed={stat === 'changes'} onClick={() => setStat((current) => current === 'changes' ? '' : 'changes')} />
                <StatButton label={t('legalHub.statDue')} value={dueCount} tone="due" pressed={stat === 'due'} onClick={() => setStat((current) => current === 'due' ? '' : 'due')} />
            </ul>
            {attention.length > 0 ? (
                <div className="lh-my__alert">
                    <strong>{t('legalHub.myTasksAttention').replace('{count}', String(attention.length))}</strong>
                    <span>{attention[0]?.title}</span>
                    <button type="button" className={focus ? 'is-on' : ''} onClick={() => setFocus((value) => !value)}>
                        {t('legalHub.myTasksFocus')}
                    </button>
                </div>
            ) : null}
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
                    {filtersOn ? (
                        <button
                            type="button"
                            className="lh-tasks__reset"
                            onClick={() => {
                                setProject('');
                                setWaiting('');
                                setPriority('');
                                setDates('');
                                setShowDone(false);
                                setStat('');
                                setFocus(false);
                            }}
                        >
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
            {visible.length === 0 ? <p className="lh-my__empty">{t('legalHub.myTasksEmpty')}</p> : null}
            {mode === 'status' && visible.length > 0 ? (
                <div className="lh-my__board">
                    {COLUMNS.map((column) => {
                        const cards = visible.filter((task) => columnOf(task.status) === column);
                        const droppable = DROPPABLE.includes(column);
                        return (
                            <section
                                key={column}
                                className={`lh-my__col${dragging && droppable ? ' is-target' : ''}`}
                                onDragOver={(event) => {
                                    if (!droppable || !dragging)
                                        return;
                                    event.preventDefault();
                                }}
                                onDrop={(event) => {
                                    if (!droppable || !dragging)
                                        return;
                                    event.preventDefault();
                                    moveTask(dragging, column);
                                }}
                            >
                                <header>
                                    <span className={`lh-tasks__pill lh-tasks__pill--${COLUMN_DOT[column]}`}>{t(COLUMN_LABEL[column])}</span>
                                    <span>{cards.length}</span>
                                </header>
                                {cards.length === 0 ? <p>{t('legalHub.myTasksDrop')}</p> : (
                                    <ul>
                                        {cards.map((task) => (
                                            <TaskCard
                                                key={task.id}
                                                task={task}
                                                draggable={droppable && task.status !== 'associate' && task.status !== 'partner'}
                                                onDragStart={() => setDragging(task.id)}
                                                onDragEnd={() => setDragging(null)}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>
            ) : null}
            {mode === 'project' && visible.length > 0 ? (
                <div className="lh-my__groups">
                    {TASK_PROJECTS.filter((id) => visible.some((task) => task.project === id)).map((id) => {
                        const open = !collapsed.includes(id);
                        const cards = visible.filter((task) => task.project === id);
                        return (
                            <section key={id} className="lh-my__group">
                                <button
                                    type="button"
                                    className="lh-my__group-head"
                                    aria-expanded={open}
                                    onClick={() => setCollapsed((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                                >
                                    <span className={`lh-tasks__project lh-tasks__project--${id}`}>
                                        <FolderIcon />
                                        <span>{PROJECT_LABEL[id]}</span>
                                    </span>
                                    <span>{cards.length}</span>
                                </button>
                                {open ? (
                                    <ul>
                                        {cards.map((task) => (
                                            <TaskCard key={task.id} task={task} draggable={false} onDragStart={() => undefined} onDragEnd={() => undefined} />
                                        ))}
                                    </ul>
                                ) : null}
                            </section>
                        );
                    })}
                </div>
            ) : null}
            {mode === 'status' ? <p className="lh-my__note">{t('legalHub.myTasksDragHint')}</p> : null}
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

function TaskCard({ task, draggable, onDragStart, onDragEnd }: {
    task: MineTask;
    draggable: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
}) {
    const { t } = useI18n();
    const person = PERSON_LABEL[task.owner];
    const late = dayDelta(task.clientOn) < 0;
    return (
        <li
            className={`lh-my__card${draggable ? '' : ' is-locked'}`}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
            <strong>{task.title}</strong>
            <span className="lh-my__card-meta">{PROJECT_LABEL[task.project]} · {task.workstream}</span>
            <span className="lh-my__card-foot">
                <span className={`lh-tasks__pill lh-tasks__pill--priority-${task.priority}`}>
                    {t(task.priority === 'high' ? 'legalHub.taskPriorityHigh' : 'legalHub.taskPriorityNormal')}
                </span>
                <span className={`lh-tasks__avatar lh-tasks__avatar--${task.owner}`} title={person.name}>{person.code}</span>
                <span className={late ? 'is-late' : ''}>{task.clientOn.slice(8)}.{task.clientOn.slice(5, 7)}</span>
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
    const priorities = TASK_PRIORITIES.map((id) => ({ id, label: t(id === 'high' ? 'legalHub.taskPriorityHigh' : 'legalHub.taskPriorityNormal') }));

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
