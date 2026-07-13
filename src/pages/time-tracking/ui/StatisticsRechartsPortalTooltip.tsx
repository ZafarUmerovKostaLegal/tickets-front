import {
    createContext,
    type CSSProperties,
    type ReactNode,
    type RefObject,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';

export type RechartsTooltipCoordinate = { x?: number; y?: number };

export const ChartAnchorRefContext = createContext<RefObject<HTMLElement | null> | null>(null);

type AnchorProps = {
    children: ReactNode;
    className?: string;
};

export function StatisticsChartAnchor({ children, className }: AnchorProps) {
    const ref = useRef<HTMLDivElement>(null);
    return (
        <ChartAnchorRefContext.Provider value={ref}>
            <div ref={ref} className={className ?? 'tt-statistics__chart-anchor'}>
                {children}
            </div>
        </ChartAnchorRefContext.Provider>
    );
}

type PortalProps = {
    active?: boolean;
    coordinate?: RechartsTooltipCoordinate;
    children: ReactNode;
};

function resolveChartPoint(
    anchor: HTMLElement | null,
    coordinate?: RechartsTooltipCoordinate,
): { x: number; y: number } | null {
    if (!anchor || coordinate?.x == null || coordinate?.y == null)
        return null;

    const chartWrapper = anchor.querySelector<HTMLElement>('.recharts-wrapper') ?? anchor;
    const rect = chartWrapper.getBoundingClientRect();
    return {
        x: rect.left + coordinate.x,
        y: rect.top + coordinate.y,
    };
}

function clampTooltipStyle(
    point: { x: number; y: number },
    tooltipEl: HTMLElement | null,
): CSSProperties {
    const pad = 14;
    const preferAbove = point.y > window.innerHeight * 0.28 && point.y > 100;

    let left = point.x;
    let top = preferAbove ? point.y - 10 : point.y + 10;
    let transform = preferAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';

    if (tooltipEl) {
        const width = tooltipEl.offsetWidth || 180;
        const height = tooltipEl.offsetHeight || 48;

        if (preferAbove && top - height < pad) {
            top = point.y + 12;
            transform = 'translate(-50%, 0)';
        }

        const half = width / 2;
        if (left - half < pad) {
            left = pad + half;
        } else if (left + half > window.innerWidth - pad) {
            left = window.innerWidth - pad - half;
        }

        const tipTop = transform.includes('-100%') ? top - height : top;
        const tipBottom = transform.includes('-100%') ? top : top + height;
        if (tipTop < pad) {
            top = point.y + 12;
            transform = 'translate(-50%, 0)';
        } else if (tipBottom > window.innerHeight - pad) {
            top = point.y - 10;
            transform = 'translate(-50%, -100%)';
        }
    }

    return {
        position: 'fixed',
        left,
        top,
        transform,
        zIndex: 10000,
        pointerEvents: 'none',
        maxWidth: 'min(22rem, calc(100vw - 1.75rem))',
    };
}

function usePortalTooltipStyle(active?: boolean, coordinate?: RechartsTooltipCoordinate): {
    style: CSSProperties | null;
    tooltipRef: RefObject<HTMLDivElement | null>;
} {
    const anchorRef = useContext(ChartAnchorRefContext);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<CSSProperties | null>(null);

    useLayoutEffect(() => {
        if (!active || coordinate?.x == null || coordinate?.y == null) {
            setStyle(null);
            return;
        }

        const point = resolveChartPoint(anchorRef?.current ?? null, coordinate);
        if (!point) {
            setStyle(null);
            return;
        }

        setStyle(clampTooltipStyle(point, null));

        const frame = window.requestAnimationFrame(() => {
            if (!tooltipRef.current)
                return;
            const next = clampTooltipStyle(point, tooltipRef.current);
            setStyle((prev) => {
                if (prev
                    && prev.left === next.left
                    && prev.top === next.top
                    && prev.transform === next.transform) {
                    return prev;
                }
                return next;
            });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [active, coordinate?.x, coordinate?.y, anchorRef]);

    return { style, tooltipRef };
}

export function StatisticsRechartsPortalTooltip({ active, coordinate, children }: PortalProps) {
    const { style, tooltipRef } = usePortalTooltipStyle(active, coordinate);
    if (!active || !style)
        return null;

    return createPortal(
        <div
            ref={tooltipRef}
            className="tt-statistics__tooltip tt-statistics__tooltip--portal"
            style={style}
            role="tooltip"
        >
            {children}
        </div>,
        document.body,
    );
}

type PiePayload = {
    name?: string;
    value?: number;
    color?: string;
    payload?: { hours?: number; value?: number };
};

export function StatisticsPiePortalTooltip({
    active,
    payload,
    coordinate,
    valueFormatter,
    totalHours,
    shareLabel,
}: {
    active?: boolean;
    payload?: PiePayload[];
    coordinate?: RechartsTooltipCoordinate;
    valueFormatter: (value: number) => string;
    totalHours?: number;
    shareLabel?: (pct: number) => string;
}) {
    const entry = payload?.[0];
    if (!active || !entry)
        return null;

    const raw = entry.payload?.hours ?? entry.payload?.value ?? entry.value ?? 0;
    const hours = Number(raw);
    const pct = totalHours != null && totalHours > 0
        ? Math.round((hours / totalHours) * 1000) / 10
        : null;

    return (
        <StatisticsRechartsPortalTooltip active={active} coordinate={coordinate}>
            <div className="tt-statistics__tooltip-pie">
                <span className="tt-statistics__tooltip-dot" style={{ background: entry.color }} />
                <div className="tt-statistics__tooltip-pie-body">
                    <span className="tt-statistics__tooltip-pie-name">{entry.name}</span>
                    <div className="tt-statistics__tooltip-pie-values">
                        <strong>{valueFormatter(hours)}</strong>
                        {pct != null && shareLabel ? (
                            <span className="tt-statistics__tooltip-pie-share">{shareLabel(pct)}</span>
                        ) : null}
                    </div>
                </div>
            </div>
        </StatisticsRechartsPortalTooltip>
    );
}
