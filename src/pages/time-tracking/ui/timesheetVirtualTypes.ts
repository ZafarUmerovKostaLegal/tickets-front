import type { TimesheetEntryRowData } from './TimesheetEntryRow';

export type TimesheetDayGroupData = {
    date: Date;
    key: string;
    rows: TimesheetEntryRowData[];
};

export type TimesheetVirtualItem =
    | {
        kind: 'header';
        id: string;
        group: TimesheetDayGroupData;
        isToday: boolean;
        addBlocked: boolean;
    }
    | {
        kind: 'row';
        id: string;
        entry: TimesheetEntryRowData;
        groupKey: string;
    }
    | {
        kind: 'footer';
        id: string;
        group: TimesheetDayGroupData;
        dayTotal: number;
        addBlocked: boolean;
    }
    | {
        kind: 'day-block';
        id: string;
        group: TimesheetDayGroupData;
        isToday: boolean;
        addBlocked: boolean;
        dayTotal: number;
    };

export type BuildTimesheetVirtualItemsOptions = {
    showHeaders: boolean;
    viewMode: 'day' | 'week' | 'calendar';
    today: Date;
    isSubjectDayReportingBlocked: (dateYmd: string) => boolean;
    entryHoursForTotals: (entry: TimesheetEntryRowData) => number;
};

export const TIMESHEET_DAY_BLOCK_MAX_ROWS = 25;
export const TIMESHEET_DAY_BLOCK_MIN_DAYS = 4;

export function pickTimesheetVirtualStrategy(
    dayGroups: TimesheetDayGroupData[],
    options: Pick<BuildTimesheetVirtualItemsOptions, 'viewMode'>,
): 'flat-rows' | 'day-blocks' {
    const totalRows = dayGroups.reduce((sum, group) => sum + group.rows.length, 0);
    if (totalRows < TIMESHEET_VIRTUAL_MIN_ITEMS)
        return 'flat-rows';
    const maxRowsPerDay = dayGroups.reduce((max, group) => Math.max(max, group.rows.length), 0);
    if (options.viewMode === 'day' || maxRowsPerDay > TIMESHEET_DAY_BLOCK_MAX_ROWS)
        return 'flat-rows';
    if (options.viewMode === 'week' && dayGroups.length >= TIMESHEET_DAY_BLOCK_MIN_DAYS)
        return 'day-blocks';
    return 'flat-rows';
}

export function buildTimesheetVirtualItems(
    dayGroups: TimesheetDayGroupData[],
    options: BuildTimesheetVirtualItemsOptions,
): TimesheetVirtualItem[] {
    const strategy = pickTimesheetVirtualStrategy(dayGroups, options);
    if (strategy === 'day-blocks') {
        return dayGroups.map((group) => {
            const isToday = isSameDayLocal(group.date, options.today);
            const addBlocked = options.isSubjectDayReportingBlocked(group.key);
            const dayTotal = group.rows.reduce((sum, entry) => sum + options.entryHoursForTotals(entry), 0);
            return {
                kind: 'day-block' as const,
                id: `day:${group.key}`,
                group,
                isToday,
                addBlocked,
                dayTotal,
            };
        });
    }

    const items: TimesheetVirtualItem[] = [];
    for (const group of dayGroups) {
        const isToday = isSameDayLocal(group.date, options.today);
        const addBlocked = options.isSubjectDayReportingBlocked(group.key);
        if (options.showHeaders) {
            items.push({
                kind: 'header',
                id: `hdr:${group.key}`,
                group,
                isToday,
                addBlocked,
            });
        }
        for (const entry of group.rows) {
            items.push({
                kind: 'row',
                id: `row:${entry.id}`,
                entry,
                groupKey: group.key,
            });
        }
        const dayTotal = group.rows.reduce((sum, entry) => sum + options.entryHoursForTotals(entry), 0);
        items.push({
            kind: 'footer',
            id: `ftr:${group.key}`,
            group,
            dayTotal,
            addBlocked,
        });
    }
    return items;
}

function isSameDayLocal(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

export const TIMESHEET_VIRTUAL_MIN_ITEMS = 24;
export const TIMESHEET_VIRTUAL_ESTIMATE = {
    header: 52,
    row: 76,
    footer: 58,
    dayBlockBase: 110,
    dayBlockRow: 76,
} as const;

export function estimateTimesheetVirtualItemSize(item: TimesheetVirtualItem): number {
    if (item.kind === 'header')
        return TIMESHEET_VIRTUAL_ESTIMATE.header;
    if (item.kind === 'footer')
        return TIMESHEET_VIRTUAL_ESTIMATE.footer;
    if (item.kind === 'day-block') {
        const notesExtra = item.group.rows.some((row) => row.notes?.trim()) ? 18 : 0;
        return TIMESHEET_VIRTUAL_ESTIMATE.dayBlockBase
            + item.group.rows.length * (TIMESHEET_VIRTUAL_ESTIMATE.dayBlockRow + notesExtra / Math.max(item.group.rows.length, 1));
    }
    const notes = item.entry.notes?.trim();
    return notes ? TIMESHEET_VIRTUAL_ESTIMATE.row + 18 : TIMESHEET_VIRTUAL_ESTIMATE.row;
}
