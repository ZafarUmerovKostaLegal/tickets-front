import type { ExpenseCreatedBy, ExpenseRequest } from './types';
function strOrNull(v: unknown): string | null {
    if (typeof v !== 'string')
        return null;
    const t = v.trim();
    return t ? t : null;
}
function pickStr(o: Record<string, unknown>, keys: string[]): string | null {
    for (const k of keys) {
        const v = strOrNull(o[k]);
        if (v)
            return v;
    }
    return null;
}
function numId(v: unknown, fallback: number): number {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string' && v.trim()) {
        const n = parseInt(v, 10);
        if (Number.isFinite(n))
            return n;
    }
    return fallback;
}
export function normalizeCreatedBy(raw: unknown, createdByUserId: number): ExpenseCreatedBy {
    if (raw == null || typeof raw !== 'object') {
        return {
            id: createdByUserId,
            displayName: null,
            email: null,
            picture: null,
            position: null,
        };
    }
    const o = raw as Record<string, unknown>;
    return {
        id: numId(o.id, createdByUserId),
        displayName: pickStr(o, ['displayName', 'display_name', 'name', 'fullName', 'full_name']),
        email: pickStr(o, ['email', 'mail', 'userPrincipalName']),
        picture: pickStr(o, ['picture', 'photoUrl', 'avatar_url']),
        position: pickStr(o, ['position', 'jobTitle', 'job_title']),
    };
}
export function needsAuthorEnrichment(req: ExpenseRequest): boolean {
    const cb = req.createdBy;
    if (!cb)
        return true;
    return !(cb.displayName?.trim() || cb.email?.trim());
}
export function mergeExpenseAuthorFromCache(req: ExpenseRequest, cache: Readonly<Record<number, ExpenseCreatedBy>>): ExpenseRequest {
    if (!needsAuthorEnrichment(req))
        return req;
    const c = cache[req.createdByUserId];
    if (!c)
        return req;
    const cb = req.createdBy;
    return {
        ...req,
        createdBy: {
            id: req.createdByUserId,
            displayName: c.displayName?.trim() ? c.displayName : cb?.displayName ?? null,
            email: c.email?.trim() ? c.email : cb?.email ?? null,
            picture: c.picture ?? cb?.picture ?? null,
            position: c.position ?? cb?.position ?? null,
        },
    };
}
export function formatExpenseAuthorLabel(req: ExpenseRequest): string {
    const cb = req.createdBy;
    if (cb?.displayName)
        return cb.displayName;
    if (cb?.email)
        return cb.email;
    const id = cb?.id ?? req.createdByUserId;
    return `Пользователь #${id}`;
}
export function formatExpensePaidByLabel(req: ExpenseRequest): string {
    const pb = req.paidBy;
    if (pb?.displayName)
        return pb.displayName;
    if (pb?.email)
        return pb.email;
    if (req.paidByUserId != null)
        return `Пользователь #${req.paidByUserId}`;
    return '—';
}
export function formatExpenseAuthorExport(req: ExpenseRequest): string {
    const cb = req.createdBy;
    const name = cb?.displayName?.trim();
    const email = cb?.email?.trim();
    if (name && email)
        return `${name} (${email})`;
    return formatExpenseAuthorLabel(req);
}
export function expenseAuthorSearchText(req: ExpenseRequest): string {
    const cb = req.createdBy;
    const parts = [
        cb?.displayName,
        cb?.email,
        cb?.position,
        cb?.id != null ? String(cb.id) : '',
        String(req.createdByUserId ?? ''),
    ];
    return parts.filter(Boolean).join(' ').toLowerCase();
}
