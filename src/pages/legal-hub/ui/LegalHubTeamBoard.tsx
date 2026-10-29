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
    email: string;
    capacity: string;
    initials: string;
};

const STATUS_ROWS: { key: string; labelKey: TranslationKey; dot: string }[] = [
    { key: 'progress', labelKey: 'legalHub.statusInProgress', dot: 'lh-member__dot--progress' },
    { key: 'wait', labelKey: 'legalHub.statusWaiting', dot: 'lh-member__dot--wait' },
    { key: 'review', labelKey: 'legalHub.statusReview', dot: 'lh-member__dot--review' },
    { key: 'changes', labelKey: 'legalHub.statusChanges', dot: 'lh-member__dot--changes' },
    { key: 'reviewing', labelKey: 'legalHub.statusReviewing', dot: 'lh-member__dot--reviewing' },
];

const UTIL_ROWS: { key: string; labelKey: TranslationKey; dot: string }[] = [
    { key: 'progress', labelKey: 'legalHub.statusInProgress', dot: 'lh-member__dot--progress' },
    { key: 'associate', labelKey: 'legalHub.utilAssociateReview', dot: 'lh-member__dot--review' },
    { key: 'partner', labelKey: 'legalHub.utilPartnerReview', dot: 'lh-member__dot--partner' },
    { key: 'wait', labelKey: 'legalHub.statusWaiting', dot: 'lh-member__dot--wait' },
    { key: 'changes', labelKey: 'legalHub.statusChanges', dot: 'lh-member__dot--changes' },
    { key: 'todo', labelKey: 'legalHub.utilTodo', dot: 'lh-member__dot--todo' },
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

function capacityLabel(raw: string | number | null | undefined): string {
    if (raw == null || raw === '')
        return '';
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0)
        return '';
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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
            email: (row?.email || preview?.email || '').trim(),
            capacity: capacityLabel(row?.weekly_capacity_hours),
            initials: personInitials(name, row?.initials),
        };
    });
}

function MemberCardView({ member, tone, selected, onSelect }: {
    member: MemberCard;
    tone: number;
    selected: boolean;
    onSelect: () => void;
}) {
    const { t } = useI18n();
    return (
        <button
            type="button"
            className={`lh-member lh-member--tone-${tone}${selected ? ' lh-member--selected' : ''}`}
            aria-pressed={selected}
            onClick={onSelect}
        >
            <span className="lh-member__head">
                <span className="lh-member__avatar" aria-hidden>{member.initials}</span>
                <span className="lh-member__id">
                    <span className="lh-member__title">{member.name}</span>
                    {member.position ? <span className="lh-member__role">{member.position}</span> : null}
                    {member.email ? <span className="lh-member__email">{member.email}</span> : null}
                </span>
            </span>
            <span className="lh-member__facts">
                <span className="lh-member__fact">
                    <span>{t('legalHub.factTasks')}</span>
                    <strong>{t('legalHub.memberPercent')}</strong>
                </span>
                <span className="lh-member__fact">
                    <span>{t('legalHub.factHours')}</span>
                    <strong>
                        {member.capacity
                            ? t('legalHub.factCapacity').replace('{hours}', member.capacity)
                            : t('legalHub.memberPercent')}
                    </strong>
                </span>
            </span>
            <span className="lh-member__hours">
                <span>{t('legalHub.memberHours')}</span>
                <span className="lh-member__pct">{t('legalHub.memberPercent')}</span>
            </span>
            <span className="lh-member__meter" aria-hidden>
                <span className="lh-member__meter-fill" />
            </span>
            <span className="lh-member__statuses">
                {STATUS_ROWS.map((row) => (
                    <span key={row.key} className="lh-member__status">
                        <span className={`lh-member__dot ${row.dot}`} aria-hidden />
                        <span>{t(row.labelKey)}</span>
                        <strong>{t('legalHub.memberPercent')}</strong>
                    </span>
                ))}
            </span>
        </button>
    );
}

const UTIL_COLLAPSED_KEY = 'lh-util-collapsed';

