import { useEffect, useMemo, useState, type JSX } from 'react';
import { listTimeTrackingTeams, listTimeTrackingUsers } from '@entities/time-tracking';
import { isForbiddenError } from '@entities/time-tracking/api/domains/httpShared';
import type { TimeTrackingTeamRow } from '@entities/time-tracking/api/domains/teamsAndLabor';
import type { TimeTrackingUserRow } from '@entities/time-tracking/api/domains/usersAndRates';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { useCurrentUser } from '@shared/hooks';
import { fallbackSlices, mockMemberLoad, slicesFromUtil, sumUtil, teamStats, useLegalHubMock, type MemberLoad, type UtilKey, type UtilSlice } from './legalHubMock';

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

function formatHours(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const STATUS_FIELD: Record<string, keyof MemberLoad['statuses']> = {
    progress: 'progress',
    wait: 'wait',
    review: 'review',
    changes: 'changes',
    reviewing: 'reviewing',
};

function MemberCardView({ member, load, tone, selected, onSelect }: {
    member: MemberCard;
    load: MemberLoad;
    tone: number;
    selected: boolean;
    onSelect: () => void;
}) {
    const { t } = useI18n();
    const hours = t('legalHub.memberHours')
        .replace('{used}', formatHours(load.hoursUsed))
        .replace('{cap}', formatHours(load.hoursCap));
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
                    <strong>{load.tasks}</strong>
                </span>
                <span className="lh-member__fact">
                    <span>{t('legalHub.factHours')}</span>
                    <strong>{formatHours(load.hoursUsed)}</strong>
                </span>
            </span>
            <span className="lh-member__hours">
                <span>{hours}</span>
                <span className="lh-member__pct">{load.percent}%</span>
            </span>
            <span className="lh-member__meter" aria-hidden>
                <span className="lh-member__meter-fill" style={{ width: `${load.percent}%` }} />
            </span>
            <span className="lh-member__statuses">
                {STATUS_ROWS.map((row) => (
                    <span key={row.key} className="lh-member__status">
                        <span className={`lh-member__dot ${row.dot}`} aria-hidden />
                        <span>{t(row.labelKey)}</span>
                        <strong>{load.statuses[STATUS_FIELD[row.key] ?? 'progress']}</strong>
                    </span>
                ))}
            </span>
        </button>
    );
}

const UTIL_LABEL: Record<UtilKey, TranslationKey> = {
    progress: 'legalHub.statusInProgress',
    associate: 'legalHub.utilAssociateReview',
    partner: 'legalHub.utilPartnerReview',
    wait: 'legalHub.statusWaiting',
    changes: 'legalHub.statusChanges',
    todo: 'legalHub.utilTodo',
};

const MOCK_DEADLINES: { title: TranslationKey; when: TranslationKey; tone: 'hot' | 'soon' | 'calm' }[] = [
    { title: 'legalHub.mockDeadline1', when: 'legalHub.mockWhenToday', tone: 'hot' },
    { title: 'legalHub.mockDeadline2', when: 'legalHub.mockWhenTomorrow', tone: 'soon' },
    { title: 'legalHub.mockDeadline3', when: 'legalHub.mockWhenFriday', tone: 'calm' },
    { title: 'legalHub.mockDeadline4', when: 'legalHub.mockWhenMonday', tone: 'calm' },
];

const DONUT_R = 40;
const DONUT_C = 2 * Math.PI * DONUT_R;
const DONUT_GAP = 2.4;

function sliceShares(slices: UtilSlice[]): number[] {
    const total = slices.reduce((acc, slice) => acc + slice.count, 0);
    if (total <= 0)
        return slices.map(() => 0);
    const raw = slices.map((slice) => (slice.count / total) * 100);
    const shares = raw.map((value) => Math.floor(value));
    let left = 100 - shares.reduce((acc, value) => acc + value, 0);
    const order = raw
        .map((value, index) => ({ index, frac: value - (shares[index] ?? 0) }))
        .sort((a, b) => b.frac - a.frac);
    for (const item of order) {
        if (left <= 0)
            break;
        shares[item.index] = (shares[item.index] ?? 0) + 1;
        left -= 1;
    }
    return shares;
}

function donutArcs(slices: UtilSlice[]) {
    const drawn = slices.filter((slice) => slice.count > 0);
    const total = drawn.reduce((acc, slice) => acc + slice.count, 0);
    if (total <= 0)
        return [];
    let cursor = 0;
    return drawn.map((slice) => {
        const sweep = (slice.count / total) * DONUT_C;
        const len = Math.max(sweep - DONUT_GAP, 0.8);
        const arc = { ...slice, len, offset: cursor + (sweep - len) / 2 };
        cursor += sweep;
        return arc;
    });
}

