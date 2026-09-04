import type { CorrDirection, CorrDocStatus, CorrDocType } from './types';

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
    { key: 'done', label: 'Завершено' },
] as const;

export type CorrTableTabKey = (typeof CORR_TABLE_TABS)[number]['key'];

export const CORR_TYPE_BADGE: Record<CorrDocType, { label: string; className: string }> = {
    letter: { label: 'Письмо', className: 'corr__badge corr__badge--type-letter' },
    contract: { label: 'Договор', className: 'corr__badge corr__badge--type-contract' },
    note: { label: 'Записка', className: 'corr__badge corr__badge--type-note' },
};

export const CORR_DOC_TYPE_OPTIONS: { key: CorrDocType; label: string }[] = [
    { key: 'letter', label: CORR_TYPE_BADGE.letter.label },
    { key: 'note', label: CORR_TYPE_BADGE.note.label },
    { key: 'contract', label: CORR_TYPE_BADGE.contract.label },
];

export const CORR_STATUS_BADGE: Record<CorrDocStatus, { label: string; className: string }> = {
    draft: { label: 'Черновик', className: 'corr__badge corr__badge--status-progress' },
    pending_review: { label: 'На проверке', className: 'corr__badge corr__badge--status-approval' },
    rejected: { label: 'Отклонено', className: 'corr__badge corr__badge--status-done' },
    new: { label: 'В работе', className: 'corr__badge corr__badge--status-progress' },
    progress: { label: 'В работе', className: 'corr__badge corr__badge--status-progress' },
    approval: { label: 'На согласовании', className: 'corr__badge corr__badge--status-approval' },
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
