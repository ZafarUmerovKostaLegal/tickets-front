import { apiFetch } from '@shared/api';
import type { AttendanceQuery, AttendanceRecord } from './model/types';
import type { DailyAttendanceResponse } from './model/dailyReportTypes';
import type { WorkdaySettingsDto } from './model/workdaySettingsTypes';
import type {
    HikvisionDeviceUsersResponse,
    HikvisionUserBinding,
    UpsertHikvisionMappingBody,
} from './model/hikvisionTypes';
import { getAttendanceApiUrl } from './lib/config';
import { buildAttendanceQuery } from './lib/query';
import { flattenAttendanceByCamera } from './lib/transform';
import { parseAttendanceJson } from './lib/parseResponse';
import { createQueryCache } from '@shared/lib/queryCache';
const FETCH_TIMEOUT_MS = 30000;
const workdaySettingsCache = createQueryCache<WorkdaySettingsDto>({ ttlMs: 5 * 60_000 });
const WORKDAY_SETTINGS_CACHE_KEY = 'attendance-workday-settings';
function attendanceFetch(path: string, init?: Parameters<typeof apiFetch>[1]): Promise<Response> {
    return apiFetch(getAttendanceApiUrl(path), {
        skipAuthRedirectOn401: true,
        ...init,
    });
}
function isAbortError(e: unknown): boolean {
    return ((e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError'));
}
export async function fetchAttendance(options: AttendanceQuery): Promise<AttendanceRecord[]> {
    const query = buildAttendanceQuery(options);
    const path = `/api/v1/attendance/hikvision/attendance?${query}`;
    const signal = options.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
    let res: Response;
    try {
        res = await attendanceFetch(path, { signal });
    }
    catch (e) {
        if (isAbortError(e)) {
            throw new Error('Превышено время ожидания ответа посещаемости. Проверьте, что API запущен (прокси / бэкенд).');
        }
        throw new Error('Сервис посещаемости недоступен. Проверьте подключение или настройки сети.');
    }
    if (res.status === 403) {
        throw new Error('Нет доступа к данным посещаемости. Обратитесь к администратору.');
    }
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Ошибка сервиса посещаемости (${res.status})`);
    }
    const data = await parseAttendanceJson(res);
    return flattenAttendanceByCamera(data);
}
export async function fetchDailyAttendanceReport(day: string, signal?: AbortSignal): Promise<DailyAttendanceResponse> {
    const q = new URLSearchParams({ day });
    const path = `/api/v1/attendance/report/daily?${q}`;
    const sig = signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
    let res: Response;
    try {
        res = await attendanceFetch(path, { signal: sig });
    }
    catch (e) {
        if (isAbortError(e)) {
            throw new Error('Превышено время ожидания ответа посещаемости.');
        }
        throw new Error('Сервис посещаемости недоступен.');
    }
    if (res.status === 403) {
        throw new Error('Нет доступа к данным посещаемости. Обратитесь к администратору.');
    }
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Ошибка дневного отчёта (${res.status})`);
    }
    return res.json() as Promise<DailyAttendanceResponse>;
}
async function fetchWorkdaySettingsFromApi(signal?: AbortSignal): Promise<WorkdaySettingsDto> {
    const path = '/api/v1/attendance/settings/workday';
    const sig = signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
    let res: Response;
    try {
        res = await attendanceFetch(path, { signal: sig });
    }
    catch (e) {
        if (isAbortError(e)) {
            throw new Error('Превышено время ожидания настроек рабочего дня.');
        }
        throw new Error('Не удалось загрузить настройки рабочего дня.');
    }
    if (res.status === 403) {
        throw new Error('Нет доступа к настройкам посещаемости.');
    }
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Ошибка загрузки настроек (${res.status})`);
    }
    return res.json() as Promise<WorkdaySettingsDto>;
}
export async function fetchWorkdaySettings(signal?: AbortSignal): Promise<WorkdaySettingsDto> {
    if (signal)
        return fetchWorkdaySettingsFromApi(signal);
    return workdaySettingsCache.fetch(WORKDAY_SETTINGS_CACHE_KEY, () => fetchWorkdaySettingsFromApi());
}
export async function patchWorkdaySettings(body: WorkdaySettingsDto, signal?: AbortSignal): Promise<WorkdaySettingsDto> {
    const path = '/api/v1/attendance/settings/workday';
    const sig = signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
    let res: Response;
    try {
        res = await attendanceFetch(path, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: sig,
        });
    }
    catch (e) {
        if (isAbortError(e)) {
            throw new Error('Превышено время ожидания при сохранении настроек.');
        }
        throw new Error('Не удалось сохранить настройки рабочего дня.');
    }
    if (res.status === 403) {
        throw new Error('Нет доступа к изменению настроек посещаемости.');
    }
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Ошибка сохранения настроек (${res.status})`);
    }
    workdaySettingsCache.invalidate(WORKDAY_SETTINGS_CACHE_KEY);
    const raw = await res.text();
    if (!raw.trim()) {
        const updated = await fetchWorkdaySettingsFromApi(sig);
        workdaySettingsCache.prime(WORKDAY_SETTINGS_CACHE_KEY, updated);
        return updated;
    }
    try {
        const updated = JSON.parse(raw) as WorkdaySettingsDto;
        workdaySettingsCache.prime(WORKDAY_SETTINGS_CACHE_KEY, updated);
        return updated;
    }
    catch {
        const updated = await fetchWorkdaySettingsFromApi(sig);
        workdaySettingsCache.prime(WORKDAY_SETTINGS_CACHE_KEY, updated);
        return updated;
    }
}
export type UploadAttendanceExplanationParams = {
    day: string;
    cameraEmployeeNo: string;
    status: 'late' | 'absent';
    appUserId?: number | null;
    file: File;
    signal?: AbortSignal;
};
async function parseAttendanceErrorBody(res: Response): Promise<string> {
    const text = await res.text().catch(() => '');
    try {
        const j = JSON.parse(text) as {
            detail?: unknown;
        };
        if (typeof j.detail === 'string')
            return j.detail;
        if (Array.isArray(j.detail))
            return j.detail.map(String).join(', ');
    }
    catch {
    }
    return text || `Ошибка (${res.status})`;
}
export async function uploadAttendanceExplanation(params: UploadAttendanceExplanationParams): Promise<unknown> {
    const sig = params.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const form = new FormData();
    form.append('day', params.day);
    form.append('camera_employee_no', params.cameraEmployeeNo);
    form.append('status', params.status);
    if (params.appUserId != null)
        form.append('app_user_id', String(params.appUserId));
    form.append('file', params.file);
    let res: Response;
    try {
        res = await attendanceFetch('/api/v1/attendance/explanations/upload', {
            method: 'POST',
            body: form,
            signal: sig,
        });
    }
    catch (e) {
        if (isAbortError(e)) {
            throw new Error('Превышено время ожидания при загрузке файла.');
        }
        throw new Error('Не удалось отправить объяснительную.');
    }
    if (res.status === 403) {
        throw new Error('Нет доступа к загрузке объяснительных.');
    }
    if (!res.ok) {
        throw new Error(await parseAttendanceErrorBody(res));
    }
    const raw = await res.text();
    if (!raw.trim())
        return {};
    try {
        return JSON.parse(raw) as unknown;
    }
    catch {
        return {};
    }
}

