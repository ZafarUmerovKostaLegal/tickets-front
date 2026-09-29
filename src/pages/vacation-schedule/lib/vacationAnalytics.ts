export type AnalyticsPerson = {
    id: number;
    name: string;
    teamId: string;
    teamName: string;
};

export type AnalyticsAbsenceKind = 'annual' | 'sick' | 'dayoff';

export type AnalyticsAbsence = {
    personId: number;
    iso: string;
    kind: AnalyticsAbsenceKind;
};

export type AnalyticsInput = {
    year: number;
    todayIso: string;
    people: readonly AnalyticsPerson[];
    days: readonly AnalyticsAbsence[];
    teamLimitPercent: number;
    quotaWorkingDays: number;
};

export type AnalyticsConflictRange = {
    from: string;
    to: string;
    kind: AnalyticsAbsenceKind;
};

export type AnalyticsConflictPerson = {
    id: number;
    name: string;
    ranges: AnalyticsConflictRange[];
};

export type AnalyticsConflict = {
    teamId: string;
    teamName: string;
    from: string;
    to: string;
    max: number;
    size: number;
    people: AnalyticsConflictPerson[];
};

export type AnalyticsHeatCell = {
    percent: number;
    over: boolean;
};

export type AnalyticsEmployeeRow = {
    id: number;
    name: string;
    teamName: string;
    vacationDays: number;
    sickDays: number;
    dayOffDays: number;
    remaining: number;
    longestVacationBlock: number;
    noVacation: boolean;
    shortBlock: boolean;
    overQuota: boolean;
};

export type AnalyticsFreeWeek = {
    from: string;
    to: string;
    personDays: number;
};

export type AnalyticsReport = {
    employeeCount: number;
    teamCount: number;
    vacationWorkingDays: number;
    averageVacation: number;
    sickWorkingDays: number;
    dayOffWorkingDays: number;
    withoutVacation: number;
    conflicts: AnalyticsConflict[];
    heatmap: Array<{
        teamId: string;
        teamName: string;
        months: AnalyticsHeatCell[];
    }>;
    freeWeeks: AnalyticsFreeWeek[];
    employees: AnalyticsEmployeeRow[];
    looksAhead: boolean;
};

const NONE = 'none';
const CONTINUOUS_BLOCK_DAYS = 14;

