import { apiFetch } from '@shared/api';

function vacationApiFetch(path: string, init?: Parameters<typeof apiFetch>[1]): Promise<Response> {
    return apiFetch(path, { skipAuthRedirectOn401: true, ...init });
}

export type VacationScheduleEmployeeApi = {
    id: number;
    year: number;
    excel_row_no: number | null;
    full_name: string;
    planned_period_note: string | null;
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
export async function listVacationScheduleEmployees(year: number): Promise<VacationScheduleEmployeeApi[]> {
    const q = new URLSearchParams({ year: String(year) });
    const res = await vacationApiFetch(`/api/v1/vacations/schedule/employees?${q}`);
    if (res.status === 401)
        throw new Error('Не авторизован');
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<VacationScheduleEmployeeApi[]>;
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
    if (!res.ok)
        await throwVacationRequestError(res);
    return res.json() as Promise<VacationScheduleImportResultApi>;
}
export type PostVacationScheduleEmployeeBody = {
    year: number;
    full_name: string;
    excel_row_no?: number;
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
