import { useCallback, useMemo } from 'react';
import { listContactsColleagues } from '@entities/contacts';
import { listTimeTrackingUsers, resolveTimeUserDisplayName, type TimeTrackingUserRow } from '@entities/time-tracking';
import { useLoad } from '../ui/fmShared';

export type PeopleNames = {
    users: TimeTrackingUserRow[];
    nameOf: (userId: number, raw?: string | null) => string;
    positionOf: (userId: number, raw?: string | null) => string;
};

/** Real people names: time tracking first, then the colleagues directory; stub emails never shown. */
export function usePeopleNames(fallbackTemplate: string): PeopleNames {
    const catalog = useLoad(() => listTimeTrackingUsers(), []);
    const colleagues = useLoad(() => listContactsColleagues().catch(() => [] as TimeTrackingUserRow[]), []);
    const byCatalog = useMemo(() => new Map((catalog.data ?? []).map((user) => [user.id, user])), [catalog.data]);
    const byColleague = useMemo(() => new Map((colleagues.data ?? []).map((user) => [user.id, user])), [colleagues.data]);
    const users = useMemo(() => catalog.data ?? [], [catalog.data]);

    const nameOf = useCallback((userId: number, raw?: string | null) => resolveTimeUserDisplayName({
        catalog: byCatalog.get(userId),
        colleague: byColleague.get(userId),
        member: { display_name: raw ?? null },
    }, userId, fallbackTemplate), [byCatalog, byColleague, fallbackTemplate]);

    const positionOf = useCallback((userId: number, raw?: string | null) => (
        (raw ?? '').trim() || (byCatalog.get(userId)?.position ?? '').trim() || (byColleague.get(userId)?.position ?? '').trim()
    ), [byCatalog, byColleague]);

    return { users, nameOf, positionOf };
}
