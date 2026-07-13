import { test as base, expect } from '@playwright/test';
import { loginAs, clearAuth } from './auth';
import { installApiMocks, installFailingMe } from './api-mock';
import { USERS, type UserPersona } from './users';

type Fixtures = {
    loginAs: (persona: UserPersona) => Promise<void>;
    clearAuth: () => Promise<void>;
    installApiMocks: typeof installApiMocks;
    installFailingMe: typeof installFailingMe;
    users: typeof USERS;
};

export const test = base.extend<Fixtures>({
    loginAs: async ({ page }, use) => {
        await use(async (persona) => loginAs(page, persona));
    },
    clearAuth: async ({ page }, use) => {
        await use(async () => clearAuth(page));
    },
    installApiMocks: async ({ page: _page }, use) => {
        await use(installApiMocks);
    },
    installFailingMe: async ({ page: _page }, use) => {
        await use(installFailingMe);
    },
    users: async ({}, use) => {
        await use(USERS);
    },
});

export { expect };
