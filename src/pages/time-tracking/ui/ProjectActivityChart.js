import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { fmtH } from '@entities/time-tracking/lib/reportsFormatUtils';
import { useI18n } from '@shared/i18n';
const CHART_BILLABLE_COLOR = '#4f46e5';
const CHART_NON_BILLABLE_COLOR = '#a5b4fc';
const CHART_BILLABLE_FILL = 'rgba(79, 70, 229, 0.28)';
const CHART_NON_BILLABLE_FILL = 'rgba(165, 180, 252, 0.55)';
const GRID_STROKE = 'var(--app-border, #e2e8f0)';
const TICK_FILL = 'var(--app-muted, #64748b)';
function shortDayLabel(date, dateLabel) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [, month, day] = date.split('-');
        return `${day}.${month}`;
    }
    const parts = (dateLabel || date).trim().split(/\s+/);
    if (parts.length >= 2)
        return `${parts[0]} ${parts[1]}`;
    return dateLabel || date;
}
function niceAxisMax(maxValue) {
    if (maxValue <= 0)
        return 10;
    const padded = maxValue * 1.22;
    const exp = 10 ** Math.floor(Math.log10(padded));
    const factor = padded / exp;
    const nice = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10;
    return nice * exp;
}
function xAxisInterval(count) {
    if (count <= 12)
        return 0;
    if (count <= 24)
        return 1;
    if (count <= 48)
        return 2;
    return 'preserveStartEnd';
}
function ActivityTooltip({ active, payload, average, vsAvgLabel, billableLabel, otherLabel, totalLabel, }) {
    if (!active || !payload?.length)
        return null;
    const row = payload[0]?.payload;
    if (!row)
        return null;
    const delta = row.total - average;
    const deltaText = `${delta >= 0 ? '+' : '−'}${fmtH(Math.abs(delta))}`;
    return (_jsxs("div", { className: "tt-statistics-project__tooltip", children: [_jsx("div", { className: "tt-statistics-project__tooltip-title", children: row.dateLabel }), _jsxs("div", { className: "tt-statistics-project__tooltip-row", children: [_jsx("span", { style: { color: CHART_BILLABLE_COLOR }, children: billableLabel }), _jsx("strong", { children: fmtH(row.billable) })] }), row.other > 0 ? (_jsxs("div", { className: "tt-statistics-project__tooltip-row", children: [_jsx("span", { style: { color: CHART_NON_BILLABLE_COLOR }, children: otherLabel }), _jsx("strong", { children: fmtH(row.other) })] })) : null, _jsxs("div", { className: "tt-statistics-project__tooltip-row tt-statistics-project__tooltip-row--total", children: [_jsx("span", { children: totalLabel }), _jsx("strong", { children: fmtH(row.total) })] }), _jsx("p", { className: "tt-statistics-project__tooltip-foot", children: vsAvgLabel(deltaText) })] }));
}
export function ProjectActivityChart({ days, title, hint }) {
    const { t } = useI18n();
    const [activeLabel, setActiveLabel] = useState();
    const data = useMemo(() => {
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
    return (_jsxs("section", { className: "tt-statistics-project__chart", "aria-label": title, children: [_jsxs("div", { className: "tt-statistics-project__chart-head", children: [_jsx("h4", { className: "tt-statistics-project__section-title", children: title }), _jsx("p", { className: "tt-statistics-project__section-hint", children: hint })] }), _jsxs("div", { className: "tt-statistics-project__chart-summary", "aria-label": t('timeTrackingPage.statistics.chartSummaryAria'), children: [_jsxs("div", { className: "tt-statistics-project__chart-stat", children: [_jsx("span", { children: t('timeTrackingPage.statistics.chartAvgPerDay') }), _jsx("strong", { children: fmtH(summary.avg) })] }), _jsxs("div", { className: "tt-statistics-project__chart-stat", children: [_jsx("span", { children: t('timeTrackingPage.statistics.chartTotalPeriod') }), _jsx("strong", { children: fmtH(summary.total) })] }), _jsxs("div", { className: "tt-statistics-project__chart-stat", children: [_jsx("span", { children: t('timeTrackingPage.statistics.chartPeak') }), _jsx("strong", { children: fmtH(summary.peak) })] }), activePoint ? (_jsxs("div", { className: "tt-statistics-project__chart-stat tt-statistics-project__chart-stat--active", children: [_jsx("span", { children: t('timeTrackingPage.statistics.chartPoint') }), _jsxs("strong", { children: [activePoint.dateLabel, ": ", fmtH(activePoint.total)] })] })) : null] }), hasNonBillable ? (_jsxs("ul", { className: "tt-statistics-project__chart-legend", "aria-hidden": true, children: [_jsxs("li", { children: [_jsx("span", { className: "tt-statistics-project__chart-legend-dot", style: { background: CHART_BILLABLE_COLOR } }), t('timeTrackingPage.statistics.series.billable')] }), _jsxs("li", { children: [_jsx("span", { className: "tt-statistics-project__chart-legend-dot", style: { background: CHART_NON_BILLABLE_COLOR } }), t('timeTrackingPage.statistics.series.nonBillable')] })] })) : null, _jsx("div", { className: "tt-statistics-project__chart-plot", children: _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(ComposedChart, { data: data, margin: { top: 12, right: 48, bottom: labelAngle ? 8 : 0, left: 0 }, onMouseMove: (state) => {
                            if (state?.activeLabel != null)
                                setActiveLabel(String(state.activeLabel));
                        }, onMouseLeave: () => setActiveLabel(undefined), children: [_jsx(CartesianGrid, { stroke: GRID_STROKE, vertical: false, strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "dateLabel", tick: { fontSize: 11, fill: TICK_FILL }, axisLine: { stroke: GRID_STROKE }, tickLine: false, interval: xAxisInterval(data.length), angle: labelAngle, textAnchor: labelAngle ? 'end' : 'middle', height: labelAngle ? 48 : 28 }), _jsx(YAxis, { domain: [0, summary.yMax], tickFormatter: (v) => fmtH(Number(v) || 0), tick: { fontSize: 11, fill: TICK_FILL }, axisLine: false, tickLine: false, width: 52 }), _jsx(Tooltip, { cursor: { stroke: CHART_BILLABLE_COLOR, strokeWidth: 1, strokeDasharray: '4 4' }, content: (_jsx(ActivityTooltip, { average: summary.avg, vsAvgLabel: (delta) => t('timeTrackingPage.statistics.chartVsAvg').replace('{delta}', delta), billableLabel: t('timeTrackingPage.statistics.series.billable'), otherLabel: t('timeTrackingPage.statistics.series.nonBillable'), totalLabel: t('timeTrackingPage.statistics.widgets.total') })) }), _jsx(ReferenceLine, { y: Math.round(summary.avg * 10) / 10, stroke: "#3b82f6", strokeDasharray: "4 4", strokeOpacity: 0.7, label: {
                                    value: fmtH(summary.avg),
                                    position: 'right',
                                    fill: '#3b82f6',
                                    fontSize: 10,
                                } }), hasNonBillable ? (_jsx(Area, { type: "monotone", dataKey: "other", name: t('timeTrackingPage.statistics.series.nonBillable'), stackId: "hours", stroke: CHART_NON_BILLABLE_COLOR, fill: CHART_NON_BILLABLE_FILL, strokeWidth: 2, dot: false, activeDot: { r: 4, fill: CHART_NON_BILLABLE_COLOR, stroke: '#fff', strokeWidth: 2 } })) : null, _jsx(Area, { type: "monotone", dataKey: "billable", name: t('timeTrackingPage.statistics.series.billable'), stackId: "hours", stroke: CHART_BILLABLE_COLOR, fill: CHART_BILLABLE_FILL, strokeWidth: 2, dot: false, activeDot: { r: 4, fill: CHART_BILLABLE_COLOR, stroke: '#fff', strokeWidth: 2 } })] }) }) })] }));
}
