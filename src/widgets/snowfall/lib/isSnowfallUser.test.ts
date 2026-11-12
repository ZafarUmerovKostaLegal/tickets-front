import { describe, expect, it } from 'vitest';
import { isSnowfallUser } from './isSnowfallUser';

describe('isSnowfallUser', () => {
    it('allows only zumerov', () => {
        expect(isSnowfallUser({ email: 'zumerov@kostalegal.com' })).toBe(true);
        expect(isSnowfallUser({ email: 'Zumerov@KostaLegal.com' })).toBe(true);
        expect(isSnowfallUser({ email: 'aakhmadjonov@kostalegal.com' })).toBe(false);
        expect(isSnowfallUser({ email: 'info@kostalegal.com' })).toBe(false);
        expect(isSnowfallUser(null)).toBe(false);
    });
});
