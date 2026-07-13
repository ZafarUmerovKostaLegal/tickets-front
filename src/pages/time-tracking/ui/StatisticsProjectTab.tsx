import { lazy, Suspense, useMemo } from 'react';
import type { LaborStatisticsChartsApi } from '@entities/time-tracking';
import type { LaborStatisticsStackedChartRow } from '@entities/time-tracking/api';
import { useI18n } from '@shared/i18n';
import { StatisticsWidgetCard } from './StatisticsWidgetCard';
import { StatisticsStackedBarList } from './StatisticsStackedBarList';
import type { PieSlice, StackedBarRow } from './statisticsChartTypes';
import type { StatisticsChartDrillKind } from './statisticsChartDrillDown';

const StatisticsDonutChart = lazy(() => import('./StatisticsDonutChart').then((m) => ({ default: m.StatisticsDonutChart })));

const PIE_COLORS_PROJECT = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#64748b'];
const PIE_COLORS_TASK = ['#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#64748b'];
const PIE_COLORS_WORK_TYPE = ['#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#6366f1', '#8b5cf6', '#64748b'];
const chartFallback = <div className="tt-statistics__charts-fallback" aria-busy="true" />;

function mapStacked(rows: LaborStatisticsStackedChartRow[]): StackedBarRow[] {
    return rows.map((r) => ({
        id: r.id,
        name: r.name,
        primary: r.billable_hours,
        secondary: r.non_billable_hours,
    }));
}

function mapPie(rows: Array<{ name: string; value: number; hours?: number }>, colors: string[]): PieSlice[] {
    return rows.map((r, i) => ({
        name: r.name,
        value: r.value,
        hours: r.hours,
        color: colors[i % colors.length] ?? '#64748b',
    }));
}

type Props = {
    charts?: LaborStatisticsChartsApi | null;
    onDrillDown?: (kind: StatisticsChartDrillKind, row: StackedBarRow) => void;
};

export function StatisticsProjectTab({ charts, onDrillDown }: Props) {
    const { t } = useI18n();
    const w = 'timeTrackingPage.statistics.widgets';

    const byProjects = useMemo(() => (charts?.by_projects?.length ? mapStacked(charts.by_projects) : []), [charts?.by_projects]);
    const byClients = useMemo(() => (charts?.by_clients?.length ? mapStacked(charts.by_clients) : []), [charts?.by_clients]);
    const byStatus = useMemo(
        () => (charts?.by_project_status?.length ? mapStacked(charts.by_project_status) : []),
        [charts?.by_project_status],
    );
    const hoursByProject = charts?.hours_by_project_ranking?.length
        ? mapPie(charts.hours_by_project_ranking, PIE_COLORS_PROJECT)
        : [];
    const hoursByTask = charts?.hours_by_task?.length ? mapPie(charts.hours_by_task, PIE_COLORS_TASK) : [];
    const byWorkType = charts?.by_work_type?.length
        ? mapPie(charts.by_work_type, PIE_COLORS_WORK_TYPE)
        : [];

    return (
        <div className="tt-statistics__tab-body tt-statistics__grid">
            <StatisticsWidgetCard
                fullWidth
                title={t(`${w}.byProjects`)}
                detailHint={onDrillDown ? t(`${w}.hintDrillProject`) : undefined}
            >
                <StatisticsStackedBarList
                    data={byProjects}
                    interactive={Boolean(onDrillDown)}
                    onRowClick={onDrillDown ? (row) => onDrillDown('project', row) : undefined}
                />
            </StatisticsWidgetCard>

            <StatisticsWidgetCard
                fullWidth
                title={t(`${w}.byClients`)}
                detailHint={onDrillDown ? t(`${w}.hintDrillClient`) : undefined}
            >
                <StatisticsStackedBarList
                    data={byClients}
                    interactive={Boolean(onDrillDown)}
                    onRowClick={onDrillDown ? (row) => onDrillDown('client', row) : undefined}
                />
            </StatisticsWidgetCard>

            <StatisticsWidgetCard
                fullWidth
                title={t(`${w}.byProjectStatus`)}
                detailHint={onDrillDown ? t(`${w}.hintDrillStatus`) : undefined}
            >
                <StatisticsStackedBarList
                    data={byStatus}
                    interactive={Boolean(onDrillDown)}
                    onRowClick={onDrillDown ? (row) => onDrillDown('projectStatus', row) : undefined}
                />
            </StatisticsWidgetCard>

            <StatisticsWidgetCard title={t(`${w}.hoursByProject`)} wide>
                <Suspense fallback={chartFallback}>
                    <StatisticsDonutChart data={hoursByProject} centerLabel={t(`${w}.hoursCenterLabel`)} />
                </Suspense>
            </StatisticsWidgetCard>

            <StatisticsWidgetCard title={t(`${w}.hoursByTask`)} wide>
                <Suspense fallback={chartFallback}>
                    <StatisticsDonutChart data={hoursByTask} centerLabel={t(`${w}.hoursCenterLabel`)} />
                </Suspense>
            </StatisticsWidgetCard>

            {byWorkType.length > 0 ? (
                <StatisticsWidgetCard title={t(`${w}.byWorkType`)} wide>
                    <Suspense fallback={chartFallback}>
                        <StatisticsDonutChart data={byWorkType} centerLabel={t(`${w}.hoursCenterLabel`)} />
                    </Suspense>
                </StatisticsWidgetCard>
            ) : null}
        </div>
    );
}
