import type { AppLocale } from '../types';
import type { TimeTrackingPageMessages } from '../timeTrackingPageMessages';
import { enMessages } from './en';
import { ruMessages, type Messages } from './ru';

const catalogs: Record<AppLocale, Messages> = {
    ru: { ...ruMessages },
    en: { ...enMessages },
};

const ttLoaded = new Set<AppLocale>();
const ttInflight = new Map<AppLocale, Promise<void>>();
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

export type { Messages };
