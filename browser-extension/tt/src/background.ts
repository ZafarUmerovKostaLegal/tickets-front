import { MSG, STORAGE_KEYS } from './shared/constants';
import { baseDurationSeconds, elapsedSeconds } from './shared/format';
import { sumTodayHours } from './shared/api';
import { makeDraftPayload, resolveRecentSnapshot, stopTimer } from './shared/timer-engine';
import type { AuthState, ExtensionState, TimerPayload } from './shared/types';

let auth: AuthState | null = null;
let timer: TimerPayload | null = null;
let busy = false;
let error: string | null = null;

async function loadState(): Promise<void> {
    const data = await chrome.storage.local.get([STORAGE_KEYS.auth, STORAGE_KEYS.timer]);
    auth = (data[STORAGE_KEYS.auth] as AuthState | undefined) ?? null;
    timer = (data[STORAGE_KEYS.timer] as TimerPayload | undefined) ?? null;
}

async function persist(): Promise<void> {
    await chrome.storage.local.set({
        [STORAGE_KEYS.auth]: auth,
        [STORAGE_KEYS.timer]: timer,
    });
    updateBadge();
    broadcastState();
}

function buildState(todayHours: number | null = null): ExtensionState {
    return { auth, timer, todayHours, error, busy };
}

function broadcastState(): void {
    chrome.runtime.sendMessage({ type: MSG.STATE_CHANGED, state: buildState() }).catch(() => {});
}

function updateBadge(): void {
    if (!timer) {
        chrome.action.setBadgeText({ text: '' });
        return;
    }
    const sec = elapsedSeconds(timer);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const text = h > 0 ? `${h}h` : `${m}m`;
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: timer.paused ? '#b45309' : '#4f46e5' });
}

async function pushTimerToTabs(): Promise<void> {
    if (!auth || !timer)
        return;
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (!tab.id)
            continue;
        chrome.tabs.sendMessage(tab.id, {
            type: MSG.TIMER_PUSH,
            userId: auth.user.id,
            payload: timer,
        }).catch(() => {});
    }
}

async function refreshTodayHours(): Promise<number | null> {
    if (!auth)
        return null;
    try {
        return await sumTodayHours(auth.apiBase, auth.token, auth.user.id);
    }
    catch {
        return null;
    }
}

async function requestAuthFromAppTabs(): Promise<void> {
    const tabs = await chrome.tabs.query({
        url: [
            'http://localhost:5173/*',
            'http://127.0.0.1:5173/*',
            'https://*.kostalegal.com/*',
        ],
    });
    await Promise.all(tabs.map(async (tab) => {
        if (!tab.id)
            return;
        try {
            await chrome.tabs.sendMessage(tab.id, { type: MSG.AUTH_PING });
        }
        catch {
            // tab without content script
        }
    }));
}

chrome.alarms.create('tt-badge', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(() => {
    if (timer)
        updateBadge();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void (async () => {
        try {
            if (message.type === MSG.AUTH_SYNC) {
                auth = {
                    token: String(message.token ?? '').trim(),
                    apiBase: message.apiBase as string,
                    user: message.user,
                };
                error = null;
                await persist();
                sendResponse({ ok: true });
                return;
            }
            if (message.type === MSG.AUTH_CLEAR) {
                auth = null;
                timer = null;
                error = null;
                await persist();
                sendResponse({ ok: true });
                return;
            }
            if (message.type === MSG.TIMER_SYNC_FROM_PAGE) {
                if (!auth || message.userId !== auth.user.id)
                    return sendResponse({ ok: false });
                timer = message.payload ?? null;
                await persist();
                sendResponse({ ok: true });
                return;
            }
            if (message.type === MSG.GET_STATE) {
                if (!auth)
                    await requestAuthFromAppTabs();
                const todayHours = await refreshTodayHours();
                sendResponse(buildState(todayHours));
                return;
            }
            if (message.type === MSG.TIMER_TOGGLE_PAUSE) {
                if (!timer)
                    return sendResponse({ ok: false, reason: 'no_timer' });
                if (timer.paused) {
                    timer = { ...timer, paused: false, startedAt: Date.now() };
                }
                else {
                    const addSec = Math.max(0, Math.floor((Date.now() - timer.startedAt) / 1000));
                    const totalDurationSeconds = baseDurationSeconds(timer.snapshot) + addSec;
                    timer = {
                        ...timer,
                        paused: true,
                        startedAt: Date.now(),
                        snapshot: {
                            ...timer.snapshot,
                            durationSeconds: totalDurationSeconds,
                            hours: totalDurationSeconds / 3600,
                        },
                    };
                }
                await persist();
                await pushTimerToTabs();
                sendResponse({ ok: true });
                return;
            }
            if (message.type === MSG.TIMER_STOP) {
                if (!auth || !timer)
                    return sendResponse({ ok: false, reason: 'no_timer' });
                busy = true;
                error = null;
                broadcastState();
                const result = await stopTimer(auth, timer);
                busy = false;
                if (!result.ok) {
                    error = result.reason;
                    sendResponse({ ok: false, reason: result.reason });
                    broadcastState();
                    return;
                }
                timer = null;
                await persist();
                await pushTimerToTabs();
                sendResponse({ ok: true });
                return;
            }
            if (message.type === MSG.TIMER_START_RECENT) {
                if (!auth)
                    return sendResponse({ ok: false, reason: 'not_auth' });
                if (timer)
                    return sendResponse({ ok: false, reason: 'already_running' });
                busy = true;
                error = null;
                const snap = await resolveRecentSnapshot(auth);
                busy = false;
                if (!snap) {
                    error = 'Нет недавних записей. Откройте приложение и создайте запись.';
                    sendResponse({ ok: false, reason: error });
                    broadcastState();
                    return;
                }
                timer = makeDraftPayload(auth, snap, 0);
                await persist();
                await pushTimerToTabs();
                sendResponse({ ok: true });
                return;
            }
            sendResponse({ ok: false, reason: 'unknown' });
        }
        catch (e) {
            busy = false;
            error = e instanceof Error ? e.message : String(e);
            sendResponse({ ok: false, reason: error });
            broadcastState();
        }
    })();
    return true;
});

chrome.runtime.onInstalled.addListener(() => {
    void loadState().then(updateBadge);
});

void loadState().then(updateBadge);

export {};
