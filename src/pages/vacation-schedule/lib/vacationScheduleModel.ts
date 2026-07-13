import type { User } from '@entities/user';
import type { VacationAbsenceDayApi, VacationAttendanceMarkerApi, VacationKindLegendItemApi } from '@entities/vacation';
import { isHiddenSystemUser } from '@shared/lib';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
export type VacationScheduleEmployeeRow = {
    id: number;
    label: string;
    excelRowNo?: number | null;
    plannedPeriodNote?: string | null;
    systemOnly?: boolean;
    systemUserId?: number;
    email?: string | null;
    
    isPartner?: boolean;
};
export const VACATION_ABSENCE_KINDS = ['annual', 'sick', 'dayoff', 'business', 'remote', 'red_pass'] as const;
export type VacationAbsenceKind = (typeof VACATION_ABSENCE_KINDS)[number];
export const VACATION_ABSENCE_LEGEND: ReadonlyArray<{
    kind: VacationAbsenceKind;
    color: string;
    label: string;
}> = [
        { kind: 'annual', color: '#9C27FF', label: 'Ежегодный отпуск' },
        { kind: 'sick', color: '#FF1493', label: 'Отсутствие по болезни' },
        { kind: 'dayoff', color: '#2196F3', label: 'Day Off (нерабочий)' },
        { kind: 'business', color: '#00E676', label: 'Командировка' },
        { kind: 'remote', color: '#FFEB3B', label: 'Дистанционный режим' },
        { kind: 'red_pass', color: '#FF1744', label: 'Пропуск красного цвета' },
    ];
export const VACATION_KIND_COLORS: Record<VacationAbsenceKind, string> = Object.fromEntries(VACATION_ABSENCE_LEGEND.map((x) => [x.kind, x.color])) as Record<VacationAbsenceKind, string>;


export const VACATION_KIND_SEALS: Record<VacationAbsenceKind, string> = {
    annual: 'О',
    sick: 'Б',
    dayoff: 'D',
    business: 'К',
    remote: 'Р',
    red_pass: '!',
};


const VACATION_KIND_SEAL_DARK_INK: ReadonlySet<VacationAbsenceKind> = new Set(['remote', 'business']);

export function vacationKindSeal(kind: VacationAbsenceKind): string {
    return VACATION_KIND_SEALS[kind];
}

export function vacationKindSealUsesDarkInk(kind: VacationAbsenceKind): boolean {
    return VACATION_KIND_SEAL_DARK_INK.has(kind);
}

