import { useEffect, useReducer } from 'react';
export function useRunningTimerLiveSeconds(runningTimer) {
    const [, bump] = useReducer((n) => n + 1, 0);
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
export function entryBaseDurationSeconds(e) {
    if (typeof e.durationSeconds === 'number' && Number.isFinite(e.durationSeconds))
        return Math.max(0, Math.trunc(e.durationSeconds));
    const h = e.hours;
    if (!Number.isFinite(h) || h <= 0)
        return 0;
    return Math.max(0, Math.floor(h * 3600));
}
export function entryHoursForTotals(e, runningTimer, liveExtraSec) {
    if (e.isVoided)
        return 0;
    if (runningTimer && runningTimer.entryId === e.id && !runningTimer.paused)
        return (entryBaseDurationSeconds(e) + liveExtraSec) / 3600;
    return entryBaseDurationSeconds(e) / 3600;
}
