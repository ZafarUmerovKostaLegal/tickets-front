const LEGAL_HUB_LOGINS: ReadonlySet<string> = new Set([
    'zumerov',
]);

function emailLocalPart(email: string | null | undefined): string {
    const normalized = (email ?? '').trim().toLowerCase();
    if (!normalized)
        return '';
    const at = normalized.indexOf('@');
    return at === -1 ? normalized : normalized.slice(0, at);
}

export function canAccessLegalHub(user: { email?: string | null } | null | undefined): boolean {
    const login = emailLocalPart(user?.email);
    return login.length > 0 && LEGAL_HUB_LOGINS.has(login);
}
