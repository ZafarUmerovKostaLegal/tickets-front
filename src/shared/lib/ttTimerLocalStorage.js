export const TT_TIMESHEET_TIMER_LS_PREFIX = 'tt_timesheet_timer_v1:';
export const TT_TIMER_STORAGE_CHANGED_EVENT = 'tt:timer-storage-changed';
export function notifyTimesheetTimerStorageChanged(authUserId) {
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new CustomEvent(TT_TIMER_STORAGE_CHANGED_EVENT, {
        detail: { authUserId },
    }));
}
export function clearAllTimesheetTimerLocalStorageKeys() {
    if (typeof window === 'undefined')
        return;
    try {
        const toRemove = [];
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
