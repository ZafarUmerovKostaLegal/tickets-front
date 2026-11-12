/** Soft snowfall overlay is enabled only for this login (email local-part). */
const SNOWFALL_LOGINS: ReadonlySet<string> = new Set([
    'zumerov',
]);

function emailLocalPart(email: string | null | undefined): string {
    const normalized = (email ?? '').trim().toLowerCase();
    if (!normalized)
        return '';
    const at = normalized.indexOf('@');
    return at === -1 ? normalized : normalized.slice(0, at);
}

export function isSnowfallUser(user: { email?: string | null } | null | undefined): boolean {
    const login = emailLocalPart(user?.email);
    return login.length > 0 && SNOWFALL_LOGINS.has(login);
}
