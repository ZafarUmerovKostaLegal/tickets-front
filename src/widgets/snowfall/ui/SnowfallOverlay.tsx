import { useEffect, useRef, useState } from 'react';
import { startSnowScene } from '../lib/snowScene';
import './SnowfallOverlay.css';

type Tier = 'phone' | 'tablet' | 'desktop';

const TIER: Record<Tier, { count: number; bankMax: number }> = {
    desktop: { count: 70, bankMax: 26 },
    tablet: { count: 46, bankMax: 20 },
    phone: { count: 28, bankMax: 14 },
};

const QUERIES = ['(min-width: 1024px)', '(min-width: 768px)'] as const;

function currentTier(): Tier {
    if (typeof window === 'undefined' || !window.matchMedia)
        return 'desktop';
    if (window.matchMedia(QUERIES[0]).matches)
        return 'desktop';
    return window.matchMedia(QUERIES[1]).matches ? 'tablet' : 'phone';
}

function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
        && !!window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function SnowfallOverlay() {
    const ref = useRef<HTMLCanvasElement | null>(null);
    const [tier, setTier] = useState<Tier>(currentTier);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia)
            return;
        const lists = QUERIES.map((q) => window.matchMedia(q));
        const update = () => setTier(currentTier());
        lists.forEach((m) => m.addEventListener('change', update));
        return () => lists.forEach((m) => m.removeEventListener('change', update));
    }, []);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas || prefersReducedMotion())
            return;
        return startSnowScene(canvas, TIER[tier]);
    }, [tier]);

    return <canvas className="app-snowfall" aria-hidden ref={ref} />;
}
