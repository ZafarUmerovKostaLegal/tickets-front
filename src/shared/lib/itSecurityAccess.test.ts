import { describe, expect, it } from 'vitest';
import { canAccessItSecurity } from './itSecurityAccess';

describe('canAccessItSecurity', () => {
    it('разрешает только aakhmadjonov и zumerov', () => {
        expect(canAccessItSecurity({ email: 'aakhmadjonov@kostalegal.com' })).toBe(true);
        expect(canAccessItSecurity({ email: 'Zumerov@kostalegal.com' })).toBe(true);
        expect(canAccessItSecurity({ email: 'other@kostalegal.com' })).toBe(false);
        expect(canAccessItSecurity({ email: 'aakhmadjonov.extra@kostalegal.com' })).toBe(false);
        expect(canAccessItSecurity(null)).toBe(false);
    });
});