function IconRailCollapse({ pointRight }: { pointRight: boolean }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {pointRight ? <path d="m9 6 6 6-6 6" /> : <path d="m15 6-6 6 6 6" />}
        </svg>
    );
}

export function LegalHubUtilRail({ mobileOpen, onMobileClose }: {
    mobileOpen: boolean;
    onMobileClose: () => void;
}) {
    const { t } = useI18n();
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem(UTIL_COLLAPSED_KEY) === '1';
        }
        catch {
            return false;
        }
    });
    const toggle = () => {
        setCollapsed((value) => {
            const next = !value;
            try {
                localStorage.setItem(UTIL_COLLAPSED_KEY, next ? '1' : '0');
            }
            catch {
                /* storage can be unavailable */
            }
            return next;
        });
    };
    const collapseLabel = collapsed ? t('legalHub.utilExpand') : t('legalHub.utilCollapse');
    return (
        <>
            {mobileOpen ? (
                <button type="button" className="lh-rail__backdrop" aria-label={t('legalHub.closeMenu')} onClick={onMobileClose} />
            ) : null}
            <aside className={`lh-rail${collapsed ? ' lh-rail--collapsed' : ''}${mobileOpen ? ' lh-rail--open' : ''}`} aria-label={t('legalHub.utilisationTitle')}>
                <div className="lh-rail__head">
                    <h2 className="lh-rail__title">{t('legalHub.utilisationTitle')}</h2>
                </div>
                <div className="lh-rail__body">
                    <div className="lh-util">
                        <div className="lh-util__ring" aria-hidden>
                            <div className="lh-util__hole">
                                <strong>{t('legalHub.memberPercent')}</strong>
                                <span>{t('legalHub.utilEmpty')}</span>
                            </div>
                        </div>
                        <ul className="lh-util__legend">
                            {UTIL_ROWS.map((row) => (
                                <li key={row.key} title={t(row.labelKey)}>
                                    <span className={`lh-member__dot ${row.dot}`} aria-hidden />
                                    <span className="lh-util__label">{t(row.labelKey)}</span>
                                    <strong className="lh-util__value">{t('legalHub.memberPercent')}</strong>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <section className="lh-rail__deadlines" aria-label={t('legalHub.deadlinesTitle')}>
                        <h3 className="lh-rail__section">{t('legalHub.deadlinesTitle')}</h3>
                        <p className="lh-panel__empty">{t('legalHub.deadlinesEmpty')}</p>
                    </section>
                </div>
                <div className="lh-rail__foot">
                    <button
                        type="button"
                        className="lh-side__collapse"
                        aria-expanded={!collapsed}
                        aria-label={collapseLabel}
                        title={collapseLabel}
                        onClick={toggle}
                    >
                        <IconRailCollapse pointRight={!collapsed} />
                        <span className="lh-side__collapse-label">{collapseLabel}</span>
                    </button>
                </div>
            </aside>
        </>
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

    const [selectedId, setSelectedId] = useState<number | null>(null);
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
        <div className="lh-board">
            <div className="lh-board__main">
                <header className="lh-board__head">
                    <h2 className="lh-board__title">{t('legalHub.workloadTitle')}</h2>
                    <p className="lh-board__hint">{t('legalHub.workloadHint')}</p>
                </header>
                {ledTeams.map((team) => {
                    const cards = memberCards(team, usersById).filter((member) => {
                        if (!needle)
                            return true;
                        return `${member.name} ${member.position} ${member.email}`.toLowerCase().includes(needle);
                    });
                    return (
                        <section key={team.id} className="lh-team__group" aria-label={team.name}>
                            <h3 className="lh-team__name">{team.name}</h3>
                            {cards.length === 0 ? (
                                <p className="lh-team__note">{needle ? t('legalHub.teamNoMatch') : t('legalHub.teamNoMembers')}</p>
                            ) : (
                                <div className="lh-team__grid">
                                    {cards.map((member, index) => (
                                        <MemberCardView
                                            key={member.id}
                                            member={member}
                                            tone={index % 4}
                                            selected={selectedId === member.id}
                                            onSelect={() => setSelectedId((current) => (current === member.id ? null : member.id))}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
