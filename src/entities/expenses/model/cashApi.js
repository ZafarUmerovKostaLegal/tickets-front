import { apiFetch } from '@shared/api';
async function throwIfNotOk(res) {
    if (res.ok)
        return res;
    let msg = `HTTP ${res.status}`;
    try {
        const j = await res.clone().json();
        if (typeof j.detail === 'string' && j.detail)
            msg = j.detail;
    }
    catch { /* keep status text */ }
    throw new Error(msg);
}
export async function fetchCashState(q) {
    const term = (q ?? '').trim();
    const path = term
        ? `/api/v1/expenses/cash?q=${encodeURIComponent(term)}`
        : '/api/v1/expenses/cash';
    const res = await throwIfNotOk(await apiFetch(path));
    return res.json();
}
export function isManualCashMovement(row) {
    return !row.expenseId && (row.kind === 'expense' || row.kind === 'topup');
}
export async function updateCashMovement(id, amount, note) {
    const res = await throwIfNotOk(await apiFetch(`/api/v1/expenses/cash/movements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note }),
    }));
    return res.json();
}
export async function deleteCashMovement(id) {
    const res = await throwIfNotOk(await apiFetch(`/api/v1/expenses/cash/movements/${id}`, {
        method: 'DELETE',
    }));
    return res.json();
}
export async function uploadCashAttachment(movementId, file) {
    const body = new FormData();
    body.append('file', file);
    const res = await throwIfNotOk(await apiFetch(`/api/v1/expenses/cash/movements/${movementId}/attachments`, {
        method: 'POST',
        body,
    }));
    return res.json();
}
export async function deleteCashAttachment(movementId, attachmentId) {
    const res = await throwIfNotOk(await apiFetch(`/api/v1/expenses/cash/movements/${movementId}/attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE' }));
    return res.json();
}
export async function fetchCashAttachmentBlob(movementId, attachmentId) {
    const res = await throwIfNotOk(await apiFetch(`/api/v1/expenses/cash/movements/${movementId}/attachments/${encodeURIComponent(attachmentId)}/file`));
    return { blob: await res.blob(), contentType: res.headers.get('Content-Type') };
}
export async function openCashAttachment(movementId, attachmentId) {
    const res = await throwIfNotOk(await apiFetch(`/api/v1/expenses/cash/movements/${movementId}/attachments/${encodeURIComponent(attachmentId)}/file`));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
        URL.revokeObjectURL(url);
        throw new Error('Браузер заблокировал новую вкладку. Разрешите всплывающие окна для этого сайта.');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
}
export async function postCashAction(kind, amount, note) {
    const res = await throwIfNotOk(await apiFetch(`/api/v1/expenses/cash/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note }),
    }));
    return res.json();
}
