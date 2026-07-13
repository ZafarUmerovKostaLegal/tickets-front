import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Area,
    ComposedChart,
} from 'recharts';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#94a3b8'];
const CHART_GRADIENT_ID = 'expRepAreaGrad';

type ChartRow = {
    name: string;
    value: number;
    fill?: string;
};

type MonthRow = {
    label: string;
    uzs: number;
};

type TooltipPayload = {
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
};

function formatUzsCompact(n: number): string {
    if (!Number.isFinite(n))
        return '—';
    const abs = Math.abs(n);
    if (abs >= 1000000000)
        return `${(n / 1000000000).toFixed(2).replace(/\.?0+$/, '')} млрд`;
    if (abs >= 1000000)
        return `${(n / 1000000).toFixed(2).replace(/\.?0+$/, '')} млн`;
    if (abs >= 1000)
        return `${Math.round(n / 1000)} тыс`;
    return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

function ReportChartTooltip({ active, label, payload }: {
    active?: boolean;
    label?: string;
    payload?: TooltipPayload[];
}) {
    if (!active || !payload?.length)
        return null;
    return (
        <div className="exp-report-chart-tooltip">
            {label != null && label !== '' ? <div className="exp-report-chart-tooltip__title">{label}</div> : null}
            <ul className="exp-report-chart-tooltip__list">
                {payload.map((p, i) => (
                    <li key={`${p.dataKey ?? i}`} className="exp-report-chart-tooltip__row">
                        <span className="exp-report-chart-tooltip__dot" style={{ background: p.color }} />
                        <span className="exp-report-chart-tooltip__name">{p.name ?? p.dataKey}</span>
                        <span className="exp-report-chart-tooltip__val">
                            {typeof p.value === 'number' ? `${p.value.toLocaleString('ru-RU')} UZS` : p.value}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export type ExpensesReportChartsProps = {
    pieStyled: ChartRow[];
    byTypeRanked: ChartRow[];
    byMonthLabeled: MonthRow[];
    byStatusSorted: ChartRow[];
    byPayment: ChartRow[];
};

export function ExpensesReportCharts({
    pieStyled,
    byTypeRanked,
    byMonthLabeled,
    byStatusSorted,
    byPayment,
}: ExpensesReportChartsProps) {
    return (
        <div className="exp-report-analytics__grid">
            <div className="exp-report-chart-card exp-report-chart-card--glass">
                <h3 className="exp-report-chart-card__title">Структура по типам</h3>
                <p className="exp-report-chart-card__subtitle">Доля суммы, UZS</p>
                <div className="exp-report-chart-card__plot exp-report-chart-card__plot--pie">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={pieStyled}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="48%"
                                innerRadius={58}
                                outerRadius={92}
                                paddingAngle={2}
                                label={({ name, percent }) => percent != null && percent >= 0.05 ? `${name} · ${Math.round(percent * 100)}%` : ''}
                                labelLine={{ stroke: 'var(--app-border, #cbd5e1)' }}
                            >
                                {pieStyled.map(entry => (<Cell key={entry.name} fill={entry.fill} />))}
                            </Pie>
                            <Tooltip content={<ReportChartTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="exp-report-chart-card exp-report-chart-card--glass">
                <h3 className="exp-report-chart-card__title">Топ категорий</h3>
                <p className="exp-report-chart-card__subtitle">Сумма UZS по типу</p>
                <div className="exp-report-chart-card__plot">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart layout="vertical" data={byTypeRanked} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border, #e2e8f0)" horizontal />
                            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => (typeof v === 'number' ? formatUzsCompact(v) : '')} />
                            <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 11 }} />
                            <Tooltip content={<ReportChartTooltip />} />
                            <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                                {byTypeRanked.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="exp-report-chart-card exp-report-chart-card--glass exp-report-chart-card--span2">
                <h3 className="exp-report-chart-card__title">Динамика по месяцам</h3>
                <p className="exp-report-chart-card__subtitle">Нарастающий объём по дате расхода</p>
                <div className="exp-report-chart-card__plot exp-report-chart-card__plot--trend">
                    <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart data={byMonthLabeled} margin={{ top: 16, right: 20, left: 4, bottom: 8 }}>
                            <defs>
                                <linearGradient id={CHART_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.04} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border, #e2e8f0)" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (typeof v === 'number' ? formatUzsCompact(v) : '')} />
                            <Tooltip content={<ReportChartTooltip />} />
                            <Area type="monotone" dataKey="uzs" stroke="#4f46e5" strokeWidth={2.5} fill={`url(#${CHART_GRADIENT_ID})`} dot={{ r: 3, fill: '#4f46e5', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="exp-report-chart-card exp-report-chart-card--glass">
                <h3 className="exp-report-chart-card__title">По статусам</h3>
                <p className="exp-report-chart-card__subtitle">UZS</p>
                <div className="exp-report-chart-card__plot">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart layout="vertical" data={byStatusSorted} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border, #e2e8f0)" horizontal />
                            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => (typeof v === 'number' ? formatUzsCompact(v) : '')} />
                            <YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 10 }} />
                            <Tooltip content={<ReportChartTooltip />} />
                            <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                                {byStatusSorted.map((_, i) => (<Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="exp-report-chart-card exp-report-chart-card--glass">
                <h3 className="exp-report-chart-card__title">Способ оплаты</h3>
                <p className="exp-report-chart-card__subtitle">UZS</p>
                <div className="exp-report-chart-card__plot">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={byPayment} margin={{ top: 8, right: 12, left: 4, bottom: 64 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border, #e2e8f0)" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={58} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (typeof v === 'number' ? formatUzsCompact(v) : '')} />
                            <Tooltip content={<ReportChartTooltip />} />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                {byPayment.map((_, i) => (<Cell key={i} fill={CHART_COLORS[(i + 4) % CHART_COLORS.length]} />))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
