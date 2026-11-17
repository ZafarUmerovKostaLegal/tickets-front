import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import './SnowCap.css';

type SnowCapProps = {
    /** Varies the silhouette and cycle timing so neighbouring tiles don't look identical. */
    seed: number;
};

function rand(seed: number, n: number): number {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

type Pt = [number, number];

/** Catmull-Rom handle, clamped so unevenly spaced points can't make the curve loop. */
function handle(from: Pt, prev: Pt, next: Pt, segment: Pt, sign: 1 | -1): Pt {
    let hx = (next[0] - prev[0]) / 6;
    let hy = (next[1] - prev[1]) / 6;
    const len = Math.hypot(hx, hy);
    const max = 0.4 * Math.hypot(segment[0] - from[0], segment[1] - from[1]);
    if (len > max && len > 0) {
        hx *= max / len;
        hy *= max / len;
    }
    return [from[0] + sign * hx, from[1] + sign * hy];
}

/** Smooth curve through points (Catmull-Rom → cubic Bézier). */
function smoothThrough(points: Pt[]): string {
    let d = '';
    for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        const c1 = handle(p1, p0, p2, p2, 1);
        const c2 = handle(p2, p1, p3, p1, -1);
        d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d;
}

/** SVG box height in px; the tile's top edge sits at EDGE. Keep in sync with SnowCap.css. */
const BOX_H = 42;
const EDGE = 22;
/** Matches `--hn-tile-radius` in HomeNavTiles.css. */
const RADIUS = 14;
const MAX_DEPTH = 20;
const FROST = 2.2;
const ICICLES = 3;
const TOP_STEPS = 12;

function icicleLayout(seed: number, width: number): Array<{ x: number; len: number }> {
    const span = width - 2 * RADIUS - 24;
    return Array.from({ length: ICICLES }, (_, k) => ({
        x: RADIUS + 12 + (k + 0.15 + rand(seed, 40 + k) * 0.7) * (span / ICICLES),
        len: 4 + rand(seed, 45 + k) * 8,
    }));
}

function lipOf(level: number, melt: number): number {
    return 0.8 + level * 2 - melt * 0.5;
}

/**
 * Point on the tile's rounded top corner. `theta` = 0 is the top of the arc,
 * π/2 the side; `side` = -1 for the left corner, 1 for the right one.
 * `out` pushes the point outward along the normal.
 */
function cornerPoint(width: number, side: -1 | 1, theta: number, out: number): Pt {
    const cx = side < 0 ? RADIUS : width - RADIUS;
    const cy = EDGE + RADIUS;
    const r = RADIUS + out;
    return [cx + side * r * Math.sin(theta), cy - r * Math.cos(theta)];
}

/**
 * Snow layer for a tile `width` px wide. `level` is snow depth
 * (0 = thin frost, 1 = full drift); `melt` grows icicles and makes the
 * surface lumpy. Deeper snow slumps further down the rounded corners.
 * Every state has the same point count so SMIL can morph between them.
 */
function buildSnowPath(seed: number, width: number, level: number, melt: number): string {
    const heap = 0.28 + rand(seed, 1) * 0.44;
    const ph1 = rand(seed, 2);
    const ph2 = rand(seed, 3);
    const ph3 = rand(seed, 4);
    const depth = (t: number) => {
        const taper = 0.45 + 0.55 * smoothstep(0, 0.16, t) * smoothstep(0, 0.16, 1 - t);
        const shape = 0.42
            + 0.58 * Math.exp(-(((t - heap) / 0.26) ** 2))
            + 0.12 * Math.sin(2 * Math.PI * (t * 1.6 + ph1))
            + 0.07 * Math.sin(2 * Math.PI * (t * 3.4 + ph2));
        const lumps = melt * level * 1.6 * Math.sin(2 * Math.PI * (t * 6 + ph3));
        return FROST + level * MAX_DEPTH * taper * Math.max(0.15, shape) + lumps;
    };

    // How far the snow has slid down each corner arc.
    const thetaEnd = lerp(0.4, 0.95, level);
    const noseThick = 0.8 + level * 2.2;
    const lip = lipOf(level, melt);
    const cornerFrac = RADIUS / width;
    const cornerDepth = [depth(cornerFrac), depth(1 - cornerFrac)];

    const cornerTop = (side: -1 | 1, depthAtTop: number): Pt[] => {
        const pts: Pt[] = [];
        for (const f of [1, 0.66, 0.33, 0]) {
            const th = thetaEnd * f;
            pts.push(cornerPoint(width, side, th, lerp(depthAtTop, noseThick, f)));
        }
        return side < 0 ? pts : pts.reverse();
    };
    const nose = (side: -1 | 1) => cornerPoint(width, side, thetaEnd + 0.06, noseThick * 0.3);
    const cornerUnder = (side: -1 | 1): Pt[] => {
        const pts = [0.66, 0.33].map((f) => cornerPoint(width, side, thetaEnd * f, 0.4));
        return side > 0 ? pts : pts.reverse();
    };

    const top: Pt[] = [nose(-1), ...cornerTop(-1, cornerDepth[0])];
    for (let i = 1; i < TOP_STEPS; i += 1) {
        const x = RADIUS + (i / TOP_STEPS) * (width - 2 * RADIUS);
        top.push([x, EDGE - depth(x / width)]);
    }
    top.push(...cornerTop(1, cornerDepth[1]), nose(1));

    const icicles = icicleLayout(seed, width);
    const under: Pt[] = [nose(1), ...cornerUnder(1), [width - RADIUS, EDGE + lip * 0.7]];
    for (let k = ICICLES - 1; k >= 0; k -= 1) {
        const { x, len } = icicles[k];
        const grown = melt * len + level * 0.8;
        const half = 2.2 + grown * 0.22;
        under.push(
            [x + half, EDGE + lip],
            [x + half * 0.4, EDGE + lip + grown * 0.55],
            [x, EDGE + lip + grown],
            [x - half * 0.4, EDGE + lip + grown * 0.55],
            [x - half, EDGE + lip],
        );
        if (k > 0)
            under.push([(x + icicles[k - 1].x) / 2, EDGE + lip * 0.85]);
    }
    under.push([RADIUS, EDGE + lip * 0.7], ...cornerUnder(-1), nose(-1));

    return `M ${top[0][0].toFixed(2)} ${top[0][1].toFixed(2)}${smoothThrough(top)}${smoothThrough(under)} Z`;
}


/** Resting shape: a full drift with short icicles. */
const LEVEL = 1;
const MELT = 0.4;

function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        // Layout width, unaffected by the tile's hover transform.
        const measure = () => setWidth(el.offsetWidth);
        measure();
        if (typeof ResizeObserver === 'undefined')
            return;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, width];
}

