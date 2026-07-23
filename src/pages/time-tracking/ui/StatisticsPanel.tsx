import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatPeriodLabel } from '@entities/time-tracking/lib/reportsPeriodRange';
import {
    PERIOD_OPTIONS,
    type PeriodGranularity,
} from '@entities/time-tracking/model/reportsPanelConfig';
import { useI18n, ttReportPeriodLabel } from '@shared/i18n';
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

const IcoChevLeft = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
    </svg>
);
const IcoChevRight = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M9 18l6-6-6-6" />
    </svg>
);
const IcoChevDown = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M6 9l6 6 6-6" />
    </svg>
);

function shiftPeriodDate(date: Date, granularity: PeriodGranularity, direction: -1 | 1): Date {
    const next = new Date(date);
    if (granularity === 'week')
        next.setDate(next.getDate() + 7 * direction);
    else if (granularity === 'month')
        next.setMonth(next.getMonth() + direction);
    else if (granularity === 'quarter')
        next.setMonth(next.getMonth() + 3 * direction);
    else if (granularity === 'year')
        next.setFullYear(next.getFullYear() + direction);
    return next;
}

/** Empty shell — previous statistics UI removed; rebuild here. */
export function StatisticsPanel() {
    const { t } = useI18n();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = parseStatsTab(searchParams.get('statsTab'));

    const [periodDate, setPeriodDate] = useState(() => new Date());
    const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>('month');
    const [periodDropdown, setPeriodDropdown] = useState(false);
    const periodDropdownRef = useRef<HTMLDivElement>(null);

    const setActiveTab = useCallback((tab: StatisticsTabId) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('statsTab', tab);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const periodTitle = useMemo(() => {
        if (periodGranularity === 'all')
            return t('timeTrackingPage.reports.periods.all');
        return formatPeriodLabel(periodDate, periodGranularity);
    }, [periodDate, periodGranularity, t]);

    useEffect(() => {
        if (!periodDropdown)
            return;
        const onDoc = (e: MouseEvent) => {
            if (periodDropdownRef.current && !periodDropdownRef.current.contains(e.target as Node))
                setPeriodDropdown(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [periodDropdown]);

    return (
        <div className="tt-reports tt-statistics" aria-label={t('timeTrackingPage.statistics.pageAria')}>
            <div className="tt-reports__type-block">
                <p className="tt-reports__type-block-title" id="tt-stats-section-heading">
                    {t('timeTrackingPage.statistics.sectionTitle')}
                </p>
                <nav
                    className="tt-reports__type-nav"
                    role="tablist"
                    aria-labelledby="tt-stats-section-heading"
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

            <div className="tt-reports__header">
                <div className="tt-reports__header-left">
                    <button
                        type="button"
                        className="tt-reports__nav-btn"
                        onClick={() => setPeriodDate((d) => shiftPeriodDate(d, periodGranularity, -1))}
                        disabled={periodGranularity === 'all'}
                        aria-label={t('timeTrackingPage.reports.header.prevPeriod')}
                    >
                        <IcoChevLeft />
                    </button>
                    <h2 className="tt-reports__period-title">{periodTitle}</h2>
                    <button
                        type="button"
                        className="tt-reports__nav-btn"
                        onClick={() => setPeriodDate((d) => shiftPeriodDate(d, periodGranularity, 1))}
                        disabled={periodGranularity === 'all'}
                        aria-label={t('timeTrackingPage.reports.header.nextPeriod')}
                    >
                        <IcoChevRight />
                    </button>
                </div>
                <div className="tt-reports__header-right">
                    <div className="tt-reports__period-dropdown-wrap" ref={periodDropdownRef}>
                        <button
                            type="button"
                            className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--dropdown"
                            onClick={() => setPeriodDropdown((v) => !v)}
                            aria-expanded={periodDropdown}
                        >
                            {ttReportPeriodLabel(periodGranularity, t)} <IcoChevDown />
                        </button>
                        {periodDropdown ? (
                            <div className="tt-reports__period-dropdown" role="listbox">
                                {PERIOD_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        role="option"
                                        aria-selected={periodGranularity === opt.id}
                                        className={`tt-reports__period-opt${periodGranularity === opt.id ? ' tt-reports__period-opt--active' : ''}`}
                                        onClick={() => {
                                            setPeriodGranularity(opt.id);
                                            setPeriodDropdown(false);
                                        }}
                                    >
                                        {ttReportPeriodLabel(opt.id, t)}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
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
