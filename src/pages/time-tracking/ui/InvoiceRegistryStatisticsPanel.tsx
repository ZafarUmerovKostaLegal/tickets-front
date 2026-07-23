import { useState } from 'react';
import {
    INVOICE_REGISTRY_STATS_YEARS,
    type RegistryStatsYearFilter,
} from '@entities/time-tracking/model/invoiceRegistry/partnerStatistics';
import { useI18n } from '@shared/i18n';
import './InvoiceRegistryStatisticsPanel.css';

/** Shell — year filter only; stats content cleared for rebuild. */
export function InvoiceRegistryStatisticsPanel() {
    const { t } = useI18n();
    const [yearFilter, setYearFilter] = useState<RegistryStatsYearFilter>('all');

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
        </div>
    );
}
