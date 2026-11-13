import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './GarlandString.css';

/** Animation modes from the winter design mockup. */
type GlowMode = 'wave' | 'twinkle' | 'chase' | 'steady';

type Bulb = {
    x: number;
    y: number;
    tilt: number;
    color: 0 | 1 | 2 | 3;
    sway: string;
    glow: string;
    glass: string;
};

type Model = { d: string; bulbs: Bulb[]; h: number };

const Y0 = 2;
const PER_SEG = 4;
const STAGE_H = 96;
const MODE: GlowMode = 'wave';

function rnd(i: number, s: number): number {
    const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
    return v - Math.floor(v);
}

function timingFor(mode: GlowMode, i: number, total: number): { key: string; timing: string } | null {
    if (mode === 'steady')
        return null;
    if (mode === 'wave')
        return { key: 'wave', timing: `3.6s ease-in-out ${(-(total - i) * 0.16).toFixed(2)}s infinite` };
    if (mode === 'chase')
        return { key: 'chase', timing: `2.4s ease-in-out ${(-(4 - (i % 4)) * 0.6).toFixed(2)}s infinite` };
    return {
        key: 'twinkle',
        timing: `${(2.4 + rnd(i, 1) * 3.2).toFixed(2)}s ease-in-out ${(-rnd(i, 2) * 5).toFixed(2)}s infinite`,
    };
}

/**
 * Festoon geometry + bulb placement from the winter design mockup:
 * quadratic wire, 4 bulbs per span, tilt follows the local slope.
 */
function buildGarland(width: number, mode: GlowMode): Model {
    const n = Math.max(2, Math.round(width / 250));
    const seg = width / n;
    let wire = `M0 ${Y0}`;
    const bulbs: Bulb[] = [];
    const total = n * PER_SEG;

    for (let s = 0; s < n; s += 1) {
        const sag = 26 + (s % 2 ? 8 : 0) + rnd(s, 3) * 5;
        const x0 = s * seg;
        wire += ` Q${(x0 + seg / 2).toFixed(1)} ${(Y0 + 2 * sag).toFixed(1)} ${(x0 + seg).toFixed(1)} ${Y0}`;

        for (let k = 0; k < PER_SEG; k += 1) {
            const i = s * PER_SEG + k;
            const tt = (k + 0.5) / PER_SEG;
            const slope = (4 * sag * (1 - 2 * tt)) / seg;
            const anim = timingFor(mode, i, total);
            const swayDur = (2.8 + rnd(i, 5) * 2.4).toFixed(2);
            const swayDelay = (-rnd(i, 6) * 5).toFixed(2);
            bulbs.push({
                x: Number((x0 + tt * seg).toFixed(1)),
                y: Number((Y0 + 4 * sag * tt * (1 - tt)).toFixed(1)),
                tilt: Number((-Math.atan(slope) * (180 / Math.PI)).toFixed(1)),
                color: (i % 4) as 0 | 1 | 2 | 3,
                sway: `hub-garland-sway ${swayDur}s cubic-bezier(0.45, 0.05, 0.55, 0.95) ${swayDelay}s infinite alternate`,
                glow: anim ? `hub-garland-glow-${anim.key} ${anim.timing}` : 'none',
                glass: anim ? `hub-garland-glass-${anim.key} ${anim.timing}` : 'none',
            });
        }
    }

    return { d: wire, bulbs, h: STAGE_H };
}

function readTopbarBottom(): number {
    const bar = document.querySelector<HTMLElement>('.home-hub-topbar');
    if (!bar)
        return 64;
    return Math.round(bar.getBoundingClientRect().bottom);
}

/** Header festoon — fixed under the topbar so it stays visible while scrolling. */
export function GarlandString() {
    const ref = useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(0);
    const [top, setTop] = useState(64);

    useLayoutEffect(() => {
        const measure = () => {
            setWidth(window.innerWidth);
            setTop(readTopbarBottom());
        };
        measure();
        const bar = document.querySelector('.home-hub-topbar');
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        if (bar && ro)
            ro.observe(bar);
        window.addEventListener('resize', measure);
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, []);

    useEffect(() => {
        const onVisibility = () => {
            ref.current?.classList.toggle('hub-garland--paused', document.hidden);
        };
        document.addEventListener('visibilitychange', onVisibility);
        onVisibility();
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    const model = width > 0 ? buildGarland(width, MODE) : null;

    return (
        <div
            className="hub-garland"
            aria-hidden
            ref={ref}
            style={{ top, ['--hub-garland-h' as string]: `${STAGE_H}px` }}
        >
            {model ? (
                <div className="hub-garland__stage" style={{ height: model.h }}>
                    <svg
                        className="hub-garland__wire"
                        width={width}
                        height={model.h}
                        viewBox={`0 0 ${width} ${model.h}`}
                        preserveAspectRatio="xMinYMin meet"
                        fill="none"
                    >
                        <path d={model.d} />
                    </svg>
                    {model.bulbs.map((b, i) => (
                        <div
                            key={i}
                            className="hub-garland__pivot"
                            style={{ left: b.x, top: b.y, transform: `rotate(${b.tilt}deg)` }}
                        >
                            <div className="hub-garland__sway kl-move" style={{ animation: b.sway }}>
                                <span className="hub-garland__socket" />
                                <span
                                    className={`hub-garland__halo hub-garland__halo--c${b.color} kl-move`}
                                    style={{ animation: b.glow }}
                                />
                                <span
                                    className={`hub-garland__glass hub-garland__glass--c${b.color} kl-move`}
                                    style={{ animation: b.glass }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
