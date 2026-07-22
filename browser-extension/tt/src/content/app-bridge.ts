import { MSG, TOKEN_KEY, TT_TIMER_LS_PREFIX } from '../shared/constants';
import { payloadFromPageStorage, toPageStoragePayload } from '../shared/timer-engine';
import type { ExtUser, TimerPayload } from '../shared/types';

type BridgeResult = {
    token: string | null;
    apiBase: string;
    timerRaw: string | null;
    user: ExtUser | null;
};

function timerKey(userId: number): string {
    return `${TT_TIMER_LS_PREFIX}${userId}`;
}

function parseUser(data: Record<string, unknown>): ExtUser | null {
    const id = Number(data.id);
    if (!Number.isFinite(id) || id <= 0)
        return null;
    return {
        id,
        email: String(data.email ?? ''),
        display_name: String(data.display_name ?? data.displayName ?? ''),
        role: String(data.role ?? ''),
        time_tracking_role: (data.time_tracking_role ?? data.timeTrackingRole ?? null) as ExtUser['time_tracking_role'],
    };
}

/** Content scripts share origin localStorage with the page; no MAIN-world injection needed. */
async function readFromPage(): Promise<BridgeResult> {
    const apiBase = window.location.origin;
    const token = localStorage.getItem(TOKEN_KEY)?.trim() || null;
    const headers: HeadersInit = {};
    if (token)
        headers.Authorization = `Bearer ${token}`;
    try {
        const res = await fetch(`${apiBase}/api/v1/users/me`, {
            headers,
            credentials: 'include',
        });
        if (!res.ok) {
            return { token: null, apiBase, user: null, timerRaw: null };
        }
        const user = parseUser(await res.json() as Record<string, unknown>);
        if (!user)
            return { token: null, apiBase, user: null, timerRaw: null };
        const timerRaw = localStorage.getItem(timerKey(user.id));
        return { token, apiBase, user, timerRaw };
    }
    catch {
        return { token: null, apiBase, user: null, timerRaw: null };
    }
}

function writeTimerToPage(userId: number, payload: TimerPayload | null): void {
    const key = timerKey(userId);
    try {
        if (payload)
            localStorage.setItem(key, toPageStoragePayload(payload));
        else
            localStorage.removeItem(key);
        window.dispatchEvent(new CustomEvent('tt:timer-storage-changed', { detail: { authUserId: userId } }));
    }
    catch {
        // ignore quota / private mode
    }
}

let lastTimerRaw: string | null | undefined;

async function syncAuthFromPage(includeTimer = false): Promise<void> {
    const data = await readFromPage();
    if (!data.user) {
        lastTimerRaw = undefined;
        await chrome.runtime.sendMessage({ type: MSG.AUTH_CLEAR }).catch(() => {});
        return;
    }
    await chrome.runtime.sendMessage({
        type: MSG.AUTH_SYNC,
        token: data.token,
        apiBase: data.apiBase,
        user: data.user,
    }).catch(() => {});
    if (!includeTimer)
        return;
    const timerRaw = data.timerRaw;
    if (lastTimerRaw === undefined || timerRaw !== lastTimerRaw) {
        lastTimerRaw = timerRaw;
        const timer = timerRaw ? payloadFromPageStorage(timerRaw, data.user.id) : null;
        await chrome.runtime.sendMessage({
            type: MSG.TIMER_SYNC_FROM_PAGE,
            userId: data.user.id,
            payload: timer,
        }).catch(() => {});
    }
}

async function syncTimerFromPage(): Promise<void> {
    const data = await readFromPage();
    if (!data.user)
        return;
    const timerRaw = data.timerRaw;
    if (timerRaw === lastTimerRaw)
        return;
    lastTimerRaw = timerRaw;
    const timer = timerRaw ? payloadFromPageStorage(timerRaw, data.user.id) : null;
    await chrome.runtime.sendMessage({
        type: MSG.TIMER_SYNC_FROM_PAGE,
        userId: data.user.id,
        payload: timer,
    }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === MSG.TIMER_PUSH) {
        const payload = (message.payload ?? null) as TimerPayload | null;
        writeTimerToPage(message.userId as number, payload);
        lastTimerRaw = payload ? toPageStoragePayload(payload) : null;
        sendResponse({ ok: true });
        return;
    }
    if (message.type === MSG.AUTH_PING) {
        void syncAuthFromPage(true).then(() => sendResponse({ ok: true }));
        return true;
    }
    return false;
});

window.addEventListener('storage', (ev) => {
    if (ev.key && ev.key.startsWith(TT_TIMER_LS_PREFIX))
        void syncTimerFromPage();
});

window.addEventListener('tt:timer-storage-changed', () => {
    void syncTimerFromPage();
});

void syncAuthFromPage(true);

const AUTH_FALLBACK_MS = 15_000;
setInterval(() => {
    if (document.visibilityState !== 'visible')
        return;
    void syncAuthFromPage(false);
}, AUTH_FALLBACK_MS);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
        void syncAuthFromPage(true);
});

export {};
