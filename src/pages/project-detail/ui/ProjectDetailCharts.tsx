import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ReferenceArea,
    Dot,
    Cell,
} from 'recharts';
import { formatDecimalHoursRu } from '@shared/lib/formatTrackingHours';

type WeekPoint = {
    idx: number;
    dayLabel: string;
    value: number;
    isThisWeek: boolean;
    isMonthStart: boolean;
    monthName: string;
    year: string;
    stackBillable?: number;
    stackNonBillable?: number;
};

type ProjectProgressChartMode = 'money' | 'billable_hours_cumulative';

function fmtAmt(n: number, cur = 'UZS') {
    return `${n.toLocaleString('ru-RU', { useGrouping: true, maximumFractionDigits: 2 })} ${cur}`;
}

function fmtAmtShort(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1000000)
        return `${(n / 1000000).toFixed(1)}M`;
    if (abs >= 1000)
        return `${(n / 1000).toFixed(0)}K`;
    return String(n);
}

function MonthWeekTick(props: {
    x?: number | string;
    y?: number | string;
    payload?: { value: number };
    chartData: WeekPoint[];
}) {
    const { x = 0, y = 0, payload, chartData } = props;
    const item = chartData[payload?.value ?? 0];
    if (!item)
        return null;
    if (item.isMonthStart) {
        return (
            <g transform={`translate(${x},${y})`}>
                <line x1={0} y1={0} x2={0} y2={8} stroke="#d1d5db" strokeWidth={1} />
                <text x={0} y={22} textAnchor="middle" fill="#6b7280" fontSize={11} fontWeight={600} fontFamily="inherit">
                    {item.monthName}
                </text>
                <text x={0} y={34} textAnchor="middle" fill="#9ca3af" fontSize={10} fontFamily="inherit">
                    {item.year}
                </text>
            </g>
        );
    }
    return (
        <g transform={`translate(${x},${y})`}>
            <line x1={0} y1={0} x2={0} y2={4} stroke="#e5e7eb" strokeWidth={1} />
        </g>
    );
}

