import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { DatePicker, SearchableSelect } from '@shared/ui';
import { LegalHubTaskDrawer } from './LegalHubTaskDrawer';
import { DueBadge, HeadActions } from './legalHubShared';
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
    const [dragging, setDragging] = useState<string | null>(null);
    const [composer, setComposer] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);
    const needle = query.trim().toLowerCase();
    const openTask = tasks.find((task) => task.id === openId) ?? null;

    const visible = useMemo(() => tasks.filter((task) => {
        if (task.done)
            return false;
        if (!needle)
            return true;
        const owner = PERSON_LABEL[task.owner].name;
        const reviewer = task.reviewer ? PERSON_LABEL[task.reviewer].name : '';
        return `${task.title} ${PROJECT_LABEL[task.project]} ${task.workstream} ${owner} ${reviewer}`.toLowerCase().includes(needle);
    }), [needle, tasks]);

    const moveTask = (id: string, column: BoardColumn) => {
        setTasks((current) => current.map((task) => (
            task.id === id ? { ...task, status: column } : task
        )));
        setDragging(null);
    };

    return (
        <div className="lh-my">
            <HeadActions>
                <button type="button" className="lh-temp__open lh-primary" onClick={() => setComposer(true)}>
                    <span aria-hidden>+</span>
                    {t('legalHub.myTasksNew')}
                </button>
            </HeadActions>
            {visible.length === 0 ? (
                <div className="lh-empty">
                    <p>{t('legalHub.myTasksEmpty')}</p>
                </div>
            ) : (
                <div className="lh-my__board">
                    {COLUMNS.map((column) => (
                        <BoardColumnView
                            key={column}
                            title={t(COLUMN_LABEL[column])}
                            cards={visible.filter((task) => columnOf(task.status) === column)}
                            droppable={DROPPABLE.includes(column)}
                            dragging={dragging}
                            onMove={(id) => moveTask(id, column)}
                            onDragStart={setDragging}
                            onDragEnd={() => setDragging(null)}
                            onOpen={setOpenId}
                        />
                    ))}
                </div>
            )}
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

function BoardColumnView({ title, cards, droppable, dragging, onMove, onDragStart, onDragEnd, onOpen }: {
    title: string;
    cards: MineTask[];
    droppable: boolean;
    dragging: string | null;
    onMove: (id: string) => void;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
    onOpen: (id: string) => void;
}) {
    const { t } = useI18n();
    return (
        <section
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
                onMove(dragging);
            }}
        >
            <header>
                <span className="lh-my__col-title">
                    <strong>{title}</strong>
                    <em>{cards.length}</em>
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
        </section>
    );
}

function TaskCard({ task, draggable, onDragStart, onDragEnd, onOpen }: {
    task: MineTask;
    draggable: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    onOpen: () => void;
}) {
    const { t } = useI18n();
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
            <span className="lh-my__card-foot">
                {task.done ? <span /> : <DueBadge iso={task.clientOn} className="lh-my__card-due" />}
                <span className={`lh-tasks__avatar lh-tasks__avatar--${task.owner}`} title={person.name}>{person.code}</span>
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
