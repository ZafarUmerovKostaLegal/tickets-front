import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { formatVacationLateMinutesTotal } from '../lib/vacationAttendanceStats';

const CHART_LATE = '#f59e0b';
const CHART_ABSENT = '#ef4444';

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
    };
};

function StatsChartTooltip({ active, label, payload }: {
    active?: boolean;
    label?: string;
    payload?: ChartTooltipPayload[];
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
                {payload.map((p, i) => (
                    <li key={`${p.dataKey ?? i}`} className="vac-att-stats__tooltip-row">
                        <span className="vac-att-stats__tooltip-dot" style={{ background: p.color }} />
                        <span>{p.name ?? p.dataKey}</span>
                        <strong>{typeof p.value === 'number' ? p.value.toLocaleString('ru-RU') : p.value}</strong>
                    </li>
                ))}
                {row?.minutes != null && row.minutes > 0 && (
                    <li className="vac-att-stats__tooltip-row vac-att-stats__tooltip-row--sub">
                        <span>Сумма опозданий</span>
                        <strong>{formatVacationLateMinutesTotal(row.minutes)}</strong>
                    </li>
                )}
            </ul>
        </div>
    );
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
    return (
        <div className="vac-att-stats__charts">
            <section className="vac-att-stats__card vac-att-stats__card--top">
                <div className="vac-att-stats__card-head">
                    <h2 className="vac-att-stats__card-title">Кто чаще опаздывает</h2>
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
                    <p className="vac-att-stats__empty">За выбранный период опозданий нет.</p>
                ) : (
                    <div className="vac-att-stats__chart">
                        <ResponsiveContainer width="100%" height={Math.max(240, topLateChart.length * 38)}>
                            <BarChart data={topLateChart} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis
                                    type="number"
                                    allowDecimals={false}
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={(v) => (topMetric === 'minutes' ? formatVacationLateMinutesTotal(Number(v)) : String(v))}
                                />
                                <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 11 }} />
                                <Tooltip content={<StatsChartTooltip />} />
                                <Bar
                                    dataKey="value"
                                    name={topMetric === 'minutes' ? 'Сумма опозданий' : 'Опозданий'}
                                    fill={CHART_LATE}
                                    radius={[0, 4, 4, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </section>

            <section className="vac-att-stats__card vac-att-stats__card--side">
                <h2 className="vac-att-stats__card-title">Соотношение</h2>
                {pieData.length === 0 ? (
                    <p className="vac-att-stats__empty">Нет данных за период.</p>
                ) : (
                    <div className="vac-att-stats__chart vac-att-stats__chart--pie">
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={52}
                                    outerRadius={82}
                                    paddingAngle={2}
                                >
                                    {pieData.map((entry) => (
                                        <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<StatsChartTooltip />} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </section>

            <section className="vac-att-stats__card vac-att-stats__card--months">
                <h2 className="vac-att-stats__card-title">По месяцам</h2>
                <div className="vac-att-stats__chart">
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={monthStats} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                            <Tooltip content={<StatsChartTooltip />} />
                            <Legend />
                            <Bar dataKey="late" name="Опоздания" fill={CHART_LATE} radius={[3, 3, 0, 0]} />
                            <Bar dataKey="absent" name="Отсутствия" fill={CHART_ABSENT} radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>
        </div>
    );
}
