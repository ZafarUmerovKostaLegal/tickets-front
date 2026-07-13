import { type CSSProperties, useMemo, useState } from 'react';
import { useI18n } from '@shared/i18n';
import { StatisticsWidgetEmpty } from './StatisticsWidgetEmpty';
import type { StackedBarRow } from './statisticsChartTypes';
import { formatChartHours } from './statisticsChartLayout';

type StackedRow = StackedBarRow & { total: number };

type Props = {
    data: StackedBarRow[];
    onRowClick?: (row: StackedBarRow) => void;
    interactive?: boolean;
    searchable?: boolean;
    scrollable?: boolean;
};

function matchesSearch(name: string, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q)
        return true;
    const normalized = name.toLowerCase();
    return q.split(/\s+/).every((part) => normalized.includes(part));
}

export function StatisticsStackedBarList({ data, onRowClick, interactive = false, searchable = false, scrollable = false }: Props) {
    const { t } = useI18n();
    const w = 'timeTrackingPage.statistics.widgets';
    const [searchQuery, setSearchQuery] = useState('');

    const rows = useMemo((): StackedRow[] => (
        data.map((row) => ({
            ...row,
            total: row.primary + row.secondary,
        }))
    ), [data]);

    const filteredRows = useMemo(() => {
        if (!searchable || !searchQuery.trim())
            return rows;
        return rows.filter((row) => matchesSearch(row.name, searchQuery));
    }, [rows, searchable, searchQuery]);

    const maxTotal = useMemo(
        () => Math.max(...filteredRows.map((r) => r.total), 0),
        [filteredRows],
    );

    const portfolioTotal = useMemo(
        () => filteredRows.reduce((s, r) => s + r.total, 0),
        [filteredRows],
    );

    const listAnimateKey = useMemo(
        () => rows.map((r) => r.id || r.name).join('\u0001'),
        [rows],
    );

    if (!rows.length)
        return <StatisticsWidgetEmpty />;

    const hasSecondary = rows.some((r) => r.secondary > 0);
    const hasSearchQuery = searchQuery.trim().length > 0;

    return (
        <div className="tt-statistics__bar-list-wrap">
            <div className="tt-statistics__bar-list-toolbar">
                <div className="tt-statistics__bar-list-legend" aria-hidden>
                    <span className="tt-statistics__bar-list-legend-item">
                        <span className="tt-statistics__bar-list-swatch tt-statistics__bar-list-swatch--billable" />
                        {t(`${w}.billable`)}
                    </span>
                    {hasSecondary ? (
                        <span className="tt-statistics__bar-list-legend-item">
                            <span className="tt-statistics__bar-list-swatch tt-statistics__bar-list-swatch--nonbillable" />
                            {t(`${w}.nonBillable`)}
                        </span>
                    ) : null}
                </div>
                {searchable ? (
                    <div className="tt-statistics__bar-list-search-wrap">
                        <input
                            type="search"
                            className="tt-statistics__bar-list-search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t(`${w}.searchLawyer`)}
                            aria-label={t(`${w}.searchLawyerAria`)}
                        />
                        <span className="tt-statistics__bar-list-count" aria-live="polite">
                            {t(`${w}.employeesShown`).replace('{count}', String(filteredRows.length))}
                        </span>
                    </div>
                ) : null}
            </div>
            {!filteredRows.length ? (
                <p className="tt-statistics__bar-list-empty" role="status">
                    {t(`${w}.searchNoResults`)}
                </p>
            ) : (
                <ul
                    key={listAnimateKey}
                    className={`tt-statistics__bar-list${scrollable ? ' tt-statistics__bar-list--scrollable' : ''}${hasSearchQuery ? ' tt-statistics__bar-list--filtered' : ' tt-statistics__bar-list--animate-in'}`}
                >
                    {filteredRows.map((row, index) => {
                        const trackPct = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
                        const billPct = row.total > 0 ? (row.primary / row.total) * 100 : 100;
                        const sharePct = portfolioTotal > 0 ? (row.total / portfolioTotal) * 100 : 0;
                        const rowStyle = { '--row-index': index } as CSSProperties;
                        const rowBody = (
                            <>
                                <span className="tt-statistics__bar-list-name" title={row.name}>
                                    {row.name}
                                </span>
                                <span className="tt-statistics__bar-list-track-col">
                                    <span
                                        className="tt-statistics__bar-list-track"
                                        style={{ width: `${Math.max(trackPct, row.total > 0 ? 4 : 0)}%` }}
                                    >
                                        <span
                                            className="tt-statistics__bar-list-fill tt-statistics__bar-list-fill--billable"
                                            style={{ width: `${billPct}%` }}
                                        />
                                        {row.secondary > 0 ? (
                                            <span
                                                className="tt-statistics__bar-list-fill tt-statistics__bar-list-fill--nonbillable"
                                                style={{ width: `${100 - billPct}%` }}
                                            />
                                        ) : null}
                                    </span>
                                </span>
                                <span className="tt-statistics__bar-list-meta">
                                    <span className="tt-statistics__bar-list-total">{formatChartHours(row.total)}</span>
                                    <span
                                        className="tt-statistics__bar-list-share"
                                        title={t(`${w}.shareOfTotal`).replace('{pct}', sharePct.toFixed(1))}
                                    >
                                        {sharePct.toFixed(1)}%
                                    </span>
                                    {hasSecondary ? (
                                        <span
                                            className="tt-statistics__bar-list-billable-pct"
                                            title={t(`${w}.billableShare`).replace('{pct}', billPct.toFixed(0))}
                                        >
                                            {billPct.toFixed(0)}% {t(`${w}.billableShort`)}
                                        </span>
                                    ) : null}
                                </span>
                            </>
                        );

                        if (interactive && onRowClick) {
                            return (
                                <li key={row.id || row.name} style={rowStyle}>
                                    <button
                                        type="button"
                                        className="tt-statistics__bar-list-row tt-statistics__bar-list-row--interactive"
                                        onClick={() => onRowClick(row)}
                                        title={t(`${w}.drillDownHint`)}
                                    >
                                        {rowBody}
                                    </button>
                                </li>
                            );
                        }

                        return (
                            <li key={row.id || row.name} className="tt-statistics__bar-list-row" style={rowStyle}>
                                {rowBody}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