function UtilChart({ slices, caption }: { slices: UtilSlice[]; caption: string }) {
    const { t } = useI18n();
    const [pinned, setPinned] = useState<UtilKey | null>(null);
    const [hover, setHover] = useState<UtilKey | null>(null);
    const active = hover ?? pinned;
    const total = slices.reduce((acc, slice) => acc + slice.count, 0);
    const shares = sliceShares(slices);
    const activeSlice = slices.find((slice) => slice.key === active) ?? null;
    const share = activeSlice != null && total > 0 ? Math.round((activeSlice.count / total) * 100) : null;
    const toggle = (key: UtilKey) => setPinned((current) => (current === key ? null : key));
    return (
        <div className="lh-util">
            <div className="lh-util__ring">
                <svg viewBox="0 0 120 120" className={`lh-util__chart${active ? ' lh-util__chart--focus' : ''}`} role="group" aria-label={t('legalHub.utilisationTitle')}>
                    {donutArcs(slices).map((arc) => (
                        <circle
                            key={arc.key}
                            className={`lh-util__seg lh-util__seg--${arc.key}${active && active !== arc.key ? ' is-dim' : ''}${active === arc.key ? ' is-active' : ''}`}
                            cx="60"
                            cy="60"
                            r={DONUT_R}
                            strokeDasharray={`${arc.len} ${DONUT_C - arc.len}`}
                            strokeDashoffset={-arc.offset}
                            transform="rotate(-90 60 60)"
                            role="button"
                            tabIndex={0}
                            aria-pressed={pinned === arc.key}
                            aria-label={`${t(UTIL_LABEL[arc.key])}: ${arc.count}`}
                            onMouseEnter={() => setHover(arc.key)}
                            onMouseLeave={() => setHover(null)}
                            onFocus={() => setHover(arc.key)}
                            onBlur={() => setHover(null)}
                            onClick={() => toggle(arc.key)}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ')
                                    return;
                                event.preventDefault();
                                toggle(arc.key);
                            }}
                        />
                    ))}
                </svg>
                <div className={`lh-util__hole${active ? ` lh-util__hole--${active}` : ''}`}>
                    <strong>{activeSlice ? activeSlice.count : total}</strong>
                    <span>
                        {activeSlice
                            ? `${t(UTIL_LABEL[activeSlice.key])}${share != null ? ` · ${share}%` : ''}`
                            : caption}
                    </span>
                </div>
            </div>
            <ul className="lh-util__legend">
                {slices.map((slice, index) => {
                    const row = UTIL_ROWS.find((item) => item.key === slice.key);
                    const label = t(UTIL_LABEL[slice.key]);
                    const pressed = pinned === slice.key;
                    const share = shares[index] ?? 0;
                    return (
                        <li key={slice.key}>
                            <button
                                type="button"
                                className={active === slice.key ? 'is-active' : ''}
                                aria-pressed={pressed}
                                aria-label={`${label}: ${share}%`}
                                onMouseEnter={() => setHover(slice.key)}
                                onMouseLeave={() => setHover(null)}
                                onFocus={() => setHover(slice.key)}
                                onBlur={() => setHover(null)}
                                onClick={() => toggle(slice.key)}
                            >
                                <span className={`lh-member__dot ${row?.dot ?? ''}`} aria-hidden />
                                <span className={`lh-util__pct lh-util__pct--${slice.key}`} aria-hidden>{share}%</span>
                                <span className="lh-util__label">{label}</span>
                                <strong className="lh-util__value">{slice.count}</strong>
                                <span className={`lh-util__tip lh-util__tip--${slice.key}`} role="tooltip">
                                    <span className="lh-util__tip-swatch" aria-hidden />
                                    <span className="lh-util__tip-name">{label}</span>
                                    <span className="lh-util__tip-meta">{t('legalHub.utilTipCount').replace('{count}', String(slice.count))}</span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
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
    const { rows, selectedId } = useLegalHubMock();
    const selected = rows.find((row) => row.id === selectedId) ?? null;
    const slices = selected
        ? slicesFromUtil(selected.load.util)
        : rows.length > 0
            ? sumUtil(rows.map((row) => row.load))
            : fallbackSlices();
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
                    <UtilChart slices={slices} caption={selected?.name ?? t('legalHub.utilTotal')} />
                    <section className="lh-rail__deadlines" aria-label={t('legalHub.deadlinesTitle')}>
                        <h3 className="lh-rail__section">{t('legalHub.deadlinesTitle')}</h3>
                        <ul className="lh-deadlines">
                            {MOCK_DEADLINES.map((item) => (
                                <li key={item.title}>
                                    <span className={`lh-deadlines__mark lh-deadlines__mark--${item.tone}`} aria-hidden />
                                    <span className="lh-deadlines__title">{t(item.title)}</span>
                                    <span className="lh-deadlines__when">{t(item.when)}</span>
                                </li>
                            ))}
                        </ul>
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

function IconStatList() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M8 6h12M8 12h12M8 18h12" />
            <path d="M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
    );
}

function IconStatFolder() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 7h6l2 2h10v10H3z" />
        </svg>
    );
}

