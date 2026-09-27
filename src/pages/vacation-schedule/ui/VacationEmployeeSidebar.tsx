import { useEffect, useMemo, useState } from 'react';
import { listColleaguesAsUsers } from '@entities/contacts';
import { listTimeTrackingTeams, type TimeTrackingTeamRow } from '@entities/time-tracking';
import type { User } from '@entities/user';
import { getVacationPartners, getVacationRosterHidden, listVacationScheduleEmployees, patchVacationRosterHidden, syncVacationScheduleEmployees, type VacationPartnerApi } from '@entities/vacation';
import { useCurrentUser } from '@shared/hooks';
import { canEditVacationSchedule } from '../model/vacationScheduleAccess';
import { buildVacationScheduleRowsFromUsers, markVacationSchedulePartnerRows, mergeUsersWithVacationPartners, type VacationScheduleEmployeeRow } from '../lib/vacationScheduleModel';

type TeamGroup = {
    id: string;
    name: string;
    employees: VacationScheduleEmployeeRow[];
};

const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#059669', '#d97706', '#db2777', '#7c3aed'];

function personInitials(label: string): string {
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function avatarColor(label: string): string {
    let hash = 0;
    for (let i = 0; i < label.length; i += 1)
        hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function rosterHideBody(row: VacationScheduleEmployeeRow): { authUserId: number } | { employeeId: number } | null {
    if (row.systemUserId != null && row.systemUserId > 0)
        return { authUserId: row.systemUserId };
    if (row.id > 0)
        return { employeeId: row.id };
    return null;
}

function rowIsHidden(row: VacationScheduleEmployeeRow, hiddenUsers: ReadonlySet<number>, hiddenEmployees: ReadonlySet<number>): boolean {
    if (row.systemUserId != null && hiddenUsers.has(row.systemUserId))
        return true;
    return row.systemUserId == null && row.id > 0 && hiddenEmployees.has(row.id);
}

function teamMemberIds(team: TimeTrackingTeamRow): Set<number> {
    return new Set([team.partner_auth_user_id, ...team.member_auth_user_ids]);
}

function groupEmployeesByTeam(rows: VacationScheduleEmployeeRow[], teams: TimeTrackingTeamRow[]): TeamGroup[] {
    const active = teams
        .filter((team) => !team.is_archived)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    const placed = new Set<number>();
    const groups: TeamGroup[] = [];
    for (const team of active) {
        const ids = teamMemberIds(team);
        const employees = rows
            .filter((row) => row.systemUserId != null && ids.has(row.systemUserId))
            .slice()
            .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
        if (employees.length === 0)
            continue;
        for (const row of employees)
            placed.add(row.id);
        groups.push({ id: team.id, name: team.name, employees });
    }
    const rest = rows
        .filter((row) => !placed.has(row.id))
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
    if (rest.length > 0)
        groups.push({ id: 'none', name: 'Без команды', employees: rest });
    return groups;
}

type Props = {
    selectedIds: ReadonlySet<number>;
    teamFilterId: string | null;
    onTeamFilter: (teamId: string | null, employees: VacationScheduleEmployeeRow[]) => void;
    onToggleEmployee: (employee: VacationScheduleEmployeeRow) => void;
};

export function VacationEmployeeSidebar({ selectedIds, teamFilterId, onTeamFilter, onToggleEmployee }: Props) {
    const { user, loading: userLoading } = useCurrentUser();
    const [groups, setGroups] = useState<TeamGroup[]>([]);
    const [hiddenUsers, setHiddenUsers] = useState<Set<number>>(() => new Set());
    const [hiddenEmployees, setHiddenEmployees] = useState<Set<number>>(() => new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hideError, setHideError] = useState<string | null>(null);
    const [hidingKey, setHidingKey] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const canManage = !userLoading && canEditVacationSchedule(user);

    useEffect(() => {
        if (userLoading)
            return;
        let cancelled = false;
        const year = new Date().getFullYear();
        const canEdit = canEditVacationSchedule(user);
        setLoading(true);
        setError(null);
        void (async () => {
            if (canEdit) {
                try {
                    await syncVacationScheduleEmployees(year);
                }
                catch {
                }
            }
            const [empRows, allUsers, partners, teams, hidden] = await Promise.all([
                listVacationScheduleEmployees(year),
                listColleaguesAsUsers().catch(() => [] as User[]),
                getVacationPartners().catch(() => [] as VacationPartnerApi[]),
                listTimeTrackingTeams().catch(() => [] as TimeTrackingTeamRow[]),
                getVacationRosterHidden().catch(() => ({ authUserIds: [] as number[], employeeIds: [] as number[] })),
            ]);
            if (cancelled)
                return;
            const scheduleRows: VacationScheduleEmployeeRow[] = empRows.map((row) => ({
                id: row.id,
                label: row.full_name,
                excelRowNo: row.excel_row_no,
                plannedPeriodNote: row.planned_period_note,
                systemUserId: row.auth_user_id ?? undefined,
                email: row.email ?? null,
            }));
            const usersWithPartners = mergeUsersWithVacationPartners(allUsers, partners);
            const rows = markVacationSchedulePartnerRows(
                buildVacationScheduleRowsFromUsers(usersWithPartners, scheduleRows),
                usersWithPartners,
                partners.map((partner) => partner.user_id),
            );
            setGroups(groupEmployeesByTeam(rows, teams));
            setHiddenUsers(new Set(hidden.authUserIds));
            setHiddenEmployees(new Set(hidden.employeeIds));
        })()
            .catch((err: unknown) => {
                if (cancelled)
                    return;
                setGroups([]);
                setError(err instanceof Error ? err.message : 'Не удалось загрузить сотрудников');
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [user, userLoading]);

    const filteredByTeam = useMemo(() => {
        if (!teamFilterId)
            return groups;
        return groups.filter((group) => group.id === teamFilterId);
    }, [groups, teamFilterId]);

    const { shownGroups, hiddenRows } = useMemo(() => {
        const q = query.trim().toLocaleLowerCase('ru');
        const shown: TeamGroup[] = [];
        const hidden: VacationScheduleEmployeeRow[] = [];
        const seenHidden = new Set<number>();
        for (const group of filteredByTeam) {
            const employees = group.employees.filter((row) => {
                const matches = !q || row.label.toLocaleLowerCase('ru').includes(q);
                if (!matches)
                    return false;
                if (!rowIsHidden(row, hiddenUsers, hiddenEmployees))
                    return true;
                if (!seenHidden.has(row.id)) {
                    seenHidden.add(row.id);
                    hidden.push(row);
                }
                return false;
            });
            if (employees.length > 0)
                shown.push({ ...group, employees });
        }
        hidden.sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
        return { shownGroups: shown, hiddenRows: hidden };
    }, [filteredByTeam, hiddenEmployees, hiddenUsers, query]);

    const changeVisibility = async (employee: VacationScheduleEmployeeRow, hidden: boolean) => {
        const body = rosterHideBody(employee);
        if (!body || hidingKey)
            return;
        const key = 'authUserId' in body ? `u:${body.authUserId}` : `e:${body.employeeId}`;
        setHidingKey(key);
        setHideError(null);
        try {
            const next = await patchVacationRosterHidden({ ...body, hidden });
            setHiddenUsers(new Set(next.authUserIds));
            setHiddenEmployees(new Set(next.employeeIds));
            if (hidden && selectedIds.has(employee.id))
                onToggleEmployee(employee);
        }
        catch (err: unknown) {
            setHideError(err instanceof Error ? err.message : 'Не удалось изменить видимость');
        }
        finally {
            setHidingKey(null);
        }
    };

    return (
        <aside className="vac-staff" aria-label="Сотрудники">
            <div className="vac-staff__head">
                <div className="vac-staff__title-row">
                    <p className="vac-staff__title">Сотрудники</p>
                    {selectedIds.size > 0 ? (
                        <span className="vac-staff__count">{selectedIds.size}</span>
                    ) : null}
                </div>
                <label className="vac-staff__search-wrap">
                    <svg className="vac-staff__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <circle cx="11" cy="11" r="7" />
                        <line x1="16.5" y1="16.5" x2="21" y2="21" />
                    </svg>
                    <input
                        className="vac-staff__search"
                        type="search"
                        value={query}
                        placeholder="Найти сотрудника"
                        aria-label="Поиск сотрудника"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
                {groups.length > 0 ? (
                    <div className="vac-staff__teams" role="group" aria-label="Фильтр по командам">
                        <button
                            type="button"
                            className={`vac-staff__chip${teamFilterId == null ? ' vac-staff__chip--on' : ''}`}
                            aria-pressed={teamFilterId == null}
                            onClick={() => onTeamFilter(null, [])}
                        >
                            Все
                        </button>
                        {groups.map((group) => {
                            const on = teamFilterId === group.id;
                            return (
                                <button
                                    key={group.id}
                                    type="button"
                                    className={`vac-staff__chip${on ? ' vac-staff__chip--on' : ''}`}
                                    aria-pressed={on}
                                    onClick={() => onTeamFilter(group.id, group.employees.filter((row) => !rowIsHidden(row, hiddenUsers, hiddenEmployees)))}
                                >
                                    {group.name}
                                </button>
                            );
                        })}
                    </div>
                ) : null}
            </div>
            <div className="vac-staff__list">
                {loading ? <p className="vac-staff__note">Загрузка…</p> : null}
                {error ? <p className="vac-staff__note vac-staff__note--err">{error}</p> : null}
                {hideError ? <p className="vac-staff__note vac-staff__note--err">{hideError}</p> : null}
                {!loading && !error && shownGroups.length === 0 && hiddenRows.length === 0 ? (
                    <p className="vac-staff__note">{query.trim() ? 'Никого не найдено' : 'Нет сотрудников'}</p>
                ) : null}
                {shownGroups.map((group) => (
                    <section key={group.id} className="vac-staff__team">
                        <div className="vac-staff__team-hd">
                            <h2 className="vac-staff__team-name">
                                {group.name}
                                <span className="vac-staff__team-count">{group.employees.length}</span>
                            </h2>
                            <button
                                type="button"
                                className="vac-staff__team-all"
                                onClick={() => onTeamFilter(group.id, group.employees)}
                            >
                                Вся команда
                            </button>
                        </div>
                        <ul className="vac-staff__people">
                            {group.employees.map((employee) => {
                                const selected = selectedIds.has(employee.id);
                                const hideBody = rosterHideBody(employee);
                                const hideKey = hideBody && ('authUserId' in hideBody ? `u:${hideBody.authUserId}` : `e:${hideBody.employeeId}`);
                                return (
                                    <li key={`${group.id}-${employee.id}`} className="vac-staff__row">
                                        <button
                                            type="button"
                                            className={`vac-staff__person${selected ? ' vac-staff__person--on' : ''}`}
                                            aria-pressed={selected}
                                            onClick={() => onToggleEmployee(employee)}
                                        >
                                            <span
                                                className="vac-staff__avatar"
                                                style={{ background: selected ? 'var(--app-accent, #4f46e5)' : avatarColor(employee.label) }}
                                                aria-hidden
                                            >
                                                {personInitials(employee.label)}
                                            </span>
                                            <span className="vac-staff__name">{employee.label}</span>
                                            <span className={`vac-staff__mark${selected ? ' vac-staff__mark--on' : ''}`} aria-hidden />
                                        </button>
                                        {canManage && hideBody ? (
                                            <button
                                                type="button"
                                                className="vac-staff__hide"
                                                aria-label={`Скрыть ${employee.label}`}
                                                title="Скрыть для всех"
                                                disabled={hidingKey != null}
                                                onClick={() => void changeVisibility(employee, true)}
                                            >
                                                {hidingKey === hideKey ? '…' : 'Скрыть'}
                                            </button>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
                {canManage && hiddenRows.length > 0 ? (
                    <section className="vac-staff__team vac-staff__team--hidden">
                        <div className="vac-staff__team-hd">
                            <h2 className="vac-staff__team-name">
                                Скрытые
                                <span className="vac-staff__team-count">{hiddenRows.length}</span>
                            </h2>
                        </div>
                        <ul className="vac-staff__people">
                            {hiddenRows.map((employee) => {
                                const hideBody = rosterHideBody(employee);
                                const hideKey = hideBody && ('authUserId' in hideBody ? `u:${hideBody.authUserId}` : `e:${hideBody.employeeId}`);
                                return (
                                    <li key={`hidden-${employee.id}`} className="vac-staff__row">
                                        <div className="vac-staff__person vac-staff__person--muted">
                                            <span className="vac-staff__avatar vac-staff__avatar--muted" aria-hidden>
                                                {personInitials(employee.label)}
                                            </span>
                                            <span className="vac-staff__name">{employee.label}</span>
                                        </div>
                                        {hideBody ? (
                                            <button
                                                type="button"
                                                className="vac-staff__hide vac-staff__hide--show"
                                                aria-label={`Показать ${employee.label}`}
                                                title="Показать для всех"
                                                disabled={hidingKey != null}
                                                onClick={() => void changeVisibility(employee, false)}
                                            >
                                                {hidingKey === hideKey ? '…' : 'Показать'}
                                            </button>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ) : null}
            </div>
        </aside>
    );
}
