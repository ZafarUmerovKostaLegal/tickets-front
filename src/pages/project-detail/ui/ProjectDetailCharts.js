import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, Dot, Cell, } from 'recharts';
import { formatDecimalHoursRu } from '@shared/lib/formatTrackingHours';
function fmtAmt(n, cur = 'UZS') {
    return `${n.toLocaleString('ru-RU', { useGrouping: true, maximumFractionDigits: 2 })} ${cur}`;
}
function fmtAmtShort(n) {
    const abs = Math.abs(n);
    if (abs >= 1000000)
        return `${(n / 1000000).toFixed(1)}M`;
    if (abs >= 1000)
        return `${(n / 1000).toFixed(0)}K`;
    return String(n);
}
function MonthWeekTick(props) {
    const { x = 0, y = 0, payload, chartData } = props;
    const item = chartData[payload?.value ?? 0];
    if (!item)
        return null;
    if (item.isMonthStart) {
        return (_jsxs("g", { transform: `translate(${x},${y})`, children: [_jsx("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: "#d1d5db", strokeWidth: 1 }), _jsx("text", { x: 0, y: 22, textAnchor: "middle", fill: "#6b7280", fontSize: 11, fontWeight: 600, fontFamily: "inherit", children: item.monthName }), _jsx("text", { x: 0, y: 34, textAnchor: "middle", fill: "#9ca3af", fontSize: 10, fontFamily: "inherit", children: item.year })] }));
    }
    return (_jsx("g", { transform: `translate(${x},${y})`, children: _jsx("line", { x1: 0, y1: 0, x2: 0, y2: 4, stroke: "#e5e7eb", strokeWidth: 1 }) }));
}
function ProgressTooltip({ active, payload, currency, budget, mode }) {
    if (!active || !payload?.length)
        return null;
    const item = payload[0].payload;
    const spent = payload[0].value;
    const weekNum = item.idx + 1;
    if (mode === 'billable_hours_cumulative') {
        return (_jsxs("div", { className: "pdp__tooltip pdp__tooltip--rich", children: [_jsxs("p", { className: "pdp__tooltip-head", children: ["\u041D\u0430 ", item.dayLabel, " (\u041D\u0435\u0434.\u00A0", weekNum, ")"] }), _jsx("div", { className: "pdp__tooltip-cols", children: _jsxs("div", { className: "pdp__tooltip-col", children: [_jsx("span", { className: "pdp__tooltip-col-label", children: "\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435 \u0447\u0430\u0441\u044B (\u043D\u0430\u0440\u0430\u0441\u0442\u0430\u044E\u0449\u0438\u0439 \u0438\u0442\u043E\u0433)" }), _jsxs("span", { className: "pdp__tooltip-col-val", children: [formatDecimalHoursRu(spent), " \u0447"] })] }) }), _jsx("p", { className: "pdp__tooltip-note", children: "\u0421\u0443\u043C\u043C\u044B \u043F\u043E \u0441\u0442\u0430\u0432\u043A\u0430\u043C \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u2014 \u0437\u0430\u0434\u0430\u0439\u0442\u0435 \u043F\u043E\u0447\u0430\u0441\u043E\u0432\u044B\u0435 \u0441\u0442\u0430\u0432\u043A\u0438 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430\u043C." })] }));
    }
    const remaining = budget != null ? budget - spent : null;
    const isOver = remaining != null && remaining < 0;
    return (_jsxs("div", { className: "pdp__tooltip pdp__tooltip--rich", children: [_jsxs("p", { className: "pdp__tooltip-head", children: ["\u041D\u0430\u0440\u0430\u0441\u0442\u0430\u044E\u0449\u0438\u043C \u0438\u0442\u043E\u0433\u043E\u043C \u043D\u0430 ", item.dayLabel, " (\u041D\u0435\u0434.\u00A0", weekNum, ")"] }), _jsxs("div", { className: "pdp__tooltip-cols", children: [_jsxs("div", { className: "pdp__tooltip-col", children: [_jsx("span", { className: "pdp__tooltip-col-label", children: "\u041F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E" }), _jsx("span", { className: "pdp__tooltip-col-val", children: fmtAmt(spent, currency) })] }), budget != null ? (_jsxs("div", { className: "pdp__tooltip-col", children: [_jsx("span", { className: "pdp__tooltip-col-label", children: "\u041E\u0441\u0442\u0430\u0442\u043E\u043A \u0431\u044E\u0434\u0436\u0435\u0442\u0430" }), _jsxs("span", { className: `pdp__tooltip-col-val${isOver ? ' pdp__tooltip-col-val--red' : ' pdp__tooltip-col-val--green'}`, children: [isOver ? '−' : '', fmtAmt(Math.abs(remaining), currency)] })] })) : null] })] }));
}
function HoursTooltip({ active, payload }) {
    if (!active || !payload?.length)
        return null;
    const item = payload[0].payload;
    const weekNum = item.idx + 1;
    const sb = item.stackBillable;
    const sn = item.stackNonBillable;
    const stacked = sb != null && sn != null;
    return (_jsxs("div", { className: "pdp__tooltip pdp__tooltip--rich", children: [_jsxs("p", { className: "pdp__tooltip-head", children: [item.dayLabel, " (\u041D\u0435\u0434.\u00A0", weekNum, ")"] }), _jsx("div", { className: "pdp__tooltip-cols", children: stacked ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "pdp__tooltip-col", children: [_jsx("span", { className: "pdp__tooltip-col-label", children: "\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435" }), _jsxs("span", { className: "pdp__tooltip-col-val", children: [formatDecimalHoursRu(sb), " \u0447"] })] }), _jsxs("div", { className: "pdp__tooltip-col", children: [_jsx("span", { className: "pdp__tooltip-col-label", children: "\u041D\u0435\u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0435" }), _jsxs("span", { className: "pdp__tooltip-col-val", children: [formatDecimalHoursRu(sn), " \u0447"] })] }), _jsxs("div", { className: "pdp__tooltip-col", children: [_jsx("span", { className: "pdp__tooltip-col-label", children: "\u0412\u0441\u0435\u0433\u043E" }), _jsxs("span", { className: "pdp__tooltip-col-val", children: [formatDecimalHoursRu(sb + sn), " \u0447"] })] })] })) : (_jsxs("div", { className: "pdp__tooltip-col", children: [_jsx("span", { className: "pdp__tooltip-col-label", children: "\u0427\u0430\u0441\u043E\u0432 \u0437\u0430 \u043D\u0435\u0434\u0435\u043B\u044E" }), _jsxs("span", { className: "pdp__tooltip-col-val", children: [formatDecimalHoursRu(payload[0].value), " \u0447"] })] })) })] }));
}
function CustomBar(props) {
    const { x = 0, y = 0, width = 0, height = 0, isThisWeek } = props;
    return _jsx("rect", { x: x, y: y, width: width, height: height, rx: 3, ry: 3, fill: isThisWeek ? '#4f46e5' : '#93c5fd' });
}
export function ProjectDetailCharts({ chartTab, onChartTabChange, dashboardOk, progressMode, progressData, hoursData, hoverIdx, onHoverIdxChange, thisWeekIdx, monthBoundaries, hasBudget, budgetLimitForChart, displayCurrency, hoursChartStacked, yTicks, maxVal, }) {
    return (_jsxs("div", { className: "pdp__chart-card", children: [_jsxs("div", { className: "pdp__chart-tabs", children: [_jsxs("button", { type: "button", className: `pdp__chart-tab${chartTab === 'progress' ? ' pdp__chart-tab--active' : ''}`, onClick: () => onChartTabChange('progress'), children: [_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: _jsx("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" }) }), "\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u043F\u0440\u043E\u0435\u043A\u0442\u0430"] }), _jsxs("button", { type: "button", className: `pdp__chart-tab${chartTab === 'hours' ? ' pdp__chart-tab--active' : ''}`, onClick: () => onChartTabChange('hours'), children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("line", { x1: "18", y1: "20", x2: "18", y2: "10" }), _jsx("line", { x1: "12", y1: "20", x2: "12", y2: "4" }), _jsx("line", { x1: "6", y1: "20", x2: "6", y2: "14" })] }), "\u0427\u0430\u0441\u044B \u043F\u043E \u043D\u0435\u0434\u0435\u043B\u044F\u043C"] })] }), dashboardOk && progressMode === 'billable_hours_cumulative' && chartTab === 'progress' ? (_jsx("p", { className: "pdp__chart-hint", role: "note", children: "\u041F\u043E \u0441\u0442\u0430\u0432\u043A\u0430\u043C \u0441\u0443\u043C\u043C\u0430 \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 \u2014 0; \u043D\u0430 \u0433\u0440\u0430\u0444\u0438\u043A\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u043D \u043D\u0430\u0440\u0430\u0441\u0442\u0430\u044E\u0449\u0438\u0439 \u043E\u0431\u044A\u0451\u043C \u043E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u044B\u0445 \u0447\u0430\u0441\u043E\u0432. \u0427\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0434\u0435\u043D\u044C\u0433\u0438, \u0437\u0430\u0434\u0430\u0439\u0442\u0435 \u043F\u043E\u0447\u0430\u0441\u043E\u0432\u044B\u0435 \u0441\u0442\u0430\u0432\u043A\u0438 (\u0431\u0438\u043B\u043B\u0438\u043D\u0433) \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430\u043C \u0432 \u0443\u0447\u0451\u0442\u0435 \u0432\u0440\u0435\u043C\u0435\u043D\u0438." })) : null, _jsxs("div", { className: "pdp__chart-area", children: [chartTab === 'progress' ? (_jsx(ResponsiveContainer, { width: "100%", height: 310, children: _jsxs(LineChart, { data: progressData, margin: { top: 24, right: 28, bottom: 28, left: 8 }, onMouseMove: (s) => {
                                const payload = s?.activePayload?.[0]?.payload;
                                const idx = payload?.idx;
                                if (idx !== undefined)
                                    onHoverIdxChange(idx);
                            }, onMouseLeave: () => onHoverIdxChange(null), children: [_jsx(CartesianGrid, { stroke: "#f0f0f0", strokeDasharray: "0", vertical: false }), hoverIdx !== null && hoverIdx !== thisWeekIdx ? (_jsx(ReferenceArea, { x1: hoverIdx - 0.5, x2: hoverIdx + 0.5, fill: "rgba(0,0,0,0.05)", ifOverflow: "visible" })) : null, monthBoundaries.map(d => (_jsx(ReferenceLine, { x: d.idx, stroke: "#e5e7eb", strokeWidth: 1 }, d.idx))), _jsx(ReferenceArea, { x1: thisWeekIdx - 0.5, x2: thisWeekIdx + 0.5, fill: "rgba(37,99,235,0.08)", label: { value: 'Эта неделя', position: 'insideTopRight', fontSize: 11, fill: '#6b7280', dy: -12, dx: -4 } }), hasBudget && progressMode === 'money' && budgetLimitForChart != null && budgetLimitForChart > 0 ? (_jsx(ReferenceLine, { y: budgetLimitForChart, stroke: "#ef4444", strokeWidth: 1.5, label: {
                                        value: `Бюджет: ${fmtAmtShort(budgetLimitForChart)}`,
                                        position: 'insideTopLeft',
                                        fill: '#fff',
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                    } })) : null, _jsx(XAxis, { dataKey: "idx", type: "number", domain: [0, progressData.length - 1], ticks: progressData.map(d => d.idx), tick: (p) => _jsx(MonthWeekTick, { ...p, chartData: progressData }), axisLine: { stroke: '#e5e7eb' }, tickLine: false, interval: 0, height: 44 }), _jsx(YAxis, { tickFormatter: progressMode === 'money' ? fmtAmtShort : (v) => formatDecimalHoursRu(Number(v)), tick: { fontSize: 11, fill: '#9ca3af', fontFamily: 'inherit' }, axisLine: false, tickLine: false, width: 56, ticks: yTicks, domain: [0, maxVal] }), _jsx(Tooltip, { content: _jsx(ProgressTooltip, { mode: progressMode, currency: displayCurrency, budget: progressMode === 'money' ? budgetLimitForChart ?? undefined : undefined }), cursor: false, offset: 12 }), _jsx(Line, { type: "monotone", dataKey: "value", stroke: "#ef4444", strokeWidth: 2.5, dot: _jsx(Dot, { r: 4, fill: "#ef4444", stroke: "#fff", strokeWidth: 2 }), activeDot: { r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2.5 } })] }) })) : null, chartTab === 'hours' ? (_jsx(ResponsiveContainer, { width: "100%", height: 310, children: _jsxs(BarChart, { data: hoursData, margin: { top: 24, right: 28, bottom: 28, left: 8 }, barCategoryGap: "35%", onMouseMove: (s) => {
                                const payload = s?.activePayload?.[0]?.payload;
                                const idx = payload?.idx;
                                if (idx !== undefined)
                                    onHoverIdxChange(idx);
                            }, onMouseLeave: () => onHoverIdxChange(null), children: [_jsx(CartesianGrid, { stroke: "#f0f0f0", strokeDasharray: "0", vertical: false }), monthBoundaries.map(d => (_jsx(ReferenceLine, { x: d.idx, stroke: "#e5e7eb", strokeWidth: 1 }, d.idx))), _jsx(ReferenceArea, { x1: thisWeekIdx - 0.5, x2: thisWeekIdx + 0.5, fill: "rgba(37,99,235,0.08)", label: { value: 'Эта неделя', position: 'insideTopRight', fontSize: 11, fill: '#6b7280', dy: -12, dx: -4 } }), _jsx(XAxis, { dataKey: "idx", type: "number", domain: [0, hoursData.length - 1], ticks: hoursData.map(d => d.idx), tick: (p) => _jsx(MonthWeekTick, { ...p, chartData: hoursData }), axisLine: { stroke: '#e5e7eb' }, tickLine: false, interval: 0, height: 44 }), _jsx(YAxis, { tick: { fontSize: 11, fill: '#9ca3af', fontFamily: 'inherit' }, axisLine: false, tickLine: false, width: 40, tickFormatter: v => `${v}` }), _jsx(Tooltip, { content: _jsx(HoursTooltip, {}), cursor: false, offset: 12 }), hoursChartStacked ? (_jsxs(_Fragment, { children: [_jsx(Bar, { dataKey: "stackNonBillable", stackId: "weekH", radius: [0, 0, 0, 0], children: hoursData.map((entry, i) => (_jsx(Cell, { fill: entry.isThisWeek ? '#a5b4fc' : '#c7d2fe' }, `pdp-h-nb-${i}`))) }), _jsx(Bar, { dataKey: "stackBillable", stackId: "weekH", radius: [3, 3, 0, 0], children: hoursData.map((entry, i) => (_jsx(Cell, { fill: entry.isThisWeek ? '#4f46e5' : '#93c5fd' }, `pdp-h-b-${i}`))) })] })) : (_jsx(Bar, { dataKey: "value", shape: _jsx(CustomBar, {}), radius: [3, 3, 0, 0] }))] }) })) : null] })] }));
}
