import { apiFetch } from '@shared/api';
import { fetchAttendanceRangeReport, fetchDailyAttendanceReport, type AttendanceRangeReportResponse } from '@entities/attendance';
import type { DailyAttendanceItem } from '@entities/attendance';

const ATTENDANCE_RANGE_TIMEOUT_MS = 60_000;

const ATTENDANCE_SNAPSHOT_RETRY_MS = 5_000;
const DAILY_MARKER_CONCURRENCY = 8;
const DAILY_MARKER_FETCH_TIMEOUT_MS = 30_000;

const ATTENDANCE_MARKERS_CACHE_TTL_MS = 10 * 60 * 1000;

type MarkersCache = {
    key: string;
    markers: VacationAttendanceMarkerApi[];
    expiresAt: number;
};

let _markersCache: MarkersCache | null = null;

function makeMarkersCacheKey(dateFrom: string, dateTo: string): string {
    return `${dateFrom}__${dateTo}`;
}
function getCachedMarkers(dateFrom: string, dateTo: string): VacationAttendanceMarkerApi[] | null {
    if (!_markersCache)
        return null;
    if (_markersCache.key !== makeMarkersCacheKey(dateFrom, dateTo))
        return null;
    if (Date.now() > _markersCache.expiresAt)
        return null;
    return _markersCache.markers;
}
function setCachedMarkers(dateFrom: string, dateTo: string, markers: VacationAttendanceMarkerApi[]): void {
    _markersCache = {
        key: makeMarkersCacheKey(dateFrom, dateTo),
        markers,
        expiresAt: Date.now() + ATTENDANCE_MARKERS_CACHE_TTL_MS,
    };
}

export function invalidateAttendanceMarkersCache(): void {
    _markersCache = null;
}

function vacationApiFetch(path: string, init?: Parameters<typeof apiFetch>[1]): Promise<Response> {
    return apiFetch(path, { skipAuthRedirectOn401: true, ...init });
}

