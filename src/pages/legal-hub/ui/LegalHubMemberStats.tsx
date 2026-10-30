import { useMemo, type ReactNode } from 'react';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { mockMemberLoad } from './legalHubMock';
import {
    PROJECT_LABEL,
    TASK_PRIORITIES,
    TASK_PROJECTS,
    TASK_STATUSES,
    type HubTask,
    type TaskPriorityId,
    type TaskProjectId,
    type TaskStatusId,
} from './legalHubTasks';

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

function dayDelta(iso: string): number {
    const [year, month, day] = iso.split('-').map(Number);
    const target = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function formatDay(iso: string, locale: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
        day: 'numeric',
        month: 'short',
    });
}

function meterColor(percent: number): string {
    const clamped = Math.max(0, Math.min(100, percent)) / 100;
    const low = clamped < 0.5;
    const from = low ? [239, 68, 68] : [245, 158, 11];
    const to = low ? [245, 158, 11] : [22, 197, 94];
    const local = low ? clamped / 0.5 : (clamped - 0.5) / 0.5;
    const mix = (start: number, end: number) => Math.round(start + (end - start) * local);
    return `rgb(${mix(from[0]!, to[0]!)}, ${mix(from[1]!, to[1]!)}, ${mix(from[2]!, to[2]!)})`;
}

function isOverdue(task: HubTask): boolean {
    return [task.clientOn, task.reviewOn, task.followUpOn].some((iso) => iso != null && iso !== '' && dayDelta(iso) < 0);
}

function dueHint(iso: string, t: (key: TranslationKey) => string): { text: string; tone: 'hot' | 'soon' | 'calm' } {
    const delta = dayDelta(iso);
    if (delta < 0)
        return { text: t('legalHub.taskOverdue').replace('{count}', String(-delta)), tone: 'hot' };
    if (delta === 0)
        return { text: t('legalHub.taskToday'), tone: 'hot' };
    if (delta <= 2)
        return { text: t('legalHub.taskDaysLeft').replace('{count}', String(delta)), tone: 'soon' };
    return { text: t('legalHub.taskDaysLeft').replace('{count}', String(delta)), tone: 'calm' };
}

