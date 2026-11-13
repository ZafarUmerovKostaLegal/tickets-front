import { useEffect, useMemo, useRef, useState } from 'react';
import './SnowfallOverlay.css';

type Flake = {
    id: number;
    layer: 0 | 1 | 2;
    left: number;
    size: number;
    duration: number;
    delay: number;
    drift: number;
    opacity: number;
};

type Tier = 'phone' | 'tablet' | 'desktop';

/** Particle budget — kept modest so flakes stay ambient, not distracting. */
const TIER_TOTAL: Record<Tier, number> = { desktop: 48, tablet: 32, phone: 18 };
/** Share of the budget for the far / mid / near depth layers. */
const LAYER_SPLIT = [0.5, 0.32, 0.18] as const;

const LAYERS = [
    { size: [2, 3.5], dur: [22, 30], opacity: [0.12, 0.22], drift: 22 },
    { size: [3, 4.5], dur: [16, 22], opacity: [0.18, 0.3], drift: 32 },
    { size: [4, 6], dur: [11, 16], opacity: [0.22, 0.36], drift: 40 },
] as const;

function currentTier(): Tier {
    if (typeof window === 'undefined' || !window.matchMedia)
        return 'desktop';
    if (window.matchMedia('(min-width: 1024px)').matches)
        return 'desktop';
    if (window.matchMedia('(min-width: 768px)').matches)
        return 'tablet';
    return 'phone';
}

/** Deterministic pseudo-random in [0,1): the field never jumps on remount. */
function rand(i: number, salt: number): number {
    const x = Math.sin((i + 1) * salt) * 43758.5453;
    return x - Math.floor(x);
}

function buildFlakes(total: number): Flake[] {
    const flakes: Flake[] = [];
    let id = 0;
    for (let l = 0; l < 3; l += 1) {
        const n = Math.max(1, Math.round(total * LAYER_SPLIT[l]));
        const L = LAYERS[l];
        for (let i = 0; i < n; i += 1) {
            const a = rand(id, 12.9898);
            const b = rand(id, 78.233);
            const c = rand(id, 37.719);
            flakes.push({
                id,
                layer: l as 0 | 1 | 2,
                left: ((i + a) / n) * 100,
                size: L.size[0] + a * (L.size[1] - L.size[0]),
                duration: L.dur[0] + b * (L.dur[1] - L.dur[0]),
                delay: -c * L.dur[1],
                drift: (a - 0.5) * L.drift,
                opacity: L.opacity[0] + b * (L.opacity[1] - L.opacity[0]),
            });
            id += 1;
        }
    }
    return flakes;
}

export function SnowfallOverlay() {
    const [tier, setTier] = useState<Tier>(currentTier);
    const ref = useRef<HTMLDivElement | null>(null);

    // Rebuild only when the device bucket changes, not on every resize pixel.
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia)
            return;
        const lists = [
            window.matchMedia('(min-width: 1024px)'),
            window.matchMedia('(min-width: 768px)'),
        ];
        const update = () => setTier(currentTier());
        lists.forEach((m) => m.addEventListener('change', update));
        return () => lists.forEach((m) => m.removeEventListener('change', update));
    }, []);

    // Freeze the animation while the tab is hidden — zero CPU in the background.
    useEffect(() => {
        const onVisibility = () => {
            ref.current?.classList.toggle('app-snowfall--paused', document.hidden);
        };
        document.addEventListener('visibilitychange', onVisibility);
        onVisibility();
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    const flakes = useMemo(() => buildFlakes(TIER_TOTAL[tier]), [tier]);

    return (
        <div className="app-snowfall" aria-hidden ref={ref}>
            {flakes.map((flake) => (
                <span
                    key={flake.id}
                    className={`app-snowfall__flake app-snowfall__flake--l${flake.layer}`}
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
