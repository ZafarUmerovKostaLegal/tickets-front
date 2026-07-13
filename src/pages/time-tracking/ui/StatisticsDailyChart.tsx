import { lazy, Suspense, useMemo } from 'react';
import { useI18n } from '@shared/i18n';
import type { LaborStatisticsChartsApi } from '@entities/time-tracking';
import type { StatisticsDailyPoint } from './statisticsChartTypes';

const StatisticsActionsChart = lazy(() => import('./StatisticsActionsChart').then((m) => ({ default: m.StatisticsActionsChart })));

type Props = {
    charts?: LaborStatisticsChartsApi | null;
};

function shortDayLabel(date: string, dateLabel: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [, month, day] = date.split('-');
        return `${day}.${month}`;
    }
    const parts = dateLabel.trim().split(/\s+/);
    if (parts.length >= 2)
        return `${parts[0]} ${parts[1]}`;
    return dateLabel;
}

export function StatisticsDailyChart({ charts }: Props) {
    const { t } = useI18n();
    const data = useMemo((): StatisticsDailyPoint[] => {
        const days = charts?.hours_by_day;
        if (!days?.length)
            return [];
        return days.map((d, idx) => ({
            idx,
            date: d.date,
            dateLabel: shortDayLabel(d.date, d.date_label || d.date),
            primary: d.billable_hours,
            secondary: Math.max(0, d.total_hours - d.billable_hours),
            total: d.total_hours,
        }));
    }, [charts]);

    return (
        <Suspense fallback={<div className="tt-statistics__charts-fallback" aria-busy="true" />}>
            <StatisticsActionsChart
                data={data}
                title={t('timeTrackingPage.statistics.chartTitle')}
                hint={t('timeTrackingPage.statistics.chartHint')}
            />
        </Suspense>
    );
}
