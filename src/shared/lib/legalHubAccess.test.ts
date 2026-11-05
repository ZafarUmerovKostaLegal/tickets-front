import { describe, expect, it } from 'vitest';
import { canAccessLegalHub } from './legalHubAccess';

describe('canAccessLegalHub', () => {
    it('открыт всем сотрудникам и закрыт для переговорных', () => {
        expect(canAccessLegalHub({ email: 'lawyer@kostalegal.com' })).toBe(true);
        expect(canAccessLegalHub({ email: 'Zumerov@kostalegal.com' })).toBe(true);
        expect(canAccessLegalHub({ email: 'smallmeetingroom@kostalegal.com' })).toBe(false);
        expect(canAccessLegalHub({ email: 'largemeetingroom@kostalegal.com' })).toBe(false);
        expect(canAccessLegalHub({ email: '' })).toBe(false);
        expect(canAccessLegalHub(null)).toBe(false);
    });
});
