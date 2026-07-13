import { lazy, Suspense, useMemo } from 'react';
import type { LaborStatisticsChartsApi } from '@entities/time-tracking';
import { useI18n } from '@shared/i18n';
import { StatisticsWidgetCard } from './StatisticsWidgetCard';
import { StatisticsStackedBarList } from './StatisticsStackedBarList';
import type { DateLinePoint, StackedBarRow } from './statisticsChartTypes';
import type { StatisticsChartDrillKind } from './statisticsChartDrillDown';
import { aggregateBarByLawyer } from './statisticsAggregateBar';
import type { StatisticsLaborDetailRow } from './statisticsLaborTypes';

const StatisticsHoursPerDayChart = lazy(() => import('./StatisticsWidgetsLineCharts').then((m) => ({ default: m.StatisticsHoursPerDayChart })));

const chartFallback = <div className="tt-statistics__charts-fallback" aria-busy="true" />;

type Props = {
    charts?: LaborStatisticsChartsApi | null;
    detailRows?: StatisticsLaborDetailRow[];
    onDrillDown?: (kind: StatisticsChartDrillKind, row: StackedBarRow) => void;
};

export function StatisticsUserTab({ charts, detailRows, onDrillDown }: Props) {
    const { t } = useI18n();
    const w = 'timeTrackingPage.statistics.widgets';

    const byUsers = useMemo(() => {
        const fromDetail = aggregateBarByLawyer(detailRows ?? []);
        const fromCharts = (charts?.by_users ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            primary: r.billable_hours,
            secondary: r.non_billable_hours,
        }));
        return fromDetail.length >= fromCharts.length ? fromDetail : fromCharts;
    }, [detailRows, charts?.by_users]);

    const hoursByDay: DateLinePoint[] = charts?.hours_by_day?.length
        ? charts.hours_by_day.map((d) => ({
            dateLabel: d.date_label || d.date,
            value: d.total_hours,
            billable: d.billable_hours,
            nonBillable: Math.max(0, d.total_hours - d.billable_hours),
        }))
        : [];

    return (
        <div className="tt-statistics__tab-body tt-statistics__grid">
            <StatisticsWidgetCard
                fullWidth
                title={t(`${w}.byUsers`)}
                detailHint={onDrillDown ? t(`${w}.hintDrillLawyer`) : undefined}
            >
                <StatisticsStackedBarList
                    data={byUsers}
                    interactive={Boolean(onDrillDown)}
                    searchable
                    scrollable
                    onRowClick={onDrillDown ? (row) => onDrillDown('lawyer', row) : undefined}
                />
            </StatisticsWidgetCard>

            <StatisticsWidgetCard title={t(`${w}.hoursPerDay`)} wide fullWidth>
                <Suspense fallback={chartFallback}>
                    <StatisticsHoursPerDayChart data={hoursByDay} />
                </Suspense>
            </StatisticsWidgetCard>
        </div>
    );
}
