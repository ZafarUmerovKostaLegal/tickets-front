const STALE_BUNDLE_MESSAGE_RE = /unable to preload css|failed to fetch dynamically imported|importing a module script failed|loading chunk|chunk\s*load|chunkload|error loading dynamically imported|failed to load module script|failed to fetch.*\/assets\//i;

export function isLikelyStaleBundleErrorMessage(msg: string): boolean {
    return STALE_BUNDLE_MESSAGE_RE.test(msg);
}


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

    }
}