const API_KIND_TO_UI: Partial<Record<string, VacationAbsenceKind>> = {
    annual_vacation: 'annual',
    sick_leave: 'sick',
    day_off: 'dayoff',
    business_trip: 'business',
    remote_work: 'remote',
    red_pass: 'red_pass',
    red_badge_pass: 'red_pass',
    red_permit: 'red_pass',
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
    6: 'red_pass',
};
function defaultKindCodeForUi(kind: VacationAbsenceKind): number {
    const hit = Object.entries(KIND_CODE_TO_UI).find(([, v]) => v === kind);
    return hit ? Number(hit[0]) : 0;
}
function mergeVacationUiLegend(items: VacationUiLegendItem[]): VacationUiLegendItem[] {
    const byKind = new Map(items.map((x) => [x.kind, x]));
    const merged: VacationUiLegendItem[] = [];
    for (const fb of VACATION_ABSENCE_LEGEND) {
        const existing = byKind.get(fb.kind);
        if (existing) {
            merged.push(existing.seal ? existing : { ...existing, seal: vacationKindSeal(existing.kind) });
            byKind.delete(fb.kind);
        }
        else {
            merged.push({
                kind: fb.kind,
                kindCode: defaultKindCodeForUi(fb.kind),
                label: fb.label,
                color: fb.color,
                seal: vacationKindSeal(fb.kind),
            });
        }
    }
    for (const extra of byKind.values())
        merged.push(extra.seal ? extra : { ...extra, seal: vacationKindSeal(extra.kind) });
    return merged;
}
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
    seal: string;
};
export function vacationUiLegendFallback(): VacationUiLegendItem[] {
    return VACATION_ABSENCE_LEGEND.map((x, i) => ({
        kind: x.kind,
        kindCode: defaultKindCodeForUi(x.kind) || i + 1,
        label: x.label,
        color: x.color,
        seal: vacationKindSeal(x.kind),
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
        out.push({
            kind,
            kindCode: it.kind_code,
            label: it.label_ru?.trim() || vacationKindHumanLabel(kind),
            color: VACATION_KIND_COLORS[kind],
            seal: vacationKindSeal(kind),
        });
    }
    return mergeVacationUiLegend(out.length > 0 ? out : vacationUiLegendFallback());
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
    return mergeVacationUiLegend(rows.map((r, i) => ({
        kind: r.kind,
        kindCode: codeByKind.get(r.kind) ?? (defaultKindCodeForUi(r.kind) || i + 1),
        label: r.label,
        color: r.color,
        seal: vacationKindSeal(r.kind),
    })));
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


export function normalizeVacationFullName(value: string | null | undefined): string {
    if (!value)
        return '';
    return value
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ');
}


export function vacationSystemRowId(userId: number): number {
    return -Math.abs(userId);
}

export function isVacationSystemRowId(id: number): boolean {
    return id < 0;
}


export function buildVacationScheduleRowsFromUsers(
    users: ReadonlyArray<{ id: number; display_name?: string | null; email?: string | null; is_archived?: boolean; is_blocked?: boolean }>,
    scheduleRows: ReadonlyArray<VacationScheduleEmployeeRow> = [],
): VacationScheduleEmployeeRow[] {
    const scheduleByName = new Map<string, VacationScheduleEmployeeRow>();
    for (const row of scheduleRows) {
        const norm = normalizeVacationFullName(row.label);
        if (norm && !scheduleByName.has(norm))
            scheduleByName.set(norm, row);
    }

    const seen = new Set<number>();
    const usedScheduleRowIds = new Set<number>();
    const rows: VacationScheduleEmployeeRow[] = [];
    for (const u of users) {
        if (!u.id || seen.has(u.id))
            continue;
        if (u.is_archived || u.is_blocked)
            continue;
        if (isHiddenSystemUser(u))
            continue;
        const label = (u.display_name?.trim() || u.email?.trim() || '').trim();
        if (!label)
            continue;
        seen.add(u.id);
        const email = u.email?.trim() ?? null;
        const norm = normalizeVacationFullName(label);
        const linked = norm ? scheduleByName.get(norm) : undefined;
        if (linked) {
            rows.push({
                id: linked.id,
                label,
                excelRowNo: linked.excelRowNo ?? null,
                plannedPeriodNote: linked.plannedPeriodNote ?? null,
                systemUserId: linked.systemUserId ?? u.id,
                email: linked.email ?? email,
            });
            usedScheduleRowIds.add(linked.id);
        }
        else {
            rows.push({
                id: vacationSystemRowId(u.id),
                label,
                excelRowNo: null,
                plannedPeriodNote: null,
                systemOnly: true,
                systemUserId: u.id,
                email,
            });
        }
    }

    for (const row of scheduleRows) {
        if (usedScheduleRowIds.has(row.id))
            continue;
        rows.push({
            id: row.id,
            label: row.label,
            excelRowNo: row.excelRowNo ?? null,
            plannedPeriodNote: row.plannedPeriodNote ?? null,
            systemUserId: row.systemUserId,
            email: row.email ?? null,
        });
    }

    rows.sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
    return rows;
}

type VacationScheduleUserOrgRef = {
    id: number;
    role?: string | null;
    position?: string | null;
    display_name?: string | null;
    email?: string | null;
    is_archived?: boolean;
    is_blocked?: boolean;
};

export type VacationPartnerUserRef = {
    user_id: number;
    display_name: string;
    email: string;
    position?: string | null;
};

type VacationScheduleMergedUser = VacationScheduleUserOrgRef & {
    picture: string | null;
    time_tracking_role: null;
    created_at: string;
    updated_at: null;
    desktop_background: null;
};


export function mergeUsersWithVacationPartners(
    users: ReadonlyArray<VacationScheduleUserOrgRef>,
    partners: ReadonlyArray<VacationPartnerUserRef>,
): VacationScheduleMergedUser[] {
    const byId = new Map<number, VacationScheduleMergedUser>();
    for (const user of users) {
        if (!user.id)
            continue;
        byId.set(user.id, {
            id: user.id,
            email: user.email ?? '',
            display_name: user.display_name ?? null,
            picture: null,
            role: user.role ?? '',
            position: user.position ?? null,
            is_blocked: user.is_blocked ?? false,
            is_archived: user.is_archived ?? false,
            time_tracking_role: null,
            created_at: '',
            updated_at: null,
            desktop_background: null,
        });
    }
    for (const partner of partners) {
        const id = partner.user_id;
        if (!id)
            continue;
        const existing = byId.get(id);
        if (existing) {
            byId.set(id, {
                ...existing,
                role: existing.role?.trim() ? existing.role : 'Партнер',
                position: existing.position ?? partner.position ?? null,
                display_name: existing.display_name?.trim()
                    ? existing.display_name
                    : (partner.display_name || existing.display_name),
                email: existing.email?.trim() ? existing.email : partner.email,
            });
            continue;
        }
        byId.set(id, {
            id,
            email: partner.email,
            display_name: partner.display_name || partner.email || `Партнёр ${id}`,
            picture: null,
            role: 'Партнер',
            position: partner.position ?? null,
            is_blocked: false,
            is_archived: false,
            time_tracking_role: null,
            created_at: '',
            updated_at: null,
            desktop_background: null,
        });
    }
    return [...byId.values()];
}

export function collectPartnerAuthUserIds(
    users: ReadonlyArray<VacationScheduleUserOrgRef>,
    extraPartnerIds: ReadonlyArray<number> | ReadonlySet<number> = [],
): Set<number> {
    const partnerUserIds = new Set<number>(extraPartnerIds);
    for (const user of users) {
        if (user.id && isPartnerOrgRole(user.role, user.position))
            partnerUserIds.add(user.id);
    }
    return partnerUserIds;
}

/** Flag partner rows so the grid can show vacation without attendance. */
export function markVacationSchedulePartnerRows(
    rows: ReadonlyArray<VacationScheduleEmployeeRow>,
    users: ReadonlyArray<VacationScheduleUserOrgRef>,
    extraPartnerIds: ReadonlyArray<number> | ReadonlySet<number> = [],
): VacationScheduleEmployeeRow[] {
    const partnerUserIds = collectPartnerAuthUserIds(users, extraPartnerIds);
    if (partnerUserIds.size === 0)
        return [...rows];
    return rows.map((row) => (
        row.systemUserId != null && partnerUserIds.has(row.systemUserId)
            ? { ...row, isPartner: true }
            : row
    ));
}

export function filterVacationScheduleRowsExcludingPartners(
    rows: ReadonlyArray<VacationScheduleEmployeeRow>,
    users: ReadonlyArray<VacationScheduleUserOrgRef>,
): VacationScheduleEmployeeRow[] {
    const partnerUserIds = collectPartnerAuthUserIds(users);
    return rows.filter((row) => row.systemUserId == null || !partnerUserIds.has(row.systemUserId));
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
export type VacationAttendanceWorkday = {
    startTime: string;
    lateMinutes: number;
};

export function vacationAttendanceClockMinutes(iso: string | null | undefined): number | null {
    if (!iso)
        return null;
    const trimmed = iso.trim();
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime()))
        return d.getHours() * 60 + d.getMinutes();
    const m = /(?:T|\s)(\d{2}):(\d{2})/.exec(trimmed);
    if (m) {
        const h = Number(m[1]);
        const min = Number(m[2]);
        if (Number.isFinite(h) && Number.isFinite(min) && h >= 0 && h < 24 && min >= 0 && min < 60)
            return h * 60 + min;
    }
    return null;
}
export function vacationAttendanceArrivalClock(firstEventTime: string | null | undefined): string | null {
    const minutes = vacationAttendanceClockMinutes(firstEventTime);
    if (minutes == null)
        return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function vacationAttendanceLateMinutes(firstEventTime: string | null | undefined, workday: VacationAttendanceWorkday): number | null {
    const arrived = vacationAttendanceClockMinutes(firstEventTime);
    if (arrived == null)
        return null;
    const [sh, sm] = workday.startTime.split(':').map((v) => Number(v));
    const threshold = (sh || 0) * 60 + (sm || 0) + workday.lateMinutes;
    const delta = arrived - threshold;
    return delta > 0 ? delta : null;
}
export function formatVacationLateMinutes(minutes: number): string {
    if (minutes >= 60) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}ч${m}м` : `${h}ч`;
    }
    return `${minutes}м`;
}
export function vacationAttendanceLateLabel(firstEventTime: string | null | undefined, workday: VacationAttendanceWorkday): string | null {
    const minutes = vacationAttendanceLateMinutes(firstEventTime, workday);
    if (minutes == null || minutes <= 0)
        return null;
    return `+${formatVacationLateMinutes(minutes)}`;
}
export function vacationAttendanceLateTooltip(firstEventTime: string | null | undefined, workday: VacationAttendanceWorkday): string | null {
    const minutes = vacationAttendanceLateMinutes(firstEventTime, workday);
    if (minutes == null || minutes <= 0)
        return null;
    const clock = vacationAttendanceArrivalClock(firstEventTime);
    const minsText = minutes === 1 ? '1 минуту' : minutes < 5 ? `${minutes} минуты` : `${minutes} минут`;
    return clock ? `Опоздание на ${minsText} (приход ${clock})` : `Опоздание на ${minsText}`;
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
export type VacationAttendanceStatus = 'late' | 'absent';
export type VacationAttendanceMarkCell = {
    status: VacationAttendanceStatus;
    firstEventTime?: string | null;
    cameraEmployeeNo?: string | null;
    explanationText?: string | null;
    explanationFileUrl?: string | null;
};
export type VacationAttendanceMarksState = Record<string, VacationAttendanceMarkCell>;

export function vacationRowMarkRunEdges(userId: number, year: number, dayColumns: VacationYearDayColumn[], marks: VacationMarksState): {
    runStartKeys: Set<string>;
    runEndKeys: Set<string>;
} {
    const runStartKeys = new Set<string>();
    const runEndKeys = new Set<string>();
    const n = dayColumns.length;
    for (let i = 0; i < n; i += 1) {
        const col = dayColumns[i]!;
        const key = vacationCellKey(userId, year, col.monthIndex, col.day);
        const kind = marks[key]?.kind;
        if (!kind)
            continue;
        const prevCol = i > 0 ? dayColumns[i - 1]! : undefined;
        const prevKind = prevCol ? marks[vacationCellKey(userId, year, prevCol.monthIndex, prevCol.day)]?.kind : undefined;
        const nextCol = i < n - 1 ? dayColumns[i + 1]! : undefined;
        const nextKind = nextCol ? marks[vacationCellKey(userId, year, nextCol.monthIndex, nextCol.day)]?.kind : undefined;
        if (kind !== prevKind)
            runStartKeys.add(key);
        if (kind !== nextKind)
            runEndKeys.add(key);
    }
    return { runStartKeys, runEndKeys };
}
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
export function vacationMarksFromAbsenceDays(
    year: number,
    days: VacationAbsenceDayApi[],
    employeeIds: Set<number>,
    rows: ReadonlyArray<VacationScheduleEmployeeRow> = [],
): VacationMarksState {
    const nameToRowId = new Map<string, number>();
    for (const row of rows) {
        const norm = normalizeVacationFullName(row.label);
        if (norm && !nameToRowId.has(norm))
            nameToRowId.set(norm, row.id);
    }
    const out: VacationMarksState = {};
    for (const d of days) {
        let rowId = d.employee_id;
        if (!employeeIds.has(rowId)) {
            const byName = nameToRowId.get(normalizeVacationFullName(d.full_name));
            if (byName == null)
                continue;
            rowId = byName;
        }
        const parsed = parseIsoDateParts(d.absence_on);
        if (!parsed || parsed.year !== year)
            continue;
        const uiKind = absenceKindToUi(d.kind, d.kind_code);
        if (!uiKind)
            continue;
        const key = vacationCellKey(rowId, year, parsed.monthIndex, parsed.day);
        const cell: VacationMarkCell = { kind: uiKind, kindCode: d.kind_code };
        if (Number.isFinite(d.id))
            cell.absenceDayId = d.id;
        out[key] = cell;
    }
    return out;
}
export function vacationAttendanceMarksFromApi(
    year: number,
    markers: VacationAttendanceMarkerApi[],
    rows: ReadonlyArray<VacationScheduleEmployeeRow>,
): VacationAttendanceMarksState {
    const rowIdByAuthUserId = new Map<number, number>();
    for (const row of rows) {
        if (row.isPartner)
            continue;
        if (row.systemUserId != null)
            rowIdByAuthUserId.set(row.systemUserId, row.id);
    }
    const out: VacationAttendanceMarksState = {};
    for (const marker of markers) {
        const rowId = rowIdByAuthUserId.get(marker.app_user_id);
        if (rowId == null)
            continue;
        const parsed = parseIsoDateParts(marker.date);
        if (!parsed || parsed.year !== year)
            continue;
        if (vacationDayIsWeekendRu(year, parsed.monthIndex, parsed.day))
            continue;
        out[vacationCellKey(rowId, year, parsed.monthIndex, parsed.day)] = {
            status: marker.status,
            firstEventTime: marker.first_event_time,
            cameraEmployeeNo: marker.camera_employee_no,
            explanationText: marker.explanation_text,
            explanationFileUrl: marker.explanation_file_url,
        };
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
