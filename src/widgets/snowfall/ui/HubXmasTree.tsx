import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './HubXmasTree.css';

type Pt = [number, number];
type Garland = { a: Pt; c: Pt; b: Pt };

const TIERS: Array<{ top: number; base: number; half: number }> = [
    { top: 20, base: 62, half: 27 },
    { top: 42, base: 98, half: 39 },
    { top: 72, base: 136, half: 51 },
];

const GARLANDS: Garland[] = [
    { a: [41, 50], c: [60, 62], b: [80, 47] },
    { a: [31, 82], c: [62, 98], b: [92, 78] },
    { a: [20, 116], c: [60, 136], b: [104, 110] },
];

const BALLS: Array<{ x: number; y: number; r: number; tone: string }> = [
    { x: 52, y: 40, r: 3.2, tone: 'ruby' },
    { x: 70, y: 52, r: 3.6, tone: 'gold' },
    { x: 46, y: 64, r: 3.4, tone: 'ice' },
    { x: 76, y: 70, r: 3.8, tone: 'ruby' },
    { x: 58, y: 80, r: 3.4, tone: 'gold' },
    { x: 37, y: 94, r: 4, tone: 'gold' },
    { x: 84, y: 92, r: 3.6, tone: 'ice' },
    { x: 64, y: 106, r: 4.2, tone: 'ruby' },
    { x: 40, y: 122, r: 3.8, tone: 'ice' },
    { x: 80, y: 126, r: 4.2, tone: 'gold' },
    { x: 26, y: 132, r: 3.6, tone: 'ruby' },
    { x: 95, y: 131, r: 3.6, tone: 'ruby' },
];

const BALLS_FROM = 1.9;
const BALL_STEP = 0.17;
const STAR_AT = BALLS_FROM + BALLS.length * BALL_STEP + 0.2;

function tierPath({ top, base, half }: { top: number; base: number; half: number }): string {
    const l = 60 - half;
    const r = 60 + half;
    const w = half / 2;
    return `M60 ${top} C${60 + w * 0.35} ${top + 10} ${r - 6} ${base - 10} ${r} ${base}`
        + ` Q${r - w * 0.5} ${base - 4} ${60 + w * 0.6} ${base + 2}`
        + ` Q60 ${base - 3} ${60 - w * 0.6} ${base + 2}`
        + ` Q${l + w * 0.5} ${base - 4} ${l} ${base}`
        + ` C${l + 6} ${base - 10} ${60 - w * 0.35} ${top + 10} 60 ${top} Z`;
}

function quad({ a, c, b }: Garland, t: number): Pt {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

const LIGHTS = GARLANDS.flatMap((g, gi) => {
    const n = 4 + gi * 2;
    return Array.from({ length: n }, (_, k) => {
        const [x, y] = quad(g, (k + 0.5) / n);
        return { x, y, gi, k };
    });
});

export function HubXmasTree({ label }: { label: string }) {
    const ref = useRef<HTMLButtonElement | null>(null);
    const [round, setRound] = useState(0);

    useEffect(() => {
        const onVisibility = () => ref.current?.classList.toggle('hub-tree--paused', document.hidden);
        document.addEventListener('visibilitychange', onVisibility);
        onVisibility();
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    return (
        <button
            ref={ref}
            type="button"
            className="hub-tree"
            aria-label={label}
            title={label}
            onClick={() => setRound((value) => value + 1)}
        >
            <svg key={round} className="hub-tree__svg" viewBox="0 0 120 160" aria-hidden>
                <defs>
                    <linearGradient id="hub-tree-green" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" style={{ stopColor: 'var(--hub-tree-green-hi)' }} />
                        <stop offset="1" style={{ stopColor: 'var(--hub-tree-green-lo)' }} />
                    </linearGradient>
                    <radialGradient id="hub-tree-shine" cx="0.35" cy="0.3" r="0.7">
                        <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
                        <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
                    </radialGradient>
                </defs>
                <ellipse className="hub-tree__shadow" cx="60" cy="151" rx="44" ry="3.5" />
                <rect className="hub-tree__trunk" x="54" y="133" width="12" height="18" rx="2" />
                <g className="hub-tree__body">
                    {TIERS.map((tier, i) => (
                        <path
                            key={i}
                            className="hub-tree__tier"
                            d={tierPath(tier)}
                            fill="url(#hub-tree-green)"
                            style={{ '--d': `${0.12 + (2 - i) * 0.16}s` } as CSSProperties}
                        />
                    ))}
                </g>
                {GARLANDS.map((g, i) => (
                    <path
                        key={i}
                        className="hub-tree__garland"
                        d={`M${g.a[0]} ${g.a[1]} Q${g.c[0]} ${g.c[1]} ${g.b[0]} ${g.b[1]}`}
                        pathLength={1}
                        style={{ '--d': `${0.8 + i * 0.32}s` } as CSSProperties}
                    />
                ))}
                {LIGHTS.map((l, i) => (
                    <circle
                        key={i}
                        className="hub-tree__light"
                        cx={l.x}
                        cy={l.y}
                        r="1.3"
                        style={{
                            '--d': `${1.05 + l.gi * 0.32 + l.k * 0.05}s`,
                            '--tw': `${(i * 0.37) % 2.4}s`,
                        } as CSSProperties}
                    />
                ))}
                {BALLS.map((b, i) => (
                    <g
                        key={i}
                        className={`hub-tree__ball hub-tree__ball--${b.tone}`}
                        style={{ '--d': `${(BALLS_FROM + i * BALL_STEP).toFixed(2)}s` } as CSSProperties}
                    >
                        <line x1={b.x} y1={b.y - b.r - 3} x2={b.x} y2={b.y - b.r} className="hub-tree__thread" />
                        <circle cx={b.x} cy={b.y} r={b.r} className="hub-tree__ball-fill" />
                        <circle cx={b.x} cy={b.y} r={b.r} fill="url(#hub-tree-shine)" />
                    </g>
                ))}
                <g className="hub-tree__gifts" style={{ '--d': `${STAR_AT - 0.5}s` } as CSSProperties}>
                    <rect className="hub-tree__gift hub-tree__gift--ruby" x="22" y="137" width="20" height="14" rx="1.5" />
                    <rect className="hub-tree__ribbon" x="30.5" y="137" width="3" height="14" />
                    <path className="hub-tree__bow" d="M32 137 q-5 -6 -7 -1 q3 2 7 1 q5 -6 7 -1 q-3 2 -7 1" />
                    <rect className="hub-tree__gift hub-tree__gift--gold" x="79" y="141" width="15" height="10" rx="1.5" />
                    <rect className="hub-tree__ribbon hub-tree__ribbon--ruby" x="85" y="141" width="2.6" height="10" />
                </g>
                <g className="hub-tree__star" style={{ '--d': `${STAR_AT.toFixed(2)}s` } as CSSProperties}>
                    <circle className="hub-tree__star-glow" cx="60" cy="16" r="10" />
                    <path
                        className="hub-tree__star-fill"
                        d="M60 6 L62.9 12.6 L70 13.2 L64.6 17.8 L66.2 24.8 L60 21.1 L53.8 24.8 L55.4 17.8 L50 13.2 L57.1 12.6 Z"
                    />
                </g>
            </svg>
        </button>
    );
}
