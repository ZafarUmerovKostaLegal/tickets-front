import type { TimeTabId, TimeUserRow, ExpenseRow, ProjectRow } from '@entities/time-tracking/model/types';
export const TABS: {
    id: TimeTabId;
    label: string;
}[] = [
    { id: 'timesheet', label: 'Расписание (Время)' },
    { id: 'expenses', label: 'Расходы' },
    { id: 'reports', label: 'Отчёты' },
    { id: 'invoices', label: 'Счета' },
    { id: 'clients', label: 'Клиенты' },
    { id: 'projects', label: 'Проекты' },
    { id: 'users', label: 'Пользователи' },
    { id: 'settings', label: 'Настройки' },
];
export const EXPENSE_CATEGORY_META: Record<string, {
    color: string;
    bg: string;
}> = {
    'Транспорт': { color: '#4f46e5', bg: 'rgba(37,99,235,0.08)' },
    'Питание': { color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
    'Командировка': { color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
    'Офис': { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
    'ПО и сервисы': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    'Представительские': { color: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
    'Прочее': { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
};
export const EXPENSE_STATUS_META: Record<string, {
    label: string;
    color: string;
    bg: string;
}> = {
    approved: { label: 'Одобрено', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
    pending: { label: 'На проверке', color: '#b45309', bg: 'rgba(180,83,9,0.1)' },
    rejected: { label: 'Отклонено', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
};
export const MOCK_EXPENSES: ExpenseRow[] = [];
export const TIME_TRACKING_ROLES = [
    'Associate',
    'Contracts Manager',
    'Counsel',
    'Junior Associate',
    'Partner',
    'Senior Associate',
    'Trainee',
] as const;
export type TimeTrackingRole = typeof TIME_TRACKING_ROLES[number];
export const TIME_TRACKING_ROLE_META: Record<TimeTrackingRole, {
    color: string;
    bg: string;
}> = {
    'Associate': { color: '#4f46e5', bg: 'rgba(37,99,235,0.08)' },
    'Contracts Manager': { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    'Counsel': { color: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
    'Junior Associate': { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
    'Partner': { color: '#b45309', bg: 'rgba(180,83,9,0.08)' },
    'Senior Associate': { color: '#0f766e', bg: 'rgba(15,118,110,0.08)' },
    'Trainee': { color: '#9333ea', bg: 'rgba(147,51,234,0.08)' },
};
export const MOCK_USERS: TimeUserRow[] = [];
export const DEFAULT_TOTALS = {
    totalHours: 0,
    teamCapacity: 0,
    billableHours: 0,
    nonBillableHours: 0,
} as const;
export const LOADING_DURATION_MS = 2000;
export const MOCK_PROJECTS: ProjectRow[] = [];
