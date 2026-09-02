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

const CHART_NAVY = '#2c4a6e';
const CHART_GOLD = '#9a8548';
const CHART_GRID = 'var(--app-border, #e4eaf0)';
const CHART_TICK = 'var(--app-muted, #64748b)';
const CHART_GRADIENT_ID = 'expRepAreaGrad';

const TYPE_PALETTE = ['#2c4a6e', '#9a8548', '#4d6b5c', '#6b5e52', '#3d5a80', '#8a6a4a', '#5c6b7a', '#7a5348', '#4a5568'];

const STATUS_CHART_COLORS: Record<string, string> = {
    'Черновик': '#8a8175',
    'На согласовании': '#c2782a',
    'На доработку': '#6b5b95',
    'Одобрено': '#2f5f8f',
    'Оплачено': '#3d6b5c',
    'Отказано': '#a15c4a',
    'Отозвана': '#7a756c',
    'Закрыто': '#5c6b7a',
    'Невозмещаемый': '#6b5e52',
};

const PAYMENT_PALETTE = ['#2c4a6e', '#9a8548', '#4d6b5c', '#6b5e52', '#5c6b7a'];

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

function statusFill(name: string, index: number): string {
    return STATUS_CHART_COLORS[name] ?? TYPE_PALETTE[index % TYPE_PALETTE.length];
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

function ChartLegend({ rows, total }: { rows: ChartRow[]; total: number }) {
    if (rows.length === 0)
        return null;
    return (
        <ul className="exp-report-chart-legend">
            {rows.map((row) => {
                const pct = total > 0 ? Math.round((100 * row.value) / total) : 0;
                return (
                    <li key={row.name} className="exp-report-chart-legend__item">
                        <span className="exp-report-chart-legend__swatch" style={{ background: row.fill }} />
                        <span className="exp-report-chart-legend__name">{row.name}</span>
                        <span className="exp-report-chart-legend__pct">{pct}%</span>
                    </li>
                );
            })}
        </ul>
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
    const pieTotal = pieStyled.reduce((sum, row) => sum + row.value, 0);
    const axisTick = { fontSize: 11, fill: CHART_TICK };

    return (
        <div className="exp-report-analytics__grid">
            <div className="exp-report-chart-card">
                <h3 className="exp-report-chart-card__title">Структура по типам</h3>
                <p className="exp-report-chart-card__subtitle">Доля суммы, UZS</p>
                <div className="exp-report-chart-card__plot exp-report-chart-card__plot--pie">
                    <div className="exp-report-chart-card__pie-wrap">
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie
                                    data={pieStyled}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={62}
                                    outerRadius={88}
                                    paddingAngle={1.5}
                                    stroke="var(--app-surface, #fff)"
                                    strokeWidth={2}
                                >
                                    {pieStyled.map(entry => (<Cell key={entry.name} fill={entry.fill} />))}
                                </Pie>
                                <Tooltip content={<ReportChartTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <ChartLegend rows={pieStyled} total={pieTotal} />
                </div>
            </div>

            <div className="exp-report-chart-card">
                <h3 className="exp-report-chart-card__title">Топ категорий</h3>
                <p className="exp-report-chart-card__subtitle">Сумма UZS по типу</p>
                <div className="exp-report-chart-card__plot">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart layout="vertical" data={byTypeRanked} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="0" stroke={CHART_GRID} horizontal vertical={false} />
                            <XAxis type="number" tick={axisTick} axisLine={{ stroke: CHART_GRID }} tickLine={false} tickFormatter={v => (typeof v === 'number' ? formatUzsCompact(v) : '')} />
                            <YAxis type="category" dataKey="name" width={118} tick={axisTick} axisLine={false} tickLine={false} />
                            <Tooltip content={<ReportChartTooltip />} />
                            <Bar dataKey="value" name="Сумма" fill={CHART_NAVY} radius={[0, 3, 3, 0]} maxBarSize={18} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="exp-report-chart-card exp-report-chart-card--span2">
                <h3 className="exp-report-chart-card__title">Динамика по месяцам</h3>
                <p className="exp-report-chart-card__subtitle">Объём по дате расхода</p>
                <div className="exp-report-chart-card__plot exp-report-chart-card__plot--trend">
                    <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={byMonthLabeled} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
                            <defs>
                                <linearGradient id={CHART_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={CHART_GOLD} stopOpacity={0.28} />
                                    <stop offset="100%" stopColor={CHART_GOLD} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="0" stroke={CHART_GRID} vertical={false} />
                            <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: CHART_GRID }} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={v => (typeof v === 'number' ? formatUzsCompact(v) : '')} />
                            <Tooltip content={<ReportChartTooltip />} />
                            <Area type="monotone" dataKey="uzs" name="Сумма" stroke={CHART_NAVY} strokeWidth={2} fill={`url(#${CHART_GRADIENT_ID})`} dot={{ r: 2.5, fill: CHART_NAVY, strokeWidth: 0 }} activeDot={{ r: 5, fill: CHART_NAVY }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="exp-report-chart-card">
                <h3 className="exp-report-chart-card__title">По статусам</h3>
                <p className="exp-report-chart-card__subtitle">Сумма UZS</p>
                <div className="exp-report-chart-card__plot">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart layout="vertical" data={byStatusSorted} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="0" stroke={CHART_GRID} horizontal vertical={false} />
                            <XAxis type="number" tick={axisTick} axisLine={{ stroke: CHART_GRID }} tickLine={false} tickFormatter={v => (typeof v === 'number' ? formatUzsCompact(v) : '')} />
                            <YAxis type="category" dataKey="name" width={108} tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ReportChartTooltip />} />
                            <Bar dataKey="value" name="Сумма" radius={[0, 3, 3, 0]} maxBarSize={18}>
                                {byStatusSorted.map((row, i) => (<Cell key={row.name} fill={statusFill(row.name, i)} />))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="exp-report-chart-card">
                <h3 className="exp-report-chart-card__title">Способ оплаты</h3>
                <p className="exp-report-chart-card__subtitle">Сумма UZS</p>
                <div className="exp-report-chart-card__plot">
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={byPayment} margin={{ top: 8, right: 12, left: 4, bottom: 56 }}>
                            <CartesianGrid strokeDasharray="0" stroke={CHART_GRID} vertical={false} />
                            <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} axisLine={{ stroke: CHART_GRID }} tickLine={false} interval={0} angle={-18} textAnchor="end" height={52} />
                            <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={v => (typeof v === 'number' ? formatUzsCompact(v) : '')} />
                            <Tooltip content={<ReportChartTooltip />} />
                            <Bar dataKey="value" name="Сумма" radius={[3, 3, 0, 0]} maxBarSize={36}>
                                {byPayment.map((row, i) => (<Cell key={row.name} fill={PAYMENT_PALETTE[i % PAYMENT_PALETTE.length]} />))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
