import { useSyncExternalStore } from 'react';
import { getMe, invalidatePublicUserCache } from '@entities/user';
import type { User } from '@entities/user';
import { isSessionCookieOnly } from '@shared/config';
import { isTauriAndroidBuild } from '@shared/config/tauriPlatform';
import { isAuthenticated, setSessionCookieHint } from '@shared/lib/auth';
type UserSnapshot = {
    user: User | null;
    loading: boolean;
    error: Error | null;
};
const initialUserLoading = !(isTauriAndroidBuild() && !isAuthenticated());
let snapshot: UserSnapshot = { user: null, loading: initialUserLoading, error: null };
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;
function emit() {
    for (const fn of listeners)
        fn();
}
function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
}
function getSnapshot(): UserSnapshot {
    return snapshot;
}
export function setCachedUser(user: User | null, error?: Error | null): void {
    snapshot = {
        user,
        loading: false,
        error: error ?? null,
    };
    if (user)
        invalidatePublicUserCache([user.id]);
    emit();
}
export function refreshCurrentUser(): Promise<User | null> {
    inFlight = null;
    return getMe()
        .then((data) => {
        if (isSessionCookieOnly() && data) {
            setSessionCookieHint(true);
        }
        snapshot = { user: data, loading: false, error: null };
        if (data)
            invalidatePublicUserCache([data.id]);
        emit();
        return data;
    })
        .catch((err) => {
        snapshot = {
            user: null,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
        };
        emit();
        return null;
    });
}
function ensureUserLoaded() {
    if (snapshot.user || snapshot.error)
        return;
    if (inFlight)
        return;
    inFlight = getMe()
        .then((data) => {
        if (isSessionCookieOnly() && data) {
            setSessionCookieHint(true);
        }
        snapshot = { user: data, loading: false, error: null };
    })
        .catch((err) => {
        snapshot = { user: null, loading: false, error: err instanceof Error ? err : new Error(String(err)) };
    })
        .finally(() => {
        inFlight = null;
        emit();
    });
}
if (initialUserLoading) {
    ensureUserLoaded();
}
export function useCurrentUser(): UserSnapshot {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
