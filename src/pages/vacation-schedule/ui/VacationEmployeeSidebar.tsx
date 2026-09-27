import { useEffect, useMemo, useState } from 'react';
import { listColleaguesAsUsers } from '@entities/contacts';
import { listTimeTrackingTeams, type TimeTrackingTeamRow } from '@entities/time-tracking';
import type { User } from '@entities/user';
import { getVacationPartners, listVacationScheduleEmployees, syncVacationScheduleEmployees, type VacationPartnerApi } from '@entities/vacation';
import { useCurrentUser } from '@shared/hooks';
import { canEditVacationSchedule } from '../model/vacationScheduleAccess';
import { buildVacationScheduleRowsFromUsers, markVacationSchedulePartnerRows, mergeUsersWithVacationPartners, type VacationScheduleEmployeeRow } from '../lib/vacationScheduleModel';

type TeamGroup = {
    id: string;
    name: string;
    employees: VacationScheduleEmployeeRow[];
};

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
    selectedId: number | null;
    onSelect: (employee: VacationScheduleEmployeeRow) => void;
};

export function VacationEmployeeSidebar({ selectedId, onSelect }: Props) {
    const { user, loading: userLoading } = useCurrentUser();
    const [groups, setGroups] = useState<TeamGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');

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
            const [empRows, allUsers, partners, teams] = await Promise.all([
                listVacationScheduleEmployees(year),
                listColleaguesAsUsers().catch(() => [] as User[]),
                getVacationPartners().catch(() => [] as VacationPartnerApi[]),
                listTimeTrackingTeams().catch(() => [] as TimeTrackingTeamRow[]),
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

    const visibleGroups = useMemo(() => {
        const q = query.trim().toLocaleLowerCase('ru');
        if (!q)
            return groups;
        return groups
            .map((group) => ({
                ...group,
                employees: group.employees.filter((row) => row.label.toLocaleLowerCase('ru').includes(q)),
            }))
            .filter((group) => group.employees.length > 0);
    }, [groups, query]);

    return (
        <aside className="vac-staff" aria-label="Сотрудники">
            <div className="vac-staff__head">
                <p className="vac-staff__title">Сотрудники</p>
                <input
                    className="vac-staff__search"
                    type="search"
                    value={query}
                    placeholder="Поиск"
                    aria-label="Поиск сотрудника"
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>
            <div className="vac-staff__list">
                {loading ? <p className="vac-staff__note">Загрузка…</p> : null}
                {error ? <p className="vac-staff__note vac-staff__note--err">{error}</p> : null}
                {!loading && !error && visibleGroups.length === 0 ? (
                    <p className="vac-staff__note">{query.trim() ? 'Никого не найдено' : 'Нет сотрудников'}</p>
                ) : null}
                {visibleGroups.map((group) => (
                    <section key={group.id} className="vac-staff__team">
                        <h2 className="vac-staff__team-name">{group.name}</h2>
                        <ul className="vac-staff__people">
                            {group.employees.map((employee) => {
                                const selected = selectedId === employee.id;
                                return (
                                    <li key={`${group.id}-${employee.id}`}>
                                        <button
                                            type="button"
                                            className={`vac-staff__person${selected ? ' vac-staff__person--on' : ''}`}
                                            aria-pressed={selected}
                                            onClick={() => onSelect(employee)}
                                        >
                                            {employee.label}
                                        </button>
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
