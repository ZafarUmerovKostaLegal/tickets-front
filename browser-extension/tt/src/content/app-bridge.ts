import { MSG, TOKEN_KEY, TT_TIMER_LS_PREFIX } from '../shared/constants';
import { payloadFromPageStorage, toPageStoragePayload } from '../shared/timer-engine';
import type { TimerPayload } from '../shared/types';

type BridgeResult = {
    token: string | null;
    apiBase: string;
    timerRaw: string | null;
    userJson: string | null;
};

function readFromPage(): Promise<BridgeResult> {
    return new Promise((resolve) => {
        const id = `kl-tt-bridge-${Date.now()}`;
        const onMessage = (ev: MessageEvent) => {
            if (ev.source !== window || !ev.data || ev.data.type !== `${id}:result`)
                return;
            window.removeEventListener('message', onMessage);
            resolve(ev.data.payload as BridgeResult);
        };
        window.addEventListener('message', onMessage);
        const script = document.createElement('script');
        script.textContent = `
(function(){
  var id = ${JSON.stringify(id)};
  try {
    var token = localStorage.getItem(${JSON.stringify(TOKEN_KEY)});
    var apiBase = window.location.origin;
    var userJson = null;
    var timerRaw = null;
    var uid = null;
    if (token) {
      fetch(apiBase + '/api/v1/users/me', {
        headers: { 'Authorization': 'Bearer ' + token },
        credentials: 'include'
      }).then(function(r) { return r.ok ? r.json() : null; })
        .then(function(u) {
          if (u && u.id) {
            uid = u.id;
            userJson = JSON.stringify({
              id: u.id,
              email: u.email || '',
              display_name: u.display_name || u.displayName || '',
              role: u.role || '',
              time_tracking_role: u.time_tracking_role || u.timeTrackingRole || null
            });
            timerRaw = localStorage.getItem(${JSON.stringify(TT_TIMER_LS_PREFIX)} + u.id);
          }
          window.postMessage({ type: id + ':result', payload: {
            token: token,
            apiBase: apiBase,
            userJson: userJson,
            timerRaw: timerRaw
          }}, '*');
        }).catch(function(){
          window.postMessage({ type: id + ':result', payload: {
            token: token, apiBase: apiBase, userJson: null, timerRaw: null
          }}, '*');
        });
    } else {
      window.postMessage({ type: id + ':result', payload: {
        token: null, apiBase: apiBase, userJson: null, timerRaw: null
      }}, '*');
    }
  } catch (e) {
    window.postMessage({ type: id + ':result', payload: {
      token: null, apiBase: location.origin, userJson: null, timerRaw: null
    }}, '*');
  }
})();
        `;
        (document.documentElement || document.head).appendChild(script);
        script.remove();
        setTimeout(() => {
            window.removeEventListener('message', onMessage);
            resolve({ token: null, apiBase: location.origin, userJson: null, timerRaw: null });
        }, 8000);
    });
}

function writeTimerToPage(userId: number, payload: TimerPayload | null): void {
    const script = document.createElement('script');
    const key = `${TT_TIMER_LS_PREFIX}${userId}`;
    if (payload) {
        const raw = toPageStoragePayload(payload);
        script.textContent = `
try {
  localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(raw)});
  window.dispatchEvent(new CustomEvent('tt:timer-storage-changed', { detail: { authUserId: ${userId} } }));
} catch (e) {}
        `;
    }
    else {
        script.textContent = `
try {
  localStorage.removeItem(${JSON.stringify(key)});
  window.dispatchEvent(new CustomEvent('tt:timer-storage-changed', { detail: { authUserId: ${userId} } }));
} catch (e) {}
        `;
    }
    (document.documentElement || document.head).appendChild(script);
    script.remove();
}

let lastTimerRaw: string | null | undefined;

async function syncAuthFromPage(includeTimer = false): Promise<void> {
    const data = await readFromPage();
    if (!data.token || !data.userJson) {
        lastTimerRaw = undefined;
        await chrome.runtime.sendMessage({ type: MSG.AUTH_CLEAR });
        return;
    }
    const user = JSON.parse(data.userJson);
    await chrome.runtime.sendMessage({
        type: MSG.AUTH_SYNC,
        token: data.token,
        apiBase: data.apiBase,
        user,
    });
    if (!includeTimer)
        return;
    const timerRaw = data.timerRaw;
    if (lastTimerRaw === undefined || timerRaw !== lastTimerRaw) {
        lastTimerRaw = timerRaw;
        const timer = timerRaw ? payloadFromPageStorage(timerRaw, user.id) : null;
        await chrome.runtime.sendMessage({
            type: MSG.TIMER_SYNC_FROM_PAGE,
            userId: user.id,
            payload: timer,
        });
    }
}

async function syncTimerFromPage(): Promise<void> {
    const data = await readFromPage();
    if (!data.token || !data.userJson)
        return;
    const user = JSON.parse(data.userJson);
    const timerRaw = data.timerRaw;
    if (timerRaw === lastTimerRaw)
        return;
    lastTimerRaw = timerRaw;
    const timer = timerRaw ? payloadFromPageStorage(timerRaw, user.id) : null;
    await chrome.runtime.sendMessage({
        type: MSG.TIMER_SYNC_FROM_PAGE,
        userId: user.id,
        payload: timer,
    });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === MSG.TIMER_PUSH) {
        const payload = message.payload ?? null;
        writeTimerToPage(message.userId as number, payload);
        lastTimerRaw = payload ? toPageStoragePayload(payload) : null;
        sendResponse({ ok: true });
        return;
    }
    return false;
});

function injectPageListeners(): void {
    const script = document.createElement('script');
    script.textContent = `
(function(){
  var prefix = ${JSON.stringify(TT_TIMER_LS_PREFIX)};
  var notify = function() {
    window.postMessage({ type: 'kl-tt-page-timer-changed' }, '*');
  };
  window.addEventListener('storage', function(e) {
    if (e.key && e.key.indexOf(prefix) === 0) notify();
  });
  window.addEventListener('tt:timer-storage-changed', notify);
})();
    `;
    (document.documentElement || document.head).appendChild(script);
    script.remove();
}

window.addEventListener('message', (ev) => {
    if (ev.source !== window || ev.data?.type !== 'kl-tt-page-timer-changed')
        return;
    void syncTimerFromPage();
});

injectPageListeners();
void syncAuthFromPage(true);

const AUTH_FALLBACK_MS = 30_000;
setInterval(() => {
    if (document.visibilityState !== 'visible')
        return;
    void syncAuthFromPage(false);
}, AUTH_FALLBACK_MS);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
        void syncAuthFromPage(false);
});

export {};
