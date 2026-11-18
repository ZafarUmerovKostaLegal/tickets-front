import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import './SnowCap.css';

type SnowCapProps = {
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

/** SVG box height; the tile's top edge sits EDGE px below the box top. Keep in sync with SnowCap.css. */
const BOX_H = 42;
const EDGE = 22;
/** Matches `--hn-tile-radius` in HomeNavTiles.css. */
const RADIUS = 14;
const MAX_DEPTH = 20;
const FROST = 2.2;
const ICICLES = 3;
const TOP_STEPS = 24;

const LEVEL = 1;
const MELT = 0.4;

/** Cursor dent: how deep a finger presses into the snow and how wide the dip is. */
const DENT_MAX = 7;
const DENT_WIDTH = 22;
const MAX_FLAKES = 18;

type Dent = { x: number; amount: number };

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

function cornerPoint(width: number, side: -1 | 1, theta: number, out: number): Pt {
    const cx = side < 0 ? RADIUS : width - RADIUS;
    const cy = EDGE + RADIUS;
    const r = RADIUS + out;
    return [cx + side * r * Math.sin(theta), cy - r * Math.cos(theta)];
}

/** Snow thickness along the tile (t: 0..1), with a soft heap, waves and small fluffy lumps. */
function makeDepth(seed: number, level: number, melt: number): (t: number) => number {
    const heap = 0.28 + rand(seed, 1) * 0.44;
    const ph1 = rand(seed, 2);
    const ph2 = rand(seed, 3);
    const ph3 = rand(seed, 4);
    const ph4 = rand(seed, 5);
    return (t: number) => {
        const taper = 0.45 + 0.55 * smoothstep(0, 0.16, t) * smoothstep(0, 0.16, 1 - t);
        const shape = 0.42
            + 0.58 * Math.exp(-(((t - heap) / 0.26) ** 2))
            + 0.12 * Math.sin(2 * Math.PI * (t * 1.6 + ph1))
            + 0.07 * Math.sin(2 * Math.PI * (t * 3.4 + ph2));
        const fluff = 0.06 * Math.sin(2 * Math.PI * (t * 9 + ph4)) + 0.035 * Math.sin(2 * Math.PI * (t * 17 + ph1));
        const lumps = melt * level * 1.6 * Math.sin(2 * Math.PI * (t * 6 + ph3));
        return FROST + level * MAX_DEPTH * taper * Math.max(0.15, shape + fluff) + lumps;
    };
}

function buildSnowPath(seed: number, width: number, level: number, melt: number, dent?: Dent): string {
    const base = makeDepth(seed, level, melt);
    const depth = (t: number) => {
        let d = base(t);
        if (dent && dent.amount > 0.01) {
            const dx = t * width - dent.x;
            d -= dent.amount * Math.exp(-((dx / DENT_WIDTH) ** 2));
        }
        return Math.max(FROST * 0.7, d);
    };

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

function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el)
            return;
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

function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
        && !!window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Snow drift on top of a tile.
 * Interactive: the pointer presses a dent into the surface (spring back on leave),
 * flakes crumble off where the pointer moves, and a press shakes loose a puff of snow.
 * The path is only recomputed while the pointer is over the tile.
 */
export function SnowCap({ seed }: SnowCapProps) {
    const uid = useId().replace(/:/g, '');
    const [ref, width] = useElementWidth<HTMLSpanElement>();
    const shapeRefs = useRef<Array<SVGPathElement | null>>([]);
    const flakesRef = useRef<HTMLSpanElement | null>(null);
    const pokeRef = useRef<SVGGElement | null>(null);

    const model = useMemo(() => {
        if (width < RADIUS * 4)
            return null;
        const lip = lipOf(LEVEL, MELT);
        const depth = makeDepth(seed, LEVEL, MELT);
        return {
            path: buildSnowPath(seed, width, LEVEL, MELT),
            surfaceY: (x: number) => EDGE - depth(Math.min(1, Math.max(0, x / width))),
            drops: icicleLayout(seed, width).map((ic, k) => ({
                x: ic.x,
                y: EDGE + lip + MELT * ic.len + LEVEL * 0.8 + 0.6,
                dur: 5 + rand(seed, 90 + k) * 4,
                delay: -rand(seed, 95 + k) * 8,
            })),
            sparkles: Array.from({ length: 6 }, (_, i) => ({
                x: RADIUS + 8 + rand(seed, 50 + i) * (width - 2 * RADIUS - 16),
                y: EDGE - 3 - rand(seed, 60 + i) * 9,
                delay: rand(seed, 70 + i) * 5,
            })),
            grain: Array.from({ length: Math.round(width / 12) }, (_, i) => {
                const x = RADIUS + rand(seed, 200 + i) * (width - 2 * RADIUS);
                const surface = EDGE - depth(x / width);
                return {
                    x,
                    y: surface + 2 + rand(seed, 300 + i) * Math.max(1, EDGE - surface),
                    r: 0.35 + rand(seed, 400 + i) * 0.5,
                };
            }),
            shineDelay: rand(seed, 82) * 6,
        };
    }, [seed, width]);

    useEffect(() => {
        const host = ref.current?.parentElement;
        const flakes = flakesRef.current;
        if (!host || !flakes || !model || prefersReducedMotion())
            return;

        let raf = 0;
        let last = 0;
        let dentX = width / 2;
        let targetX = dentX;
        let amount = 0;
        let velocity = 0;
        let target = 0;
        let lastFlakeAt = 0;

        const apply = () => {
            const d = buildSnowPath(seed, width, LEVEL, MELT, { x: dentX, amount });
            for (const p of shapeRefs.current)
                p?.setAttribute('d', d);
        };

        // Critically-damped-ish spring: quick press, soft rebound when the pointer leaves.
        const loop = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const accel = 260 * (target - amount) - 22 * velocity;
            velocity += accel * dt;
            amount = Math.max(0, amount + velocity * dt);
            dentX += (targetX - dentX) * Math.min(1, dt * 18);
            apply();
            if (target === 0 && amount < 0.02 && Math.abs(velocity) < 0.05) {
                amount = 0;
                velocity = 0;
                apply();
                raf = 0;
                return;
            }
            raf = requestAnimationFrame(loop);
        };
        const kick = () => {
            if (!raf) {
                last = performance.now();
                raf = requestAnimationFrame(loop);
            }
        };

        const spawnFlake = (x: number, strength: number) => {
            if (flakes.childElementCount >= MAX_FLAKES)
                return;
            const el = document.createElement('i');
            el.className = 'snow-cap__flake';
            const size = 2 + Math.random() * 2.5 * strength;
            el.style.left = `${x + (Math.random() - 0.5) * 8}px`;
            el.style.top = `${model.surfaceY(x) + Math.random() * 3}px`;
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            el.style.setProperty('--dx', `${(Math.random() - 0.5) * 36 * strength}px`);
            el.style.setProperty('--rise', `${-4 - Math.random() * 12 * strength}px`);
            el.style.setProperty('--fall', `${26 + Math.random() * 30}px`);
            el.style.animationDuration = `${0.9 + Math.random() * 0.7}s`;
            el.addEventListener('animationend', () => el.remove(), { once: true });
            flakes.appendChild(el);
        };

        const localPoint = (e: PointerEvent) => {
            const rect = flakes.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };

        const onEnter = () => {
            for (let i = 0; i < 3; i += 1)
                spawnFlake(RADIUS + Math.random() * (width - 2 * RADIUS), 0.7);
        };

        const onMove = (e: PointerEvent) => {
            if (e.pointerType === 'touch')
                return;
            const { x, y } = localPoint(e);
            // Press only near the snow: strongest on the cap, fading out ~60px into the tile.
            const near = 1 - Math.min(1, Math.max(0, (y - EDGE) / 60));
            targetX = Math.min(width - RADIUS, Math.max(RADIUS, x));
            target = DENT_MAX * near;
            kick();
            const now = performance.now();
            if (near > 0.55 && now - lastFlakeAt > 90) {
                lastFlakeAt = now;
                spawnFlake(targetX, 0.8);
            }
        };

        const onLeave = () => {
            target = 0;
            kick();
        };

        const onDown = (e: PointerEvent) => {
            const { x } = localPoint(e);
            targetX = Math.min(width - RADIUS, Math.max(RADIUS, x));
            dentX = targetX;
            velocity += 70;
            if (e.pointerType === 'touch') {
                target = 0;
            }
            kick();
            for (let i = 0; i < 9; i += 1)
                spawnFlake(targetX + (Math.random() - 0.5) * 60, 1.2);
            const poke = pokeRef.current;
            if (poke) {
                poke.classList.remove('snow-cap__poke--on');
                void poke.getBoundingClientRect();
                poke.classList.add('snow-cap__poke--on');
            }
        };

        host.addEventListener('pointerenter', onEnter);
        host.addEventListener('pointermove', onMove, { passive: true });
        host.addEventListener('pointerleave', onLeave);
        host.addEventListener('pointerdown', onDown, { passive: true });
        return () => {
            cancelAnimationFrame(raf);
            host.removeEventListener('pointerenter', onEnter);
            host.removeEventListener('pointermove', onMove);
            host.removeEventListener('pointerleave', onLeave);
            host.removeEventListener('pointerdown', onDown);
            flakes.replaceChildren();
        };
    }, [model, ref, seed, width]);

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
                            <stop offset="0%" style={{ stopColor: 'var(--snow-cap-top)' }} />
                            <stop offset="58%" style={{ stopColor: 'var(--snow-cap-mid)' }} />
                            <stop offset="84%" style={{ stopColor: 'var(--snow-cap-low)' }} />
                            <stop offset="100%" style={{ stopColor: 'var(--snow-cap-base)' }} />
                        </linearGradient>
                        <linearGradient id={`sc-shine-${uid}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
                            <stop offset="50%" stopColor="#fff" stopOpacity="0.9" />
                            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                        </linearGradient>
                        <clipPath id={`sc-clip-${uid}`}>
                            <path ref={(el) => { shapeRefs.current[0] = el; }} d={model.path} />
                        </clipPath>
                    </defs>
                    <g className="snow-cap__drift">
                        <g ref={pokeRef} className="snow-cap__poke" onAnimationEnd={(e) => e.currentTarget.classList.remove('snow-cap__poke--on')}>
                            <path
                                ref={(el) => { shapeRefs.current[1] = el; }}
                                d={model.path}
                                fill={`url(#sc-fill-${uid})`}
                                className="snow-cap__body"
                            />
                            <g clipPath={`url(#sc-clip-${uid})`}>
                                {model.grain.map((g, i) => (
                                    <circle key={i} className="snow-cap__grain" cx={g.x} cy={g.y} r={g.r} />
                                ))}
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
                            <path ref={(el) => { shapeRefs.current[2] = el; }} d={model.path} className="snow-cap__rim" />
                        </g>
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
            <span ref={flakesRef} className="snow-cap__flakes" />
        </span>
    );
}
