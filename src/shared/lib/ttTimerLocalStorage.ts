export const TT_TIMESHEET_TIMER_LS_PREFIX = 'tt_timesheet_timer_v1:';
export function clearAllTimesheetTimerLocalStorageKeys(): void {
    if (typeof window === 'undefined')
        return;
    try {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith(TT_TIMESHEET_TIMER_LS_PREFIX))
                toRemove.push(k);
        }
        for (const k of toRemove) {
            localStorage.removeItem(k);
        }
    }
    catch {
    }
}
