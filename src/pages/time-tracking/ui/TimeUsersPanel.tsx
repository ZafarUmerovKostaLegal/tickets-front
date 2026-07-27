import './TimeTrackingForms.css';
import './TimeUsersShared.css';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listColleaguesAsUsers } from '@entities/contacts';
import { getTeamWorkload, listTimeTrackingUsers, type TeamWorkloadMember, type TimeTrackingUserRow, } from '@entities/time-tracking';
import { canManageTimeTrackingOrgUsers } from '@entities/time-tracking/model/timeTrackingAccess';
import { isWithoutAuthRegistration } from '@entities/time-tracking/model/manualUsers';
import { getUserEditUrl } from '@shared/config';
import { memberWeeklyCapacityHours } from '@entities/time-tracking/model/memberWeeklyCapacity';
import { summaryTeamWeeklyCapacityHours } from '@entities/time-tracking/model/summaryTeamWeeklyCapacity';
import { useCurrentUser } from '@shared/hooks';
import { useI18n } from '@shared/i18n';
import { localeTag } from '@shared/i18n/ticketUi';
import { isHiddenSystemUser } from '@shared/lib';
import type { TimeUserRow, TimeUsersTotals } from '@entities/time-tracking/model/types';
import { canManageUserProjectAccess } from '@entities/time-tracking/model/timeManagerClientsAccess';
import { TimeUsersSummary } from './TimeUsersSummary';
import { TimeUsersTable } from './TimeUsersTable';
import { TimeUsersSkeleton } from './TimeUsersSkeleton';
import { TimeUserProjectAccessModal } from './TimeUserProjectAccessModal';
import { CreateManualTimeTrackingUserModal } from './CreateManualTimeTrackingUserModal';
function getInitials(name: string | null): string {
    if (!name)
        return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1)
        return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
