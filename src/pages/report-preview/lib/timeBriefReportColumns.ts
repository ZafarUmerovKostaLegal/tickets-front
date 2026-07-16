
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

const BRIEF_PREFIX_COLUMNS: TimeBriefColumnId[] = ['employee', 'recordDate', 'recordTime', 'task', 'note'];
const BRIEF_TRAILING_COLUMNS: TimeBriefColumnId[] = ['workHours', 'billHours', 'sum', 'actions'];

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

function normalizeBriefTrailingColumns(ids: TimeBriefColumnId[], includeActionsColumn: boolean): TimeBriefColumnId[] {
    const trailingPool = includeActionsColumn
        ? BRIEF_TRAILING_COLUMNS
        : BRIEF_TRAILING_COLUMNS.filter((id) => id !== 'actions');
    const prefix = ids.filter((id) => BRIEF_PREFIX_COLUMNS.includes(id));
    let trailing = trailingPool.filter((id) => ids.includes(id));
    if (!trailing.includes('workHours') && trailing.some((id) => id === 'billHours' || id === 'sum')) {
        const bhIdx = trailing.indexOf('billHours');
        if (bhIdx >= 0)
            trailing.splice(bhIdx, 0, 'workHours');
        else
            trailing.unshift('workHours');
    }
    trailing = trailingPool.filter((id) => trailing.includes(id));
    return [...prefix, ...trailing];
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
        const rest = TIME_BRIEF_COLUMN_ORDER_DEFAULT.filter(
            (id) => includeActionsColumn || id !== 'actions',
        ).filter((id) => !ids.includes(id));
        ids = normalizeBriefTrailingColumns([...ids, ...rest], includeActionsColumn);
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
    return normalizeBriefTrailingColumns(next, includeActionsColumn);
}
