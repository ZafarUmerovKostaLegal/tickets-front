import { getApiBaseUrl, getAzureLoginUrl, useSessionCookieOnly } from '@shared/config';
import { getAccessToken, removeAccessToken, setSessionCookieHint } from '@shared/lib';
import { clearClientSessionSecrets } from '@shared/lib/authSessionCleanup';
import { assertSafeRelativeApiPath, assertTrustedApiFetchPathOrUrl, } from '@shared/lib/trustedApiFetchUrl';
type RequestInitAuth = RequestInit & {
    skipAuth?: boolean;
    skipAuthRedirectOn401?: boolean;
};
export async function apiFetch(path: string, init: RequestInitAuth = {}): Promise<Response> {
    assertTrustedApiFetchPathOrUrl(path);
    const baseUrl = getApiBaseUrl();
    const rel = path.startsWith('http')
        ? path
        : path.startsWith('/')
            ? path
            : `/${path}`;
    if (!path.startsWith('http')) {
        assertSafeRelativeApiPath(rel);
    }
    const url = path.startsWith('http') ? path : `${baseUrl}${rel}`;
    const { skipAuth = false, skipAuthRedirectOn401 = false, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (!skipAuth) {
        const token = getAccessToken();
        if (token)
            headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(url, {
        ...rest,
        headers,
        credentials: 'include',
    });
    if (response.status === 401 && !skipAuth) {
        removeAccessToken();

        if (!skipAuthRedirectOn401) {
            setSessionCookieHint(false);
            clearClientSessionSecrets();
            if (!useSessionCookieOnly()) {
                window.location.href = getAzureLoginUrl() || '/api/v1/auth/azure/login';
            }
        }
        return response;
    }
    return response;
}
export function getApiUrl(path: string): string {
    assertTrustedApiFetchPathOrUrl(path);
    const baseUrl = getApiBaseUrl();
    const rel = path.startsWith('http')
        ? path
        : path.startsWith('/')
            ? path
            : `/${path}`;
    if (!path.startsWith('http')) {
        assertSafeRelativeApiPath(rel);
    }
    return path.startsWith('http') ? path : `${baseUrl}${rel}`;
}
function encodeMediaPathSegments(mediaPath: string): string {
    const path = mediaPath.startsWith('/') ? mediaPath.slice(1) : mediaPath;
    return path
        .split('/')
        .filter((s) => s.length > 0 && s !== '.' && s !== '..')
        .map((seg) => encodeURIComponent(seg))
        .join('/');
}
export async function fetchMediaBlob(mediaPath: string): Promise<string> {
    const safePath = encodeMediaPathSegments(mediaPath);
    const res = await apiFetch(`/api/v1/media/${safePath}`);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = `Не удалось загрузить файл (${res.status})`;
        try {
            const j = JSON.parse(text) as {
                detail?: string;
            };
            if (typeof j.detail === 'string')
                msg = j.detail;
        }
        catch {
            if (text && text.length < 400)
                msg = text;
        }
        throw new Error(msg);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}
const MEDIA_API_PREFIX = '/api/v1/media/';
const DESKTOP_BG_STORAGE_PREFIX = '/desktop_backgrounds/';
function isBareMediaStorageKey(normalized: string): boolean {
    if (!normalized)
        return false;
    if (normalized.includes('..') || normalized.includes('?') || normalized.includes('#'))
        return false;
    if (normalized.startsWith('api/'))
        return false;
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(normalized))
        return true;
    if (/^[a-f0-9]{32}$/i.test(normalized))
        return true;
    if (!/\.(jpe?g|png|gif|webp)$/i.test(normalized))
        return false;
    return /^[a-zA-Z0-9/_-]+$/.test(normalized);
}
export function getMediaPathFromMediaUrl(url: string): string | null {
    const t = url.trim();
    if (!t)
        return null;
    if (/^https?:\/\//i.test(t)) {
        try {
            const u = new URL(t);
            const p = u.pathname;
            const idx = p.indexOf(MEDIA_API_PREFIX);
            if (idx >= 0)
                return p.slice(idx + MEDIA_API_PREFIX.length);
            if (p.startsWith(DESKTOP_BG_STORAGE_PREFIX))
                return p.slice(1);
        }
        catch {
            return null;
        }
        return null;
    }
    const path = t.startsWith('/') ? t : `/${t}`;
    const idx = path.indexOf(MEDIA_API_PREFIX);
    if (idx >= 0)
        return path.slice(idx + MEDIA_API_PREFIX.length);
    if (path.startsWith(DESKTOP_BG_STORAGE_PREFIX))
        return path.slice(1);
    const normalized = path.replace(/^\/+/, '');
    if (normalized.startsWith('api/v1/media/'))
        return normalized.slice('api/v1/media/'.length);
    if (normalized.startsWith('desktop_backgrounds/'))
        return normalized;
    if (isBareMediaStorageKey(normalized))
        return normalized;
    return null;
}
async function blobUrlFromApiFetch(pathOrAbsoluteSameOrigin: string): Promise<string> {
    const res = await apiFetch(pathOrAbsoluteSameOrigin);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = `Не удалось загрузить файл (${res.status})`;
        try {
            const j = JSON.parse(text) as {
                detail?: string;
            };
            if (typeof j.detail === 'string')
                msg = j.detail;
        }
        catch {
            if (text && text.length < 400)
                msg = text;
        }
        throw new Error(msg);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}
export async function createAuthenticatedMediaBlobUrl(urlOrPath: string): Promise<string> {
    const mediaPath = getMediaPathFromMediaUrl(urlOrPath);
    if (mediaPath) {
        return fetchMediaBlob(mediaPath);
    }
    const p = urlOrPath.trim();
    if (!p) {
        throw new Error('Пустой URL');
    }
    if (/^https?:\/\//i.test(p)) {
        assertTrustedApiFetchPathOrUrl(p);
        let pathname = '';
        try {
            pathname = new URL(p).pathname;
        }
        catch {
            throw new Error('Некорректный URL');
        }
        if (!pathname.startsWith('/api/v1/')) {
            throw new Error('Поддерживаются только URL API приложения (/api/v1/…)');
        }
        return blobUrlFromApiFetch(p);
    }
    const path = p.startsWith('/') ? p : `/${p}`;
    assertSafeRelativeApiPath(path);
    if (!path.startsWith('/api/v1/')) {
        throw new Error('Поддерживаются только пути /api/v1/…');
    }
    return blobUrlFromApiFetch(path);
}
