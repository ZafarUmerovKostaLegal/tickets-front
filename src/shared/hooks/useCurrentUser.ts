import { useSyncExternalStore } from 'react';
import { getMe, invalidatePublicUserCache } from '@entities/user';
import type { User } from '@entities/user';
import { isSessionCookieOnly } from '@shared/config';
import { isTauriAndroidBuild } from '@shared/config/tauriPlatform';
import { getAccessToken, isAuthenticated, setSessionCookieHint } from '@shared/lib/auth';
type UserSnapshot = {
    user: User | null;
    loading: boolean;
    error: Error | null;
};
const initialUserLoading = !(isTauriAndroidBuild() && !isAuthenticated());
let snapshot: UserSnapshot = { user: null, loading: initialUserLoading, error: null };
const listeners = new Set<() => void>();
let inFlight: { authKey: string; promise: Promise<User> } | null = null;
let requestVersion = 0;
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
    requestVersion += 1;
    inFlight = null;
    snapshot = {
        user,
        loading: false,
        error: error ?? null,
    };
    if (user)
        invalidatePublicUserCache([user.id]);
    emit();
}

function currentAuthKey(): string {
    return getAccessToken() ?? 'session-cookie';
}

function startCurrentUserRequest(): Promise<User> {
    const authKey = currentAuthKey();
    if (inFlight?.authKey === authKey)
        return inFlight.promise;

    const version = ++requestVersion;
    snapshot = { ...snapshot, loading: true, error: null };
    emit();

    const promise = getMe()
        .then((data) => {
        if (version !== requestVersion)
            return data;
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
        const error = err instanceof Error ? err : new Error(String(err));
        if (version !== requestVersion)
            throw error;
        snapshot = {
            user: null,
            loading: false,
            error,
        };
        emit();
        throw error;
    })
        .finally(() => {
        if (inFlight?.promise === promise)
            inFlight = null;
    });

    inFlight = { authKey, promise };
    return promise;
}

export function ensureCurrentUserLoaded(): Promise<User> {
    if (snapshot.user)
        return Promise.resolve(snapshot.user);
    if (inFlight)
        return inFlight.promise;
    if (snapshot.error)
        return Promise.reject(snapshot.error);
    return startCurrentUserRequest();
}

export function refreshCurrentUser(): Promise<User | null> {
    return startCurrentUserRequest().catch(() => null);
}
if (initialUserLoading) {
    void ensureCurrentUserLoaded().catch(() => { });
}
export function useCurrentUser(): UserSnapshot {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
