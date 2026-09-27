import { useEffect, useState } from 'react';
import {
    getVacationKindLegend,
    listVacationAbsenceDays,
    listVacationLeaveRequests,
    type VacationLeaveRequestApi,
} from '@entities/vacation';
import {
    coerceVacationAbsenceDayRow,
    parseVacationCellKey,
    vacationIsoDateFromParts,
    vacationMarksFromAbsenceDays,
    vacationUiLegendFallback,
    vacationUiLegendFromKindLegendApi,
    type VacationAbsenceKind,
    type VacationMarksState,
    type VacationScheduleEmployeeRow,
    type VacationUiLegendItem,
} from './vacationScheduleModel';

export type VacationCalendarStatus = 'all' | 'away' | 'planned' | 'declined';

export type VacationRosterPerson = VacationScheduleEmployeeRow & {
    teamName: string;
};

export type EmployeeAbsenceDay = {
    monthIndex: number;
    day: number;
    iso: string;
    kind: VacationAbsenceKind;
};

const PLANNED_STATUSES = new Set(['pending', 'pending_final', 'approved']);

export function useVacationCalendarFacts(year: number, seeAllRequests: boolean, reloadToken = 0) {
    const [days, setDays] = useState<ReturnType<typeof coerceVacationAbsenceDayRow>[]>([]);
    const [legend, setLegend] = useState<VacationUiLegendItem[]>(() => vacationUiLegendFallback());
    const [requests, setRequests] = useState<VacationLeaveRequestApi[]>([]);

    useEffect(() => {
        let cancelled = false;
        const from = `${year}-01-01`;
        const to = `${year}-12-31`;
        void listVacationAbsenceDays(year, { dateFrom: from, dateTo: to })
            .then((rows) => {
                if (cancelled)
                    return;
                setDays(rows.map((row) => coerceVacationAbsenceDayRow(row)).filter((row) => row != null));
            })
            .catch(() => {
                if (!cancelled)
                    setDays([]);
            });
        void getVacationKindLegend()
            .then((items) => {
                if (!cancelled)
                    setLegend(vacationUiLegendFromKindLegendApi(items));
            })
            .catch(() => {
                if (!cancelled)
                    setLegend(vacationUiLegendFallback());
            });
        void (async () => {
            try {
                const list = await listVacationLeaveRequests({
                    scope: seeAllRequests ? 'all' : 'mine',
                    status: 'any',
                });
                if (!cancelled)
                    setRequests(list);
            }
            catch {
                if (seeAllRequests) {
                    try {
                        const mine = await listVacationLeaveRequests({ scope: 'mine', status: 'any' });
                        if (!cancelled)
                            setRequests(mine);
                        return;
                    }
                    catch {
                    }
                }
                if (!cancelled)
                    setRequests([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reloadToken, seeAllRequests, year]);

    return { days, legend, requests };
}

export function marksForRoster(
    year: number,
    days: ReadonlyArray<NonNullable<ReturnType<typeof coerceVacationAbsenceDayRow>>>,
    roster: ReadonlyArray<VacationScheduleEmployeeRow>,
): VacationMarksState {
    const ids = new Set<number>(roster.map((row) => row.id));
    for (const day of days)
        ids.add(day.employee_id);
    return vacationMarksFromAbsenceDays(year, [...days], ids, roster);
}

export function indexAbsenceDays(year: number, marks: VacationMarksState): Map<number, EmployeeAbsenceDay[]> {
    const map = new Map<number, EmployeeAbsenceDay[]>();
    for (const [key, cell] of Object.entries(marks)) {
        const parsed = parseVacationCellKey(key);
        if (!parsed || parsed.year !== year)
            continue;
        const list = map.get(parsed.userId) ?? [];
        list.push({
            monthIndex: parsed.monthIndex,
            day: parsed.day,
            iso: vacationIsoDateFromParts(year, parsed.monthIndex, parsed.day),
            kind: cell.kind,
        });
        map.set(parsed.userId, list);
    }
    for (const list of map.values())
        list.sort((a, b) => a.iso.localeCompare(b.iso));
    return map;
}

function requestInYear(request: VacationLeaveRequestApi, year: number): boolean {
    return request.date_to >= `${year}-01-01` && request.date_from <= `${year}-12-31`;
}

export function requestsByUser(requests: ReadonlyArray<VacationLeaveRequestApi>): Map<number, VacationLeaveRequestApi[]> {
    const map = new Map<number, VacationLeaveRequestApi[]>();
    for (const request of requests) {
        const list = map.get(request.employee_user_id) ?? [];
        list.push(request);
        map.set(request.employee_user_id, list);
    }
    return map;
}

export function employeeMatchesStatus(
    row: VacationScheduleEmployeeRow,
    status: VacationCalendarStatus,
    year: number,
    todayIso: string,
    daysByEmployee: ReadonlyMap<number, EmployeeAbsenceDay[]>,
    requestMap: ReadonlyMap<number, VacationLeaveRequestApi[]>,
    hiddenKinds: ReadonlySet<VacationAbsenceKind>,
): boolean {
    if (status === 'all')
        return true;
    const days = (daysByEmployee.get(row.id) ?? []).filter((day) => !hiddenKinds.has(day.kind));
    const ownRequests = (row.systemUserId != null ? requestMap.get(row.systemUserId) ?? [] : [])
        .filter((request) => requestInYear(request, year));
    if (status === 'away')
        return days.some((day) => day.iso === todayIso);
    if (status === 'planned') {
        if (days.some((day) => day.iso > todayIso))
            return true;
        return ownRequests.some((request) => PLANNED_STATUSES.has(request.status) && request.date_from > todayIso);
    }
    return ownRequests.some((request) => request.status === 'declined');
}

function shiftIso(iso: string, delta: number): string {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + delta);
    return vacationIsoDateFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}

export function absenceRunAround(days: ReadonlyArray<EmployeeAbsenceDay>, todayIso: string, kind: VacationAbsenceKind): { from: string; to: string } | null {
    const sameKind = new Set(days.filter((day) => day.kind === kind).map((day) => day.iso));
    if (!sameKind.has(todayIso))
        return null;
    let from = todayIso;
    let to = todayIso;
    while (sameKind.has(shiftIso(from, -1)))
        from = shiftIso(from, -1);
    while (sameKind.has(shiftIso(to, 1)))
        to = shiftIso(to, 1);
    return { from, to };
}

const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] as const;

export function formatAbsenceRange(fromIso: string, toIso: string): string {
    const [fromYear, fromMonth, fromDay] = fromIso.split('-').map(Number);
    const [, toMonth, toDay] = toIso.split('-').map(Number);
    if (fromIso === toIso)
        return `${fromDay} ${SHORT_MONTHS[fromMonth - 1]}`;
    if (fromMonth === toMonth)
        return `${fromDay}–${toDay} ${SHORT_MONTHS[fromMonth - 1]}`;
    return `${fromDay} ${SHORT_MONTHS[fromMonth - 1]} – ${toDay} ${SHORT_MONTHS[toMonth - 1]} ${fromYear}`;
}

export function todayIsoDate(date = new Date()): string {
    return vacationIsoDateFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}
