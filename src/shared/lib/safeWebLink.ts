export function sanitizeHttpsWebUrl(raw: string | null | undefined): string | null {
    const t = raw?.trim() ?? '';
    if (!t)
        return null;
    let u: URL;
    try {
        u = new URL(t);
    }
    catch {
        return null;
    }
    if (u.protocol !== 'https:')
        return null;
    if (u.username !== '' || u.password !== '')
        return null;
    return u.toString();
}
