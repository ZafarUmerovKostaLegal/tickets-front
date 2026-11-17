import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import './GarlandString.css';

type Pt = [number, number];

type Light = {
    x: number;
    y: number;
    back: boolean;
    tone: 'warm' | 'gold';
    sparkle: boolean;
    delay: number;
    dur: number;
};

type Strand = { d: string; back: boolean };

type Model = { strands: Strand[]; lights: Light[] };

const STAGE_H = 96;
const SHIMMER = 5.2;

function rnd(i: number, s: number): number {
    const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
    return v - Math.floor(v);
}

function quad(a: Pt, c: Pt, b: Pt, t: number): Pt {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

function buildStrand(
    width: number,
    opts: { seg: number; offset: number; y0: number; sag: number; sagAlt: number; spacing: number; back: boolean },
    lights: Light[],
): Strand {
    const { seg, offset, y0, sag, sagAlt, spacing, back } = opts;
    let d = '';
    let carry = spacing / 2;
    let s = 0;
    for (let x0 = offset; x0 < width; x0 += seg, s += 1) {
        const depth = sag + (s % 2 ? sagAlt : 0) + rnd(s, back ? 7 : 3) * 4;
        const a: Pt = [x0, y0];
        const c: Pt = [x0 + seg / 2, y0 + 2 * depth];
        const b: Pt = [x0 + seg, y0];
        d += `${d ? ' ' : ''}M${a[0].toFixed(1)} ${a[1]} Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1]}`;

        let prev = a;
        const steps = 48;
        for (let k = 1; k <= steps; k += 1) {
            const p = quad(a, c, b, k / steps);
            let len = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
            while (carry <= len) {
                const f = carry / len;
                const x = prev[0] + (p[0] - prev[0]) * f;
                const y = prev[1] + (p[1] - prev[1]) * f;
                if (x > -6 && x < width + 6) {
                    const i = lights.length;
                    lights.push({
                        x,
                        y,
                        back,
                        tone: !back && rnd(i, 11) < 0.14 ? 'gold' : 'warm',
                        sparkle: !back && rnd(i, 12) < 0.16,
                        delay: -((x / width) * SHIMMER + rnd(i, 13) * 0.6),
                        dur: 2.6 + rnd(i, 14) * 3.4,
                    });
                }
                prev = [x, y];
                len -= carry;
                carry = spacing;
            }
            carry -= len;
            prev = p;
        }
    }
    return { d, back };
}

function buildGarland(width: number): Model {
    const n = Math.max(2, Math.round(width / 340));
    const seg = width / n;
    const lights: Light[] = [];
    const back = buildStrand(width, { seg, offset: -seg / 2, y0: -2, sag: 40, sagAlt: 6, spacing: 30, back: true }, lights);
    const front = buildStrand(width, { seg, offset: 0, y0: -2, sag: 28, sagAlt: 6, spacing: 26, back: false }, lights);
    return { strands: [back, front], lights };
}

function readTopbarBottom(): number {
    const bar = document.querySelector<HTMLElement>('.home-hub-topbar');
    if (!bar)
        return 64;
    return Math.round(bar.getBoundingClientRect().bottom);
}

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

    const model = useMemo(() => (width > 0 ? buildGarland(width) : null), [width]);

    return (
        <div className="hub-garland" aria-hidden ref={ref} style={{ top }}>
            {model ? (
                <div className="hub-garland__stage" style={{ height: STAGE_H }}>
                    <svg
                        className="hub-garland__wire"
                        width={width}
                        height={STAGE_H}
                        viewBox={`0 0 ${width} ${STAGE_H}`}
                        fill="none"
                    >
                        {model.strands.map((s, i) => (
                            <path key={i} d={s.d} className={s.back ? 'hub-garland__strand--back' : 'hub-garland__strand'} />
                        ))}
                    </svg>
                    {model.lights.map((l, i) => {
                        const cls = [
                            'hub-garland__light',
                            l.back ? 'hub-garland__light--back' : 'kl-move',
                            l.tone === 'gold' && 'hub-garland__light--gold',
                            l.sparkle && 'hub-garland__light--sparkle',
                        ].filter(Boolean).join(' ');
                        const style = {
                            left: l.x,
                            top: l.y,
                            animationDelay: l.back ? undefined : `${l.delay.toFixed(2)}s, ${(l.delay * 1.7).toFixed(2)}s`,
                            '--hg-sparkle-dur': `${l.dur.toFixed(2)}s`,
                        } as CSSProperties;
                        return <span key={i} className={cls} style={style} />;
                    })}
                </div>
            ) : null}
        </div>
    );
}
