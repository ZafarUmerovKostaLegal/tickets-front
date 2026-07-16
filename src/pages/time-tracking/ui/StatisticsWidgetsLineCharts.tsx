import { useMemo, useState } from 'react';
import {
    ResponsiveContainer,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    LineChart,
    Line,
    Area,
    ComposedChart,
    ReferenceLine,
} from 'recharts';
import { useI18n } from '@shared/i18n';
import { StatisticsWidgetEmpty } from './StatisticsWidgetEmpty';
import { StatisticsChartAnchor } from './StatisticsRechartsPortalTooltip';
import { formatChartHours, niceAxisMax } from './statisticsChartLayout';
import { CHART_BILLABLE_COLOR, CHART_NON_BILLABLE_COLOR } from './statisticsChartColors';
import type { DateLinePoint, MultiLinePoint, SimpleLinePoint } from './statisticsChartTypes';
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

const TIMELINE_COLORS = {
    primary: CHART_BILLABLE_COLOR,
    secondary: CHART_NON_BILLABLE_COLOR,
    tertiary: '#3b82f6',
} as const;

function lineOpacity(activeKey: string | undefined, seriesKey: string): number {
    if (!activeKey)
        return 1;
    return activeKey === seriesKey ? 1 : 0.28;
}

export function StatisticsProjectsTimelineChart({ data, seriesNames }: { data: MultiLinePoint[]; seriesNames: [string, string, string] }) {
    const { t } = useI18n();
    const s = 'timeTrackingPage.statistics';
    const { hidden, toggle, isVisible } = useHiddenSeriesKeys();
    const [activeSeries, setActiveSeries] = useState<string | undefined>();
    const [activeLabel, setActiveLabel] = useState<string | undefined>();

    const series = useMemo(() => ([
        { key: 'primary', label: seriesNames[0], color: TIMELINE_COLORS.primary },
        { key: 'secondary', label: seriesNames[1], color: TIMELINE_COLORS.secondary },
        { key: 'tertiary', label: seriesNames[2], color: TIMELINE_COLORS.tertiary },
    ]), [seriesNames]);

    const visibleValues = useMemo(() => {
        const values: number[] = [];
        for (const point of data) {
            if (isVisible('primary'))
                values.push(point.primary);
            if (isVisible('secondary'))
                values.push(point.secondary);
            if (isVisible('tertiary'))
                values.push(point.tertiary);
        }
        return values;
    }, [data, isVisible]);

    const summary = useMemo(() => computeNumericSummary(visibleValues), [visibleValues]);
    const activePoint = useMemo(() => {
        if (activeLabel == null)
            return undefined;
        const idx = Number(activeLabel);
        if (!Number.isFinite(idx))
            return undefined;
        return data[idx];
    }, [activeLabel, data]);

    const activeValue = activePoint && activeSeries
        ? Number(activePoint[activeSeries as keyof MultiLinePoint] ?? 0)
        : activePoint
            ? (isVisible('primary') ? activePoint.primary : 0)
                + (isVisible('secondary') ? activePoint.secondary : 0)
                + (isVisible('tertiary') ? activePoint.tertiary : 0)
            : undefined;

    if (!data.length)
        return <StatisticsWidgetEmpty />;

    return (
        <div className="tt-statistics__line-widget">
            <StatisticsSeriesLegend
                items={series}
                hidden={hidden}
                activeKey={activeSeries}
                onToggle={toggle}
                onHover={setActiveSeries}
            />
            <StatisticsChartSummaryBar
                summary={summary}
                activeLabel={activeLabel != null ? `#${Number(activeLabel) + 1}` : undefined}
                activeValue={activeValue}
                labels={{
                    avg: t(`${s}.chartAvgPerDay`),
                    total: t(`${s}.chartTotalPeriod`),
                    peak: t(`${s}.chartPeak`),
                    point: t(`${s}.chartPoint`),
                }}
                vsAvgText={activeValue != null
                    ? t(`${s}.chartVsAvg`).replace('{delta}', formatVsAvgDelta(activeValue, summary.avg).text)
                    : undefined}
            />
            <StatisticsChartAnchor>
                <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                        data={data}
                        margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
                        onMouseMove={(state) => {
                            if (state?.activeTooltipIndex != null)
                                setActiveLabel(String(state.activeTooltipIndex));
                        }}
                        onMouseLeave={() => setActiveLabel(undefined)}
                    >
                        <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="idx" tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={{ stroke: GRID_STROKE }} tickLine={false} interval={xAxisInterval(data.length)} />
                        <YAxis tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} width={32} tickFormatter={(v) => formatChartHours(Number(v))} />
                        <Tooltip
                            {...CHART_TOOLTIP}
                            cursor={CHART_CROSSHAIR_CURSOR}
                            content={<StatisticsLinePortalTooltip average={summary.avg} vsAvgLabel={(delta) => t(`${s}.chartVsAvg`).replace('{delta}', delta)} />}
                        />
                        {isVisible('primary') ? (
                            <Line type="monotone" dataKey="primary" name={seriesNames[0]} stroke={TIMELINE_COLORS.primary} strokeWidth={2} strokeOpacity={lineOpacity(activeSeries, 'primary')}
                                dot={{ r: 3, fill: '#fff', stroke: TIMELINE_COLORS.primary, strokeWidth: 1.5 }}
                                activeDot={{ ...ACTIVE_DOT, fill: TIMELINE_COLORS.primary, stroke: TIMELINE_COLORS.primary }}
                                {...LINE_ANIMATION} />
                        ) : null}
                        {isVisible('secondary') ? (
                            <Line type="monotone" dataKey="secondary" name={seriesNames[1]} stroke={TIMELINE_COLORS.secondary} strokeWidth={2} strokeOpacity={lineOpacity(activeSeries, 'secondary')}
                                dot={{ r: 3, fill: '#fff', stroke: TIMELINE_COLORS.secondary, strokeWidth: 1.5 }}
                                activeDot={{ ...ACTIVE_DOT, fill: TIMELINE_COLORS.secondary, stroke: TIMELINE_COLORS.secondary }}
                                {...LINE_ANIMATION} />
                        ) : null}
                        {isVisible('tertiary') ? (
                            <Line type="monotone" dataKey="tertiary" name={seriesNames[2]} stroke={TIMELINE_COLORS.tertiary} strokeWidth={2} strokeOpacity={lineOpacity(activeSeries, 'tertiary')}
                                dot={{ r: 3, fill: '#fff', stroke: TIMELINE_COLORS.tertiary, strokeWidth: 1.5 }}
                                activeDot={{ ...ACTIVE_DOT, fill: TIMELINE_COLORS.tertiary, stroke: TIMELINE_COLORS.tertiary }}
                                {...LINE_ANIMATION} />
                        ) : null}
                    </LineChart>
                </ResponsiveContainer>
            </StatisticsChartAnchor>
        </div>
    );
}

