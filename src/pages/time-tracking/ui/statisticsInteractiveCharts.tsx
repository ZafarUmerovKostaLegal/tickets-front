import { useCallback, useState, type ReactNode } from 'react';
import { formatChartHours } from './statisticsChartLayout';
import { StatisticsRechartsPortalTooltip } from './StatisticsRechartsPortalTooltip';

export const GRID_STROKE = 'var(--app-border, #334155)';
export const TICK_FILL = 'var(--app-muted, #94a3b8)';

export const CHART_TOOLTIP = {
    allowEscapeViewBox: { x: true, y: true } as const,
    wrapperStyle: { display: 'none' },
};

export const CHART_CROSSHAIR_CURSOR = {
    stroke: 'var(--app-muted, #94a3b8)',
    strokeWidth: 1,
    strokeDasharray: '4 4',
};

export const LINE_ANIMATION = {
    isAnimationActive: true,
    animationDuration: 650,
    animationEasing: 'ease-out' as const,
};

export const ACTIVE_DOT = {
    r: 5,
    strokeWidth: 2,
    stroke: 'var(--app-surface, #fff)',
};

export type NumericSummary = {
    total: number;
    avg: number;
    peak: number;
    min: number;
};

export function computeNumericSummary(values: readonly number[]): NumericSummary {
    if (!values.length)
        return { total: 0, avg: 0, peak: 0, min: 0 };
    const total = values.reduce((sum, v) => sum + v, 0);
    return {
        total,
        avg: total / values.length,
        peak: Math.max(...values),
        min: Math.min(...values),
    };
}

export function xAxisInterval(pointCount: number): number | 'preserveStartEnd' {
    if (pointCount <= 7)
        return 0;
    if (pointCount <= 14)
        return 1;
    if (pointCount <= 31)
        return Math.max(1, Math.floor(pointCount / 10));
    return Math.max(2, Math.floor(pointCount / 8));
}

export function xAxisLabelAngle(pointCount: number): number {
    if (pointCount <= 4)
        return -25;
    if (pointCount <= 10)
        return -35;
    return -90;
}

export function formatVsAvgDelta(value: number, avg: number): { text: string; positive: boolean } {
    if (avg <= 0)
        return { text: '—', positive: true };
    const delta = value - avg;
    const pct = Math.round((delta / avg) * 1000) / 10;
    const sign = pct > 0 ? '+' : '';
    return { text: `${sign}${pct}%`, positive: delta >= 0 };
}

export function useHiddenSeriesKeys() {
    const [hidden, setHidden] = useState<Set<string>>(() => new Set());

    const toggle = useCallback((key: string) => {
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(key))
                next.delete(key);
            else
                next.add(key);
            return next;
        });
    }, []);

    const isVisible = useCallback((key: string) => !hidden.has(key), [hidden]);

    return { hidden, toggle, isVisible };
}

type SeriesLegendItem = {
    key: string;
    label: string;
    color: string;
};