function ProgressTooltip({ active, payload, currency, budget, mode }: {
    active?: boolean;
    payload?: { payload: WeekPoint; value: number }[];
    currency: string;
    budget?: number;
    mode: ProjectProgressChartMode;
}) {
    if (!active || !payload?.length)
        return null;
    const item = payload[0].payload;
    const spent = payload[0].value;
    const weekNum = item.idx + 1;
    if (mode === 'billable_hours_cumulative') {
        return (
            <div className="pdp__tooltip pdp__tooltip--rich">
                <p className="pdp__tooltip-head">
                    На {item.dayLabel} (Нед.&nbsp;{weekNum})
                </p>
                <div className="pdp__tooltip-cols">
                    <div className="pdp__tooltip-col">
                        <span className="pdp__tooltip-col-label">Оплачиваемые часы (нарастающий итог)</span>
                        <span className="pdp__tooltip-col-val">{formatDecimalHoursRu(spent)} ч</span>
                    </div>
                </div>
                <p className="pdp__tooltip-note">Суммы по ставкам недоступны — задайте почасовые ставки сотрудникам.</p>
            </div>
        );
    }
    const remaining = budget != null ? budget - spent : null;
    const isOver = remaining != null && remaining < 0;
    return (
        <div className="pdp__tooltip pdp__tooltip--rich">
            <p className="pdp__tooltip-head">
                Нарастающим итогом на {item.dayLabel} (Нед.&nbsp;{weekNum})
            </p>
            <div className="pdp__tooltip-cols">
                <div className="pdp__tooltip-col">
                    <span className="pdp__tooltip-col-label">Потрачено</span>
                    <span className="pdp__tooltip-col-val">{fmtAmt(spent, currency)}</span>
                </div>
                {budget != null ? (
                    <div className="pdp__tooltip-col">
                        <span className="pdp__tooltip-col-label">Остаток бюджета</span>
                        <span className={`pdp__tooltip-col-val${isOver ? ' pdp__tooltip-col-val--red' : ' pdp__tooltip-col-val--green'}`}>
                            {isOver ? '−' : ''}{fmtAmt(Math.abs(remaining!), currency)}
                        </span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function HoursTooltip({ active, payload }: {
    active?: boolean;
    payload?: { payload: WeekPoint; value: number }[];
}) {
    if (!active || !payload?.length)
        return null;
    const item = payload[0].payload;
    const weekNum = item.idx + 1;
    const sb = item.stackBillable;
    const sn = item.stackNonBillable;
    const stacked = sb != null && sn != null;
    return (
        <div className="pdp__tooltip pdp__tooltip--rich">
            <p className="pdp__tooltip-head">
                {item.dayLabel} (Нед.&nbsp;{weekNum})
            </p>
            <div className="pdp__tooltip-cols">
                {stacked ? (
                    <>
                        <div className="pdp__tooltip-col">
                            <span className="pdp__tooltip-col-label">Оплачиваемые</span>
                            <span className="pdp__tooltip-col-val">{formatDecimalHoursRu(sb)} ч</span>
                        </div>
                        <div className="pdp__tooltip-col">
                            <span className="pdp__tooltip-col-label">Неоплачиваемые</span>
                            <span className="pdp__tooltip-col-val">{formatDecimalHoursRu(sn)} ч</span>
                        </div>
                        <div className="pdp__tooltip-col">
                            <span className="pdp__tooltip-col-label">Всего</span>
                            <span className="pdp__tooltip-col-val">{formatDecimalHoursRu(sb + sn)} ч</span>
                        </div>
                    </>
                ) : (
                    <div className="pdp__tooltip-col">
                        <span className="pdp__tooltip-col-label">Часов за неделю</span>
                        <span className="pdp__tooltip-col-val">{formatDecimalHoursRu(payload[0].value)} ч</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function CustomBar(props: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    isThisWeek?: boolean;
}) {
    const { x = 0, y = 0, width = 0, height = 0, isThisWeek } = props;
    return <rect x={x} y={y} width={width} height={height} rx={3} ry={3} fill={isThisWeek ? '#4f46e5' : '#93c5fd'} />;
}

export type ProjectDetailChartsProps = {
    chartTab: 'progress' | 'hours';
    onChartTabChange: (tab: 'progress' | 'hours') => void;
    dashboardOk: boolean;
    progressMode: ProjectProgressChartMode;
    progressData: WeekPoint[];
    hoursData: WeekPoint[];
    hoverIdx: number | null;
    onHoverIdxChange: (idx: number | null) => void;
    thisWeekIdx: number;
    monthBoundaries: WeekPoint[];
    hasBudget: boolean;
    budgetLimitForChart: number | null;
    displayCurrency: string;
    hoursChartStacked: boolean;
    yTicks: number[];
    maxVal: number;
};

export function ProjectDetailCharts({
    chartTab,
    onChartTabChange,
    dashboardOk,
    progressMode,
    progressData,
    hoursData,
    hoverIdx,
    onHoverIdxChange,
    thisWeekIdx,
    monthBoundaries,
    hasBudget,
    budgetLimitForChart,
    displayCurrency,
    hoursChartStacked,
    yTicks,
    maxVal,
}: ProjectDetailChartsProps) {
    return (
        <div className="pdp__chart-card">
            <div className="pdp__chart-tabs">
                <button type="button" className={`pdp__chart-tab${chartTab === 'progress' ? ' pdp__chart-tab--active' : ''}`} onClick={() => onChartTabChange('progress')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    Прогресс проекта
                </button>
                <button type="button" className={`pdp__chart-tab${chartTab === 'hours' ? ' pdp__chart-tab--active' : ''}`} onClick={() => onChartTabChange('hours')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    Часы по неделям
                </button>
            </div>

            {dashboardOk && progressMode === 'billable_hours_cumulative' && chartTab === 'progress' ? (
                <p className="pdp__chart-hint" role="note">
                    По ставкам сумма за период — 0; на графике показан нарастающий объём оплачиваемых часов. Чтобы увидеть
                    деньги, задайте почасовые ставки (биллинг) сотрудникам в учёте времени.
                </p>
            ) : null}

            <div className="pdp__chart-area">
                {chartTab === 'progress' ? (
                    <ResponsiveContainer width="100%" height={310}>
                        <LineChart
                            data={progressData}
                            margin={{ top: 24, right: 28, bottom: 28, left: 8 }}
                            onMouseMove={(s) => {
                                const payload = (s as {
                                    activePayload?: Array<{ payload?: { idx?: number } }>;
                                })?.activePayload?.[0]?.payload;
                                const idx = payload?.idx;
                                if (idx !== undefined)
                                    onHoverIdxChange(idx);
                            }}
                            onMouseLeave={() => onHoverIdxChange(null)}
                        >
                            <CartesianGrid stroke="#f0f0f0" strokeDasharray="0" vertical={false} />
                            {hoverIdx !== null && hoverIdx !== thisWeekIdx ? (
                                <ReferenceArea x1={hoverIdx - 0.5} x2={hoverIdx + 0.5} fill="rgba(0,0,0,0.05)" ifOverflow="visible" />
                            ) : null}
                            {monthBoundaries.map(d => (<ReferenceLine key={d.idx} x={d.idx} stroke="#e5e7eb" strokeWidth={1} />))}
                            <ReferenceArea x1={thisWeekIdx - 0.5} x2={thisWeekIdx + 0.5} fill="rgba(37,99,235,0.08)" label={{ value: 'Эта неделя', position: 'insideTopRight', fontSize: 11, fill: '#6b7280', dy: -12, dx: -4 }} />
                            {hasBudget && progressMode === 'money' && budgetLimitForChart != null && budgetLimitForChart > 0 ? (
                                <ReferenceLine
                                    y={budgetLimitForChart}
                                    stroke="#ef4444"
                                    strokeWidth={1.5}
                                    label={{
                                        value: `Бюджет: ${fmtAmtShort(budgetLimitForChart)}`,
                                        position: 'insideTopLeft',
                                        fill: '#fff',
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                    }}
                                />
                            ) : null}
                            <XAxis dataKey="idx" type="number" domain={[0, progressData.length - 1]} ticks={progressData.map(d => d.idx)} tick={(p) => <MonthWeekTick {...p} chartData={progressData} />} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} interval={0} height={44} />
                            <YAxis
                                tickFormatter={progressMode === 'money' ? fmtAmtShort : (v: number) => formatDecimalHoursRu(Number(v))}
                                tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'inherit' }}
                                axisLine={false}
                                tickLine={false}
                                width={56}
                                ticks={yTicks}
                                domain={[0, maxVal]}
                            />
                            <Tooltip content={<ProgressTooltip mode={progressMode} currency={displayCurrency} budget={progressMode === 'money' ? budgetLimitForChart ?? undefined : undefined} />} cursor={false} offset={12} />
                            <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2.5} dot={<Dot r={4} fill="#ef4444" stroke="#fff" strokeWidth={2} />} activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2.5 }} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : null}
                {chartTab === 'hours' ? (
                    <ResponsiveContainer width="100%" height={310}>
                        <BarChart
                            data={hoursData}
                            margin={{ top: 24, right: 28, bottom: 28, left: 8 }}
                            barCategoryGap="35%"
                            onMouseMove={(s) => {
                                const payload = (s as {
                                    activePayload?: Array<{ payload?: { idx?: number } }>;
                                })?.activePayload?.[0]?.payload;
                                const idx = payload?.idx;
                                if (idx !== undefined)
                                    onHoverIdxChange(idx);
                            }}
                            onMouseLeave={() => onHoverIdxChange(null)}
                        >
                            <CartesianGrid stroke="#f0f0f0" strokeDasharray="0" vertical={false} />
                            {monthBoundaries.map(d => (<ReferenceLine key={d.idx} x={d.idx} stroke="#e5e7eb" strokeWidth={1} />))}
                            <ReferenceArea x1={thisWeekIdx - 0.5} x2={thisWeekIdx + 0.5} fill="rgba(37,99,235,0.08)" label={{ value: 'Эта неделя', position: 'insideTopRight', fontSize: 11, fill: '#6b7280', dy: -12, dx: -4 }} />
                            <XAxis dataKey="idx" type="number" domain={[0, hoursData.length - 1]} ticks={hoursData.map(d => d.idx)} tick={(p) => <MonthWeekTick {...p} chartData={hoursData} />} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} interval={0} height={44} />
                            <YAxis tick={{ fontSize: 11, fill: '#9ca3af', fontFamily: 'inherit' }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `${v}`} />
                            <Tooltip content={<HoursTooltip />} cursor={false} offset={12} />
                            {hoursChartStacked ? (
                                <>
                                    <Bar dataKey="stackNonBillable" stackId="weekH" radius={[0, 0, 0, 0]}>
                                        {hoursData.map((entry, i) => (<Cell key={`pdp-h-nb-${i}`} fill={entry.isThisWeek ? '#a5b4fc' : '#c7d2fe'} />))}
                                    </Bar>
                                    <Bar dataKey="stackBillable" stackId="weekH" radius={[3, 3, 0, 0]}>
                                        {hoursData.map((entry, i) => (<Cell key={`pdp-h-b-${i}`} fill={entry.isThisWeek ? '#4f46e5' : '#93c5fd'} />))}
                                    </Bar>
                                </>
                            ) : (
                                <Bar dataKey="value" shape={<CustomBar />} radius={[3, 3, 0, 0]} />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                ) : null}
            </div>
        </div>
    );
}
