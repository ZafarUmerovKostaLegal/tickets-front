import { apiFetch } from '@shared/api';

export type CashKind = 'set' | 'expense' | 'topup';

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

export async function fetchCashState(): Promise<CashState> {
    const res = await throwIfNotOk(await apiFetch('/api/v1/expenses/cash'));
    return res.json() as Promise<CashState>;
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
