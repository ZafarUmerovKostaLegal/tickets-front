import './TileFestiveAccent.css';

type TileFestiveAccentProps = {
    /** Varies ornament timing so neighbours differ. */
    seed: number;
    /** Kept for call-site compat; snow-capped tiles still get holly only. */
    compact?: boolean;
};

function rand(seed: number, n: number): number {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
}

/**
 * Light tile accent from the winter mockup direction: holly only —
 * no mini-garlands on tiles (those lived only in the header in the demo).
 */
export function TileFestiveAccent({ seed }: TileFestiveAccentProps) {
    const delay = `${(rand(seed, 1) * 2.4).toFixed(2)}s`;

    return (
        <span className="tile-festive" aria-hidden style={{ ['--tf-delay' as string]: delay }}>
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
