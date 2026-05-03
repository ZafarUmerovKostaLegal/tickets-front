import { apiFetch } from '@shared/api';
import type { ByDateReportOut, CalendarReportOut, DynamicsPointOut, ExpenseListResponse, ExpenseRequestCreateBody, ExpenseRequestOut, ExpenseRequestStatusPatchBody, SummaryReportOut, } from './model/apiTypes';
import { parseExpensesError } from './lib/parseError';
const BASE = '/api/v1/expenses';
const TIMEOUT_MS = 30000;
function isAbort(e: unknown): boolean {
    return ((e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError'));
}
export type ListExpenseRequestsParams = {
    status?: string;
    budget_category?: string;
    date_from?: string;
    date_to?: string;
    skip?: number;
    limit?: number;
    signal?: AbortSignal;
};
export async function listExpenseRequests(params: ListExpenseRequestsParams = {}): Promise<ExpenseListResponse> {
    const q = new URLSearchParams();
    if (params.status)
        q.set('status', params.status);
    if (params.budget_category)
        q.set('budget_category', params.budget_category);
    if (params.date_from)
        q.set('date_from', params.date_from);
    if (params.date_to)
        q.set('date_to', params.date_to);
    q.set('skip', String(params.skip ?? 0));
    q.set('limit', String(params.limit ?? 50));
    const sig = params.signal ?? AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
        res = await apiFetch(`${BASE}/requests?${q}`, { signal: sig });
    }
    catch (e) {
        if (isAbort(e))
            throw new Error('Превышено время ожидания списка заявок.');
        throw new Error('Сервис расходов недоступен.');
    }
    if (res.status === 403)
        throw new Error('Нет доступа к заявкам на расходы.');
    if (!res.ok)
        throw new Error(await parseExpensesError(res));
    return res.json() as Promise<ExpenseListResponse>;
}
export async function createExpenseRequest(body: ExpenseRequestCreateBody, signal?: AbortSignal): Promise<ExpenseRequestOut> {
    const sig = signal ?? AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
        res = await apiFetch(`${BASE}/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: sig,
        });
    }
    catch (e) {
        if (isAbort(e))
            throw new Error('Превышено время ожидания при создании заявки.');
        throw new Error('Сервис расходов недоступен.');
    }
    if (res.status === 403)
        throw new Error('Нет доступа к созданию заявок.');
    if (!res.ok)
        throw new Error(await parseExpensesError(res));
    return res.json() as Promise<ExpenseRequestOut>;
}
export async function patchExpenseRequestStatus(id: number, body: ExpenseRequestStatusPatchBody, signal?: AbortSignal): Promise<ExpenseRequestOut> {
    const sig = signal ?? AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
        res = await apiFetch(`${BASE}/requests/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: sig,
        });
    }
    catch (e) {
        if (isAbort(e))
            throw new Error('Превышено время ожидания при смене статуса заявки.');
        throw new Error('Сервис расходов недоступен.');
    }
    if (res.status === 403)
        throw new Error('Нет прав на согласование или отклонение заявок.');
    if (!res.ok)
        throw new Error(await parseExpensesError(res));
    return res.json() as Promise<ExpenseRequestOut>;
}
export async function fetchExpenseCalendar(year: number, month: number, signal?: AbortSignal): Promise<CalendarReportOut> {
    const q = new URLSearchParams({ year: String(year), month: String(month) });
    const sig = signal ?? AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
        res = await apiFetch(`${BASE}/reports/calendar?${q}`, { signal: sig });
    }
    catch (e) {
        if (isAbort(e))
            throw new Error('Превышено время ожидания календаря расходов.');
        throw new Error('Сервис расходов недоступен.');
    }
    if (res.status === 403)
        throw new Error('Нет доступа к отчётам расходов.');
    if (!res.ok)
        throw new Error(await parseExpensesError(res));
    return res.json() as Promise<CalendarReportOut>;
}
export async function fetchExpensesByDate(date: string, signal?: AbortSignal): Promise<ByDateReportOut> {
    const q = new URLSearchParams({ date });
    const sig = signal ?? AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
        res = await apiFetch(`${BASE}/reports/by-date?${q}`, { signal: sig });
    }
    catch (e) {
        if (isAbort(e))
            throw new Error('Превышено время ожидания данных за день.');
        throw new Error('Сервис расходов недоступен.');
    }
    if (res.status === 403)
        throw new Error('Нет доступа к отчётам расходов.');
    if (!res.ok)
        throw new Error(await parseExpensesError(res));
    return res.json() as Promise<ByDateReportOut>;
}
export type SummaryParams = {
    period: 'day' | 'week' | 'month' | 'custom';
    anchor?: string;
    date_from?: string;
    date_to?: string;
    budget_category?: string;
    currency?: string;
    signal?: AbortSignal;
};
export async function fetchExpensesSummary(params: SummaryParams): Promise<SummaryReportOut> {
    const q = new URLSearchParams({ period: params.period });
    if (params.anchor)
        q.set('anchor', params.anchor);
    if (params.date_from)
        q.set('date_from', params.date_from);
    if (params.date_to)
        q.set('date_to', params.date_to);
    if (params.budget_category)
        q.set('budget_category', params.budget_category);
    if (params.currency)
        q.set('currency', params.currency);
    const sig = params.signal ?? AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
        res = await apiFetch(`${BASE}/reports/summary?${q}`, { signal: sig });
    }
    catch (e) {
        if (isAbort(e))
            throw new Error('Превышено время ожидания сводки.');
        throw new Error('Сервис расходов недоступен.');
    }
    if (res.status === 403)
        throw new Error('Нет доступа к отчётам расходов.');
    if (!res.ok)
        throw new Error(await parseExpensesError(res));
    return res.json() as Promise<SummaryReportOut>;
}
export async function fetchExpensesDynamics(params: Omit<SummaryParams, 'currency'> & {
    period?: 'day' | 'week' | 'month' | 'custom';
}): Promise<DynamicsPointOut[]> {
    const q = new URLSearchParams({ period: params.period ?? 'month' });
    if (params.anchor)
        q.set('anchor', params.anchor);
    if (params.date_from)
        q.set('date_from', params.date_from);
    if (params.date_to)
        q.set('date_to', params.date_to);
    if (params.budget_category)
        q.set('budget_category', params.budget_category);
    const sig = params.signal ?? AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
        res = await apiFetch(`${BASE}/reports/dynamics?${q}`, { signal: sig });
    }
    catch (e) {
        if (isAbort(e))
            throw new Error('Превышено время ожидания динамики.');
        throw new Error('Сервис расходов недоступен.');
    }
    if (res.status === 403)
        throw new Error('Нет доступа к отчётам расходов.');
    if (!res.ok)
        throw new Error(await parseExpensesError(res));
    return res.json() as Promise<DynamicsPointOut[]>;
}
/** Ответ агрегата `GET …/project-totals/{projectId}` (суммы расходов по проекту в периоде). */
export type ExpenseProjectTotalsOut = {
    total_amount_uzs: number;
    total_equivalent_amount: number;
    count: number;
};
function parseExpenseProjectTotalsJson(raw: unknown): ExpenseProjectTotalsOut {
    const o = raw != null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const num = (...keys: string[]): number => {
        for (const k of keys) {
            const v = o[k];
            if (typeof v === 'number' && Number.isFinite(v))
                return v;
            if (typeof v === 'string' && v.trim() !== '') {
                const n = Number.parseFloat(String(v).replace(',', '.'));
                if (Number.isFinite(n))
                    return n;
            }
        }
        return 0;
    };
    return {
        total_amount_uzs: num('total_amount_uzs', 'totalAmountUzs'),
        total_equivalent_amount: num('total_equivalent_amount', 'totalEquivalentAmount'),
        count: Math.round(num('count', 'Count')),
    };
}
export async function fetchExpenseProjectTotals(projectId: string, params?: {
    dateFrom?: string;
    dateTo?: string;
}, signal?: AbortSignal): Promise<ExpenseProjectTotalsOut> {
    const pid = String(projectId ?? '').trim();
    if (!pid)
        throw new Error('Не указан projectId для агрегата расходов.');
    const q = new URLSearchParams();
    const from = params?.dateFrom?.trim().slice(0, 10);
    const to = params?.dateTo?.trim().slice(0, 10);
    if (from)
        q.set('date_from', from);
    if (to)
        q.set('date_to', to);
    const sig = signal ?? AbortSignal.timeout(TIMEOUT_MS);
    const qs = q.toString() ? `?${q}` : '';
    let res: Response;
    try {
        res = await apiFetch(`${BASE}/project-totals/${encodeURIComponent(pid)}${qs}`, { signal: sig });
    }
    catch (e) {
        if (isAbort(e))
            throw new Error('Превышено время ожидания агрегата расходов по проекту.');
        throw new Error('Сервис расходов недоступен.');
    }
    if (res.status === 403)
        throw new Error('Нет доступа к агрегату расходов по проекту.');
    if (!res.ok)
        throw new Error(await parseExpensesError(res));
    let body: unknown;
    try {
        body = await res.json();
    }
    catch {
        throw new Error('Некорректный JSON в ответе агрегата расходов.');
    }
    return parseExpenseProjectTotalsJson(body);
}
