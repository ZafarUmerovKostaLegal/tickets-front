

export type TimeBriefColumnId =
    | 'employee'
    | 'datetime'
    | 'task'
    | 'note'
    | 'billHours'
    | 'sum'
    | 'actions';

export const TIME_BRIEF_COLUMN_LABELS: Record<TimeBriefColumnId, string> = {
    employee: 'Сотрудник',
    datetime: 'Дата и время записи',
    task: 'Задача',
    note: 'Заметка, описание',
    billHours: 'Оплач. часы',
    sum: 'Сумма',
    actions: 'Действия',
};


export const TIME_BRIEF_COLUMN_ORDER_DEFAULT: TimeBriefColumnId[] = [
    'employee',
    'datetime',
    'task',
    'note',
    'billHours',
    'sum',
    'actions',
];

export const TIME_BRIEF_COLUMNS_STORAGE_KEY = 'tt-rp-time-brief-columns-v1';

function isBriefColumnId(x: unknown): x is TimeBriefColumnId {
    return (
        x === 'employee'
        || x === 'datetime'
        || x === 'task'
        || x === 'note'
        || x === 'billHours'
        || x === 'sum'
        || x === 'actions'
    );
}


export function sanitizeBriefColumnIds(raw: unknown[]): TimeBriefColumnId[] {
    const seen = new Set<TimeBriefColumnId>();
    const out: TimeBriefColumnId[] = [];
    for (const x of raw) {
        if (!isBriefColumnId(x) || seen.has(x))
            continue;
        seen.add(x);
        out.push(x);
    }
    return out;
}

export function loadBriefColumnsFromStorage(includeActionsColumn: boolean): TimeBriefColumnId[] | null {
    try {
        const s = localStorage.getItem(TIME_BRIEF_COLUMNS_STORAGE_KEY);
        if (!s)
            return null;
        const parsed = JSON.parse(s) as unknown;
        if (!Array.isArray(parsed))
            return null;
        let ids = sanitizeBriefColumnIds(parsed);
        if (!includeActionsColumn)
            ids = ids.filter((id) => id !== 'actions');
        const rest = TIME_BRIEF_COLUMN_ORDER_DEFAULT.filter(
            (id) => includeActionsColumn || id !== 'actions',
        ).filter((id) => !ids.includes(id));
        ids = [...ids, ...rest];
        if (ids.length === 0)
            return TIME_BRIEF_COLUMN_ORDER_DEFAULT.filter((id) => includeActionsColumn || id !== 'actions');
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
