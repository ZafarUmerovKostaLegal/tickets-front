import { listProjectsForExpenses } from '@entities/time-tracking';
import { apiFetch } from '@shared/api';
import { createQueryCache } from '@shared/lib/queryCache';
import { normalizeExpenseRequest } from './coerceExpense';
const expenseTypesCache = createQueryCache({ ttlMs: 10 * 60_000, staleWhileRevalidateMs: 30 * 60_000, maxEntries: 1 });
const exchangeRatesCache = createQueryCache({ ttlMs: 60 * 60_000, staleWhileRevalidateMs: 6 * 60 * 60_000, maxEntries: 45 });
const approvalRoutingCache = createQueryCache({ ttlMs: 5 * 60_000, staleWhileRevalidateMs: 15 * 60_000, maxEntries: 1 });
async function throwIfNotOk(res) {
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const j = await res.clone().json();
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
export async function fetchExpenses(params = {}, init) {
    const qs = new URLSearchParams();
    if (params.status)
        qs.set('status', params.status);
    if (params.expenseType)
        qs.set('expenseType', params.expenseType);
    if (params.excludeExpenseType)
        qs.set('excludeExpenseType', params.excludeExpenseType);
    if (params.expenseSubtype)
        qs.set('expenseSubtype', params.expenseSubtype);
    if (params.scopeMode)
        qs.set('scopeMode', params.scopeMode);
    if (params.partnerUserId !== undefined)
        qs.set('partnerUserId', String(params.partnerUserId));
    if (params.isReimbursable !== undefined)
        qs.set('isReimbursable', String(params.isReimbursable));
    if (params.paymentMethod)
        qs.set('paymentMethod', params.paymentMethod);
    if (params.awaitingPayment)
        qs.set('awaitingPayment', 'true');
    if (params.awaitingReimbursement)
        qs.set('awaitingReimbursement', 'true');
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
    const res = await apiFetch(`/api/v1/expenses${query ? `?${query}` : ''}`, {
        getReuseWindowMs: 2_000,
        ...init,
    });
    await throwIfNotOk(res);
    const j = await res.json();
    const hasFilterTotals = j.totalAmountUzs != null ||
        j.total_amount_uzs != null ||
        j.totalEquivalentAmount != null ||
        j.total_equivalent_amount != null;
    return {
        ...j,
        items: (Array.isArray(j.items) ? j.items : []).map(normalizeExpenseRequest),
        totalAmountUzs: hasFilterTotals ? asListMoney(j.totalAmountUzs ?? j.total_amount_uzs) : undefined,
        totalEquivalentAmount: hasFilterTotals
            ? asListMoney(j.totalEquivalentAmount ?? j.total_equivalent_amount)
            : undefined,
    };
}
function asListMoney(v) {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && v.trim()) {
        const n = Number(v.replace(/\s/g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
}
export async function createExpense(body) {
    const res = await apiFetch('/api/v1/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function updateExpense(id, body) {
    const res = await apiFetch(`/api/v1/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function submitExpense(id) {
    const res = await apiFetch(`/api/v1/expenses/${id}/submit`, { method: 'POST' });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function approveExpense(id) {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/approve`, { method: 'POST' });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function rejectExpense(id, reason) {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function reviseExpense(id, comment) {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function fetchExpenseById(id) {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}`, { getReuseWindowMs: 0 });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function withdrawExpense(id) {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/withdraw`, { method: 'POST' });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function deleteExpense(id) {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await throwIfNotOk(res);
}
export async function payExpense(id) {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/pay`, { method: 'POST' });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function unpayExpense(id, comment) {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/unpay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function unapproveExpense(id, comment) {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/unapprove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function closeExpense(id) {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/close`, { method: 'POST' });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function uploadAttachment(id, file, attachmentKind) {
    const form = new FormData();
    form.append('file', file);
    if (attachmentKind)
        form.append('attachmentKind', attachmentKind);
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(id)}/attachments`, {
        method: 'POST',
        body: form,
    });
    await throwIfNotOk(res);
    return normalizeExpenseRequest(await res.json());
}
export async function deleteAttachment(id, attId) {
    const base = `/api/v1/expenses/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attId)}`;
    let res = await apiFetch(`${base}/delete`, { method: 'POST' });
    if (res.status === 404 || res.status === 405) {
        res = await apiFetch(base, { method: 'DELETE' });
    }
    const withoutAtt = (r) => {
        const attachments = (r.attachments ?? []).filter(a => a.id !== attId);
        return { ...r, attachments, attachmentsCount: attachments.length };
    };
    if (res.ok) {
        try {
            return withoutAtt(normalizeExpenseRequest(await res.json()));
        }
        catch {
            /* тело ответа битое — сверка через GET */
        }
    }
    try {
        const fresh = await fetchExpenseById(id);
        const stillThere = (fresh.attachments ?? []).some(a => a.id === attId);
        if (!stillThere)
            return withoutAtt(fresh);
    }
    catch {
        /* исходную ошибку удаления покажем ниже */
    }
    await throwIfNotOk(res);
    throw new Error('Не удалось удалить файл');
}
export async function fetchExpenseAttachmentBlob(expenseId, attachmentId) {
    const res = await apiFetch(`/api/v1/expenses/${encodeURIComponent(expenseId)}/attachments/${encodeURIComponent(attachmentId)}/file`);
    await throwIfNotOk(res);
    const contentType = res.headers.get('Content-Type');
    const blob = await res.blob();
    return { blob, contentType };
}
export async function openExpenseAttachmentInNewTab(expenseId, attachmentId) {
    const { blob } = await fetchExpenseAttachmentBlob(expenseId, attachmentId);
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
        URL.revokeObjectURL(url);
        throw new Error('Браузер заблокировал новую вкладку. Разрешите всплывающие окна для этого сайта.');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
}
export async function fetchExpenseTypes() {
    return expenseTypesCache.fetch('types', async (signal) => {
        const res = await apiFetch('/api/v1/expense-types', { signal, getReuseWindowMs: 60_000 });
        await throwIfNotOk(res);
        return res.json();
    });
}
export async function fetchProjects() {
    const rows = await listProjectsForExpenses();
    return rows.filter((p) => !p.isArchived).map((p) => ({ id: p.id, name: p.name }));
}
export async function fetchExchangeRate(date) {
    const key = date.trim().slice(0, 10);
    return exchangeRatesCache.fetch(key, async (signal) => {
        const res = await apiFetch(`/api/v1/exchange-rates?date=${encodeURIComponent(key)}`, { signal, getReuseWindowMs: 60_000 });
        await throwIfNotOk(res);
        return res.json();
    });
}
export async function fetchApprovalRoutingMeta() {
    return approvalRoutingCache.fetch('meta', async (signal) => {
        const res = await apiFetch('/api/v1/approval-routing-meta', { signal, getReuseWindowMs: 60_000 });
        await throwIfNotOk(res);
        return res.json();
    });
}
