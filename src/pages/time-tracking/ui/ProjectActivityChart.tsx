import { useMemo, useState } from 'react';
import {
    Area,
    CartesianGrid,
    ComposedChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { useI18n } from '@shared/i18n';

const CHART_BILLABLE_COLOR = '#4f46e5';
const CHART_NON_BILLABLE_COLOR = '#a5b4fc';
const CHART_BILLABLE_FILL = 'rgba(79, 70, 229, 0.28)';
const CHART_NON_BILLABLE_FILL = 'rgba(165, 180, 252, 0.55)';
const GRID_STROKE = 'var(--app-border, #e2e8f0)';
const TICK_FILL = 'var(--app-muted, #64748b)';

export type ProjectActivityDay = {
    date: string;
    date_label?: string;
    billable_hours: number;
    total_hours: number;
};

type ChartPoint = {
    date: string;
    dateLabel: string;
    billable: number;
    other: number;
    total: number;
};

type Props = {
    days: ProjectActivityDay[];
    title: string;
    hint: string;
};

function shortDayLabel(date: string, dateLabel?: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [, month, day] = date.split('-');
        return `${day}.${month}`;
    }
    const parts = (dateLabel || date).trim().split(/\s+/);
    if (parts.length >= 2)
        return `${parts[0]} ${parts[1]}`;
    return dateLabel || date;
}

function niceAxisMax(maxValue: number): number {
    if (maxValue <= 0)
        return 10;
    const padded = maxValue * 1.22;
    const exp = 10 ** Math.floor(Math.log10(padded));
    const factor = padded / exp;
    const nice = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10;
    return nice * exp;
}

function xAxisInterval(count: number): number | 'preserveStartEnd' {
    if (count <= 12)
        return 0;
    if (count <= 24)
        return 1;
    if (count <= 48)
        return 2;
    return 'preserveStartEnd';
}

type TooltipProps = {
    active?: boolean;
    payload?: Array<{ payload?: ChartPoint; dataKey?: string | number; value?: number; name?: string; color?: string }>;
    label?: string;
    average: number;
    vsAvgLabel: (delta: string) => string;
    billableLabel: string;
    otherLabel: string;
    totalLabel: string;
};

function ActivityTooltip({
    active,
    payload,
    average,
    vsAvgLabel,
    billableLabel,
    otherLabel,
    totalLabel,
}: TooltipProps) {
    if (!active || !payload?.length)
        return null;
    const row = payload[0]?.payload;
    if (!row)
        return null;
    const delta = row.total - average;
    const deltaText = `${delta >= 0 ? '+' : '−'}${fmtH(Math.abs(delta))}`;
    return (
        <div className="tt-statistics-project__tooltip">
            <div className="tt-statistics-project__tooltip-title">{row.dateLabel}</div>
            <div className="tt-statistics-project__tooltip-row">
                <span style={{ color: CHART_BILLABLE_COLOR }}>{billableLabel}</span>
                <strong>{fmtH(row.billable)}</strong>
            </div>
            {row.other > 0 ? (
                <div className="tt-statistics-project__tooltip-row">
                    <span style={{ color: CHART_NON_BILLABLE_COLOR }}>{otherLabel}</span>
                    <strong>{fmtH(row.other)}</strong>
                </div>
            ) : null}
            <div className="tt-statistics-project__tooltip-row tt-statistics-project__tooltip-row--total">
                <span>{totalLabel}</span>
                <strong>{fmtH(row.total)}</strong>
            </div>
            <p className="tt-statistics-project__tooltip-foot">{vsAvgLabel(deltaText)}</p>
        </div>
    );
}

