import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { listColleaguesAsUsers } from '@entities/contacts';
import { listTimeTrackingTeams } from '@entities/time-tracking';
import { getVacationPartners, getVacationRosterHidden, listVacationScheduleEmployees, patchVacationRosterHidden, syncVacationScheduleEmployees } from '@entities/vacation';
import { useCurrentUser } from '@shared/hooks';
import { canEditVacationSchedule } from '../model/vacationScheduleAccess';
import { buildVacationScheduleRowsFromUsers, markVacationSchedulePartnerRows, mergeUsersWithScheduleEmployees, mergeUsersWithVacationPartners } from '../lib/vacationScheduleModel';
const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#059669', '#d97706', '#db2777', '#7c3aed'];
function personInitials(label) {
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}
function avatarColor(label) {
    let hash = 0;
    for (let i = 0; i < label.length; i += 1)
        hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function rosterHideBody(row) {
    if (row.systemUserId != null && row.systemUserId > 0)
        return { authUserId: row.systemUserId };
    if (row.id > 0)
        return { employeeId: row.id };
    return null;
}
function rowIsHidden(row, hiddenUsers, hiddenEmployees) {
    if (row.systemUserId != null && hiddenUsers.has(row.systemUserId))
        return true;
    return row.systemUserId == null && row.id > 0 && hiddenEmployees.has(row.id);
}
function teamMemberIds(team) {
    return new Set([team.partner_auth_user_id, ...team.member_auth_user_ids]);
}
function groupEmployeesByTeam(rows, teams) {
    const active = teams
        .filter((team) => !team.is_archived)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    const placed = new Set();
    const groups = [];
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
function teamFilterLabel(ids, groups) {
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
export function VacationEmployeeSidebar({ year, selectedIds, allowedIds, onSelectEmployees, onToggleEmployee, onShownEmployees, onDirectory, initialQuery = '', initialTeamFilterIds = [], initialHiddenOpen = false, initialCollapsedTeamIds = [], onStaffUiChange, }) {
    const { user, loading: userLoading } = useCurrentUser();
    const [groups, setGroups] = useState([]);
    const [hiddenUsers, setHiddenUsers] = useState(() => new Set());
    const [hiddenEmployees, setHiddenEmployees] = useState(() => new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hideError, setHideError] = useState(null);
    const [hidingKey, setHidingKey] = useState(null);
    const [hiddenOpen, setHiddenOpen] = useState(initialHiddenOpen);
    const [query, setQuery] = useState(initialQuery);
    const [teamFilterIds, setTeamFilterIds] = useState(() => new Set(initialTeamFilterIds));
    const [collapsedTeams, setCollapsedTeams] = useState(() => new Set(initialCollapsedTeamIds));
    const [teamMenuOpen, setTeamMenuOpen] = useState(false);
    const [teamQuery, setTeamQuery] = useState('');
    const teamMenuRef = useRef(null);
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
                listColleaguesAsUsers().catch(() => []),
                getVacationPartners().catch(() => []),
                listTimeTrackingTeams().catch(() => []),
                getVacationRosterHidden().catch(() => ({ authUserIds: [], employeeIds: [] })),
            ]);
            if (cancelled)
                return;
            const scheduleRows = empRows.map((row) => ({
                id: row.id,
                label: row.full_name,
                excelRowNo: row.excel_row_no,
                plannedPeriodNote: row.planned_period_note,
                systemUserId: row.auth_user_id ?? undefined,
                email: row.email ?? null,
            }));
            const usersWithPartners = mergeUsersWithScheduleEmployees(mergeUsersWithVacationPartners(allUsers, partners), scheduleRows);
            const rows = markVacationSchedulePartnerRows(buildVacationScheduleRowsFromUsers(usersWithPartners, scheduleRows), usersWithPartners, partners.map((partner) => partner.user_id));
            setGroups(groupEmployeesByTeam(rows, teams));
            setHiddenUsers(new Set(hidden.authUserIds));
            setHiddenEmployees(new Set(hidden.employeeIds));
        })()
            .catch((err) => {
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
        const onPointer = (event) => {
            if (!teamMenuRef.current?.contains(event.target))
                setTeamMenuOpen(false);
        };
        const onKey = (event) => {
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
    const toggleTeamFilter = (id) => {
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
        const shown = [];
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
    const onStaffUiChangeRef = useRef(onStaffUiChange);
    onStaffUiChangeRef.current = onStaffUiChange;
    useEffect(() => {
        onStaffUiChangeRef.current?.({
            query,
            teamFilterIds: [...teamFilterIds],
            hiddenOpen,
            collapsedTeamIds: [...collapsedTeams],
        });
    }, [collapsedTeams, hiddenOpen, query, teamFilterIds]);
    const onShownEmployeesRef = useRef(onShownEmployees);
    onShownEmployeesRef.current = onShownEmployees;
    const onDirectoryRef = useRef(onDirectory);
    onDirectoryRef.current = onDirectory;
    useEffect(() => {
        const seen = new Set();
        const people = [];
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
        const seen = new Set();
        const people = [];
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
        const hidden = [];
        const seen = new Set();
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
    const changeVisibility = async (employee, hidden) => {
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
        catch (err) {
            setHideError(err instanceof Error ? err.message : 'Не удалось изменить видимость');
        }
        finally {
            setHidingKey(null);
        }
    };
    return (_jsxs("aside", { className: "vac-staff", "aria-label": "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438", children: [_jsxs("div", { className: "vac-staff__head", children: [_jsxs("div", { className: "vac-staff__title-row", children: [_jsx("p", { className: "vac-staff__title", children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438" }), _jsxs("span", { className: "vac-staff__title-actions", children: [canManage ? (_jsxs("button", { type: "button", className: `vac-staff__hidden-btn${hiddenOpen ? ' vac-staff__hidden-btn--on' : ''}`, "aria-pressed": hiddenOpen, onClick: () => setHiddenOpen((open) => !open), children: ["\u0421\u043A\u0440\u044B\u0442\u044B\u0435", allHiddenRows.length > 0 ? _jsx("span", { className: "vac-staff__team-count", children: allHiddenRows.length }) : null] })) : null, selectedIds.size > 0 ? (_jsx("span", { className: "vac-staff__count", children: selectedIds.size })) : null] })] }), _jsxs("label", { className: "vac-staff__search-wrap", children: [_jsxs("svg", { className: "vac-staff__search-icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "11", cy: "11", r: "7" }), _jsx("line", { x1: "16.5", y1: "16.5", x2: "21", y2: "21" })] }), _jsx("input", { className: "vac-staff__search", type: "search", value: query, placeholder: "\u041D\u0430\u0439\u0442\u0438 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430", "aria-label": "\u041F\u043E\u0438\u0441\u043A \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430", onChange: (event) => setQuery(event.target.value) })] }), groups.length > 0 ? (_jsxs("div", { className: "vac-staff__picker", ref: teamMenuRef, children: [_jsxs("button", { type: "button", className: `vac-staff__picker-btn${teamMenuOpen ? ' vac-staff__picker-btn--open' : ''}`, "aria-expanded": teamMenuOpen, "aria-haspopup": "listbox", onClick: () => setTeamMenuOpen((open) => !open), children: [_jsx("span", { className: "vac-staff__picker-label", children: teamFilterLabel(teamFilterIds, groups) }), _jsx("svg", { className: "vac-staff__picker-chev", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("polyline", { points: "6 9 12 15 18 9" }) })] }), teamMenuOpen ? (_jsxs("div", { className: "vac-staff__picker-menu", role: "listbox", "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u0430\u043C", "aria-multiselectable": "true", children: [_jsx("label", { className: "vac-staff__picker-search", children: _jsx("input", { type: "search", value: teamQuery, placeholder: "\u041D\u0430\u0439\u0442\u0438 \u043A\u043E\u043C\u0430\u043D\u0434\u0443", "aria-label": "\u041F\u043E\u0438\u0441\u043A \u043A\u043E\u043C\u0430\u043D\u0434\u044B", onChange: (event) => setTeamQuery(event.target.value) }) }), _jsxs("button", { type: "button", className: "vac-staff__picker-opt", onClick: () => setTeamFilterIds(new Set()), children: [_jsx("span", { className: `vac-staff__mark${teamFilterIds.size === 0 ? ' vac-staff__mark--on' : ''}`, "aria-hidden": true }), "\u0412\u0441\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u044B"] }), teamOptions.length === 0 ? (_jsx("p", { className: "vac-staff__note", children: "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430" })) : teamOptions.map((group) => {
                                        const on = teamFilterIds.has(group.id);
                                        const visibleCount = group.employees.filter((row) => !rowIsHidden(row, hiddenUsers, hiddenEmployees)).length;
                                        return (_jsxs("button", { type: "button", role: "option", "aria-selected": on, className: `vac-staff__picker-opt${on ? ' vac-staff__picker-opt--on' : ''}`, onClick: () => toggleTeamFilter(group.id), children: [_jsx("span", { className: `vac-staff__mark${on ? ' vac-staff__mark--on' : ''}`, "aria-hidden": true }), _jsx("span", { className: "vac-staff__picker-name", children: group.name }), _jsx("span", { className: "vac-staff__team-count", children: visibleCount })] }, group.id));
                                    })] })) : null] })) : null] }), _jsxs("div", { className: "vac-staff__list", children: [loading ? (_jsx("ul", { className: "vac-staff-skel", "aria-hidden": true, children: Array.from({ length: 8 }, (_, index) => (_jsxs("li", { className: "vac-staff-skel__row", children: [_jsx("span", { className: "vac-staff-skel__avatar" }), _jsxs("span", { className: "vac-staff-skel__lines", children: [_jsx("span", {}), _jsx("span", {})] })] }, index))) })) : null, error ? _jsx("p", { className: "vac-staff__note vac-staff__note--err", children: error }) : null, hideError ? _jsx("p", { className: "vac-staff__note vac-staff__note--err", children: hideError }) : null, !loading && !error && !hiddenOpen && shownGroups.length === 0 ? (_jsx("p", { className: "vac-staff__note", children: query.trim() ? 'Никого не найдено' : 'Нет сотрудников' })) : null, hiddenOpen ? (_jsxs("section", { className: "vac-staff__team vac-staff__team--hidden", children: [_jsx("h2", { className: "vac-staff__team-name", children: "\u0421\u043A\u0440\u044B\u0442\u044B\u0435 \u0434\u043B\u044F \u0432\u0441\u0435\u0445" }), allHiddenRows.length === 0 ? (_jsx("p", { className: "vac-staff__note", children: "\u0421\u043A\u0440\u044B\u0442\u044B\u0445 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432 \u043D\u0435\u0442" })) : (_jsx("ul", { className: "vac-staff__people", children: allHiddenRows.map((employee) => {
                                    const hideBody = rosterHideBody(employee);
                                    const hideKey = hideBody && ('authUserId' in hideBody ? `u:${hideBody.authUserId}` : `e:${hideBody.employeeId}`);
                                    return (_jsxs("li", { className: "vac-staff__row vac-staff__row--reveal", children: [_jsxs("div", { className: "vac-staff__person vac-staff__person--muted", children: [_jsx("span", { className: "vac-staff__avatar vac-staff__avatar--muted", "aria-hidden": true, children: personInitials(employee.label) }), _jsx("span", { className: "vac-staff__name", children: employee.label })] }), hideBody ? (_jsx("button", { type: "button", className: "vac-staff__eye vac-staff__eye--show", "aria-label": `Показать ${employee.label}`, title: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0434\u043B\u044F \u0432\u0441\u0435\u0445", disabled: hidingKey != null, onClick: () => void changeVisibility(employee, false), children: hidingKey === hideKey ? '…' : (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] })) })) : null] }, `hidden-${employee.id}`));
                                }) }))] })) : null, !hiddenOpen && shownGroups.map((group) => (_jsxs("section", { className: "vac-staff__team", children: [_jsxs("div", { className: "vac-staff__team-hd", children: [_jsxs("button", { type: "button", className: "vac-staff__team-name", "aria-expanded": !collapsedTeams.has(group.id), title: collapsedTeams.has(group.id) ? 'Развернуть команду' : 'Свернуть команду', onClick: () => {
                                            setCollapsedTeams((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(group.id))
                                                    next.delete(group.id);
                                                else
                                                    next.add(group.id);
                                                return next;
                                            });
                                        }, children: [_jsx("svg", { className: `vac-staff__team-chev${collapsedTeams.has(group.id) ? '' : ' is-open'}`, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("polyline", { points: "9 6 15 12 9 18" }) }), _jsx("span", { className: "vac-staff__team-label", title: group.name, children: group.name }), _jsx("span", { className: "vac-staff__team-count", children: group.employees.length })] }), _jsx("button", { type: "button", className: "vac-staff__team-all", onClick: () => onSelectEmployees(group.employees), children: "\u0412\u0441\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430" })] }), collapsedTeams.has(group.id) ? null : (_jsx("ul", { className: "vac-staff__people", children: group.employees.map((employee) => {
                                    const selected = selectedIds.has(employee.id);
                                    const hideBody = rosterHideBody(employee);
                                    const hideKey = hideBody && ('authUserId' in hideBody ? `u:${hideBody.authUserId}` : `e:${hideBody.employeeId}`);
                                    return (_jsxs("li", { className: "vac-staff__row", children: [_jsxs("button", { type: "button", className: `vac-staff__person${selected ? ' vac-staff__person--on' : ''}`, "aria-pressed": selected, onClick: () => onToggleEmployee(employee), children: [_jsx("span", { className: "vac-staff__avatar", style: { background: selected ? 'var(--app-accent, #4f46e5)' : avatarColor(employee.label) }, "aria-hidden": true, children: personInitials(employee.label) }), _jsxs("span", { className: "vac-staff__name", title: employee.position ? `${employee.label} · ${employee.position}` : employee.label, children: [_jsx("span", { children: employee.label }), employee.position ? _jsx("span", { className: "vac-staff__role", children: employee.position }) : null] }), _jsx("span", { className: `vac-staff__mark${selected ? ' vac-staff__mark--on' : ''}`, "aria-hidden": true })] }), canManage && hideBody ? (_jsx("button", { type: "button", className: "vac-staff__eye", "aria-label": `Скрыть ${employee.label} для всех`, title: "\u0421\u043A\u0440\u044B\u0442\u044C \u0434\u043B\u044F \u0432\u0441\u0435\u0445", disabled: hidingKey != null, onClick: () => void changeVisibility(employee, true), children: hidingKey === hideKey ? '…' : (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M3 3l18 18" }), _jsx("path", { d: "M10.6 10.6a2 2 0 002.8 2.8" }), _jsx("path", { d: "M9.9 5.2A10.8 10.8 0 0121 12c-.6 1-1.5 2.1-2.6 3.1M6.1 6.1C4.2 7.4 2.8 9.2 2 12c1.5 3.5 5.2 7 10 7 1.5 0 2.9-.3 4.2-.9" })] })) })) : null] }, `${group.id}-${employee.id}`));
                                }) }))] }, group.id)))] })] }));
}
