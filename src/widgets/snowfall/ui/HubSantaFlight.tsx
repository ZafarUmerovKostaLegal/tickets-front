import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import './HubSantaFlight.css';

const GALLOP = '0.62s';
const KEYS = '0;0.45;0.75;1';
const SPLINES = '0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1';

function Swing({ values, begin, dur = GALLOP }: { values: string; begin: number; dur?: string }) {
    return (
        <animateTransform
            attributeName="transform"
            type="rotate"
            values={values}
            keyTimes={values.split(';').length === 4 ? KEYS : '0;0.5;1'}
            calcMode="spline"
            keySplines={values.split(';').length === 4 ? SPLINES : '0.4 0 0.6 1;0.4 0 0.6 1'}
            dur={dur}
            begin={`${begin}s`}
            repeatCount="indefinite"
        />
    );
}

function Leg({ x, y, front, far, begin }: { x: number; y: number; front: boolean; far: boolean; begin: number }) {
    const tone = far ? 'hub-santa__leg--far' : 'hub-santa__leg';
    return (
        <g transform={`translate(${x} ${y})`}>
            <g>
                <Swing values={front ? '0 0 0;-28 0 0;8 0 0;0 0 0' : '-34 0 0;22 0 0;2 0 0;-34 0 0'} begin={begin} />
                <path className={`${tone} hub-santa__thigh`} d={front ? 'M0 -2 C-1 3 -1 7 -1 10' : 'M-1 -4 C4 1 5 6 3 10'} strokeWidth={front ? 5.5 : 7.5} />
                <g transform={`translate(${front ? -1 : 3} 10)`}>
                    <g>
                        <Swing values={front ? '-6 0 0;0 0 0;-100 0 0;-6 0 0' : '6 0 0;0 0 0;80 0 0;6 0 0'} begin={begin} />
                        <path className={tone} d={front ? 'M0 0 L1 9' : 'M0 0 L-2 10'} strokeWidth={2.8} />
                        <path className="hub-santa__hoof" d={front ? 'M-1.2 8.6 h4.4 l-0.6 2.6 h-3.4 Z' : 'M-4.2 9.6 h4.4 l-0.6 2.6 h-3.4 Z'} />
                    </g>
                </g>
            </g>
        </g>
    );
}

function Antler({ x, far }: { x: number; far?: boolean }) {
    return (
        <path
            className={far ? 'hub-santa__antler hub-santa__antler--far' : 'hub-santa__antler'}
            transform={`translate(${x} 0)`}
            d="M16 2 C15 -5 17 -11 22 -16 C24 -18 25 -21 24 -24 M17.5 -6 C14 -8 11.5 -11 11 -15 M20 -12 C22.5 -14 25.5 -15 28.5 -14.5 M22.5 -16.5 C26 -19 28 -22 28 -25"
        />
    );
}