export function LegalHubMemberStats({ memberId, name, code, capacity, tasks }: {
    memberId: number;
    name: string;
    code: string;
    capacity: string;
    tasks: HubTask[];
}) {
    const { t, locale } = useI18n();
    const load = mockMemberLoad(memberId, capacity);
    const total = tasks.length;
    const overdue = tasks.filter(isOverdue);
    const review = tasks.filter((task) => task.status === 'associate' || task.status === 'partner');
    const waiting = tasks.filter((task) => task.status === 'wait');
    const dueWeek = tasks.filter((task) => {
        const delta = dayDelta(task.clientOn);
        return delta >= 0 && delta <= 7;
    });
    const minutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
    const average = total === 0 ? 0 : Math.round(minutes / total);
    const withReviewer = tasks.filter((task) => task.reviewer != null).length;
    const important = tasks.filter((task) => task.important || task.priority === 'high').length;
    const color = meterColor(load.percent);
    const hours = t('legalHub.memberHours')
        .replace('{used}', String(load.hoursUsed))
        .replace('{cap}', String(load.hoursCap));

    const statusRows = TASK_STATUSES.map((id) => ({
        id,
        label: t(STATUS_LABEL[id]),
        count: tasks.filter((task) => task.status === id).length,
    }));
    const priorityRows = TASK_PRIORITIES.map((id) => ({
        id,
        label: t(PRIORITY_LABEL[id]),
        count: tasks.filter((task) => task.priority === id).length,
    }));
    const projectRows = useMemo(() => TASK_PROJECTS
        .map((id) => ({ id, label: PROJECT_LABEL[id], count: tasks.filter((task) => task.project === id).length }))
        .filter((row) => row.count > 0), [tasks]);
    const streamRows = useMemo(() => {
        const counts = new Map<string, number>();
        for (const task of tasks)
            counts.set(task.workstream, (counts.get(task.workstream) ?? 0) + 1);
        return [...counts.entries()]
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }, [tasks]);
    const later = tasks.filter((task) => !isOverdue(task) && dayDelta(task.clientOn) > 7);
    const weekOnly = dueWeek.filter((task) => !isOverdue(task));

    return (
        <section className="lh-person" aria-label={t('legalHub.memberStats')}>
            <header className="lh-person__hero">
                <span className="lh-tasks__avatar lh-tasks__avatar--member" aria-hidden>{code}</span>
                <div>
                    <p>{t('legalHub.memberStats')}</p>
                    <h1>{name}</h1>
                    <span>{hours}</span>
                </div>
                <div className="lh-person__load">
                    <span>{t('legalHub.memberStatsLoad')}</span>
                    <strong style={{ color }}>{load.percent}%</strong>
                    <span className="lh-person__meter" aria-hidden>
                        <span style={{ width: `${load.percent}%`, background: color }} />
                    </span>
                </div>
            </header>
            <ul className="lh-person__kpis">
                <Kpi label={t('legalHub.statTasks')} value={total} />
                <Kpi label={t('legalHub.myTasksLate')} value={overdue.length} hot={overdue.length > 0} />
                <Kpi label={t('legalHub.statReview')} value={review.length} />
                <Kpi label={t('legalHub.statusWaiting')} value={waiting.length} />
                <Kpi label={t('legalHub.statDue')} value={dueWeek.length} />
                <Kpi label={t('legalHub.memberStatsMinutes')} value={minutes} />
            </ul>
            <div className="lh-person__grid">
                <Panel title={t('legalHub.memberStatsByStatus')}>
                    <Bars rows={statusRows.map((row) => ({ ...row, tone: row.id }))} total={total} />
                </Panel>
                <Panel title={t('legalHub.memberStatsByPriority')}>
                    <Bars rows={priorityRows.map((row) => ({ ...row, tone: `priority-${row.id}` }))} total={total} />
                    <p className="lh-person__note">{t('legalHub.memberStatsAvg').replace('{count}', String(average))}</p>
                </Panel>
                <Panel title={t('legalHub.memberStatsWithReviewer')}>
                    <Bars
                        rows={[
                            { id: 'reviewer', label: t('legalHub.memberStatsWithReviewer'), count: withReviewer, tone: 'partner' },
                            { id: 'none', label: t('legalHub.taskNoReviewer'), count: total - withReviewer, tone: 'todo' },
                            { id: 'important', label: t('legalHub.myTasksImportant'), count: important, tone: 'priority-high' },
                        ]}
                        total={total}
                    />
                </Panel>
            </div>
            <div className="lh-person__grid lh-person__grid--two">
                <Panel title={t('legalHub.memberStatsByProject')}>
                    {projectRows.length === 0 ? <p className="lh-person__note">{t('legalHub.memberStatsNone')}</p> : (
                        <ul className="lh-person__projects">
                            {projectRows.map((row) => (
                                <li key={row.id}>
                                    <span className={`lh-tasks__project lh-tasks__project--${row.id}`}>
                                        <FolderIcon />
                                        <span>{row.label}</span>
                                    </span>
                                    <span className="lh-person__track" aria-hidden>
                                        <span style={{ width: total === 0 ? '0%' : `${Math.round((row.count / total) * 100)}%` }} />
                                    </span>
                                    <strong>{row.count}</strong>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
                <Panel title={t('legalHub.memberStatsByStream')}>
                    {streamRows.length === 0 ? <p className="lh-person__note">{t('legalHub.memberStatsNone')}</p> : (
                        <Bars rows={streamRows.map((row) => ({ id: row.label, label: row.label, count: row.count, tone: 'progress' }))} total={total} />
                    )}
                </Panel>
            </div>
            <Panel title={t('legalHub.memberStatsDeadlines')}>
                <div className="lh-person__deadlines">
                    <DeadlineColumn title={t('legalHub.myTasksLate')} tasks={overdue} locale={locale} empty={t('legalHub.memberStatsNone')} />
                    <DeadlineColumn title={t('legalHub.statDue')} tasks={weekOnly} locale={locale} empty={t('legalHub.memberStatsNone')} />
                    <DeadlineColumn title={t('legalHub.memberStatsLater')} tasks={later} locale={locale} empty={t('legalHub.memberStatsNone')} />
                </div>
            </Panel>
        </section>
    );
}

function Kpi({ label, value, hot }: { label: string; value: number; hot?: boolean }) {
    return (
        <li className={hot ? 'is-hot' : ''}>
            <strong>{value}</strong>
            <span>{label}</span>
        </li>
    );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="lh-person__panel">
            <h2>{title}</h2>
            {children}
        </section>
    );
}

function Bars({ rows, total }: { rows: { id: string; label: string; count: number; tone: string }[]; total: number }) {
    return (
        <ul className="lh-person__bars">
            {rows.map((row) => (
                <li key={row.id}>
                    <span>{row.label}</span>
                    <span className="lh-person__track" aria-hidden>
                        <span className={`is-${row.tone}`} style={{ width: total === 0 ? '0%' : `${Math.round((row.count / total) * 100)}%` }} />
                    </span>
                    <strong>{row.count}</strong>
                </li>
            ))}
        </ul>
    );
}

function DeadlineColumn({ title, tasks, locale, empty }: {
    title: string;
    tasks: HubTask[];
    locale: string;
    empty: string;
}) {
    const { t } = useI18n();
    return (
        <div>
            <h3>{title}<span>{tasks.length}</span></h3>
            {tasks.length === 0 ? <p className="lh-person__note">{empty}</p> : (
                <ul>
                    {tasks.map((task) => {
                        const hint = dueHint(task.clientOn, t);
                        return (
                            <li key={task.id}>
                                <strong>{task.title}</strong>
                                <span>{PROJECT_LABEL[task.project as TaskProjectId]}</span>
                                <em className={`lh-tasks__delta lh-tasks__delta--${hint.tone}`}>{formatDay(task.clientOn, locale)} · {hint.text}</em>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function FolderIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10z" />
        </svg>
    );
}
