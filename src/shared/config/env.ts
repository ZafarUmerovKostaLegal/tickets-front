import { isTauriDesktopClient } from './desktopClient';
import { routes } from './routes';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL;

function isKostalegalProductionHost(hostname: string): boolean {
    const h = hostname.toLowerCase();
    return h === 'kostalegal.com' || h.endsWith('.kostalegal.com');
}


export function upgradeUrlToPageSecurity(url: string): string {
    const u = url.trim();
    if (!u)
        return u;

    if (/^https?:\/\//i.test(u)) {
        try {
            const parsed = new URL(u);
            if (isKostalegalProductionHost(parsed.hostname) && parsed.protocol === 'http:') {
                parsed.protocol = 'https:';
                return parsed.href;
            }
        }
        catch (e) {
            e;
        }
    }

    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && /^http:\/\//i.test(u))
        return u.replace(/^http:\/\//i, 'https://');

    return u;
}

function normalizeBaseUrl(value: string): string {
    const s = value.trim().replace(/\/+$/, '');
    const base = s.endsWith('/api/v1') ? s.slice(0, -'/api/v1'.length) : s;
    return upgradeUrlToPageSecurity(base);
}

export function getApiBaseUrl(): string {
    if (typeof rawBaseUrl !== 'string' || !rawBaseUrl.trim())
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
function appendQueryParam(url: string, key: string, value: string): string {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${key}=${encodeURIComponent(value)}`;
}
export function getAuthCallbackUrl(): string {
    if (typeof window === 'undefined')
        return routes.authCallback;
    return `${window.location.origin}${routes.authCallback}`;
}
export function getAzureLoginUrl(): string {
    const base = getApiBaseUrl();
    let url = base
        ? `${base}/api/v1/auth/azure/login`
        : authPath('azure/login');
    if (isTauriDesktopClient() && typeof window !== 'undefined') {
        url = appendQueryParam(url, 'redirect_uri', getAuthCallbackUrl());
    }
    return url;
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
export function getChatWsUrl(): string {
    return getWsUrl('/api/v1/chat/ws');
}
export function getAttendanceApiBase(): string {
    const v = import.meta.env.VITE_ATTENDANCE_API_BASE;
    if (typeof v !== 'string' || !v.trim())
        return '';
    return upgradeUrlToPageSecurity(v.trim().replace(/\/+$/, ''));
}
export const AUTH_ERROR_AUTH_FAILED = 'auth_failed';
export function useSessionCookieOnly(): boolean {
    if (isTauriDesktopClient())
        return false;
    const v = import.meta.env.VITE_USE_SESSION_COOKIE;
    if (typeof v === 'string' && v.toLowerCase() === 'false')
        return false;
    return true;
}
