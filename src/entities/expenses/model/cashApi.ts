import { apiFetch } from '@shared/api';

export type CashKind = 'set' | 'expense' | 'topup';

export type CashAttachment = {
    id: string;
    fileName: string;
    mimeType: string;
};

export type CashMovement = {
    id: number;
    kind: CashKind;
    amount: string;
    note: string;
    balanceBefore: string | null;
    balanceAfter: string;
    createdByUserId: number;
    createdAt: string;
    expenseId?: string | null;
    text: string;
    attachments?: CashAttachment[];
};

export type CashState = {
    balance: string | null;
    balanceSet: boolean;
    history: CashMovement[];
};

async function throwIfNotOk(res: Response): Promise<Response> {
    if (res.ok)
        return res;
    let msg = `HTTP ${res.status}`;
    try {
        const j = await res.clone().json() as { detail?: string };
        if (typeof j.detail === 'string' && j.detail)
            msg = j.detail;
    }
    catch { /* keep status text */ }
    throw new Error(msg);
}

export async function fetchCashState(q?: string): Promise<CashState> {
    const term = (q ?? '').trim();
    const path = term
        ? `/api/v1/expenses/cash?q=${encodeURIComponent(term)}`
        : '/api/v1/expenses/cash';
    const res = await throwIfNotOk(await apiFetch(path));
    return res.json() as Promise<CashState>;
}

export function isManualCashMovement(row: CashMovement): boolean {
    return !row.expenseId && (row.kind === 'expense' || row.kind === 'topup');
}

export async function updateCashMovement(
    id: number,
    amount: string,
    note: string,
): Promise<{ balance: string; message: string; movement: CashMovement }> {
    const res = await throwIfNotOk(await apiFetch(`/api/v1/expenses/cash/movements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note }),
    }));
    return res.json() as Promise<{ balance: string; message: string; movement: CashMovement }>;
}

export async function deleteCashMovement(id: number): Promise<{ balance: string }> {
    const res = await throwIfNotOk(await apiFetch(`/api/v1/expenses/cash/movements/${id}`, {
        method: 'DELETE',
    }));
    return res.json() as Promise<{ balance: string }>;
}

export async function uploadCashAttachment(movementId: number, file: File): Promise<CashMovement> {
    const body = new FormData();
    body.append('file', file);
    const res = await throwIfNotOk(await apiFetch(`/api/v1/expenses/cash/movements/${movementId}/attachments`, {
        method: 'POST',
        body,
    }));
    return res.json() as Promise<CashMovement>;
}

export async function deleteCashAttachment(movementId: number, attachmentId: string): Promise<CashMovement> {
    const res = await throwIfNotOk(await apiFetch(
        `/api/v1/expenses/cash/movements/${movementId}/attachments/${encodeURIComponent(attachmentId)}`,
        { method: 'DELETE' },
    ));
    return res.json() as Promise<CashMovement>;
}

export async function openCashAttachment(movementId: number, attachmentId: string): Promise<void> {
    const res = await throwIfNotOk(await apiFetch(
        `/api/v1/expenses/cash/movements/${movementId}/attachments/${encodeURIComponent(attachmentId)}/file`,
    ));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
        URL.revokeObjectURL(url);
        throw new Error('Браузер заблокировал новую вкладку. Разрешите всплывающие окна для этого сайта.');
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
}

export async function postCashAction(
    kind: 'balance' | 'expense' | 'topup',
    amount: string,
    note: string,
): Promise<{ balance: string; message: string; movement: CashMovement }> {
    const res = await throwIfNotOk(await apiFetch(`/api/v1/expenses/cash/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note }),
    }));
    return res.json() as Promise<{ balance: string; message: string; movement: CashMovement }>;
}
