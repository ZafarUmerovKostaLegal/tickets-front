import { useEffect, useMemo, useState } from 'react';
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
} from 'recharts';
import {
    aggregatePartnerRegistryStats,
    flattenPartnerStats,
    INVOICE_REGISTRY_STATS_YEARS,
    listCurrencyTotals,
    listCurrenciesFromStats,
    loadInvoiceRegistryStatsRows,
    partnerTotalsForCurrency,
    totalsForCurrency,
    type RegistryStatsYearFilter,
} from '@entities/time-tracking/model/invoiceRegistry/partnerStatistics';
import { useI18n } from '@shared/i18n';
import './InvoiceRegistryStatisticsPanel.css';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#64748b', '#0ea5e9'];

function formatMoney(n: number, currency: string): string {
    if (!Number.isFinite(n))
        return '—';
    const abs = Math.abs(n);
    let formatted: string;
    if (abs >= 1_000_000_000)
        formatted = `${(n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')} млрд`;
    else if (abs >= 1_000_000)
        formatted = `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')} млн`;
    else if (abs >= 10_000)
        formatted = `${Math.round(n / 1_000)} тыс`;
    else
        formatted = n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    return `${formatted} ${currency}`;
}

/** Full amount for totals tables (no тыс/млн compression). */
function formatMoneyExact(n: number, currency: string): string {
    if (!Number.isFinite(n) || n === 0)
        return '—';
    return `${n.toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} ${currency}`;
}

