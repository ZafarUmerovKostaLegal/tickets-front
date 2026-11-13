import { useId, useLayoutEffect, useRef, useState } from 'react';
import './TileFestiveAccent.css';

type TileFestiveAccentProps = {
    /** Varies ornament colour / sway phase so neighbours differ. */
    seed: number;
    /** Hide top mini-garland when a SnowCap already covers the tile. */
    compact?: boolean;
};

const BULB = ['#ffd56a', '#ff5b55', '#4fd0b2', '#fff1c8'] as const;
const BOX_H = 28;
const PIN_Y = 5;
const SAG = 16;
/** Keep clear of the drag handle on the right. */
const RIGHT_PAD = 36;
const LEFT_PAD = 10;

type Bulb = { x: number; y: number; color: string; delay: string; dur: string };

function rand(seed: number, n: number): number {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

function buildMiniGarland(width: number, seed: number): { d: string; bulbs: Bulb[] } | null {
    const usable = width - LEFT_PAD - RIGHT_PAD;
    if (usable < 80)
        return null;

    // 2–4 equal festoons so the wire looks even on any tile width.
    const spans = Math.min(4, Math.max(2, Math.round(usable / 95)));
    const step = usable / spans;
    const segs: string[] = [`M ${LEFT_PAD} ${PIN_Y}`];
    const bulbs: Bulb[] = [];

    for (let i = 0; i < spans; i += 1) {
        const x1 = LEFT_PAD + i * step;
        const x2 = LEFT_PAD + (i + 1) * step;
        const mid = (x1 + x2) / 2;
        const sagY = PIN_Y + SAG;
        segs.push(`Q ${mid.toFixed(1)} ${sagY} ${x2.toFixed(1)} ${PIN_Y}`);
        // One bulb at the bottom of each festoon — hangs straight.
        bulbs.push({
            x: mid,
            y: sagY,
            color: BULB[(i + seed) % BULB.length],
            delay: `${(rand(seed, 10 + i) * 2.4).toFixed(2)}s`,
            dur: `${(2 + rand(seed, 20 + i) * 1.2).toFixed(2)}s`,
        });
    }

    return { d: segs.join(' '), bulbs };
}

/**
 * Holiday accents for a hub tile: a short even festoon across the top,
 * soft corner glow, and a small holly sprig. Absolute — no layout shift.
 */
export function TileFestiveAccent({ seed, compact = false }: TileFestiveAccentProps) {
    const uid = useId().replace(/:/g, '');
    const ref = useRef<HTMLSpanElement | null>(null);
    const [width, setWidth] = useState(0);
    const delay = `${(rand(seed, 1) * 2.4).toFixed(2)}s`;

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

    const model = !compact && width > 0 ? buildMiniGarland(width, seed) : null;

    return (
        <span
            ref={ref}
            className={`tile-festive${compact ? ' tile-festive--compact' : ''}`}
            aria-hidden
            style={{ ['--tf-delay' as string]: delay }}
        >
            {model ? (
                <svg
                    className="tile-festive__garland"
                    width={width}
                    height={BOX_H}
                    viewBox={`0 0 ${width} ${BOX_H}`}
                    preserveAspectRatio="xMinYMin meet"
                >
                    <defs>
                        <filter id={`tf-glow-${uid}`} x="-100%" y="-100%" width="300%" height="300%">
                            <feGaussianBlur stdDeviation="1.8" result="b" />
                            <feMerge>
                                <feMergeNode in="b" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    <path className="tile-festive__wire" d={model.d} />
                    {model.bulbs.map((b, i) => (
                        <g key={i} filter={`url(#tf-glow-${uid})`}>
                            <circle
                                className="tile-festive__halo"
                                cx={b.x}
                                cy={b.y}
                                r="6"
                                fill={b.color}
                                style={{ animationDelay: b.delay, animationDuration: b.dur }}
                            />
                            <ellipse
                                className="tile-festive__bulb"
                                cx={b.x}
                                cy={b.y + 1}
                                rx="3.1"
                                ry="4"
                                fill={b.color}
                                style={{ animationDelay: b.delay, animationDuration: b.dur }}
                            />
                            <rect
                                x={b.x - 2}
                                y={b.y - 5}
                                width="4"
                                height="3"
                                rx="0.8"
                                fill="#3a425c"
                            />
                            <circle cx={b.x - 0.8} cy={b.y} r="0.9" fill="#fff" opacity="0.8" />
                        </g>
                    ))}
                </svg>
            ) : null}

            <span className="tile-festive__corner-glow" />

            <svg className="tile-festive__holly" viewBox="0 0 44 34" width="40" height="30" fill="none">
                <path
                    d="M8 18c-1.4-5 1.6-9.6 6.2-10.2 2.1 3.8-.3 8.4-4 10.8-.7.5-1.6.2-2.2-.6Z"
                    fill="#2f8f5b"
                />
                <path
                    d="M17 11c2.6-4.4 8.2-5.4 12-2.1-1.9 4.2-6.8 5.9-11 4-.8-.4-1.2-1.1-.9-1.9Z"
                    fill="#247a4c"
                />
                <path
                    d="M27 16c4.2-2.8 9.8-.8 11.2 3.9-4 2.6-9.1 1.7-11.9-2.1-.5-.7-.2-1.5.7-1.8Z"
                    fill="#36a56a"
                />
                <circle cx="20" cy="22" r="2.4" fill="#d63b3b" />
                <circle cx="24.8" cy="24" r="2.2" fill="#c23030" />
                <circle cx="17.4" cy="24.6" r="2" fill="#e24b4b" />
                <circle cx="20.6" cy="20.6" r="0.55" fill="#fff8" />
            </svg>
        </span>
    );
}
