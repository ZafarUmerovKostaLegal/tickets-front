const MICROSOFT_OAUTH_HOSTS = new Set([
    'login.microsoftonline.com',
    'login.microsoft.com',
    'login.live.com',
    'login.windows.net',
    'device.login.microsoftonline.com',
]);
function isAllowedMicrosoftOAuthHost(hostname: string): boolean {
    const h = hostname.toLowerCase();
    if (MICROSOFT_OAUTH_HOSTS.has(h))
        return true;
    if (h.endsWith('.b2clogin.com'))
        return true;
    return h.endsWith('.microsoftonline.com');
}
export function assertHttpsMicrosoftOAuthRedirectUrl(raw: string): URL {
    const t = raw.trim();
    let u: URL;
    try {
        u = new URL(t);
    }
    catch {
        throw new Error('Некорректный URL перенаправления');
    }
    if (u.protocol !== 'https:') {
        throw new Error('Разрешены только HTTPS-редиректы для входа Microsoft');
    }
    if (u.username !== '' || u.password !== '') {
        throw new Error('URL перенаправления не должен содержать учётные данные');
    }
    if (!isAllowedMicrosoftOAuthHost(u.hostname)) {
        throw new Error('Недопустимый хост для перенаправления OAuth');
    }
    return u;
}