export type VacationScheduleEmployeeApi = {
    id: number;
    year: number;
    excel_row_no: number | null;
    full_name: string;
    planned_period_note: string | null;

    auth_user_id: number | null;

    email: string | null;
};
export type VacationAbsenceDayApi = {
    id?: number;
    employee_id: number;
    full_name: string;
    absence_on: string;
    kind_code: number;
    kind: string;
};
export type VacationKindLegendItemApi = {
    kind_code: number;
    kind: string;
    label_ru: string;
    color_hex: string;
    color_text_hex: string;
};
export type VacationAbsenceDaySavedApi = {
    id: number;
    absence_on: string;
    kind_code: number;
    kind: string;
};
export type VacationAttendanceMarkerStatus = 'late' | 'absent';
export type VacationAttendanceMarkerApi = {
    date: string;
    app_user_id: number;
    status: VacationAttendanceMarkerStatus;
    first_event_time: string | null;
    camera_employee_no: string | null;
    display_name: string | null;
    explanation_text: string | null;
    explanation_file_url: string | null;
};
function formatDetail(detail: unknown): string | null {
    if (detail == null)
        return null;
    if (typeof detail === 'string')
        return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((item) => {
            if (typeof item === 'string')
                return item;
            if (item && typeof item === 'object' && 'msg' in item) {
                const m = (item as {
                    msg?: unknown;
                }).msg;
                if (typeof m === 'string')
                    return m;
            }
            try {
                return JSON.stringify(item);
            }
            catch {
                return String(item);
            }
        })
            .join('; ');
    }
    return null;
}
async function throwVacationRequestError(res: Response): Promise<never> {
    const text = await res.text().catch(() => '');
    const trimmed = text.trim();
    let fromBody: string | null = null;
    if (trimmed) {
        try {
            const j = JSON.parse(text) as {
                detail?: unknown;
                message?: unknown;
            };
            fromBody = formatDetail(j.detail);
            if (!fromBody && typeof j.message === 'string' && j.message)
                fromBody = j.message;
            if (!fromBody)
                fromBody = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed;
        }
        catch {
            fromBody = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed;
        }
    }
    if (fromBody)
        throw new Error(fromBody);
    if (res.status === 503) {
        throw new Error('Сервис графика отсутствий временно недоступен (503). Попробуйте позже или обратитесь к администратору.');
    }
    if (res.status === 403) {
        throw new Error('Нет доступа к графику отсутствий. Нужна одна из ролей: сотрудник, офис-менеджер, IT, партнёр, администратор, главный администратор.');
    }
    if (res.status === 404) {
        throw new Error('Запись не найдена (404).');
    }
    throw new Error(`HTTP ${res.status}`);
}
export async function getVacationKindCodes(): Promise<Record<string, string>> {
    const res = await vacationApiFetch('/api/v1/vacations/schedule/kind-codes');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<Record<string, string>>;
}
export async function getVacationKindLegend(): Promise<VacationKindLegendItemApi[]> {
    const res = await vacationApiFetch('/api/v1/vacations/schedule/kind-legend');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<VacationKindLegendItemApi[]>;
}
export type ListVacationScheduleEmployeesOptions = {

    onlyRegistered?: boolean;
};
function coerceVacationScheduleEmployeeApi(raw: unknown): VacationScheduleEmployeeApi | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = Number(o.id);
    const year = Number(o.year);
    if (!Number.isFinite(id) || !Number.isFinite(year))
        return null;
    const excelRowNoRaw = o.excel_row_no ?? o.excelRowNo;
    const excel_row_no =
        excelRowNoRaw == null || excelRowNoRaw === ''
            ? null
            : Number.isFinite(Number(excelRowNoRaw))
                ? Number(excelRowNoRaw)
                : null;
    const full_name = typeof o.full_name === 'string'
        ? o.full_name
        : typeof o.fullName === 'string'
            ? o.fullName
            : '';
    const plannedRaw = o.planned_period_note ?? o.plannedPeriodNote;
    const planned_period_note = typeof plannedRaw === 'string' && plannedRaw.length > 0 ? plannedRaw : null;
    const authRaw = o.auth_user_id ?? o.authUserId;
    const auth_user_id =
        authRaw == null || authRaw === ''
            ? null
            : Number.isFinite(Number(authRaw))
                ? Number(authRaw)
                : null;
    const emailRaw = o.email;
    const email = typeof emailRaw === 'string' && emailRaw.trim().length > 0 ? emailRaw : null;
    return {
        id,
        year,
        excel_row_no,
        full_name,
        planned_period_note,
        auth_user_id,
        email,
    };
}
export type VacationScheduleEmployeesSyncResultApi = {
    year: number;
    created: number;
    linked_orphans: number;
    linkedOrphans?: number;
    updated: number;
    skipped_archived: number;
    skippedArchived?: number;
    skipped_hidden: number;
    skippedHidden?: number;
};

