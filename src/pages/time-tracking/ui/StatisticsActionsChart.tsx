import { useMemo, useState } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
} from 'recharts';
import { useI18n } from '@shared/i18n';
import { StatisticsWidgetEmpty } from './StatisticsWidgetEmpty';
import { StatisticsChartAnchor } from './StatisticsRechartsPortalTooltip';
import type { StatisticsDailyPoint } from './statisticsChartTypes';
import { formatChartHours, niceAxisMax } from './statisticsChartLayout';
import {
    CHART_BILLABLE_COLOR,
    CHART_BILLABLE_FILL,
    CHART_NON_BILLABLE_COLOR,
    CHART_NON_BILLABLE_FILL,
} from './statisticsChartColors';
import {
    ACTIVE_DOT,
    CHART_CROSSHAIR_CURSOR,
    CHART_TOOLTIP,
    computeNumericSummary,
    formatVsAvgDelta,
    GRID_STROKE,
    LINE_ANIMATION,
    StatisticsChartSummaryBar,
    StatisticsLinePortalTooltip,
    StatisticsSeriesLegend,
    TICK_FILL,
    useHiddenSeriesKeys,
    xAxisInterval,
    xAxisLabelAngle,
} from './statisticsInteractiveCharts';

const SERIES_BILLABLE = 'primary';
const SERIES_NON_BILLABLE = 'secondary';

type ActionsChartProps = {
    data: StatisticsDailyPoint[];
    title: string;
    hint: string;
};

