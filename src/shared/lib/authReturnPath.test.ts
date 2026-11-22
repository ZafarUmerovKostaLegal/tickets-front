import { describe, expect, it } from 'vitest';
import { isSafeReturnPath } from './authReturnPath';

describe('return path after sign-in', () => {
    it('keeps in-app paths', () => {
        expect(isSafeReturnPath('/files?view=mailRules')).toBe(true);
        expect(isSafeReturnPath('/time-tracking/invoices/new')).toBe(true);
    });

    it('never leads off the Hub', () => {
        for (const value of ['//evil.com', '/\\evil.com', '/\\/evil.com', '\\\\evil.com', 'https://evil.com', '/\tevil', '/auth/callback'])
            expect(isSafeReturnPath(value)).toBe(false);
    });
});
