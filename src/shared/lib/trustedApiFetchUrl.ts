import { getApiBaseUrl } from '@shared/config';
export function getTrustedApiOrigin(): string {
    if (typeof window === 'undefined')
        return '';
    const base = getApiBaseUrl().trim();
    if (base) {
        try {
            return new URL(base).origin;
        }
        catch {
            return window.location.origin;
        }
    }
    return window.location.origin;
}
function isAbsoluteHttpUrl(s: string): boolean {
    return /^https?:\/\//i.test(s.trim());
}
export function assertTrustedApiFetchPathOrUrl(pathOrUrl: string): void {
    const t = pathOrUrl.trim();
    if (!t || !isAbsoluteHttpUrl(t))
        return;
    let u: URL;
    try {
        u = new URL(t);
    }
    catch {
        throw new Error('Некорректный URL запроса');
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new Error('Недопустимая схема URL');
    }
    if (u.username !== '' || u.password !== '') {
        throw new Error('Учётные данные в URL запрещены');
    }
    const trusted = getTrustedApiOrigin();
    if (!trusted || u.origin !== trusted) {
        throw new Error('Запросы на внешние адреса запрещены');
    }
}
export function assertSafeRelativeApiPath(path: string): void {
    const p = path.trim();
    if (!p.startsWith('/')) {
        throw new Error('Ожидался путь API, начинающийся с /');
    }
    if (p.includes('..')) {
        throw new Error('Недопустимый путь API');
    }
}
