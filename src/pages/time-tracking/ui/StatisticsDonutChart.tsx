import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';
import type { PieSectorShapeProps } from 'recharts';
import { useI18n } from '@shared/i18n';
import { StatisticsChartAnchor, StatisticsPiePortalTooltip } from './StatisticsRechartsPortalTooltip';
import { StatisticsWidgetEmpty } from './StatisticsWidgetEmpty';
import type { PieSlice } from './statisticsChartTypes';
import { formatChartHours, truncateChartLabel } from './statisticsChartLayout';

const CHART_TOOLTIP = {
    allowEscapeViewBox: { x: true, y: true } as const,
    wrapperStyle: { display: 'none' },
};

const PIE_ANIMATION = {
    isAnimationActive: true,
    animationBegin: 0,
    animationDuration: 600,
    animationEasing: 'ease-out' as const,
};

function sliceHours(slice: PieSlice): number {
    return slice.hours ?? slice.value;
}

function makePieShape(activeName?: string) {
    return function renderPieShape(props: PieSectorShapeProps) {
        const isHighlighted = Boolean(props.isActive) || (activeName != null && props.name === activeName);
        const outerRadius = isHighlighted
            ? Number(props.outerRadius ?? 0) + 6
            : props.outerRadius;

        return (
            <Sector
                {...props}
                outerRadius={outerRadius}
                stroke="var(--app-surface, #fff)"
                strokeWidth={2}
            />
        );
    };
}

function pieCenterAverage(data: PieSlice[]): string {
    if (!data.length)
        return '—';
    const withHours = data.filter((d) => d.hours != null);
    if (withHours.length) {
        const avg = withHours.reduce((s, d) => s + (d.hours ?? 0), 0) / withHours.length;
        return String(Math.round(avg * 10) / 10);
    }
    const total = data.reduce((s, d) => s + d.value, 0);
    return String(Math.round((total / data.length) * 10) / 10);
}

function sharePercent(hours: number, totalHours: number): number {
    if (totalHours <= 0)
        return 0;
    return Math.round((hours / totalHours) * 1000) / 10;
}

type Props = {
    data: PieSlice[];
    centerLabel?: string;
};

