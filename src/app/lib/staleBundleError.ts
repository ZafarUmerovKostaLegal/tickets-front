const STALE_BUNDLE_MESSAGE_RE = /unable to preload css|failed to fetch dynamically imported|importing a module script failed|loading chunk|chunk\s*load|chunkload|error loading dynamically imported|failed to load module script|failed to fetch.*\/assets\//i;
export function isLikelyStaleBundleErrorMessage(msg: string): boolean {
    return STALE_BUNDLE_MESSAGE_RE.test(msg);
}
export function hardReloadWithCacheBust(): void {
    const u = new URL(window.location.href);
    u.searchParams.set('_cb', String(Date.now()));
    window.location.replace(u.toString());
}
