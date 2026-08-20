export type ExpensesFiltersVariant = 'default' | 'moderationQueue' | 'partner' | 'client';

export type ExpensesFilterSlotId =
    | 'status'
    | 'type'
    | 'subtype'
    | 'partner'
    | 'author'
    | 'reimbursable'
    | 'period'
    | 'sort';

export const DEFAULT_EXPENSES_FILTER_ORDER: readonly ExpensesFilterSlotId[] = [
    'status',
    'type',
    'subtype',
    'partner',
    'author',
    'reimbursable',
    'period',
    'sort',
] as const;

const SLOT_SET = new Set<ExpensesFilterSlotId>(DEFAULT_EXPENSES_FILTER_ORDER);
const STORAGE_PREFIX = 'tickets.expenses.filterOrder.v1';

export function expensesFilterOrderStorageKey(userId: number, variant: ExpensesFiltersVariant): string {
    return `${STORAGE_PREFIX}:${userId}:${variant}`;
}

export function availableExpensesFilterSlots(args: {
    variant: ExpensesFiltersVariant;
    canModerate: boolean;
}): ExpensesFilterSlotId[] {
    const isModerationQueue = args.variant === 'moderationQueue';
    const isPartnerScope = args.variant === 'partner';
    const isClientScope = args.variant === 'client';
    const out: ExpensesFilterSlotId[] = [];
    if (!isModerationQueue)
        out.push('status');
    if (!isPartnerScope && !isClientScope)
        out.push('type');
    if (isPartnerScope) {
        out.push('subtype');
        out.push('partner');
    }
    if (args.canModerate)
        out.push('author');
    out.push('reimbursable', 'period', 'sort');
    return out;
}

export function mergeExpensesFilterOrder(
    saved: readonly ExpensesFilterSlotId[] | null | undefined,
    available: readonly ExpensesFilterSlotId[],
): ExpensesFilterSlotId[] {
    const avail = new Set(available);
    const out: ExpensesFilterSlotId[] = [];
    const seen = new Set<ExpensesFilterSlotId>();
    for (const id of saved ?? []) {
        if (!avail.has(id) || seen.has(id))
            continue;
        out.push(id);
        seen.add(id);
    }
    for (const id of available) {
        if (seen.has(id))
            continue;
        out.push(id);
        seen.add(id);
    }
    return out;
}

export function reorderExpensesFilterOrder(
    order: readonly ExpensesFilterSlotId[],
    dragId: ExpensesFilterSlotId,
    targetId: ExpensesFilterSlotId,
): ExpensesFilterSlotId[] {
    const from = order.indexOf(dragId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0 || from === to)
        return [...order];
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    return next;
}

export function normalizeExpensesFilterOrder(value: unknown): ExpensesFilterSlotId[] | null {
    if (!Array.isArray(value))
        return null;
    const out: ExpensesFilterSlotId[] = [];
    const seen = new Set<ExpensesFilterSlotId>();
    for (const item of value) {
        if (typeof item !== 'string' || !SLOT_SET.has(item as ExpensesFilterSlotId))
            continue;
        const id = item as ExpensesFilterSlotId;
        if (seen.has(id))
            continue;
        out.push(id);
        seen.add(id);
    }
    return out.length > 0 ? out : null;
}

export function loadExpensesFilterOrder(
    userId: number,
    variant: ExpensesFiltersVariant,
): ExpensesFilterSlotId[] | null {
    if (typeof window === 'undefined')
        return null;
    try {
        const raw = window.localStorage.getItem(expensesFilterOrderStorageKey(userId, variant));
        return normalizeExpensesFilterOrder(raw ? JSON.parse(raw) : null);
    }
    catch {
        return null;
    }
}

export function saveExpensesFilterOrder(
    userId: number,
    variant: ExpensesFiltersVariant,
    order: readonly ExpensesFilterSlotId[],
): void {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(
            expensesFilterOrderStorageKey(userId, variant),
            JSON.stringify([...order]),
        );
    }
    catch {
        // Reordering must remain usable even when browser storage is unavailable.
    }
}
