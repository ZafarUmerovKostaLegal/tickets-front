import { describe, expect, it } from 'vitest';
import {
    buildTimesheetVirtualItems,
    pickTimesheetVirtualStrategy,
    TIMESHEET_VIRTUAL_MIN_ITEMS,
} from './timesheetVirtualTypes';

describe('timesheetVirtualTypes', () => {
    const entry = (id: string, date: string) => ({
        id,
        date,
        project: 'P',
        client: 'C',
        task: 'T',
        notes: '',
        hours: 1,
        billable: true,
        color: '#000',
    });

    it('buildTimesheetVirtualItems создаёт header, rows и footer', () => {
        const today = new Date(2026, 5, 5);
        const items = buildTimesheetVirtualItems([
            { date: today, key: '2026-06-05', rows: [entry('1', '2026-06-05')] },
        ], {
            showHeaders: true,
            viewMode: 'day',
            today,
            isSubjectDayReportingBlocked: () => false,
            entryHoursForTotals: () => 1,
        });
        expect(items.map((i) => i.kind)).toEqual(['header', 'row', 'footer']);
    });

    it('в недельном режиме с короткими днями использует day-block', () => {
        const today = new Date(2026, 5, 5);
        const dayGroups = Array.from({ length: 7 }, (_, i) => ({
            date: new Date(2026, 5, i + 1),
            key: `2026-06-0${i + 1}`,
            rows: Array.from({ length: 5 }, (_, j) => entry(`${i}-${j}`, `2026-06-0${i + 1}`)),
        }));
        const strategy = pickTimesheetVirtualStrategy(dayGroups, { viewMode: 'week' });
        expect(strategy).toBe('day-blocks');
        const items = buildTimesheetVirtualItems(dayGroups, {
            showHeaders: true,
            viewMode: 'week',
            today,
            isSubjectDayReportingBlocked: () => false,
            entryHoursForTotals: () => 1,
        });
        expect(items.every((i) => i.kind === 'day-block')).toBe(true);
        expect(items).toHaveLength(7);
    });

    it('порог виртуализации табеля — 24 элемента', () => {
        expect(TIMESHEET_VIRTUAL_MIN_ITEMS).toBe(24);
    });
});
