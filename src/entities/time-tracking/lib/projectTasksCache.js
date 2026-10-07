import { listProjectTasks } from '../api';
const DEFAULT_TTL_MS = 60_000;
const cache = new Map();
const inFlight = new Map();
export function projectTasksCacheKey(clientId, projectId) {
    return `${clientId}\x1f${projectId}`;
}
export async function listProjectTasksCached(clientId, projectId, ttlMs = DEFAULT_TTL_MS) {
    const key = projectTasksCacheKey(clientId, projectId);
    const hit = cache.get(key);
    if (hit && Date.now() < hit.expiresAt)
        return hit.tasks;
    let pending = inFlight.get(key);
    if (!pending) {
        pending = listProjectTasks(clientId, projectId)
            .then((tasks) => {
            cache.set(key, { tasks, expiresAt: Date.now() + ttlMs });
            inFlight.delete(key);
            return tasks;
        })
            .catch((e) => {
            inFlight.delete(key);
            throw e;
        });
        inFlight.set(key, pending);
    }
    return pending;
}
export function invalidateProjectTasksCache(clientId, projectId) {
    if (!clientId) {
        cache.clear();
        inFlight.clear();
        return;
    }
    if (!projectId) {
        const prefix = `${clientId}\x1f`;
        for (const key of [...cache.keys()]) {
            if (key.startsWith(prefix))
                cache.delete(key);
        }
        for (const key of [...inFlight.keys()]) {
            if (key.startsWith(prefix))
                inFlight.delete(key);
        }
        return;
    }
    const key = projectTasksCacheKey(clientId, projectId);
    cache.delete(key);
    inFlight.delete(key);
}