export function StatisticsHoursPerDayChart({ data }: { data: DateLinePoint[] }) {
    const { t } = useI18n();
    const s = 'timeTrackingPage.statistics';
    const w = 'timeTrackingPage.statistics.widgets';
    const { hidden, toggle, isVisible } = useHiddenSeriesKeys();
    const [activeSeries, setActiveSeries] = useState<string | undefined>();
    const [activeLabel, setActiveLabel] = useState<string | undefined>();
    const hasDual = data.some((p) => p.billable != null || p.nonBillable != null);

    const series = useMemo(() => (
        hasDual
            ? [
                { key: 'billable', label: t(`${w}.billable`), color: CHART_BILLABLE_COLOR },
                { key: 'nonBillable', label: t(`${w}.nonBillable`), color: CHART_NON_BILLABLE_COLOR },
                { key: 'value', label: t(`${w}.total`), color: '#0ea5e9' },
            ]
            : [{ key: 'value', label: t(`${s}.chartHoursSeries`), color: '#3b82f6' }]
    ), [hasDual, t, w, s]);

    const visibleValues = useMemo(() => {
        const values: number[] = [];
        for (const point of data) {
            if (hasDual) {
                if (isVisible('billable'))
                    values.push(point.billable ?? 0);
                if (isVisible('nonBillable'))
                    values.push(point.nonBillable ?? 0);
                if (isVisible('value'))
                    values.push(point.value);
            }
            else if (isVisible('value')) {
                values.push(point.value);
            }
        }
        return values;
    }, [data, hasDual, isVisible]);

    const summary = useMemo(() => computeNumericSummary(visibleValues), [visibleValues]);
    const activePoint = useMemo(
        () => (activeLabel ? data.find((p) => p.dateLabel === activeLabel) : undefined),
        [activeLabel, data],
    );
    const activeValue = activePoint
        ? (activeSeries === 'billable'
            ? (activePoint.billable ?? 0)
            : activeSeries === 'nonBillable'
                ? (activePoint.nonBillable ?? 0)
                : activePoint.value)
        : undefined;
    const yMax = useMemo(() => niceAxisMax(summary.peak), [summary.peak]);
    const labelAngle = xAxisLabelAngle(data.length);

    if (!data.length)
        return <StatisticsWidgetEmpty />;

    return (
        <div className="tt-statistics__line-widget">
            {hasDual ? (
                <StatisticsSeriesLegend
                    items={series}
                    hidden={hidden}
                    activeKey={activeSeries}
                    onToggle={toggle}
                    onHover={setActiveSeries}
                />
            ) : null}
            <StatisticsChartSummaryBar
                summary={summary}
                activeLabel={activePoint?.dateLabel}
                activeValue={activeValue}
                labels={{
                    avg: t(`${s}.chartAvgPerDay`),
                    total: t(`${s}.chartTotalPeriod`),
                    peak: t(`${s}.chartPeak`),
                    point: t(`${s}.chartPoint`),
                }}
                vsAvgText={activeValue != null
                    ? t(`${s}.chartVsAvg`).replace('{delta}', formatVsAvgDelta(activeValue, summary.avg).text)
                    : undefined}
            />
            <StatisticsChartAnchor>
                <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart
                        data={data}
                        margin={{ top: 12, right: 44, bottom: 4, left: 0 }}
                        onMouseMove={(state) => {
                            if (state?.activeLabel != null)
                                setActiveLabel(String(state.activeLabel));
                        }}
                        onMouseLeave={() => {
                            setActiveLabel(undefined);
                            setActiveSeries(undefined);
                        }}
                    >
                        <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="dateLabel"
                            tick={{ fontSize: 9, fill: TICK_FILL }}
                            axisLine={{ stroke: GRID_STROKE }}
                            tickLine={false}
                            angle={labelAngle}
                            textAnchor="end"
                            height={labelAngle < -45 ? 56 : 40}
                            interval={xAxisInterval(data.length)}
                        />
                        <YAxis domain={[0, yMax]} tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} width={32} tickFormatter={(v) => formatChartHours(Number(v))} />
                        <Tooltip
                            {...CHART_TOOLTIP}
                            cursor={CHART_CROSSHAIR_CURSOR}
                            content={(
                                <StatisticsLinePortalTooltip
                                    average={summary.avg}
                                    vsAvgLabel={(delta) => t(`${s}.chartVsAvg`).replace('{delta}', delta)}
                                />
                            )}
                        />
                        <ReferenceLine
                            y={Math.round(summary.avg * 10) / 10}
                            stroke="#3b82f6"
                            strokeDasharray="4 4"
                            strokeOpacity={activePoint ? 0.9 : 0.55}
                            label={{
                                value: formatChartHours(summary.avg),
                                position: 'right',
                                fill: '#3b82f6',
                                fontSize: 10,
                            }}
                        />
                        {hasDual && isVisible('billable') ? (
                            <Line
                                type="monotone"
                                dataKey="billable"
                                name={t(`${w}.billable`)}
                                stroke={CHART_BILLABLE_COLOR}
                                strokeWidth={2}
                                strokeOpacity={lineOpacity(activeSeries, 'billable')}
                                dot={{ r: 2.5, fill: CHART_BILLABLE_COLOR, stroke: '#fff', strokeWidth: 1 }}
                                activeDot={{ ...ACTIVE_DOT, fill: CHART_BILLABLE_COLOR, stroke: CHART_BILLABLE_COLOR }}
                                {...LINE_ANIMATION}
                            />
                        ) : null}
                        {hasDual && isVisible('nonBillable') ? (
                            <Line
                                type="monotone"
                                dataKey="nonBillable"
                                name={t(`${w}.nonBillable`)}
                                stroke={CHART_NON_BILLABLE_COLOR}
                                strokeWidth={2}
                                strokeOpacity={lineOpacity(activeSeries, 'nonBillable')}
                                dot={{ r: 2.5, fill: CHART_NON_BILLABLE_COLOR, stroke: '#fff', strokeWidth: 1 }}
                                activeDot={{ ...ACTIVE_DOT, fill: CHART_NON_BILLABLE_COLOR, stroke: CHART_NON_BILLABLE_COLOR }}
                                {...LINE_ANIMATION}
                            />
                        ) : null}
                        {isVisible('value') ? (
                            <>
                                <Area type="monotone" dataKey="value" fill="rgba(14,165,233,0.12)" stroke="none" {...LINE_ANIMATION} />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    name={hasDual ? t(`${w}.total`) : t(`${s}.chartHoursSeries`)}
                                    stroke={hasDual ? '#0ea5e9' : '#3b82f6'}
                                    strokeWidth={2}
                                    strokeOpacity={lineOpacity(activeSeries, 'value')}
                                    strokeDasharray={hasDual ? '4 3' : undefined}
                                    dot={{ r: 3, fill: hasDual ? '#0ea5e9' : '#3b82f6', stroke: '#fff', strokeWidth: 1.5 }}
                                    activeDot={{ ...ACTIVE_DOT, fill: hasDual ? '#0ea5e9' : '#3b82f6', stroke: hasDual ? '#0ea5e9' : '#3b82f6' }}
                                    {...LINE_ANIMATION}
                                />
                            </>
                        ) : null}
                    </ComposedChart>
                </ResponsiveContainer>
            </StatisticsChartAnchor>
        </div>
    );
}

