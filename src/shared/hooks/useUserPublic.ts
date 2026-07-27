import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { ensurePublicUsersLoaded, getCachedPublicUser, subscribePublicUserCache } from '@entities/user/lib/publicUserCache';
import type { UserPublic } from '@entities/user/model/publicTypes';

function buildSnapshot(ids: readonly number[]): Map<number, UserPublic> {
    const out = new Map<number, UserPublic>();
    for (const id of ids) {
        const u = getCachedPublicUser(id);
        if (u)
            out.set(id, u);
    }
    return out;
}

function snapshotEqual(a: Map<number, UserPublic>, b: Map<number, UserPublic>): boolean {
    if (a === b)
        return true;
    if (a.size !== b.size)
        return false;
    for (const [k, v] of a) {
        const o = b.get(k);
        if (o !== v)
            return false;
    }
    return true;
}

export function useUserPublic(ids: readonly number[]): Map<number, UserPublic> {
    const normalizedIds = useMemo(() => {
        const seen = new Set<number>();
        const out: number[] = [];
        for (const raw of ids) {
            const id = Number(raw);
            if (!Number.isFinite(id) || id <= 0)
                continue;
            if (seen.has(id))
                continue;
            seen.add(id);
            out.push(id);
        }
        out.sort((a, b) => a - b);
        return out;
    }, [ids]);

    const idsKey = normalizedIds.join(',');

    useEffect(() => {
        if (normalizedIds.length === 0)
            return;
        let cancelled = false;
        void ensurePublicUsersLoaded(normalizedIds).then(() => {
            if (cancelled)
                return;
        });
        return () => {
            cancelled = true;
        };
    }, [idsKey, normalizedIds]);

    const snapshotRef = useRef<Map<number, UserPublic>>(new Map());
    const lastIdsKeyRef = useRef<string>('');

    const getSnapshot = useMemo(() => {
        return () => {
            const fresh = buildSnapshot(normalizedIds);
            if (lastIdsKeyRef.current === idsKey && snapshotEqual(snapshotRef.current, fresh))
                return snapshotRef.current;
            snapshotRef.current = fresh;
            lastIdsKeyRef.current = idsKey;
            return fresh;
        };
    }, [idsKey, normalizedIds]);

    return useSyncExternalStore(subscribePublicUserCache, getSnapshot, getSnapshot);
}