export async function syncVacationScheduleEmployees(year: number): Promise<VacationScheduleEmployeesSyncResultApi> {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees/sync?year=${encodeURIComponent(String(year))}`, {
        method: 'POST',
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<VacationScheduleEmployeesSyncResultApi>;
}
export async function listVacationScheduleEmployees(year: number, options?: ListVacationScheduleEmployeesOptions): Promise<VacationScheduleEmployeeApi[]> {
    const q = new URLSearchParams({ year: String(year) });
    if (options?.onlyRegistered === false)
        q.set('only_registered', 'false');
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees?${q}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => coerceVacationScheduleEmployeeApi(item))
        .filter((x): x is VacationScheduleEmployeeApi => x != null);
}
export type ListVacationAbsenceDaysOptions = {
    employeeId?: number;
    dateFrom?: string;
    dateTo?: string;
};
export async function listVacationAbsenceDays(year: number, options?: ListVacationAbsenceDaysOptions): Promise<VacationAbsenceDayApi[]> {
    const q = new URLSearchParams({ year: String(year) });
    if (options?.employeeId != null)
        q.set('employee_id', String(options.employeeId));
    if (options?.dateFrom)
        q.set('date_from', options.dateFrom);
    if (options?.dateTo)
        q.set('date_to', options.dateTo);
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/absence-days?${q}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<VacationAbsenceDayApi[]>;
}
function parseIsoDateLocal(iso: string): Date {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
}
function formatIsoDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function coerceVacationAttendanceMarkerApi(raw: unknown): VacationAttendanceMarkerApi | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const status = o.status;
    const appUserId = o.app_user_id;
    const date = o.date;
    if (status !== 'late' && status !== 'absent')
        return null;
    if (typeof appUserId !== 'number' || appUserId <= 0)
        return null;
    if (typeof date !== 'string' || !date)
        return null;
    return {
        date: date.slice(0, 10),
        app_user_id: appUserId,
        status,
        first_event_time: typeof o.first_event_time === 'string' ? o.first_event_time : null,
        camera_employee_no: typeof o.camera_employee_no === 'string' ? o.camera_employee_no : null,
        display_name: typeof o.display_name === 'string' ? o.display_name : null,
        explanation_text: typeof o.explanation_text === 'string' ? o.explanation_text : null,
        explanation_file_url: typeof o.explanation_file_url === 'string' ? o.explanation_file_url : null,
    };
}
function markersFromRangeReport(report: AttendanceRangeReportResponse): VacationAttendanceMarkerApi[] {
    return (report.items ?? [])
        .map((item) => coerceVacationAttendanceMarkerApi(item))
        .filter((x): x is VacationAttendanceMarkerApi => x != null);
}
function* eachIsoDayInRange(dateFrom: string, dateTo: string): Generator<string> {
    const from = parseIsoDateLocal(dateFrom);
    const to = parseIsoDateLocal(dateTo);
    const cursor = new Date(from);
    while (cursor <= to) {
        yield formatIsoDateLocal(cursor);
        cursor.setDate(cursor.getDate() + 1);
    }
}
async function runWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    async function worker(): Promise<void> {
        for (;;) {
            const idx = next;
            next += 1;
            if (idx >= items.length)
                return;
            out[idx] = await fn(items[idx]!);
        }
    }
    const workers = Math.min(Math.max(1, limit), items.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));
    return out;
}
function dailyItemToVacationMarker(day: string, item: DailyAttendanceItem): VacationAttendanceMarkerApi | null {
    if (item.status !== 'late' && item.status !== 'absent')
        return null;
    if (item.app_user_id == null || item.app_user_id <= 0)
        return null;
    return {
        date: day,
        app_user_id: item.app_user_id,
        status: item.status,
        first_event_time: item.first_event_time,
        camera_employee_no: item.camera_employee_no,
        display_name: item.display_name,
        explanation_text: item.explanation_text ?? null,
        explanation_file_url: item.explanation_file_url ?? null,
    };
}

async function fetchVacationAttendanceMarkersDaily(dateFrom: string, dateTo: string): Promise<VacationAttendanceMarkerApi[]> {
    const days = [...eachIsoDayInRange(dateFrom, dateTo)];
    if (days.length === 0)
        return [];
    const reports = await runWithConcurrency(days, DAILY_MARKER_CONCURRENCY, (day) => fetchDailyAttendanceReport(day, AbortSignal.timeout(DAILY_MARKER_FETCH_TIMEOUT_MS)).catch(() => null));
    const markers: VacationAttendanceMarkerApi[] = [];
    for (let i = 0; i < days.length; i += 1) {
        const report = reports[i];
        if (!report)
            continue;
        const day = days[i]!;
        for (const item of report.items) {
            const marker = dailyItemToVacationMarker(day, item);
            if (marker)
                markers.push(marker);
        }
    }
    return markers;
}
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchVacationAttendanceMarkersRange(dateFrom: string, dateTo: string): Promise<VacationAttendanceMarkerApi[]> {
    const signal = AbortSignal.timeout(ATTENDANCE_RANGE_TIMEOUT_MS);
    const report = await fetchAttendanceRangeReport(dateFrom, dateTo, signal);
    let markers = markersFromRangeReport(report);
    const snapshotStatus = report.snapshot?.status;
    if (markers.length === 0 && (snapshotStatus === 'building' || snapshotStatus === 'empty')) {
        await sleep(ATTENDANCE_SNAPSHOT_RETRY_MS);
        const retry = await fetchAttendanceRangeReport(dateFrom, dateTo, AbortSignal.timeout(ATTENDANCE_RANGE_TIMEOUT_MS));
        markers = markersFromRangeReport(retry);
    }
    return markers;
}
export async function listVacationAttendanceMarkers(dateFrom: string, dateTo: string): Promise<VacationAttendanceMarkerApi[]> {
    if (!dateFrom || !dateTo)
        return [];
    const from = parseIsoDateLocal(dateFrom);
    const to = parseIsoDateLocal(dateTo);
    if (from > to)
        return [];

    const cached = getCachedMarkers(dateFrom, dateTo);
    if (cached !== null)
        return cached;

    let markers: VacationAttendanceMarkerApi[] = [];

    try {
        markers = await fetchVacationAttendanceMarkersRange(dateFrom, dateTo);
        setCachedMarkers(dateFrom, dateTo, markers);
        return markers;
    }
    catch {
    }

    try {
        markers = await fetchVacationAttendanceMarkersDaily(dateFrom, dateTo);
        setCachedMarkers(dateFrom, dateTo, markers);
        return markers;
    }
    catch {
        return [];
    }
}
export type VacationAbsenceDayItemApi = {
    id?: number;
    absence_on: string;
    kind_code: number;
    kind: string;
};
export type VacationScheduleEmployeeDetailApi = VacationScheduleEmployeeApi & {
    absence_days: VacationAbsenceDayItemApi[];
};
export async function getVacationScheduleEmployee(employeeId: number, year?: number): Promise<VacationScheduleEmployeeDetailApi> {
    const q = year != null ? `?year=${encodeURIComponent(String(year))}` : '';
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees/${employeeId}${q}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 404) {
        throw new Error('Сотрудник не найден в графике за выбранный год.');
    }
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<VacationScheduleEmployeeDetailApi>;
}
export type VacationScheduleImportResultApi = {
    year: number;
    employees_imported: number;
    absence_days_imported: number;
};

export async function postVacationScheduleImport(formData: FormData): Promise<VacationScheduleImportResultApi> {
    const res = await vacationApiFetch('/api/v1/vacations/schedule/import', {
        method: 'POST',
        body: formData,
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 410) {
        throw new Error('Импорт графика из Excel больше не поддерживается. Сотрудники появляются в графике автоматически после согласования заявки.');
    }
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<VacationScheduleImportResultApi>;
}

export type VacationLeaveKindApi = {
    kind_code: number;
    kind: VacationLeaveRequestKind;
    label_ru: string;
    color_hex: string;
    color_text_hex: string;
};

export const VACATION_LEAVE_REQUEST_KINDS = [
    'annual_vacation',
    'day_off',
    'remote_work',
] as const;
export type VacationLeaveRequestKind = (typeof VACATION_LEAVE_REQUEST_KINDS)[number];

export const VACATION_LEAVE_REQUEST_STATUSES = [
    'pending',
    'approved',
    'declined',
    'cancelled',
] as const;
export type VacationLeaveRequestStatus = (typeof VACATION_LEAVE_REQUEST_STATUSES)[number];

export type VacationPartnerApi = {
    user_id: number;
    display_name: string;
    email: string;
    picture: string | null;
    position: string | null;
};

export type VacationLeaveRequestApi = {
    id: number;
    status: VacationLeaveRequestStatus;
    kind_code: number;
    kind: VacationLeaveRequestKind;
    employee_user_id: number;
    employee_full_name: string;
    employee_email: string;
    employee_position: string | null;
    partner_user_id: number;
    partner_full_name: string;
    partner_email: string;
    date_from: string;
    date_to: string;
    days_count: number;
    reason: string | null;
    decision_at: string | null;
    decision_reason: string | null;
    pdf_url: string;
    created_at: string;
    updated_at: string | null;
};

export type ListVacationLeaveRequestsOptions = {
    scope?: 'mine' | 'to_decide' | 'all';
    status?: VacationLeaveRequestStatus | 'any';
};

export type CreateVacationLeaveRequestBody = {
    kind: VacationLeaveRequestKind;
    date_from: string;
    date_to: string;
    partner_user_id: number;
    reason?: string | null;
};

export type VacationLeaveBalanceApi = {
    year: number;
    employee_user_id: number;
    entitled_days: number;
    used_days: number;
    pending_days: number;
    remaining_days: number;
    continuous_14_satisfied: boolean;
    min_continuous_days: number;
    flexible_days_max: number;
    flexible_days_used: number;
    flexible_days_remaining: number;
};

function str(v: unknown): string {
    return typeof v === 'string' ? v : '';
}
function strOrNull(v: unknown): string | null {
    if (typeof v !== 'string')
        return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
}
function int(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
function coerceLeaveKindApi(raw: unknown): VacationLeaveKindApi | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const kindCode = int(o.kind_code ?? o.kindCode);
    const kindStr = str(o.kind);
    if (!kindCode || !(VACATION_LEAVE_REQUEST_KINDS as readonly string[]).includes(kindStr))
        return null;
    return {
        kind_code: kindCode,
        kind: kindStr as VacationLeaveRequestKind,
        label_ru: str(o.label_ru ?? o.labelRu) || kindStr,
        color_hex: str(o.color_hex ?? o.colorHex) || '#E8D5F2',
        color_text_hex: str(o.color_text_hex ?? o.colorTextHex) || '#1f2937',
    };
}
function coerceVacationPartnerApi(raw: unknown): VacationPartnerApi | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const userId = int(o.user_id ?? o.userId);
    if (userId <= 0)
        return null;
    return {
        user_id: userId,
        display_name: str(o.display_name ?? o.displayName),
        email: str(o.email),
        picture: strOrNull(o.picture),
        position: strOrNull(o.position),
    };
}
function coerceLeaveRequestStatus(raw: unknown): VacationLeaveRequestStatus | null {
    const s = str(raw);
    if ((VACATION_LEAVE_REQUEST_STATUSES as readonly string[]).includes(s))
        return s as VacationLeaveRequestStatus;
    return null;
}
function coerceLeaveRequestKind(raw: unknown): VacationLeaveRequestKind | null {
    const s = str(raw);
    if ((VACATION_LEAVE_REQUEST_KINDS as readonly string[]).includes(s))
        return s as VacationLeaveRequestKind;
    return null;
}
function coerceVacationLeaveRequestApi(raw: unknown): VacationLeaveRequestApi | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = int(o.id);
    if (id <= 0)
        return null;
    const status = coerceLeaveRequestStatus(o.status);
    const kind = coerceLeaveRequestKind(o.kind);
    if (!status || !kind)
        return null;
    return {
        id,
        status,
        kind_code: int(o.kind_code ?? o.kindCode),
        kind,
        employee_user_id: int(o.employee_user_id ?? o.employeeUserId),
        employee_full_name: str(o.employee_full_name ?? o.employeeFullName),
        employee_email: str(o.employee_email ?? o.employeeEmail),
        employee_position: strOrNull(o.employee_position ?? o.employeePosition),
        partner_user_id: int(o.partner_user_id ?? o.partnerUserId),
        partner_full_name: str(o.partner_full_name ?? o.partnerFullName),
        partner_email: str(o.partner_email ?? o.partnerEmail),
        date_from: str(o.date_from ?? o.dateFrom),
        date_to: str(o.date_to ?? o.dateTo),
        days_count: int(o.days_count ?? o.daysCount),
        reason: strOrNull(o.reason),
        decision_at: strOrNull(o.decision_at ?? o.decisionAt),
        decision_reason: strOrNull(o.decision_reason ?? o.decisionReason),
        pdf_url: str(o.pdf_url ?? o.pdfUrl) || `/api/v1/vacations/leave-requests/${id}/pdf`,
        created_at: str(o.created_at ?? o.createdAt),
        updated_at: strOrNull(o.updated_at ?? o.updatedAt),
    };
}

export async function getVacationLeaveKinds(): Promise<VacationLeaveKindApi[]> {
    const res = await vacationApiFetch('/api/v1/vacations/leave-kinds');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => coerceLeaveKindApi(item))
        .filter((x): x is VacationLeaveKindApi => x != null);
}

function coerceVacationLeaveBalanceApi(raw: unknown): VacationLeaveBalanceApi | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const year = int(o.year);
    if (year < 2000)
        return null;
    return {
        year,
        employee_user_id: int(o.employee_user_id ?? o.employeeUserId),
        entitled_days: int(o.entitled_days ?? o.entitledDays),
        used_days: int(o.used_days ?? o.usedDays),
        pending_days: int(o.pending_days ?? o.pendingDays),
        remaining_days: int(o.remaining_days ?? o.remainingDays),
        continuous_14_satisfied: Boolean(o.continuous_14_satisfied ?? o.continuous14Satisfied),
        min_continuous_days: Math.max(1, int(o.min_continuous_days ?? o.minContinuousDays) || 14),
        flexible_days_max: Math.max(0, int(o.flexible_days_max ?? o.flexibleDaysMax) || 7),
        flexible_days_used: Math.max(0, int(o.flexible_days_used ?? o.flexibleDaysUsed) || 0),
        flexible_days_remaining: Math.max(
            0,
            int(o.flexible_days_remaining ?? o.flexibleDaysRemaining)
                || Math.max(0, (int(o.flexible_days_max ?? o.flexibleDaysMax) || 7)
                    - (int(o.flexible_days_used ?? o.flexibleDaysUsed) || 0)),
        ),
    };
}

export async function getVacationLeaveBalance(year?: number): Promise<VacationLeaveBalanceApi> {
    const q = year != null ? `?year=${encodeURIComponent(String(year))}` : '';
    const res = await vacationApiFetch(`/api/v1/vacations/leave-balance${q}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const out = coerceVacationLeaveBalanceApi(await res.json());
    if (!out)
        throw new Error('Не удалось получить баланс отпуска.');
    return out;
}

