import { useMemo, useState } from 'react';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { SearchableSelect } from '@shared/ui';
import { LegalHubTaskDrawer } from './LegalHubTaskDrawer';
import {
    HUB_TASKS,
    PERSON_LABEL,
    PROJECT_LABEL,
    TASK_PEOPLE,
    TASK_PRIORITIES,
    TASK_PROJECTS,
    TASK_STATUSES,
    type HubTask,
    type TaskPersonId,
    type TaskPriorityId,
    type TaskStatusId,
} from './legalHubTasks';

type SortKey = 'project' | 'title' | 'workstream' | 'owner' | 'reviewer' | 'status' | 'priority' | 'review' | 'client' | 'minutes';

type Filters = {
    project: string;
    workstream: string;
    owner: string;
    reviewer: string;
    status: string;
    priority: string;
};

const EMPTY_FILTERS: Filters = {
    project: '',
    workstream: '',
    owner: '',
    reviewer: '',
    status: '',
    priority: '',
};

const NO_REVIEWER = '__none__';

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

const COLUMNS: { key: SortKey; labelKey: TranslationKey }[] = [
    { key: 'project', labelKey: 'legalHub.taskColProject' },
    { key: 'title', labelKey: 'legalHub.taskColTitle' },
    { key: 'workstream', labelKey: 'legalHub.taskColWorkstream' },
    { key: 'owner', labelKey: 'legalHub.taskColOwner' },
    { key: 'reviewer', labelKey: 'legalHub.taskColReviewer' },
    { key: 'status', labelKey: 'legalHub.taskColStatus' },
    { key: 'priority', labelKey: 'legalHub.taskColPriority' },
    { key: 'review', labelKey: 'legalHub.taskColReview' },
    { key: 'client', labelKey: 'legalHub.taskColClient' },
    { key: 'minutes', labelKey: 'legalHub.taskColEstimate' },
];

function dayDelta(iso: string, today: Date): number {
    const [year, month, day] = iso.split('-').map(Number);
    const target = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function formatDay(iso: string, locale: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
        day: 'numeric',
        month: 'short',
    });
}

function compareText(a: string, b: string, dir: 1 | -1): number {
    return a.localeCompare(b, undefined, { sensitivity: 'base' }) * dir;
}

function compareDate(a: string | null, b: string | null, dir: 1 | -1): number {
    if (a == null && b == null)
        return 0;
    if (a == null)
        return 1;
    if (b == null)
        return -1;
    return a.localeCompare(b) * dir;
}

function taskSortValue(task: HubTask, key: SortKey, label: (task: HubTask, key: SortKey) => string): string | number | null {
    if (key === 'review')
        return task.reviewOn;
    if (key === 'client')
        return task.clientOn;
    if (key === 'minutes')
        return task.minutes;
    if (key === 'reviewer')
        return task.reviewer ? PERSON_LABEL[task.reviewer].name : null;
    return label(task, key);
}

function IconFolder() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10z" />
        </svg>
    );
}

function IconSort({ dir }: { dir: 'asc' | 'desc' }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {dir === 'asc' ? <path d="m6 14 6-6 6 6" /> : <path d="m6 10 6 6 6-6" />}
        </svg>
    );
}

function IconRoute() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M5 19c4-8 10-8 14-2" />
            <path d="m15 5 4 2-2 4" />
        </svg>
    );
}

function FilterSelect({ label, value, options, onChange }: {
    label: string;
    value: string;
    options: { id: string; label: string }[];
    onChange: (id: string) => void;
}) {
    const { t } = useI18n();
    const items = useMemo(
        () => [{ id: '', label: t('legalHub.taskFilterAll') }, ...options],
        [options, t],
    );
    return (
        <div className={`lh-tasks__filter${value ? ' is-set' : ''}`}>
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
        </div>
    );
}

