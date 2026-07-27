import type { AppLocale } from '../types';
import type { ContactsPageMessages } from '../contactsPageMessages';
import type { TimeTrackingPageMessages } from '../timeTrackingPageMessages';
import type { TodoPageMessages } from '../todoPageMessages';
import { enMessages } from './en';
import { ruMessages, type Messages } from './ru';

const catalogs: Record<AppLocale, Messages> = {
    ru: { ...ruMessages },
    en: { ...enMessages },
};

const ttLoaded = new Set<AppLocale>();
const ttInflight = new Map<AppLocale, Promise<void>>();
const todoLoaded = new Set<AppLocale>();
const todoInflight = new Map<AppLocale, Promise<void>>();
const contactsLoaded = new Set<AppLocale>();
const contactsInflight = new Map<AppLocale, Promise<void>>();
const catalogListeners = new Set<() => void>();

export function getMessages(locale: AppLocale): Messages {
    return catalogs[locale];
}

export function subscribeMessageCatalog(listener: () => void): () => void {
    catalogListeners.add(listener);
    return () => {
        catalogListeners.delete(listener);
    };
}

function notifyMessageCatalog(): void {
    for (const listener of catalogListeners)
        listener();
}

export function isTimeTrackingPageMessagesReady(locale: AppLocale): boolean {
    return ttLoaded.has(locale);
}

export async function ensureTimeTrackingPageMessages(locale: AppLocale): Promise<void> {
    if (ttLoaded.has(locale))
        return;
    let inflight = ttInflight.get(locale);
    if (!inflight) {
        inflight = (async () => {
            const msgs: TimeTrackingPageMessages = locale === 'en'
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

export function isTodoPageMessagesReady(locale: AppLocale): boolean {
    return todoLoaded.has(locale);
}

export async function ensureTodoPageMessages(locale: AppLocale): Promise<void> {
    if (todoLoaded.has(locale))
        return;
    let inflight = todoInflight.get(locale);
    if (!inflight) {
        inflight = (async () => {
            const msgs: TodoPageMessages = locale === 'en'
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

export function isContactsPageMessagesReady(locale: AppLocale): boolean {
    return contactsLoaded.has(locale);
}

export async function ensureContactsPageMessages(locale: AppLocale): Promise<void> {
    if (contactsLoaded.has(locale))
        return;
    let inflight = contactsInflight.get(locale);
    if (!inflight) {
        inflight = (async () => {
            const msgs: ContactsPageMessages = locale === 'en'
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

export type { Messages };