function Reindeer({ x, y, lead = false, begin }: { x: number; y: number; lead?: boolean; begin: number }) {
    const bob = { '--hub-santa-bob-delay': `${begin}s` } as CSSProperties;
    return (
        <g transform={`translate(${x} ${y})`}>
            <g className="hub-santa__deer" style={bob}>
                <Leg x={30} y={36} front far begin={begin - 0.08} />
                <Leg x={56} y={35} front={false} far begin={begin - 0.1} />
                <path className="hub-santa__tail" d="M63 25 C67 21 71 22 70 26 C68 28 65 28 63 27 Z" />
                <path
                    className="hub-santa__fur"
                    d="M22 26 C28 19 50 18 61 22 C67 24 69 31 66 36 C63 41 55 42 47 41 C39 41 31 42 25 39 C20 36 18 30 22 26 Z"
                />
                <path className="hub-santa__belly" d="M27 37 C35 42 50 42 60 37 C56 41.5 41 43.5 29 41 Z" />
                <path className="hub-santa__harness" d="M31 23 C40 31 52 31 61 26" />
                <circle className="hub-santa__stud" cx="38" cy="27.8" r="0.9" />
                <circle className="hub-santa__stud" cx="46" cy="29.6" r="0.9" />
                <circle className="hub-santa__stud" cx="54" cy="28.6" r="0.9" />
                <Leg x={26} y={37} front far={false} begin={begin} />
                <Leg x={60} y={34} front={false} far={false} begin={begin} />
                <g transform="translate(30 27)">
                    <g>
                        <Swing values="2 0 0;-5 0 0;2 0 0" begin={begin} />
                        <g transform="translate(-30 -27)">
                            <Antler x={4} far />
                            <path className="hub-santa__fur" d="M24 31 C20 24 16 16 15 10 C17 6.5 21 6 23 8 C26 15 30 20.5 35 25 Z" />
                            <path className="hub-santa__chest" d="M21 21 C18.5 26 20 32 25 35 C23.5 30 22.5 25.5 22.5 21 Z" />
                            <path
                                className="hub-santa__fur"
                                d="M22.5 6 C21 1.5 15 0.5 10.5 2.5 C6.5 4 2.5 5.5 0.2 7.8 C-1 9.6 0.6 12 3.6 12.2 C8 12.4 12 12 16 13 C20.5 13.4 23.6 10.2 22.5 6 Z"
                            />
                            <ellipse className="hub-santa__muzzle" cx="3.6" cy="9.6" rx="4.2" ry="2.5" />
                            <path className="hub-santa__ear" d="M18.5 3 C21.5 -1.2 25.5 -1.6 27 0.6 C25 3 21.5 4.2 18.5 4.2 Z" />
                            <path className="hub-santa__ear-in" d="M20.5 3 C22.5 0.8 24.5 0.4 25.4 1 C24 2.4 22.4 3.2 20.5 3.4 Z" />
                            <Antler x={0} />
                            <circle className="hub-santa__eye" cx="11.2" cy="6.2" r="1.15" />
                            <circle className="hub-santa__eye-shine" cx="10.8" cy="5.8" r="0.4" />
                            <path className="hub-santa__brow" d="M9.4 4.6 C10.6 4 12 4 13 4.6" />
                            {lead ? <circle className="hub-santa__nose-glow" cx="-0.4" cy="8.6" r="5.5" /> : null}
                            <circle className={lead ? 'hub-santa__nose hub-santa__nose--lead' : 'hub-santa__nose'} cx="-0.4" cy="8.6" r={lead ? 2.3 : 1.6} />
                            {lead ? <circle className="hub-santa__nose-shine" cx="-1.1" cy="7.8" r="0.6" /> : null}
                            <path className="hub-santa__collar" d="M18 15.5 C21.5 20 26 22.5 31 23" />
                            <g transform="translate(24.5 21.4)">
                                <g>
                                    <Swing values="-18 0 0;18 0 0;-18 0 0" begin={begin} dur="0.42s" />
                                    <circle className="hub-santa__bell" cx="0" cy="2.2" r="2" />
                                    <circle className="hub-santa__bell-shine" cx="-0.6" cy="1.6" r="0.6" />
                                </g>
                            </g>
                        </g>
                    </g>
                </g>
            </g>
        </g>
    );
}

const DUST = Array.from({ length: 26 }, (_, i) => ({
    x: 334 + (i % 5) * 3,
    y: 70 + ((i * 7) % 16),
    r: 1.1 + ((i * 5) % 7) * 0.3,
    star: i % 3 === 1,
    dx: 30 + ((i * 13) % 50),
    dy: -12 + ((i * 11) % 26),
    delay: -((i * 0.29) % 1.8),
}));

