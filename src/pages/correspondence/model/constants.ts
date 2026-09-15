import type { CorrDirection, CorrDocStatus, CorrDocType } from './types';
import { CORR_DOC_TYPE_KEYS } from '@entities/correspondence/model/types';

export const CORR_SCAN_MAX_BYTES = 15 * 1024 * 1024;

export const CORR_SCAN_ACCEPT = '*/*';

export const CORR_DIRECTION_TABS: { key: CorrDirection; label: string }[] = [
    { key: 'incoming', label: 'Входящая корреспонденция' },
    { key: 'outgoing', label: 'Исходящая корреспонденция' },
];

export const CORR_SHELL_NAV_TABS: { key: CorrDirection; label: string }[] = [
    { key: 'incoming', label: 'Входящие' },
    { key: 'outgoing', label: 'Исходящие' },
];

export const CORR_TABLE_TABS = [
    { key: 'all', label: 'Все' },
    { key: 'attention', label: 'Нужно посмотреть' },
    { key: 'work', label: 'В работе' },
    { key: 'awaiting_signature', label: 'Ожидает подписи' },
    { key: 'done', label: 'Завершено' },
] as const;

export type CorrTableTabKey = (typeof CORR_TABLE_TABS)[number]['key'];

const TYPE_CLASS = {
    letter: 'corr__badge corr__badge--type-letter',
    legal: 'corr__badge corr__badge--type-legal',
    contract: 'corr__badge corr__badge--type-contract',
    finance: 'corr__badge corr__badge--type-finance',
    other: 'corr__badge corr__badge--type-note',
} as const;

export const CORR_TYPE_BADGE: Record<CorrDocType, { label: string; className: string }> = {
    letter: { label: 'Письмо', className: TYPE_CLASS.letter },
    request: { label: 'Запрос', className: TYPE_CLASS.letter },
    claim: { label: 'Претензия', className: TYPE_CLASS.legal },
    demand: { label: 'Требование', className: TYPE_CLASS.legal },
    notification: { label: 'Уведомление', className: TYPE_CLASS.letter },
    application: { label: 'Заявление', className: TYPE_CLASS.letter },
    complaint: { label: 'Жалоба', className: TYPE_CLASS.legal },
    lawsuit: { label: 'Исковое заявление', className: TYPE_CLASS.legal },
    court: { label: 'Судебный документ', className: TYPE_CLASS.legal },
    enforcement: { label: 'Исполнительный документ', className: TYPE_CLASS.legal },
    contract: { label: 'Договор', className: TYPE_CLASS.contract },
    addendum: { label: 'Дополнительное соглашение', className: TYPE_CLASS.contract },
    act: { label: 'Акт', className: TYPE_CLASS.contract },
    financial: { label: 'Финансовый документ', className: TYPE_CLASS.finance },
    proposal: { label: 'Коммерческое предложение', className: TYPE_CLASS.finance },
    other: { label: 'Иное', className: TYPE_CLASS.other },
    note: { label: 'Записка', className: TYPE_CLASS.other },
};

export const CORR_DOC_TYPE_OPTIONS: { key: CorrDocType; label: string }[] = CORR_DOC_TYPE_KEYS.map((key) => ({
    key,
    label: CORR_TYPE_BADGE[key].label,
}));

export function allCorrDocTypesSelected(selected: readonly CorrDocType[]): boolean {
    return CORR_DOC_TYPE_KEYS.every((key) => selected.includes(key));
}

export function defaultCorrDocTypeFilterState(): Record<(typeof CORR_DOC_TYPE_KEYS)[number], boolean> {
    return Object.fromEntries(CORR_DOC_TYPE_KEYS.map((key) => [key, true])) as Record<
        (typeof CORR_DOC_TYPE_KEYS)[number],
        boolean
    >;
}

export const CORR_STATUS_BADGE: Record<CorrDocStatus, { label: string; className: string }> = {
    draft: { label: 'Черновик', className: 'corr__badge corr__badge--status-progress' },
    pending_review: { label: 'На согласовании', className: 'corr__badge corr__badge--status-approval' },
    rejected: { label: 'Отклонено', className: 'corr__badge corr__badge--status-done' },
    new: { label: 'В работе', className: 'corr__badge corr__badge--status-progress' },
    progress: { label: 'В работе', className: 'corr__badge corr__badge--status-progress' },
    approval: { label: 'На согласовании', className: 'corr__badge corr__badge--status-approval' },
    awaiting_signature: { label: 'Ожидает подписи', className: 'corr__badge corr__badge--status-signature' },
    done: { label: 'Завершено', className: 'corr__badge corr__badge--status-done' },
};

export const CORR_COUNTERPARTY_COLUMN: Record<CorrDirection, string> = {
    incoming: 'Отправитель',
    outgoing: 'Получатель',
};

export const CORR_PAGE_SIZE = 8;

export const CORR_HUB_TILES = [
    {
        key: 'incoming' as const,
        title: 'Входящие',
        label: 'Входящая корреспонденция',
        hint: 'Регистрация с привязкой к партнёру и сканом документа',
        value: '128',
        delta: '+12 сегодня',
        variant: 'blue' as const,
        icon: 'inbox' as const,
    },
    {
        key: 'outgoing' as const,
        title: 'Исходящие',
        label: 'Исходящая корреспонденция',
        hint: 'Реестр и регистрация исходящих писем',
        value: '64',
        delta: '+8 сегодня',
        variant: 'green' as const,
        icon: 'send' as const,
    },
];