export function StatisticsSeriesLegend({
    items,
    hidden,
    activeKey,
    onToggle,
    onHover,
}: {
    items: SeriesLegendItem[];
    hidden: Set<string>;
    activeKey?: string;
    onToggle: (key: string) => void;
    onHover: (key: string | undefined) => void;
}) {
    return (
        <ul className="tt-statistics__series-legend" aria-label="Series">
            {items.map((item) => {
                const isHidden = hidden.has(item.key);
                const isActive = !isHidden && activeKey === item.key;
                return (
                    <li key={item.key}>
                        <button
                            type="button"
                            className={[
                                'tt-statistics__series-legend-btn',
                                isActive ? ' tt-statistics__series-legend-btn--active' : '',
                                isHidden ? ' tt-statistics__series-legend-btn--hidden' : '',
                            ].join('')}
                            aria-pressed={!isHidden}
                            onMouseEnter={() => {
                                if (!isHidden)
                                    onHover(item.key);
                            }}
                            onMouseLeave={() => onHover(undefined)}
                            onFocus={() => {
                                if (!isHidden)
                                    onHover(item.key);
                            }}
                            onBlur={() => onHover(undefined)}
                            onClick={() => onToggle(item.key)}
                        >
                            <span className="tt-statistics__series-legend-dot" style={{ backgroundColor: item.color }} />
                            <span>{item.label}</span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

export function StatisticsChartSummaryBar({
    summary,
    activeLabel,
    activeValue,
    labels,
    vsAvgText,
}: {
    summary: NumericSummary;
    activeLabel?: string;
    activeValue?: number;
    labels: {
        avg: string;
        total: string;
        peak: string;
        point: string;
    };
    vsAvgText?: string;
}) {
    const showingPoint = activeLabel != null && activeValue != null;

    return (
        <div className="tt-statistics__chart-hover-kpis" role="status" aria-live="polite">
            {showingPoint ? (
                <>
                    <div className="tt-statistics__chart-hover-kpi tt-statistics__chart-hover-kpi--primary">
                        <span className="tt-statistics__chart-hover-kpi-label">{labels.point}</span>
                        <span className="tt-statistics__chart-hover-kpi-title" title={activeLabel}>{activeLabel}</span>
                        <span className="tt-statistics__chart-hover-kpi-value">{formatChartHours(activeValue)}</span>
                        {vsAvgText ? (
                            <span className="tt-statistics__chart-hover-kpi-delta">{vsAvgText}</span>
                        ) : null}
                    </div>
                    <div className="tt-statistics__chart-hover-kpi">
                        <span className="tt-statistics__chart-hover-kpi-label">{labels.avg}</span>
                        <span className="tt-statistics__chart-hover-kpi-value">{formatChartHours(summary.avg)}</span>
                    </div>
                </>
            ) : (
                <>
                    <div className="tt-statistics__chart-hover-kpi">
                        <span className="tt-statistics__chart-hover-kpi-label">{labels.avg}</span>
                        <span className="tt-statistics__chart-hover-kpi-value">{formatChartHours(summary.avg)}</span>
                    </div>
                    <div className="tt-statistics__chart-hover-kpi">
                        <span className="tt-statistics__chart-hover-kpi-label">{labels.total}</span>
                        <span className="tt-statistics__chart-hover-kpi-value">{formatChartHours(summary.total)}</span>
                    </div>
                    <div className="tt-statistics__chart-hover-kpi">
                        <span className="tt-statistics__chart-hover-kpi-label">{labels.peak}</span>
                        <span className="tt-statistics__chart-hover-kpi-value">{formatChartHours(summary.peak)}</span>
                    </div>
                </>
            )}
        </div>
    );
}

export function StatisticsLinePortalTooltip({
    active,
    payload,
    label,
    coordinate,
    average,
    vsAvgLabel,
    footer,
}: {
    active?: boolean;
    payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
    label?: string;
    coordinate?: { x?: number; y?: number };
    average?: number;
    vsAvgLabel?: (deltaText: string, positive: boolean) => string;
    footer?: ReactNode;
}) {
    if (!active || !payload?.length)
        return null;

    const total = payload.reduce((sum, entry) => sum + Number(entry.value ?? 0), 0);

    return (
        <StatisticsRechartsPortalTooltip active={active} coordinate={coordinate}>
            {label ? <div className="tt-statistics__tooltip-title">{label}</div> : null}
            <ul className="tt-statistics__tooltip-list">
                {payload.map((entry) => (
                    <li key={String(entry.dataKey ?? entry.name)} className="tt-statistics__tooltip-row">
                        <span className="tt-statistics__tooltip-dot" style={{ background: entry.color }} />
                        <span>{entry.name}</span>
                        <strong>{formatChartHours(Number(entry.value ?? 0))}</strong>
                    </li>
                ))}
                {payload.length > 1 ? (
                    <li className="tt-statistics__tooltip-row tt-statistics__tooltip-row--total">
                        <span />
                        <span>Σ</span>
                        <strong>{formatChartHours(total)}</strong>
                    </li>
                ) : null}
            </ul>
            {average != null && payload.length === 1 && vsAvgLabel ? (() => {
                const { text, positive } = formatVsAvgDelta(Number(payload[0]?.value ?? 0), average);
                return (
                    <p className={`tt-statistics__tooltip-foot${positive ? '' : ' tt-statistics__tooltip-foot--down'}`}>
                        {vsAvgLabel(text, positive)}
                    </p>
                );
            })() : null}
            {footer}
        </StatisticsRechartsPortalTooltip>
    );
}
