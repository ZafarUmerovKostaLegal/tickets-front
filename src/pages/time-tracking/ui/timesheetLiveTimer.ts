import { useEffect, useReducer } from 'react';

export type TimesheetRunningTimer = {
    entryId: string;
    startedAt: number;
    paused?: boolean;
};

export function useRunningTimerLiveSeconds(runningTimer: TimesheetRunningTimer | null | undefined): number {
    const [, bump] = useReducer((n: number) => n + 1, 0);
    const active = Boolean(runningTimer && !runningTimer.paused);
    useEffect(() => {
        if (!active)
            return;
        const id = window.setInterval(() => bump(), 1000);
        return () => window.clearInterval(id);
    }, [active, runningTimer?.entryId, runningTimer?.startedAt]);
    if (!active || !runningTimer)
        return 0;
    return Math.max(0, Math.floor((Date.now() - runningTimer.startedAt) / 1000));
}

export function entryBaseDurationSeconds(e: {
    durationSeconds?: number;
    hours: number;
}): number {
    if (typeof e.durationSeconds === 'number' && Number.isFinite(e.durationSeconds))
        return Math.max(0, Math.trunc(e.durationSeconds));
    const h = e.hours;
    if (!Number.isFinite(h) || h <= 0)
        return 0;
    return Math.max(0, Math.floor(h * 3600));
}

export function entryHoursForTotals(
    e: {
        id: string;
        durationSeconds?: number;
        hours: number;
        isVoided?: boolean;
    },
    runningTimer: TimesheetRunningTimer | null,
    liveExtraSec: number,
): number {
    if (e.isVoided)
        return 0;
    if (runningTimer && runningTimer.entryId === e.id && !runningTimer.paused)
        return (entryBaseDurationSeconds(e) + liveExtraSec) / 3600;
    return entryBaseDurationSeconds(e) / 3600;
}
