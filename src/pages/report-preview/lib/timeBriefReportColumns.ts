
export type TimeBriefColumnId =
    | 'employee'
    | 'recordDate'
    | 'recordTime'
    | 'task'
    | 'note'
    | 'workHours'
    | 'billHours'
    | 'sum'
    | 'actions';

export const TIME_BRIEF_COLUMN_LABELS: Record<TimeBriefColumnId, string> = {
    employee: 'Сотрудник',
    recordDate: 'Дата записи',
    recordTime: 'Время записи',
    task: 'Задача',
    note: 'Описание',
    workHours: 'Отработано',
    billHours: 'Оплач. часы',
    sum: 'Сумма',
    actions: 'Действия',
};


export const TIME_BRIEF_COLUMN_ORDER_DEFAULT: TimeBriefColumnId[] = [
    'employee',
    'recordDate',
    'recordTime',
    'task',
    'note',
    'workHours',
    'billHours',
    'sum',
    'actions',
];

export const TIME_BRIEF_COLUMNS_STORAGE_KEY = 'tt-rp-time-brief-columns-v2';
export const TIME_BRIEF_COLUMNS_REMEMBER_KEY = 'tt-rp-time-brief-columns-remember-v1';

function isBriefColumnId(x: unknown): x is TimeBriefColumnId {
    return (
        x === 'employee'
        || x === 'recordDate'
        || x === 'recordTime'
        || x === 'task'
        || x === 'note'
        || x === 'workHours'
        || x === 'billHours'
        || x === 'sum'
        || x === 'actions'
    );
}

/** Expand legacy combined `datetime` column into date + time. */
function expandLegacyBriefColumnIds(raw: unknown[]): unknown[] {
    const out: unknown[] = [];
    for (const x of raw) {
        if (x === 'datetime') {
            out.push('recordDate', 'recordTime');
            continue;
        }
        out.push(x);
    }
    return out;
}

export function sanitizeBriefColumnIds(raw: unknown[]): TimeBriefColumnId[] {
    const seen = new Set<TimeBriefColumnId>();
    const out: TimeBriefColumnId[] = [];
    for (const x of expandLegacyBriefColumnIds(raw)) {
        if (!isBriefColumnId(x) || seen.has(x))
            continue;
        seen.add(x);
        out.push(x);
    }
    return out;
}

export function loadBriefColumnsRemember(): boolean {
    try {
        const v = localStorage.getItem(TIME_BRIEF_COLUMNS_REMEMBER_KEY);
        if (v === null)
            return true;
        return v === '1';
    }
    catch {
        return true;
    }
}

export function saveBriefColumnsRemember(enabled: boolean): void {
    try {
        localStorage.setItem(TIME_BRIEF_COLUMNS_REMEMBER_KEY, enabled ? '1' : '0');
    }
    catch {
        /* ignore quota / private mode */
    }
}

export function loadBriefColumnsFromStorage(includeActionsColumn: boolean): TimeBriefColumnId[] | null {
    try {
        const s = localStorage.getItem(TIME_BRIEF_COLUMNS_STORAGE_KEY)
            ?? localStorage.getItem('tt-rp-time-brief-columns-v1');
        if (!s)
            return null;
        const parsed = JSON.parse(s) as unknown;
        if (!Array.isArray(parsed))
            return null;
        let ids = sanitizeBriefColumnIds(parsed);
        if (!includeActionsColumn)
            ids = ids.filter((id) => id !== 'actions');
        if (ids.length === 0)
            return null;
        return ids;
    }
    catch {
        return null;
    }
}

export function saveBriefColumnsToStorage(ids: TimeBriefColumnId[]): void {
    try {
        localStorage.setItem(TIME_BRIEF_COLUMNS_STORAGE_KEY, JSON.stringify(ids));
    }
    catch {
        /* ignore */
    }
}


export function normalizeBriefColumnsForUi(
    ids: TimeBriefColumnId[],
    includeActionsColumn: boolean,
): TimeBriefColumnId[] {
    let next = sanitizeBriefColumnIds(ids);
    if (!includeActionsColumn)
        next = next.filter((id) => id !== 'actions');
    const fallback = TIME_BRIEF_COLUMN_ORDER_DEFAULT.filter((id) => includeActionsColumn || id !== 'actions');
    if (next.length === 0)
        return fallback;
    return next;
}

const BRIEF_FLEX_COLUMN_PRIORITY: TimeBriefColumnId[] = ['note', 'task', 'employee', 'recordDate'];

/** Column that should absorb leftover table width among currently visible ones. */
export function resolveBriefFlexColumnId(visibleIds: readonly TimeBriefColumnId[]): TimeBriefColumnId | null {
    for (const id of BRIEF_FLEX_COLUMN_PRIORITY) {
        if (visibleIds.includes(id))
            return id;
    }
    return visibleIds[0] ?? null;
}

/** Fixed widths for brief `<colgroup>`; `undefined` = flex (takes remaining space). */
export function briefColumnColWidth(
    colId: TimeBriefColumnId,
    flexColId: TimeBriefColumnId | null = 'note',
): string | undefined {
    if (flexColId != null && colId === flexColId)
        return undefined;
    switch (colId) {
        case 'employee':
            return '12rem';
        case 'recordDate':
            return '9rem';
        case 'recordTime':
            return '7.25rem';
        case 'task':
            return '13rem';
        case 'note':
            return '16rem';
        case 'workHours':
        case 'billHours':
            return '6.75rem';
        case 'sum':
            return '9.5rem';
        case 'actions':
            return '8.75rem';
        default:
            return undefined;
    }
}
