import { useEffect, useMemo, useState } from 'react';
import { listTimeTrackingTeams, listTimeTrackingUsers } from '@entities/time-tracking';
import { isForbiddenError } from '@entities/time-tracking/api/domains/httpShared';
import type { TimeTrackingTeamRow } from '@entities/time-tracking/api/domains/teamsAndLabor';
import type { TimeTrackingUserRow } from '@entities/time-tracking/api/domains/usersAndRates';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { useCurrentUser } from '@shared/hooks';

type MemberCard = {
    id: number;
    name: string;
    position: string;
    initials: string;
};

const STATUS_ROWS: { key: string; labelKey: TranslationKey; dot: string }[] = [
    { key: 'progress', labelKey: 'legalHub.statusInProgress', dot: 'lh-member__dot--progress' },
    { key: 'wait', labelKey: 'legalHub.statusWaiting', dot: 'lh-member__dot--wait' },
    { key: 'review', labelKey: 'legalHub.statusReview', dot: 'lh-member__dot--review' },
    { key: 'changes', labelKey: 'legalHub.statusChanges', dot: 'lh-member__dot--changes' },
];

function personInitials(name: string, stored?: string | null): string {
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

function memberCards(team: TimeTrackingTeamRow, usersById: Map<number, TimeTrackingUserRow>): MemberCard[] {
    const ids = team.member_auth_user_ids.length > 0
        ? team.member_auth_user_ids
        : (team.members ?? []).map((member) => member.auth_user_id);
    return ids.map((id) => {
        const row = usersById.get(id);
        const preview = team.members?.find((member) => member.auth_user_id === id);
        const name = (row?.display_name || preview?.display_name || row?.email || preview?.email || '').trim() || `Участник ${id}`;
        return {
            id,
            name,
            position: (row?.position ?? '').trim(),
            initials: personInitials(name, row?.initials),
        };
    });
}

function MemberCardView({ member }: { member: MemberCard }) {
    const { t } = useI18n();
    return (
        <article className="lh-member">
            <div className="lh-member__head">
                <span className="lh-member__avatar" aria-hidden>
                    {member.initials}
                    <span className="lh-member__presence" />
                </span>
                <div className="lh-member__id">
                    <h2 className="lh-member__title">{member.name}</h2>
                    <p className="lh-member__sub">{member.position || t('legalHub.memberTasks')}</p>
                    {member.position ? <p className="lh-member__sub">{t('legalHub.memberTasks')}</p> : null}
                </div>
            </div>
            <div className="lh-member__hours">
                <span>{t('legalHub.memberHours')}</span>
                <span className="lh-member__pct">{t('legalHub.memberPercent')}</span>
            </div>
            <div className="lh-member__meter" aria-hidden>
                <span className="lh-member__meter-fill" />
            </div>
            <ul className="lh-member__statuses">
                {STATUS_ROWS.map((row) => (
                    <li key={row.key} className="lh-member__status">
                        <span className={`lh-member__dot ${row.dot}`} aria-hidden />
                        <span>{t(row.labelKey)}</span>
                        <strong>{t('legalHub.memberPercent')}</strong>
                    </li>
                ))}
            </ul>
        </article>
    );
}

export function LegalHubTeamBoard({ query }: { query: string }) {
    const { t } = useI18n();
    const { user, loading: userLoading } = useCurrentUser();
    const userId = user?.id ?? null;
    const [teams, setTeams] = useState<TimeTrackingTeamRow[] | null>(null);
    const [users, setUsers] = useState<TimeTrackingUserRow[]>([]);
    const [error, setError] = useState<'forbidden' | 'load' | null>(null);

    useEffect(() => {
        if (userLoading || userId == null)
            return;
        let cancelled = false;
        setTeams(null);
        setError(null);
        void (async () => {
            try {
                const [teamRows, userRows] = await Promise.all([
                    listTimeTrackingTeams(),
                    listTimeTrackingUsers().catch(() => [] as TimeTrackingUserRow[]),
                ]);
                if (cancelled)
                    return;
                setUsers(userRows);
                setTeams(teamRows);
            }
            catch (err) {
                if (cancelled)
                    return;
                setTeams([]);
                setError(isForbiddenError(err) ? 'forbidden' : 'load');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId, userLoading]);

    const usersById = useMemo(() => new Map(users.map((row) => [row.id, row])), [users]);
    const needle = query.trim().toLowerCase();
    const ledTeams = useMemo(() => {
        if (user == null || teams == null)
            return [];
        return teams.filter((team) => !team.is_archived && team.partner_auth_user_id === user.id);
    }, [teams, user]);

    if (userLoading || (user != null && teams == null && !error))
        return <p className="lh-team__note">{t('legalHub.teamLoading')}</p>;
    if (error)
        return <p className="lh-team__note">{error === 'forbidden' ? t('legalHub.teamForbidden') : t('legalHub.teamError')}</p>;
    if (ledTeams.length === 0)
        return <p className="lh-team__note">{t('legalHub.teamEmpty')}</p>;

    return (
        <div className="lh-team">
            {ledTeams.map((team) => {
                const cards = memberCards(team, usersById).filter((member) => {
                    if (!needle)
                        return true;
                    return `${member.name} ${member.position}`.toLowerCase().includes(needle);
                });
                return (
                    <section key={team.id} className="lh-team__group" aria-label={team.name}>
                        <h2 className="lh-team__name">{team.name}</h2>
                        {cards.length === 0 ? (
                            <p className="lh-team__note">{needle ? t('legalHub.teamNoMatch') : t('legalHub.teamNoMembers')}</p>
                        ) : (
                            <div className="lh-team__grid">
                                {cards.map((member) => <MemberCardView key={member.id} member={member} />)}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
