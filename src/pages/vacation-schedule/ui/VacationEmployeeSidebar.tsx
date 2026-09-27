import { useEffect, useMemo, useRef, useState } from 'react';
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
    year: number;
    selectedIds: ReadonlySet<number>;
    allowedIds: ReadonlySet<number> | null;
    onSelectEmployees: (employees: VacationScheduleEmployeeRow[]) => void;
    onToggleEmployee: (employee: VacationScheduleEmployeeRow) => void;
    onShownEmployees: (rows: Array<VacationScheduleEmployeeRow & { teamName: string }>) => void;
    onDirectory: (rows: Array<VacationScheduleEmployeeRow & { teamName: string }>) => void;
};

function teamFilterLabel(ids: ReadonlySet<string>, groups: TeamGroup[]): string {
    if (ids.size === 0)
        return 'Все команды';
    if (ids.size === 1) {
        const id = [...ids][0];
        return groups.find((group) => group.id === id)?.name ?? '1 команда';
    }
    const n = ids.size;
    const mod10 = n % 10;
    const mod100 = n % 100;
    const word = mod10 === 1 && mod100 !== 11
        ? 'команда'
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
            ? 'команды'
            : 'команд';
    return `${n} ${word}`;
}

export function VacationEmployeeSidebar({ year, selectedIds, allowedIds, onSelectEmployees, onToggleEmployee, onShownEmployees, onDirectory }: Props) {
    const { user, loading: userLoading } = useCurrentUser();
    const [groups, setGroups] = useState<TeamGroup[]>([]);
    const [hiddenUsers, setHiddenUsers] = useState<Set<number>>(() => new Set());
    const [hiddenEmployees, setHiddenEmployees] = useState<Set<number>>(() => new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hideError, setHideError] = useState<string | null>(null);
    const [hidingKey, setHidingKey] = useState<string | null>(null);
    const [hiddenOpen, setHiddenOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [teamFilterIds, setTeamFilterIds] = useState<Set<string>>(() => new Set());
    const [teamMenuOpen, setTeamMenuOpen] = useState(false);
    const [teamQuery, setTeamQuery] = useState('');
    const teamMenuRef = useRef<HTMLDivElement>(null);
    const canManage = !userLoading && canEditVacationSchedule(user);

    useEffect(() => {
        if (userLoading)
            return;
        let cancelled = false;
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
    }, [user, userLoading, year]);

    useEffect(() => {
        if (!teamMenuOpen)
            return;
        const onPointer = (event: MouseEvent) => {
            if (!teamMenuRef.current?.contains(event.target as Node))
                setTeamMenuOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setTeamMenuOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [teamMenuOpen]);

    const filteredByTeam = useMemo(() => {
        if (teamFilterIds.size === 0)
            return groups;
        return groups.filter((group) => teamFilterIds.has(group.id));
    }, [groups, teamFilterIds]);

    const teamOptions = useMemo(() => {
        const q = teamQuery.trim().toLocaleLowerCase('ru');
        if (!q)
            return groups;
        return groups.filter((group) => group.name.toLocaleLowerCase('ru').includes(q));
    }, [groups, teamQuery]);

    const toggleTeamFilter = (id: string) => {
        setTeamFilterIds((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };

    const shownGroups = useMemo(() => {
        const q = query.trim().toLocaleLowerCase('ru');
        const shown: TeamGroup[] = [];
        for (const group of filteredByTeam) {
            const employees = group.employees.filter((row) => {
                if (rowIsHidden(row, hiddenUsers, hiddenEmployees))
                    return false;
                if (allowedIds && !allowedIds.has(row.id))
                    return false;
                return !q || row.label.toLocaleLowerCase('ru').includes(q);
            });
            if (employees.length > 0)
                shown.push({ ...group, employees });
        }
        return shown;
    }, [allowedIds, filteredByTeam, hiddenEmployees, hiddenUsers, query]);

    const onShownEmployeesRef = useRef(onShownEmployees);
    onShownEmployeesRef.current = onShownEmployees;
    const onDirectoryRef = useRef(onDirectory);
    onDirectoryRef.current = onDirectory;

    useEffect(() => {
        const seen = new Set<number>();
        const people: Array<VacationScheduleEmployeeRow & { teamName: string }> = [];
        for (const group of groups) {
            for (const row of group.employees) {
                if (rowIsHidden(row, hiddenUsers, hiddenEmployees) || seen.has(row.id))
                    continue;
                seen.add(row.id);
                people.push({ ...row, teamName: group.name });
            }
        }
        onDirectoryRef.current(people);
    }, [groups, hiddenEmployees, hiddenUsers]);

    useEffect(() => {
        const seen = new Set<number>();
        const people: Array<VacationScheduleEmployeeRow & { teamName: string }> = [];
        for (const group of shownGroups) {
            for (const row of group.employees) {
                if (seen.has(row.id))
                    continue;
                seen.add(row.id);
                people.push({ ...row, teamName: group.name });
            }
        }
        onShownEmployeesRef.current(people);
    }, [shownGroups]);

    const allHiddenRows = useMemo(() => {
        const q = query.trim().toLocaleLowerCase('ru');
        const hidden: VacationScheduleEmployeeRow[] = [];
        const seen = new Set<number>();
        for (const group of groups) {
            for (const row of group.employees) {
                if (!rowIsHidden(row, hiddenUsers, hiddenEmployees) || seen.has(row.id))
                    continue;
                if (q && !row.label.toLocaleLowerCase('ru').includes(q))
                    continue;
                seen.add(row.id);
                hidden.push(row);
            }
        }
        hidden.sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
        return hidden;
    }, [groups, hiddenEmployees, hiddenUsers, query]);

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
                    <span className="vac-staff__title-actions">
                        {canManage ? (
                            <button
                                type="button"
                                className={`vac-staff__hidden-btn${hiddenOpen ? ' vac-staff__hidden-btn--on' : ''}`}
                                aria-pressed={hiddenOpen}
                                onClick={() => setHiddenOpen((open) => !open)}
                            >
                                Скрытые
                                {allHiddenRows.length > 0 ? <span className="vac-staff__team-count">{allHiddenRows.length}</span> : null}
                            </button>
                        ) : null}
                        {selectedIds.size > 0 ? (
                            <span className="vac-staff__count">{selectedIds.size}</span>
                        ) : null}
                    </span>
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
                    <div className="vac-staff__picker" ref={teamMenuRef}>
                        <button
                            type="button"
                            className={`vac-staff__picker-btn${teamMenuOpen ? ' vac-staff__picker-btn--open' : ''}`}
                            aria-expanded={teamMenuOpen}
                            aria-haspopup="listbox"
                            onClick={() => setTeamMenuOpen((open) => !open)}
                        >
                            <span className="vac-staff__picker-label">{teamFilterLabel(teamFilterIds, groups)}</span>
                            <svg className="vac-staff__picker-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>
                        {teamMenuOpen ? (
                            <div className="vac-staff__picker-menu" role="listbox" aria-label="Фильтр по командам" aria-multiselectable="true">
                                <label className="vac-staff__picker-search">
                                    <input
                                        type="search"
                                        value={teamQuery}
                                        placeholder="Найти команду"
                                        aria-label="Поиск команды"
                                        onChange={(event) => setTeamQuery(event.target.value)}
                                    />
                                </label>
                                <button
                                    type="button"
                                    className="vac-staff__picker-opt"
                                    onClick={() => setTeamFilterIds(new Set())}
                                >
                                    <span className={`vac-staff__mark${teamFilterIds.size === 0 ? ' vac-staff__mark--on' : ''}`} aria-hidden />
                                    Все команды
                                </button>
                                {teamOptions.length === 0 ? (
                                    <p className="vac-staff__note">Команда не найдена</p>
                                ) : teamOptions.map((group) => {
                                    const on = teamFilterIds.has(group.id);
                                    const visibleCount = group.employees.filter((row) => !rowIsHidden(row, hiddenUsers, hiddenEmployees)).length;
                                    return (
                                        <button
                                            key={group.id}
                                            type="button"
                                            role="option"
                                            aria-selected={on}
                                            className={`vac-staff__picker-opt${on ? ' vac-staff__picker-opt--on' : ''}`}
                                            onClick={() => toggleTeamFilter(group.id)}
                                        >
                                            <span className={`vac-staff__mark${on ? ' vac-staff__mark--on' : ''}`} aria-hidden />
                                            <span className="vac-staff__picker-name">{group.name}</span>
                                            <span className="vac-staff__team-count">{visibleCount}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
            <div className="vac-staff__list">
                {loading ? <p className="vac-staff__note">Загрузка…</p> : null}
                {error ? <p className="vac-staff__note vac-staff__note--err">{error}</p> : null}
                {hideError ? <p className="vac-staff__note vac-staff__note--err">{hideError}</p> : null}
                {!loading && !error && !hiddenOpen && shownGroups.length === 0 ? (
                    <p className="vac-staff__note">{query.trim() ? 'Никого не найдено' : 'Нет сотрудников'}</p>
                ) : null}
                {hiddenOpen ? (
                    <section className="vac-staff__team vac-staff__team--hidden">
                        <h2 className="vac-staff__team-name">Скрытые для всех</h2>
                        {allHiddenRows.length === 0 ? (
                            <p className="vac-staff__note">Скрытых сотрудников нет</p>
                        ) : (
                            <ul className="vac-staff__people">
                                {allHiddenRows.map((employee) => {
                                    const hideBody = rosterHideBody(employee);
                                    const hideKey = hideBody && ('authUserId' in hideBody ? `u:${hideBody.authUserId}` : `e:${hideBody.employeeId}`);
                                    return (
                                        <li key={`hidden-${employee.id}`} className="vac-staff__row vac-staff__row--reveal">
                                            <div className="vac-staff__person vac-staff__person--muted">
                                                <span className="vac-staff__avatar vac-staff__avatar--muted" aria-hidden>
                                                    {personInitials(employee.label)}
                                                </span>
                                                <span className="vac-staff__name">{employee.label}</span>
                                            </div>
                                            {hideBody ? (
                                                <button
                                                    type="button"
                                                    className="vac-staff__eye vac-staff__eye--show"
                                                    aria-label={`Показать ${employee.label}`}
                                                    title="Показать для всех"
                                                    disabled={hidingKey != null}
                                                    onClick={() => void changeVisibility(employee, false)}
                                                >
                                                    {hidingKey === hideKey ? '…' : (
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                                                            <circle cx="12" cy="12" r="3" />
                                                        </svg>
                                                    )}
                                                </button>
                                            ) : null}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                ) : null}
                {!hiddenOpen && shownGroups.map((group) => (
                    <section key={group.id} className="vac-staff__team">
                        <div className="vac-staff__team-hd">
                            <h2 className="vac-staff__team-name">
                                {group.name}
                                <span className="vac-staff__team-count">{group.employees.length}</span>
                            </h2>
                            <button
                                type="button"
                                className="vac-staff__team-all"
                                onClick={() => onSelectEmployees(group.employees)}
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
                                                className="vac-staff__eye"
                                                aria-label={`Скрыть ${employee.label} для всех`}
                                                title="Скрыть для всех"
                                                disabled={hidingKey != null}
                                                onClick={() => void changeVisibility(employee, true)}
                                            >
                                                {hidingKey === hideKey ? '…' : (
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                                        <path d="M3 3l18 18" />
                                                        <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                                                        <path d="M9.9 5.2A10.8 10.8 0 0121 12c-.6 1-1.5 2.1-2.6 3.1M6.1 6.1C4.2 7.4 2.8 9.2 2 12c1.5 3.5 5.2 7 10 7 1.5 0 2.9-.3 4.2-.9" />
                                                    </svg>
                                                )}
                                            </button>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
            </div>
        </aside>
    );
}
