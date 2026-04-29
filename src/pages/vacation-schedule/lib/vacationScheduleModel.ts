import type { User } from '@entities/user';
import type { VacationAbsenceDayApi, VacationKindLegendItemApi } from '@entities/vacation';
export type VacationScheduleEmployeeRow = {
    id: number;
    label: string;
    excelRowNo?: number | null;
    plannedPeriodNote?: string | null;
};
export const VACATION_ABSENCE_KINDS = ['annual', 'sick', 'dayoff', 'business', 'remote'] as const;
export type VacationAbsenceKind = (typeof VACATION_ABSENCE_KINDS)[number];
export const VACATION_ABSENCE_LEGEND: ReadonlyArray<{
    kind: VacationAbsenceKind;
    color: string;
    label: string;
}> = [
    { kind: 'annual', color: '#d9b3ff', label: 'ежегодный отпуск' },
    { kind: 'sick', color: '#ff9999', label: 'отсутствие по болезни' },
    { kind: 'dayoff', color: '#33ccff', label: 'Day Off (нерабочий)' },
    { kind: 'business', color: '#99e699', label: 'командировка' },
    { kind: 'remote', color: '#ffff00', label: 'дистанционный режим' },
];
export const VACATION_KIND_COLORS: Record<VacationAbsenceKind, string> = Object.fromEntries(VACATION_ABSENCE_LEGEND.map((x) => [x.kind, x.color])) as Record<VacationAbsenceKind, string>;
const API_KIND_TO_UI: Partial<Record<string, VacationAbsenceKind>> = {
    annual_vacation: 'annual',
    sick_leave: 'sick',
    day_off: 'dayoff',
    business_trip: 'business',
    remote_work: 'remote',
};
export function apiAbsenceKindToUi(kind: string): VacationAbsenceKind | undefined {
    return API_KIND_TO_UI[kind];
}
const KIND_CODE_TO_UI: Partial<Record<number, VacationAbsenceKind>> = {
    1: 'annual',
    2: 'sick',
    3: 'dayoff',
    4: 'business',
    5: 'remote',
};
export function absenceKindToUi(kind: string | undefined, kindCode: number): VacationAbsenceKind | undefined {
    const fromStr = kind ? apiAbsenceKindToUi(kind) : undefined;
    if (fromStr)
        return fromStr;
    return KIND_CODE_TO_UI[kindCode];
}
export function vacationKindHumanLabel(kind: VacationAbsenceKind): string {
    const x = VACATION_ABSENCE_LEGEND.find((l) => l.kind === kind);
    return x?.label ?? kind;
}
export function vacationLegendForUi(kindCodes: Record<string, string> | null | undefined): ReadonlyArray<(typeof VACATION_ABSENCE_LEGEND)[number]> {
    if (!kindCodes || Object.keys(kindCodes).length === 0) {
        return VACATION_ABSENCE_LEGEND;
    }
    const ordered = Object.keys(kindCodes)
        .filter((k) => /^\d+$/.test(k))
        .sort((a, b) => Number(a) - Number(b))
        .map((code) => kindCodes[code])
        .map((apiKind) => apiAbsenceKindToUi(apiKind))
        .filter((k): k is VacationAbsenceKind => k != null)
        .map((uiKind) => VACATION_ABSENCE_LEGEND.find((x) => x.kind === uiKind))
        .filter((x): x is (typeof VACATION_ABSENCE_LEGEND)[number] => x != null);
    return ordered.length > 0 ? ordered : VACATION_ABSENCE_LEGEND;
}
export type VacationUiLegendItem = {
    kind: VacationAbsenceKind;
    kindCode: number;
    label: string;
    color: string;
};
export function vacationUiLegendFallback(): VacationUiLegendItem[] {
    return VACATION_ABSENCE_LEGEND.map((x, i) => ({
        kind: x.kind,
        kindCode: i + 1,
        label: x.label,
        color: x.color,
    }));
}
export function vacationUiLegendFromKindLegendApi(items: VacationKindLegendItemApi[] | null | undefined): VacationUiLegendItem[] {
    if (!items?.length)
        return vacationUiLegendFallback();
    const sorted = [...items].sort((a, b) => a.kind_code - b.kind_code);
    const out: VacationUiLegendItem[] = [];
    for (const it of sorted) {
        const kind = absenceKindToUi(it.kind, it.kind_code);
        if (!kind)
            continue;
        const hex = it.color_hex?.trim();
        const color = hex && /^#[0-9a-fA-F]{3,8}$/.test(hex) ? hex : VACATION_KIND_COLORS[kind];
        out.push({
            kind,
            kindCode: it.kind_code,
            label: it.label_ru?.trim() || vacationKindHumanLabel(kind),
            color,
        });
    }
    return out.length > 0 ? out : vacationUiLegendFallback();
}
export function vacationUiLegendFromKindCodes(kindCodes: Record<string, string> | null | undefined): VacationUiLegendItem[] {
    const rows = vacationLegendForUi(kindCodes);
    const codeByKind = new Map<VacationAbsenceKind, number>();
    if (kindCodes) {
        for (const [code, apiKind] of Object.entries(kindCodes)) {
            if (!/^\d+$/.test(code))
                continue;
            const ui = apiAbsenceKindToUi(apiKind);
            if (ui)
                codeByKind.set(ui, Number(code));
        }
    }
    return rows.map((r, i) => ({
        kind: r.kind,
        kindCode: codeByKind.get(r.kind) ?? i + 1,
        label: r.label,
        color: r.color,
    }));
}
export const VACATION_MONTH_NAMES = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
] as const;
export type VacationYearDayColumn = {
    monthIndex: number;
    day: number;
    colIndex: number;
};
function userSortLabel(u: User): string {
    return (u.display_name?.trim() || u.email || '').toLowerCase();
}
export function vacationScheduleEmployees(users: User[]): {
    id: number;
    label: string;
}[] {
    return users
        .sort((a, b) => userSortLabel(a).localeCompare(userSortLabel(b), 'ru'))
        .map((u) => ({ id: u.id, label: u.display_name?.trim() || u.email }));
}
export function vacationDaysInMonth(year: number, monthIndex: number): number {
    return new Date(year, monthIndex + 1, 0).getDate();
}
export function vacationWeekdayShortRu(year: number, monthIndex: number, dayOfMonth: number): string {
    const d = new Date(year, monthIndex, dayOfMonth);
    const mon0 = (d.getDay() + 6) % 7;
    return ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'][mon0]!;
}
export function vacationDayIsWeekendRu(year: number, monthIndex: number, dayOfMonth: number): boolean {
    const d = new Date(year, monthIndex, dayOfMonth);
    const mon0 = (d.getDay() + 6) % 7;
    return mon0 >= 5;
}
export function vacationYearDayColumns(year: number): VacationYearDayColumn[] {
    const out: VacationYearDayColumn[] = [];
    let colIndex = 0;
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        const n = vacationDaysInMonth(year, monthIndex);
        for (let day = 1; day <= n; day += 1) {
            out.push({ monthIndex, day, colIndex });
            colIndex += 1;
        }
    }
    return out;
}
export function vacationMonthHeaderSpans(dayColumns: VacationYearDayColumn[]): {
    monthIndex: number;
    span: number;
}[] {
    const spans: {
        monthIndex: number;
        span: number;
    }[] = [];
    for (const col of dayColumns) {
        const last = spans[spans.length - 1];
        if (last && last.monthIndex === col.monthIndex)
            last.span += 1;
        else
            spans.push({ monthIndex: col.monthIndex, span: 1 });
    }
    return spans;
}
export function vacationCellKey(userId: number, year: number, monthIndex: number, day: number): string {
    return `${year}|${monthIndex}|${day}|${userId}`;
}
export function parseVacationCellKey(key: string): {
    year: number;
    monthIndex: number;
    day: number;
    userId: number;
} | null {
    const parts = key.split('|');
    if (parts.length !== 4)
        return null;
    const year = Number(parts[0]);
    const monthIndex = Number(parts[1]);
    const day = Number(parts[2]);
    const userId = Number(parts[3]);
    if (![year, monthIndex, day, userId].every((n) => Number.isFinite(n)))
        return null;
    return { year, monthIndex, day, userId };
}
const MARKS_STORAGE_KEY = 'kl-vacation-marks-v1';
const MARKS_VERSION = 2 as const;
export type VacationMarkCell = {
    kind: VacationAbsenceKind;
    kindCode: number;
    absenceDayId?: number;
};
export type VacationMarksState = Record<string, VacationMarkCell>;
function parseIsoDateParts(iso: string): {
    year: number;
    monthIndex: number;
    day: number;
} | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m)
        return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (![year, month, day].every((n) => Number.isFinite(n)))
        return null;
    if (month < 1 || month > 12 || day < 1 || day > 31)
        return null;
    return { year, monthIndex: month - 1, day };
}
export function coerceVacationAbsenceDayRow(raw: unknown): VacationAbsenceDayApi | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const employeeIdRaw = o.employee_id ?? o.employeeId ?? o.schedule_employee_id;
    const employee_id = Number(employeeIdRaw);
    if (!Number.isFinite(employee_id))
        return null;
    const absence_on = typeof o.absence_on === 'string'
        ? o.absence_on
        : typeof o.date === 'string'
            ? o.date
            : '';
    if (!absence_on)
        return null;
    const kind_code = Number(o.kind_code ?? o.kindCode);
    if (!Number.isFinite(kind_code))
        return null;
    const kind = typeof o.kind === 'string' ? o.kind : '';
    const full_name = typeof o.full_name === 'string' ? o.full_name : '';
    const idRaw = o.id;
    const id = idRaw != null && idRaw !== '' ? Number(idRaw) : undefined;
    const row: VacationAbsenceDayApi = {
        employee_id,
        full_name,
        absence_on,
        kind_code,
        kind,
    };
    if (Number.isFinite(id))
        row.id = id;
    return row;
}
export function vacationMarksFromAbsenceDays(year: number, days: VacationAbsenceDayApi[], employeeIds: Set<number>): VacationMarksState {
    const out: VacationMarksState = {};
    for (const d of days) {
        if (!employeeIds.has(d.employee_id))
            continue;
        const parsed = parseIsoDateParts(d.absence_on);
        if (!parsed || parsed.year !== year)
            continue;
        const uiKind = absenceKindToUi(d.kind, d.kind_code);
        if (!uiKind)
            continue;
        const key = vacationCellKey(d.employee_id, year, parsed.monthIndex, parsed.day);
        const cell: VacationMarkCell = { kind: uiKind, kindCode: d.kind_code };
        if (Number.isFinite(d.id))
            cell.absenceDayId = d.id;
        out[key] = cell;
    }
    return out;
}
export function vacationIsoDateFromParts(year: number, monthIndex: number, day: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function loadVacationMarks(year: number): VacationMarksState {
    try {
        const raw = localStorage.getItem(MARKS_STORAGE_KEY);
        if (!raw)
            return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object')
            return {};
        const box = parsed as {
            version?: unknown;
            year?: unknown;
            marks?: unknown;
        };
        if (box.year !== year)
            return {};
        const marks = box.marks;
        if (!marks || typeof marks !== 'object')
            return {};
        const out: VacationMarksState = {};
        if (box.version === MARKS_VERSION) {
            for (const [k, v] of Object.entries(marks as Record<string, unknown>)) {
                if (!v || typeof v !== 'object')
                    continue;
                const o = v as Record<string, unknown>;
                const kind = o.kind;
                const absenceDayId = o.absenceDayId;
                const kindCode = o.kindCode;
                if (typeof kind === 'string' &&
                    (VACATION_ABSENCE_KINDS as readonly string[]).includes(kind) &&
                    typeof kindCode === 'number') {
                    const cell: VacationMarkCell = { kind: kind as VacationAbsenceKind, kindCode };
                    if (typeof absenceDayId === 'number')
                        cell.absenceDayId = absenceDayId;
                    out[k] = cell;
                }
            }
            return out;
        }
        return {};
    }
    catch {
        return {};
    }
}
export function saveVacationMarks(year: number, marks: VacationMarksState): void {
    try {
        localStorage.setItem(MARKS_STORAGE_KEY, JSON.stringify({ version: MARKS_VERSION, year, marks }));
    }
    catch {
    }
}
export function vacationCountMarkedDaysForUser(marks: VacationMarksState, userId: number, year: number): number {
    let n = 0;
    for (const key of Object.keys(marks)) {
        const p = parseVacationCellKey(key);
        if (p && p.userId === userId && p.year === year)
            n += 1;
    }
    return n;
}
export function vacationCountMarkedDaysForUserInMonth(marks: VacationMarksState, userId: number, year: number, monthIndex: number): number {
    const nDays = vacationDaysInMonth(year, monthIndex);
    let n = 0;
    for (let d = 1; d <= nDays; d += 1) {
        if (marks[vacationCellKey(userId, year, monthIndex, d)] != null)
            n += 1;
    }
    return n;
}
