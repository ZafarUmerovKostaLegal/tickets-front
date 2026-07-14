import { useCallback, useMemo, useState } from 'react';
import {
    Area,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Sector,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { PieSectorShapeProps } from 'recharts';
import { formatVacationLateMinutesTotal } from '../lib/vacationAttendanceStats';

const CHART_LATE = '#f59e0b';
const CHART_ABSENT = '#ef4444';
const GRID_STROKE = 'var(--app-border, #e2e8f0)';
const TICK_FILL = 'var(--app-muted, #94a3b8)';
const AVG_LINE = '#3b82f6';

const LINE_ANIMATION = {
    isAnimationActive: true,
    animationDuration: 650,
    animationEasing: 'ease-out' as const,
};

const BAR_ANIMATION = {
    isAnimationActive: true,
    animationDuration: 550,
    animationEasing: 'ease-out' as const,
};

const PIE_ANIMATION = {
    isAnimationActive: true,
    animationBegin: 0,
    animationDuration: 600,
    animationEasing: 'ease-out' as const,
};

const ACTIVE_DOT = { r: 5, strokeWidth: 2, stroke: 'var(--app-surface, #fff)' };
const CROSSHAIR = { stroke: 'var(--app-muted, #94a3b8)', strokeWidth: 1, strokeDasharray: '4 4' };

type TopMetric = 'count' | 'minutes';

type TopLateRow = {
    name: string;
    fullName: string;
    late: number;
    minutes: number;
    value: number;
};

type PieRow = {
    name: string;
    value: number;
    color: string;
};

type MonthRow = {
    monthLabel: string;
    late: number;
    absent: number;
};

type ChartTooltipPayload = {
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
    payload?: {
        fullName?: string;
        minutes?: number;
        late?: number;
        absent?: number;
        monthLabel?: string;
    };
};

function StatsEmpty({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="vac-att-stats__empty-state" role="status">
            <span className="vac-att-stats__empty-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="M7 14l3-3 3 2 5-6" />
                </svg>
            </span>
            <p className="vac-att-stats__empty-title">{title}</p>
            {subtitle ? <p className="vac-att-stats__empty-sub">{subtitle}</p> : null}
        </div>
    );
}

function StatsChartTooltip({ active, label, payload, metric }: {
    active?: boolean;
    label?: string;
    payload?: ChartTooltipPayload[];
    metric?: TopMetric;
}) {
    if (!active || !payload?.length)
        return null;
    const row = payload[0]?.payload;
    return (
        <div className="vac-att-stats__tooltip">
            {(row?.fullName ?? label) != null && (row?.fullName ?? label) !== '' && (
                <div className="vac-att-stats__tooltip-title">{row?.fullName ?? label}</div>
            )}
            <ul className="vac-att-stats__tooltip-list">
                {payload.map((p, i) => {
                    const raw = typeof p.value === 'number' ? p.value : 0;
                    const formatted = metric === 'minutes' && (p.dataKey === 'value' || p.dataKey === 'minutes')
                        ? formatVacationLateMinutesTotal(raw)
                        : raw.toLocaleString('ru-RU');
                    return (
                        <li key={`${p.dataKey ?? i}`} className="vac-att-stats__tooltip-row">
                            <span className="vac-att-stats__tooltip-dot" style={{ background: p.color }} />
                            <span>{p.name ?? p.dataKey}</span>
                            <strong>{formatted}</strong>
                        </li>
                    );
                })}
                {row?.minutes != null && row.minutes > 0 && metric !== 'minutes' && (
                    <li className="vac-att-stats__tooltip-row vac-att-stats__tooltip-row--sub">
                        <span>Сумма опозданий</span>
                        <strong>{formatVacationLateMinutesTotal(row.minutes)}</strong>
                    </li>
                )}
            </ul>
        </div>
    );
}

function makePieShape(activeName?: string) {
    return function renderPieShape(props: PieSectorShapeProps) {
        const isHighlighted = Boolean(props.isActive) || (activeName != null && props.name === activeName);
        const outerRadius = isHighlighted
            ? Number(props.outerRadius ?? 0) + 6
            : props.outerRadius;
        return (
            <Sector
                {...props}
                outerRadius={outerRadius}
                stroke="var(--app-surface, #fff)"
                strokeWidth={2}
            />
        );
    };
}

function sharePercent(value: number, total: number): number {
    if (total <= 0)
        return 0;
    return Math.round((value / total) * 1000) / 10;
}

function niceAxisMax(peak: number): number {
    if (peak <= 0)
        return 4;
    const padded = peak * 1.15;
    const mag = 10 ** Math.floor(Math.log10(padded));
    const norm = padded / mag;
    const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
    return Math.ceil(nice * mag);
}

export type VacationAttendanceStatsChartsProps = {
    topMetric: TopMetric;
    onTopMetricChange: (metric: TopMetric) => void;
    topLateChart: TopLateRow[];
    pieData: PieRow[];
    monthStats: MonthRow[];
};

export function VacationAttendanceStatsCharts({
    topMetric,
    onTopMetricChange,
    topLateChart,
    pieData,
    monthStats,
}: VacationAttendanceStatsChartsProps) {
    const [activePieName, setActivePieName] = useState<string | undefined>();
    const [hiddenPie, setHiddenPie] = useState<Set<string>>(() => new Set());
    const [hiddenMonths, setHiddenMonths] = useState<Set<string>>(() => new Set());
    const [activeMonthSeries, setActiveMonthSeries] = useState<string | undefined>();
    const [activeMonthLabel, setActiveMonthLabel] = useState<string | undefined>();

    const visiblePie = useMemo(
        () => pieData.filter((d) => !hiddenPie.has(d.name)),
        [pieData, hiddenPie],
    );
    const pieTotal = useMemo(
        () => visiblePie.reduce((s, d) => s + d.value, 0),
        [visiblePie],
    );
    const pieShape = useMemo(() => makePieShape(activePieName), [activePieName]);
    const activePieSlice = useMemo(
        () => (activePieName ? visiblePie.find((d) => d.name === activePieName) : undefined),
        [activePieName, visiblePie],
    );

    const togglePieHidden = useCallback((name: string) => {
        setHiddenPie((prev) => {
            if (prev.has(name)) {
                const next = new Set(prev);
                next.delete(name);
                return next;
            }
            const wouldRemain = pieData.filter((d) => !prev.has(d.name) && d.name !== name);
            if (wouldRemain.length === 0)
                return prev;
            const next = new Set(prev);
            next.add(name);
            return next;
        });
    }, [pieData]);

    const clearPieHover = useCallback(() => setActivePieName(undefined), []);

    const monthVisibleLate = !hiddenMonths.has('late');
    const monthVisibleAbsent = !hiddenMonths.has('absent');

    const monthSummary = useMemo(() => {
        const totals = monthStats.map((m) => {
            let n = 0;
            if (monthVisibleLate)
                n += m.late;
            if (monthVisibleAbsent)
                n += m.absent;
            return n;
        });
        const sum = totals.reduce((a, b) => a + b, 0);
        const peak = totals.reduce((a, b) => Math.max(a, b), 0);
        const avg = totals.length ? sum / totals.length : 0;
        return { sum, peak, avg, yMax: niceAxisMax(peak) };
    }, [monthStats, monthVisibleLate, monthVisibleAbsent]);

    const activeMonthPoint = useMemo(
        () => (activeMonthLabel ? monthStats.find((m) => m.monthLabel === activeMonthLabel) : undefined),
        [activeMonthLabel, monthStats],
    );

    const toggleMonthSeries = useCallback((key: string) => {
        setHiddenMonths((prev) => {
            if (prev.has(key)) {
                const next = new Set(prev);
                next.delete(key);
                return next;
            }
            const next = new Set(prev);
            next.add(key);
            if (next.has('late') && next.has('absent'))
                return prev;
            return next;
        });
    }, []);

    const barGradientId = 'vac-att-late-bar-grad';
    const lateAreaId = 'vac-att-late-area';
    const absentAreaId = 'vac-att-absent-area';

    return (
        <div className="vac-att-stats__charts">
            <section className="vac-att-stats__card vac-att-stats__card--top">
                <div className="vac-att-stats__card-head">
                    <div>
                        <h2 className="vac-att-stats__card-title">Кто чаще опаздывает</h2>
                        <p className="vac-att-stats__card-sub">Топ‑10 сотрудников за период</p>
                    </div>
                    <div className="vac-att-stats__metric-toggle" role="group" aria-label="Метрика рейтинга">
                        <button
                            type="button"
                            className={`vac-att-stats__metric-btn${topMetric === 'count' ? ' vac-att-stats__metric-btn--on' : ''}`}
                            onClick={() => onTopMetricChange('count')}
                        >
                            По количеству
                        </button>
                        <button
                            type="button"
                            className={`vac-att-stats__metric-btn${topMetric === 'minutes' ? ' vac-att-stats__metric-btn--on' : ''}`}
                            onClick={() => onTopMetricChange('minutes')}
                        >
                            По сумме времени
                        </button>
                    </div>
                </div>
                {topLateChart.length === 0 ? (
                    <StatsEmpty
                        title="За выбранный период опозданий нет"
                        subtitle="График появится, когда будут зафиксированы опоздания"
                    />
                ) : (
                    <div className="vac-att-stats__chart">
                        <ResponsiveContainer width="100%" height={Math.max(260, topLateChart.length * 40)}>
                            <BarChart data={topLateChart} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
                                <defs>
                                    <linearGradient id={barGradientId} x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor={CHART_LATE} stopOpacity={0.55} />
                                        <stop offset="100%" stopColor={CHART_LATE} stopOpacity={1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" horizontal={false} />
                                <XAxis
                                    type="number"
                                    allowDecimals={false}
                                    tick={{ fontSize: 11, fill: TICK_FILL, fontFamily: 'inherit' }}
                                    axisLine={{ stroke: GRID_STROKE }}
                                    tickLine={false}
                                    tickFormatter={(v) => (topMetric === 'minutes' ? formatVacationLateMinutesTotal(Number(v)) : String(v))}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={132}
                                    tick={{ fontSize: 11, fill: TICK_FILL, fontFamily: 'inherit' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    content={<StatsChartTooltip metric={topMetric} />}
                                    cursor={{ fill: 'color-mix(in srgb, var(--app-muted, #94a3b8) 10%, transparent)' }}
                                />
                                <Bar
                                    dataKey="value"
                                    name={topMetric === 'minutes' ? 'Сумма опозданий' : 'Опозданий'}
                                    fill={`url(#${barGradientId})`}
                                    radius={[0, 8, 8, 0]}
                                    barSize={18}
                                    {...BAR_ANIMATION}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </section>

            <section className="vac-att-stats__card vac-att-stats__card--side">
                <div className="vac-att-stats__card-head">
                    <div>
                        <h2 className="vac-att-stats__card-title">Соотношение</h2>
                        <p className="vac-att-stats__card-sub">Опоздания и отсутствия</p>
                    </div>
                </div>
                {pieData.length === 0 ? (
                    <StatsEmpty title="Нет данных за период" subtitle="Donut-диаграмма заполнится при появлении нарушений" />
                ) : (
                    <div className="vac-att-stats__pie-widget">
                        <ul className="vac-att-stats__pie-legend" aria-label="Легенда соотношения">
                            {pieData.map((entry) => {
                                const hidden = hiddenPie.has(entry.name);
                                const isActive = !hidden && activePieName === entry.name;
                                const pct = sharePercent(entry.value, pieTotal || pieData.reduce((s, d) => s + d.value, 0));
                                return (
                                    <li key={entry.name}>
                                        <button
                                            type="button"
                                            className={[
                                                'vac-att-stats__pie-legend-item',
                                                isActive ? ' vac-att-stats__pie-legend-item--active' : '',
                                                hidden ? ' vac-att-stats__pie-legend-item--hidden' : '',
                                            ].join('')}
                                            aria-pressed={!hidden}
                                            onMouseEnter={() => {
                                                if (!hidden)
                                                    setActivePieName(entry.name);
                                            }}
                                            onMouseLeave={clearPieHover}
                                            onClick={() => togglePieHidden(entry.name)}
                                        >
                                            <span className="vac-att-stats__pie-legend-dot" style={{ backgroundColor: entry.color }} />
                                            <span className="vac-att-stats__pie-legend-text">{entry.name}</span>
                                            <span className="vac-att-stats__pie-legend-meta">
                                                {entry.value.toLocaleString('ru-RU')} · {pct}%
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                        <div
                            className={`vac-att-stats__pie-wrap${activePieSlice ? ' vac-att-stats__pie-wrap--active' : ''}`}
                            onMouseLeave={clearPieHover}
                        >
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={visiblePie}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="52%"
                                        outerRadius="78%"
                                        paddingAngle={2}
                                        {...PIE_ANIMATION}
                                        shape={pieShape}
                                        onMouseEnter={(_entry, index) => {
                                            const name = visiblePie[index]?.name;
                                            if (name)
                                                setActivePieName(name);
                                        }}
                                        onMouseLeave={clearPieHover}
                                    >
                                        {visiblePie.map((entry) => (
                                            <Cell
                                                key={entry.name}
                                                fill={entry.color}
                                                opacity={activePieName && entry.name !== activePieName ? 0.38 : 1}
                                                style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<StatsChartTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className={`vac-att-stats__pie-center${activePieSlice ? ' vac-att-stats__pie-center--hover' : ''}`}>
                                <span className="vac-att-stats__pie-center-label">
                                    {activePieSlice?.name ?? 'Всего'}
                                </span>
                                <span className="vac-att-stats__pie-center-value">
                                    {(activePieSlice?.value ?? pieTotal).toLocaleString('ru-RU')}
                                </span>
                                <span className="vac-att-stats__pie-center-sub">
                                    {activePieSlice
                                        ? `${sharePercent(activePieSlice.value, pieTotal)}%`
                                        : `${visiblePie.length} типа`}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <section className="vac-att-stats__card vac-att-stats__card--months">
                <div className="vac-att-stats__card-head">
                    <div>
                        <h2 className="vac-att-stats__card-title">По месяцам</h2>
                        <p className="vac-att-stats__card-sub">Динамика опозданий и отсутствий</p>
                    </div>
                    <div className="vac-att-stats__series-legend" role="group" aria-label="Серии графика">
                        <button
                            type="button"
                            className={`vac-att-stats__series-btn${!monthVisibleLate ? ' vac-att-stats__series-btn--off' : ''}${activeMonthSeries === 'late' ? ' vac-att-stats__series-btn--active' : ''}`}
                            onClick={() => toggleMonthSeries('late')}
                            onMouseEnter={() => setActiveMonthSeries('late')}
                            onMouseLeave={() => setActiveMonthSeries(undefined)}
                        >
                            <i style={{ background: CHART_LATE }} />
                            Опоздания
                        </button>
                        <button
                            type="button"
                            className={`vac-att-stats__series-btn${!monthVisibleAbsent ? ' vac-att-stats__series-btn--off' : ''}${activeMonthSeries === 'absent' ? ' vac-att-stats__series-btn--active' : ''}`}
                            onClick={() => toggleMonthSeries('absent')}
                            onMouseEnter={() => setActiveMonthSeries('absent')}
                            onMouseLeave={() => setActiveMonthSeries(undefined)}
                        >
                            <i style={{ background: CHART_ABSENT }} />
                            Отсутствия
                        </button>
                    </div>
                </div>

                <div className="vac-att-stats__chart-summary" aria-hidden={!activeMonthPoint}>
                    <span>
                        Итого: <strong>{monthSummary.sum.toLocaleString('ru-RU')}</strong>
                    </span>
                    <span>
                        Среднее/мес: <strong>{Math.round(monthSummary.avg * 10) / 10}</strong>
                    </span>
                    <span>
                        Пик: <strong>{monthSummary.peak.toLocaleString('ru-RU')}</strong>
                    </span>
                    {activeMonthPoint ? (
                        <span className="vac-att-stats__chart-summary-point">
                            {activeMonthPoint.monthLabel}:{' '}
                            <strong>
                                {(
                                    (monthVisibleLate ? activeMonthPoint.late : 0)
                                    + (monthVisibleAbsent ? activeMonthPoint.absent : 0)
                                ).toLocaleString('ru-RU')}
                            </strong>
                        </span>
                    ) : null}
                </div>

                <div className="vac-att-stats__chart vac-att-stats__chart--months">
                    <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart
                            data={monthStats}
                            margin={{ top: 12, right: 40, left: 0, bottom: 4 }}
                            onMouseMove={(state) => {
                                if (state?.activeLabel != null)
                                    setActiveMonthLabel(String(state.activeLabel));
                            }}
                            onMouseLeave={() => setActiveMonthLabel(undefined)}
                        >
                            <defs>
                                <linearGradient id={lateAreaId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={CHART_LATE} stopOpacity={0.4} />
                                    <stop offset="100%" stopColor={CHART_LATE} stopOpacity={0.02} />
                                </linearGradient>
                                <linearGradient id={absentAreaId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={CHART_ABSENT} stopOpacity={0.35} />
                                    <stop offset="100%" stopColor={CHART_ABSENT} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke={GRID_STROKE} vertical={false} strokeDasharray="3 3" />
                            <XAxis
                                dataKey="monthLabel"
                                tick={{ fontSize: 11, fill: TICK_FILL, fontFamily: 'inherit' }}
                                axisLine={{ stroke: GRID_STROKE }}
                                tickLine={false}
                            />
                            <YAxis
                                domain={[0, monthSummary.yMax]}
                                allowDecimals={false}
                                tick={{ fontSize: 11, fill: TICK_FILL, fontFamily: 'inherit' }}
                                axisLine={false}
                                tickLine={false}
                                width={36}
                            />
                            <Tooltip content={<StatsChartTooltip />} cursor={CROSSHAIR} />
                            {monthSummary.avg > 0 ? (
                                <ReferenceLine
                                    y={Math.round(monthSummary.avg * 10) / 10}
                                    stroke={AVG_LINE}
                                    strokeDasharray="4 4"
                                    strokeOpacity={activeMonthPoint ? 0.9 : 0.45}
                                    label={{
                                        value: String(Math.round(monthSummary.avg * 10) / 10),
                                        position: 'right',
                                        fill: AVG_LINE,
                                        fontSize: 10,
                                    }}
                                />
                            ) : null}
                            {monthVisibleAbsent ? (
                                <Area
                                    type="monotone"
                                    dataKey="absent"
                                    name="Отсутствия"
                                    stroke={CHART_ABSENT}
                                    fill={`url(#${absentAreaId})`}
                                    strokeWidth={2.25}
                                    strokeOpacity={activeMonthSeries && activeMonthSeries !== 'absent' ? 0.3 : 1}
                                    dot={false}
                                    activeDot={{ ...ACTIVE_DOT, fill: CHART_ABSENT }}
                                    {...LINE_ANIMATION}
                                />
                            ) : null}
                            {monthVisibleLate ? (
                                <Area
                                    type="monotone"
                                    dataKey="late"
                                    name="Опоздания"
                                    stroke={CHART_LATE}
                                    fill={`url(#${lateAreaId})`}
                                    strokeWidth={2.25}
                                    strokeOpacity={activeMonthSeries && activeMonthSeries !== 'late' ? 0.3 : 1}
                                    dot={false}
                                    activeDot={{ ...ACTIVE_DOT, fill: CHART_LATE }}
                                    {...LINE_ANIMATION}
                                />
                            ) : null}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </section>
        </div>
    );
}
