import { deleteChatPushSubscription, fetchChatPushConfig, saveChatPushSubscription } from '../api';
import { chatWindowIsInFront } from './chatNotificationSession';

const SW_URL = '/chat-sw.js';
let gestureBound = false;
let subscribeInFlight: Promise<void> | null = null;

function sameApplicationServerKey(subscription: PushSubscription, next: Uint8Array): boolean {
    const current = subscription.options?.applicationServerKey;
    if (!current)
        return true;
    const bytes = new Uint8Array(current);
    if (bytes.length !== next.length)
        return false;
    for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] !== next[i])
            return false;
    }
    return true;
}

function urlBase64ToUint8Array(value: string): Uint8Array {
    const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++)
        out[i] = raw.charCodeAt(i);
    return out;
}

function pushSupported(): boolean {
    return typeof window !== 'undefined'
        && window.isSecureContext
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
}

async function subscribeGranted(): Promise<void> {
    if (subscribeInFlight)
        return subscribeInFlight;
    subscribeInFlight = subscribeGrantedNow().finally(() => {
        subscribeInFlight = null;
    });
    return subscribeInFlight;
}

let swReadyPromise: Promise<ServiceWorkerRegistration> | null = null;

function serviceWorkerReady(): Promise<ServiceWorkerRegistration> {
    if (!swReadyPromise) {
        swReadyPromise = navigator.serviceWorker.register(SW_URL, { scope: '/' })
            .then(() => navigator.serviceWorker.ready)
            .catch((error: unknown) => {
                swReadyPromise = null;
                throw error;
            });
    }
    return swReadyPromise;
}

async function registrationReady(): Promise<ServiceWorkerRegistration> {
    return serviceWorkerReady();
}

export function showChatOsNotification(input: {
    roomId: number;
    title: string;
    body: string;
}): void {
    if (!pushSupported() || Notification.permission !== 'granted')
        return;
    if (chatWindowIsInFront())
        return;
    const payload = {
        type: 'show-chat-notification',
        title: input.title,
        body: input.body,
        roomId: input.roomId,
        url: `/kosta-daily?room=${input.roomId}`,
    };
    void serviceWorkerReady()
        .then((registration) => {
            registration.active?.postMessage(payload);
        })
        .catch(() => undefined);
}

async function subscribeGrantedNow(): Promise<void> {
    const registration = await registrationReady();
    const config = await fetchChatPushConfig().catch(() => ({ enabled: false, publicKey: '' }));
    if (!config.enabled || !config.publicKey)
        return;
    let existing = await registration.pushManager.getSubscription();
    const applicationServerKey = urlBase64ToUint8Array(config.publicKey);
    if (existing && !sameApplicationServerKey(existing, applicationServerKey)) {
        await existing.unsubscribe();
        existing = null;
    }
    const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.slice(),
    });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
        return;
    await saveChatPushSubscription(json);
}

export async function ensureChatBrowserPush(): Promise<void> {
    if (!pushSupported())
        return;
    if (Notification.permission === 'denied')
        return;
    if (Notification.permission === 'granted') {
        try {
            await subscribeGranted();
        } catch {
            /* Push setup must not break the open app. */
        }
        return;
    }
    if (gestureBound)
        return;
    gestureBound = true;
    const ask = () => {
        document.removeEventListener('pointerdown', ask);
        void Notification.requestPermission()
            .then((permission) => {
                if (permission === 'granted')
                    return subscribeGranted();
                return undefined;
            })
            .catch(() => undefined);
    };
    document.addEventListener('pointerdown', ask, { once: true });
}

export async function disableChatBrowserPush(): Promise<void> {
    if (!pushSupported())
        return;
    const registration = await navigator.serviceWorker.getRegistration(SW_URL);
    const subscription = await registration?.pushManager.getSubscription();
    const endpoint = subscription?.endpoint;
    if (endpoint) {
        try {
            await deleteChatPushSubscription(endpoint);
        } catch {
            /* Logout still continues if the server is unreachable. */
        }
    }
    try {
        await subscription?.unsubscribe();
    } catch {
        /* Local unsubscribe is best-effort. */
    }
}