export function StatisticsDonutChart({ data, centerLabel }: Props) {
    const { t } = useI18n();
    const w = 'timeTrackingPage.statistics.widgets';
    const [activeName, setActiveName] = useState<string | undefined>(undefined);
    const [hiddenNames, setHiddenNames] = useState<Set<string>>(() => new Set());

    const visibleData = useMemo(
        () => data.filter((entry) => !hiddenNames.has(entry.name)),
        [data, hiddenNames],
    );

    const totalHours = useMemo(
        () => visibleData.reduce((sum, entry) => sum + sliceHours(entry), 0),
        [visibleData],
    );

    const pieShape = useMemo(() => makePieShape(activeName), [activeName]);

    const activeSlice = useMemo(
        () => (activeName ? visibleData.find((entry) => entry.name === activeName) : undefined),
        [activeName, visibleData],
    );

    const toggleHidden = useCallback((name: string) => {
        setHiddenNames((prev) => {
            if (prev.has(name)) {
                const next = new Set(prev);
                next.delete(name);
                return next;
            }
            const wouldRemain = data.filter((entry) => !prev.has(entry.name) && entry.name !== name);
            if (wouldRemain.length === 0)
                return prev;
            const next = new Set(prev);
            next.add(name);
            return next;
        });
    }, [data]);

    useEffect(() => {
        if (activeName && hiddenNames.has(activeName))
            setActiveName(undefined);
    }, [activeName, hiddenNames]);

    const clearHover = useCallback(() => {
        setActiveName(undefined);
    }, []);

    if (!data.length)
        return <StatisticsWidgetEmpty />;

    if (!visibleData.length)
        return <StatisticsWidgetEmpty />;

    const centerTitle = activeSlice
        ? truncateChartLabel(activeSlice.name, 22)
        : (centerLabel ?? '');
    const centerValue = activeSlice
        ? formatChartHours(sliceHours(activeSlice))
        : pieCenterAverage(visibleData);
    const centerSub = activeSlice
        ? t(`${w}.pieShare`).replace('{pct}', String(sharePercent(sliceHours(activeSlice), totalHours)))
        : t(`${w}.pieSegments`).replace('{count}', String(visibleData.length));

    return (
        <div className="tt-statistics__pie-widget">
            <ul className="tt-statistics__pie-legend" aria-label={t(`${w}.pieLegendAria`)}>
                {data.map((entry) => {
                    const hidden = hiddenNames.has(entry.name);
                    const isActive = !hidden && activeName === entry.name;
                    const hours = sliceHours(entry);
                    const pct = sharePercent(hours, totalHours);
                    const toggleTitle = hidden
                        ? t(`${w}.pieLegendShow`)
                        : t(`${w}.pieLegendHide`);
                    return (
                        <li key={entry.name}>
                            <button
                                type="button"
                                className={[
                                    'tt-statistics__pie-legend-item',
                                    isActive ? ' tt-statistics__pie-legend-item--active' : '',
                                    hidden ? ' tt-statistics__pie-legend-item--hidden' : '',
                                ].join('')}
                                aria-pressed={!hidden}
                                title={`${entry.name} · ${formatChartHours(hours)} (${pct}%) — ${toggleTitle}`}
                                onMouseEnter={() => {
                                    if (!hidden)
                                        setActiveName(entry.name);
                                }}
                                onMouseLeave={clearHover}
                                onFocus={() => {
                                    if (!hidden)
                                        setActiveName(entry.name);
                                }}
                                onBlur={clearHover}
                                onClick={() => toggleHidden(entry.name)}
                            >
                                <span className="tt-statistics__pie-legend-dot" style={{ backgroundColor: entry.color }} />
                                <span className="tt-statistics__pie-legend-text">{entry.name}</span>
                                <span className="tt-statistics__pie-legend-meta">{formatChartHours(hours)}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <StatisticsChartAnchor className="tt-statistics__pie-widget-chart">
                <div
                    className={`tt-statistics__pie-wrap${activeSlice ? ' tt-statistics__pie-wrap--active' : ''}`}
                    onMouseLeave={clearHover}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={visibleData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius="52%"
                                outerRadius="78%"
                                paddingAngle={visibleData.length > 8 ? 1 : 2}
                                stroke="var(--app-surface, #fff)"
                                strokeWidth={2}
                                {...PIE_ANIMATION}
                                shape={pieShape}
                                onMouseEnter={(_entry, index) => {
                                    const name = visibleData[index]?.name;
                                    if (name)
                                        setActiveName(name);
                                }}
                                onMouseLeave={clearHover}
                            >
                                {visibleData.map((entry) => (
                                    <Cell
                                        key={entry.name}
                                        fill={entry.color}
                                        opacity={activeName && entry.name !== activeName ? 0.38 : 1}
                                        style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                {...CHART_TOOLTIP}
                                content={(
                                    <StatisticsPiePortalTooltip
                                        totalHours={totalHours}
                                        valueFormatter={(value) => formatChartHours(value)}
                                        shareLabel={(pct) => t(`${w}.pieShare`).replace('{pct}', String(pct))}
                                    />
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    {centerLabel ? (
                        <div className={`tt-statistics__pie-center-badge${activeSlice ? ' tt-statistics__pie-center-badge--hover' : ''}`}>
                            <span className="tt-statistics__pie-center-label" title={activeSlice?.name}>{centerTitle}</span>
                            <span className="tt-statistics__pie-center-value">{centerValue}</span>
                            <span className="tt-statistics__pie-center-sub">{centerSub}</span>
                        </div>
                    ) : null}
                </div>
            </StatisticsChartAnchor>
        </div>
    );
}