export async function fetchHikvisionUsers(name?: string, signal?: AbortSignal): Promise<HikvisionDeviceUsersResponse[]> {
    const params = new URLSearchParams({ max_users_per_device: '20000' });
    if (name?.trim())
        params.set('name', name.trim());
    const path = `/api/v1/attendance/hikvision/users?${params}`;
    const sig = signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
    let res: Response;
    try {
        res = await attendanceFetch(path, { signal: sig });
    }
    catch (e) {
        if (isAbortError(e)) {
            throw new Error('Превышено время ожидания при загрузке пользователей Hikvision.');
        }
        throw new Error('Не удалось загрузить пользователей с камер.');
    }
    if (res.status === 403) {
        throw new Error('Нет доступа к пользователям Hikvision.');
    }
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Ошибка загрузки пользователей Hikvision (${res.status})`);
    }
    return res.json() as Promise<HikvisionDeviceUsersResponse[]>;
}

export async function listHikvisionMappings(signal?: AbortSignal): Promise<HikvisionUserBinding[]> {
    const path = '/api/v1/attendance/hikvision/mappings';
    const sig = signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
    let res: Response;
    try {
        res = await attendanceFetch(path, { signal: sig });
    }
    catch (e) {
        if (isAbortError(e)) {
            throw new Error('Превышено время ожидания при загрузке привязок.');
        }
        throw new Error('Не удалось загрузить привязки Hikvision.');
    }
    if (res.status === 403) {
        throw new Error('Нет доступа к привязкам Hikvision.');
    }
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Ошибка загрузки привязок (${res.status})`);
    }
    return res.json() as Promise<HikvisionUserBinding[]>;
}

