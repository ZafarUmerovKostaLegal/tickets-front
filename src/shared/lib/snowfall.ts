import { useCallback, useSyncExternalStore } from 'react';

/** Soft snowfall is offered only to these logins (email local-part). */
const SNOWFALL_LOGINS: ReadonlySet<string> = new Set([
    'zumerov',
]);

const STORAGE_KEY = 'kl.snowfall.disabled';
const CHANGE_EVENT = 'kl:snowfall-pref';

function emailLocalPart(email: string | null | undefined): string {
    const normalized = (email ?? '').trim().toLowerCase();
    if (!normalized)
        return '';
    const at = normalized.indexOf('@');
    return at === -1 ? normalized : normalized.slice(0, at);
}

export function isSnowfallUser(user: { email?: string | null } | null | undefined): boolean {
    const login = emailLocalPart(user?.email);
    return login.length > 0 && SNOWFALL_LOGINS.has(login);
}

function readEnabled(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) !== '1';
    }
    catch {
        return true;
    }
}

function subscribe(onChange: () => void): () => void {
    const onStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY)
            onChange();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(CHANGE_EVENT, onChange);
    };
}

export function setSnowfallEnabled(enabled: boolean): void {
    try {
        if (enabled)
            localStorage.removeItem(STORAGE_KEY);
        else
            localStorage.setItem(STORAGE_KEY, '1');
    }
    catch {
        /* storage unavailable — the choice just won't persist */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** User's on/off preference for the snowfall effects (on by default). */
export function useSnowfallPreference(): [enabled: boolean, setEnabled: (enabled: boolean) => void] {
    const enabled = useSyncExternalStore(subscribe, readEnabled, () => true);
    const setEnabled = useCallback((next: boolean) => setSnowfallEnabled(next), []);
    return [enabled, setEnabled];
}