export async function getVacationPartners(): Promise<VacationPartnerApi[]> {
    const res = await vacationApiFetch('/api/v1/vacations/partners');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => coerceVacationPartnerApi(item))
        .filter((x): x is VacationPartnerApi => x != null);
}

export async function createVacationLeaveRequest(body: CreateVacationLeaveRequestBody): Promise<VacationLeaveRequestApi> {
    const payload: Record<string, unknown> = {
        kind: body.kind,
        date_from: body.date_from,
        date_to: body.date_to,
        partner_user_id: body.partner_user_id,
    };
    if (body.reason != null && body.reason.trim().length > 0)
        payload.reason = body.reason.trim();
    const res = await vacationApiFetch('/api/v1/vacations/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const raw = await res.json();
    const out = coerceVacationLeaveRequestApi(raw);
    if (!out)
        throw new Error('Не удалось распарсить ответ заявки.');
    return out;
}

export async function listVacationLeaveRequests(options?: ListVacationLeaveRequestsOptions): Promise<VacationLeaveRequestApi[]> {
    const q = new URLSearchParams();
    if (options?.scope)
        q.set('scope', options.scope);
    if (options?.status && options.status !== 'any')
        q.set('status', options.status);
    else if (options?.status === 'any')
        q.set('status', 'any');
    const qs = q.toString();
    const res = await vacationApiFetch(`/api/v1/vacations/leave-requests${qs ? `?${qs}` : ''}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const raw = (await res.json()) as unknown;
    const items = raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items)
        ? (raw as { items: unknown[] }).items
        : Array.isArray(raw)
            ? raw
            : [];
    return items
        .map((item) => coerceVacationLeaveRequestApi(item))
        .filter((x): x is VacationLeaveRequestApi => x != null);
}

export async function getVacationLeaveRequest(id: number): Promise<VacationLeaveRequestApi | null> {
    const res = await vacationApiFetch(`/api/v1/vacations/leave-requests/${id}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 404)
        return null;
    if (!res.ok)
        await throwVacationRequestError(res);
    return coerceVacationLeaveRequestApi(await res.json());
}

export async function approveVacationLeaveRequest(id: number, decisionReason?: string | null): Promise<VacationLeaveRequestApi> {
    const body: Record<string, unknown> = {};
    if (decisionReason != null && decisionReason.trim().length > 0)
        body.decision_reason = decisionReason.trim();
    const res = await vacationApiFetch(`/api/v1/vacations/leave-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const out = coerceVacationLeaveRequestApi(await res.json());
    if (!out)
        throw new Error('Не удалось распарсить ответ заявки.');
    return out;
}
export async function declineVacationLeaveRequest(id: number, decisionReason?: string | null): Promise<VacationLeaveRequestApi> {
    const body: Record<string, unknown> = {};
    if (decisionReason != null && decisionReason.trim().length > 0)
        body.decision_reason = decisionReason.trim();
    const res = await vacationApiFetch(`/api/v1/vacations/leave-requests/${id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const out = coerceVacationLeaveRequestApi(await res.json());
    if (!out)
        throw new Error('Не удалось распарсить ответ заявки.');
    return out;
}

export async function cancelVacationLeaveRequest(id: number): Promise<void> {
    const res = await vacationApiFetch(`/api/v1/vacations/leave-requests/${id}`, { method: 'DELETE' });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 204)
        return;
    if (!res.ok)
        await throwVacationRequestError(res);
}

export async function fetchVacationLeaveRequestPdfBlob(id: number): Promise<Blob> {
    const res = await vacationApiFetch(`/api/v1/vacations/leave-requests/${id}/pdf`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.blob();
}
export type PostVacationScheduleEmployeeBody = {
    year: number;
    full_name: string;

    auth_user_id?: number;
    email?: string | null;
    planned_period_note?: string | null;
};
export async function postVacationScheduleEmployee(body: PostVacationScheduleEmployeeBody): Promise<VacationScheduleEmployeeApi> {
    const res = await vacationApiFetch('/api/v1/vacations/schedule/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<VacationScheduleEmployeeApi>;
}
export type PatchVacationScheduleEmployeeBody = {
    full_name?: string;
    planned_period_note?: string | null;
    excel_row_no?: number;
    auth_user_id?: number | null;
    email?: string | null;
};
export async function patchVacationScheduleEmployee(employeeId: number, body: PatchVacationScheduleEmployeeBody): Promise<VacationScheduleEmployeeApi> {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<VacationScheduleEmployeeApi>;
}
export async function deleteVacationScheduleEmployee(employeeId: number): Promise<void> {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees/${employeeId}`, { method: 'DELETE' });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 204)
        return;
    if (!res.ok)
        await throwVacationRequestError(res);
}
export async function postVacationEmployeeAbsenceDay(employeeId: number, body: {
    absence_on: string;
    kind_code: number;
}): Promise<VacationAbsenceDaySavedApi> {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees/${employeeId}/absence-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<VacationAbsenceDaySavedApi>;
}
export async function patchVacationAbsenceDay(absenceDayId: number, body: {
    absence_on?: string;
    kind_code?: number;
}): Promise<VacationAbsenceDaySavedApi> {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/absence-days/${absenceDayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<VacationAbsenceDaySavedApi>;
}
export async function deleteVacationAbsenceDay(absenceDayId: number): Promise<void> {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/absence-days/${absenceDayId}`, { method: 'DELETE' });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 204)
        return;
    if (!res.ok)
        await throwVacationRequestError(res);
}

export const VACATION_MANUAL_ENTRY_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const VACATION_MANUAL_ENTRY_MAX_FILES = 20;
export const VACATION_MANUAL_ENTRY_ALLOWED_EXTENSIONS = [
    'pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'doc', 'docx', 'xls', 'xlsx', 'txt',
] as const;

export type VacationManualEntryDocumentApi = {
    id: number;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    download_url: string;
    created_at: string;
};
export type VacationManualEntryApi = {
    id: number;
    employee_id: number;
    kind_code: number;
    kind: string;
    label_ru: string;
    date_from: string;
    date_to: string;
    reason: string | null;
    created_by_user_id: number | null;
    created_by_name: string | null;
    created_at: string;
    documents: VacationManualEntryDocumentApi[];
};
export type CreateVacationManualEntryInput = {
    employeeId: number;
    dateFrom: string;
    dateTo: string;

    kind?: string;
    kindCode?: number;
    reason?: string | null;
    files: File[];
};
export type ListVacationManualEntriesOptions = {
    year?: number;
    employeeId?: number;
};

function coerceManualEntryDocumentApi(raw: unknown): VacationManualEntryDocumentApi | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = int(o.id);
    if (id <= 0)
        return null;
    return {
        id,
        original_filename: str(o.original_filename ?? o.originalFilename) || `Документ ${id}`,
        content_type: str(o.content_type ?? o.contentType),
        size_bytes: int(o.size_bytes ?? o.sizeBytes),
        download_url: str(o.download_url ?? o.downloadUrl),
        created_at: str(o.created_at ?? o.createdAt),
    };
}
function coerceManualEntryApi(raw: unknown): VacationManualEntryApi | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = int(o.id);
    if (id <= 0)
        return null;
    const docsRaw = o.documents;
    const documents = Array.isArray(docsRaw)
        ? docsRaw.map((d) => coerceManualEntryDocumentApi(d)).filter((x): x is VacationManualEntryDocumentApi => x != null)
        : [];
    return {
        id,
        employee_id: int(o.employee_id ?? o.employeeId),
        kind_code: int(o.kind_code ?? o.kindCode),
        kind: str(o.kind),
        label_ru: str(o.label_ru ?? o.labelRu) || str(o.kind),
        date_from: str(o.date_from ?? o.dateFrom),
        date_to: str(o.date_to ?? o.dateTo),
        reason: strOrNull(o.reason),
        created_by_user_id: (() => {
            const v = o.created_by_user_id ?? o.createdByUserId;
            const n = Number(v);
            return v == null || !Number.isFinite(n) ? null : n;
        })(),
        created_by_name: strOrNull(o.created_by_name ?? o.createdByName),
        created_at: str(o.created_at ?? o.createdAt),
        documents,
    };
}

