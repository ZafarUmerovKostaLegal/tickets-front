import { useId, useMemo } from 'react';
import './TileFestiveAccent.css';

type TileFestiveAccentProps = {
    seed: number;
    compact?: boolean;
};

type Pt = [number, number];

const W = 150;
const H = 104;
const ORIGIN: Pt = [W + 2, H + 2];

function rand(seed: number, n: number): number {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

function fmt(p: Pt): string {
    return `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
}

type Branch = { main: string; subs: string; twigs: string; tip: Pt };

function buildFrost(seed: number): { branches: Branch[]; crystals: Array<{ p: Pt; r: number; delay: number }> } {
    let n = 0;
    const r = () => rand(seed, (n += 1));
    const count = 4;
    const branches: Branch[] = [];
    const crystals: Array<{ p: Pt; r: number; delay: number }> = [];
    const HEX = Math.PI / 3;
    const ray = (p: Pt, a: number, l: number): Pt => [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l];

    for (let b = 0; b < count; b += 1) {
        const span = (b + 0.5) / count;
        const ang = Math.PI + span * (Math.PI / 2) + (r() - 0.5) * 0.12;
        const diag = 1 - Math.abs(span - 0.5) * 1.2;
        const len = 50 + diag * 50 + r() * 12;
        const tip = ray(ORIGIN, ang, len);
        const main = `M${fmt(ORIGIN)} L${fmt(tip)}`;

        let subs = '';
        let twigs = '';
        const step = 0.13 + r() * 0.02;
        for (let t = 0.24; t < 0.9; t += step) {
            const p = ray(ORIGIN, ang, len * t);
            const sl = len * (1 - t) * (0.36 + r() * 0.06);
            for (const side of [-1, 1]) {
                const sa = ang + side * HEX;
                const end = ray(p, sa, sl);
                subs += `M${fmt(p)} L${fmt(end)} `;
                if (sl > 11) {
                    for (const tw of [0.4, 0.68]) {
                        const q = ray(p, sa, sl * tw);
                        const tl = sl * (1 - tw) * 0.5;
                        twigs += `M${fmt(q)} L${fmt(ray(q, sa + HEX, tl))} M${fmt(q)} L${fmt(ray(q, sa - HEX, tl))} `;
                    }
                }
            }
        }
        branches.push({ main, subs: subs.trim(), twigs: twigs.trim(), tip });
        if (b !== 1)
            crystals.push({ p: ray(ORIGIN, ang, len + 7), r: 3 + r() * 1.4, delay: r() * 2.4 });
    }
    return { branches, crystals };
}

function Crystal({ p, r }: { p: Pt; r: number }) {
    const arms = [0, 60, 120].map((deg) => {
        const a = (deg * Math.PI) / 180;
        const dx = Math.cos(a) * r;
        const dy = Math.sin(a) * r;
        return `M${(p[0] - dx).toFixed(1)} ${(p[1] - dy).toFixed(1)} L${(p[0] + dx).toFixed(1)} ${(p[1] + dy).toFixed(1)}`;
    });
    return <path d={arms.join(' ')} />;
}

export function TileFestiveAccent({ seed }: TileFestiveAccentProps) {
    const uid = useId().replace(/:/g, '');
    const frost = useMemo(() => buildFrost(seed), [seed]);
    const strokeId = `tf-frost-${uid}`;
    const hazeId = `tf-haze-${uid}`;

    return (
        <span className="tile-festive" aria-hidden>
            <svg className="tile-festive__frost" viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
                <defs>
                    <radialGradient id={strokeId} gradientUnits="userSpaceOnUse" cx={ORIGIN[0]} cy={ORIGIN[1]} r="118">
                        <stop offset="0%" style={{ stopColor: 'var(--tf-frost-strong)' }} />
                        <stop offset="55%" style={{ stopColor: 'var(--tf-frost-mid)' }} />
                        <stop offset="100%" style={{ stopColor: 'var(--tf-frost-mid)', stopOpacity: 0 }} />
                    </radialGradient>
                    <radialGradient id={hazeId} gradientUnits="userSpaceOnUse" cx={ORIGIN[0]} cy={ORIGIN[1]} r="96">
                        <stop offset="0%" style={{ stopColor: 'var(--tf-haze)' }} />
                        <stop offset="100%" style={{ stopColor: 'var(--tf-haze)', stopOpacity: 0 }} />
                    </radialGradient>
                </defs>
                <rect className="tile-festive__haze" x="0" y="0" width={W} height={H} fill={`url(#${hazeId})`} />
                <g stroke={`url(#${strokeId})`} strokeLinecap="round" strokeLinejoin="round">
                    {frost.branches.map((b, i) => (
                        <g key={i} style={{ ['--tf-b' as string]: i }}>
                            <path className="tile-festive__line tile-festive__line--main" d={b.main} pathLength={1} />
                            <path className="tile-festive__line tile-festive__line--sub" d={b.subs} pathLength={1} />
                            {b.twigs ? <path className="tile-festive__line tile-festive__line--twig" d={b.twigs} pathLength={1} /> : null}
                        </g>
                    ))}
                </g>
                <g className="tile-festive__crystals" strokeLinecap="round">
                    {frost.crystals.map((c, i) => (
                        <g key={i} className="tile-festive__crystal" style={{ animationDelay: `${c.delay.toFixed(2)}s` }}>
                            <Crystal p={c.p} r={c.r} />
                        </g>
                    ))}
                </g>
            </svg>
        </span>
    );
}
