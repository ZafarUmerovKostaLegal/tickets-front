import type { Messages } from './messages';

type NestedKeyOf<T, Prefix extends string = ''> = T extends string
    ? Prefix
    : T extends Record<string, unknown>
        ? {
              [K in keyof T & string]: NestedKeyOf<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>;
          }[keyof T & string]
        : never;

export type TranslationKey = NestedKeyOf<Messages>;

function resolvePath(messages: Messages, path: string): string | undefined {
    const parts = path.split('.');
    let cur: unknown = messages;
    for (const part of parts) {
        if (cur == null || typeof cur !== 'object')
            return undefined;
        cur = (cur as Record<string, unknown>)[part];
    }
    return typeof cur === 'string' ? cur : undefined;
}

export function createTranslator(messages: Messages) {
    return function t(key: TranslationKey): string {
        return resolvePath(messages, key) ?? key;
    };
}
