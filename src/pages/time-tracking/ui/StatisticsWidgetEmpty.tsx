import { useI18n } from '@shared/i18n';

export function StatisticsWidgetEmpty() {
    const { t } = useI18n();
    return (
        <p className="tt-statistics__widget-empty" role="status">
            {t('timeTrackingPage.statistics.widgets.noData')}
        </p>
    );
}
