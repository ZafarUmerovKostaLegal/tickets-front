export type AccessTone = 'green' | 'amber' | 'blue';

export type RecentFile = {
    id: string;
    name: string;
    path: string;
    teamHint: string;
    kind: 'doc' | 'pdf' | 'sheet' | 'zip';
    changed: string;
    changedBy: string;
    access: string;
    accessTone: AccessTone;
};

export const ALL_RECENT: RecentFile[] = [
    { id: '1', name: 'SPA_v12_final.docx', path: 'Aurora Holdings / Closing', teamHint: '', kind: 'doc', changed: '12 мин назад', changedBy: 'Рустам А.', access: 'Руководитель проекта', accessTone: 'green' },
    { id: '2', name: 'NDA_vendor_pack.pdf', path: 'Silk Road JV / Discovery', teamHint: '', kind: 'pdf', changed: 'Сегодня, 09:40', changedBy: 'Нодира Ю.', access: 'Наблюдатель', accessTone: 'amber' },
    { id: '3', name: 'Fee_schedule_Q4.xlsx', path: 'Nomad Soft / Billing', teamHint: '', kind: 'sheet', changed: 'Вчера', changedBy: 'Азиза К.', access: 'Полный контроль', accessTone: 'green' },
    { id: '4', name: 'Facility_agreement.zip', path: 'Orient Bank / Term sheet', teamHint: '', kind: 'zip', changed: 'Пн', changedBy: 'Жавлон М.', access: 'Чтение', accessTone: 'blue' },
    { id: '5', name: 'Lease_summary_v3.pdf', path: 'Tashkent Plaza / Due diligence', teamHint: '', kind: 'pdf', changed: 'Пн', changedBy: 'Саида Т.', access: 'Чтение без выгрузки', accessTone: 'amber' },
    { id: '6', name: 'Board_minutes_Sep.docx', path: 'Meridian Ops / Governance', teamHint: '', kind: 'doc', changed: 'Вс', changedBy: 'Диана Р.', access: 'Только просмотр', accessTone: 'amber' },
];
