export type PracticeTone = 'warn' | 'ok' | 'danger';

export type PracticeCard = {
    id: string;
    code: string;
    name: string;
    projects: number;
    size: string;
    lead: string;
    badge: string;
    tone: PracticeTone;
};

export type AccessTone = 'green' | 'amber' | 'blue';

export type RecentFile = {
    id: string;
    name: string;
    path: string;
    practiceId: string;
    kind: 'doc' | 'pdf' | 'sheet' | 'zip';
    changed: string;
    changedBy: string;
    access: string;
    accessTone: AccessTone;
};

export type AttentionItem = {
    id: string;
    title: string;
    detail: string;
    tone: 'warn' | 'danger' | 'muted';
};

export type AccessRequest = {
    id: string;
    user: string;
    initials: string;
    file: string;
    reason: string;
};

export const ALL_PRACTICES: PracticeCard[] = [
    { id: 'corp', code: 'CORP', name: 'Corporate / M&A', projects: 18, size: '420 ГБ', lead: 'Рустам А.', badge: '1 конфликт', tone: 'warn' },
    { id: 'disp', code: 'DISP', name: 'Dispute Resolution', projects: 14, size: '310 ГБ', lead: 'Нодира Ю.', badge: '2 барьера', tone: 'warn' },
    { id: 'tax', code: 'TAX', name: 'Tax', projects: 11, size: '180 ГБ', lead: 'Азиза К.', badge: 'Норма', tone: 'ok' },
    { id: 'bnk', code: 'BNK', name: 'Banking & Finance', projects: 9, size: '255 ГБ', lead: 'Жавлон М.', badge: 'Норма', tone: 'ok' },
    { id: 're', code: 'RE', name: 'Real Estate', projects: 10, size: '196 ГБ', lead: 'Саида Т.', badge: '1 просрочен', tone: 'danger' },
];

export const ALL_RECENT: RecentFile[] = [
    { id: '1', name: 'SPA_v12_final.docx', path: 'CORP / Aurora Holdings / Closing', practiceId: 'corp', kind: 'doc', changed: '12 мин назад', changedBy: 'Рустам А.', access: 'Руководитель проекта', accessTone: 'green' },
    { id: '2', name: 'NDA_vendor_pack.pdf', path: 'DISP / Silk Road JV / Discovery', practiceId: 'disp', kind: 'pdf', changed: 'Сегодня, 09:40', changedBy: 'Нодира Ю.', access: 'Наблюдатель', accessTone: 'amber' },
    { id: '3', name: 'Fee_schedule_Q4.xlsx', path: 'TAX / Nomad Soft / Billing', practiceId: 'tax', kind: 'sheet', changed: 'Вчера', changedBy: 'Азиза К.', access: 'Полный контроль', accessTone: 'green' },
    { id: '4', name: 'Facility_agreement.zip', path: 'BNK / Orient Bank / Term sheet', practiceId: 'bnk', kind: 'zip', changed: 'Пн', changedBy: 'Жавлон М.', access: 'Чтение', accessTone: 'blue' },
    { id: '5', name: 'Lease_summary_v3.pdf', path: 'RE / Tashkent Plaza / Due diligence', practiceId: 're', kind: 'pdf', changed: 'Пн', changedBy: 'Саида Т.', access: 'Чтение без выгрузки', accessTone: 'amber' },
    { id: '6', name: 'Board_minutes_Sep.docx', path: 'CORP / Meridian Ops / Governance', practiceId: 'corp', kind: 'doc', changed: 'Вс', changedBy: 'Диана Р.', access: 'Только просмотр', accessTone: 'amber' },
];

export const ATTENTION: AttentionItem[] = [
    { id: 'a1', title: 'Конфликт прав', detail: 'Аура Соколова · CORP / Aurora / Closing', tone: 'warn' },
    { id: 'a2', title: 'Подозрительная активность', detail: 'Азиз Каримов · 214 попыток скачивания за 9 мин', tone: 'danger' },
    { id: 'a3', title: 'Истекает временный доступ', detail: '3 сессии истекают в ближайшие 2 часа', tone: 'muted' },
    { id: 'a4', title: 'Публичная ссылка без пароля', detail: 'DISP / Silk Road JV / Exhibit_C.pdf', tone: 'warn' },
];

export const ACCESS_REQUESTS: AccessRequest[] = [
    { id: 'r1', user: 'Ольга Петрова', initials: 'ОП', file: 'Brandbook_2027.pdf', reason: 'Нужен доступ к финальной версии для клиента' },
    { id: 'r2', user: 'Тимур Хасанов', initials: 'ТХ', file: 'SPA_v12_final.docx', reason: 'Проверка приложений перед закрытием' },
];

/** Until ACL exists, employees see one practice for the UI. */
export function practicesForUser(canManage: boolean): PracticeCard[] {
    if (canManage)
        return ALL_PRACTICES;
    return ALL_PRACTICES.filter((item) => item.id === 'corp');
}

export function recentForUser(canManage: boolean): RecentFile[] {
    if (canManage)
        return ALL_RECENT;
    const ids = new Set(practicesForUser(false).map((item) => item.id));
    return ALL_RECENT.filter((item) => ids.has(item.practiceId));
}
