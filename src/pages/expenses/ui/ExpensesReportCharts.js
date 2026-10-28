import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Area, ComposedChart, } from 'recharts';
const CHART_NAVY = '#2c4a6e';
const CHART_GOLD = '#9a8548';
const CHART_GRID = 'var(--app-border, #e4eaf0)';
const CHART_TICK = 'var(--app-muted, #64748b)';
const CHART_GRADIENT_ID = 'expRepAreaGrad';
const TYPE_PALETTE = ['#2c4a6e', '#9a8548', '#4d6b5c', '#6b5e52', '#3d5a80', '#8a6a4a', '#5c6b7a', '#7a5348', '#4a5568'];
const STATUS_CHART_COLORS = {
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
function formatUzsCompact(n) {
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
function statusFill(name, index) {
    return STATUS_CHART_COLORS[name] ?? TYPE_PALETTE[index % TYPE_PALETTE.length];
}
function ReportChartTooltip({ active, label, payload }) {
    if (!active || !payload?.length)
        return null;
    return (_jsxs("div", { className: "exp-report-chart-tooltip", children: [label != null && label !== '' ? _jsx("div", { className: "exp-report-chart-tooltip__title", children: label }) : null, _jsx("ul", { className: "exp-report-chart-tooltip__list", children: payload.map((p, i) => (_jsxs("li", { className: "exp-report-chart-tooltip__row", children: [_jsx("span", { className: "exp-report-chart-tooltip__dot", style: { background: p.color } }), _jsx("span", { className: "exp-report-chart-tooltip__name", children: p.name ?? p.dataKey }), _jsx("span", { className: "exp-report-chart-tooltip__val", children: typeof p.value === 'number' ? `${p.value.toLocaleString('ru-RU')} UZS` : p.value })] }, `${p.dataKey ?? i}`))) })] }));
}
function ChartLegend({ rows, total }) {
    if (rows.length === 0)
        return null;
    return (_jsx("ul", { className: "exp-report-chart-legend", children: rows.map((row) => {
            const pct = total > 0 ? Math.round((100 * row.value) / total) : 0;
            return (_jsxs("li", { className: "exp-report-chart-legend__item", children: [_jsx("span", { className: "exp-report-chart-legend__swatch", style: { background: row.fill } }), _jsx("span", { className: "exp-report-chart-legend__name", children: row.name }), _jsxs("span", { className: "exp-report-chart-legend__pct", children: [pct, "%"] })] }, row.name));
        }) }));
}
export function ExpensesReportCharts({ pieStyled, byTypeRanked, byMonthLabeled, byStatusSorted, byPayment, }) {
    const pieTotal = pieStyled.reduce((sum, row) => sum + row.value, 0);
    const axisTick = { fontSize: 11, fill: CHART_TICK };
    return (_jsxs("div", { className: "exp-report-analytics__grid", children: [_jsxs("div", { className: "exp-report-chart-card", children: [_jsx("h3", { className: "exp-report-chart-card__title", children: "\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u043F\u043E \u0442\u0438\u043F\u0430\u043C" }), _jsx("p", { className: "exp-report-chart-card__subtitle", children: "\u0414\u043E\u043B\u044F \u0441\u0443\u043C\u043C\u044B, UZS" }), _jsxs("div", { className: "exp-report-chart-card__plot exp-report-chart-card__plot--pie", children: [_jsx("div", { className: "exp-report-chart-card__pie-wrap", children: _jsx(ResponsiveContainer, { width: "100%", height: 240, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: pieStyled, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", innerRadius: 62, outerRadius: 88, paddingAngle: 1.5, stroke: "var(--app-surface, #fff)", strokeWidth: 2, children: pieStyled.map(entry => (_jsx(Cell, { fill: entry.fill }, entry.name))) }), _jsx(Tooltip, { content: _jsx(ReportChartTooltip, {}) })] }) }) }), _jsx(ChartLegend, { rows: pieStyled, total: pieTotal })] })] }), _jsxs("div", { className: "exp-report-chart-card", children: [_jsx("h3", { className: "exp-report-chart-card__title", children: "\u0422\u043E\u043F \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0439" }), _jsx("p", { className: "exp-report-chart-card__subtitle", children: "\u0421\u0443\u043C\u043C\u0430 UZS \u043F\u043E \u0442\u0438\u043F\u0443" }), _jsx("div", { className: "exp-report-chart-card__plot", children: _jsx(ResponsiveContainer, { width: "100%", height: 280, children: _jsxs(BarChart, { layout: "vertical", data: byTypeRanked, margin: { top: 4, right: 16, left: 4, bottom: 4 }, children: [_jsx(CartesianGrid, { strokeDasharray: "0", stroke: CHART_GRID, horizontal: true, vertical: false }), _jsx(XAxis, { type: "number", tick: axisTick, axisLine: { stroke: CHART_GRID }, tickLine: false, tickFormatter: v => (typeof v === 'number' ? formatUzsCompact(v) : '') }), _jsx(YAxis, { type: "category", dataKey: "name", width: 118, tick: axisTick, axisLine: false, tickLine: false }), _jsx(Tooltip, { content: _jsx(ReportChartTooltip, {}) }), _jsx(Bar, { dataKey: "value", name: "\u0421\u0443\u043C\u043C\u0430", fill: CHART_NAVY, radius: [0, 3, 3, 0], maxBarSize: 18 })] }) }) })] }), _jsxs("div", { className: "exp-report-chart-card exp-report-chart-card--span2", children: [_jsx("h3", { className: "exp-report-chart-card__title", children: "\u0414\u0438\u043D\u0430\u043C\u0438\u043A\u0430 \u043F\u043E \u043C\u0435\u0441\u044F\u0446\u0430\u043C" }), _jsx("p", { className: "exp-report-chart-card__subtitle", children: "\u041E\u0431\u044A\u0451\u043C \u043F\u043E \u0434\u0430\u0442\u0435 \u0440\u0430\u0441\u0445\u043E\u0434\u0430" }), _jsx("div", { className: "exp-report-chart-card__plot exp-report-chart-card__plot--trend", children: _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(ComposedChart, { data: byMonthLabeled, margin: { top: 12, right: 16, left: 4, bottom: 4 }, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: CHART_GRADIENT_ID, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: CHART_GOLD, stopOpacity: 0.28 }), _jsx("stop", { offset: "100%", stopColor: CHART_GOLD, stopOpacity: 0.02 })] }) }), _jsx(CartesianGrid, { strokeDasharray: "0", stroke: CHART_GRID, vertical: false }), _jsx(XAxis, { dataKey: "label", tick: axisTick, axisLine: { stroke: CHART_GRID }, tickLine: false, interval: "preserveStartEnd" }), _jsx(YAxis, { tick: axisTick, axisLine: false, tickLine: false, tickFormatter: v => (typeof v === 'number' ? formatUzsCompact(v) : '') }), _jsx(Tooltip, { content: _jsx(ReportChartTooltip, {}) }), _jsx(Area, { type: "monotone", dataKey: "uzs", name: "\u0421\u0443\u043C\u043C\u0430", stroke: CHART_NAVY, strokeWidth: 2, fill: `url(#${CHART_GRADIENT_ID})`, dot: { r: 2.5, fill: CHART_NAVY, strokeWidth: 0 }, activeDot: { r: 5, fill: CHART_NAVY } })] }) }) })] }), _jsxs("div", { className: "exp-report-chart-card", children: [_jsx("h3", { className: "exp-report-chart-card__title", children: "\u041F\u043E \u0441\u0442\u0430\u0442\u0443\u0441\u0430\u043C" }), _jsx("p", { className: "exp-report-chart-card__subtitle", children: "\u0421\u0443\u043C\u043C\u0430 UZS" }), _jsx("div", { className: "exp-report-chart-card__plot", children: _jsx(ResponsiveContainer, { width: "100%", height: 280, children: _jsxs(BarChart, { layout: "vertical", data: byStatusSorted, margin: { top: 4, right: 16, left: 4, bottom: 4 }, children: [_jsx(CartesianGrid, { strokeDasharray: "0", stroke: CHART_GRID, horizontal: true, vertical: false }), _jsx(XAxis, { type: "number", tick: axisTick, axisLine: { stroke: CHART_GRID }, tickLine: false, tickFormatter: v => (typeof v === 'number' ? formatUzsCompact(v) : '') }), _jsx(YAxis, { type: "category", dataKey: "name", width: 108, tick: { ...axisTick, fontSize: 10 }, axisLine: false, tickLine: false }), _jsx(Tooltip, { content: _jsx(ReportChartTooltip, {}) }), _jsx(Bar, { dataKey: "value", name: "\u0421\u0443\u043C\u043C\u0430", radius: [0, 3, 3, 0], maxBarSize: 18, children: byStatusSorted.map((row, i) => (_jsx(Cell, { fill: statusFill(row.name, i) }, row.name))) })] }) }) })] }), _jsxs("div", { className: "exp-report-chart-card", children: [_jsx("h3", { className: "exp-report-chart-card__title", children: "\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B" }), _jsx("p", { className: "exp-report-chart-card__subtitle", children: "\u0421\u0443\u043C\u043C\u0430 UZS" }), _jsx("div", { className: "exp-report-chart-card__plot", children: _jsx(ResponsiveContainer, { width: "100%", height: 280, children: _jsxs(BarChart, { data: byPayment, margin: { top: 8, right: 12, left: 4, bottom: 56 }, children: [_jsx(CartesianGrid, { strokeDasharray: "0", stroke: CHART_GRID, vertical: false }), _jsx(XAxis, { dataKey: "name", tick: { ...axisTick, fontSize: 10 }, axisLine: { stroke: CHART_GRID }, tickLine: false, interval: 0, angle: -18, textAnchor: "end", height: 52 }), _jsx(YAxis, { tick: axisTick, axisLine: false, tickLine: false, tickFormatter: v => (typeof v === 'number' ? formatUzsCompact(v) : '') }), _jsx(Tooltip, { content: _jsx(ReportChartTooltip, {}) }), _jsx(Bar, { dataKey: "value", name: "\u0421\u0443\u043C\u043C\u0430", radius: [3, 3, 0, 0], maxBarSize: 36, children: byPayment.map((row, i) => (_jsx(Cell, { fill: PAYMENT_PALETTE[i % PAYMENT_PALETTE.length] }, row.name))) })] }) }) })] })] }));
}
