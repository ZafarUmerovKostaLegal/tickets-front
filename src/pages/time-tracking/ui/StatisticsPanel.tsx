import { useI18n } from '@shared/i18n';
import './StatisticsPanel.css';

/** Empty shell — previous statistics UI removed; rebuild here. */
export function StatisticsPanel() {
    const { t } = useI18n();

    return (
        <div className="tt-statistics" aria-label={t('timeTrackingPage.statistics.pageAria')}>
            <h1 className="tt-statistics__page-title">{t('timeTrackingPage.tabs.statistics')}</h1>
        </div>
    );
}
