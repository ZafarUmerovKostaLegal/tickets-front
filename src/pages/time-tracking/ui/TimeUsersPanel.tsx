import { useState, useEffect, useCallback, useMemo } from 'react';
import { getUsers } from '@entities/user';
import { getTeamWorkload, listTimeTrackingUsers, type TeamWorkloadMember, type TimeTrackingUserRow, } from '@entities/time-tracking';
import { memberWeeklyCapacityHours } from '@entities/time-tracking/model/memberWeeklyCapacity';
import { summaryTeamWeeklyCapacityHours } from '@entities/time-tracking/model/summaryTeamWeeklyCapacity';
import { useCurrentUser } from '@shared/hooks';
import type { TimeUserRow, TimeUsersTotals } from '@entities/time-tracking/model/types';
import { canManageUserProjectAccess } from '@entities/time-tracking/model/timeManagerClientsAccess';
import { TimeUsersSummary } from './TimeUsersSummary';
import { TimeUsersTable } from './TimeUsersTable';
import { TimeUsersSkeleton } from './TimeUsersSkeleton';
import { TimeUserProjectAccessModal } from './TimeUserProjectAccessModal';
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
function formatWorkloadPeriodRu(fromIso: string, toIso: string): string {
    const a = new Date(`${fromIso}T12:00:00`);
    const b = new Date(`${toIso}T12:00:00`);
    const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${a.toLocaleDateString('ru-RU', o)} — ${b.toLocaleDateString('ru-RU', o)}`;
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
function memberToTimeUserRow(m: TeamWorkloadMember, positionById: Map<number, string>, periodDays: number, weeklyFromProfileById: Map<number, number>, catalogPosition: string | null | undefined,): TimeUserRow {
    const name = (m.display_name?.trim() || m.email || `Пользователь ${m.auth_user_id}`).trim();
    const fromTt = catalogPosition != null && String(catalogPosition).trim() ? String(catalogPosition).trim() : '';
    const pos = fromTt || positionById.get(m.auth_user_id);
    const profileWeekly = weeklyFromProfileById.get(m.auth_user_id);
    return {
        id: String(m.auth_user_id),
        name,
        initials: getInitials(name),
        avatarUrl: m.picture?.trim() || undefined,
        isOnline: false,
        position: pos,
        hours: parseWorkloadDecimal(m.total_hours),
        billableHours: parseWorkloadDecimal(m.billable_hours),
        utilizationPercent: m.workload_percent,
        capacity: memberWeeklyCapacityHours(m, periodDays, profileWeekly),
    };
}
export function TimeUsersPanel() {
    const { user: currentUser } = useCurrentUser();
    const periodQuery = useMemo(() => calendarMonthBounds(), []);
    const [users, setUsers] = useState<TimeUserRow[]>([]);
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
                    getUsers().catch(() => []),
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
                const activeTt = ttUsers.filter((u) => !u.is_archived && !u.is_blocked);
                const periodDays = workload?.period_days && workload.period_days > 0 ? workload.period_days : 1;
                const rows = activeTt.map((u) => {
                    const m = memberById.get(u.id) ?? zeroWorkloadMember(u);
                    return memberToTimeUserRow(m, positionById, periodDays, weeklyFromProfileById, u.position);
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
                    setPeriodLabel(formatWorkloadPeriodRu(workload.date_from, workload.date_to));
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
                    setPeriodLabel(formatWorkloadPeriodRu(periodQuery.from, periodQuery.to));
                }
            }
            catch (err: unknown) {
                if (cancelled)
                    return;
                setTotals(null);
                setPeriodLabel(null);
                setUsers([]);
                const msg = err instanceof Error ? err.message : 'Не удалось загрузить данные';
                setError(/403|forbidden|недостаточно|запрещ/i.test(msg)
                    ? `${msg} (нет доступа к списку учёта времени — синхронизируйтесь в TT или нужна роль менеджера.)`
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
    }, [periodQuery.from, periodQuery.to]);
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
          <span className="time-users__period-label">Период</span>
          <span className="time-users__period-range">{periodLabel}</span>
        </div>)}

      <TimeUsersSummary totals={totals}/>

      {users.length === 0 && !loading && (<div className="time-users__empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>Нет данных по команде за выбранный период</span>
        </div>)}

      {users.length > 0 && (<TimeUsersTable users={users} openActionsId={openActionsId} onActionsOpen={handleActionsOpen} onActionsClose={handleActionsClose} onOpenProjectAccess={(u) => setProjectAccessUser(u)}/>)}

      {projectAccessUser && (<TimeUserProjectAccessModal authUserId={Number(projectAccessUser.id)} userLabel={projectAccessUser.name} canSave={canSaveProjectAccess} onClose={() => setProjectAccessUser(null)}/>)}
    </div>);
}
