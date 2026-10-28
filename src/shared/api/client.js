import { getApiBaseUrl, getAzureLoginUrl, upgradeUrlToPageSecurity, isSessionCookieOnly } from '@shared/config';
import { getAccessToken, removeAccessToken, setSessionCookieHint } from '@shared/lib/auth';
import { clearClientSessionSecrets } from '@shared/lib/authSessionCleanup';
import { assertSafeRelativeApiPath, assertTrustedApiFetchPathOrUrl, } from '@shared/lib/trustedApiFetchUrl';
import { apiRequestMetricNow, recordApiRequestMetric } from './requestMetrics';
const inflightGets = new Map();
const GET_ABORT_GRACE_MS = 75;
const GET_REUSE_WINDOW_MS = 250;
let mutationGeneration = 0;
function normalizedMethod(init) {
    return (init.method ?? 'GET').trim().toUpperCase();
}
function getDedupeKey(url, init, headers) {
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
function abortError(signal) {
    if (signal?.reason !== undefined)
        return signal.reason;
    return new DOMException('The operation was aborted.', 'AbortError');
}
function cancelUnusedResponse(response) {
    queueMicrotask(() => {
        void response.body?.cancel().catch(() => { });
    });
}
function evictGet(key, entry, response) {
    if (inflightGets.get(key) === entry)
        inflightGets.delete(key);
    if (entry.abortTimer !== undefined)
        clearTimeout(entry.abortTimer);
    if (entry.evictionTimer !== undefined)
        clearTimeout(entry.evictionTimer);
    if (response)
        cancelUnusedResponse(response);
}
function scheduleUnusedGetAbort(key, entry) {
    if (entry.consumers !== 0 || entry.settled || entry.abortTimer !== undefined)
        return;
    entry.abortTimer = setTimeout(() => {
        entry.abortTimer = undefined;
        if (entry.consumers !== 0 || entry.settled)
            return;
        if (inflightGets.get(key) === entry)
            inflightGets.delete(key);
        entry.controller.abort();
    }, GET_ABORT_GRACE_MS);
}
function subscribeToGet(key, entry, signal) {
    if (signal?.aborted)
        return Promise.reject(abortError(signal));
    entry.consumers += 1;
    if (entry.abortTimer !== undefined) {
        clearTimeout(entry.abortTimer);
        entry.abortTimer = undefined;
    }
    return new Promise((resolve, reject) => {
        let finished = false;
        const release = () => {
            if (finished)
                return false;
            finished = true;
            signal?.removeEventListener('abort', onAbort);
            entry.consumers = Math.max(0, entry.consumers - 1);
            scheduleUnusedGetAbort(key, entry);
            return true;
        };
        const onAbort = () => {
            if (!release())
                return;
            reject(abortError(signal));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        entry.promise.then((response) => {
            if (!release())
                return;
            try {
                resolve(response.clone());
            }
            catch (error) {
                reject(error);
            }
        }, (error) => {
            if (!release())
                return;
            reject(error);
        });
    });
}
function startGet(url, init, headers, key, reuseWindowMs) {
    const controller = new AbortController();
    const { signal: _callerSignal, ...requestInit } = init;
    const promise = fetch(url, {
        ...requestInit,
        headers,
        credentials: 'include',
        signal: controller.signal,
    });
    const entry = {
        promise,
        controller,
        consumers: 0,
        settled: false,
    };
    inflightGets.set(key, entry);
    void promise.then((response) => {
        entry.settled = true;
        if (!response.ok || reuseWindowMs <= 0) {
            evictGet(key, entry, response);
            return;
        }
        entry.evictionTimer = setTimeout(() => evictGet(key, entry, response), reuseWindowMs);
    }, () => {
        entry.settled = true;
        evictGet(key, entry);
    });
    return entry;
}
function invalidateSettledGetReuse() {
    for (const [key, entry] of inflightGets) {
        if (!entry.settled)
            continue;
        void entry.promise.then((response) => evictGet(key, entry, response), () => evictGet(key, entry));
    }
}
export function invalidateApiGetReuse() {
    mutationGeneration += 1;
    invalidateSettledGetReuse();
}
function isTimeTrackingApiPath(pathOrUrl) {
    try {
        const pathname = pathOrUrl.startsWith('http')
            ? new URL(pathOrUrl).pathname
            : pathOrUrl;
        return pathname.includes('/api/v1/time-tracking');
    }
    catch {
        return pathOrUrl.includes('/api/v1/time-tracking');
    }
}
function waitMs(ms, signal) {
    if (signal?.aborted)
        return Promise.reject(abortError(signal));
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(abortError(signal));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
function fetchWithGetDedupe(url, init, headers, reuseWindowMs = GET_REUSE_WINDOW_MS) {
    const method = normalizedMethod(init);
    if (method !== 'GET' || init.body != null) {
        if (method !== 'GET' && method !== 'HEAD')
            invalidateApiGetReuse();
        return {
            promise: fetch(url, { ...init, headers, credentials: 'include' }),
            delivery: 'network',
        };
    }
    const key = getDedupeKey(url, init, headers);
    let entry = inflightGets.get(key);
    let delivery;
    if (!entry) {
        entry = startGet(url, init, headers, key, init.cache === 'no-store' ? 0 : Math.max(0, reuseWindowMs));
        delivery = 'network';
    }
    else {
        delivery = entry.settled ? 'reused' : 'deduplicated';
    }
    return {
        promise: subscribeToGet(key, entry, init.signal ?? undefined),
        delivery,
    };
}
export async function apiFetch(path, init = {}) {
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
    const { skipAuth = false, skipAuthRedirectOn401 = false, getReuseWindowMs = GET_REUSE_WINDOW_MS, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (rest.body instanceof FormData)
        headers.delete('Content-Type');
    if (!skipAuth) {
        const token = getAccessToken();
        if (token)
            headers.set('Authorization', `Bearer ${token}`);
    }
    const method = normalizedMethod(rest);
    const startedAt = apiRequestMetricNow();
    let delivery = 'network';
    let response;
    try {
        const coordinated = fetchWithGetDedupe(url, rest, headers, getReuseWindowMs);
        delivery = coordinated.delivery;
        response = await coordinated.promise;
        const retryableOutage = (response.status === 502 || response.status === 503)
            && (method === 'GET' || method === 'HEAD')
            && isTimeTrackingApiPath(rel)
            && !rest.signal?.aborted;
        if (retryableOutage) {
            await waitMs(500, rest.signal ?? undefined);
            const retry = fetchWithGetDedupe(url, rest, headers, 0);
            delivery = retry.delivery;
            response = await retry.promise;
        }
        recordApiRequestMetric({
            method,
            url,
            delivery,
            outcome: response.ok ? 'success' : 'http-error',
            status: response.status,
            durationMs: apiRequestMetricNow() - startedAt,
        });
    }
    catch (error) {
        recordApiRequestMetric({
            method,
            url,
            delivery,
            outcome: rest.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')
                ? 'aborted'
                : 'network-error',
            status: null,
            durationMs: apiRequestMetricNow() - startedAt,
        });
        throw error;
    }
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
export async function fetchGatewayLive() {
    const res = await apiFetch('/live', { skipAuth: true, skipAuthRedirectOn401: true });
    return res.ok;
}
export async function fetchTodosHealthThroughGateway() {
    const res = await apiFetch('/health/todos', { skipAuth: true, skipAuthRedirectOn401: true });
    return res.ok;
}
export function getApiUrl(path) {
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
function normalizePublicMediaPath(pathOrUrl) {
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
export function getPublicGatewayAssetUrl(pathOrUrl) {
    const raw = (pathOrUrl ?? '').trim();
    if (!raw)
        return null;
    let pathname;
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
function encodeMediaPathSegments(mediaPath) {
    const path = mediaPath.startsWith('/') ? mediaPath.slice(1) : mediaPath;
    return path
        .split('/')
        .filter((s) => s.length > 0 && s !== '.' && s !== '..')
        .map((seg) => encodeURIComponent(seg))
        .join('/');
}
export async function fetchMediaBlob(mediaPath) {
    const safePath = encodeMediaPathSegments(mediaPath);
    const res = await apiFetch(`/api/v1/media/${safePath}`);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = `Не удалось загрузить файл (${res.status})`;
        try {
            const j = JSON.parse(text);
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
function isBareMediaStorageKey(normalized) {
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
export function getMediaPathFromMediaUrl(url) {
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
async function blobUrlFromApiFetch(pathOrAbsoluteSameOrigin) {
    const res = await apiFetch(pathOrAbsoluteSameOrigin);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = `Не удалось загрузить файл (${res.status})`;
        try {
            const j = JSON.parse(text);
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
export async function createAuthenticatedMediaBlobUrl(urlOrPath) {
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
