import { describe, expect, it } from 'vitest';
import { entryBaseDurationSeconds, entryHoursForTotals } from './timesheetLiveTimer';

describe('timesheetLiveTimer', () => {
    const entry = {
        id: 'e1',
        hours: 1,
        durationSeconds: 3600,
    };

    it('entryHoursForTotals без таймера — базовые часы', () => {
        expect(entryHoursForTotals(entry, null, 0)).toBe(1);
    });

    it('entryHoursForTotals с активным таймером добавляет live секунды', () => {
        const running = { entryId: 'e1', startedAt: Date.now() - 30_000 };
        expect(entryHoursForTotals(entry, running, 30)).toBeCloseTo(1 + 30 / 3600, 5);
    });

    it('entryBaseDurationSeconds использует durationSeconds', () => {
        expect(entryBaseDurationSeconds({ hours: 0, durationSeconds: 90 })).toBe(90);
    });
});