/**
 * Snow drift on top of a tile. The silhouette is static (no per-frame path
 * morphing): it settles in once, then only cheap CSS effects run —
 * a shine sweep, sparkles and drops falling from the icicles.
 */
export function SnowCap({ seed }: SnowCapProps) {
    const uid = useId().replace(/:/g, '');
    const [ref, width] = useElementWidth<HTMLSpanElement>();

    const model = useMemo(() => {
        if (width < RADIUS * 4)
            return null;
        const lip = lipOf(LEVEL, MELT);
        return {
            path: buildSnowPath(seed, width, LEVEL, MELT),
            drops: icicleLayout(seed, width).map((ic, k) => ({
                x: ic.x,
                y: EDGE + lip + MELT * ic.len + LEVEL * 0.8 + 0.6,
                dur: 5 + rand(seed, 90 + k) * 4,
                delay: -rand(seed, 95 + k) * 8,
            })),
            sparkles: Array.from({ length: 5 }, (_, i) => ({
                x: RADIUS + 8 + rand(seed, 50 + i) * (width - 2 * RADIUS - 16),
                y: EDGE - 3 - rand(seed, 60 + i) * 9,
                delay: rand(seed, 70 + i) * 5,
            })),
            shineDelay: rand(seed, 82) * 6,
        };
    }, [seed, width]);

    return (
        <span
            ref={ref}
            className="snow-cap"
            aria-hidden
            style={{ '--snow-cap-w': `${width}px` } as CSSProperties}
        >
            {model ? (
                <svg
                    viewBox={`0 0 ${width} ${BOX_H}`}
                    width={width}
                    height={BOX_H}
                    className="snow-cap__svg"
                >
                    <defs>
                        <linearGradient id={`sc-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--snow-cap-top)" />
                            <stop offset="55%" stopColor="var(--snow-cap-mid)" />
                            <stop offset="100%" stopColor="var(--snow-cap-base)" />
                        </linearGradient>
                        <linearGradient id={`sc-shine-${uid}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
                            <stop offset="50%" stopColor="#fff" stopOpacity="0.9" />
                            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                        </linearGradient>
                        <clipPath id={`sc-clip-${uid}`}>
                            <path d={model.path} />
                        </clipPath>
                    </defs>
                    <g className="snow-cap__drift">
                        <path d={model.path} fill={`url(#sc-fill-${uid})`} className="snow-cap__body" />
                        <g clipPath={`url(#sc-clip-${uid})`}>
                            <rect
                                className="snow-cap__shine"
                                x="-70"
                                y="0"
                                width="70"
                                height={BOX_H}
                                fill={`url(#sc-shine-${uid})`}
                                style={{ animationDelay: `${model.shineDelay}s` }}
                            />
                            {model.sparkles.map((s, i) => (
                                <circle
                                    key={i}
                                    className="snow-cap__sparkle"
                                    cx={s.x}
                                    cy={s.y}
                                    r="1.1"
                                    style={{ animationDelay: `${s.delay}s` }}
                                />
                            ))}
                        </g>
                        <path d={model.path} className="snow-cap__rim" />
                    </g>
                    {model.drops.map((d, i) => (
                        <ellipse
                            key={i}
                            className="snow-cap__drop"
                            cx={d.x}
                            cy={d.y}
                            rx="1.1"
                            ry="1.6"
                            style={{ animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s` }}
                        />
                    ))}
                </svg>
            ) : null}
        </span>
    );
}
