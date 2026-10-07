import { enMessages } from './en';
import { ruMessages } from './ru';
const catalogs = {
    ru: { ...ruMessages },
    en: { ...enMessages },
};
const ttLoaded = new Set();
const ttInflight = new Map();
const todoLoaded = new Set();
const todoInflight = new Map();
const contactsLoaded = new Set();
const contactsInflight = new Map();
const catalogListeners = new Set();
export function getMessages(locale) {
    return catalogs[locale];
}
export function subscribeMessageCatalog(listener) {
    catalogListeners.add(listener);
    return () => {
        catalogListeners.delete(listener);
    };
}
function notifyMessageCatalog() {
    for (const listener of catalogListeners)
        listener();
}
export function isTimeTrackingPageMessagesReady(locale) {
    return ttLoaded.has(locale);
}
export async function ensureTimeTrackingPageMessages(locale) {
    if (ttLoaded.has(locale))
        return;
    let inflight = ttInflight.get(locale);
    if (!inflight) {
        inflight = (async () => {
            const msgs = locale === 'en'
                ? (await import('../timeTrackingPageMessages.en')).timeTrackingPageMessagesEn
                : (await import('../timeTrackingPageMessages')).timeTrackingPageMessages;
            catalogs[locale] = {
                ...catalogs[locale],
                timeTrackingPage: msgs,
            };
            ttLoaded.add(locale);
            ttInflight.delete(locale);
            notifyMessageCatalog();
        })().catch((err) => {
            ttInflight.delete(locale);
            throw err;
        });
        ttInflight.set(locale, inflight);
    }
    await inflight;
}
export function isTodoPageMessagesReady(locale) {
    return todoLoaded.has(locale);
}
export async function ensureTodoPageMessages(locale) {
    if (todoLoaded.has(locale))
        return;
    let inflight = todoInflight.get(locale);
    if (!inflight) {
        inflight = (async () => {
            const msgs = locale === 'en'
                ? (await import('../todoPageMessages.en')).todoPageMessagesEn
                : (await import('../todoPageMessages')).todoPageMessages;
            catalogs[locale] = {
                ...catalogs[locale],
                todoPage: msgs,
            };
            todoLoaded.add(locale);
            todoInflight.delete(locale);
            notifyMessageCatalog();
        })().catch((err) => {
            todoInflight.delete(locale);
            throw err;
        });
        todoInflight.set(locale, inflight);
    }
    await inflight;
}
export function isContactsPageMessagesReady(locale) {
    return contactsLoaded.has(locale);
}
export async function ensureContactsPageMessages(locale) {
    if (contactsLoaded.has(locale))
        return;
    let inflight = contactsInflight.get(locale);
    if (!inflight) {
        inflight = (async () => {
            const msgs = locale === 'en'
                ? (await import('../contactsPageMessages.en')).contactsPageMessagesEn
                : (await import('../contactsPageMessages')).contactsPageMessages;
            catalogs[locale] = {
                ...catalogs[locale],
                contactsPage: msgs,
            };
            contactsLoaded.add(locale);
            contactsInflight.delete(locale);
            notifyMessageCatalog();
        })().catch((err) => {
            contactsInflight.delete(locale);
            throw err;
        });
        contactsInflight.set(locale, inflight);
    }
    await inflight;
}
