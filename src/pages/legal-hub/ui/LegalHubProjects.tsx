import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { LegalHubMyTasks, columnOf as docketColumn, mineFrom, type MineTask } from './LegalHubMyTasks';
import { LegalHubTaskDrawer } from './LegalHubTaskDrawer';
import { dueText, DueBadge, dayDelta as sharedDelta } from './legalHubShared';
import {
    HUB_TASKS,
    PROJECT_LABEL,
    PROJECT_TITLE,
    TASK_PROJECTS,
    type HubTask,
    type TaskProjectId,
    type TaskStatusId,
} from './legalHubTasks';

type BoardColumn = 'todo' | 'progress' | 'wait' | 'associate' | 'partner' | 'changes';
type Health = 'risk' | 'changes' | 'review' | 'wait' | 'active' | 'empty';

const COLUMNS: BoardColumn[] = ['todo', 'progress', 'wait', 'associate', 'partner', 'changes'];

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

const HEALTH_ORDER: Health[] = ['risk', 'changes', 'review', 'wait', 'active', 'empty'];

const MATTER_META: Record<TaskProjectId, { client: string; no: string }> = {
    solar: { client: 'SunGrid Energy', no: 'M-2026-014' },
    wind: { client: 'Aral Wind Power', no: 'M-2026-021' },
    infrastructure: { client: 'TransCaspian Roads', no: 'M-2026-009' },
    bess: { client: 'VoltStore Central Asia', no: 'M-2026-030' },
    healthcare: { client: 'MedLine Clinics', no: 'M-2026-017' },
};

const MAP_COLUMNS = ['todo', 'progress', 'waitClient', 'waitGov', 'associate', 'partner', 'changes', 'done'] as const;

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
    createSignal = 0,
}: {
    query: string;
    source?: HubTask[] | null;
    selected: TaskProjectId | null;
    onSelect: (id: TaskProjectId | null) => void;
    createSignal?: number;
}) {
    const { t, locale } = useI18n();
    const [tasks, setTasks] = useState<MineTask[]>(() => mineFrom(source ?? HUB_TASKS));
    const [healthFilter, setHealthFilter] = useState<Health | ''>('');
    const [openId, setOpenId] = useState<string | null>(null);
    const [matterView, setMatterView] = useState<'board' | 'map'>('board');
    const seenCreate = useRef(createSignal);

    useEffect(() => {
        setTasks(mineFrom(source ?? HUB_TASKS));
    }, [source]);

    useEffect(() => {
        if (createSignal === seenCreate.current)
            return;
        seenCreate.current = createSignal;
        setMatterView('board');
    }, [createSignal]);

    useEffect(() => {
        setMatterView('board');
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
    const openTask = tasks.find((task) => task.id === openId) ?? null;

    const matter = current == null ? null : MATTER_META[current.id];
    const doneCount = current == null ? 0 : (current.tasks as MineTask[]).filter((task) => task.done).length;

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
                <div className="lh-matter">
                    <div className="lh-matter__bar">
                        <div className="lh-seg" role="tablist" aria-label={t('legalHub.viewAria')}>
                            <button type="button" role="tab" aria-selected={matterView === 'board'} className={matterView === 'board' ? 'is-on' : ''} onClick={() => setMatterView('board')}>
                                {t('legalHub.viewBoard')}
                            </button>
                            <button type="button" role="tab" aria-selected={matterView === 'map'} className={matterView === 'map' ? 'is-on' : ''} onClick={() => setMatterView('map')}>
                                {t('legalHub.viewMap')}
                            </button>
                        </div>
                        <span className="lh-matter__progress">
                            <span>{t('legalHub.matterApproved').replace('{done}', String(doneCount)).replace('{total}', String(current.tasks.length))}</span>
                            <i><b style={{ width: `${current.tasks.length ? Math.round(doneCount / current.tasks.length * 100) : 0}%` }} /></i>
                        </span>
                        {matter ? <span className="lh-matter__meta">{matter.client} · {matter.no} · {t('legalHub.matterPrivate')}</span> : null}
                    </div>
                    <div className={matterView === 'board' ? undefined : 'lh-matter__pane-off'}>
                        <LegalHubMyTasks
                            layout="board"
                            project={current.id}
                            query={query}
                            tasks={tasks}
                            onTasks={setTasks}
                            createSignal={createSignal}
                        />
                    </div>
                    {matterView === 'map' ? <MatterMap tasks={current.tasks} onOpen={setOpenId} /> : null}
                </div>
            )}
            {openTask ? <LegalHubTaskDrawer key={openTask.id} task={openTask} owner={null} onClose={() => setOpenId(null)} /> : null}
        </div>
    );
}