function formatAxis(n: number): string {
    if (!Number.isFinite(n))
        return '';
    const abs = Math.abs(n);
    if (abs >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (abs >= 1_000)
        return `${(n / 1_000).toFixed(0)}k`;
    return String(Math.round(n));
}

type ChartTooltipProps = {
    active?: boolean;
    label?: string;
    payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
    currency: string;
};

function StatsChartTooltip({ active, label, payload, currency }: ChartTooltipProps) {
    if (!active || !payload?.length)
        return null;
    return (
        <div className="tt-inv-stats__tooltip">
            {label ? <div className="tt-inv-stats__tooltip-title">{label}</div> : null}
            <ul className="tt-inv-stats__tooltip-list">
                {payload.map((p, i) => (
                    <li key={`${p.dataKey ?? i}`} className="tt-inv-stats__tooltip-row">
                        <span className="tt-inv-stats__tooltip-dot" style={{ background: p.color }} />
                        <span className="tt-inv-stats__tooltip-name">{p.name ?? p.dataKey}</span>
                        <span className="tt-inv-stats__tooltip-val">
                            {typeof p.value === 'number' ? formatMoney(p.value, currency) : p.value}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function CurrencyTotalsStrip({
    invoiced,
    remuneration,
    balance,
    currency,
    invoicedLabel,
    remunerationLabel,
    balanceLabel,
}: {
    invoiced: number;
    remuneration: number;
    balance: number;
    currency: string;
    invoicedLabel: string;
    remunerationLabel: string;
    balanceLabel: string;
}) {
    return (
        <div className="tt-inv-stats__totals-strip">
            <div className="tt-inv-stats__totals-item">
                <span className="tt-inv-stats__totals-label">{invoicedLabel}</span>
                <span className="tt-inv-stats__totals-value">{formatMoneyExact(invoiced, currency)}</span>
            </div>
            <div className="tt-inv-stats__totals-item tt-inv-stats__totals-item--accent">
                <span className="tt-inv-stats__totals-label">{remunerationLabel}</span>
                <span className="tt-inv-stats__totals-value">{formatMoneyExact(remuneration, currency)}</span>
            </div>
            <div className="tt-inv-stats__totals-item">
                <span className="tt-inv-stats__totals-label">{balanceLabel}</span>
                <span className="tt-inv-stats__totals-value">{formatMoneyExact(balance, currency)}</span>
            </div>
        </div>
    );
}

export function InvoiceRegistryStatisticsPanel() {
    const { t } = useI18n();
    const [yearFilter, setYearFilter] = useState<RegistryStatsYearFilter>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<ReturnType<typeof aggregatePartnerRegistryStats> | null>(null);
    const [rowCount, setRowCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        loadInvoiceRegistryStatsRows(yearFilter)
            .then(({ rows: loaded }) => {
                if (cancelled)
                    return;
                setRowCount(loaded.length);
                setStats(aggregatePartnerRegistryStats(loaded));
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

    const currencies = useMemo(() => (stats ? listCurrenciesFromStats(stats) : []), [stats]);
    const currencyTotals = useMemo(() => (stats ? listCurrencyTotals(stats) : []), [stats]);
    const tableRows = useMemo(() => (stats ? flattenPartnerStats(stats) : []), [stats]);

    const summary = useMemo(() => {
        if (!stats)
            return null;
        const partners = new Set<string>();
        for (const map of [stats.invoiced, stats.remuneration]) {
            for (const partner of Object.keys(map))
                if (partner !== '—')
                    partners.add(partner);
        }
        return {
            partners: partners.size,
            currencies: currencies.length,
        };
    }, [stats, currencies.length]);

    const yearLabel = yearFilter === 'all'
        ? t('timeTrackingPage.invoices.statistics.allYears')
        : yearFilter;

    const invoicedLabel = t('timeTrackingPage.invoices.statistics.totalInvoiced');
    const remunerationLabel = t('timeTrackingPage.invoices.statistics.totalRemuneration');
    const balanceLabel = t('timeTrackingPage.invoices.statistics.totalBalance');

    return (
        <div className="tt-inv-stats">
            <nav className="tt-inv-reg__year-nav tt-reports__type-nav" role="tablist" aria-label={t('timeTrackingPage.invoices.statistics.yearTabsAria')}>
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

            <p className="tt-inv-stats__meta">
                {t('timeTrackingPage.invoices.statistics.meta')
                    .replace('{period}', yearLabel)
                    .replace('{rows}', String(rowCount))
                    .replace('{partners}', String(summary?.partners ?? 0))}
            </p>

            {loading && (
                <div className="tt-inv-stats__state">{t('timeTrackingPage.common.loading')}</div>
            )}
            {error && !loading && (
                <div className="tt-inv-stats__state tt-inv-stats__state--error">{error}</div>
            )}
            {!loading && !error && stats && summary && (
                <>
                    <div className="tt-inv-stats__summary">
                        <article className="tt-inv-stats__card tt-inv-stats__card--accent">
                            <span className="tt-inv-stats__card-label">{t('timeTrackingPage.invoices.statistics.cards.partners')}</span>
                            <span className="tt-inv-stats__card-value">{summary.partners}</span>
                        </article>
                        <article className="tt-inv-stats__card">
                            <span className="tt-inv-stats__card-label">{t('timeTrackingPage.invoices.statistics.cards.invoices')}</span>
                            <span className="tt-inv-stats__card-value">{stats.rowsWithPartner}</span>
                        </article>
                        <article className="tt-inv-stats__card">
                            <span className="tt-inv-stats__card-label">{t('timeTrackingPage.invoices.statistics.cards.withRemuneration')}</span>
                            <span className="tt-inv-stats__card-value">{stats.rowsWithRemuneration}</span>
                        </article>
                        <article className="tt-inv-stats__card">
                            <span className="tt-inv-stats__card-label">{t('timeTrackingPage.invoices.statistics.cards.currencies')}</span>
                            <span className="tt-inv-stats__card-value">{summary.currencies}</span>
                        </article>
                    </div>

                    {currencies.length === 0 ? (
                        <div className="tt-inv-stats__state">{t('timeTrackingPage.invoices.statistics.empty')}</div>
                    ) : (
                        <>
                            <section className="tt-inv-stats__currency-totals">
                                <header className="tt-inv-stats__currency-head">
                                    <h2 className="tt-inv-stats__currency-title">
                                        {t('timeTrackingPage.invoices.statistics.currencyTotalsTitle')}
                                    </h2>
                                    <p className="tt-inv-stats__currency-note">
                                        {t('timeTrackingPage.invoices.statistics.currencyNote')}
                                    </p>
                                </header>
                                <div className="tt-inv-stats__table-wrap">
                                    <table className="tt-inv-stats__table">
                                        <thead>
                                            <tr>
                                                <th>{t('timeTrackingPage.invoices.statistics.colCurrency')}</th>
                                                <th>{invoicedLabel}</th>
                                                <th>{remunerationLabel}</th>
                                                <th>{balanceLabel}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currencyTotals.map((row) => (
                                                <tr key={row.currency}>
                                                    <td>
                                                        <span className="tt-inv-stats__partner-badge">{row.currency}</span>
                                                    </td>
                                                    <td className="tt-inv-stats__num">{formatMoneyExact(row.invoiced, row.currency)}</td>
                                                    <td className="tt-inv-stats__num tt-inv-stats__num--accent">
                                                        {formatMoneyExact(row.remuneration, row.currency)}
                                                    </td>
                                                    <td className="tt-inv-stats__num">{formatMoneyExact(row.balance, row.currency)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            {currencies.map((currency) => {
                                const totals = totalsForCurrency(stats, currency);
                                const remuneration = partnerTotalsForCurrency(stats, currency, 'remuneration');
                                const invoiced = partnerTotalsForCurrency(stats, currency, 'invoiced');
                                const chartSource = remuneration.length > 0 ? remuneration : invoiced;
                                const chartData = chartSource.map((d, i) => ({
                                    name: d.partner,
                                    value: d.value,
                                    fill: CHART_COLORS[i % CHART_COLORS.length],
                                }));
                                const metric = remuneration.length > 0 ? 'remuneration' : 'invoiced';
                                const barTitle = metric === 'remuneration'
                                    ? t('timeTrackingPage.invoices.statistics.chartRemuneration')
                                    : t('timeTrackingPage.invoices.statistics.chartInvoiced');

                                return (
                                    <section key={currency} className="tt-inv-stats__currency-block">
                                        <header className="tt-inv-stats__currency-head">
                                            <h2 className="tt-inv-stats__currency-title">{currency}</h2>
                                            <p className="tt-inv-stats__currency-note">
                                                {t('timeTrackingPage.invoices.statistics.currencyNote')}
                                            </p>
                                        </header>
                                        <CurrencyTotalsStrip
                                            currency={currency}
                                            invoiced={totals.invoiced}
                                            remuneration={totals.remuneration}
                                            balance={totals.balance}
                                            invoicedLabel={invoicedLabel}
                                            remunerationLabel={remunerationLabel}
                                            balanceLabel={balanceLabel}
                                        />
                                        {chartData.length === 0 ? (
                                            <div className="tt-inv-stats__state tt-inv-stats__state--soft">
                                                {t('timeTrackingPage.invoices.statistics.chartEmpty')}
                                            </div>
                                        ) : (
                                            <div className="tt-inv-stats__charts">
                                                <article className="tt-inv-stats__chart-card">
                                                    <h3 className="tt-inv-stats__chart-title">{barTitle}</h3>
                                                    <p className="tt-inv-stats__chart-sub">{t('timeTrackingPage.invoices.statistics.chartShare')}</p>
                                                    <div className="tt-inv-stats__chart-plot tt-inv-stats__chart-plot--pie">
                                                        <ResponsiveContainer width="100%" height={280}>
                                                            <PieChart>
                                                                <Pie
                                                                    data={chartData}
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
                                                                    {chartData.map((entry) => (
                                                                        <Cell key={entry.name} fill={entry.fill} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip content={<StatsChartTooltip currency={currency} />} />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </article>

                                                <article className="tt-inv-stats__chart-card">
                                                    <h3 className="tt-inv-stats__chart-title">{barTitle}</h3>
                                                    <p className="tt-inv-stats__chart-sub">{t('timeTrackingPage.invoices.statistics.chartRanking')}</p>
                                                    <div className="tt-inv-stats__chart-plot">
                                                        <ResponsiveContainer width="100%" height={280}>
                                                            <BarChart
                                                                layout="vertical"
                                                                data={chartData}
                                                                margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
                                                            >
                                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border, #e2e8f0)" horizontal />
                                                                <XAxis
                                                                    type="number"
                                                                    tick={{ fontSize: 11 }}
                                                                    tickFormatter={(v) => (typeof v === 'number' ? formatAxis(v) : '')}
                                                                />
                                                                <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} />
                                                                <Tooltip content={<StatsChartTooltip currency={currency} />} />
                                                                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                                                                    {chartData.map((entry) => (
                                                                        <Cell key={entry.name} fill={entry.fill} />
                                                                    ))}
                                                                </Bar>
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </article>
                                            </div>
                                        )}
                                    </section>
                                );
                            })}

                            <section className="tt-inv-stats__table-section">
                                <h2 className="tt-inv-stats__table-title">{t('timeTrackingPage.invoices.statistics.tableTitle')}</h2>
                                <div className="tt-inv-stats__table-wrap">
                                    <table className="tt-inv-stats__table">
                                        <thead>
                                            <tr>
                                                <th>{t('timeTrackingPage.invoices.statistics.colPartner')}</th>
                                                <th>{t('timeTrackingPage.invoices.statistics.colCurrency')}</th>
                                                <th>{t('timeTrackingPage.invoices.statistics.colInvoiced')}</th>
                                                <th>{t('timeTrackingPage.invoices.statistics.colRemuneration')}</th>
                                                <th>{t('timeTrackingPage.invoices.statistics.colBalance')}</th>
                                                <th>{t('timeTrackingPage.invoices.statistics.colCount')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableRows.map((row) => (
                                                <tr key={`${row.partner}-${row.currency}`}>
                                                    <td><span className="tt-inv-stats__partner-badge">{row.partner}</span></td>
                                                    <td>{row.currency}</td>
                                                    <td className="tt-inv-stats__num">{row.invoiced > 0 ? formatMoneyExact(row.invoiced, row.currency) : '—'}</td>
                                                    <td className="tt-inv-stats__num tt-inv-stats__num--accent">
                                                        {row.remuneration > 0 ? formatMoneyExact(row.remuneration, row.currency) : '—'}
                                                    </td>
                                                    <td className="tt-inv-stats__num">{row.balance > 0 ? formatMoneyExact(row.balance, row.currency) : '—'}</td>
                                                    <td className="tt-inv-stats__num">{row.count > 0 ? row.count : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
