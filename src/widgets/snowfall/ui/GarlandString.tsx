import { useEffect, useRef, useState } from 'react';
import './GarlandString.css';

type Bulb = {
    x: number;
    color: 0 | 1 | 2 | 3;
    delay: number;
    dur: number;
    flash: boolean;
};
type Model = { d: string; bulbs: Bulb[] };

const PIN_Y = 8;
const SAG = 36;
/** Keep end pins slightly inset so the last bulb/glow isn't clipped by the viewport edge. */
const EDGE_INSET = 8;

/** A festoon wire across `width` px with a bulb hanging at each sag. */
function buildGarland(width: number): Model {
    const usable = Math.max(120, width - EDGE_INSET * 2);
    const pins = Math.min(22, Math.max(5, Math.round(usable / 140)));
    const step = usable / (pins - 1);
    const segs: string[] = [`M ${EDGE_INSET} ${PIN_Y}`];
    const bulbs: Bulb[] = [];
    for (let i = 0; i < pins - 1; i += 1) {
        const x1 = EDGE_INSET + i * step;
        const x2 = EDGE_INSET + (i + 1) * step;
        const mid = (x1 + x2) / 2;
        segs.push(`Q ${mid.toFixed(1)} ${PIN_Y + SAG} ${x2.toFixed(1)} ${PIN_Y}`);
        bulbs.push({
            x: mid,
            color: (i % 4) as 0 | 1 | 2 | 3,
            delay: Number(((i * 0.53) % 3.1).toFixed(2)),
            dur: Number((2.2 + (i % 5) * 0.35).toFixed(2)),
            flash: i % 3 === 1,
        });
    }
    return { d: segs.join(' '), bulbs };
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
        <div className="hub-garland" aria-hidden ref={ref}>
            {model ? (
                <div className="hub-garland__stage">
                    <svg
                        className="hub-garland__wire"
                        width={width}
                        height={68}
                        viewBox={`0 0 ${width} 68`}
                        preserveAspectRatio="none"
                        fill="none"
                    >
                        <path d={model.d} />
                    </svg>
                    {model.bulbs.map((b, i) => (
                        <span
                            key={i}
                            className={[
                                'hub-garland__bulb',
                                `hub-garland__bulb--c${b.color}`,
                                b.flash ? 'hub-garland__bulb--flash' : '',
                            ].filter(Boolean).join(' ')}
                            style={{
                                left: b.x,
                                ['--tw-delay' as string]: `-${b.delay}s`,
                                ['--tw-dur' as string]: `${b.dur}s`,
                            }}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}
