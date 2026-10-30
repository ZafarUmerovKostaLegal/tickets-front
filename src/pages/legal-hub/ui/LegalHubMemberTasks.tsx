import { useEffect, useMemo, useState } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { listTimeTrackingTeams, listTimeTrackingUsers } from '@entities/time-tracking';
import { isForbiddenError } from '@entities/time-tracking/api/domains/httpShared';
import type { TimeTrackingTeamRow } from '@entities/time-tracking/api/domains/teamsAndLabor';
import type { TimeTrackingUserRow } from '@entities/time-tracking/api/domains/usersAndRates';
import { getLegalHubMemberReportsUrl, getLegalHubMemberUrl, routes } from '@shared/config';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { AppBackButton } from '@shared/ui';
import { tasksForMember } from './legalHubTasks';
import { LegalHubMemberStats } from './LegalHubMemberStats';
import { LegalHubTaskTable } from './LegalHubTaskTable';

export type LegalHubMemberLocationState = {
    name: string;
    code: string;
    memberIds: number[];
    capacity?: string;
};

type RosterPerson = { id: number; name: string; code: string; capacity: string };

function capacityText(raw: string | number | null | undefined): string {
    if (raw == null || raw === '')
        return '';
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0)
        return '';
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

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

function rosterOf(teams: TimeTrackingTeamRow[], users: TimeTrackingUserRow[], userId: number): RosterPerson[] {
    const usersById = new Map(users.map((row) => [row.id, row]));
    return teams
        .filter((team) => !team.is_archived && team.partner_auth_user_id === userId)
        .flatMap((team) => {
            const ids = team.member_auth_user_ids.length > 0
                ? team.member_auth_user_ids
                : (team.members ?? []).map((member) => member.auth_user_id);
            return ids.map((id) => {
                const row = usersById.get(id);
                const preview = team.members?.find((member) => member.auth_user_id === id);
                const name = (row?.display_name || preview?.display_name || row?.email || preview?.email || '').trim() || String(id);
                return { id, name, code: personCode(name, row?.initials), capacity: capacityText(row?.weekly_capacity_hours) };
            });
        });
}

function readMemberState(state: unknown, memberId: number): LegalHubMemberLocationState | null {
    if (state == null || typeof state !== 'object')
        return null;
    const row = state as Partial<LegalHubMemberLocationState>;
    if (typeof row.name !== 'string' || typeof row.code !== 'string' || !Array.isArray(row.memberIds))
        return null;
    if (!row.memberIds.every((id) => typeof id === 'number') || !row.memberIds.includes(memberId))
        return null;
    return {
        name: row.name,
        code: row.code,
        memberIds: row.memberIds,
        capacity: typeof row.capacity === 'string' ? row.capacity : undefined,
    };
}

export function LegalHubMemberTasks({ memberId, query }: { memberId: number; query: string }) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const location = useLocation();
    const reports = useMatch(routes.legalHubMemberReports) != null;
    const { user, loading: userLoading } = useCurrentUser();
    const carried = useMemo(() => readMemberState(location.state, memberId), [location.state, memberId]);
    const [roster, setRoster] = useState<RosterPerson[] | null>(null);
    const [error, setError] = useState<'forbidden' | 'load' | null>(null);
    const [ready, setReady] = useState(carried != null);

    useEffect(() => {
        if (carried != null || userLoading || user == null)
            return;
        let cancelled = false;
        setReady(false);
        setError(null);
        void (async () => {
            try {
                const [teams, users] = await Promise.all([
                    listTimeTrackingTeams(),
                    listTimeTrackingUsers().catch(() => [] as TimeTrackingUserRow[]),
                ]);
                if (cancelled)
                    return;
                setRoster(rosterOf(teams, users, user.id));
                setReady(true);
            }
            catch (err) {
                if (cancelled)
                    return;
                setRoster([]);
                setError(isForbiddenError(err) ? 'forbidden' : 'load');
                setReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [carried, user, userLoading]);

    const goBack = () => {
        navigate(routes.legalHub, { state: { section: 'allTeam' } });
    };
    const openPane = (pane: 'stats' | 'reports') => {
        const url = pane === 'reports' ? getLegalHubMemberReportsUrl(memberId) : getLegalHubMemberUrl(memberId);
        navigate(url, { state: location.state });
    };
    const found = roster?.find((member) => member.id === memberId) ?? null;
    const owner = carried
        ? { name: carried.name, code: carried.code }
        : found
            ? { name: found.name, code: found.code }
            : null;
    const memberIds = carried?.memberIds ?? roster?.map((member) => member.id) ?? [];

    const capacity = carried?.capacity || found?.capacity || '';
    const tasks = owner == null ? [] : tasksForMember(memberId, memberIds);

    return (
        <div className="lh-member-page">
            <div className="lh-member-page__bar">
                <AppBackButton onClick={goBack} />
                <div className="lh-view" role="group" aria-label={t('legalHub.viewAria')}>
                    <button type="button" className={reports ? '' : 'is-active'} aria-pressed={!reports} onClick={() => openPane('stats')}>
                        {t('legalHub.memberStats')}
                    </button>
                    <button type="button" className={reports ? 'is-active' : ''} aria-pressed={reports} onClick={() => openPane('reports')}>
                        {t('legalHub.memberReports')}
                    </button>
                </div>
            </div>
            {!ready && owner == null ? <p className="lh-team__note">{t('legalHub.teamLoading')}</p> : null}
            {ready && error && owner == null ? (
                <p className="lh-team__note">{error === 'forbidden' ? t('legalHub.teamForbidden') : t('legalHub.teamError')}</p>
            ) : null}
            {ready && !error && owner == null ? <p className="lh-team__note">{t('legalHub.memberMissing')}</p> : null}
            {owner != null && !reports ? (
                <LegalHubMemberStats
                    memberId={memberId}
                    name={owner.name}
                    code={owner.code}
                    capacity={capacity}
                    tasks={tasks}
                />
            ) : null}
            {owner != null && reports ? (
                <LegalHubTaskTable
                    key={memberId}
                    query={query}
                    tasks={tasks}
                    owner={owner}
                    title={t('legalHub.memberReportsTitle').replace('{name}', owner.name)}
                />
            ) : null}
        </div>
    );
}
