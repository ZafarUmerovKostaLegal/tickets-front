

export type TimeFullColumnId =
    | 'rn'
    | 'employee'
    | 'authUserId'
    | 'employeePosition'
    | 'workDate'
    | 'recordedAt'
    | 'clientId'
    | 'clientName'
    | 'projectId'
    | 'projectName'
    | 'projectCode'
    | 'task'
    | 'note'
    | 'billableHours'
    | 'isBillable'
    | 'taskBillableByDefault'
    | 'isInvoiced'
    | 'isPaid'
    | 'isWeekSubmitted'
    | 'billableRate'
    | 'amountToPay'
    | 'costRate'
    | 'costAmount'
    | 'sourceEntryCount'
    | 'currency'
    | 'externalReferenceUrl'
    | 'invoiceId'
    | 'invoiceNumber';

export const TIME_FULL_COLUMN_LABELS: Record<TimeFullColumnId, string> = {
    rn: '#',
    employee: 'Сотрудник',
    authUserId: 'ID',
    employeePosition: 'Должность',
    workDate: 'workDate',
    recordedAt: 'recordedAt',
    clientId: 'clientId',
    clientName: 'clientName',
    projectId: 'projectId',
    projectName: 'projectName',
    projectCode: 'projectCode',
    task: 'Задача',
    note: 'note / description',
    billableHours: 'Оплач. часы',
    isBillable: 'опл.',
    taskBillableByDefault: 'задача опл.',
    isInvoiced: 'в счёте',
    isPaid: 'счёт опл.',
    isWeekSubmitted: 'нед. сдана',
    billableRate: 'billableRate',
    amountToPay: 'Сумма',
    costRate: 'costRate',
    costAmount: 'costAmount',
    sourceEntryCount: 'sourceEntryCount',
    currency: 'currency',
    externalReferenceUrl: 'externalReferenceUrl',
    invoiceId: 'invoiceId',
    invoiceNumber: 'invoiceNumber',
};

export const TIME_FULL_COLUMN_ORDER_DEFAULT: TimeFullColumnId[] = [
    'rn',
    'employee',
    'authUserId',
    'employeePosition',
    'workDate',
    'recordedAt',
    'clientId',
    'clientName',
    'projectId',
    'projectName',
    'projectCode',
    'task',
    'note',
    'billableHours',
    'isBillable',
    'taskBillableByDefault',
    'isInvoiced',
    'isPaid',
    'isWeekSubmitted',
    'billableRate',
    'amountToPay',
    'costRate',
    'costAmount',
    'sourceEntryCount',
    'currency',
    'externalReferenceUrl',
    'invoiceId',
    'invoiceNumber',
];

export const TIME_FULL_COLUMNS_STORAGE_KEY = 'tt-rp-time-full-columns-v1';

const ALL_IDS_SET = new Set<string>(TIME_FULL_COLUMN_ORDER_DEFAULT);

function isFullColumnId(x: unknown): x is TimeFullColumnId {
    return typeof x === 'string' && ALL_IDS_SET.has(x);
}

export function sanitizeFullColumnIds(raw: unknown[]): TimeFullColumnId[] {
    const seen = new Set<TimeFullColumnId>();
    const out: TimeFullColumnId[] = [];
    for (const x of raw) {
        if (!isFullColumnId(x) || seen.has(x))
            continue;
        seen.add(x);
        out.push(x);
    }
    return out;
}

export function loadFullColumnsFromStorage(): TimeFullColumnId[] | null {
    try {
        const s = localStorage.getItem(TIME_FULL_COLUMNS_STORAGE_KEY);
        if (!s)
            return null;
        const parsed = JSON.parse(s) as unknown;
        if (!Array.isArray(parsed))
            return null;
        let ids = sanitizeFullColumnIds(parsed);
        const rest = TIME_FULL_COLUMN_ORDER_DEFAULT.filter((id) => !ids.includes(id));
        ids = [...ids, ...rest];
        if (ids.length === 0)
            return [...TIME_FULL_COLUMN_ORDER_DEFAULT];
        return ids;
    }
    catch {
        return null;
    }
}

export function saveFullColumnsToStorage(ids: TimeFullColumnId[]): void {
    try {
        localStorage.setItem(TIME_FULL_COLUMNS_STORAGE_KEY, JSON.stringify(ids));
    }
    catch {
        
    }
}

export function normalizeFullColumnsForUi(ids: TimeFullColumnId[]): TimeFullColumnId[] {
    const next = sanitizeFullColumnIds(ids);
    if (next.length === 0)
        return [...TIME_FULL_COLUMN_ORDER_DEFAULT];
    return next;
}