export function ProjectActivityChart({ days, title, hint }: Props) {
    const { t } = useI18n();
    const [activeLabel, setActiveLabel] = useState<string | undefined>();

    const data = useMemo<ChartPoint[]>(() => {
        return days.map((d) => {
            const total = Math.max(0, d.total_hours);
            const billable = Math.max(0, Math.min(total, d.billable_hours));
            return {
                date: d.date,
                dateLabel: shortDayLabel(d.date, d.date_label),
                billable,
                other: Math.max(0, total - billable),
                total,
            };
        });
    }, [days]);

    const summary = useMemo(() => {
        if (!data.length)
            return { avg: 0, total: 0, peak: 0, yMax: 10 };
        const totals = data.map((p) => p.total);
        const sum = totals.reduce((a, b) => a + b, 0);
        const peak = Math.max(...totals);
        return {
            avg: sum / totals.length,
            total: sum,
            peak,
            yMax: niceAxisMax(peak),
        };
    }, [data]);

    const hasNonBillable = data.some((p) => p.other > 0);
    const activePoint = activeLabel ? data.find((p) => p.dateLabel === activeLabel) : undefined;
    const labelAngle = data.length > 18 ? -35 : 0;

    return (
        <section className="tt-statistics-project__chart" aria-label={title}>
            <div className="tt-statistics-project__chart-head">
                <h4 className="tt-statistics-project__section-title">{title}</h4>
                <p className="tt-statistics-project__section-hint">{hint}</p>
            </div>

            <div className="tt-statistics-project__chart-summary" aria-label={t('timeTrackingPage.statistics.chartSummaryAria')}>
                <div className="tt-statistics-project__chart-stat">
                    <span>{t('timeTrackingPage.statistics.chartAvgPerDay')}</span>
                    <strong>{fmtH(summary.avg)}</strong>
                </div>
                <div className="tt-statistics-project__chart-stat">
                    <span>{t('timeTrackingPage.statistics.chartTotalPeriod')}</span>
                    <strong>{fmtH(summary.total)}</strong>
                </div>
                <div className="tt-statistics-project__chart-stat">
                    <span>{t('timeTrackingPage.statistics.chartPeak')}</span>
                    <strong>{fmtH(summary.peak)}</strong>
                </div>
                {activePoint ? (
                    <div className="tt-statistics-project__chart-stat tt-statistics-project__chart-stat--active">
                        <span>{t('timeTrackingPage.statistics.chartPoint')}</span>
                        <strong>{activePoint.dateLabel}: {fmtH(activePoint.total)}</strong>
                    </div>
                ) : null}
            </div>

            {hasNonBillable ? (
                <ul className="tt-statistics-project__chart-legend" aria-hidden>
                    <li>
                        <span className="tt-statistics-project__chart-legend-dot" style={{ background: CHART_BILLABLE_COLOR }} />
                        {t('timeTrackingPage.statistics.series.billable')}
                    </li>
                    <li>
                        <span className="tt-statistics-project__chart-legend-dot" style={{ background: CHART_NON_BILLABLE_COLOR }} />
                        {t('timeTrackingPage.statistics.series.nonBillable')}
                    </li>
                </ul>
            ) : null}

            <div className="tt-statistics-project__chart-plot">
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart
                        data={data}
                        margin={{ top: 12, right: 48, bottom: labelAngle ? 8 : 0, left: 0 }}
                        onMouseMove={(state) => {
                            if (state?.activeLabel != null)
                                setActiveLabel(String(state.activeLabel));
                        }}
                        onMouseLeave={() => setActiveLabel(undefined)}
                    >
                        <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="dateLabel"
                            tick={{ fontSize: 11, fill: TICK_FILL }}
                            axisLine={{ stroke: GRID_STROKE }}
                            tickLine={false}
                            interval={xAxisInterval(data.length)}
                            angle={labelAngle}
                            textAnchor={labelAngle ? 'end' : 'middle'}
                            height={labelAngle ? 48 : 28}
                        />
                        <YAxis
                            domain={[0, summary.yMax]}
                            tickFormatter={(v: number) => fmtH(Number(v) || 0)}
                            tick={{ fontSize: 11, fill: TICK_FILL }}
                            axisLine={false}
                            tickLine={false}
                            width={52}
                        />
                        <Tooltip
                            cursor={{ stroke: CHART_BILLABLE_COLOR, strokeWidth: 1, strokeDasharray: '4 4' }}
                            content={(
                                <ActivityTooltip
                                    average={summary.avg}
                                    vsAvgLabel={(delta) => t('timeTrackingPage.statistics.chartVsAvg').replace('{delta}', delta)}
                                    billableLabel={t('timeTrackingPage.statistics.series.billable')}
                                    otherLabel={t('timeTrackingPage.statistics.series.nonBillable')}
                                    totalLabel={t('timeTrackingPage.statistics.widgets.total')}
                                />
                            )}
                        />
                        <ReferenceLine
                            y={Math.round(summary.avg * 10) / 10}
                            stroke="#3b82f6"
                            strokeDasharray="4 4"
                            strokeOpacity={0.7}
                            label={{
                                value: fmtH(summary.avg),
                                position: 'right',
                                fill: '#3b82f6',
                                fontSize: 10,
                            }}
                        />
                        {hasNonBillable ? (
                            <Area
                                type="monotone"
                                dataKey="other"
                                name={t('timeTrackingPage.statistics.series.nonBillable')}
                                stackId="hours"
                                stroke={CHART_NON_BILLABLE_COLOR}
                                fill={CHART_NON_BILLABLE_FILL}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, fill: CHART_NON_BILLABLE_COLOR, stroke: '#fff', strokeWidth: 2 }}
                            />
                        ) : null}
                        <Area
                            type="monotone"
                            dataKey="billable"
                            name={t('timeTrackingPage.statistics.series.billable')}
                            stackId="hours"
                            stroke={CHART_BILLABLE_COLOR}
                            fill={CHART_BILLABLE_FILL}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: CHART_BILLABLE_COLOR, stroke: '#fff', strokeWidth: 2 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}
