import { useEffect, useMemo, useState } from 'react';
import {
    aggregatePartnerRegistryStats,
    INVOICE_REGISTRY_STATS_YEARS,
    listCurrencyTotals,
    loadInvoiceRegistryStatsRows,
    type RegistryStatsYearFilter,
} from '@entities/time-tracking/model/invoiceRegistry/partnerStatistics';
import { useI18n } from '@shared/i18n';
import './InvoiceRegistryStatisticsPanel.css';

function formatMoneyExact(n: number, currency: string): string {
    if (!Number.isFinite(n) || n === 0)
        return '—';
    return `${n.toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} ${currency}`;
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

    const currencyTotals = useMemo(() => (stats ? listCurrencyTotals(stats) : []), [stats]);

    const partnersCount = useMemo(() => {
        if (!stats)
            return 0;
        const partners = new Set<string>();
        for (const map of [stats.invoiced, stats.remuneration]) {
            for (const partner of Object.keys(map)) {
                if (partner !== '—')
                    partners.add(partner);
            }
        }
        return partners.size;
    }, [stats]);

    const yearLabel = yearFilter === 'all'
        ? t('timeTrackingPage.invoices.statistics.allYears')
        : yearFilter;

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
                    .replace('{partners}', String(partnersCount))}
            </p>

            {loading && (
                <div className="tt-inv-stats__state">{t('timeTrackingPage.common.loading')}</div>
            )}
            {error && !loading && (
                <div className="tt-inv-stats__state tt-inv-stats__state--error">{error}</div>
            )}
            {!loading && !error && stats && (
                currencyTotals.length === 0 ? (
                    <div className="tt-inv-stats__state">{t('timeTrackingPage.invoices.statistics.empty')}</div>
                ) : (
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
                                        <th>{t('timeTrackingPage.invoices.statistics.totalInvoiced')}</th>
                                        <th>{t('timeTrackingPage.invoices.statistics.totalRemuneration')}</th>
                                        <th>{t('timeTrackingPage.invoices.statistics.totalBalance')}</th>
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
                )
            )}
        </div>
    );
}
