import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './StatisticsPanel.css';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { useAppToast } from '@shared/ui';
import {
    exportLaborStatistics,
    fetchAllLaborStatisticsDetailRows,
    fetchLaborStatistics,
    fetchLaborStatisticsMeta,
    isForbiddenError,
    type LaborStatisticsChartsApi,
    type LaborStatisticsMeta,
} from '@entities/time-tracking';
import { canViewTimeTrackingStatistics } from '@entities/time-tracking/model/timeTrackingAccess';
import { StatisticsDetailTable } from './StatisticsDetailTable';
import { StatisticsExportBar } from './StatisticsExportBar';
import { StatisticsFilters } from './StatisticsFilters';
import { StatisticsSummary } from './StatisticsSummary';
import { StatisticsDailyChart } from './StatisticsDailyChart';
import { StatisticsProjectTab } from './StatisticsProjectTab';
import { StatisticsTeamTab } from './StatisticsTeamTab';
import { StatisticsUserTab } from './StatisticsUserTab';
import { StatisticsFinanceTab } from './StatisticsFinanceTab';
import { applyStatisticsChartDrillDown, type StatisticsChartDrillKind } from './statisticsChartDrillDown';
import type { StackedBarRow } from './statisticsChartTypes';
import { defaultStatisticsLaborFilters } from './statisticsLaborDefaults';
import {
    parseStatisticsSubTab,
    STATISTICS_SUB_TABS,
    type StatisticsLaborDetailRow,
    type StatisticsLaborFilters,
    type StatisticsLaborKpi,
    type StatisticsLaborSort,
    type StatisticsSubTab,
} from './statisticsLaborTypes';
import { getStatisticsLaborScope } from './statisticsLaborUtils';

function kpiFromApi(kpi: {
    total_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    paid_amount: number;
    paid_currency: string;
    rate_per_hour: number;
    billable_amount?: number;
    billable_currency?: string;
    accrued_rate_per_hour?: number;
}): StatisticsLaborKpi {
    return {
        totalHours: kpi.total_hours,
        billableHours: kpi.billable_hours,
        nonBillableHours: kpi.non_billable_hours,
        paidAmount: kpi.paid_amount,
        paidCurrency: kpi.paid_currency,
        ratePerHour: kpi.rate_per_hour,
        billableAmount: kpi.billable_amount ?? 0,
        billableCurrency: kpi.billable_currency || kpi.paid_currency || 'USD',
        accruedRatePerHour: kpi.accrued_rate_per_hour ?? 0,
    };
}

const EMPTY_KPI: StatisticsLaborKpi = {
    totalHours: 0,
    billableHours: 0,
    nonBillableHours: 0,
    paidAmount: 0,
    paidCurrency: 'USD',
    ratePerHour: 0,
    billableAmount: 0,
    billableCurrency: 'USD',
    accruedRatePerHour: 0,
};

function mapDetailRows(rows: Array<Record<string, unknown> | StatisticsLaborDetailRow>): StatisticsLaborDetailRow[] {
    return rows.map((r) => {
        const row = r as StatisticsLaborDetailRow & { billable_amount?: number };
        return {
            ...row,
            billable_amount: row.billable_amount ?? 0,
        };
    });
}

