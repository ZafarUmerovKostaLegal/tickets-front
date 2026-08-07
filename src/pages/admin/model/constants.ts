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
export const TT_POSITIONS_FALLBACK = [
    'Business Development Manager',
    'Contracts and BD Assistant',
    'Accountant',
    'Office Manager',
    'Associate',
    'Contracts Manager',
    'Counsel',
    'Junior Associate',
    'Partner',
    'Senior Associate',
    'Trainee',
] as const;
export type TTPosition = string;
export type PositionMeta = {
    color: string;
    bg: string;
    border: string;
};
export const TT_POSITION_META: Record<string, PositionMeta> = {
    'Associate': { color: '#4f46e5', bg: 'rgba(37,99,235,0.1)', border: 'rgba(37,99,235,0.25)' },
    'Contracts Manager': { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.25)' },
    'Counsel': { color: '#0891b2', bg: 'rgba(8,145,178,0.1)', border: 'rgba(8,145,178,0.25)' },
    'Junior Associate': { color: '#475569', bg: 'rgba(71,85,105,0.1)', border: 'rgba(71,85,105,0.25)' },
    'Partner': { color: '#b45309', bg: 'rgba(180,83,9,0.1)', border: 'rgba(180,83,9,0.25)' },
    'Senior Associate': { color: '#0f766e', bg: 'rgba(15,118,110,0.1)', border: 'rgba(15,118,110,0.25)' },
    'Trainee': { color: '#7e22ce', bg: 'rgba(126,34,206,0.1)', border: 'rgba(126,34,206,0.28)' },
};
const POSITION_FALLBACK_PALETTE: PositionMeta[] = [
    { color: '#4f46e5', bg: 'rgba(79,70,229,0.1)', border: 'rgba(79,70,229,0.25)' },
    { color: '#0891b2', bg: 'rgba(8,145,178,0.1)', border: 'rgba(8,145,178,0.25)' },
    { color: '#16a34a', bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.25)' },
    { color: '#b45309', bg: 'rgba(180,83,9,0.1)', border: 'rgba(180,83,9,0.25)' },
    { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.25)' },
    { color: '#0f766e', bg: 'rgba(15,118,110,0.1)', border: 'rgba(15,118,110,0.25)' },
    { color: '#db2777', bg: 'rgba(219,39,119,0.1)', border: 'rgba(219,39,119,0.25)' },
];
const POSITION_NEUTRAL_META: PositionMeta = {
    color: '#64748b',
    bg: 'rgba(100,116,139,0.1)',
    border: 'rgba(100,116,139,0.25)',
};

export function getPositionMeta(pos: string | null | undefined): PositionMeta {
    const key = pos?.trim();
    if (!key)
        return POSITION_NEUTRAL_META;
    if (key in TT_POSITION_META)
        return TT_POSITION_META[key];
    const lower = key.toLowerCase();
    for (const [name, meta] of Object.entries(TT_POSITION_META)) {
        if (name.toLowerCase() === lower)
            return meta;
    }
    let h = 0;
    for (let i = 0; i < key.length; i++)
        h = key.charCodeAt(i) + ((h << 5) - h);
    return POSITION_FALLBACK_PALETTE[Math.abs(h) % POSITION_FALLBACK_PALETTE.length];
}

export function positionCatalogIncludes(catalog: readonly string[], pos: string | null | undefined): boolean {
    const key = pos?.trim().toLowerCase();
    if (!key)
        return false;
    return catalog.some((p) => p.trim().toLowerCase() === key);
}
