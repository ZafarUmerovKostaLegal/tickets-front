import { useId, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import './TileFestiveAccent.css';

type TileFestiveAccentProps = {
    seed: number;
    compact?: boolean;
};

function rand(seed: number, n: number): number {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

type Palette = { light: string; mid: string; dark: string; trim: string };

const PALETTES: Palette[] = [
    { light: '#ff8a80', mid: '#d32f2f', dark: '#7f1416', trim: '#f4d27a' },
    { light: '#fff1b8', mid: '#e0a92e', dark: '#8a5a0c', trim: '#ffffff' },
    { light: '#8fe0b4', mid: '#1f8a5b', dark: '#0b4029', trim: '#f4d27a' },
    { light: '#9fc0ff', mid: '#2f5bb7', dark: '#132a5e', trim: '#e9f0ff' },
    { light: '#ffffff', mid: '#c9d3df', dark: '#6b7889', trim: '#d32f2f' },
];

type BaubleKind = 'stripes' | 'dots' | 'snowflake' | 'drop';
const KINDS: BaubleKind[] = ['stripes', 'dots', 'snowflake', 'drop'];

const B_W = 34;
const R = 12;

function Snowflake({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
    const arms = [0, 60, 120].map((a) => {
        const rad = (a * Math.PI) / 180;
        const dx = Math.cos(rad) * r;
        const dy = Math.sin(rad) * r;
        return <line key={a} x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy} />;
    });
    const ticks = [0, 60, 120, 180, 240, 300].map((a) => {
        const rad = (a * Math.PI) / 180;
        const bx = cx + Math.cos(rad) * r * 0.55;
        const by = cy + Math.sin(rad) * r * 0.55;
        const t = r * 0.3;
        const l = rad + Math.PI * 0.78;
        const rr = rad - Math.PI * 0.78;
        return (
            <path
                key={a}
                d={`M ${bx + Math.cos(l) * t} ${by + Math.sin(l) * t} L ${bx} ${by} L ${bx + Math.cos(rr) * t} ${by + Math.sin(rr) * t}`}
            />
        );
    });
    return (
        <g stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.92">
            {arms}
            {ticks}
        </g>
    );
}

function Bauble({ seed, uid }: { seed: number; uid: string }) {
    const p = PALETTES[Math.floor(rand(seed, 2) * PALETTES.length)];
    const kind = KINDS[Math.floor(rand(seed, 3) * KINDS.length)];
    const thread = Math.round(16 + rand(seed, 4) * 8);

    const capY = thread + 3;
    const cx = B_W / 2;
    const cy = capY + 5 + R;
    const height = kind === 'drop' ? cy + R + 13 : cy + R + 2;

    const gradId = `tf-ball-${uid}`;
    const clipId = `tf-clip-${uid}`;
    const capId = `tf-cap-${uid}`;

    const body = kind === 'drop'
        ? `M ${cx} ${capY + 4.5}
           C ${cx + 9} ${capY + 6}, ${cx + R + 1} ${cy - 4}, ${cx + R} ${cy + 2}
           C ${cx + R - 1} ${cy + 9}, ${cx + 4} ${cy + 12}, ${cx} ${cy + R + 11}
           C ${cx - 4} ${cy + 12}, ${cx - R + 1} ${cy + 9}, ${cx - R} ${cy + 2}
           C ${cx - R - 1} ${cy - 4}, ${cx - 9} ${capY + 6}, ${cx} ${capY + 4.5} Z`
        : null;

    let pattern: ReactNode = null;
    if (kind === 'stripes') {
        pattern = (
            <g fill="none" stroke={p.trim} strokeLinecap="round">
                <path d={`M ${cx - R} ${cy - 3} Q ${cx} ${cy + 1.5} ${cx + R} ${cy - 3}`} strokeWidth="2.2" />
                <path d={`M ${cx - R} ${cy + 3.6} Q ${cx} ${cy + 8.2} ${cx + R} ${cy + 3.6}`} strokeWidth="1" strokeDasharray="0.1 2.6" />
                <path d={`M ${cx - R} ${cy - 7.5} Q ${cx} ${cy - 3.6} ${cx + R} ${cy - 7.5}`} strokeWidth="0.9" opacity="0.8" />
            </g>
        );
    } else if (kind === 'dots') {
        const dots: Array<[number, number, number]> = [
            [-5, -5, 1.5], [3, -7, 1.1], [7, -1, 1.6], [-8, 2, 1.2], [-2, 1, 1.9],
            [4, 6, 1.3], [-5, 8, 1.1], [9, 6, 0.9], [-10, -3, 0.8],
        ];
        pattern = (
            <g fill={p.trim}>
                {dots.map(([dx, dy, r], i) => (
                    <circle key={i} cx={cx + dx} cy={cy + dy} r={r} opacity={0.9} />
                ))}
            </g>
        );
    } else if (kind === 'snowflake') {
        pattern = <Snowflake cx={cx + 0.5} cy={cy + 1} r={6.6} color={p.trim} />;
    } else {
        pattern = (
            <g fill="none" stroke={p.trim} strokeLinecap="round">
                <path d={`M ${cx - R + 0.5} ${cy + 1} Q ${cx} ${cy + 5} ${cx + R - 0.5} ${cy + 1}`} strokeWidth="1.6" />
                <path d={`M ${cx - 7} ${cy + 9} Q ${cx} ${cy + 12} ${cx + 7} ${cy + 9}`} strokeWidth="1" />
            </g>
        );
    }

    const style = {
        '--tf-swing-dur': `${(4.2 + rand(seed, 5) * 2.4).toFixed(2)}s`,
        '--tf-swing-delay': `${(-rand(seed, 6) * 6).toFixed(2)}s`,
    } as CSSProperties;

    return (
        <span className="tile-festive__bauble" style={style}>
            <svg viewBox={`0 0 ${B_W} ${height}`} width={B_W} height={height} fill="none">
                <defs>
                    <radialGradient id={gradId} cx="0.36" cy="0.32" r="0.78">
                        <stop offset="0%" stopColor={p.light} />
                        <stop offset="45%" stopColor={p.mid} />
                        <stop offset="100%" stopColor={p.dark} />
                    </radialGradient>
                    <linearGradient id={capId} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#9a7424" />
                        <stop offset="45%" stopColor="#fbe7a6" />
                        <stop offset="100%" stopColor="#8a651c" />
                    </linearGradient>
                    <clipPath id={clipId}>
                        {body ? <path d={body} /> : <circle cx={cx} cy={cy} r={R} />}
                    </clipPath>
                </defs>

                <line className="tile-festive__thread" x1={cx} y1="0" x2={cx} y2={capY - 1.2} />
                <circle cx={cx} cy={capY - 1.6} r="1.7" stroke="#c49a3a" strokeWidth="0.9" />

                {body
                    ? <path d={body} fill={`url(#${gradId})`} />
                    : <circle cx={cx} cy={cy} r={R} fill={`url(#${gradId})`} />}
                <g clipPath={`url(#${clipId})`}>
                    {pattern}
                    <ellipse cx={cx + 4} cy={cy + 9} rx={9} ry={4} fill="#000" opacity="0.14" />
                </g>
                <ellipse cx={cx - 4.4} cy={cy - 5} rx="3.6" ry="2.2" fill="#fff" opacity="0.7" transform={`rotate(-35 ${cx - 4.4} ${cy - 5})`} />
                <circle cx={cx - 1.6} cy={cy - 7.6} r="0.9" fill="#fff" opacity="0.85" />

                <rect x={cx - 4} y={capY} width="8" height="5" rx="1.2" fill={`url(#${capId})`} />
                <path d={`M ${cx - 4} ${capY + 2.5} H ${cx + 4}`} stroke="#7a5714" strokeWidth="0.5" opacity="0.55" />
            </svg>
        </span>
    );
}

type Pt = [number, number];

function quad(a: Pt, c: Pt, b: Pt, t: number): Pt {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

function quadTangent(a: Pt, c: Pt, b: Pt, t: number): Pt {
    const dx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
    const dy = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
    const len = Math.hypot(dx, dy) || 1;
    return [dx / len, dy / len];
}

const NEEDLE_COLORS = ['#1d5e3d', '#2a7a4f', '#378f5f', '#4aa872'];

function branchNeedles(seed: number, salt: number, a: Pt, c: Pt, b: Pt, maxLen: number) {
    const needles: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
    let i = 0;
    for (let t = 0.1; t <= 1.001; t += 0.055) {
        const [x, y] = quad(a, c, b, t);
        const [tx, ty] = quadTangent(a, c, b, t);
        const len = maxLen * (1 - 0.55 * t) * (0.85 + rand(seed, salt + i) * 0.3);
        for (const side of [-1, 1] as const) {
            const ang = Math.atan2(ty, tx) + side * (0.95 + rand(seed, salt + 50 + i) * 0.25);
            needles.push({
                x1: x,
                y1: y,
                x2: x + Math.cos(ang) * len,
                y2: y + Math.sin(ang) * len,
                color: NEEDLE_COLORS[(i + (side > 0 ? 1 : 0) + Math.floor(t * 3)) % NEEDLE_COLORS.length],
            });
            i += 1;
        }
    }
    const [ex, ey] = b;
    const [tx, ty] = quadTangent(a, c, b, 1);
    needles.push({ x1: ex, y1: ey, x2: ex + tx * maxLen * 0.5, y2: ey + ty * maxLen * 0.5, color: NEEDLE_COLORS[3] });
    return needles;
}

function FirSprig({ seed }: { seed: number }) {
    const branches = useMemo(() => {
        const main: [Pt, Pt, Pt] = [[74, 46], [48, 46], [14, 38]];
        const upper: [Pt, Pt, Pt] = [[72, 44], [64, 30], [50, 16]];
        return [
            { path: upper, needles: branchNeedles(seed, 300, ...upper, 7) },
            { path: main, needles: branchNeedles(seed, 100, ...main, 8) },
        ];
    }, [seed]);

    return (
        <svg className="tile-festive__sprig" viewBox="0 0 78 52" width="78" height="52" fill="none">
            {branches.map((br, k) => (
                <g key={k}>
                    <path
                        d={`M ${br.path[0][0]} ${br.path[0][1]} Q ${br.path[1][0]} ${br.path[1][1]} ${br.path[2][0]} ${br.path[2][1]}`}
                        stroke="#5b3b22"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                    />
                    <g strokeWidth="1.5" strokeLinecap="round">
                        {br.needles.map((n, i) => (
                            <line key={i} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={n.color} />
                        ))}
                    </g>
                </g>
            ))}

            <g transform="translate(44 39) rotate(-70) scale(0.9)">
                <ellipse cx="0" cy="0" rx="4.4" ry="7" fill="#7a4a26" />
                {[-4, -1.2, 1.6, 4.4].map((y) => (
                    <path key={y} d={`M -4 ${y} Q 0 ${y + 2.4} 4 ${y}`} stroke="#4a2b14" strokeWidth="0.8" />
                ))}
                <path d="M 0 -7 V 7" stroke="#4a2b14" strokeWidth="0.5" opacity="0.6" />
                <ellipse cx="-1.6" cy="-3" rx="1" ry="2" fill="#b97d4a" opacity="0.55" />
            </g>

            <g transform="translate(66 38) scale(0.9)">
                <path d="M 0 0 C -6 -7 -13 -3 -10 2 C -8 5 -3 3 0 0 Z" fill="#c62828" />
                <path d="M 0 0 C 6 -7 13 -3 10 2 C 8 5 3 3 0 0 Z" fill="#b71c1c" />
                <path d="M -1 1 L -5 10 L -2.6 8.6 L -1.6 11 Z" fill="#a01818" />
                <path d="M 1 1 L 4.6 9.6 L 2.4 8.4 L 1.8 10.8 Z" fill="#8e1414" />
                <path d="M -8.6 -1 C -6.4 -4.4 -3.6 -3.4 -2 -1" stroke="#ff8a80" strokeWidth="0.8" strokeLinecap="round" opacity="0.7" />
                <ellipse cx="0" cy="0.4" rx="2.2" ry="2" fill="#d84343" />
                <ellipse cx="-0.6" cy="-0.2" rx="0.8" ry="0.6" fill="#fff" opacity="0.4" />
            </g>
        </svg>
    );
}

export function TileFestiveAccent({ seed }: TileFestiveAccentProps) {
    const uid = useId().replace(/:/g, '');

    return (
        <span className="tile-festive" aria-hidden>
            <Bauble seed={seed} uid={uid} />
            <FirSprig seed={seed} />
        </span>
    );
}
