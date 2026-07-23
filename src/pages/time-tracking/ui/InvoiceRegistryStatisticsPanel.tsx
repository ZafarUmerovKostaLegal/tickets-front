import { useEffect, useMemo, useState } from 'react';
import {
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import {
    INVOICE_REGISTRY_STATS_YEARS,
    loadInvoiceRegistryStatsRows,
    sumInvoicedByCurrency,
    sumInvoicedByPartnerCurrency,
    type RegistryStatsYearFilter,
} from '@entities/time-tracking/model/invoiceRegistry/partnerStatistics';
import { useI18n } from '@shared/i18n';
import './InvoiceRegistryStatisticsPanel.css';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#64748b', '#0ea5e9'];

function formatInvoicedAmount(n: number, currency?: string): string {
    if (!Number.isFinite(n) || n <= 0)
        return '—';
    const value = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency ? `${value} ${currency}` : value;
}

type ChartSlice = {
    name: string;
    value: number;
    fill: string;
};

type CurrencyPieTooltipProps = {
    active?: boolean;
    payload?: { name?: string; value?: number; payload?: ChartSlice }[];
    currency: string;
};

function CurrencyPieTooltip({ active, payload, currency }: CurrencyPieTooltipProps) {
    if (!active || !payload?.length)
        return null;
    const item = payload[0];
    const value = typeof item?.value === 'number' ? item.value : 0;
    return (
        <div className="tt-inv-stats__tooltip">
            <div className="tt-inv-stats__tooltip-title">{item?.name}</div>
            <div className="tt-inv-stats__tooltip-val">{formatInvoicedAmount(value, currency)}</div>
        </div>
    );
}

export function InvoiceRegistryStatisticsPanel() {
    const { t } = useI18n();
    const [yearFilter, setYearFilter] = useState<RegistryStatsYearFilter>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [invoicedByCurrency, setInvoicedByCurrency] = useState<ReturnType<typeof sumInvoicedByCurrency>>([]);
    const [partnerMatrix, setPartnerMatrix] = useState<ReturnType<typeof sumInvoicedByPartnerCurrency>>({
        currencies: [],
        partners: [],
    });

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        loadInvoiceRegistryStatsRows(yearFilter)
            .then(({ rows }) => {
                if (cancelled)
                    return;
                setInvoicedByCurrency(sumInvoicedByCurrency(rows));
                setPartnerMatrix(sumInvoicedByPartnerCurrency(rows));
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

    const tiles = useMemo(
        () => invoicedByCurrency.filter((row) => row.invoiced > 0),
        [invoicedByCurrency],
    );

    const currencyCharts = useMemo(() => {
        return partnerMatrix.currencies
            .map((currency) => {
                const data: ChartSlice[] = partnerMatrix.partners
                    .map((row, i) => ({
                        name: row.partner,
                        value: row.amounts[currency] ?? 0,
                        fill: CHART_COLORS[i % CHART_COLORS.length]!,
                    }))
                    .filter((slice) => slice.value > 0)
                    .sort((a, b) => b.value - a.value)
                    .map((slice, i) => ({
                        ...slice,
                        fill: CHART_COLORS[i % CHART_COLORS.length]!,
                    }));
                return { currency, data };
            })
            .filter((chart) => chart.data.length > 0);
    }, [partnerMatrix]);

    return (
        <div className="tt-inv-stats">
            <nav
                className="tt-inv-reg__year-nav tt-reports__type-nav"
                role="tablist"
                aria-label={t('timeTrackingPage.invoices.statistics.yearTabsAria')}
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={yearFilter === 'all'}
                    className={`tt-reports__type-tab${yearFilter === 'all' ? ' tt-reports__type-tab--active' : ''}`}
                    onClick={() => setYearFilter('all')}
                >
                    {t('timeTrackingPage.invoices.statistics.allYears')}
                </button>
                {INVOICE_REGISTRY_STATS_YEARS.map((y) => (
                    <button
                        key={y}
                        type="button"
                        role="tab"
                        aria-selected={yearFilter === y}
                        className={`tt-reports__type-tab${yearFilter === y ? ' tt-reports__type-tab--active' : ''}`}
                        onClick={() => setYearFilter(y)}
                    >
                        {y}
                    </button>
                ))}
            </nav>

            {loading && (
                <div className="tt-inv-stats__state">{t('timeTrackingPage.common.loading')}</div>
            )}

            {!loading && error && (
                <div className="tt-inv-stats__state tt-inv-stats__state--error">{error}</div>
            )}

            {!loading && !error && (
                <>
                    <section className="tt-inv-stats__tiles" aria-label={t('timeTrackingPage.invoices.statistics.currencyTotalsTitle')}>
                        {tiles.length === 0 ? (
                            <div className="tt-inv-stats__state">{t('timeTrackingPage.invoices.statistics.empty')}</div>
                        ) : (
                            tiles.map((row) => (
                                <article key={row.currency} className="tt-inv-stats__tile">
                                    <div className="tt-inv-stats__tile-currency">{row.currency}</div>
                                    <div className="tt-inv-stats__tile-label">{t('timeTrackingPage.invoices.statistics.totalInvoiced')}</div>
                                    <div className="tt-inv-stats__tile-value">{formatInvoicedAmount(row.invoiced, row.currency)}</div>
                                </article>
                            ))
                        )}
                    </section>

                    {partnerMatrix.partners.length > 0 && (
                        <section className="tt-inv-stats__table-section">
                            <h2 className="tt-inv-stats__table-title">{t('timeTrackingPage.invoices.statistics.tableTitle')}</h2>
                            <p className="tt-inv-stats__table-note">{t('timeTrackingPage.invoices.statistics.currencyNote')}</p>
                            <div className="tt-inv-stats__table-wrap">
                                <table className="tt-inv-stats__table">
                                    <thead>
                                        <tr>
                                            <th className="tt-inv-stats__th-partner">{t('timeTrackingPage.invoices.statistics.colPartner')}</th>
                                            {partnerMatrix.currencies.map((currency) => (
                                                <th key={currency} className="tt-inv-stats__th-currency">{currency}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {partnerMatrix.partners.map((row) => (
                                            <tr key={row.partner}>
                                                <td className="tt-inv-stats__td-partner">
                                                    <span className="tt-inv-stats__partner-badge">{row.partner}</span>
                                                </td>
                                                {partnerMatrix.currencies.map((currency) => (
                                                    <td key={currency} className="tt-inv-stats__td-amount">
                                                        {formatInvoicedAmount(row.amounts[currency] ?? 0)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {currencyCharts.length > 0 && (
                        <section className="tt-inv-stats__charts-section">
                            <h2 className="tt-inv-stats__table-title">{t('timeTrackingPage.invoices.statistics.chartsTitle')}</h2>
                            <p className="tt-inv-stats__table-note">{t('timeTrackingPage.invoices.statistics.currencyNote')}</p>
                            <div className="tt-inv-stats__charts">
                                {currencyCharts.map(({ currency, data }) => (
                                    <article key={currency} className="tt-inv-stats__chart-card">
                                        <h3 className="tt-inv-stats__chart-title">{currency}</h3>
                                        <p className="tt-inv-stats__chart-sub">{t('timeTrackingPage.invoices.statistics.chartShare')}</p>
                                        <div className="tt-inv-stats__chart-plot">
                                            <ResponsiveContainer width="100%" height={260}>
                                                <PieChart>
                                                    <Pie
                                                        data={data}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        cx="50%"
                                                        cy="48%"
                                                        innerRadius={52}
                                                        outerRadius={88}
                                                        paddingAngle={2}
                                                        label={({ name, percent }) =>
                                                            percent != null && percent >= 0.06
                                                                ? `${name} · ${Math.round(percent * 100)}%`
                                                                : ''}
                                                        labelLine={{ stroke: 'var(--app-border, #cbd5e1)' }}
                                                    >
                                                        {data.map((entry) => (
                                                            <Cell key={`${currency}-${entry.name}`} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip content={<CurrencyPieTooltip currency={currency} />} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <ul className="tt-inv-stats__legend">
                                            {data.map((entry) => (
                                                <li key={`${currency}-legend-${entry.name}`} className="tt-inv-stats__legend-item">
                                                    <span className="tt-inv-stats__legend-dot" style={{ background: entry.fill }} />
                                                    <span className="tt-inv-stats__legend-name">{entry.name}</span>
                                                    <span className="tt-inv-stats__legend-val">{formatInvoicedAmount(entry.value)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
