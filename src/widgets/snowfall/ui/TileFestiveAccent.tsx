import './TileFestiveAccent.css';

type TileFestiveAccentProps = {
    /** Varies ornament colour / sway phase so neighbours differ. */
    seed: number;
    /** Hide top accents when a SnowCap already covers the tile. */
    compact?: boolean;
};

const BAUBLE_COLORS = ['#e24b4b', '#3fbe9a', '#f0b429', '#6b8fd4'] as const;

/**
 * Absolute holiday accents for a hub tile: frost rim, hanging bauble,
 * and a small holly sprig. Does not affect layout.
 */
export function TileFestiveAccent({ seed, compact = false }: TileFestiveAccentProps) {
    const color = BAUBLE_COLORS[Math.abs(seed) % BAUBLE_COLORS.length];
    const delay = `${((seed * 0.37) % 2.4).toFixed(2)}s`;
    const sway = `${(3.6 + (seed % 4) * 0.35).toFixed(2)}s`;

    return (
        <span className="tile-festive" aria-hidden style={{ ['--tf-delay' as string]: delay, ['--tf-sway' as string]: sway }}>
            {!compact ? <span className="tile-festive__frost" /> : null}
            {!compact ? (
                <span className="tile-festive__bauble" style={{ ['--tf-bauble' as string]: color }}>
                    <span className="tile-festive__bauble-cord" />
                    <span className="tile-festive__bauble-cap" />
                    <span className="tile-festive__bauble-glow" />
                </span>
            ) : null}
            <svg className="tile-festive__holly" viewBox="0 0 36 28" width="36" height="28" fill="none">
                <path
                    d="M6 16c-1.2-4.2 1.4-8.2 5.2-8.6 1.8 3.2-.2 7.2-3.4 9.2-0.6.4-1.4.2-1.8-.6Z"
                    fill="#2f8f5b"
                />
                <path
                    d="M14 10c2.2-3.8 7-4.6 10.2-1.8-1.6 3.6-5.8 5-9.4 3.4-.7-.3-1-.9-.8-1.6Z"
                    fill="#247a4c"
                />
                <path
                    d="M22 14c3.6-2.4 8.4-.6 9.6 3.4-3.4 2.2-7.8 1.4-10.2-1.8-.4-.6-.2-1.3.6-1.6Z"
                    fill="#2f8f5b"
                />
                <circle cx="16" cy="18" r="2.2" fill="#d63b3b" />
                <circle cx="20.2" cy="20.2" r="2" fill="#c23030" />
                <circle cx="13.6" cy="21" r="1.85" fill="#e24b4b" />
                <circle cx="16.8" cy="16.2" r="0.55" fill="#fff6" />
                <circle cx="20.8" cy="18.7" r="0.45" fill="#fff6" />
            </svg>
        </span>
    );
}