export function StatisticsPanel() {
    const { t } = useI18n();
    const { pushToast } = useAppToast();
    const { user } = useCurrentUser();
    const canView = canViewTimeTrackingStatistics(user);
    const scope = useMemo(() => getStatisticsLaborScope(user), [user]);
    const [searchParams, setSearchParams] = useSearchParams();

    const statsTab = parseStatisticsSubTab(searchParams.get('statsTab'));
    const setStatsTab = useCallback((tab: StatisticsSubTab) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('statsTab', tab);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const [filters, setFilters] = useState<StatisticsLaborFilters>(() => {
        const base = defaultStatisticsLaborFilters();
        if (scope.mode === 'partner' && scope.partnerId)
            return { ...base, partnerId: '' };
        if (scope.mode === 'lawyer' && scope.lawyerId)
            return { ...base, lawyerId: scope.lawyerId };
        return base;
    });
    const [tableQuery, setTableQuery] = useState('');
    const [sort, setSort] = useState<StatisticsLaborSort>({ key: 'hours', dir: 'desc' });
    const [meta, setMeta] = useState<LaborStatisticsMeta | null>(null);
    const [metaError, setMetaError] = useState<string | null>(null);
    const [rows, setRows] = useState<StatisticsLaborDetailRow[]>([]);
    const [kpi, setKpi] = useState<StatisticsLaborKpi>(EMPTY_KPI);
    const [charts, setCharts] = useState<LaborStatisticsChartsApi | null>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const detailSectionRef = useRef<HTMLDivElement>(null);

    const laborQuery = useMemo(() => ({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        partnerId: filters.partnerId || undefined,
        teamId: filters.teamId || undefined,
        clientId: filters.clientId || undefined,
        projectId: filters.projectId || undefined,
        workTypeId: filters.workTypeId || undefined,
        lawyerId: filters.lawyerId || undefined,
        projectStatusId: filters.projectStatusId || undefined,
        activeProjectsOnly: filters.activeProjectsOnly,
        q: tableQuery.trim() || undefined,
        sort: sort.key,
        sortDir: sort.dir,
        page: 1,
        perPage: 200,
    }), [filters, tableQuery, sort]);

    useEffect(() => {
        if (!canView)
            return;
        let cancelled = false;
        setMetaError(null);
        void fetchLaborStatisticsMeta()
            .then((m) => {
                if (!cancelled)
                    setMeta(m);
            })
            .catch((e) => {
                if (!cancelled) {
                    setMeta(null);
                    setMetaError(
                        isForbiddenError(e)
                            ? t('timeTrackingPage.statistics.errors.forbidden')
                            : e instanceof Error ? e.message : t('timeTrackingPage.statistics.errors.metaLoadFailed'),
                    );
                }
            });
        return () => {
            cancelled = true;
        };
    }, [canView, t]);

    useEffect(() => {
        if (!canView)
            return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            setLoading(true);
            setError(null);
            void fetchLaborStatistics(laborQuery)
                .then(async (data) => {
                    if (cancelled)
                        return;
                    const detailRows = data.detail.total > data.detail.rows.length
                        ? await fetchAllLaborStatisticsDetailRows(laborQuery, data)
                        : data.detail.rows;
                    if (cancelled)
                        return;
                    setRows(mapDetailRows(detailRows));
                    setKpi(kpiFromApi(data.kpi));
                    setCharts(data.charts);
                })
                .catch((e) => {
                    if (cancelled)
                        return;
                    setRows([]);
                    setCharts(null);
                    setKpi(EMPTY_KPI);
                    setError(
                        isForbiddenError(e)
                            ? t('timeTrackingPage.statistics.errors.forbidden')
                            : e instanceof Error ? e.message : t('timeTrackingPage.statistics.errors.loadFailed'),
                    );
                })
                .finally(() => {
                    if (!cancelled)
                        setLoading(false);
                });
        }, 300);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [canView, laborQuery, t]);

    const runExport = useCallback(async (format: 'csv' | 'xlsx') => {
        setExporting(true);
        try {
            await exportLaborStatistics({
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
                partnerId: filters.partnerId || undefined,
                teamId: filters.teamId || undefined,
                clientId: filters.clientId || undefined,
                projectId: filters.projectId || undefined,
                workTypeId: filters.workTypeId || undefined,
                lawyerId: filters.lawyerId || undefined,
                projectStatusId: filters.projectStatusId || undefined,
                activeProjectsOnly: filters.activeProjectsOnly,
                q: tableQuery.trim() || undefined,
                sort: sort.key,
                sortDir: sort.dir,
            }, format);
        }
        catch (e) {
            pushToast({
                message: isForbiddenError(e)
                    ? t('timeTrackingPage.statistics.errors.forbidden')
                    : e instanceof Error ? e.message : t('timeTrackingPage.statistics.errors.exportFailed'),
                variant: 'error',
            });
        }
        finally {
            setExporting(false);
        }
    }, [filters, tableQuery, sort, pushToast, t]);

    const handleChartDrillDown = useCallback((kind: StatisticsChartDrillKind, row: StackedBarRow) => {
        const next = applyStatisticsChartDrillDown(kind, row, filters, meta);
        if (!next) {
            pushToast({
                message: t('timeTrackingPage.statistics.errors.drillDownFailed'),
                variant: 'warning',
            });
            return;
        }
        setFilters(next);
        window.setTimeout(() => {
            detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
    }, [filters, meta, pushToast, t]);

    const scopeNotice = scope.mode === 'partner'
        ? t('timeTrackingPage.statistics.scope.partner')
        : scope.mode === 'lawyer'
            ? t('timeTrackingPage.statistics.scope.lawyer')
            : null;

    if (!canView) {
        return (
            <section className="tt-statistics" aria-label={t('timeTrackingPage.statistics.pageAria')}>
                <p className="tt-statistics__scope-notice" role="alert">
                    {t('timeTrackingPage.statistics.errors.forbidden')}
                </p>
            </section>
        );
    }

    return (
        <section className="tt-statistics" aria-label={t('timeTrackingPage.statistics.pageAria')}>
            {scopeNotice ? (
                <p className="tt-statistics__scope-notice" role="status">{scopeNotice}</p>
            ) : null}

            {metaError ? (
                <p className="tt-statistics__scope-notice" role="status">{metaError}</p>
            ) : null}

            {error ? (
                <p className="tt-statistics__scope-notice" role="alert">{error}</p>
            ) : null}

            {loading ? (
                <p className="tt-statistics__scope-notice" role="status">{t('timeTrackingPage.common.loading')}</p>
            ) : null}

            <StatisticsFilters
                filters={filters}
                onChange={setFilters}
                disabledPartner={false}
                disabledLawyer={scope.mode === 'lawyer'}
                meta={meta}
            />

            <nav className="tt-statistics__subtabs" aria-label={t('timeTrackingPage.statistics.subTabs.aria')}>
                {STATISTICS_SUB_TABS.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        className={`tt-statistics__subtab${statsTab === tab ? ' tt-statistics__subtab--active' : ''}`}
                        aria-current={statsTab === tab ? 'page' : undefined}
                        onClick={() => setStatsTab(tab)}
                    >
                        {t(`timeTrackingPage.statistics.subTabs.${tab}`)}
                    </button>
                ))}
            </nav>

            <StatisticsSummary kpi={kpi} financeMode={statsTab === 'finance' || statsTab === 'team'} />

            <div className="tt-statistics__charts">
                <h3 className="tt-statistics__section-title">{t('timeTrackingPage.statistics.chartsTitle')}</h3>
                <Suspense fallback={<div className="tt-statistics__charts-fallback" aria-busy="true" />}>
                    {statsTab === 'project' ? (
                        <StatisticsProjectTab charts={charts} onDrillDown={handleChartDrillDown} />
                    ) : null}
                    {statsTab === 'team' ? (
                        <StatisticsTeamTab charts={charts} onDrillDown={handleChartDrillDown} />
                    ) : null}
                    {statsTab === 'user' ? (
                        <StatisticsUserTab charts={charts} detailRows={rows} onDrillDown={handleChartDrillDown} />
                    ) : null}
                    {statsTab === 'finance' ? (
                        <StatisticsFinanceTab charts={charts} />
                    ) : null}
                    {statsTab === 'user' || statsTab === 'project' ? (
                        <StatisticsDailyChart charts={charts} />
                    ) : null}
                </Suspense>
            </div>

            <div ref={detailSectionRef} className="tt-statistics__detail-toolbar">
                <StatisticsExportBar
                    onExportCsv={() => void runExport('csv')}
                    onExportExcel={() => void runExport('xlsx')}
                    onExportPdf={() => window.print()}
                    disabled={!rows.length || loading || exporting}
                />
            </div>

            <StatisticsDetailTable
                rows={rows}
                query={tableQuery}
                onQueryChange={setTableQuery}
                sort={sort}
                onSortChange={setSort}
            />
        </section>
    );
}
