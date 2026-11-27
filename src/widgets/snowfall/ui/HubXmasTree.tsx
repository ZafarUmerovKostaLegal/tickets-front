import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './HubXmasTree.css';

type Pt = [number, number];
type Tier = { top: number; base: number; half: number; tips: number };

const CX = 70;

const TIERS: Tier[] = [
    { top: 20, base: 50, half: 17, tips: 3 },
    { top: 33, base: 72, half: 27, tips: 4 },
    { top: 49, base: 97, half: 37, tips: 5 },
    { top: 67, base: 123, half: 47, tips: 6 },
    { top: 87, base: 150, half: 58, tips: 7 },
];

function tierTips({ base, half, tips }: Tier): Pt[] {
    return Array.from({ length: tips + 1 }, (_, k) => {
        const x = CX - half + (2 * half * k) / tips;
        const t = Math.abs(x - CX) / half;
        return [x, base + 3 * (1 - t * t) - (k % 2) * 1.2];
    });
}

function tierPath(tier: Tier, grow = 0): string {
    const { top, half } = tier;
    const pts = tierTips({ ...tier, half: half + grow, base: tier.base + grow });
    const depth = (tier.base - top) * 0.16;
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    let d = `M${CX} ${top - grow} C${CX - half * 0.25} ${top + 8} ${first[0] + 5} ${first[1] - 12} ${first[0]} ${first[1]}`;
    for (let k = 0; k < pts.length - 1; k += 1) {
        const [x1, y1] = pts[k]!;
        const [x2, y2] = pts[k + 1]!;
        const mx = (x1 + x2) / 2;
        const my = Math.min(y1, y2) - depth;
        d += ` Q${x1 + (x2 - x1) * 0.18} ${y1 - depth * 0.15} ${mx} ${my}`;
        d += ` Q${x2 - (x2 - x1) * 0.18} ${y2 - depth * 0.15} ${x2} ${y2}`;
    }
    d += ` C${last[0] - 5} ${last[1] - 12} ${CX + half * 0.25} ${top + 8} ${CX} ${top - grow} Z`;
    return d;
}

function ribs(tier: Tier): string {
    return tierTips(tier)
        .map(([x, y]) => {
            const sx = CX + (x - CX) * 0.45;
            const sy = tier.top + (tier.base - tier.top) * 0.55;
            return `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${(CX + (x - CX) * 0.8).toFixed(1)} ${(y - 6).toFixed(1)} ${x.toFixed(1)} ${(y - 1).toFixed(1)}`;
        })
        .join(' ');
}

const SNOW = TIERS.flatMap((tier, ti) => tierTips(tier)
    .filter((_, k) => (k + ti) % 2 === 1 || k === 0 || k === tier.tips)
    .map(([x, y]) => ({ x: CX + (x - CX) * 0.9, y: y - 4.2, rx: 2.4 + ti * 0.25 })));

type Ornament = { x: number; y: number; r: number; tone: 'ruby' | 'gold' | 'silver' | 'ice'; kind: 'ball' | 'drop' };

const TONES: Ornament['tone'][] = ['ruby', 'gold', 'silver', 'ruby', 'ice', 'gold'];

const ORNAMENTS: Ornament[] = (() => {
    const out: Ornament[] = [];
    TIERS.forEach((tier, ti) => {
        tierTips(tier).forEach(([x, y], k) => {
            if (k === 0 || k === tier.tips || (k + ti) % 2 === 1)
                return;
            const i = out.length;
            out.push({ x, y: y + 3.4, r: 2.6 + ti * 0.35, tone: TONES[i % TONES.length]!, kind: i % 5 === 3 ? 'drop' : 'ball' });
        });
    });
    const inner: Array<[number, number, number]> = [[64, 42, 2.4], [77, 60, 2.8], [58, 82, 3], [83, 88, 3], [70, 108, 3.4], [50, 114, 3.2], [92, 136, 3.6], [62, 138, 3.4]];
    inner.forEach(([x, y, r], j) => out.push({ x, y, r, tone: TONES[(j + 2) % TONES.length]!, kind: 'ball' }));
    return out.sort((a, b) => b.y - a.y);
})();

type Garland = { a: Pt; c: Pt; b: Pt };

const GARLANDS: Garland[] = [
    { a: [57, 41], c: [72, 50], b: [84, 37] },
    { a: [49, 62], c: [70, 76], b: [93, 58] },
    { a: [39, 87], c: [72, 103], b: [104, 80] },
    { a: [29, 112], c: [70, 131], b: [114, 104] },
    { a: [21, 139], c: [74, 158], b: [122, 130] },
];

