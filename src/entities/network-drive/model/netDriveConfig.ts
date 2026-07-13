export const DEFAULT_GRPDATA_UNC = '\\\\192.168.230.1\\grpdata';

const SETTINGS_KEY = 'tickets:netDrive:settings';
const PASSWORD_SESSION_KEY = 'tickets:netDrive:pwdSession';
const ACCESS_DRAFT_KEY = 'tickets:netDrive:accessDraft';

export type NetDriveSettings = {
    unc: string;
    username: string;
    updatedAt: string;
};

export type NetDriveAccessRuleDraft = {
    id: string;
    path: string;
    principal: string;
    rights: 'Read' | 'Change' | 'Full';
};

function safeParseJson<T>(raw: string | null): T | null {
    if (raw == null || raw === '')
        return null;
    try {
        return JSON.parse(raw) as T;
    }
    catch {
        return null;
    }
}

export function loadNetDriveSettings(): NetDriveSettings | null {
    if (typeof localStorage === 'undefined')
        return null;
    const p = safeParseJson<NetDriveSettings>(localStorage.getItem(SETTINGS_KEY));
    if (p == null || typeof p.unc !== 'string' || typeof p.username !== 'string')
        return null;
    return p;
}

export function saveNetDriveSettings(unc: string, username: string): void {
    if (typeof localStorage === 'undefined')
        return;
    const s: NetDriveSettings = {
        unc: unc.trim() || DEFAULT_GRPDATA_UNC,
        username: username.trim(),
        updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function clearNetDriveSettings(): void {
    if (typeof localStorage === 'undefined')
        return;
    localStorage.removeItem(SETTINGS_KEY);
}

export function loadSessionPassword(): string | null {
    if (typeof sessionStorage === 'undefined')
        return null;
    return sessionStorage.getItem(PASSWORD_SESSION_KEY);
}

export function saveSessionPassword(value: string): void {
    if (typeof sessionStorage === 'undefined')
        return;
    if (value === '')
        sessionStorage.removeItem(PASSWORD_SESSION_KEY);
    else
        sessionStorage.setItem(PASSWORD_SESSION_KEY, value);
}

export function clearSessionPassword(): void {
    if (typeof sessionStorage === 'undefined')
        return;
    sessionStorage.removeItem(PASSWORD_SESSION_KEY);
}

function isAccessRuleDraft(x: unknown): x is NetDriveAccessRuleDraft {
    if (x == null || typeof x !== 'object')
        return false;
    const o = x as Record<string, unknown>;
    const rights = o.rights;
    return typeof o.id === 'string' &&
        typeof o.path === 'string' &&
        typeof o.principal === 'string' &&
        (rights === 'Read' || rights === 'Change' || rights === 'Full');
}

export function loadAccessDrafts(): NetDriveAccessRuleDraft[] {
    if (typeof localStorage === 'undefined')
        return [];
    const arr = safeParseJson<unknown[]>(localStorage.getItem(ACCESS_DRAFT_KEY));
    if (arr == null || !Array.isArray(arr))
        return [];
    return arr.filter(isAccessRuleDraft);
}

export function saveAccessDrafts(rules: NetDriveAccessRuleDraft[]): void {
    if (typeof localStorage === 'undefined')
        return;
    localStorage.setItem(ACCESS_DRAFT_KEY, JSON.stringify(rules));
}

export function isNetDriveConfigReady(settings: NetDriveSettings | null): boolean {
    return settings != null && settings.unc.trim() !== '' && settings.username.trim() !== '';
}
