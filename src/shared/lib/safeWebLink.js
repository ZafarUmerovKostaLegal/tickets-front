export function sanitizeHttpsWebUrl(raw) {
    const t = raw?.trim() ?? '';
    if (!t)
        return null;
    let u;
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
