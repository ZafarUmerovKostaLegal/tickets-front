import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '@shared/i18n';
import './StatisticsPanel.css';

type StatisticsTabId = 'project' | 'team' | 'user';

const STATS_TABS: {
    id: StatisticsTabId;
    labelKey:
        | 'timeTrackingPage.statistics.subTabs.project'
        | 'timeTrackingPage.statistics.subTabs.team'
        | 'timeTrackingPage.statistics.subTabs.user';
}[] = [
    { id: 'project', labelKey: 'timeTrackingPage.statistics.subTabs.project' },
    { id: 'team', labelKey: 'timeTrackingPage.statistics.subTabs.team' },
    { id: 'user', labelKey: 'timeTrackingPage.statistics.subTabs.user' },
];

function parseStatsTab(raw: string | null): StatisticsTabId {
    if (raw === 'team' || raw === 'user' || raw === 'project')
        return raw;
    return 'project';
}

/** Empty shell — previous statistics UI removed; rebuild here. */
export function StatisticsPanel() {
    const { t } = useI18n();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseStatsTab(searchParams.get('statsTab'));

    const setActiveTab = useCallback((tab: StatisticsTabId) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('statsTab', tab);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    return (
        <div className="tt-statistics" aria-label={t('timeTrackingPage.statistics.pageAria')}>
            <h1 className="tt-statistics__page-title">{t('timeTrackingPage.tabs.statistics')}</h1>

            <div className="tt-reports__type-block tt-statistics__tabs-block">
                <nav
                    className="tt-reports__type-nav"
                    role="tablist"
                    aria-label={t('timeTrackingPage.statistics.subTabs.aria')}
                >
                    {STATS_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            id={`tt-stats-tab-${tab.id}`}
                            aria-selected={activeTab === tab.id}
                            aria-controls="tt-stats-tabpanel"
                            className={`tt-reports__type-tab${activeTab === tab.id ? ' tt-reports__type-tab--active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {t(tab.labelKey)}
                        </button>
                    ))}
                </nav>
            </div>

            <div
                key={activeTab}
                id="tt-stats-tabpanel"
                role="tabpanel"
                className="tt-statistics__tab-panel"
                aria-labelledby={`tt-stats-tab-${activeTab}`}
            />
        </div>
    );
}
