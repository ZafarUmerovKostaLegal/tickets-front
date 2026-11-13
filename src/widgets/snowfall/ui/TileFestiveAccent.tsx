import { useId } from 'react';
import './TileFestiveAccent.css';

type TileFestiveAccentProps = {
    /** Varies ornament colour / sway phase so neighbours differ. */
    seed: number;
    /** Hide top mini-garland when a SnowCap already covers the tile. */
    compact?: boolean;
};

const BULB = ['#ffd56a', '#ff5b55', '#4fd0b2', '#fff1c8'] as const;

function rand(seed: number, n: number): number {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

/**
 * Holiday accents for a hub tile: a short festoon of lights across the top,
 * soft corner frost, and a small holly sprig. Absolute — no layout shift.
 */
export function TileFestiveAccent({ seed, compact = false }: TileFestiveAccentProps) {
    const uid = useId().replace(/:/g, '');
    const delay = `${(rand(seed, 1) * 2.4).toFixed(2)}s`;
    const sway = `${(4.2 + rand(seed, 2) * 1.6).toFixed(2)}s`;

    // Three shallow festoons across a 200×36 viewBox.
    const wire = 'M 6 8 Q 38 28 70 8 Q 102 28 134 8 Q 166 28 194 8';
    const bulbs = [38, 70, 102, 134, 166].map((x, i) => ({
        x,
        y: i % 2 === 0 ? 26 : 8,
        color: BULB[(i + seed) % BULB.length],
        delay: `${(rand(seed, 10 + i) * 2.8).toFixed(2)}s`,
        dur: `${(1.8 + rand(seed, 20 + i) * 1.4).toFixed(2)}s`,
    }));

    return (
        <span
            className={`tile-festive${compact ? ' tile-festive--compact' : ''}`}
            aria-hidden
            style={{ ['--tf-delay' as string]: delay, ['--tf-sway' as string]: sway }}
        >
            {!compact ? (
                <svg className="tile-festive__garland" viewBox="0 0 200 36" preserveAspectRatio="none">
                    <defs>
                        <filter id={`tf-glow-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
                            <feGaussianBlur stdDeviation="2.2" result="b" />
                            <feMerge>
                                <feMergeNode in="b" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    <path className="tile-festive__wire" d={wire} />
                    {bulbs.map((b, i) => (
                        <g key={i} filter={`url(#tf-glow-${uid})`}>
                            <circle
                                className="tile-festive__halo"
                                cx={b.x}
                                cy={b.y}
                                r="7"
                                fill={b.color}
                                style={{ animationDelay: b.delay, animationDuration: b.dur }}
                            />
                            <circle
                                className="tile-festive__bulb"
                                cx={b.x}
                                cy={b.y}
                                r="3.2"
                                fill={b.color}
                                style={{ animationDelay: b.delay, animationDuration: b.dur }}
                            />
                            <circle cx={b.x - 0.9} cy={b.y - 1} r="1" fill="#fff" opacity="0.75" />
                        </g>
                    ))}
                </svg>
            ) : null}

            <span className="tile-festive__corner-glow" />

            <svg className="tile-festive__holly" viewBox="0 0 44 34" width="44" height="34" fill="none">
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
                <path
                    d="M14 22c-2.8 3.2-2.2 7.8 1.4 9.2 2.6-2.8 2.2-6.8.2-9.4-.4-.5-1.1-.5-1.6.2Z"
                    fill="#2a7d52"
                />
                <circle cx="20" cy="22" r="2.6" fill="#d63b3b" />
                <circle cx="25.2" cy="24.4" r="2.35" fill="#c23030" />
                <circle cx="17.2" cy="25.2" r="2.15" fill="#e24b4b" />
                <circle cx="22.6" cy="20.4" r="1.9" fill="#ff5a55" />
                <circle cx="20.6" cy="20.6" r="0.6" fill="#fff8" />
                <circle cx="25.6" cy="23" r="0.5" fill="#fff8" />
            </svg>

            <span className="tile-festive__sparkle tile-festive__sparkle--a" />
            <span className="tile-festive__sparkle tile-festive__sparkle--b" />
        </span>
    );
}
