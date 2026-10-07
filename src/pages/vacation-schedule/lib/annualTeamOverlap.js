import { listTimeTrackingTeams } from '@entities/time-tracking';
import { listVacationAbsenceDays, listVacationLeaveRequests, listVacationScheduleEmployees, } from '@entities/vacation';
import { formatRuDate, formatRuRange } from './leaveRequestDisplay';
import { absenceKindToUi } from './vacationScheduleModel';
const BOOKED_REQUEST_STATUSES = new Set(['pending', 'pending_final', 'approved']);
export function emptyAnnualOverlapCache() {
    return {
        teams: null,
        employees: new Map(),
        absences: new Map(),
        requests: null,
    };
}
function isoDay(value) {
    return value.slice(0, 10);
}
function addDaysIso(iso, days) {
    const [y, m, d] = isoDay(iso).split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, (d || 1) + days);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}`;
}
function mergeRanges(ranges) {
    const sorted = ranges
        .map((range) => ({ from: isoDay(range.from), to: isoDay(range.to) }))
        .filter((range) => range.from && range.to && range.from <= range.to)
        .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    const merged = [];
    for (const range of sorted) {
        const last = merged[merged.length - 1];
        if (last && range.from <= addDaysIso(last.to, 1)) {
            if (range.to > last.to)
                last.to = range.to;
        }
        else {
            merged.push({ ...range });
        }
    }
    return merged;
}
function rangesOverlap(a, from, to) {
    return a.from <= to && a.to >= from;
}
function formatSpan(range) {
    return range.from === range.to ? formatRuDate(range.from) : formatRuRange(range.from, range.to);
}
function teamPhrase(names) {
    if (names.length <= 1)
        return `В команде «${names[0] ?? ''}»`;
    if (names.length === 2)
        return `В командах «${names[0]}» и «${names[1]}»`;
    return 'В ваших командах';
}
function memberIds(team) {
    return [team.partner_auth_user_id, ...team.member_auth_user_ids].filter((id) => Number.isFinite(id) && id > 0);
}
/** Short warning when a teammate already has annual leave on the chosen dates. */
export function summarizeAnnualTeamOverlap(source) {
    const dateFrom = isoDay(source.dateFrom);
    const dateTo = isoDay(source.dateTo);
    if (!dateFrom || !dateTo || dateTo < dateFrom)
        return null;
    const myTeams = source.teams.filter((team) => !team.is_archived && memberIds(team).includes(source.userId));
    if (myTeams.length === 0)
        return null;
    const teammateTeams = new Map();
    for (const team of myTeams) {
        for (const id of memberIds(team)) {
            if (id === source.userId)
                continue;
            const names = teammateTeams.get(id) ?? [];
            if (!names.includes(team.name))
                names.push(team.name);
            teammateTeams.set(id, names);
        }
    }
    if (teammateTeams.size === 0)
        return null;
    const people = new Map();
    const remember = (authUserId, name, ranges) => {
        const teams = teammateTeams.get(authUserId);
        if (!teams)
            return;
        const current = people.get(authUserId) ?? {
            name: name.trim() || 'Коллега',
            teams,
            ranges: [],
        };
        const nextName = name.trim();
        if (nextName && (current.name === 'Коллега' || nextName.length > current.name.length))
            current.name = nextName;
        current.ranges.push(...ranges);
        people.set(authUserId, current);
    };
    const authByEmployeeId = new Map();
    for (const employee of source.employees) {
        if (employee.auth_user_id == null || !teammateTeams.has(employee.auth_user_id))
            continue;
        authByEmployeeId.set(employee.id, {
            authUserId: employee.auth_user_id,
            name: employee.full_name,
        });
    }
    const daysByAuth = new Map();
    for (const day of source.absenceDays) {
        if (absenceKindToUi(day.kind, day.kind_code) !== 'annual')
            continue;
        const on = isoDay(day.absence_on);
        if (!on)
            continue;
        const link = authByEmployeeId.get(day.employee_id);
        if (!link)
            continue;
        const bucket = daysByAuth.get(link.authUserId) ?? { name: link.name || day.full_name, days: [] };
        if (!bucket.name && (link.name || day.full_name))
            bucket.name = link.name || day.full_name;
        bucket.days.push(on);
        daysByAuth.set(link.authUserId, bucket);
    }
    for (const [authUserId, bucket] of daysByAuth)
        remember(authUserId, bucket.name, bucket.days.map((day) => ({ from: day, to: day })));
    for (const request of source.leaveRequests) {
        if (request.kind !== 'annual_vacation' || !BOOKED_REQUEST_STATUSES.has(request.status))
            continue;
        const from = isoDay(request.date_from);
        const to = isoDay(request.date_to);
        if (!from || !to || !rangesOverlap({ from, to }, dateFrom, dateTo))
            continue;
        remember(request.employee_user_id, request.employee_full_name, [{ from, to }]);
    }
    const hits = [];
    for (const person of people.values()) {
        const ranges = mergeRanges(person.ranges).filter((range) => rangesOverlap(range, dateFrom, dateTo));
        if (ranges.length === 0)
            continue;
        hits.push({ name: person.name, teams: person.teams, ranges });
    }
    hits.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    if (hits.length === 0)
        return null;
    const shown = hits.slice(0, 3);
    const teamNames = [...new Set(shown.flatMap((hit) => hit.teams))]
        .sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }));
    const listed = shown
        .map((hit) => `${hit.name} (${hit.ranges.map(formatSpan).join(', ')})`)
        .join(', ');
    const extra = hits.length - shown.length;
    const tail = extra > 0 ? ` и ещё ${extra}` : '';
    return `${teamPhrase(teamNames)} на эти даты уже забронирован отпуск: ${listed}${tail}.`;
}
function yearsBetween(dateFrom, dateTo) {
    const start = Number(isoDay(dateFrom).slice(0, 4));
    const end = Number(isoDay(dateTo).slice(0, 4));
    if (!Number.isFinite(start) || !Number.isFinite(end))
        return [];
    const years = [];
    for (let year = Math.min(start, end); year <= Math.max(start, end); year += 1)
        years.push(year);
    return years;
}
export async function loadAnnualTeamOverlapWarning(cache, userId, dateFrom, dateTo) {
    if (!cache.teams)
        cache.teams = await listTimeTrackingTeams();
    const years = yearsBetween(dateFrom, dateTo);
    await Promise.all(years.map(async (year) => {
        if (!cache.employees.has(year))
            cache.employees.set(year, await listVacationScheduleEmployees(year));
        if (!cache.absences.has(year))
            cache.absences.set(year, await listVacationAbsenceDays(year));
    }));
    if (cache.requests == null) {
        try {
            cache.requests = await listVacationLeaveRequests({ scope: 'all', status: 'any' });
        }
        catch {
            cache.requests = 'failed';
        }
    }
    const employees = years.flatMap((year) => cache.employees.get(year) ?? []);
    const absenceDays = years.flatMap((year) => cache.absences.get(year) ?? []);
    return summarizeAnnualTeamOverlap({
        userId,
        dateFrom,
        dateTo,
        teams: cache.teams,
        employees,
        absenceDays,
        leaveRequests: cache.requests === 'failed' ? [] : cache.requests,
    });
}
