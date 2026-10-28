export const REPORT_TYPES = [
    { id: 'time', label: 'Время' },
    { id: 'expenses', label: 'Расходы' },
    { id: 'uninvoiced', label: 'Не выставлено' },
    { id: 'project-budget', label: 'Бюджет проектов' },
];
export const GROUPS_FOR_TYPE = {
    time: [
        { id: 'projects', label: 'Проекты' },
        { id: 'clients', label: 'Клиенты' },
        { id: 'tasks', label: 'Задачи' },
        { id: 'team', label: 'Команда' },
    ],
    expenses: [
        { id: 'projects', label: 'Проекты' },
        { id: 'clients', label: 'Клиенты' },
        { id: 'categories', label: 'Категории' },
        { id: 'team', label: 'Команда' },
    ],
    uninvoiced: null,
    'project-budget': null,
};
export const DEFAULT_GROUP = {
    time: 'projects',
    expenses: 'projects',
    uninvoiced: null,
    'project-budget': null,
};
export const PERIOD_OPTIONS = [
    { id: 'week', label: 'Неделя' },
    { id: 'month', label: 'Месяц' },
    { id: 'quarter', label: 'Квартал' },
    { id: 'year', label: 'Год' },
    { id: 'all', label: 'За всё время' },
];
export const PER_PAGE = 100;
export const REPORTS_PREFS_STORAGE_KEY = 'tt-reports-preferences-v1';
export function isReportTypeV2(x) {
    return x === 'time' || x === 'expenses' || x === 'uninvoiced' || x === 'project-budget';
}
export function migrateStoredReportType(stored) {
    if (stored === 'confirmed-expenses')
        return 'expenses';
    if (isReportTypeV2(stored))
        return stored;
    return 'time';
}
export function isExpenseLikeReportType(rt) {
    return rt === 'expenses';
}
export function isPeriodGranularity(x) {
    return x === 'week' || x === 'month' || x === 'quarter' || x === 'year' || x === 'all';
}
export function normalizeReportsSection(section) {
    return section === 'monthly-archive' ? 'partner-confirmed' : section;
}
export function isPartnerConfirmedSubview(x) {
    return x === 'list' || x === 'archive';
}
export function isReportsSection(x) {
    return x === 'build'
        || x === 'weekly'
        || x === 'monthly'
        || x === 'partner-confirmed'
        || x === 'monthly-archive'
        || x === 'for-review';
}
export function coerceGroupByForType(rt, gb) {
    const opts = GROUPS_FOR_TYPE[rt];
    if (!opts?.length)
        return DEFAULT_GROUP[rt] ?? 'projects';
    const allowed = new Set(opts.map((o) => o.id));
    if (typeof gb === 'string' && allowed.has(gb))
        return gb;
    const def = DEFAULT_GROUP[rt];
    if (def && allowed.has(def))
        return def;
    return opts[0].id;
}
