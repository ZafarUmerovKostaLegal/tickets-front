import { useEffect, useRef, useState } from 'react';
import './GarlandString.css';

type Bulb = { x: number; color: 0 | 1 | 2 | 3; delay: number };
type Model = { d: string; bulbs: Bulb[]; h: number };

const BOX_H = 64;
const PIN_Y = 8;
const SAG = 34;

/** A festoon wire across `width` px with a bulb hanging at each sag. */
function buildGarland(width: number): Model {
    const pins = Math.min(22, Math.max(4, Math.round(width / 150)));
    const step = width / (pins - 1);
    const segs: string[] = [`M 0 ${PIN_Y}`];
    const bulbs: Bulb[] = [];
    for (let i = 0; i < pins - 1; i += 1) {
        const x1 = i * step;
        const x2 = (i + 1) * step;
        const mid = (x1 + x2) / 2;
        segs.push(`Q ${mid.toFixed(1)} ${PIN_Y + SAG} ${x2.toFixed(1)} ${PIN_Y}`);
        bulbs.push({ x: mid, color: (i % 4) as 0 | 1 | 2 | 3, delay: Number(((i * 0.41) % 2.6).toFixed(2)) });
    }
    return { d: segs.join(' '), bulbs, h: BOX_H };
}

/** A string of warm, softly twinkling lights hung across the hub header. */
export function GarlandString() {
    const ref = useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const measure = () => setWidth(el.clientWidth);
        measure();
        if (typeof ResizeObserver === 'undefined')
            return;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const onVisibility = () => {
            ref.current?.classList.toggle('hub-garland--paused', document.hidden);
        };
        document.addEventListener('visibilitychange', onVisibility);
        onVisibility();
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    const model = width > 0 ? buildGarland(width) : null;

    return (
        <div className="hub-garland" aria-hidden ref={ref} style={model ? { height: model.h } : undefined}>
            {model ? (
                <>
                    <svg
                        className="hub-garland__wire"
                        width={width}
                        height={model.h}
                        viewBox={`0 0 ${width} ${model.h}`}
                        preserveAspectRatio="none"
                        fill="none"
                    >
                        <path d={model.d} />
                    </svg>
                    {model.bulbs.map((b, i) => (
                        <span
                            key={i}
                            className={`hub-garland__bulb hub-garland__bulb--c${b.color}`}
                            style={{ left: b.x, animationDelay: `-${b.delay}s` }}
                        />
                    ))}
                </>
            ) : null}
        </div>
    );
}
