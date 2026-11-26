import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react';

const CLOSE_MS = 200;

function reducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    catch {
        return false;
    }
}

export function useAnimatedClose(onClose: () => void) {
    const [closing, setClosing] = useState(false);
    const done = useRef(false);
    const timer = useRef<number | null>(null);

    const finish = useCallback(() => {
        if (done.current)
            return;
        done.current = true;
        if (timer.current != null)
            window.clearTimeout(timer.current);
        onClose();
    }, [onClose]);

    const close = useCallback(() => {
        if (reducedMotion()) {
            finish();
            return;
        }
        setClosing(true);
        timer.current = window.setTimeout(finish, CLOSE_MS + 80);
    }, [finish]);

    useEffect(() => () => {
        if (timer.current != null)
            window.clearTimeout(timer.current);
    }, []);

    const onAnimationEnd = useCallback((event: AnimationEvent<HTMLElement>) => {
        if (closing && event.target === event.currentTarget)
            finish();
    }, [closing, finish]);

    return { closing, close, onAnimationEnd };
}
