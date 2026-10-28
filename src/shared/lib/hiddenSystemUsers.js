const HIDDEN_LOCAL_PARTS = [
    'admin',
    'info',
];
const HIDDEN_EMAILS = new Set([
    'admin@local',
]);
function normalizeEmail(value) {
    if (!value)
        return '';
    return value.trim().toLowerCase();
}
function localPart(email) {
    const at = email.indexOf('@');
    return at >= 0 ? email.slice(0, at) : email;
}
function normalizeDisplayName(value) {
    if (!value)
        return '';
    return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}
const HIDDEN_DISPLAY_NAMES = new Set([
    'главный администратор',
]);
export function isHiddenSystemUserEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized)
        return false;
    if (HIDDEN_EMAILS.has(normalized))
        return true;
    return HIDDEN_LOCAL_PARTS.includes(localPart(normalized));
}
export function isHiddenSystemUser(user) {
    if (isHiddenSystemUserEmail(user.email))
        return true;
    return HIDDEN_DISPLAY_NAMES.has(normalizeDisplayName(user.display_name));
}
