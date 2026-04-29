export const KNOWN_ROLES = [
    'Администратор',
    'Сотрудник',
    'IT отдел',
    'Партнер',
    'Офис менеджер',
] as const;
export type KnownRole = (typeof KNOWN_ROLES)[number];
export const ROLE_META: Record<KnownRole, {
    color: string;
    bg: string;
    border: string;
}> = {
    'Администратор': { color: '#4f46e5', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)' },
    'Сотрудник': { color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },
    'IT отдел': { color: '#0891b2', bg: 'rgba(8,145,178,0.1)', border: 'rgba(8,145,178,0.25)' },
    'Партнер': { color: '#d97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.25)' },
    'Офис менеджер': { color: '#16a34a', bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.25)' },
};
export type TTRole = 'user' | 'manager' | null;
export const TT_ROLE_OPTIONS: {
    value: TTRole;
    label: string;
    color: string;
    bg: string;
    border: string;
}[] = [
    { value: null, label: 'Не назначена', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
    { value: 'user', label: 'Сотрудник', color: '#0891b2', bg: 'rgba(8,145,178,0.1)', border: 'rgba(8,145,178,0.25)' },
    { value: 'manager', label: 'Менеджер', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.25)' },
];
export const TT_POSITIONS = [
    'Associate',
    'Contracts Manager',
    'Counsel',
    'Junior Associate',
    'Partner',
    'Senior Associate',
    'Trainee',
] as const;
export type TTPosition = (typeof TT_POSITIONS)[number];
export const TT_POSITION_META: Record<TTPosition, {
    color: string;
    bg: string;
    border: string;
}> = {
    'Associate': { color: '#4f46e5', bg: 'rgba(37,99,235,0.1)', border: 'rgba(37,99,235,0.25)' },
    'Contracts Manager': { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.25)' },
    'Counsel': { color: '#0891b2', bg: 'rgba(8,145,178,0.1)', border: 'rgba(8,145,178,0.25)' },
    'Junior Associate': { color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },
    'Partner': { color: '#b45309', bg: 'rgba(180,83,9,0.1)', border: 'rgba(180,83,9,0.25)' },
    'Senior Associate': { color: '#0f766e', bg: 'rgba(15,118,110,0.1)', border: 'rgba(15,118,110,0.25)' },
    'Trainee': { color: '#9333ea', bg: 'rgba(147,51,234,0.1)', border: 'rgba(147,51,234,0.25)' },
};