function calendarMonthBounds(d = new Date()): {
    from: string;
    to: string;
} {
    const y = d.getFullYear();
    const m = d.getMonth();
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(y, m + 1, 0).getDate();
    return {
        from: `${y}-${pad(m + 1)}-01`,
        to: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
    };
}
function parseWorkloadDecimal(v: string | number): number {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}
function formatWorkloadPeriod(fromIso: string, toIso: string, locale: 'ru' | 'en'): string {
    const a = new Date(`${fromIso}T12:00:00`);
    const b = new Date(`${toIso}T12:00:00`);
    const tag = localeTag(locale);
    const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${a.toLocaleDateString(tag, o)} — ${b.toLocaleDateString(tag, o)}`;
}
function zeroWorkloadMember(u: TimeTrackingUserRow): TeamWorkloadMember {
    return {
        auth_user_id: u.id,
        display_name: u.display_name,
        email: u.email,
        picture: u.picture ?? null,
        capacity_hours: u.weekly_capacity_hours ?? 0,
        total_hours: 0,
        billable_hours: 0,
        non_billable_hours: 0,
        workload_percent: 0,
    };
}
function memberToTimeUserRow(m: TeamWorkloadMember, positionById: Map<number, string>, periodDays: number, weeklyFromProfileById: Map<number, number>, catalogPosition: string | null | undefined, catalogRow: TimeTrackingUserRow | undefined, userFallback: string,): TimeUserRow {
    const name = (m.display_name?.trim() || m.email || userFallback.replace('{id}', String(m.auth_user_id))).trim();
    const fromTt = catalogPosition != null && String(catalogPosition).trim() ? String(catalogPosition).trim() : '';
    const pos = fromTt || positionById.get(m.auth_user_id);
    const profileWeekly = weeklyFromProfileById.get(m.auth_user_id);
    return {
        id: String(m.auth_user_id),
        name,
        initials: getInitials(name),
        avatarUrl: m.picture?.trim() || undefined,
        isOnline: false,
        isManual: catalogRow ? isWithoutAuthRegistration(catalogRow) : undefined,
        isArchived: catalogRow?.is_archived,
        position: pos,
        hours: parseWorkloadDecimal(m.total_hours),
        billableHours: parseWorkloadDecimal(m.billable_hours),
        utilizationPercent: m.workload_percent,
        capacity: memberWeeklyCapacityHours(m, periodDays, profileWeekly),
    };
}
function normalizeUserSearchText(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
function matchesUserSearch(user: TimeUserRow, query: string): boolean {
    const q = normalizeUserSearchText(query);
    if (!q)
        return true;
    const haystack = [
        user.name,
        user.position ?? '',
        user.initials,
        user.isManual ? 'без входа without sign-in' : '',
        user.isArchived ? 'архив archive' : '',
    ].join(' ').toLowerCase();
    return q.split(' ').every((token) => haystack.includes(token));
}
const IcoSearch = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
    </svg>
);
export function TimeUsersPanel() {
    const { t, locale } = useI18n();
    const navigate = useNavigate();
    const { user: currentUser } = useCurrentUser();
    const canCreateManual = canManageTimeTrackingOrgUsers(currentUser);
    const periodQuery = useMemo(() => calendarMonthBounds(), []);
    const [users, setUsers] = useState<TimeUserRow[]>([]);
    const [manualModalOpen, setManualModalOpen] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [hasArchived, setHasArchived] = useState(false);
    const [totals, setTotals] = useState<TimeUsersTotals | null>(null);
    const [periodLabel, setPeriodLabel] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openActionsId, setOpenActionsId] = useState<string | null>(null);
    const [projectAccessUser, setProjectAccessUser] = useState<TimeUserRow | null>(null);
    const canSaveProjectAccess = canManageUserProjectAccess(currentUser?.role, currentUser?.time_tracking_role ?? null);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        void (async () => {
            try {
                const ttUsers = await listTimeTrackingUsers();
                if (cancelled)
                    return;
                const [workload, allUsers] = await Promise.all([
                    getTeamWorkload(periodQuery.from, periodQuery.to).catch(() => null),
                    listColleaguesAsUsers().catch(() => []),
                ]);
                if (cancelled)
                    return;
                const positionById = new Map<number, string>();
                for (const u of allUsers) {
                    if (u.position)
                        positionById.set(u.id, u.position);
                }
                const weeklyFromProfileById = new Map<number, number>();
                for (const r of ttUsers) {
                    if (r.weekly_capacity_hours == null)
                        continue;
                    const w = parseWorkloadDecimal(r.weekly_capacity_hours);
                    if (w > 0)
                        weeklyFromProfileById.set(r.id, w);
                }
                const memberById = new Map<number, TeamWorkloadMember>();
                if (workload) {
                    for (const m of workload.members) {
                        memberById.set(m.auth_user_id, m);
                    }
                }
                const visibleTt = ttUsers.filter((u) => !u.is_blocked && !isHiddenSystemUser(u));
                if (!cancelled)
                    setHasArchived(visibleTt.some((u) => u.is_archived));
                const activeTt = visibleTt.filter((u) => showArchived || !u.is_archived);
                const periodDays = workload?.period_days && workload.period_days > 0 ? workload.period_days : 1;
                const userFallback = t('timeTrackingPage.users.panel.fallbackUser');
                const rows = activeTt.map((u) => {
                    const m = memberById.get(u.id) ?? zeroWorkloadMember(u);
                    return memberToTimeUserRow(m, positionById, periodDays, weeklyFromProfileById, u.position, u, userFallback);
                });
                setUsers(rows);
                if (workload) {
                    const s = workload.summary;
                    const teamWeeklyCap = summaryTeamWeeklyCapacityHours(s, workload.period_days);
                    const totalH = parseWorkloadDecimal(s.total_hours);
                    const pctFromApi = s.team_workload_percent;
                    const periodCap = parseWorkloadDecimal(s.team_capacity_hours);
                    const pctFallback = periodCap > 0 ? Math.min(Math.round((totalH / periodCap) * 100), 100) : 0;
                    setTotals({
                        totalHours: totalH,
                        teamCapacity: teamWeeklyCap,
                        billableHours: parseWorkloadDecimal(s.billable_hours),
                        nonBillableHours: parseWorkloadDecimal(s.non_billable_hours),
                        teamWorkloadPercent: Math.min(Math.max(Number.isFinite(pctFromApi) ? pctFromApi : pctFallback, 0), 100),
                    });
                    setPeriodLabel(formatWorkloadPeriod(workload.date_from, workload.date_to, locale));
                }
                else {
                    const capSum = rows.reduce((s, r) => s + r.capacity, 0);
                    const totalH = rows.reduce((s, r) => s + r.hours, 0);
                    const pct = capSum > 0 ? Math.min(Math.round((totalH / capSum) * 100), 100) : 0;
                    setTotals({
                        totalHours: totalH,
                        teamCapacity: capSum,
                        billableHours: rows.reduce((s, r) => s + r.billableHours, 0),
                        nonBillableHours: rows.reduce((s, r) => s + (r.hours - r.billableHours), 0),
                        teamWorkloadPercent: pct,
                    });
                    setPeriodLabel(formatWorkloadPeriod(periodQuery.from, periodQuery.to, locale));
                }
            }
            catch (err: unknown) {
                if (cancelled)
                    return;
                setTotals(null);
                setPeriodLabel(null);
                setUsers([]);
                const msg = err instanceof Error ? err.message : t('timeTrackingPage.users.panel.loadFailed');
                setError(/403|forbidden|недостаточно|запрещ/i.test(msg)
                    ? `${msg}${t('timeTrackingPage.users.panel.accessHint')}`
                    : msg);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [periodQuery.from, periodQuery.to, locale, t, showArchived]);
    const filteredUsers = useMemo(
        () => users.filter((u) => matchesUserSearch(u, searchQuery)),
        [users, searchQuery],
    );
    const handleActionsOpen = useCallback((id: string) => {
        setOpenActionsId((prev) => (prev === id ? null : id));
    }, []);
    const handleActionsClose = useCallback(() => setOpenActionsId(null), []);
    if (loading)
        return <TimeUsersSkeleton />;
    if (error) {
        return (<div className="time-page__panel time-users">
        <div className="time-users__error">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
        </div>
      </div>);
    }
    if (!totals) {
        return null;
    }
    return (<div className="time-page__panel time-users">
      {periodLabel && (<div className="time-users__period">
          <span className="time-users__period-label">{t('timeTrackingPage.users.panel.period')}</span>
          <span className="time-users__period-range">{periodLabel}</span>
        </div>)}

      <TimeUsersSummary totals={totals}/>

      {(users.length > 0 || canCreateManual || hasArchived || showArchived) && (
        <div className="time-users__toolbar time-users__toolbar--animate">
          {users.length > 0 ? (
            <div className="tt-settings__search-wrap time-users__search-wrap">
              <span className="tt-settings__search-icon">
                <IcoSearch />
              </span>
              <input
                type="search"
                className="tt-settings__search"
                placeholder={t('timeTrackingPage.users.panel.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('timeTrackingPage.users.panel.searchAria')}
              />
            </div>
          ) : null}
          <div className="time-users__toolbar-actions">
            {canCreateManual ? (
              <button type="button" className="tt-settings__btn tt-settings__btn--outline time-users__add-manual-btn" onClick={() => setManualModalOpen(true)}>
                {t('timeTrackingPage.users.panel.addManualUser')}
              </button>
            ) : null}
            {(hasArchived || showArchived) ? (
              <label className="time-users__archived-toggle">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                <span>{t('timeTrackingPage.users.panel.showArchived')}</span>
              </label>
            ) : null}
          </div>
        </div>
      )}

      {users.length > 0 && searchQuery.trim() ? (
        <p className="time-users__filter-count" role="status">
          {t('timeTrackingPage.users.panel.searchCount')
            .replace('{shown}', String(filteredUsers.length))
            .replace('{total}', String(users.length))}
        </p>
      ) : null}

      {users.length === 0 && !loading && (<div className="time-users__empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>{t('timeTrackingPage.users.panel.empty')}</span>
        </div>)}

      {users.length > 0 && filteredUsers.length === 0 ? (
        <div className="time-users__empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span>{t('timeTrackingPage.users.panel.searchNoMatch')}</span>
        </div>
      ) : null}

      {filteredUsers.length > 0 ? (
        <TimeUsersTable
          users={filteredUsers}
          openActionsId={openActionsId}
          onActionsOpen={handleActionsOpen}
          onActionsClose={handleActionsClose}
          onOpenProjectAccess={(u) => setProjectAccessUser(u)}
        />
      ) : null}

      {projectAccessUser && (<TimeUserProjectAccessModal authUserId={Number(projectAccessUser.id)} userLabel={projectAccessUser.name} canSave={canSaveProjectAccess} onClose={() => setProjectAccessUser(null)}/>)}

      {manualModalOpen && (<CreateManualTimeTrackingUserModal canManage={canCreateManual} onClose={() => setManualModalOpen(false)} onCreated={(row) => {
                navigate(`${getUserEditUrl(row.id)}?tab=projects`);
            }}/>)}
    </div>);
}
