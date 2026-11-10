import { describe, expect, it } from 'vitest';
import { isScheduleOnlyAccount, isScheduleOnlyAllowedPath, scheduleOnlyLandingPath } from './scheduleOnlyAccount';

describe('scheduleOnlyAccount', () => {
    it('узнаёт почту без учёта регистра', () => {
        expect(isScheduleOnlyAccount({ email: 'Znurmatov@kostalegal.com' })).toBe(true);
        expect(isScheduleOnlyAccount({ email: 'other@kostalegal.com' })).toBe(false);
    });

    it('пускает учёт времени и файловый менеджер', () => {
        expect(isScheduleOnlyAllowedPath('/time-tracking')).toBe(true);
        expect(isScheduleOnlyAllowedPath('/time-tracking?tab=expenses')).toBe(true);
        expect(isScheduleOnlyAllowedPath('/files')).toBe(true);
        expect(isScheduleOnlyAllowedPath('/files/explorer')).toBe(true);
        expect(isScheduleOnlyAllowedPath('/home')).toBe(false);
        expect(isScheduleOnlyAllowedPath('/expenses')).toBe(false);
        expect(isScheduleOnlyAllowedPath('/time-tracking/invoices/new')).toBe(false);
        expect(scheduleOnlyLandingPath()).toBe('/time-tracking?tab=timesheet');
    });
});
