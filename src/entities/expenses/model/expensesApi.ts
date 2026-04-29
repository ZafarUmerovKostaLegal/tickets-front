import { listProjectsForExpenses } from '@entities/time-tracking';
import { apiFetch } from '@shared/api';
import { normalizeExpenseRequest } from './coerceExpense';
import type { ExpenseRequest, ExpenseAttachmentKind, ListParams, ExpenseTypeRef, ProjectRef, } from './types';
interface ListResponse {
    items: ExpenseRequest[];
    total: number;
    skip: number;
    limit: number;
}
interface ExchangeRateResponse {
    date: string;
    rate: number;
    pairLabel: string;
}
async function throwIfNotOk(res: Response): Promise<Response> {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const j = await res.clone().json() as {
                detail?: string;
                message?: string;
            };
            if (j.detail)
                msg = j.detail;
            else if (j.message)
                msg = j.message;
        }
        catch { }
        throw new Error(msg);
    }
    return res;
}
export async function fetchExpenses(params: ListParams = {}, init?: RequestInit): Promise<ListResponse> {
    const qs = new URLSearchParams();
    if (params.status)
        qs.set('status', params.status);
    if (params.expenseType)
        qs.set('expenseType', params.expenseType);
    if (params.isReimbursable !== undefined)
        qs.set('isReimbursable', String(params.isReimbursable));
    if (params.dateFrom)
        qs.set('dateFrom', params.dateFrom);
    if (params.dateTo)
        qs.set('dateTo', params.dateTo);
    if (params.q)
        qs.set('q', params.q);
    if (params.sortBy)
        qs.set('sortBy', params.sortBy);
    if (params.sortOrder)
        qs.set('sortOrder', params.sortOrder);
    if (params.skip !== undefined)
        qs.set('skip', String(params.skip));
    if (params.limit !== undefined)
        qs.set('limit', String(params.limit));
    if (params.employeeUserId !== undefined)
        qs.set('employeeUserId', String(params.employeeUserId));
    if (params.projectId?.trim())
        qs.set('projectId', params.projectId.trim());
    const query = qs.toString();
    const res = await apiFetch(`/api/v1/expenses${query ? `?${query}` : ''}`, init ?? {});
    await throwIfNotOk(res);
    const j = await res.json() as ListResponse;
    return { ...j, items: j.items.map(normalizeExpenseRequest) };
}
export interface ExpenseCreateBody {
    description: string;
    expenseDate: string;
    paymentDeadline?: string | null;
    amountUzs: number;
    exchangeRate: number;
    expenseType: string;
    expenseSubtype?: string | null;
    isReimbursable: boolean;
    paymentMethod?: string;
    projectId?: string;
    expenseCategoryId?: string | null;
    vendor?: string;
    businessPurpose?: string;
    comment?: string;
}
export async function createExpense(body: ExpenseCreateBody): Promise<ExpenseRequest> {
    const res = await apiFetch('/api/v1/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function updateExpense(id: string, body: Partial<ExpenseCreateBody>): Promise<ExpenseRequest> {
    const res = await apiFetch(`/api/v1/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function submitExpense(id: string): Promise<ExpenseRequest> {
    const res = await apiFetch(`/api/v1/expenses/${id}/submit`, { method: 'POST' });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function approveExpense(id: string): Promise<ExpenseRequest> {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/approve`, { method: 'POST' });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function rejectExpense(id: string, reason: string): Promise<ExpenseRequest> {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function reviseExpense(id: string, comment: string): Promise<ExpenseRequest> {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function fetchExpenseById(id: string): Promise<ExpenseRequest> {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}`);
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function withdrawExpense(id: string): Promise<ExpenseRequest> {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/withdraw`, { method: 'POST' });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function payExpense(id: string): Promise<ExpenseRequest> {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/pay`, { method: 'POST' });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function closeExpense(id: string): Promise<ExpenseRequest> {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/close`, { method: 'POST' });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function uploadAttachment(id: string, file: File, attachmentKind?: ExpenseAttachmentKind): Promise<ExpenseRequest> {
    const form = new FormData();
    form.append('file', file);
    if (attachmentKind)
        form.append('attachmentKind', attachmentKind);
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/attachments`, {
        method: 'POST',
        body: form,
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function deleteAttachment(id: string, attId: string): Promise<ExpenseRequest> {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attId)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json() as ExpenseRequest);
}
export async function fetchExpenseAttachmentBlob(expenseId: string, attachmentId: string): Promise<{
    blob: Blob;
    contentType: string | null;
}> {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(expenseId)}/attachments/${encodeURIComponent(attachmentId)}/file`);
    await throwIfNotOk(res);
    const contentType = res.headers.get('Content-Type');
    const blob = await res.blob();
    return { blob, contentType };
}
export async function openExpenseAttachmentInNewTab(expenseId: string, attachmentId: string): Promise<void> {
    const { blob } = await fetchExpenseAttachmentBlob(expenseId, attachmentId);
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
        URL.revokeObjectURL(url);
        throw new Error('Браузер заблокировал новую вкладку. Разрешите всплывающие окна для этого сайта.');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
}
export async function fetchExpenseTypes(): Promise<ExpenseTypeRef[]> {
    const res = await apiFetch('/api/v1/expense-types');
    await throwIfNotOk(res);
    return res.json() as Promise<ExpenseTypeRef[]>;
}
export async function fetchProjects(): Promise<ProjectRef[]> {
    const rows = await listProjectsForExpenses();
    return rows.map((p) => ({ id: p.id, name: p.name }));
}
export async function fetchExchangeRate(date: string): Promise<ExchangeRateResponse> {
    const res = await apiFetch(`/api/v1/exchange-rates?date=${date}`);
    await throwIfNotOk(res);
    return res.json() as Promise<ExchangeRateResponse>;
}
