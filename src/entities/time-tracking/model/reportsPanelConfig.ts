export type ReportTypeV2 = 'time' | 'expenses' | 'confirmed-expenses' | 'uninvoiced' | 'project-budget';

export type TimeGroup = 'clients' | 'projects';

export type ExpenseGroup = 'clients' | 'projects' | 'categories' | 'team';
export type GroupByV2 = TimeGroup | ExpenseGroup;
export type PeriodGranularity = 'week' | 'month' | 'quarter' | 'year';

export const REPORT_TYPES: {
    id: ReportTypeV2;
    label: string;
}[] = [
    { id: 'time', label: 'Время' },
    { id: 'expenses', label: 'Расходы' },
    { id: 'confirmed-expenses', label: 'Подтвержденные расходы' },
    { id: 'uninvoiced', label: 'Не выставлено' },
    { id: 'project-budget', label: 'Бюджет проектов' },
];

export const GROUPS_FOR_TYPE: Record<ReportTypeV2, {
    id: GroupByV2;
    label: string;
}[] | null> = {
    time: [
        { id: 'projects', label: 'Проекты' },
        { id: 'clients', label: 'Клиенты' },
    ],
    expenses: [
        { id: 'projects', label: 'Проекты' },
        { id: 'clients', label: 'Клиенты' },
    ],
    'confirmed-expenses': [
        { id: 'projects', label: 'Проекты' },
        { id: 'clients', label: 'Клиенты' },
    ],
    uninvoiced: null,
    'project-budget': null,
};

export const DEFAULT_GROUP: Record<ReportTypeV2, GroupByV2 | null> = {
    time: 'projects',
    expenses: 'projects',
    'confirmed-expenses': 'projects',
    uninvoiced: null,
    'project-budget': null,
};

export const PERIOD_OPTIONS: {
    id: PeriodGranularity;
    label: string;
}[] = [
    { id: 'week', label: 'Неделя' },
    { id: 'month', label: 'Месяц' },
    { id: 'quarter', label: 'Квартал' },
    { id: 'year', label: 'Год' },
];


export const PER_PAGE = 100;
export const REPORTS_PREFS_STORAGE_KEY = 'tt-reports-preferences-v1';

export type ReportsPrefsStored = {
    v: 1;
    reportType: ReportTypeV2;
    groupBy: GroupByV2;
    periodGranularity: PeriodGranularity;
    periodAnchorIso: string;
    selectedUserIds: number[];
    includeFixed: boolean;
    customRange?: boolean;
    rangeDateFrom?: string;
    rangeDateTo?: string;
};

export function isReportTypeV2(x: unknown): x is ReportTypeV2 {
    return x === 'time' || x === 'expenses' || x === 'confirmed-expenses' || x === 'uninvoiced' || x === 'project-budget';
}

export function isExpenseLikeReportType(rt: ReportTypeV2): rt is 'expenses' | 'confirmed-expenses' {
    return rt === 'expenses' || rt === 'confirmed-expenses';
}

export function isPeriodGranularity(x: unknown): x is PeriodGranularity {
    return x === 'week' || x === 'month' || x === 'quarter' || x === 'year';
}

export function coerceGroupByForType(rt: ReportTypeV2, gb: unknown): GroupByV2 {
    const opts = GROUPS_FOR_TYPE[rt];
    if (!opts?.length)
        return DEFAULT_GROUP[rt] ?? 'projects';
    const allowed = new Set(opts.map((o) => o.id));
    if (typeof gb === 'string' && allowed.has(gb as GroupByV2))
        return gb as GroupByV2;
    const def = DEFAULT_GROUP[rt];
    if (def && allowed.has(def))
        return def;
    return opts[0].id;
}
