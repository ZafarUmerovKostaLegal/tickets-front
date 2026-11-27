import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

const KEY = 'fm.paneWidth';
export const PANE_MIN = 320;
export const PANE_DEFAULT = 400;
const LIST_MIN = 360;
const STEP = 32;

export function clampPaneWidth(width: number, room: number): number {
    const max = Math.max(PANE_MIN, room - LIST_MIN);
    return Math.round(Math.min(Math.max(width, PANE_MIN), max));
}

function readStored(): number | null {
    try {
        const n = Number(window.localStorage.getItem(KEY));
        return Number.isFinite(n) && n >= PANE_MIN ? n : null;
    }
    catch {
        return null;
    }
}

function store(width: number | null): void {
    try {
        if (width == null)
            window.localStorage.removeItem(KEY);
        else
            window.localStorage.setItem(KEY, String(width));
    }
    catch {}
}

export function usePaneResize(paneRef: { current: HTMLElement | null }) {
    const [width, setWidth] = useState<number | null>(() => readStored());
    const [dragging, setDragging] = useState(false);
    const drag = useRef<{ x: number; w: number } | null>(null);

    const room = useCallback(() => paneRef.current?.parentElement?.clientWidth ?? window.innerWidth, [paneRef]);

    const commit = useCallback((next: number | null) => {
        const value = next == null ? null : clampPaneWidth(next, room());
        setWidth(value);
        store(value);
    }, [room]);

    useEffect(() => {
        const onResize = () => setWidth((current) => (current == null ? null : clampPaneWidth(current, room())));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [room]);

    const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0)
            return;
        event.preventDefault();
        drag.current = { x: event.clientX, w: paneRef.current?.getBoundingClientRect().width ?? PANE_DEFAULT };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
        if (!drag.current)
            return;
        setWidth(clampPaneWidth(drag.current.w + (drag.current.x - event.clientX), room()));
    };

    const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
        if (!drag.current)
            return;
        drag.current = null;
        setDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        setWidth((current) => {
            store(current);
            return current;
        });
    };

    const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
        const current = width ?? paneRef.current?.getBoundingClientRect().width ?? PANE_DEFAULT;
        if (event.key === 'ArrowLeft')
            commit(current + STEP);
        else if (event.key === 'ArrowRight')
            commit(current - STEP);
        else if (event.key === 'Home')
            commit(PANE_MIN);
        else if (event.key === 'End')
            commit(Number.MAX_SAFE_INTEGER);
        else
            return;
        event.preventDefault();
    };

    return {
        width,
        dragging,
        handleProps: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
            onKeyDown,
            onDoubleClick: () => commit(null),
        },
    };
}