function MatterMap({ tasks, onOpen }: { tasks: HubTask[]; onOpen: (id: string) => void }) {
    const { t, locale } = useI18n();
    const rows = tasks as MineTask[];
    const open = rows.filter((task) => !task.done);
    const count = (column: (typeof MAP_COLUMNS)[number]) => rows.filter((task) => docketColumn(task) === column).length;
    const late = open.filter((task) => sharedDelta(task.clientOn) < 0);
    const review = rows.filter((task) => task.status === 'associate' || task.status === 'partner').length;
    const hours = open.reduce((sum, task) => sum + (task.hours || Math.round(task.minutes / 60) || 0), 0);
    const streams = [...new Set(rows.map((task) => task.workstream))];
    const groups: { title: string; tone: string; match: (delta: number) => boolean }[] = [
        { title: t('legalHub.dlLate'), tone: 'late', match: (delta) => delta < 0 },
        { title: t('legalHub.dlSoon'), tone: '', match: (delta) => delta >= 0 && delta <= 1 },
        { title: t('legalHub.dlWeek'), tone: '', match: (delta) => delta >= 2 && delta <= 7 },
        { title: t('legalHub.dlLater'), tone: '', match: (delta) => delta > 7 },
    ];
    return (
        <div className="lh-map">
            <ul className="lh-map__kpis">
                <li><strong>{open.length}</strong><span>{t('legalHub.mapOpen')}</span><small>{t('legalHub.myTasksHoursShort').replace('{count}', String(hours))}</small></li>
                <li><strong>{count('todo') + count('progress') + count('changes')}</strong><span>{t('legalHub.mapLawyers')}</span></li>
                <li><strong>{review}</strong><span>{t('legalHub.mapReview')}</span></li>
                <li><strong>{count('waitClient') + count('waitGov')}</strong><span>{t('legalHub.mapWaiting')}</span></li>
                <li className={late.length ? 'is-late' : ''}><strong>{late.length}</strong><span>{t('legalHub.mapLate')}</span></li>
                <li className="is-ok"><strong>{rows.length ? Math.round((rows.length - open.length) / rows.length * 100) : 0}%</strong><span>{t('legalHub.mapApproved')}</span></li>
            </ul>
            <section>
                <h2>{t('legalHub.mapWhere')}</h2>
                <p>{t('legalHub.mapWhereLead')}</p>
                <ol className="lh-map__pipe">
                    {MAP_COLUMNS.map((column) => (
                        <li key={column} className={count(column) ? 'is-live' : ''}>
                            <strong>{count(column)}</strong>
                            <span>{t(MAP_LABEL[column])}</span>
                        </li>
                    ))}
                </ol>
            </section>
            <section>
                <h2>{t('legalHub.mapStreams')}</h2>
                <div className="lh-map__scroll">
                    <table className="lh-map__matrix">
                        <thead>
                            <tr>
                                <th>{t('legalHub.taskColWorkstream')}</th>
                                {MAP_COLUMNS.map((column) => <th key={column}>{t(MAP_LABEL[column])}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {streams.map((stream) => (
                                <tr key={stream}>
                                    <td>{stream}</td>
                                    {MAP_COLUMNS.map((column) => {
                                        const cards = rows.filter((task) => task.workstream === stream && docketColumn(task) === column);
                                        return (
                                            <td key={column}>
                                                {cards.length === 0 ? '—' : cards.map((task) => (
                                                    <button key={task.id} type="button" className={sharedDelta(task.clientOn) < 0 && !task.done ? 'is-late' : ''} onClick={() => onOpen(task.id)}>
                                                        {task.title}
                                                    </button>
                                                ))}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
            <section>
                <h2>{t('legalHub.mapDeadlines')}</h2>
                {groups.map((group) => {
                    const items = open.filter((task) => group.match(sharedDelta(task.clientOn))).sort((a, b) => a.clientOn.localeCompare(b.clientOn));
                    if (items.length === 0)
                        return null;
                    return (
                        <div key={group.title} className="lh-map__group">
                            <h3 className={group.tone ? `is-${group.tone}` : ''}>{group.title} · {items.length}</h3>
                            {items.map((task) => (
                                <button key={task.id} type="button" className="lh-map__deadline" onClick={() => onOpen(task.id)}>
                                    <span>{formatCardDate(task.clientOn, locale)}</span>
                                    <strong>{task.title}</strong>
                                    <em>{t(MAP_LABEL[docketColumn(task)])}</em>
                                    <span className={`lh-my__duepill${sharedDelta(task.clientOn) < 0 ? ' is-late' : ''}`}>{dueText(sharedDelta(task.clientOn), t)}</span>
                                </button>
                            ))}
                        </div>
                    );
                })}
            </section>
        </div>
    );
}

const MAP_LABEL: Record<(typeof MAP_COLUMNS)[number], TranslationKey> = {
    todo: 'legalHub.taskStatusTodo',
    progress: 'legalHub.statusInProgress',
    waitClient: 'legalHub.myTasksWaitClient',
    waitGov: 'legalHub.myTasksWaitGov',
    associate: 'legalHub.taskStatusAssociate',
    partner: 'legalHub.taskStagePartner',
    changes: 'legalHub.statusChanges',
    done: 'legalHub.matterDoneCol',
};

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

function ForwardIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 6 6 6-6 6" />
        </svg>
    );
}

