import { useEffect, useMemo, useState } from 'react';
import {
    INVOICE_REGISTRY_STATS_YEARS,
    loadInvoiceRegistryStatsRows,
    sumInvoicedByCurrency,
    sumInvoicedByPartnerCurrency,
    type RegistryStatsYearFilter,
} from '@entities/time-tracking/model/invoiceRegistry/partnerStatistics';
import { useI18n } from '@shared/i18n';
import './InvoiceRegistryStatisticsPanel.css';

function formatInvoicedAmount(n: number, currency?: string): string {
    if (!Number.isFinite(n) || n <= 0)
        return '—';
    const value = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency ? `${value} ${currency}` : value;
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
                                            <th>{t('timeTrackingPage.invoices.statistics.colPartner')}</th>
                                            {partnerMatrix.currencies.map((currency) => (
                                                <th key={currency}>{currency}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {partnerMatrix.partners.map((row) => (
                                            <tr key={row.partner}>
                                                <td>
                                                    <span className="tt-inv-stats__partner-badge">{row.partner}</span>
                                                </td>
                                                {partnerMatrix.currencies.map((currency) => (
                                                    <td key={currency} className="tt-inv-stats__num">
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
                </>
            )}
        </div>
    );
}
