const STALE_BUNDLE_MESSAGE_RE =
    /unable to preload css|failed to fetch dynamically imported|importing a module script failed|loading chunk|chunk\s*load|chunkload|error loading dynamically imported|failed to load module script|failed to fetch.*\/assets\//i;

const RELOAD_GUARD_KEY = 'tt_stale_bundle_reload_at';
const RELOAD_GUARD_MS = 20_000;

export function isLikelyStaleBundleErrorMessage(msg: string): boolean {
    return STALE_BUNDLE_MESSAGE_RE.test(msg);
}

export function isLikelyStaleBundleError(err: unknown): boolean {
    if (err == null)
        return false;
    if (typeof err === 'string')
        return isLikelyStaleBundleErrorMessage(err);
    if (err instanceof Error)
        return isLikelyStaleBundleErrorMessage(err.message) || isLikelyStaleBundleErrorMessage(err.name);
    if (typeof err === 'object' && 'message' in err)
        return isLikelyStaleBundleErrorMessage(String((err as { message: unknown }).message ?? ''));
    return isLikelyStaleBundleErrorMessage(String(err));
}

export const STALE_BUNDLE_USER_TITLE = 'Нужно обновить страницу';

export const STALE_BUNDLE_USER_MESSAGE =
    'Вышла новая версия приложения. Обновите страницу, чтобы загрузить актуальные файлы.';

export function stripLegacyReloadQueryParams(): void {
    if (typeof window === 'undefined')
        return;
    try {
        const u = new URL(window.location.href);
        let changed = false;
        for (const key of ['_cb', 'v']) {
            if (u.searchParams.has(key)) {
                u.searchParams.delete(key);
                changed = true;
            }
        }
        if (changed) {
            const next = `${u.pathname}${u.search}${u.hash}`;
            window.history.replaceState(window.history.state, '', next);
        }
    }
    catch {
        // ignore
    }
}

function canReloadNow(): boolean {
    try {
        const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0');
        if (Number.isFinite(last) && Date.now() - last < RELOAD_GUARD_MS)
            return false;
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        return true;
    }
    catch {
        return true;
    }
}

/** Soft reload once — avoids infinite loops if assets are truly missing. */
export function reloadForStaleBundle(): boolean {
    if (typeof window === 'undefined')
        return false;
    if (!canReloadNow())
        return false;
    window.location.reload();
    return true;
}

/**
 * Auto-recover after deploy: old tabs keep hashed chunk URLs that 404 on the new build.
 * Vite fires `vite:preloadError` for failed dynamic imports / CSS preloads.
 */
export function installStaleBundleReload(): void {
    if (typeof window === 'undefined')
        return;

    window.addEventListener('vite:preloadError', (event) => {
        event.preventDefault();
        reloadForStaleBundle();
    });

    window.addEventListener('unhandledrejection', (event) => {
        if (!isLikelyStaleBundleError(event.reason))
            return;
        event.preventDefault();
        reloadForStaleBundle();
    });
}
