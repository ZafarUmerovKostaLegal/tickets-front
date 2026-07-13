import { lazy, Suspense, useMemo } from 'react';
import { useI18n } from '@shared/i18n';
import type { LaborStatisticsChartsApi } from '@entities/time-tracking';
import type { LaborStatisticsStackedChartRow } from '@entities/time-tracking/api';
import { StatisticsWidgetCard } from './StatisticsWidgetCard';
import { StatisticsStackedBarList } from './StatisticsStackedBarList';
import type {
    DateLinePoint,
    MultiLinePoint,
    PieSlice,
    SimpleLinePoint,
    StackedBarRow,
} from './statisticsChartTypes';
import type { StatisticsChartDrillKind } from './statisticsChartDrillDown';
import { aggregateBarByLawyer } from './statisticsAggregateBar';
import type { StatisticsLaborDetailRow } from './statisticsLaborTypes';

const StatisticsDonutChart = lazy(() => import('./StatisticsDonutChart').then((m) => ({ default: m.StatisticsDonutChart })));
const StatisticsProjectsTimelineChart = lazy(() => import('./StatisticsWidgetsLineCharts').then((m) => ({ default: m.StatisticsProjectsTimelineChart })));
const StatisticsHoursPerDayChart = lazy(() => import('./StatisticsWidgetsLineCharts').then((m) => ({ default: m.StatisticsHoursPerDayChart })));
const StatisticsUserActivityChart = lazy(() => import('./StatisticsWidgetsLineCharts').then((m) => ({ default: m.StatisticsUserActivityChart })));

const PIE_COLORS_PROJECT = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#64748b'];
const PIE_COLORS_TASK = ['#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#64748b'];

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
    detailRows?: StatisticsLaborDetailRow[];
    onDrillDown?: (kind: StatisticsChartDrillKind, row: StackedBarRow) => void;
};

export function StatisticsWidgetsGrid({ charts, detailRows, onDrillDown }: Props) {
    const { t } = useI18n();
    const w = 'timeTrackingPage.statistics.widgets';

    const byUsers = useMemo(() => {
        const fromDetail = aggregateBarByLawyer(detailRows ?? []);
        const fromCharts = charts?.by_users?.length ? mapStacked(charts.by_users) : [];
        return fromDetail.length >= fromCharts.length ? fromDetail : fromCharts;
    }, [detailRows, charts?.by_users]);
    const byProjects = useMemo(() => (charts?.by_projects?.length ? mapStacked(charts.by_projects) : []), [charts?.by_projects]);
    const byClients = useMemo(() => (charts?.by_clients?.length ? mapStacked(charts.by_clients) : []), [charts?.by_clients]);
    const byStatus = useMemo(() => (charts?.by_project_status?.length ? mapStacked(charts.by_project_status) : []), [charts?.by_project_status]);
    const hoursByProject = charts?.hours_by_project_ranking?.length
        ? mapPie(charts.hours_by_project_ranking, PIE_COLORS_PROJECT)
        : [];
    const hoursByTask = charts?.hours_by_task?.length ? mapPie(charts.hours_by_task, PIE_COLORS_TASK) : [];
    const hoursByDay: DateLinePoint[] = charts?.hours_by_day?.length
        ? charts.hours_by_day.map((d) => ({
            dateLabel: d.date_label || d.date,
            value: d.total_hours,
        }))
        : [];
    const projectsTimeline: MultiLinePoint[] = [];
    const userActivity: SimpleLinePoint[] = [];

    const projectSeries: [string, string, string] = [
        t(`${w}.seriesProject1`),
        t(`${w}.seriesProject2`),
        t(`${w}.seriesProject3`),
    ];

    const drill = onDrillDown;

    return (
        <div className="tt-statistics__grid">
            <StatisticsWidgetCard
                fullWidth
                title={t(`${w}.byUsers`)}
                detailHint={drill ? t(`${w}.hintDrillLawyer`) : undefined}
            >
                <StatisticsStackedBarList
                    data={byUsers}
                    interactive={Boolean(drill)}
                    searchable
                    scrollable
                    onRowClick={drill ? (row) => drill('lawyer', row) : undefined}
                />
            </StatisticsWidgetCard>

            <StatisticsWidgetCard
                fullWidth
                title={t(`${w}.byProjects`)}
                detailHint={drill ? t(`${w}.hintDrillProject`) : undefined}
            >
                <StatisticsStackedBarList
                    data={byProjects}
                    interactive={Boolean(drill)}
                    onRowClick={drill ? (row) => drill('project', row) : undefined}
                />
            </StatisticsWidgetCard>

            <StatisticsWidgetCard
                fullWidth
                title={t(`${w}.byClients`)}
                detailHint={drill ? t(`${w}.hintDrillClient`) : undefined}
            >
                <StatisticsStackedBarList
                    data={byClients}
                    interactive={Boolean(drill)}
                    onRowClick={drill ? (row) => drill('client', row) : undefined}
                />
            </StatisticsWidgetCard>

            <StatisticsWidgetCard
                fullWidth
                title={t(`${w}.byProjectStatus`)}
                detailHint={drill ? t(`${w}.hintDrillStatus`) : undefined}
            >
                <StatisticsStackedBarList
                    data={byStatus}
                    interactive={Boolean(drill)}
                    onRowClick={drill ? (row) => drill('projectStatus', row) : undefined}
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

            <StatisticsWidgetCard title={t(`${w}.projectsTimeline`)} wide>
                <Suspense fallback={chartFallback}>
                    <StatisticsProjectsTimelineChart data={projectsTimeline} seriesNames={projectSeries} />
                </Suspense>
            </StatisticsWidgetCard>

            <StatisticsWidgetCard title={t(`${w}.hoursPerDay`)} wide>
                <Suspense fallback={chartFallback}>
                    <StatisticsHoursPerDayChart data={hoursByDay} />
                </Suspense>
            </StatisticsWidgetCard>

            <StatisticsWidgetCard title={t(`${w}.userActivity`)} wide>
                <Suspense fallback={chartFallback}>
                    <StatisticsUserActivityChart data={userActivity} />
                </Suspense>
            </StatisticsWidgetCard>
        </div>
    );
}
