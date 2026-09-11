import { describe, expect, it } from 'vitest';
import { isStubAuthUserEmail, pickUserDisplayLabel, firstNonStubUserText, resolveTimeUserDisplayName } from './userDisplayLabel';

describe('pickUserDisplayLabel', () => {
    it('prefers a real display name', () => {
        expect(pickUserDisplayLabel('Sayyora Rasuleva', 'auth-user-39@tt.local', 39)).toBe('Sayyora Rasuleva');
    });

    it('skips stub emails used as names', () => {
        expect(pickUserDisplayLabel('auth-user-39@tt.local', 'sayyora@firm.uz', 39)).toBe('sayyora@firm.uz');
    });

    it('does not use stub email as a label', () => {
        expect(pickUserDisplayLabel(null, 'auth-user-39@tt.local', 39)).toBe('Пользователь 39');
        expect(pickUserDisplayLabel(null, 'auth-user-39@tt.local', 39, 'User {id}')).toBe('User 39');
    });

    it('skips stub catalog fields when a later real name exists', () => {
        expect(pickUserDisplayLabel(
            firstNonStubUserText('auth-user-39@tt.local', 'Sayyora Rasuleva'),
            firstNonStubUserText('auth-user-39@tt.local', 'sayyora@firm.uz'),
            39,
        )).toBe('Sayyora Rasuleva');
    });

    it('detects stub emails', () => {
        expect(isStubAuthUserEmail('auth-user-39@tt.local')).toBe(true);
        expect(isStubAuthUserEmail('kseniya@firm.uz')).toBe(false);
    });
});

describe('resolveTimeUserDisplayName', () => {
    const stub = { display_name: null, email: 'auth-user-39@tt.local' };

    it('uses a hydrated catalog name over a stub workload member', () => {
        expect(resolveTimeUserDisplayName({
            catalog: { display_name: 'Sayyora Rasuleva', email: 'sayyora@firm.uz' },
            member: stub,
        }, 39)).toBe('Sayyora Rasuleva');
    });

    it('falls back to colleagues when the TT catalog is only a stub', () => {
        expect(resolveTimeUserDisplayName({
            catalog: stub,
            colleague: { display_name: 'Sayyora Rasuleva', email: 'sayyora@firm.uz' },
            member: stub,
        }, 39)).toBe('Sayyora Rasuleva');
    });

    it('does not show the stub email when nothing is hydrated', () => {
        expect(resolveTimeUserDisplayName({ catalog: stub, member: stub }, 39, 'User {id}')).toBe('User 39');
    });
});
