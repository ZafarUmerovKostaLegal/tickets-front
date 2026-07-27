import { describe, expect, it } from 'vitest';
import {
    ensureContactsPageMessages,
    ensureTodoPageMessages,
    getMessages,
    isContactsPageMessagesReady,
    isTodoPageMessagesReady,
} from './index';

describe('lazy page message catalogs', () => {
    it('loads each Todo locale once and makes it available synchronously', async () => {
        await Promise.all([
            ensureTodoPageMessages('ru'),
            ensureTodoPageMessages('ru'),
            ensureTodoPageMessages('en'),
        ]);

        expect(isTodoPageMessagesReady('ru')).toBe(true);
        expect(isTodoPageMessagesReady('en')).toBe(true);
        expect(getMessages('ru').todoPage.back).toBeTruthy();
        expect(getMessages('en').todoPage.back).toBe('Back');
    });

    it('loads Contacts without changing the other locale catalog', async () => {
        await ensureContactsPageMessages('en');

        expect(isContactsPageMessagesReady('en')).toBe(true);
        expect(getMessages('en').contactsPage.title).toBe('Contacts');
        expect(isContactsPageMessagesReady('ru')).toBe(false);
    });
});
