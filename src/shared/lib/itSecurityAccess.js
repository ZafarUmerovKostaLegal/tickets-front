const IT_SECURITY_LOGINS = new Set([
    'aakhmadjonov',
    'zumerov',
]);
function emailLocalPart(email) {
    const normalized = (email ?? '').trim().toLowerCase();
    if (!normalized)
        return '';
    const at = normalized.indexOf('@');
    return at === -1 ? normalized : normalized.slice(0, at);
}
export function canAccessItSecurity(user) {
    const login = emailLocalPart(user?.email);
    return login.length > 0 && IT_SECURITY_LOGINS.has(login);
}
