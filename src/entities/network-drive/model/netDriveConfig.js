export const DEFAULT_GRPDATA_UNC = '\\\\192.168.230.1\\grpdata';
const SETTINGS_KEY = 'tickets:netDrive:settings';
const PASSWORD_SESSION_KEY = 'tickets:netDrive:pwdSession';
const ACCESS_DRAFT_KEY = 'tickets:netDrive:accessDraft';
function safeParseJson(raw) {
    if (raw == null || raw === '')
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function loadNetDriveSettings() {
    if (typeof localStorage === 'undefined')
        return null;
    const p = safeParseJson(localStorage.getItem(SETTINGS_KEY));
    if (p == null || typeof p.unc !== 'string' || typeof p.username !== 'string')
        return null;
    return p;
}
export function saveNetDriveSettings(unc, username) {
    if (typeof localStorage === 'undefined')
        return;
    const s = {
        unc: unc.trim() || DEFAULT_GRPDATA_UNC,
        username: username.trim(),
        updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
export function clearNetDriveSettings() {
    if (typeof localStorage === 'undefined')
        return;
    localStorage.removeItem(SETTINGS_KEY);
}
export function loadSessionPassword() {
    if (typeof sessionStorage === 'undefined')
        return null;
    return sessionStorage.getItem(PASSWORD_SESSION_KEY);
}
export function saveSessionPassword(value) {
    if (typeof sessionStorage === 'undefined')
        return;
    if (value === '')
        sessionStorage.removeItem(PASSWORD_SESSION_KEY);
    else
        sessionStorage.setItem(PASSWORD_SESSION_KEY, value);
}
export function clearSessionPassword() {
    if (typeof sessionStorage === 'undefined')
        return;
    sessionStorage.removeItem(PASSWORD_SESSION_KEY);
}
function isAccessRuleDraft(x) {
    if (x == null || typeof x !== 'object')
        return false;
    const o = x;
    const rights = o.rights;
    return typeof o.id === 'string' &&
        typeof o.path === 'string' &&
        typeof o.principal === 'string' &&
        (rights === 'Read' || rights === 'Change' || rights === 'Full');
}
export function loadAccessDrafts() {
    if (typeof localStorage === 'undefined')
        return [];
    const arr = safeParseJson(localStorage.getItem(ACCESS_DRAFT_KEY));
    if (arr == null || !Array.isArray(arr))
        return [];
    return arr.filter(isAccessRuleDraft);
}
export function saveAccessDrafts(rules) {
    if (typeof localStorage === 'undefined')
        return;
    localStorage.setItem(ACCESS_DRAFT_KEY, JSON.stringify(rules));
}
export function isNetDriveConfigReady(settings) {
    return settings != null && settings.unc.trim() !== '' && settings.username.trim() !== '';
}
