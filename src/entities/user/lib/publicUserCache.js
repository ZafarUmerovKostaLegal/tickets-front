import { getUsersPublic } from '../publicApi';
const TTL_MS = 5 * 60 * 1000;
const MISSING_TTL_MS = 60 * 1000;
const cache = new Map();
const inflight = new Map();
const listeners = new Set();
function now() {
    return Date.now();
}
function isFresh(entry) {
    if (!entry)
        return false;
    return entry.expiresAt > now();
}
function notify() {
    for (const fn of listeners)
        fn();
}
export function subscribePublicUserCache(fn) {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}
export function getCachedPublicUser(userId) {
    const e = cache.get(userId);
    if (!e || !isFresh(e))
        return undefined;
    return e.user;
}
export function primePublicUserCache(users) {
    if (users.length === 0)
        return;
    const expiresAt = now() + TTL_MS;
    for (const u of users)
        cache.set(u.id, { user: u, expiresAt });
    notify();
}
export function markPublicUserMissing(userIds) {
    if (userIds.length === 0)
        return;
    const expiresAt = now() + MISSING_TTL_MS;
    for (const id of userIds) {
        if (!Number.isFinite(id) || id <= 0)
            continue;
        cache.set(id, { user: null, expiresAt });
    }
    notify();
}
export function invalidatePublicUserCache(userIds) {
    if (!userIds) {
        cache.clear();
        notify();
        return;
    }
    for (const id of userIds)
        cache.delete(id);
    notify();
}
function collectMissing(userIds) {
    const out = [];
    const seen = new Set();
    for (const raw of userIds) {
        const id = Number(raw);
        if (!Number.isFinite(id) || id <= 0)
            continue;
        if (seen.has(id))
            continue;
        seen.add(id);
        const e = cache.get(id);
        if (isFresh(e))
            continue;
        if (inflight.has(id))
            continue;
        out.push(id);
    }
    return out;
}
export async function ensurePublicUsersLoaded(userIds) {
    const toLoad = collectMissing(userIds);
    const waiting = new Set();
    for (const id of userIds) {
        const pending = inflight.get(Number(id));
        if (pending)
            waiting.add(pending);
    }
    if (toLoad.length === 0) {
        if (waiting.size > 0)
            await Promise.allSettled(waiting);
        return;
    }
    const job = (async () => {
        try {
            const res = await getUsersPublic(toLoad, true);
            primePublicUserCache(res.items);
            if (res.missing_ids.length > 0)
                markPublicUserMissing(res.missing_ids);
        }
        catch {
        }
    })();
    for (const id of toLoad)
        inflight.set(id, job);
    waiting.add(job);
    try {
        await Promise.allSettled(waiting);
    }
    finally {
        for (const id of toLoad)
            inflight.delete(id);
    }
}
export async function loadPublicUsersByIds(userIds) {
    await ensurePublicUsersLoaded(userIds);
    const out = new Map();
    for (const raw of userIds) {
        const id = Number(raw);
        const e = cache.get(id);
        if (e?.user)
            out.set(id, e.user);
    }
    return out;
}
