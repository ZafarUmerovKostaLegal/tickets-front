import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { listTimeTrackingTeams, listTimeTrackingUsers } from '@entities/time-tracking';
import type { TimeTrackingTeamRow } from '@entities/time-tracking/api/domains/teamsAndLabor';
import type { TimeTrackingUserRow } from '@entities/time-tracking/api/domains/usersAndRates';
import { useCurrentUser } from '@shared/hooks';

export type LegalHubPerson = {
    id: number;
    name: string;
    code: string;
};

type LegalHubViewValue = {
    people: LegalHubPerson[];
    memberIds: number[];
    viewAs: LegalHubPerson | null;
    setViewAsId: (id: number | null) => void;
};

const LegalHubViewContext = createContext<LegalHubViewValue | null>(null);

function personCode(name: string, stored?: string | null): string {
    const ready = stored?.trim();
    if (ready)
        return ready.slice(0, 3).toUpperCase();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function memberIdsOf(team: TimeTrackingTeamRow): number[] {
    return team.member_auth_user_ids.length > 0
        ? team.member_auth_user_ids
        : (team.members ?? []).map((member) => member.auth_user_id);
}

function ledRoster(teams: TimeTrackingTeamRow[], users: TimeTrackingUserRow[], partnerId: number): LegalHubPerson[] {
    const usersById = new Map(users.map((row) => [row.id, row]));
    const seen = new Set<number>();
    const people: LegalHubPerson[] = [];
    for (const team of teams) {
        if (team.is_archived || team.partner_auth_user_id !== partnerId)
            continue;
        for (const id of memberIdsOf(team)) {
            if (!Number.isFinite(id) || id <= 0 || id === partnerId || seen.has(id))
                continue;
            seen.add(id);
            const row = usersById.get(id);
            const preview = team.members?.find((member) => member.auth_user_id === id);
            const name = (row?.display_name || preview?.display_name || row?.email || preview?.email || '').trim() || String(id);
            people.push({ id, name, code: personCode(name, row?.initials) });
        }
    }
    people.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return people;
}

export function LegalHubViewProvider({ children }: { children: ReactNode }) {
    const { user, loading } = useCurrentUser();
    const userId = user?.id ?? null;
    const [people, setPeople] = useState<LegalHubPerson[]>([]);
    const [viewAsId, setViewAsId] = useState<number | null>(null);

    useEffect(() => {
        if (loading)
            return undefined;
        if (userId == null) {
            setPeople([]);
            return undefined;
        }
        let cancelled = false;
        void (async () => {
            try {
                const [teams, users] = await Promise.all([
                    listTimeTrackingTeams(),
                    listTimeTrackingUsers().catch(() => [] as TimeTrackingUserRow[]),
                ]);
                if (!cancelled)
                    setPeople(ledRoster(teams, users, userId));
            }
            catch {
                if (!cancelled)
                    setPeople([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [loading, userId]);

    useEffect(() => {
        if (viewAsId != null && !people.some((person) => person.id === viewAsId))
            setViewAsId(null);
    }, [people, viewAsId]);

    const value = useMemo<LegalHubViewValue>(() => {
        const viewAs = people.find((person) => person.id === viewAsId) ?? null;
        return {
            people,
            memberIds: people.map((person) => person.id),
            viewAs,
            setViewAsId,
        };
    }, [people, viewAsId]);

    return <LegalHubViewContext.Provider value={value}>{children}</LegalHubViewContext.Provider>;
}

export function useLegalHubView(): LegalHubViewValue {
    const value = useContext(LegalHubViewContext);
    if (value == null)
        throw new Error('useLegalHubView must be used within LegalHubViewProvider');
    return value;
}
