import { getApiBaseUrl, getAzureLoginUrl, upgradeUrlToPageSecurity, isSessionCookieOnly } from '@shared/config';
import { getAccessToken, removeAccessToken, setSessionCookieHint } from '@shared/lib/auth';
import { clearClientSessionSecrets } from '@shared/lib/authSessionCleanup';
import { assertSafeRelativeApiPath, assertTrustedApiFetchPathOrUrl, } from '@shared/lib/trustedApiFetchUrl';
type RequestInitAuth = RequestInit & {
    skipAuth?: boolean;
    skipAuthRedirectOn401?: boolean;
};

type InflightGet = {
    promise: Promise<Response>;
};

const inflightGets = new Map<string, InflightGet>();
let mutationGeneration = 0;

function normalizedMethod(init: RequestInit): string {
    return (init.method ?? 'GET').trim().toUpperCase();
}

function getDedupeKey(url: string, init: RequestInit, headers: Headers): string {
    const headerPairs = [...headers.entries()]
        .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify({
        generation: mutationGeneration,
        url,
        headers: headerPairs,
        cache: init.cache ?? '',
        integrity: init.integrity ?? '',
        keepalive: init.keepalive ?? false,
        mode: init.mode ?? '',
        redirect: init.redirect ?? '',
        referrer: init.referrer ?? '',
        referrerPolicy: init.referrerPolicy ?? '',
    });
}

function fetchWithGetDedupe(url: string, init: RequestInit, headers: Headers): Promise<Response> {
    const method = normalizedMethod(init);
    if (method !== 'GET' || init.signal != null || init.body != null) {
        if (method !== 'GET' && method !== 'HEAD')
            mutationGeneration += 1;
        return fetch(url, { ...init, headers, credentials: 'include' });
    }

    const key = getDedupeKey(url, init, headers);
    let entry = inflightGets.get(key);
    if (!entry) {
        const promise = fetch(url, { ...init, headers, credentials: 'include' });
        entry = { promise };
        inflightGets.set(key, entry);
        const current = entry;
        void promise.then(
            (response) => {
                if (inflightGets.get(key) === current)
                    inflightGets.delete(key);
                // Every consumer receives a clone. Cancel the unused source
                // branch after all promise continuations had a chance to clone.
                queueMicrotask(() => {
                    void response.body?.cancel().catch(() => { });
                });
            },
            () => {
                if (inflightGets.get(key) === current)
                    inflightGets.delete(key);
            },
        );
    }
    return entry.promise.then((response) => response.clone());
}

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
    const url = upgradeUrlToPageSecurity(path.startsWith('http') ? path : `${baseUrl}${rel}`);
    const { skipAuth = false, skipAuthRedirectOn401 = false, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (rest.body instanceof FormData)
        headers.delete('Content-Type');
    if (!skipAuth) {
        const token = getAccessToken();
        if (token)
            headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetchWithGetDedupe(url, rest, headers);
    if (response.status === 401 && !skipAuth) {
        removeAccessToken();

        if (!skipAuthRedirectOn401) {
            setSessionCookieHint(false);
            clearClientSessionSecrets();
            if (!isSessionCookieOnly()) {
                window.location.href = getAzureLoginUrl() || '/api/v1/auth/azure/login';
            }
        }
        return response;
    }
    return response;
}

export async function fetchGatewayLive(): Promise<boolean> {
    const res = await apiFetch('/live', { skipAuth: true, skipAuthRedirectOn401: true });
    return res.ok;
}

export async function fetchTodosHealthThroughGateway(): Promise<boolean> {
    const res = await apiFetch('/health/todos', { skipAuth: true, skipAuthRedirectOn401: true });
    return res.ok;
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
    return upgradeUrlToPageSecurity(path.startsWith('http') ? path : `${baseUrl}${rel}`);
}

function normalizePublicMediaPath(pathOrUrl: string): string {
    const raw = pathOrUrl.trim();
    if (/^https?:\/\//i.test(raw))
        return raw;
    if (raw.startsWith('/api/v1/media/'))
        return raw;
    const stripped = raw.replace(/^\/+/, '');
    if (stripped.startsWith('api/v1/media/'))
        return `/${stripped}`;
    if (stripped.startsWith('todo_board_backgrounds/') || stripped.startsWith('desktop_backgrounds/'))
        return `/api/v1/media/${stripped}`;
    if (raw.startsWith('/desktop_backgrounds/'))
        return `/api/v1/media${raw}`;
    return raw.startsWith('/') ? raw : `/${raw}`;
}

export function getPublicGatewayAssetUrl(pathOrUrl: string | null | undefined): string | null {
    const raw = (pathOrUrl ?? '').trim();
    if (!raw)
        return null;
    let pathname: string;
    if (/^https?:\/\//i.test(raw)) {
        try {
            const p = new URL(raw).pathname;
            const idx = p.indexOf('/api/v1/media/');
            pathname = idx >= 0 ? p.slice(idx) : normalizePublicMediaPath(p);
        }
        catch {
            return null;
        }
    }
    else {
        pathname = normalizePublicMediaPath(raw);
    }
    assertSafeRelativeApiPath(pathname);
    if (typeof window !== 'undefined' && pathname.startsWith('/api/v1/media/'))
        return pathname;
    const base = getApiBaseUrl().replace(/\/+$/, '');
    if (!base)
        return pathname;
    const full = upgradeUrlToPageSecurity(`${base}${pathname}`);
    assertTrustedApiFetchPathOrUrl(full);
    return full;
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
    if (normalized.startsWith('desktop_backgrounds/') || normalized.startsWith('todo_board_backgrounds/'))
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
