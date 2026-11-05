import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { listTimeTrackingTeams, listTimeTrackingUsers } from '@entities/time-tracking';
import { listAllClientProjectsMerged, type TimeManagerClientProjectRow } from '@entities/time-tracking/api/domains/projects';
import type { TimeTrackingTeamRow } from '@entities/time-tracking/api/domains/teamsAndLabor';
import type { TimeTrackingUserRow } from '@entities/time-tracking/api/domains/usersAndRates';
import { readProjectParticipantAuthUserIds, readProjectPartnerAuthUserIds } from '@entities/time-tracking/lib/partnerReportProjectScope';
import { useCurrentUser } from '@shared/hooks';
import { canAssignLegalHubTask, legalHubPositionRank } from './legalHubRank';

export type LegalHubPerson = {
    id: number;
    name: string;
    code: string;
    position: string;
    rank: number;
};

export type LegalHubProject = {
    id: string;
    name: string;
    /** Users who may open the project: partners and participants. */
    accessIds: number[];
};

type LegalHubViewValue = {
    people: LegalHubPerson[];
    staff: LegalHubPerson[];
    me: LegalHubPerson | null;
    memberIds: number[];
    projects: LegalHubProject[];
    userId: number | null;
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

function collectStaff(
    teams: TimeTrackingTeamRow[],
    users: TimeTrackingUserRow[],
    self: { id: number; name: string; position: string; role: string | null; initials?: string | null },
): LegalHubPerson[] {
    const usersById = new Map(users.map((row) => [row.id, row]));
    const related = teams.filter((team) => !team.is_archived && (
        team.partner_auth_user_id === self.id || memberIdsOf(team).includes(self.id)
    ));
    const ids = new Set<number>([self.id]);
    for (const team of related) {
        if (team.partner_auth_user_id > 0)
            ids.add(team.partner_auth_user_id);
        for (const id of memberIdsOf(team)) {
            if (Number.isFinite(id) && id > 0)
                ids.add(id);
        }
    }
    const people: LegalHubPerson[] = [];
    for (const id of ids) {
        const row = usersById.get(id);
        const preview = related.flatMap((team) => team.members ?? []).find((member) => member.auth_user_id === id);
        const isSelf = id === self.id;
        const name = ((isSelf ? self.name : '') || row?.display_name || preview?.display_name || row?.email || preview?.email || '').trim() || String(id);
        const position = ((isSelf ? self.position : '') || row?.position || '').trim();
        const role = (isSelf ? self.role : null) || row?.role || null;
        people.push({
            id,
            name,
            code: personCode(name, isSelf ? self.initials : row?.initials),
            position,
            rank: legalHubPositionRank(position, role),
        });
    }
    people.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'ru'));
    return people;
}

function projectsOfTeam(rows: TimeManagerClientProjectRow[], partnerId: number, memberIds: number[]): LegalHubProject[] {
    const team = new Set([partnerId, ...memberIds]);
    const projects: LegalHubProject[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
        const id = row.id.trim();
        if (!id || seen.has(id))
            continue;
        const people = [...readProjectPartnerAuthUserIds(row), ...readProjectParticipantAuthUserIds(row)];
        if (!people.some((personId) => team.has(personId)))
            continue;
        seen.add(id);
        const name = row.name.trim() || id;
        const accessIds = [...new Set([...readProjectPartnerAuthUserIds(row), ...readProjectParticipantAuthUserIds(row)])];
        projects.push({ id, name, accessIds });
    }
    projects.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return projects;
}

export function LegalHubViewProvider({ children }: { children: ReactNode }) {
    const { user, loading } = useCurrentUser();
    const userId = user?.id ?? null;
    const [people, setPeople] = useState<LegalHubPerson[]>([]);
    const [staff, setStaff] = useState<LegalHubPerson[]>([]);
    const [me, setMe] = useState<LegalHubPerson | null>(null);
    const [projects, setProjects] = useState<LegalHubProject[]>([]);
    const [viewAsId, setViewAsId] = useState<number | null>(null);

    useEffect(() => {
        if (loading)
            return undefined;
        if (userId == null || user == null) {
            setPeople([]);
            setStaff([]);
            setMe(null);
            setProjects([]);
            return undefined;
        }
        const self = {
            id: userId,
            name: (user.display_name || user.email || '').trim() || String(userId),
            position: (user.position ?? '').trim(),
            role: user.role ?? null,
            initials: user.initials,
        };
        let cancelled = false;
        void (async () => {
            try {
                const [teams, users, projectRows] = await Promise.all([
                    listTimeTrackingTeams().catch(() => [] as TimeTrackingTeamRow[]),
                    listTimeTrackingUsers().catch(() => [] as TimeTrackingUserRow[]),
                    listAllClientProjectsMerged(false).catch(() => [] as TimeManagerClientProjectRow[]),
                ]);
                if (cancelled)
                    return;
                const roster = collectStaff(teams, users, self);
                const actor = roster.find((person) => person.id === userId) ?? roster[0] ?? null;
                setStaff(roster);
                setMe(actor);
                setPeople(actor == null ? [] : roster.filter((person) => person.id !== actor.id && canAssignLegalHubTask(actor, person)));
                setProjects(projectsOfTeam(projectRows, userId, roster.filter((person) => person.id !== userId).map((person) => person.id)));
            }
            catch {
                if (!cancelled) {
                    setPeople([]);
                    setStaff([]);
                    setMe(null);
                    setProjects([]);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [loading, user, userId]);

    useEffect(() => {
        if (viewAsId != null && !people.some((person) => person.id === viewAsId))
            setViewAsId(null);
    }, [people, viewAsId]);

    const value = useMemo<LegalHubViewValue>(() => {
        const viewAs = people.find((person) => person.id === viewAsId) ?? null;
        return {
            people,
            staff,
            me,
            memberIds: staff.map((person) => person.id),
            projects,
            userId,
            viewAs,
            setViewAsId,
        };
    }, [me, people, projects, staff, userId, viewAsId]);

    return <LegalHubViewContext.Provider value={value}>{children}</LegalHubViewContext.Provider>;
}

export function useLegalHubView(): LegalHubViewValue {
    const value = useContext(LegalHubViewContext);
    if (value == null)
        throw new Error('useLegalHubView must be used within LegalHubViewProvider');
    return value;
}