function quad({ a, c, b }: Garland, t: number): Pt {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

const LIGHT_TONES = ['warm', 'warm', 'gold', 'warm', 'rose'] as const;

const LIGHTS = GARLANDS.flatMap((g, gi) => {
    const n = 4 + gi * 2;
    return Array.from({ length: n }, (_, k) => {
        const [x, y] = quad(g, (k + 0.5) / n);
        return { x, y, gi, k, tone: LIGHT_TONES[(k + gi) % LIGHT_TONES.length]! };
    });
});

const TIER_DELAY = (i: number) => 0.1 + (TIERS.length - 1 - i) * 0.14;
const GARLAND_FROM = 0.95;
const GARLAND_STEP = 0.22;
const BALLS_FROM = GARLAND_FROM + GARLANDS.length * GARLAND_STEP + 0.1;
const BALL_STEP = 0.09;
const STAR_AT = BALLS_FROM + ORNAMENTS.length * BALL_STEP + 0.25;

function star(cx: number, cy: number, outer: number, inner: number): string {
    return Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? inner : outer;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    }).join(' ') + ' Z';
}

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
            <svg key={round} className="hub-tree__svg" viewBox="0 0 140 186" aria-hidden>
                <defs>
                    <linearGradient id="hub-tree-needles" x1="0" y1="0" x2="1" y2="0.4">
                        <stop offset="0" style={{ stopColor: 'var(--hub-tree-green-hi)' }} />
                        <stop offset="0.55" style={{ stopColor: 'var(--hub-tree-green-mid)' }} />
                        <stop offset="1" style={{ stopColor: 'var(--hub-tree-green-lo)' }} />
                    </linearGradient>
                    <linearGradient id="hub-tree-bark" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#5a3a24" />
                        <stop offset="0.45" stopColor="#8a5c3b" />
                        <stop offset="1" stopColor="#4a2f1d" />
                    </linearGradient>
                    <radialGradient id="hub-tree-drift" cx="0.5" cy="0.2" r="0.7">
                        <stop offset="0" style={{ stopColor: 'var(--hub-tree-snow)' }} />
                        <stop offset="1" style={{ stopColor: 'var(--hub-tree-snow-shade)' }} />
                    </radialGradient>
                    <radialGradient id="hub-tree-halo" cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0" stopColor="#ffd98a" stopOpacity="0.9" />
                        <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="hub-tree-star-glow" cx="0.5" cy="0.5" r="0.5">
                        <stop offset="0" stopColor="#fff3c4" stopOpacity="0.95" />
                        <stop offset="0.4" stopColor="#ffd36b" stopOpacity="0.45" />
                        <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="hub-tree-star" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#fff0b8" />
                        <stop offset="0.5" stopColor="#f0bf4f" />
                        <stop offset="1" stopColor="#c58a24" />
                    </linearGradient>
                    {(['ruby', 'gold', 'silver', 'ice'] as const).map((tone) => (
                        <radialGradient key={tone} id={`hub-tree-ball-${tone}`} cx="0.35" cy="0.3" r="0.75">
                            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
                            <stop offset="0.25" style={{ stopColor: `var(--hub-tree-${tone}-hi)` }} />
                            <stop offset="1" style={{ stopColor: `var(--hub-tree-${tone}-lo)` }} />
                        </radialGradient>
                    ))}
                </defs>

                <ellipse className="hub-tree__shadow" cx="70" cy="177" rx="58" ry="5" />
                <path className="hub-tree__drift" d="M14 178 C22 168 44 166 70 167 C96 166 118 168 126 178 Z" />
                <path className="hub-tree__trunk" d="M63 146 L77 146 L78.5 172 C74 174 66 174 61.5 172 Z" fill="url(#hub-tree-bark)" />
                <path className="hub-tree__bark" d="M66 152 L65.5 168 M71 150 L71.4 170 M75 154 L75.6 166" />

                {TIERS.map((tier, i) => (
                    <g key={i} className="hub-tree__tier" style={{ '--d': `${TIER_DELAY(i).toFixed(2)}s` } as CSSProperties}>
                        <path className="hub-tree__tier-shade" d={tierPath(tier)} transform="translate(0 2.2)" />
                        <path className="hub-tree__tier-body" d={tierPath(tier)} fill="url(#hub-tree-needles)" />
                        <path className="hub-tree__ribs" d={ribs(tier)} />
                        <path className="hub-tree__ribs hub-tree__ribs--dark" d={ribs({ ...tier, half: tier.half * 0.7, tips: tier.tips - 1 })} />
                    </g>
                ))}

                <g className="hub-tree__snow" style={{ '--d': `${(TIER_DELAY(0) + 0.45).toFixed(2)}s` } as CSSProperties}>
                    {SNOW.map((s, i) => (
                        <ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={1.1} />
                    ))}
                </g>

                {GARLANDS.map((g, i) => (
                    <path
                        key={i}
                        className="hub-tree__garland"
                        d={`M${g.a[0]} ${g.a[1]} Q${g.c[0]} ${g.c[1]} ${g.b[0]} ${g.b[1]}`}
                        pathLength={1}
                        style={{ '--d': `${(GARLAND_FROM + i * GARLAND_STEP).toFixed(2)}s` } as CSSProperties}
                    />
                ))}
                {LIGHTS.map((l, i) => (
                    <g
                        key={i}
                        className={`hub-tree__light hub-tree__light--${l.tone}`}
                        style={{
                            '--d': `${(GARLAND_FROM + l.gi * GARLAND_STEP + l.k * 0.035 + 0.15).toFixed(2)}s`,
                            '--tw': `${((i * 0.41) % 2.6).toFixed(2)}s`,
                        } as CSSProperties}
                    >
                        <circle className="hub-tree__halo" cx={l.x} cy={l.y} r="3.6" fill="url(#hub-tree-halo)" />
                        <circle className="hub-tree__bulb" cx={l.x} cy={l.y} r="1.25" />
                    </g>
                ))}

                {ORNAMENTS.map((o, i) => (
                    <g
                        key={i}
                        className="hub-tree__ball"
                        style={{ '--d': `${(BALLS_FROM + i * BALL_STEP).toFixed(2)}s` } as CSSProperties}
                    >
                        <line className="hub-tree__thread" x1={o.x} y1={o.y - o.r - 3.2} x2={o.x} y2={o.y - o.r} />
                        <rect className="hub-tree__cap" x={o.x - 1.1} y={o.y - o.r - 1.4} width="2.2" height="1.8" rx="0.4" />
                        {o.kind === 'drop' ? (
                            <path
                                d={`M${o.x} ${o.y - o.r} C${o.x + o.r * 1.1} ${o.y - o.r * 0.2} ${o.x + o.r * 0.5} ${o.y + o.r * 1.4} ${o.x} ${o.y + o.r * 2.2} C${o.x - o.r * 0.5} ${o.y + o.r * 1.4} ${o.x - o.r * 1.1} ${o.y - o.r * 0.2} ${o.x} ${o.y - o.r} Z`}
                                fill={`url(#hub-tree-ball-${o.tone})`}
                            />
                        ) : (
                            <circle cx={o.x} cy={o.y} r={o.r} fill={`url(#hub-tree-ball-${o.tone})`} />
                        )}
                    </g>
                ))}

                <g className="hub-tree__gifts" style={{ '--d': `${(STAR_AT - 0.55).toFixed(2)}s` } as CSSProperties}>
                    <rect className="hub-tree__gift hub-tree__gift--ruby" x="26" y="158" width="24" height="17" rx="1.6" />
                    <rect className="hub-tree__gift-lid hub-tree__gift--ruby" x="24.6" y="155" width="26.8" height="5" rx="1.2" />
                    <rect className="hub-tree__ribbon" x="36.5" y="155" width="3" height="20" />
                    <path className="hub-tree__bow" d="M38 155 C33 148 28 151 31.5 154.6 C33.5 156 36 155.6 38 155 C43 148 48 151 44.5 154.6 C42.5 156 40 155.6 38 155" />
                    <rect className="hub-tree__gift hub-tree__gift--green" x="88" y="162" width="17" height="13" rx="1.4" />
                    <rect className="hub-tree__gift-lid hub-tree__gift--green" x="87" y="160" width="19" height="4" rx="1" />
                    <rect className="hub-tree__ribbon" x="95" y="160" width="2.6" height="15" />
                    <rect className="hub-tree__gift hub-tree__gift--cream" x="104" y="166" width="14" height="10" rx="1.2" />
                    <rect className="hub-tree__ribbon hub-tree__ribbon--ruby" x="110" y="166" width="2.2" height="10" />
                    <rect className="hub-tree__ribbon hub-tree__ribbon--ruby" x="104" y="170" width="14" height="2" />
                </g>

                <g className="hub-tree__star" style={{ '--d': `${STAR_AT.toFixed(2)}s` } as CSSProperties}>
                    <circle className="hub-tree__star-glow" cx="70" cy="14" r="16" fill="url(#hub-tree-star-glow)" />
                    <g className="hub-tree__rays">
                        {Array.from({ length: 8 }, (_, i) => (
                            <line key={i} x1="70" y1="14" x2={70 + 15 * Math.cos((i * Math.PI) / 4)} y2={14 + 15 * Math.sin((i * Math.PI) / 4)} />
                        ))}
                    </g>
                    <path className="hub-tree__star-fill" d={star(70, 14.5, 9, 3.9)} fill="url(#hub-tree-star)" />
                    <path className="hub-tree__star-shine" d={star(68.8, 13.2, 3, 1.3)} />
                </g>
            </svg>
        </button>
    );
}
