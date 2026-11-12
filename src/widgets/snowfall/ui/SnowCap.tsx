import { useId, useMemo } from 'react';
import './SnowCap.css';

type SnowCapProps = {
    /** Varies the mound silhouette so neighbouring tiles don't look identical. */
    seed: number;
    /** Stagger for the settle-in animation. */
    index?: number;
};

function rand(seed: number, n: number): number {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

type Pt = [number, number];

/** Smooth curve through points (Catmull-Rom → cubic Bézier). */
function smoothThrough(points: Pt[]): string {
    let d = '';
    for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? p2;
        const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d;
}

/**
 * Snow cushion in a 200×34 box. The tile's top edge is at y = 20:
 * soft mounds rise above it, the snow drapes over both corners and
 * hangs a few px below the edge with a wavy underside and small drips.
 */
function buildDriftPath(seed: number): string {
    const edge = 20;
    // Top silhouette: broad, uneven mounds with one taller heap.
    const heap = 0.22 + rand(seed, 1) * 0.56;
    const top: Pt[] = [[3, edge + 5.5], [0.6, edge + 1.5], [2.6, edge - 3.5], [8, edge - 6.5]];
    const steps = 7;
    for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        const x = 6 + t * 188 + (rand(seed, i + 10) - 0.5) * 10;
        const bump = Math.exp(-(((t - heap) / 0.2) ** 2)) * 9;
        // Alternating pillows: odd points are crests, even ones soft saddles.
        const pillow = i % 2 === 1 ? 3 + rand(seed, i + 20) * 2.5 : rand(seed, i + 20) * 1.2;
        const h = 6.5 + bump + pillow;
        top.push([x, edge - Math.min(19, h)]);
    }
    top.push([192, edge - 6.5], [197.4, edge - 3.5], [199.4, edge + 1.5], [197, edge + 5.5]);

    // Underside: hangs 3–6px below the edge, with two drips.
    const drip1 = 30 + rand(seed, 41) * 45;
    const drip2 = 115 + rand(seed, 42) * 55;
    const under: Pt[] = [
        [197, edge + 5.5],
        [188, edge + 3.6],
        [drip2 + 6, edge + 3.6],
        [drip2 + 1.5, edge + 8.5 + rand(seed, 43) * 2],
        [drip2 - 3, edge + 3.4],
        [(drip1 + drip2) / 2, edge + 2.6 + rand(seed, 44) * 1.4],
        [drip1 + 4, edge + 3.2],
        [drip1, edge + 7 + rand(seed, 45) * 2],
        [drip1 - 4, edge + 3],
        [12, edge + 3.6],
        [3, edge + 5.5],
    ];

    return `M ${top[0][0]} ${top[0][1]}${smoothThrough(top)}${smoothThrough(under)} Z`;
}

export function SnowCap({ seed, index = 0 }: SnowCapProps) {
    const uid = useId().replace(/:/g, '');
    const path = useMemo(() => buildDriftPath(seed), [seed]);
    const sparkles = useMemo(
        () => Array.from({ length: 4 }, (_, i) => ({
            x: 20 + rand(seed, 50 + i) * 160,
            y: 14 + rand(seed, 60 + i) * 6,
            delay: rand(seed, 70 + i) * 4.5,
        })),
        [seed],
    );

    return (
        <span
            className="snow-cap"
            aria-hidden
            style={{ animationDelay: `${index * 90}ms` }}
        >
            <svg viewBox="0 0 200 34" preserveAspectRatio="none" className="snow-cap__svg">
                <defs>
                    <linearGradient id={`sc-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--snow-cap-top)" />
                        <stop offset="55%" stopColor="var(--snow-cap-mid)" />
                        <stop offset="100%" stopColor="var(--snow-cap-base)" />
                    </linearGradient>
                    <linearGradient id={`sc-shine-${uid}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
                        <stop offset="50%" stopColor="#fff" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                    </linearGradient>
                    <clipPath id={`sc-clip-${uid}`}>
                        <path d={path} />
                    </clipPath>
                </defs>
                <path d={path} fill={`url(#sc-fill-${uid})`} className="snow-cap__body" />
                <g clipPath={`url(#sc-clip-${uid})`}>
                    <rect className="snow-cap__shine" x="-60" y="0" width="60" height="34" fill={`url(#sc-shine-${uid})`} />
                </g>
                <path d={path} className="snow-cap__rim" vectorEffect="non-scaling-stroke" />
                {sparkles.map((s, i) => (
                    <circle
                        key={i}
                        className="snow-cap__sparkle"
                        cx={s.x}
                        cy={s.y}
                        r="0.9"
                        style={{ animationDelay: `${s.delay}s` }}
                    />
                ))}
            </svg>
        </span>
    );
}