function DeadlineCell({ iso }: { iso: string | null }) {
    const { t, locale } = useI18n();
    if (iso == null)
        return <span className="lh-tasks__dash">—</span>;
    const delta = dayDelta(iso, new Date());
    const tone = delta < 0 ? 'hot' : delta <= 2 ? 'soon' : 'calm';
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

function PersonCell({ id, person }: { id: TaskPersonId | null; person?: { code: string; name: string } | null }) {
    const shown = person ?? (id == null ? null : PERSON_LABEL[id]);
    if (shown == null)
        return <span className="lh-tasks__dash">—</span>;
    const tone = person ? 'member' : id;
    return (
        <span className="lh-tasks__person">
            <span className={`lh-tasks__avatar lh-tasks__avatar--${tone}`} aria-hidden>{shown.code}</span>
            <span>{shown.name}</span>
        </span>
    );
}

export function LegalHubTaskTable({ query, tasks = HUB_TASKS, owner = null, title = null }: {
    query: string;
    tasks?: HubTask[];
    owner?: { code: string; name: string } | null;
    title?: string | null;
}) {
    const { t } = useI18n();
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [openId, setOpenId] = useState<string | null>(null);
    const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'client', dir: 'asc' });
    const needle = query.trim().toLowerCase();
    const workstreams = useMemo(() => {
        const names = [...new Set(tasks.map((task) => task.workstream))];
        names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return names.map((name) => ({ id: name, label: name }));
    }, [tasks]);
    const projectOptions = TASK_PROJECTS.map((id) => ({ id, label: PROJECT_LABEL[id] }));
    const peopleOptions = TASK_PEOPLE.map((id) => ({ id, label: PERSON_LABEL[id].name }));
    const reviewerOptions = [
        { id: NO_REVIEWER, label: t('legalHub.taskNoReviewer') },
        ...peopleOptions,
    ];
    const statusOptions = TASK_STATUSES.map((id) => ({ id, label: t(STATUS_LABEL[id]) }));
    const priorityOptions = TASK_PRIORITIES.map((id) => ({ id, label: t(PRIORITY_LABEL[id]) }));
    const labelOf = (task: HubTask, key: SortKey): string => {
        if (key === 'project')
            return PROJECT_LABEL[task.project];
        if (key === 'title')
            return task.title;
        if (key === 'workstream')
            return task.workstream;
        if (key === 'owner')
            return owner?.name ?? PERSON_LABEL[task.owner].name;
        if (key === 'reviewer')
            return task.reviewer ? PERSON_LABEL[task.reviewer].name : '';
        if (key === 'status')
            return t(STATUS_LABEL[task.status]);
        if (key === 'priority')
            return t(PRIORITY_LABEL[task.priority]);
        return '';
    };
    const rows = useMemo(() => {
        const dir = sort.dir === 'asc' ? 1 : -1;
        const filtered = tasks.filter((task) => {
            if (filters.project && task.project !== filters.project)
                return false;
            if (filters.workstream && task.workstream !== filters.workstream)
                return false;
            if (!owner && filters.owner && task.owner !== filters.owner)
                return false;
            if (filters.reviewer === NO_REVIEWER && task.reviewer != null)
                return false;
            if (filters.reviewer && filters.reviewer !== NO_REVIEWER && task.reviewer !== filters.reviewer)
                return false;
            if (filters.status && task.status !== filters.status)
                return false;
            if (filters.priority && task.priority !== filters.priority)
                return false;
            if (!needle)
                return true;
            const reviewer = task.reviewer ? PERSON_LABEL[task.reviewer].name : '';
            const ownerName = owner?.name ?? PERSON_LABEL[task.owner].name;
            const haystack = `${PROJECT_LABEL[task.project]} ${task.title} ${task.workstream} ${ownerName} ${reviewer}`.toLowerCase();
            return haystack.includes(needle);
        });
        filtered.sort((a, b) => {
            const left = taskSortValue(a, sort.key, labelOf);
            const right = taskSortValue(b, sort.key, labelOf);
            if (typeof left === 'number' && typeof right === 'number')
                return (left - right) * dir;
            if (sort.key === 'review' || sort.key === 'client' || sort.key === 'reviewer')
                return compareDate(typeof left === 'string' ? left : null, typeof right === 'string' ? right : null, dir);
            return compareText(String(left ?? ''), String(right ?? ''), dir);
        });
        return filtered;
    }, [filters, needle, owner, sort, t, tasks]);
    const openTask = tasks.find((task) => task.id === openId) ?? null;
    const filtersOn = Object.values(filters).some(Boolean);
    const setFilter = (key: keyof Filters) => (id: string) => setFilters((current) => ({ ...current, [key]: id }));
    const toggleSort = (key: SortKey) => {
        setSort((current) => (current.key === key
            ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: 'asc' }));
    };
    return (
        <section className="lh-tasks" aria-label={title ?? (owner ? t('legalHub.taskMemberTitle').replace('{name}', owner.name) : t('legalHub.viewDetails'))}>
            {title || owner ? <h3 className="lh-tasks__who">{title ?? t('legalHub.taskMemberTitle').replace('{name}', owner?.name ?? '')}</h3> : null}
            <div className="lh-tasks__bar">
                <div className="lh-tasks__filters">
                    <FilterSelect label={t('legalHub.taskColProject')} value={filters.project} options={projectOptions} onChange={setFilter('project')} />
                    <FilterSelect label={t('legalHub.taskColWorkstream')} value={filters.workstream} options={workstreams} onChange={setFilter('workstream')} />
                    {owner ? null : (
                        <FilterSelect label={t('legalHub.taskColOwner')} value={filters.owner} options={peopleOptions} onChange={setFilter('owner')} />
                    )}
                    <FilterSelect label={t('legalHub.taskColReviewer')} value={filters.reviewer} options={reviewerOptions} onChange={setFilter('reviewer')} />
                    <FilterSelect label={t('legalHub.taskColStatus')} value={filters.status} options={statusOptions} onChange={setFilter('status')} />
                    <FilterSelect label={t('legalHub.taskColPriority')} value={filters.priority} options={priorityOptions} onChange={setFilter('priority')} />
                </div>
                <div className="lh-tasks__meta">
                    <span>{t('legalHub.taskShown').replace('{count}', String(rows.length))}</span>
                    {filtersOn ? (
                        <button type="button" className="lh-tasks__reset" onClick={() => setFilters(EMPTY_FILTERS)}>
                            {t('legalHub.taskFilterReset')}
                        </button>
                    ) : null}
                </div>
            </div>
            {rows.length === 0 ? (
                <p className="lh-tasks__empty">{t('legalHub.taskEmpty')}</p>
            ) : (
                <div className="lh-tasks__scroll">
                    <table>
                        <thead>
                            <tr>
                                {COLUMNS.map((column) => {
                                    const active = sort.key === column.key;
                                    return (
                                        <th key={column.key} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                            <button type="button" onClick={() => toggleSort(column.key)}>
                                                {t(column.labelKey)}
                                                {active ? <IconSort dir={sort.dir} /> : null}
                                            </button>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((task, index) => (
                                <tr
                                    key={task.id}
                                    className={openId === task.id ? 'is-open' : ''}
                                    tabIndex={0}
                                    style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
                                    onClick={() => setOpenId(task.id)}
                                    onKeyDown={(event) => {
                                        if (event.key !== 'Enter' && event.key !== ' ')
                                            return;
                                        event.preventDefault();
                                        setOpenId(task.id);
                                    }}
                                >
                                    <td>
                                        <span className={`lh-tasks__project lh-tasks__project--${task.project}`}>
                                            <IconFolder />
                                            <span>{PROJECT_LABEL[task.project]}</span>
                                        </span>
                                    </td>
                                    <td className="lh-tasks__cell-title">
                                        <span className="lh-tasks__title">{task.title}</span>
                                        {task.autoRouted ? (
                                            <span className="lh-tasks__route">
                                                <IconRoute />
                                                {t('legalHub.taskAutoRouted')}
                                            </span>
                                        ) : null}
                                    </td>
                                    <td className="lh-tasks__muted">{task.workstream}</td>
                                    <td><PersonCell id={task.owner} person={owner} /></td>
                                    <td><PersonCell id={task.reviewer} /></td>
                                    <td>
                                        <span className={`lh-tasks__pill lh-tasks__pill--${task.status}`}>{t(STATUS_LABEL[task.status])}</span>
                                    </td>
                                    <td>
                                        <span className={`lh-tasks__pill lh-tasks__pill--priority-${task.priority}`}>{t(PRIORITY_LABEL[task.priority])}</span>
                                    </td>
                                    <td><DeadlineCell iso={task.reviewOn} /></td>
                                    <td><DeadlineCell iso={task.clientOn} /></td>
                                    <td className="lh-tasks__muted lh-tasks__cell-estimate">{t('legalHub.taskMinutes').replace('{count}', String(task.minutes))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {openTask ? (
                <LegalHubTaskDrawer
                    key={openTask.id}
                    task={openTask}
                    owner={owner}
                    onClose={() => setOpenId(null)}
                />
            ) : null}
        </section>
    );
}
