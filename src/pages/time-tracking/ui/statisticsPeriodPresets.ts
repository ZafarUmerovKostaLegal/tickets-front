import { periodToDates, reportsYtdRange } from '@entities/time-tracking/lib/reportsPeriodRange';

export type StatisticsPeriodPresetId =
    | 'month'
    | 'prev_month'
    | 'quarter'
    | 'ytd'
    | 'last_30'
    | 'custom';

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

function formatYmd(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function statisticsPeriodPresetRange(
    id: Exclude<StatisticsPeriodPresetId, 'custom'>,
    reference = new Date(),
): { dateFrom: string; dateTo: string } {
    const today = new Date(reference);
    if (id === 'month') {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { dateFrom: formatYmd(start), dateTo: formatYmd(today) };
    }
    if (id === 'prev_month') {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        return { dateFrom: formatYmd(start), dateTo: formatYmd(end) };
    }
    if (id === 'quarter')
        return periodToDates(today, 'quarter');
    if (id === 'ytd')
        return reportsYtdRange(today);
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { dateFrom: formatYmd(from), dateTo: formatYmd(today) };
}

export function detectStatisticsPeriodPreset(
    dateFrom: string,
    dateTo: string,
    reference = new Date(),
): StatisticsPeriodPresetId {
    const presets: Exclude<StatisticsPeriodPresetId, 'custom'>[] = [
        'month',
        'prev_month',
        'quarter',
        'ytd',
        'last_30',
    ];
    for (const id of presets) {
        const range = statisticsPeriodPresetRange(id, reference);
        if (range.dateFrom === dateFrom && range.dateTo === dateTo)
            return id;
    }
    return 'custom';
}

export const STATISTICS_PERIOD_PRESET_IDS: Exclude<StatisticsPeriodPresetId, 'custom'>[] = [
    'month',
    'prev_month',
    'quarter',
    'ytd',
    'last_30',
];
