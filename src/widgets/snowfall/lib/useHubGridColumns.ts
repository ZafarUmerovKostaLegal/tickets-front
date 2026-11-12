import { useEffect, useState } from 'react';

// Mirrors the breakpoints of `.home-nav-tiles--hub .home-nav-tiles__grid` in HomeNavTiles.css.
const BREAKPOINTS: Array<[query: string, columns: number]> = [
    ['(min-width: 1100px)', 4],
    ['(min-width: 900px)', 3],
    ['(min-width: 560px)', 2],
];

function currentColumns(): number {
    if (typeof window === 'undefined' || !window.matchMedia)
        return 4;
    for (const [query, cols] of BREAKPOINTS) {
        if (window.matchMedia(query).matches)
            return cols;
    }
    return 1;
}

export function useHubGridColumns(enabled: boolean): number {
    const [columns, setColumns] = useState(currentColumns);
    useEffect(() => {
        if (!enabled || typeof window === 'undefined' || !window.matchMedia)
            return;
        const lists = BREAKPOINTS.map(([q]) => window.matchMedia(q));
        const update = () => setColumns(currentColumns());
        lists.forEach((m) => m.addEventListener('change', update));
        update();
        return () => lists.forEach((m) => m.removeEventListener('change', update));
    }, [enabled]);
    return columns;
}
