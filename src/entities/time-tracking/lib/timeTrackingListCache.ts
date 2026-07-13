const DEFAULT_TTL_MS = 60_000;

type CacheSlot<T> = {
    key: string;
    data: T;
    expiresAt: number;
};

function readSlot<T>(slot: CacheSlot<T> | null, key: string): T | null {
    if (!slot || slot.key !== key)
        return null;
    if (Date.now() >= slot.expiresAt)
        return null;
    return slot.data;
}

function writeSlot<T>(data: T, key: string, ttlMs: number): CacheSlot<T> {
    return { key, data, expiresAt: Date.now() + ttlMs };
}

let clientsMergedCache: CacheSlot<unknown> | null = null;
let projectsMergedCache: CacheSlot<unknown> | null = null;
let projectsPickerCache: CacheSlot<unknown> | null = null;

export function getTimeTrackingCached<T>(kind: 'clients' | 'projects' | 'picker', key: string): T | null {
    const slot = kind === 'clients'
        ? clientsMergedCache
        : kind === 'projects'
            ? projectsMergedCache
            : projectsPickerCache;
    return readSlot(slot as CacheSlot<T> | null, key);
}

export function setTimeTrackingCached<T>(
    kind: 'clients' | 'projects' | 'picker',
    key: string,
    data: T,
    ttlMs = DEFAULT_TTL_MS,
): void {
    const slot = writeSlot(data, key, ttlMs);
    if (kind === 'clients')
        clientsMergedCache = slot;
    else if (kind === 'projects')
        projectsMergedCache = slot;
    else
        projectsPickerCache = slot;
}

export function invalidateTimeTrackingListCache(): void {
    clientsMergedCache = null;
    projectsMergedCache = null;
    projectsPickerCache = null;
}