export async function upsertHikvisionMapping(body: UpsertHikvisionMappingBody, signal?: AbortSignal): Promise<HikvisionUserBinding> {
    const path = '/api/v1/attendance/hikvision/mappings';
    const sig = signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
    let res: Response;
    try {
        res = await attendanceFetch(path, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: sig,
        });
    }
    catch (e) {
        if (isAbortError(e)) {
            throw new Error('Превышено время ожидания при сохранении привязки.');
        }
        throw new Error('Не удалось сохранить привязку.');
    }
    if (res.status === 403) {
        throw new Error('Нет прав на управление привязками Hikvision.');
    }
    if (!res.ok) {
        throw new Error(await parseAttendanceErrorBody(res));
    }
    return res.json() as Promise<HikvisionUserBinding>;
}

export async function deleteHikvisionMapping(cameraEmployeeNo: string, signal?: AbortSignal): Promise<void> {
    const encoded = encodeURIComponent(cameraEmployeeNo);
    const path = `/api/v1/attendance/hikvision/mappings/${encoded}`;
    const sig = signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS);
    let res: Response;
    try {
        res = await attendanceFetch(path, { method: 'DELETE', signal: sig });
    }
    catch (e) {
        if (isAbortError(e)) {
            throw new Error('Превышено время ожидания при удалении привязки.');
        }
        throw new Error('Не удалось удалить привязку.');
    }
    if (res.status === 403) {
        throw new Error('Нет прав на управление привязками Hikvision.');
    }
    if (!res.ok) {
        throw new Error(await parseAttendanceErrorBody(res));
    }
}

export type AttendanceRangeMarker = {
    date: string;
    app_user_id: number;
    status: 'late' | 'absent';
    first_event_time: string | null;
    camera_employee_no: string | null;
    display_name: string | null;
    explanation_text: string | null;
    explanation_file_url: string | null;
};

export type AttendanceRangeReportResponse = {
    date_from: string;
    date_to: string;
    items: AttendanceRangeMarker[];
    snapshot?: {
        status: 'ready' | 'building' | 'empty' | 'live';
        stale?: boolean;
        built_at?: string | null;
        item_count?: number;
        coverage_start?: string;
        coverage_end?: string;
        refresh_interval_sec?: number;
    };
};

export async function fetchAttendanceRangeReport(
    dateFrom: string,
    dateTo: string,
    signal?: AbortSignal,
): Promise<AttendanceRangeReportResponse> {
    const q = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    const path = `/api/v1/attendance/report/range?${q}`;
    const sig = signal ?? AbortSignal.timeout(60_000);
    let res: Response;
    try {
        res = await attendanceFetch(path, { signal: sig });
    }
    catch (e) {
        if (isAbortError(e)) {
            throw new Error('Превышено время ожидания отчёта посещаемости за период.');
        }
        throw new Error('Сервис посещаемости недоступен.');
    }
    if (res.status === 403) {
        throw new Error('Нет доступа к маркерам посещаемости для графика отпусков.');
    }
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Ошибка отчёта за период (${res.status})`);
    }
    return res.json() as Promise<AttendanceRangeReportResponse>;
}
