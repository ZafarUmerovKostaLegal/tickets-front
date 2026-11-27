import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import './HubSantaFlight.css';

function Reindeer({ x, lead = false }: { x: number; lead?: boolean }) {
    return (
        <g className="hub-santa__deer" transform={`translate(${x} 0)`}>
            <g className="hub-santa__legs hub-santa__legs--front">
                <path d="M11 44 L4 52 M15 45 L10 54" />
            </g>
            <g className="hub-santa__legs hub-santa__legs--back">
                <path d="M31 44 L39 50 M28 45 L34 54" />
            </g>
            <ellipse className="hub-santa__fur" cx="22" cy="40" rx="15" ry="6.5" />
            <path className="hub-santa__fur" d="M12 39 L4 27 L9 24 L17 35 Z" />
            <ellipse className="hub-santa__fur" cx="4" cy="24" rx="6" ry="3.6" transform="rotate(-14 4 24)" />
            <path className="hub-santa__fur" d="M36 37 L41 33 L39 39 Z" />
            <path className="hub-santa__belly" d="M12 43 Q22 47 33 43" />
            <path className="hub-santa__antler" d="M7 21 L9 13 L6 9 M9 13 L13 10 M11 21 L14 15 L18 13" />
            <circle className="hub-santa__eye" cx="3.5" cy="22.6" r="0.8" />
            {lead ? <circle className="hub-santa__nose-glow" cx="-2" cy="24.5" r="4" /> : null}
            <circle className={lead ? 'hub-santa__nose hub-santa__nose--lead' : 'hub-santa__nose'} cx="-2" cy="24.5" r={lead ? 1.8 : 1.3} />
            <path className="hub-santa__harness" d="M10 37 L33 41" />
        </g>
    );
}

const TRAIL = Array.from({ length: 9 }, (_, i) => ({
    x: 212 + i * 6.5,
    y: 58 + Math.sin(i * 1.3) * 4,
    r: 1.9 - i * 0.17,
    d: `${(i * 0.13).toFixed(2)}s`,
}));

export function HubSantaFlight() {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onVisibility = () => ref.current?.classList.toggle('hub-santa--paused', document.hidden);
        document.addEventListener('visibilitychange', onVisibility);
        onVisibility();
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    return (
        <div className="hub-santa" aria-hidden ref={ref}>
            <div className="hub-santa__flight">
                <div className="hub-santa__bob">
                    <svg className="hub-santa__svg" viewBox="-10 0 270 72">
                        <path className="hub-santa__reins" d="M14 38 Q40 33 58 37 Q100 31 150 33" />
                        <Reindeer x={10} lead />
                        <Reindeer x={58} />
                        <path className="hub-santa__reins" d="M68 38 Q110 34 150 33" />
                        <path className="hub-santa__runner" d="M128 58 Q128 63 134 63 L198 63 Q206 63 207 56" />
                        <path className="hub-santa__strut" d="M150 56 L150 63 M186 56 L186 63" />
                        <ellipse className="hub-santa__sack" cx="190" cy="31" rx="10" ry="10.5" />
                        <path className="hub-santa__sack-tie" d="M186 21 Q190 18 194 21" />
                        <rect className="hub-santa__gift" x="176" y="27" width="9" height="9" rx="1" />
                        <path className="hub-santa__gift-ribbon" d="M180.5 27 L180.5 36" />
                        <ellipse className="hub-santa__suit" cx="166" cy="34" rx="10" ry="10" />
                        <path className="hub-santa__trim" d="M157 41 Q166 44 175 41" />
                        <path className="hub-santa__arm" d="M161 32 L150 34" />
                        <circle className="hub-santa__mitt" cx="150" cy="34" r="2" />
                        <circle className="hub-santa__face" cx="160" cy="21" r="5" />
                        <path className="hub-santa__beard" d="M155 22 Q154 31 160 32 Q166 31 165 23 Q160 26 155 22 Z" />
                        <path className="hub-santa__hat" d="M154.5 18 Q160 11 166 17 Q170 9 177 10 Q172 13 168 19 Z" />
                        <path className="hub-santa__trim" d="M154 18.5 Q160 15.5 167 18.5" />
                        <circle className="hub-santa__pom" cx="177.5" cy="10.5" r="2.2" />
                        <path className="hub-santa__sleigh" d="M138 38 L194 38 Q205 38 203 49 L197 56 L146 56 Q136 56 134 46 Q132 40 138 38 Z" />
                        <path className="hub-santa__sleigh-trim" d="M140 42 L198 42" />
                        <path className="hub-santa__curl" d="M134 46 Q127 44 128 38 Q130 34 134 37" />
                        {TRAIL.map((s, i) => (
                            <circle
                                key={i}
                                className="hub-santa__spark"
                                cx={s.x}
                                cy={s.y}
                                r={s.r}
                                style={{ '--d': s.d } as CSSProperties}
                            />
                        ))}
                    </svg>
                </div>
            </div>
        </div>
    );
}