export async function createVacationManualEntry(input: CreateVacationManualEntryInput): Promise<VacationManualEntryApi> {
    const fd = new FormData();
    fd.append('employeeId', String(input.employeeId));
    fd.append('dateFrom', input.dateFrom);
    fd.append('dateTo', input.dateTo);
    if (input.kindCode != null)
        fd.append('kindCode', String(input.kindCode));
    if (input.kind)
        fd.append('kind', input.kind);
    if (input.reason != null && input.reason.trim().length > 0)
        fd.append('reason', input.reason.trim());
    for (const file of input.files)
        fd.append('files', file);
    const res = await vacationApiFetch('/api/v1/vacations/schedule/manual-entries', {
        method: 'POST',
        body: fd,
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const out = coerceManualEntryApi(await res.json());
    if (!out)
        throw new Error('Не удалось распарсить ответ ручной записи.');
    return out;
}

export async function listVacationManualEntries(options?: ListVacationManualEntriesOptions): Promise<VacationManualEntryApi[]> {
    const q = new URLSearchParams();
    if (options?.year != null)
        q.set('year', String(options.year));
    if (options?.employeeId != null)
        q.set('employeeId', String(options.employeeId));
    const qs = q.toString();
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/manual-entries${qs ? `?${qs}` : ''}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const raw = (await res.json()) as unknown;
    const items = raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items)
        ? (raw as { items: unknown[] }).items
        : Array.isArray(raw)
            ? raw
            : [];
    return items
        .map((item) => coerceManualEntryApi(item))
        .filter((x): x is VacationManualEntryApi => x != null);
}

export async function getVacationManualEntry(id: number): Promise<VacationManualEntryApi | null> {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/manual-entries/${id}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 404)
        return null;
    if (!res.ok)
        await throwVacationRequestError(res);
    return coerceManualEntryApi(await res.json());
}

export async function addVacationManualEntryDocuments(id: number, files: File[]): Promise<VacationManualEntryApi> {
    const fd = new FormData();
    for (const file of files)
        fd.append('files', file);
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/manual-entries/${id}/documents`, {
        method: 'POST',
        body: fd,
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const out = coerceManualEntryApi(await res.json());
    if (!out)
        throw new Error('Не удалось распарсить ответ ручной записи.');
    return out;
}

export async function fetchVacationManualEntryDocumentBlob(entryId: number, docId: number): Promise<Blob> {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/manual-entries/${entryId}/documents/${docId}/download`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.blob();
}

export async function deleteVacationManualEntryDocument(entryId: number, docId: number): Promise<void> {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/manual-entries/${entryId}/documents/${docId}`, { method: 'DELETE' });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 204)
        return;
    if (!res.ok)
        await throwVacationRequestError(res);
}

export async function deleteVacationManualEntry(id: number): Promise<void> {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/manual-entries/${id}`, { method: 'DELETE' });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 204)
        return;
    if (!res.ok)
        await throwVacationRequestError(res);
}
