import { useState, useEffect, useRef } from 'react';
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}
export function useAnimatedNumber(target, options = {}) {
    const { duration = 600, enabled = true } = options;
    const [value, setValue] = useState(0);
    const rafRef = useRef(undefined);
    const startRef = useRef(undefined);
    useEffect(() => {
        if (!enabled) {
            setValue(target);
            return;
        }
        setValue(0);
        startRef.current = undefined;
        const animate = (timestamp) => {
            if (startRef.current === undefined)
                startRef.current = timestamp;
            const elapsed = timestamp - startRef.current;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutCubic(progress);
            setValue(target * eased);
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate);
            }
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => {
            if (rafRef.current !== undefined)
                cancelAnimationFrame(rafRef.current);
        };
    }, [target, duration, enabled]);
    return value;
}