export function HubSantaFlight() {
    const ref = useRef<HTMLDivElement | null>(null);
    const svg = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
        const onVisibility = () => {
            ref.current?.classList.toggle('hub-santa--paused', document.hidden);
            if (document.hidden)
                svg.current?.pauseAnimations?.();
            else
                svg.current?.unpauseAnimations?.();
        };
        document.addEventListener('visibilitychange', onVisibility);
        onVisibility();
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    return (
        <div className="hub-santa" aria-hidden ref={ref}>
            <div className="hub-santa__flight">
                <div className="hub-santa__bob">
                    <svg ref={svg} className="hub-santa__svg" viewBox="-4 -6 420 106">
                        <defs>
                            <linearGradient id="hub-santa-fur" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0" style={{ stopColor: 'var(--hub-santa-fur-top)' }} />
                                <stop offset="1" style={{ stopColor: 'var(--hub-santa-fur-bottom)' }} />
                            </linearGradient>
                            <linearGradient id="hub-santa-sleigh" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0" style={{ stopColor: 'var(--hub-santa-sleigh-hi)' }} />
                                <stop offset="1" style={{ stopColor: 'var(--hub-santa-sleigh-lo)' }} />
                            </linearGradient>
                            <linearGradient id="hub-santa-coat" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0" style={{ stopColor: 'var(--hub-santa-red-hi)' }} />
                                <stop offset="1" style={{ stopColor: 'var(--hub-santa-red-lo)' }} />
                            </linearGradient>
                            <linearGradient id="hub-santa-gold" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0" stopColor="#f5d58a" />
                                <stop offset="0.5" stopColor="#d4a24c" />
                                <stop offset="1" stopColor="#f1c877" />
                            </linearGradient>
                            <radialGradient id="hub-santa-sack" cx="0.35" cy="0.3" r="0.8">
                                <stop offset="0" stopColor="#c9a074" />
                                <stop offset="1" stopColor="#8a6440" />
                            </radialGradient>
                            <radialGradient id="hub-santa-face" cx="0.4" cy="0.4" r="0.7">
                                <stop offset="0" stopColor="#ffe0c7" />
                                <stop offset="1" stopColor="#efb995" />
                            </radialGradient>
                        </defs>

                        <path className="hub-santa__trace" d="M126 55 Q100 60 76 54" />
                        <path className="hub-santa__trace" d="M230 59 Q198 62 166 56" />
                        <Reindeer x={14} y={22} lead begin={0} />
                        <Reindeer x={106} y={24} begin={-0.21} />
                        <path className="hub-santa__reins" d="M246 40 Q188 34 130 47 M130 47 Q84 41 40 45" />

                        <g className="hub-santa__sack-group">
                            <path className="hub-santa__sack" d="M298 46 C292 34 296 20 308 16 C318 13 328 20 328 32 C328 42 324 48 318 50 Z" />
                            <path className="hub-santa__sack-fold" d="M304 22 C308 28 308 36 304 44 M316 18 C320 26 320 36 318 46" />
                            <rect className="hub-santa__gift-a" x="300" y="8" width="12" height="11" rx="1.2" transform="rotate(-12 306 14)" />
                            <path className="hub-santa__ribbon" d="M305.4 7.6 L307.6 18.4 M300.6 13 L311.6 11" transform="rotate(-12 306 14)" />
                            <rect className="hub-santa__gift-b" x="313" y="6" width="10" height="12" rx="1.2" transform="rotate(10 318 12)" />
                            <path className="hub-santa__ribbon hub-santa__ribbon--red" d="M318 6 L318 18 M313 12 L323 12" transform="rotate(10 318 12)" />
                            <path className="hub-santa__cane" d="M324 22 L324 6 C324 1 331 1 331 6" />
                            <path className="hub-santa__sack-tie" d="M303 18 C309 15 316 14 322 17" />
                        </g>

                        <path className="hub-santa__coat" d="M262 50 C259 36 266 25 281 24 C294 24 301 34 300 50 Z" />
                        <path className="hub-santa__fluff" d="M281 26 C279 34 279 42 281 50" />
                        <rect className="hub-santa__belt" x="262" y="42" width="38" height="5" rx="1" />
                        <rect className="hub-santa__buckle" x="277" y="41.2" width="7" height="6.6" rx="1" />

                        <g transform="translate(286 9)">
                            <g>
                                <Swing values="-4 0 0;6 0 0;-4 0 0" begin={0} dur="1.3s" />
                                <path className="hub-santa__hat" d="M-19 4 C-16 -5 -6 -8 1 -4 C7 -1 13 3 18 10 C12 8 6 7 0 7 C-6 6 -13 5 -19 4 Z" />
                                <circle className="hub-santa__pom" cx="19" cy="11" r="3.8" />
                            </g>
                        </g>
                        <circle className="hub-santa__face" cx="273" cy="18" r="7.4" />
                        <path className="hub-santa__hat-trim" d="M265 13.5 C272 9.5 282 10 289 13.6" />
                        <circle className="hub-santa__cheek" cx="268.6" cy="20" r="2.2" />
                        <path className="hub-santa__eye-line" d="M268.6 15.6 Q270.2 14.4 271.8 15.6" />
                        <path className="hub-santa__brow-white" d="M267.6 13.4 Q270 12 272.6 13.4" />
                        <path className="hub-santa__beard" d="M266 19 C261 25 263 35 271 38 C279 40 285 33 283.5 22 C281 27 272 27 266 19 Z" />
                        <path className="hub-santa__beard-shade" d="M270 30 C272 34 277 35 280 32" />
                        <path className="hub-santa__mustache" d="M265.6 22 C268 19.6 272 20 275 22.6 C272 24 268.4 24 265.6 22 Z" />
                        <circle className="hub-santa__nose-human" cx="266.6" cy="19.6" r="2" />

                        <path
                            className="hub-santa__sleigh"
                            d="M230 57 C228 50 232 46 240 46 L300 46 C306 46 308 40 310 34 C312 27 321 25 327 29 C333 33 333 44 329 54 C325 66 315 77 298 77 L249 77 C238 77 232 67 230 57 Z"
                        />
                        <path className="hub-santa__sleigh-shine" d="M236 49 C258 48 286 48 302 48 C306 46 309 40 311 35" />
                        <path className="hub-santa__ornament" d="M234 53 C262 51 292 51 306 49 C312 47 316 38 320 32" />
                        <path className="hub-santa__ornament" d="M254 64 c4 -7 13 -7 15 -1 c2 6 -6 8 -8 4 M283 64 c4 -7 13 -7 15 -1 c2 6 -6 8 -8 4" />
                        <path className="hub-santa__ornament hub-santa__ornament--thin" d="M240 71 C262 73 290 73 314 66" />
                        <path className="hub-santa__scroll" d="M230 57 C222 57 216 51 218 45 C220 39 228 39 228.5 45 C228.8 49 224 49.5 223 47" />

                        <path className="hub-santa__arm" d="M272 33 C264 35 256 38 250 40" />
                        <circle className="hub-santa__cuff" cx="250" cy="40" r="3.8" />
                        <ellipse className="hub-santa__mitt" cx="246" cy="40" rx="3.4" ry="3" />

                        <path className="hub-santa__strut" d="M245 77 L245 92 M300 77 L300 92 M245 84 L255 77 M300 84 L290 77" />
                        <path className="hub-santa__runner" d="M219 80 C212 79 211 72 217 71 C221 71 222 76 218 77 M219 80 C222 88 226 92 234 92 L316 92 C326 92 333 88 336 81" />

                        {DUST.map((p, i) => (
                            <g
                                key={i}
                                className="hub-santa__dust"
                                style={{
                                    '--dx': `${p.dx}px`,
                                    '--dy': `${p.dy}px`,
                                    animationDelay: `${p.delay.toFixed(2)}s`,
                                } as CSSProperties}
                            >
                                {p.star ? (
                                    <path
                                        className="hub-santa__spark"
                                        d={`M${p.x} ${p.y - 4} L${p.x + 1} ${p.y - 1} L${p.x + 4} ${p.y} L${p.x + 1} ${p.y + 1} L${p.x} ${p.y + 4} L${p.x - 1} ${p.y + 1} L${p.x - 4} ${p.y} L${p.x - 1} ${p.y - 1} Z`}
                                    />
                                ) : (
                                    <circle className="hub-santa__spark" cx={p.x} cy={p.y} r={p.r} />
                                )}
                            </g>
                        ))}
                    </svg>
                </div>
            </div>
        </div>
    );
}
