import { useMemo } from 'react';
import './SnowfallOverlay.css';

type Flake = {
    id: number;
    left: number;
    size: number;
    duration: number;
    delay: number;
    drift: number;
    opacity: number;
};

const FLAKE_COUNT = 42;

function buildFlakes(count: number): Flake[] {
    // Deterministic so remounts don't jump.
    const flakes: Flake[] = [];
    for (let i = 0; i < count; i += 1) {
        const t = (i + 1) / (count + 1);
        const wobble = Math.sin(i * 12.9898) * 43758.5453;
        const frac = wobble - Math.floor(wobble);
        const wobble2 = Math.sin(i * 78.233) * 12345.6789;
        const frac2 = wobble2 - Math.floor(wobble2);
        flakes.push({
            id: i,
            left: t * 100,
            size: 2 + frac * 4.5,
            duration: 14 + frac2 * 18,
            delay: -frac * 22,
            drift: (frac - 0.5) * 48,
            opacity: 0.22 + frac2 * 0.38,
        });
    }
    return flakes;
}

export function SnowfallOverlay() {
    const flakes = useMemo(() => buildFlakes(FLAKE_COUNT), []);

    return (
        <div className="app-snowfall" aria-hidden>
            {flakes.map((flake) => (
                <span
                    key={flake.id}
                    className="app-snowfall__flake"
                    style={{
                        left: `${flake.left}%`,
                        width: flake.size,
                        height: flake.size,
                        opacity: flake.opacity,
                        animationDuration: `${flake.duration}s`,
                        animationDelay: `${flake.delay}s`,
                        ['--flake-drift' as string]: `${flake.drift}px`,
                    }}
                />
            ))}
        </div>
    );
}
