export type AppLocale = 'ru' | 'en';

export const APP_LOCALES: readonly AppLocale[] = ['ru', 'en'] as const;

export const DEFAULT_LOCALE: AppLocale = 'ru';
