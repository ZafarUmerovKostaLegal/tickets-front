import { apiFetch } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
import { fetchAttendanceRangeReport, fetchDailyAttendanceReport } from '@entities/attendance';
const ATTENDANCE_RANGE_TIMEOUT_MS = 60_000;
const ATTENDANCE_SNAPSHOT_RETRY_MS = 5_000;
const DAILY_MARKER_CONCURRENCY = 8;
const DAILY_MARKER_FETCH_TIMEOUT_MS = 30_000;
const ATTENDANCE_MARKERS_CACHE_TTL_MS = 10 * 60 * 1000;
const attendanceMarkersCache = createQueryCache({
    ttlMs: ATTENDANCE_MARKERS_CACHE_TTL_MS,
    maxEntries: 8,
});
function makeMarkersCacheKey(dateFrom, dateTo) {
    return `${dateFrom}__${dateTo}`;
}
export function invalidateAttendanceMarkersCache() {
    attendanceMarkersCache.invalidate();
}
function vacationApiFetch(path, init) {
    return apiFetch(path, { skipAuthRedirectOn401: true, ...init });
}
function formatDetail(detail) {
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
                const m = item.msg;
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
async function throwVacationRequestError(res) {
    const text = await res.text().catch(() => '');
    const trimmed = text.trim();
    let fromBody = null;
    if (trimmed) {
        try {
            const j = JSON.parse(text);
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
export async function getVacationKindCodes() {
    const res = await vacationApiFetch('/api/v1/vacations/schedule/kind-codes');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json();
}
export async function getVacationKindLegend() {
    const res = await vacationApiFetch('/api/v1/vacations/schedule/kind-legend');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json();
}
function coerceVacationScheduleEmployeeApi(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const id = Number(o.id);
    const year = Number(o.year);
    if (!Number.isFinite(id) || !Number.isFinite(year))
        return null;
    const excelRowNoRaw = o.excel_row_no ?? o.excelRowNo;
    const excel_row_no = excelRowNoRaw == null || excelRowNoRaw === ''
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
    const auth_user_id = authRaw == null || authRaw === ''
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
export async function syncVacationScheduleEmployees(year) {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees/sync?year=${encodeURIComponent(String(year))}`, {
        method: 'POST',
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json();
}
function coerceRosterHidden(raw) {
    const o = raw != null && typeof raw === 'object' ? raw : {};
    const users = o.authUserIds ?? o.auth_user_ids;
    const employees = o.employeeIds ?? o.employee_ids;
    const nums = (value) => Array.isArray(value)
        ? value.map((item) => Number(item)).filter((n) => Number.isFinite(n) && n > 0)
        : [];
    return { authUserIds: nums(users), employeeIds: nums(employees) };
}
export async function getVacationRosterHidden() {
    const res = await vacationApiFetch('/api/v1/vacations/schedule/roster-hidden');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return coerceRosterHidden(await res.json());
}
export async function patchVacationRosterHidden(body) {
    const res = await vacationApiFetch('/api/v1/vacations/schedule/roster-hidden', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return coerceRosterHidden(await res.json());
}
export async function listVacationScheduleEmployees(year, options) {
    const q = new URLSearchParams({ year: String(year) });
    if (options?.onlyRegistered === false)
        q.set('only_registered', 'false');
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees?${q}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const raw = (await res.json());
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => coerceVacationScheduleEmployeeApi(item))
        .filter((x) => x != null);
}
export async function listVacationAbsenceDays(year, options) {
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
    return res.json();
}
function parseIsoDateLocal(iso) {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
}
function formatIsoDateLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function coerceVacationAttendanceMarkerApi(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
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
function markersFromRangeReport(report) {
    return (report.items ?? [])
        .map((item) => coerceVacationAttendanceMarkerApi(item))
        .filter((x) => x != null);
}
function* eachIsoDayInRange(dateFrom, dateTo) {
    const from = parseIsoDateLocal(dateFrom);
    const to = parseIsoDateLocal(dateTo);
    const cursor = new Date(from);
    while (cursor <= to) {
        yield formatIsoDateLocal(cursor);
        cursor.setDate(cursor.getDate() + 1);
    }
}
async function runWithConcurrency(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    async function worker() {
        for (;;) {
            const idx = next;
            next += 1;
            if (idx >= items.length)
                return;
            out[idx] = await fn(items[idx]);
        }
    }
    const workers = Math.min(Math.max(1, limit), items.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));
    return out;
}
function dailyItemToVacationMarker(day, item) {
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
async function fetchVacationAttendanceMarkersDaily(dateFrom, dateTo) {
    const days = [...eachIsoDayInRange(dateFrom, dateTo)];
    if (days.length === 0)
        return [];
    const reports = await runWithConcurrency(days, DAILY_MARKER_CONCURRENCY, (day) => fetchDailyAttendanceReport(day, AbortSignal.timeout(DAILY_MARKER_FETCH_TIMEOUT_MS)).catch(() => null));
    const markers = [];
    for (let i = 0; i < days.length; i += 1) {
        const report = reports[i];
        if (!report)
            continue;
        const day = days[i];
        for (const item of report.items) {
            const marker = dailyItemToVacationMarker(day, item);
            if (marker)
                markers.push(marker);
        }
    }
    return markers;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchVacationAttendanceMarkersRange(dateFrom, dateTo) {
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
export async function listVacationAttendanceMarkers(dateFrom, dateTo) {
    if (!dateFrom || !dateTo)
        return [];
    const from = parseIsoDateLocal(dateFrom);
    const to = parseIsoDateLocal(dateTo);
    if (from > to)
        return [];
    return attendanceMarkersCache.fetch(makeMarkersCacheKey(dateFrom, dateTo), async () => {
        try {
            return await fetchVacationAttendanceMarkersRange(dateFrom, dateTo);
        }
        catch {
            return fetchVacationAttendanceMarkersDaily(dateFrom, dateTo);
        }
    }).catch(() => []);
}
export async function getVacationScheduleEmployee(employeeId, year) {
    const q = year != null ? `?year=${encodeURIComponent(String(year))}` : '';
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees/${employeeId}${q}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 404) {
        throw new Error('Сотрудник не найден в графике за выбранный год.');
    }
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json();
}
export async function postVacationScheduleImport(formData) {
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
    return res.json();
}
export const VACATION_LEAVE_REQUEST_KINDS = [
    'annual_vacation',
    'sick_leave',
    'day_off',
    'remote_work',
];
export const VACATION_LEAVE_REQUEST_STATUSES = [
    'pending',
    // Курирующий партнёр согласовал, ждём финального решения управляющего партнёра.
    'pending_final',
    'approved',
    'declined',
    'cancelled',
];
function str(v) {
    return typeof v === 'string' ? v : '';
}
function strOrNull(v) {
    if (typeof v !== 'string')
        return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
}
function int(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
function coerceLeaveKindApi(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const kindCode = int(o.kind_code ?? o.kindCode);
    const kindStr = str(o.kind);
    if (!kindCode || !VACATION_LEAVE_REQUEST_KINDS.includes(kindStr))
        return null;
    return {
        kind_code: kindCode,
        kind: kindStr,
        label_ru: str(o.label_ru ?? o.labelRu) || kindStr,
        color_hex: str(o.color_hex ?? o.colorHex) || '#E8D5F2',
        color_text_hex: str(o.color_text_hex ?? o.colorTextHex) || '#1f2937',
    };
}
function coerceVacationPartnerApi(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
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
function coerceLeaveRequestStatus(raw) {
    const s = str(raw);
    if (VACATION_LEAVE_REQUEST_STATUSES.includes(s))
        return s;
    return null;
}
function coerceLeaveRequestKind(raw) {
    const s = str(raw);
    if (VACATION_LEAVE_REQUEST_KINDS.includes(s))
        return s;
    return null;
}
function coerceVacationLeaveRequestApi(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
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
        final_decision_at: strOrNull(o.final_decision_at ?? o.finalDecisionAt),
        final_decision_reason: strOrNull(o.final_decision_reason ?? o.finalDecisionReason),
        managing_partner_full_name: strOrNull(o.managing_partner_full_name ?? o.managingPartnerFullName),
        managing_partner_email: strOrNull(o.managing_partner_email ?? o.managingPartnerEmail),
        pdf_url: str(o.pdf_url ?? o.pdfUrl) || `/api/v1/vacations/leave-requests/${id}/pdf`,
        created_at: str(o.created_at ?? o.createdAt),
        updated_at: strOrNull(o.updated_at ?? o.updatedAt),
    };
}
export async function getVacationLeaveKinds() {
    const res = await vacationApiFetch('/api/v1/vacations/leave-kinds');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const raw = (await res.json());
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => coerceLeaveKindApi(item))
        .filter((x) => x != null);
}
function coerceVacationLeaveBalanceApi(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
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
        flexible_days_remaining: Math.max(0, int(o.flexible_days_remaining ?? o.flexibleDaysRemaining)
            || Math.max(0, (int(o.flexible_days_max ?? o.flexibleDaysMax) || 7)
                - (int(o.flexible_days_used ?? o.flexibleDaysUsed) || 0))),
    };
}
export async function getVacationLeaveBalance(year) {
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
export async function getVacationPartners() {
    const res = await vacationApiFetch('/api/v1/vacations/partners');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const raw = (await res.json());
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((item) => coerceVacationPartnerApi(item))
        .filter((x) => x != null);
}
export async function createVacationLeaveRequest(body) {
    const payload = {
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
export async function listVacationLeaveRequests(options) {
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
    const raw = (await res.json());
    const items = raw && typeof raw === 'object' && Array.isArray(raw.items)
        ? raw.items
        : Array.isArray(raw)
            ? raw
            : [];
    return items
        .map((item) => coerceVacationLeaveRequestApi(item))
        .filter((x) => x != null);
}
export async function fetchVacationLeavePendingBadgeCount() {
    const res = await vacationApiFetch('/api/v1/vacations/leave-requests/pending/badge');
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    const raw = (await res.json());
    const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
    };
    return {
        count: num(raw.count),
        toDecideCount: num(raw.to_decide_count ?? raw.toDecideCount),
        minePendingCount: num(raw.mine_pending_count ?? raw.minePendingCount),
    };
}
export async function getVacationLeaveRequest(id) {
    const res = await vacationApiFetch(`/api/v1/vacations/leave-requests/${id}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 404)
        return null;
    if (!res.ok)
        await throwVacationRequestError(res);
    return coerceVacationLeaveRequestApi(await res.json());
}
export async function approveVacationLeaveRequest(id, decisionReason) {
    const body = {};
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
export async function declineVacationLeaveRequest(id, decisionReason) {
    const body = {};
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
async function postLeaveRequestCancellation(id, action, reason) {
    const body = {};
    if (reason != null && reason.trim().length > 0)
        body.reason = reason.trim();
    const res = await vacationApiFetch(`/api/v1/vacations/leave-requests/${id}/${action}`, {
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
/** Отзыв своей заявки, пока партнёр не принял решение. */
export async function withdrawVacationLeaveRequest(id, reason) {
    return postLeaveRequestCancellation(id, 'withdraw', reason);
}
/** Отмена уже согласованного отсутствия: дни убираются из графика. */
export async function cancelVacationLeaveRequest(id, reason) {
    return postLeaveRequestCancellation(id, 'cancel', reason);
}
/** Полное удаление отменённой или отклонённой заявки вместе с PDF. */
export async function deleteVacationLeaveRequest(id) {
    const res = await vacationApiFetch(`/api/v1/vacations/leave-requests/${id}`, { method: 'DELETE' });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 204)
        return;
    if (!res.ok)
        await throwVacationRequestError(res);
}
export async function fetchVacationLeaveRequestPdfBlob(id) {
    const res = await vacationApiFetch(`/api/v1/vacations/leave-requests/${id}/pdf`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.blob();
}
export async function postVacationScheduleEmployee(body) {
    const res = await vacationApiFetch('/api/v1/vacations/schedule/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json();
}
export async function patchVacationScheduleEmployee(employeeId, body) {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json();
}
export async function deleteVacationScheduleEmployee(employeeId) {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees/${employeeId}`, { method: 'DELETE' });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 204)
        return;
    if (!res.ok)
        await throwVacationRequestError(res);
}
export async function postVacationEmployeeAbsenceDay(employeeId, body) {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees/${employeeId}/absence-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json();
}
export async function patchVacationAbsenceDay(absenceDayId, body) {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/absence-days/${absenceDayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json();
}
export async function deleteVacationAbsenceDay(absenceDayId) {
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
];
function coerceManualEntryDocumentApi(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
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
function coerceManualEntryApi(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const id = int(o.id);
    if (id <= 0)
        return null;
    const docsRaw = o.documents;
    const documents = Array.isArray(docsRaw)
        ? docsRaw.map((d) => coerceManualEntryDocumentApi(d)).filter((x) => x != null)
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
export async function createVacationManualEntry(input) {
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
export async function listVacationManualEntries(options) {
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
    const raw = (await res.json());
    const items = raw && typeof raw === 'object' && Array.isArray(raw.items)
        ? raw.items
        : Array.isArray(raw)
            ? raw
            : [];
    return items
        .map((item) => coerceManualEntryApi(item))
        .filter((x) => x != null);
}
export async function getVacationManualEntry(id) {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/manual-entries/${id}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 404)
        return null;
    if (!res.ok)
        await throwVacationRequestError(res);
    return coerceManualEntryApi(await res.json());
}
export async function addVacationManualEntryDocuments(id, files) {
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
export async function fetchVacationManualEntryDocumentBlob(entryId, docId) {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/manual-entries/${entryId}/documents/${docId}/download`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.blob();
}
export async function deleteVacationManualEntryDocument(entryId, docId) {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/manual-entries/${entryId}/documents/${docId}`, { method: 'DELETE' });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 204)
        return;
    if (!res.ok)
        await throwVacationRequestError(res);
}
export async function deleteVacationManualEntry(id) {
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/manual-entries/${id}`, { method: 'DELETE' });
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (res.status === 204)
        return;
    if (!res.ok)
        await throwVacationRequestError(res);
}