function isoOf(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function dateOf(iso: string): Date {
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
}

export function analyticsIsWeekend(iso: string): boolean {
    const mondayIndex = (dateOf(iso).getDay() + 6) % 7;
    return mondayIndex >= 5;
}

function addDays(iso: string, days: number): string {
    const date = dateOf(iso);
    date.setDate(date.getDate() + days);
    return isoOf(date);
}

function eachDay(year: number, visit: (iso: string) => void): void {
    const cursor = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    while (cursor <= end) {
        visit(isoOf(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
}

function monthIndex(iso: string): number {
    return Number(iso.slice(5, 7)) - 1;
}

function teamLimit(size: number, percent: number): number {
    return Math.max(1, Math.floor(size * percent / 100));
}

function nextMonday(iso: string): string {
    const mondayIndex = (dateOf(iso).getDay() + 6) % 7;
    return addDays(iso, (7 - mondayIndex) % 7);
}

export function buildVacationAnalytics(input: AnalyticsInput): AnalyticsReport {
    const percent = Math.min(100, Math.max(1, input.teamLimitPercent));
    const quota = Math.max(1, input.quotaWorkingDays);
    const people = input.people.filter((person) => person.id > 0);
    const known = new Set(people.map((person) => person.id));
    const byTeam = new Map<string, AnalyticsPerson[]>();
    for (const person of people) {
        const list = byTeam.get(person.teamId) ?? [];
        list.push(person);
        byTeam.set(person.teamId, list);
    }
    const teamIds = [...byTeam.keys()]
        .filter((id) => id !== NONE)
        .sort((a, b) => (byTeam.get(a)?.[0]?.teamName ?? '').localeCompare(byTeam.get(b)?.[0]?.teamName ?? '', 'ru'));
    if (byTeam.has(NONE))
        teamIds.push(NONE);

    const away = new Map<string, Set<number>>();
    const kindDays = new Map<number, Record<AnalyticsAbsenceKind, string[]>>();
    const annualDates = new Map<number, string[]>();
    const touch = (personId: number) => {
        const current = kindDays.get(personId) ?? { annual: [], sick: [], dayoff: [] };
        kindDays.set(personId, current);
        return current;
    };
    for (const day of input.days) {
        if (!known.has(day.personId) || day.iso.slice(0, 4) !== String(input.year))
            continue;
        if (day.kind === 'annual') {
            const dates = annualDates.get(day.personId) ?? [];
            dates.push(day.iso);
            annualDates.set(day.personId, dates);
        }
        if (analyticsIsWeekend(day.iso))
            continue;
        touch(day.personId)[day.kind].push(day.iso);
        const bucket = away.get(day.iso) ?? new Set<number>();
        bucket.add(day.personId);
        away.set(day.iso, bucket);
    }

    const countOn = (iso: string, teamId: string | null): number => {
        const ids = away.get(iso);
        if (!ids)
            return 0;
        if (teamId == null)
            return ids.size;
        let count = 0;
        for (const person of byTeam.get(teamId) ?? []) {
            if (ids.has(person.id))
                count += 1;
        }
        return count;
    };

    const workingDaysByMonth = Array.from({ length: 12 }, () => 0);
    const absentByTeamMonth = new Map<string, number[]>();
    for (const teamId of teamIds)
        absentByTeamMonth.set(teamId, Array.from({ length: 12 }, () => 0));
    const companyAbsent = Array.from({ length: 12 }, () => 0);
    eachDay(input.year, (iso) => {
        if (analyticsIsWeekend(iso))
            return;
        const month = monthIndex(iso);
        workingDaysByMonth[month] += 1;
        companyAbsent[month] += countOn(iso, null);
        for (const teamId of teamIds)
            absentByTeamMonth.get(teamId)![month] += countOn(iso, teamId);
    });

    const heatRow = (teamId: string, teamName: string, size: number, totals: number[]): AnalyticsReport['heatmap'][number] => ({
        teamId,
        teamName,
        months: totals.map((absent, month) => {
            const capacity = size * workingDaysByMonth[month];
            const share = capacity > 0 ? absent / capacity : 0;
            return { percent: share, over: share * 100 > percent };
        }),
    });

    const heatmap = teamIds.map((teamId) => heatRow(
        teamId,
        byTeam.get(teamId)?.[0]?.teamName ?? teamId,
        byTeam.get(teamId)?.length ?? 0,
        absentByTeamMonth.get(teamId) ?? [],
    ));
    heatmap.push(heatRow('all', 'Вся компания', people.length, companyAbsent));

    const peopleAwayDuring = (teamId: string, from: string, to: string): AnalyticsConflictPerson[] => {
        const listed: AnalyticsConflictPerson[] = [];
        for (const person of byTeam.get(teamId) ?? []) {
            let present = false;
            for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
                if (!analyticsIsWeekend(cursor) && away.get(cursor)?.has(person.id)) {
                    present = true;
                    break;
                }
            }
            if (!present)
                continue;
            const bags = kindDays.get(person.id);
            const ranges = [
                ...clusterAbsence(annualDates.get(person.id) ?? [], 'annual'),
                ...clusterAbsence(bags?.sick ?? [], 'sick'),
                ...clusterAbsence(bags?.dayoff ?? [], 'dayoff'),
            ].filter((range) => range.from <= to && range.to >= from);
            listed.push({ id: person.id, name: person.name, ranges });
        }
        listed.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
        return listed;
    };

    const conflicts: AnalyticsConflict[] = [];
    for (const teamId of teamIds) {
        if (teamId === NONE)
            continue;
        const size = byTeam.get(teamId)?.length ?? 0;
        const limit = teamLimit(size, percent);
        let current: AnalyticsConflict | null = null;
        const closeConflict = (item: AnalyticsConflict) => {
            item.people = peopleAwayDuring(item.teamId, item.from, item.to);
            conflicts.push(item);
        };
        eachDay(input.year, (iso) => {
            if (analyticsIsWeekend(iso))
                return;
            const count = countOn(iso, teamId);
            if (count > limit) {
                if (current) {
                    current.to = iso;
                    current.max = Math.max(current.max, count);
                }
                else {
                    current = {
                        teamId,
                        teamName: byTeam.get(teamId)?.[0]?.teamName ?? teamId,
                        from: iso,
                        to: iso,
                        max: count,
                        size,
                        people: [],
                    };
                }
            }
            else if (current) {
                closeConflict(current);
                current = null;
            }
        });
        if (current)
            closeConflict(current);
    }

    const yearStart = `${input.year}-01-01`;
    const yearEnd = `${input.year}-12-31`;
    const looksAhead = input.todayIso <= yearEnd;
    const horizonStart = input.todayIso < yearStart || input.todayIso > yearEnd
        ? yearStart
        : nextMonday(input.todayIso);
    const freeWeeks: AnalyticsFreeWeek[] = [];
    for (let monday = nextMonday(horizonStart); monday <= yearEnd; monday = addDays(monday, 7)) {
        const friday = addDays(monday, 4);
        if (friday > yearEnd)
            break;
        let personDays = 0;
        for (let cursor = monday; cursor <= friday; cursor = addDays(cursor, 1))
            personDays += countOn(cursor, null);
        freeWeeks.push({ from: monday, to: friday, personDays });
    }
    const quietest = freeWeeks
        .slice()
        .sort((a, b) => a.personDays - b.personDays || a.from.localeCompare(b.from))
        .slice(0, 5)
        .sort((a, b) => a.from.localeCompare(b.from));

    const employees: AnalyticsEmployeeRow[] = people.map((person) => {
        const bags = kindDays.get(person.id) ?? { annual: [], sick: [], dayoff: [] };
        const annual = [...new Set(annualDates.get(person.id) ?? [])].sort();
        const vacationDays = new Set(bags.annual).size;
        let longest = 0;
        let runFrom = '';
        let runTo = '';
        for (const iso of annual) {
            if (!runFrom || !continuesAbsence(runTo, iso)) {
                if (runFrom)
                    longest = Math.max(longest, calendarDaysBetween(runFrom, runTo));
                runFrom = iso;
            }
            runTo = iso;
        }
        if (runFrom)
            longest = Math.max(longest, calendarDaysBetween(runFrom, runTo));
        return {
            id: person.id,
            name: person.name,
            teamName: person.teamName,
            vacationDays,
            sickDays: new Set(bags.sick).size,
            dayOffDays: new Set(bags.dayoff).size,
            remaining: quota - vacationDays,
            longestVacationBlock: longest,
            noVacation: vacationDays === 0,
            shortBlock: vacationDays > 0 && longest < CONTINUOUS_BLOCK_DAYS,
            overQuota: vacationDays > quota,
        };
    }).sort((a, b) => b.vacationDays - a.vacationDays || a.name.localeCompare(b.name, 'ru'));

    const vacationWorkingDays = employees.reduce((sum, row) => sum + row.vacationDays, 0);
    const sickWorkingDays = employees.reduce((sum, row) => sum + row.sickDays, 0);
    const dayOffWorkingDays = employees.reduce((sum, row) => sum + row.dayOffDays, 0);
    return {
        employeeCount: people.length,
        teamCount: teamIds.filter((id) => id !== NONE).length,
        vacationWorkingDays,
        averageVacation: people.length > 0 ? vacationWorkingDays / people.length : 0,
        sickWorkingDays,
        dayOffWorkingDays,
        withoutVacation: employees.filter((row) => row.noVacation).length,
        conflicts,
        heatmap,
        freeWeeks: quietest,
        employees,
        looksAhead,
    };
}

function clusterAbsence(dates: readonly string[], kind: AnalyticsAbsenceKind): AnalyticsConflictRange[] {
    const unique = [...new Set(dates)].sort();
    const ranges: AnalyticsConflictRange[] = [];
    let from = '';
    let to = '';
    const push = () => {
        if (from)
            ranges.push({ from, to, kind });
    };
    for (const iso of unique) {
        if (!from || !continuesAbsence(to, iso)) {
            push();
            from = iso;
        }
        to = iso;
    }
    push();
    return ranges;
}

function continuesAbsence(previous: string, next: string): boolean {
    let cursor = addDays(previous, 1);
    while (cursor < next) {
        if (!analyticsIsWeekend(cursor))
            return false;
        cursor = addDays(cursor, 1);
    }
    return cursor === next;
}

function calendarDaysBetween(from: string, to: string): number {
    const ms = dateOf(to).getTime() - dateOf(from).getTime();
    return Math.round(ms / 86_400_000) + 1;
}

const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] as const;

export function formatAnalyticsDay(iso: string): string {
    const month = Number(iso.slice(5, 7)) - 1;
    const day = Number(iso.slice(8, 10));
    return `${day} ${SHORT_MONTHS[month] ?? ''}`;
}

export function formatAnalyticsRange(from: string, to: string): string {
    if (from === to)
        return formatAnalyticsDay(from);
    if (from.slice(0, 7) === to.slice(0, 7))
        return `${Number(from.slice(8, 10))}–${formatAnalyticsDay(to)}`;
    return `${formatAnalyticsDay(from)} – ${formatAnalyticsDay(to)}`;
}
