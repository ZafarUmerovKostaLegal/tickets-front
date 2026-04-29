const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;
function normalizeBaseUrl(value: string): string {
    const s = value.replace(/\/+$/, '');
    if (s.endsWith('/api/v1'))
        return s.slice(0, -'/api/v1'.length);
    return s;
}
export function getApiBaseUrl(): string {
    if (typeof rawBaseUrl !== 'string' || !rawBaseUrl)
        return '';
    return normalizeBaseUrl(rawBaseUrl);
}
function getBrowserOrigin(): string {
    if (typeof window === 'undefined')
        return '';
    return `${window.location.protocol}//${window.location.host}`;
}
function authPath(suffix: 'azure/login' | 'azure/logout'): string {
    return `/api/v1/auth/${suffix}`;
}
export function getAzureLoginUrl(): string {
    const base = getApiBaseUrl();
    if (base)
        return `${base}/api/v1/auth/azure/login`;
    return authPath('azure/login');
}
export function getAzureLogoutUrl(): string {
    const base = getApiBaseUrl();
    if (base)
        return `${base}/api/v1/auth/azure/logout`;
    return authPath('azure/logout');
}
function getWsUrl(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    const base = getApiBaseUrl();
    if (base) {
        const wsProtocol = base.startsWith('https') ? 'wss' : 'ws';
        const host = base.replace(/^https?:\/\//, '');
        return `${wsProtocol}://${host}${p}`;
    }
    const origin = getBrowserOrigin();
    if (!origin)
        return '';
    const wsProtocol = origin.startsWith('https') ? 'wss' : 'ws';
    const host = origin.replace(/^https?:\/\//, '');
    return `${wsProtocol}://${host}${p}`;
}
export function getTicketsWsUrl(): string {
    return getWsUrl('/api/v1/tickets/ws/tickets');
}
export function getNotificationsWsUrl(): string {
    return getWsUrl('/api/v1/notifications/ws');
}
export function getAttendanceApiBase(): string {
    const v = import.meta.env.VITE_ATTENDANCE_API_BASE;
    if (typeof v !== 'string' || !v.trim())
        return '';
    return v.trim().replace(/\/+$/, '');
}
export const AUTH_ERROR_AUTH_FAILED = 'auth_failed';
export function useSessionCookieOnly(): boolean {
    const v = import.meta.env.VITE_USE_SESSION_COOKIE;
    if (typeof v === 'string' && v.toLowerCase() === 'false')
        return false;
    return true;
}