export function StatisticsActionsChart({ data, title, hint }: ActionsChartProps) {
    const { t } = useI18n();
    const s = 'timeTrackingPage.statistics';
    const { hidden, toggle, isVisible } = useHiddenSeriesKeys();
    const [activeSeries, setActiveSeries] = useState<string | undefined>();
    const [activeLabel, setActiveLabel] = useState<string | undefined>();

    const hasNonBillable = data.some((p) => p.secondary > 0);

    const summary = useMemo(() => {
        if (!data.length)
            return { avgTotal: 0, sumTotal: 0, sumBillable: 0, yMax: 10, peak: 0 };
        const totals = data.map((p) => {
            let total = 0;
            if (isVisible(SERIES_BILLABLE))
                total += p.primary;
            if (isVisible(SERIES_NON_BILLABLE))
                total += p.secondary;
            return total;
        });
        const numeric = computeNumericSummary(totals);
        const sumBillable = data.reduce((acc, p) => acc + p.primary, 0);
        return {
            avgTotal: numeric.avg,
            sumTotal: numeric.total,
            sumBillable,
            yMax: niceAxisMax(numeric.peak),
            peak: numeric.peak,
        };
    }, [data, isVisible]);

    const activePoint = useMemo(
        () => (activeLabel ? data.find((p) => p.dateLabel === activeLabel) : undefined),
        [activeLabel, data],
    );

    const activeValue = useMemo(() => {
        if (!activePoint)
            return undefined;
        if (activeSeries === SERIES_BILLABLE)
            return activePoint.primary;
        if (activeSeries === SERIES_NON_BILLABLE)
            return activePoint.secondary;
        let total = 0;
        if (isVisible(SERIES_BILLABLE))
            total += activePoint.primary;
        if (isVisible(SERIES_NON_BILLABLE))
            total += activePoint.secondary;
        return total;
    }, [activePoint, activeSeries, isVisible]);

    const series = useMemo(() => {
        const items = [
            { key: SERIES_BILLABLE, label: t(`${s}.series.billable`), color: CHART_BILLABLE_COLOR },
        ];
        if (hasNonBillable)
            items.push({ key: SERIES_NON_BILLABLE, label: t(`${s}.series.nonBillable`), color: CHART_NON_BILLABLE_COLOR });
        return items;
    }, [hasNonBillable, t, s]);

    const labelAngle = xAxisLabelAngle(data.length);

    return (
        <article className="tt-statistics__chart-card tt-statistics__chart-card--period">
            <div className="tt-statistics__chart-head">
                <div className="tt-statistics__chart-head-start">
                    <h2 className="tt-statistics__chart-title">{title}</h2>
                    <p className="tt-statistics__chart-subtitle">{hint}</p>
                </div>
            </div>

            <div className="tt-statistics__chart-area tt-statistics__chart-area--period">
                {!data.length ? (
                    <StatisticsWidgetEmpty />
                ) : (
                    <div className="tt-statistics__line-widget tt-statistics__line-widget--period">
                        {series.length > 1 ? (
                            <StatisticsSeriesLegend
                                items={series}
                                hidden={hidden}
                                activeKey={activeSeries}
                                onToggle={toggle}
                                onHover={setActiveSeries}
                            />
                        ) : null}
                        <StatisticsChartSummaryBar
                            summary={{
                                total: summary.sumTotal,
                                avg: summary.avgTotal,
                                peak: summary.peak,
                                min: 0,
                            }}
                            activeLabel={activePoint?.dateLabel}
                            activeValue={activeValue}
                            labels={{
                                avg: t(`${s}.chartAvgPerDay`),
                                total: t(`${s}.chartTotalPeriod`),
                                peak: t(`${s}.chartPeak`),
                                point: t(`${s}.chartPoint`),
                            }}
                            vsAvgText={activeValue != null
                                ? t(`${s}.chartVsAvg`).replace('{delta}', formatVsAvgDelta(activeValue, summary.avgTotal).text)
                                : undefined}
                        />
                        <StatisticsChartAnchor>
                            <ResponsiveContainer width="100%" height={320}>
                                <ComposedChart
                                    data={data}
                                    margin={{ top: 12, right: 44, bottom: 4, left: 0 }}
                                    stackOffset="none"
                                    onMouseMove={(state) => {
                                        if (state?.activeLabel != null)
                                            setActiveLabel(String(state.activeLabel));
                                    }}
                                    onMouseLeave={() => setActiveLabel(undefined)}
                                >
                                    <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="dateLabel"
                                        tick={{ fontSize: 11, fill: TICK_FILL, fontFamily: 'inherit' }}
                                        axisLine={{ stroke: GRID_STROKE }}
                                        tickLine={false}
                                        interval={xAxisInterval(data.length)}
                                        angle={labelAngle}
                                        textAnchor="end"
                                        height={labelAngle < -45 ? 52 : 36}
                                        dy={labelAngle < -45 ? 4 : 0}
                                    />
                                    <YAxis
                                        domain={[0, summary.yMax]}
                                        tickFormatter={(v) => formatChartHours(Number(v))}
                                        tick={{ fontSize: 11, fill: TICK_FILL, fontFamily: 'inherit' }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={40}
                                    />
                                    <Tooltip
                                        content={(
                                            <StatisticsLinePortalTooltip
                                                average={summary.avgTotal}
                                                vsAvgLabel={(delta) => t(`${s}.chartVsAvg`).replace('{delta}', delta)}
                                                footer={(
                                                    <p className="tt-statistics__tooltip-foot tt-statistics__tooltip-foot--muted">
                                                        {t(`${s}.widgets.total`)}: {formatChartHours(activePoint ? activePoint.primary + activePoint.secondary : summary.avgTotal)}
                                                    </p>
                                                )}
                                            />
                                        )}
                                        cursor={CHART_CROSSHAIR_CURSOR}
                                        {...CHART_TOOLTIP}
                                    />
                                    <ReferenceLine
                                        y={Math.round(summary.avgTotal * 10) / 10}
                                        stroke="#3b82f6"
                                        strokeDasharray="4 4"
                                        strokeOpacity={activePoint ? 0.9 : 0.5}
                                        label={{
                                            value: formatChartHours(summary.avgTotal),
                                            position: 'right',
                                            fill: '#3b82f6',
                                            fontSize: 10,
                                        }}
                                    />
                                    {hasNonBillable && isVisible(SERIES_NON_BILLABLE) ? (
                                        <Area
                                            type="monotone"
                                            dataKey="secondary"
                                            name={t(`${s}.series.nonBillable`)}
                                            stackId="hours"
                                            stroke={CHART_NON_BILLABLE_COLOR}
                                            fill={CHART_NON_BILLABLE_FILL}
                                            strokeWidth={2}
                                            strokeOpacity={activeSeries && activeSeries !== SERIES_NON_BILLABLE ? 0.3 : 1}
                                            dot={false}
                                            activeDot={{ ...ACTIVE_DOT, fill: CHART_NON_BILLABLE_COLOR, stroke: CHART_NON_BILLABLE_COLOR }}
                                            {...LINE_ANIMATION}
                                        />
                                    ) : null}
                                    {isVisible(SERIES_BILLABLE) ? (
                                        <Area
                                            type="monotone"
                                            dataKey="primary"
                                            name={t(`${s}.series.billable`)}
                                            stackId="hours"
                                            stroke={CHART_BILLABLE_COLOR}
                                            fill={CHART_BILLABLE_FILL}
                                            strokeWidth={2}
                                            strokeOpacity={activeSeries && activeSeries !== SERIES_BILLABLE ? 0.3 : 1}
                                            dot={false}
                                            activeDot={{ ...ACTIVE_DOT, fill: CHART_BILLABLE_COLOR, stroke: CHART_BILLABLE_COLOR }}
                                            {...LINE_ANIMATION}
                                        />
                                    ) : null}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </StatisticsChartAnchor>
                    </div>
                )}
            </div>
        </article>
    );
}
