import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, } from 'recharts';
import { INVOICE_REGISTRY_STATS_YEARS, } from '@entities/time-tracking/model/invoiceRegistry/partnerStatistics';
import { getInvoiceRegistryStatistics } from '@entities/time-tracking/api/domains/invoiceRegistry';
import { useI18n } from '@shared/i18n';
import './InvoiceRegistryStatisticsPanel.css';
const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#64748b', '#0ea5e9'];
function formatInvoicedAmount(n, currency) {
    if (!Number.isFinite(n) || n <= 0)
        return '—';
    const value = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency ? `${value} ${currency}` : value;
}
function CurrencyPieTooltip({ active, payload, currency }) {
    if (!active || !payload?.length)
        return null;
    const item = payload[0];
    const value = typeof item?.value === 'number' ? item.value : 0;
    return (_jsxs("div", { className: "tt-inv-stats__tooltip", children: [_jsx("div", { className: "tt-inv-stats__tooltip-title", children: item?.name }), _jsx("div", { className: "tt-inv-stats__tooltip-val", children: formatInvoicedAmount(value, currency) })] }));
}
export function InvoiceRegistryStatisticsPanel() {
    const { t } = useI18n();
    const [yearFilter, setYearFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [invoicedByCurrency, setInvoicedByCurrency] = useState([]);
    const [partnerMatrix, setPartnerMatrix] = useState({
        currencies: [],
        partners: [],
    });
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getInvoiceRegistryStatistics(yearFilter === 'all' ? '2026' : '2026')
            .then((dto) => {
            if (cancelled)
                return;
            setInvoicedByCurrency(dto.invoicedByCurrency ?? []);
            setPartnerMatrix(dto.partnerMatrix ?? { currencies: [], partners: [] });
        })
            .catch(() => {
            if (!cancelled)
                setError(t('timeTrackingPage.invoices.registry.loadFailed'));
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [yearFilter, t]);
    const tiles = useMemo(() => invoicedByCurrency.filter((row) => row.invoiced > 0), [invoicedByCurrency]);
    const currencyCharts = useMemo(() => {
        return partnerMatrix.currencies
            .map((currency) => {
            const data = partnerMatrix.partners
                .map((row, i) => ({
                name: row.partner,
                value: row.amounts[currency] ?? 0,
                fill: CHART_COLORS[i % CHART_COLORS.length],
            }))
                .filter((slice) => slice.value > 0)
                .sort((a, b) => b.value - a.value)
                .map((slice, i) => ({
                ...slice,
                fill: CHART_COLORS[i % CHART_COLORS.length],
            }));
            return { currency, data };
        })
            .filter((chart) => chart.data.length > 0);
    }, [partnerMatrix]);
    return (_jsxs("div", { className: "tt-inv-stats", children: [_jsxs("nav", { className: "tt-inv-stats__year-nav tt-reports__type-nav", role: "tablist", "aria-label": t('timeTrackingPage.invoices.statistics.yearTabsAria'), children: [_jsx("button", { type: "button", role: "tab", "aria-selected": yearFilter === 'all', className: `tt-reports__type-tab${yearFilter === 'all' ? ' tt-reports__type-tab--active' : ''}`, onClick: () => setYearFilter('all'), children: t('timeTrackingPage.invoices.statistics.allYears') }), INVOICE_REGISTRY_STATS_YEARS.map((y) => (_jsx("button", { type: "button", role: "tab", "aria-selected": yearFilter === y, className: `tt-reports__type-tab${yearFilter === y ? ' tt-reports__type-tab--active' : ''}`, onClick: () => setYearFilter(y), children: y }, y)))] }), loading && (_jsx("div", { className: "tt-inv-stats__state", children: t('timeTrackingPage.common.loading') })), !loading && error && (_jsx("div", { className: "tt-inv-stats__state tt-inv-stats__state--error", children: error })), !loading && !error && (_jsxs(_Fragment, { children: [_jsx("section", { className: "tt-inv-stats__tiles", "aria-label": t('timeTrackingPage.invoices.statistics.currencyTotalsTitle'), children: tiles.length === 0 ? (_jsx("div", { className: "tt-inv-stats__state", children: t('timeTrackingPage.invoices.statistics.empty') })) : (tiles.map((row) => (_jsxs("article", { className: "tt-inv-stats__tile", children: [_jsx("div", { className: "tt-inv-stats__tile-currency", children: row.currency }), _jsx("div", { className: "tt-inv-stats__tile-label", children: t('timeTrackingPage.invoices.statistics.totalInvoiced') }), _jsx("div", { className: "tt-inv-stats__tile-value", children: formatInvoicedAmount(row.invoiced, row.currency) })] }, row.currency)))) }), partnerMatrix.partners.length > 0 && (_jsxs("section", { className: "tt-inv-stats__table-section", children: [_jsx("h2", { className: "tt-inv-stats__table-title", children: t('timeTrackingPage.invoices.statistics.tableTitle') }), _jsx("p", { className: "tt-inv-stats__table-note", children: t('timeTrackingPage.invoices.statistics.currencyNote') }), _jsx("div", { className: "tt-inv-stats__table-wrap", children: _jsxs("table", { className: "tt-inv-stats__table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "tt-inv-stats__th-partner", children: t('timeTrackingPage.invoices.statistics.colPartner') }), partnerMatrix.currencies.map((currency) => (_jsx("th", { className: "tt-inv-stats__th-currency", children: currency }, currency)))] }) }), _jsx("tbody", { children: partnerMatrix.partners.map((row) => (_jsxs("tr", { children: [_jsx("td", { className: "tt-inv-stats__td-partner", children: _jsx("span", { className: "tt-inv-stats__partner-badge", children: row.partner }) }), partnerMatrix.currencies.map((currency) => (_jsx("td", { className: "tt-inv-stats__td-amount", children: formatInvoicedAmount(row.amounts[currency] ?? 0) }, currency)))] }, row.partner))) })] }) })] })), currencyCharts.length > 0 && (_jsxs("section", { className: "tt-inv-stats__charts-section", children: [_jsx("h2", { className: "tt-inv-stats__table-title", children: t('timeTrackingPage.invoices.statistics.chartsTitle') }), _jsx("p", { className: "tt-inv-stats__table-note", children: t('timeTrackingPage.invoices.statistics.currencyNote') }), _jsx("div", { className: "tt-inv-stats__charts", children: currencyCharts.map(({ currency, data }) => (_jsxs("article", { className: "tt-inv-stats__chart-card", children: [_jsx("h3", { className: "tt-inv-stats__chart-title", children: currency }), _jsx("p", { className: "tt-inv-stats__chart-sub", children: t('timeTrackingPage.invoices.statistics.chartShare') }), _jsx("div", { className: "tt-inv-stats__chart-plot", children: _jsx(ResponsiveContainer, { width: "100%", height: 260, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: data, dataKey: "value", nameKey: "name", cx: "50%", cy: "48%", innerRadius: 52, outerRadius: 88, paddingAngle: 2, label: ({ name, percent }) => percent != null && percent >= 0.06
                                                                ? `${name} · ${Math.round(percent * 100)}%`
                                                                : '', labelLine: { stroke: 'var(--app-border, #cbd5e1)' }, children: data.map((entry) => (_jsx(Cell, { fill: entry.fill }, `${currency}-${entry.name}`))) }), _jsx(Tooltip, { content: _jsx(CurrencyPieTooltip, { currency: currency }) })] }) }) }), _jsx("ul", { className: "tt-inv-stats__legend", children: data.map((entry) => (_jsxs("li", { className: "tt-inv-stats__legend-item", children: [_jsx("span", { className: "tt-inv-stats__legend-dot", style: { background: entry.fill } }), _jsx("span", { className: "tt-inv-stats__legend-name", children: entry.name }), _jsx("span", { className: "tt-inv-stats__legend-val", children: formatInvoicedAmount(entry.value) })] }, `${currency}-legend-${entry.name}`))) })] }, currency))) })] }))] }))] }));
}