function IconStatHourglass() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M7 4h10M7 20h10" />
            <path d="M8 4c0 4 8 4 8 8s-8 4-8 8" />
        </svg>
    );
}

function IconStatEye() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" />
            <circle cx="12" cy="12" r="2.5" />
        </svg>
    );
}

function IconStatRefresh() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M20 12a8 8 0 1 1-2.3-5.7" />
            <path d="M20 4v6h-6" />
        </svg>
    );
}

function IconStatCalendar() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
    );
}

const TEAM_STATS: { key: string; labelKey: TranslationKey; tone: string; icon: () => JSX.Element }[] = [
    { key: 'tasks', labelKey: 'legalHub.statTasks', tone: 'accent', icon: IconStatList },
    { key: 'projects', labelKey: 'legalHub.statProjects', tone: 'success', icon: IconStatFolder },
    { key: 'wait', labelKey: 'legalHub.statusWaiting', tone: 'wait', icon: IconStatHourglass },
    { key: 'review', labelKey: 'legalHub.statReview', tone: 'review', icon: IconStatEye },
    { key: 'changes', labelKey: 'legalHub.statusChanges', tone: 'changes', icon: IconStatRefresh },
    { key: 'due', labelKey: 'legalHub.statDue', tone: 'due', icon: IconStatCalendar },
];

function TeamStatsStrip({ stats }: { stats: ReturnType<typeof teamStats> }) {
    const { t } = useI18n();
    const values: Record<string, number> = {
        tasks: stats.tasks,
        projects: stats.projects,
        wait: stats.wait,
        review: stats.review,
        changes: stats.changes,
        due: stats.due,
    };
    return (
        <ul className="lh-stats" aria-label={t('legalHub.allTeam')}>
            {TEAM_STATS.map((item) => {
                const Icon = item.icon;
                return (
                    <li key={item.key} className={`lh-stat lh-stat--${item.tone}`}>
                        <span className="lh-stat__icon" aria-hidden><Icon /></span>
                        <span className="lh-stat__body">
                            <strong className="lh-stat__value">{values[item.key] ?? 0}</strong>
                            <span className="lh-stat__label">{t(item.labelKey)}</span>
                        </span>
                    </li>
                );
            })}
        </ul>
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

    const { publish, select, selectedId } = useLegalHubMock();
    const usersById = useMemo(() => new Map(users.map((row) => [row.id, row])), [users]);
    const needle = query.trim().toLowerCase();
    const ledTeams = useMemo(() => {
        if (user == null || teams == null)
            return [];
        return teams.filter((team) => !team.is_archived && team.partner_auth_user_id === user.id);
    }, [teams, user]);
    const published = useMemo(() => ledTeams.flatMap((team) => memberCards(team, usersById).map((member) => ({
        id: member.id,
        name: member.name,
        load: mockMemberLoad(member.id, member.capacity),
    }))), [ledTeams, usersById]);
    const loadById = useMemo(() => new Map(published.map((row) => [row.id, row.load])), [published]);

    useEffect(() => {
        if (teams == null)
            return;
        publish(published);
    }, [teams, published, publish]);

    if (userLoading || (user != null && teams == null && !error))
        return <p className="lh-team__note">{t('legalHub.teamLoading')}</p>;
    if (error)
        return <p className="lh-team__note">{error === 'forbidden' ? t('legalHub.teamForbidden') : t('legalHub.teamError')}</p>;
    return (
        <div className="lh-board">
            <div className="lh-board__main">
                <TeamStatsStrip stats={teamStats(published.map((row) => row.load))} />
                {ledTeams.length === 0 ? <p className="lh-team__note">{t('legalHub.teamEmpty')}</p> : null}
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
                                            load={loadById.get(member.id) ?? mockMemberLoad(member.id, member.capacity)}
                                            tone={index % 4}
                                            selected={selectedId === member.id}
                                            onSelect={() => select(selectedId === member.id ? null : member.id)}
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
