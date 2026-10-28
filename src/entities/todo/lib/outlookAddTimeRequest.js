export const OUTLOOK_ADD_TIME_EVENT = 'tt-outlook-add-time';
const STORAGE_KEY = 'tt-outlook-add-time-pending';
export function queueOutlookAddTime(event) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(event));
    }
    catch {
        /* private mode */
    }
    window.dispatchEvent(new CustomEvent(OUTLOOK_ADD_TIME_EVENT));
}
export function takeQueuedOutlookAddTime() {
    let raw = null;
    try {
        raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw)
            sessionStorage.removeItem(STORAGE_KEY);
    }
    catch {
        return null;
    }
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.id)
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
