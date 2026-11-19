import { useEffect, useState } from 'react';
import { useI18n, type TranslationKey } from '@shared/i18n';
import { fetchTeamStats, PROJECT_STAGES, type ProjectStage, type TeamStats } from './legalHubTeamApi';

export const STAGE_LABEL: Record<ProjectStage, TranslationKey> = {
    todo: 'legalHub.mapStageTodo',
    progress: 'legalHub.mapStageProgress',
    wait: 'legalHub.mapStageWait',
    review: 'legalHub.mapStageReview',
    changes: 'legalHub.mapStageChanges',
    done: 'legalHub.mapStageDone',
};

const TOTALS: Array<[keyof TeamStats['totals'], TranslationKey, 'warn' | 'ok' | '']> = [
    ['open', 'legalHub.statsOpen', ''],
    ['overdue', 'legalHub.statsOverdue', 'warn'],
    ['dueWeek', 'legalHub.statsDueWeek', ''],
    ['review', 'legalHub.statsReview', ''],
    ['changes', 'legalHub.statsChanges', ''],
    ['done30', 'legalHub.statsDone30', 'ok'],
    ['returned30', 'legalHub.statsReturned30', ''],
];

/** `{name}` placeholders in a translated string. */
export function fill(text: string, vars: Record<string, string | number>): string {
    return Object.entries(vars).reduce((out, [key, value]) => out.split(`{${key}}`).join(String(value)), text);
}

function formatDay(iso: string, locale: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y!, (m ?? 1) - 1, d).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

/**
 * Team statistics and the project map: every project as a pipeline
 * (to do → in progress → waiting → review → changes → done) with the current stage highlighted.
 */
export function LegalHubProjectMap({ canOpen, onOpen }: { canOpen: (id: string) => boolean; onOpen: (id: string) => void }) {
    const { t, locale } = useI18n();
    const [stats, setStats] = useState<TeamStats | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        fetchTeamStats().then((data) => {
            if (!cancelled)
                setStats(data);
        }).catch((err: unknown) => {
            if (!cancelled)
                setError(err instanceof Error ? err.message : String(err));
        });
        return () => {
            cancelled = true;
        };
    }, []);

    if (error)
        return <p className="lh-map__error" role="alert">{error}</p>;
    if (!stats)
        return <div className="lh-map lh-map--loading" aria-busy="true" />;

    return (
        <div className="lh-map">
            <section className="lh-stats" aria-label={t('legalHub.statsTitle')}>
                {TOTALS.map(([key, label, tone]) => (
                    <div key={key} className={`lh-stats__tile${tone && stats.totals[key] > 0 ? ` is-${tone}` : ''}`}>
                        <strong>{stats.totals[key]}</strong>
                        <span>{t(label)}</span>
                    </div>
                ))}
            </section>

            <section className="lh-map__panel" aria-labelledby="lh-map-title">
                <header className="lh-map__head">
                    <h2 id="lh-map-title">{t('legalHub.mapTitle')}</h2>
                    <p>{t('legalHub.mapHint')}</p>
                </header>
                {stats.projects.length === 0 ? <p className="lh-map__empty">{t('legalHub.mapEmpty')}</p> : (
                    <ul className="lh-map__list">
                        {stats.projects.map((project) => {
                            const openable = canOpen(project.id);
                            return (
                                <li key={project.id} className={`lh-map__row is-${project.stage}`}>
                                    <div className="lh-map__info">
                                        {openable ? (
                                            <button type="button" className="lh-map__name" title={project.name} onClick={() => onOpen(project.id)}>{project.name}</button>
                                        ) : <span className="lh-map__name" title={project.name}>{project.name}</span>}
                                        <span className="lh-map__meta">
                                            {fill(t('legalHub.mapTasks'), { done: project.done, total: project.total })}
                                            {project.overdue ? <em className="lh-map__late">{fill(t('legalHub.mapOverdue'), { count: project.overdue })}</em> : null}
                                            {project.nextDue ? <span>{fill(t('legalHub.mapNextDue'), { date: formatDay(project.nextDue, locale) })}</span> : null}
                                        </span>
                                    </div>
                                    <ol className="lh-map__pipe" aria-label={`${t('legalHub.mapNow')}: ${t(STAGE_LABEL[project.stage])}`}>
                                        {PROJECT_STAGES.map((stage) => {
                                            const count = project.stages[stage] ?? 0;
                                            const current = stage === project.stage;
                                            return (
                                                <li
                                                    key={stage}
                                                    className={`lh-map__step lh-map__step--${stage}${current ? ' is-current' : ''}${count ? ' has-tasks' : ''}`}
                                                    title={`${t(STAGE_LABEL[stage])}: ${count}`}
                                                    aria-current={current ? 'step' : undefined}
                                                >
                                                    <span className="lh-map__step-label">{t(STAGE_LABEL[stage])}</span>
                                                    <span className="lh-map__step-count">{count}</span>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                    <div className="lh-map__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progress} aria-label={fill(t('legalHub.mapTasks'), { done: project.done, total: project.total })}>
                                        <span style={{ width: `${project.progress}%` }} />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}

/** Same rule as the server: done when nothing is open, otherwise the stage holding most open tasks (ties → earlier). */
export function currentStage(counts: Partial<Record<ProjectStage, number>>): ProjectStage {
    const open = PROJECT_STAGES.filter((stage) => stage !== 'done');
    const best = Math.max(0, ...open.map((stage) => counts[stage] ?? 0));
    return best === 0 ? 'done' : open.find((stage) => (counts[stage] ?? 0) === best)!;
}

/** Compact "where is this project" strip shown on top of a project board. */
export function ProjectStageStrip({ stages, onMap }: { stages: ProjectStage[]; onMap?: () => void }) {
    const { t } = useI18n();
    if (stages.length === 0)
        return null;
    const counts: Partial<Record<ProjectStage, number>> = {};
    for (const stage of stages)
        counts[stage] = (counts[stage] ?? 0) + 1;
    const now = currentStage(counts);
    const done = counts.done ?? 0;
    const progress = Math.round((done / stages.length) * 100);
    const tasksLabel = fill(t('legalHub.mapTasks'), { done, total: stages.length });
    return (
        <section className="lh-strip" aria-label={t('legalHub.stripTitle')}>
            <div className="lh-strip__head">
                <span className="lh-strip__now">
                    {t('legalHub.stripTitle')}
                    {': '}
                    <strong className={`is-${now}`}>{t(STAGE_LABEL[now])}</strong>
                </span>
                <span className="lh-strip__count">{tasksLabel}</span>
                {onMap ? <button type="button" className="lh-strip__map" onClick={onMap}>{t('legalHub.stripOpenMap')}</button> : null}
            </div>
            <ol className="lh-map__pipe lh-strip__pipe" aria-label={`${t('legalHub.mapNow')}: ${t(STAGE_LABEL[now])}`}>
                {PROJECT_STAGES.map((stage) => {
                    const count = counts[stage] ?? 0;
                    return (
                        <li
                            key={stage}
                            className={`lh-map__step lh-map__step--${stage}${stage === now ? ' is-current' : ''}${count ? ' has-tasks' : ''}`}
                            aria-current={stage === now ? 'step' : undefined}
                        >
                            <span className="lh-map__step-label">{t(STAGE_LABEL[stage])}</span>
                            <span className="lh-map__step-count">{count}</span>
                        </li>
                    );
                })}
            </ol>
            <div className="lh-map__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={tasksLabel}>
                <span style={{ width: `${progress}%` }} />
            </div>
        </section>
    );
}
