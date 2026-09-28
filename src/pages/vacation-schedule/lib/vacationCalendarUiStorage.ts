import type { VacationAbsenceKind } from './vacationScheduleModel';

type StoredDay = { monthIndex: number; day: number };

const STORAGE_KEY = 'kl-vacation-calendar-ui-v1';

const STATUSES = ['all', 'away', 'planned', 'declined'] as const;
const KINDS = ['annual', 'sick', 'dayoff', 'business', 'remote', 'red_pass'] as const;

export type VacationCalendarStaffUi = {
    query: string;
    teamFilterIds: string[];
    hiddenOpen: boolean;
    collapsedTeamIds: string[];
};

export type VacationCalendarUiState = {
    year: number;
    viewMonth: number | null;
    monthPanelOpen: boolean;
    status: (typeof STATUSES)[number];
    hiddenKinds: VacationAbsenceKind[];
    selectedEmployeeIds: number[];
    selectedPeriod: { start: StoredDay; end: StoredDay } | null;
    staff: VacationCalendarStaffUi;
    hideLates: boolean;
};

const EMPTY_STAFF: VacationCalendarStaffUi = {
    query: '',
    teamFilterIds: [],
    hiddenOpen: false,
    collapsedTeamIds: [],
};

function numberList(value: unknown): number[] {
    if (!Array.isArray(value))
        return [];
    return value.filter((item): item is number => Number.isInteger(item) && item !== 0);
}

function stringList(value: unknown): string[] {
    if (!Array.isArray(value))
        return [];
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function readDay(value: unknown): { monthIndex: number; day: number } | null {
    if (!value || typeof value !== 'object')
        return null;
    const row = value as { monthIndex?: unknown; day?: unknown };
    if (!Number.isInteger(row.monthIndex) || !Number.isInteger(row.day))
        return null;
    const monthIndex = row.monthIndex as number;
    const day = row.day as number;
    if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31)
        return null;
    return { monthIndex, day };
}

export function loadVacationCalendarUi(): VacationCalendarUiState | null {
    if (typeof localStorage === 'undefined')
        return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const year = Number(parsed.year);
        if (!Number.isInteger(year) || year < 2000 || year > 2100)
            return null;
        const viewMonth = parsed.viewMonth == null
            ? null
            : Number(parsed.viewMonth);
        const status = STATUSES.find((item) => item === parsed.status) ?? 'all';
        const hiddenKinds = stringList(parsed.hiddenKinds).filter((kind): kind is VacationAbsenceKind => (
            KINDS.includes(kind as (typeof KINDS)[number])
        ));
        const staffRaw = parsed.staff && typeof parsed.staff === 'object'
            ? parsed.staff as Record<string, unknown>
            : {};
        const periodRaw = parsed.selectedPeriod;
        const start = periodRaw && typeof periodRaw === 'object' ? readDay((periodRaw as { start?: unknown }).start) : null;
        const end = periodRaw && typeof periodRaw === 'object' ? readDay((periodRaw as { end?: unknown }).end) : null;
        return {
            year,
            viewMonth: viewMonth != null && viewMonth >= 0 && viewMonth <= 11 ? viewMonth : null,
            monthPanelOpen: parsed.monthPanelOpen !== false,
            status,
            hiddenKinds,
            selectedEmployeeIds: numberList(parsed.selectedEmployeeIds),
            selectedPeriod: start && end ? { start, end } : null,
            staff: {
                query: typeof staffRaw.query === 'string' ? staffRaw.query : '',
                teamFilterIds: stringList(staffRaw.teamFilterIds),
                hiddenOpen: staffRaw.hiddenOpen === true,
                collapsedTeamIds: stringList(staffRaw.collapsedTeamIds),
            },
            hideLates: parsed.hideLates === true,
        };
    }
    catch {
        return null;
    }
}

export function saveVacationCalendarUi(state: VacationCalendarUiState): void {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    catch {
        // The page still works if the browser refuses to store the view.
    }
}

export function emptyVacationStaffUi(): VacationCalendarStaffUi {
    return { ...EMPTY_STAFF, teamFilterIds: [], collapsedTeamIds: [] };
}