export function StatisticsUserActivityChart({ data }: { data: SimpleLinePoint[] }) {
    const { t } = useI18n();
    const s = 'timeTrackingPage.statistics';
    const [activeLabel, setActiveLabel] = useState<string | undefined>();
    const summary = useMemo(() => computeNumericSummary(data.map((p) => p.value)), [data]);
    const activePoint = useMemo(() => {
        if (activeLabel == null)
            return undefined;
        const idx = Number(activeLabel);
        return Number.isFinite(idx) ? data[idx] : undefined;
    }, [activeLabel, data]);
    const yMax = useMemo(() => niceAxisMax(summary.peak), [summary.peak]);

    if (!data.length)
        return <StatisticsWidgetEmpty />;

    return (
        <div className="tt-statistics__line-widget">
            <StatisticsChartSummaryBar
                summary={summary}
                activeLabel={activePoint ? `#${activePoint.idx + 1}` : undefined}
                activeValue={activePoint?.value}
                labels={{
                    avg: t(`${s}.chartAvgPerDay`),
                    total: t(`${s}.chartTotalPeriod`),
                    peak: t(`${s}.chartPeak`),
                    point: t(`${s}.chartPoint`),
                }}
                vsAvgText={activePoint
                    ? t(`${s}.chartVsAvg`).replace('{delta}', formatVsAvgDelta(activePoint.value, summary.avg).text)
                    : undefined}
            />
            <StatisticsChartAnchor>
                <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart
                        data={data}
                        margin={{ top: 12, right: 44, bottom: 4, left: 0 }}
                        onMouseMove={(state) => {
                            if (state?.activeTooltipIndex != null)
                                setActiveLabel(String(state.activeTooltipIndex));
                        }}
                        onMouseLeave={() => setActiveLabel(undefined)}
                    >
                        <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="idx" tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={{ stroke: GRID_STROKE }} tickLine={false} interval={xAxisInterval(data.length)} />
                        <YAxis domain={[0, yMax]} tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} width={32} tickFormatter={(v) => formatChartHours(Number(v))} />
                        <Tooltip
                            {...CHART_TOOLTIP}
                            cursor={CHART_CROSSHAIR_CURSOR}
                            content={(
                                <StatisticsLinePortalTooltip
                                    average={summary.avg}
                                    vsAvgLabel={(delta) => t(`${s}.chartVsAvg`).replace('{delta}', delta)}
                                />
                            )}
                        />
                        <ReferenceLine
                            y={Math.round(summary.avg * 10) / 10}
                            stroke="#3b82f6"
                            strokeDasharray="4 4"
                            strokeOpacity={activePoint ? 0.9 : 0.55}
                            label={{ value: formatChartHours(summary.avg), position: 'right', fill: '#3b82f6', fontSize: 10 }}
                        />
                        <Area type="monotone" dataKey="value" fill="rgba(59,130,246,0.12)" stroke="none" {...LINE_ANIMATION} />
                        <Line
                            type="monotone"
                            dataKey="value"
                            name={t(`${s}.chartActivitySeries`)}
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#3b82f6', stroke: '#fff', strokeWidth: 1.5 }}
                            activeDot={{ ...ACTIVE_DOT, fill: '#3b82f6', stroke: '#3b82f6' }}
                            {...LINE_ANIMATION}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </StatisticsChartAnchor>
        </div>
    );
}
