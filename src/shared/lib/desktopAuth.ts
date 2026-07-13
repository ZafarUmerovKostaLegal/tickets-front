import { routes } from '@shared/config';
import { isTauriDesktopClient } from '@shared/config/desktopClient';

export const DESKTOP_APP_ORIGIN_KEY = 'kl_desktop_app_origin';

export function rememberDesktopAppOrigin(): void {
    if (!isTauriDesktopClient())
        return;
    try {
        localStorage.setItem(DESKTOP_APP_ORIGIN_KEY, window.location.origin);
    }
    catch {
    }
}

export function getRememberedDesktopAppOrigin(): string | null {
    try {
        const raw = localStorage.getItem(DESKTOP_APP_ORIGIN_KEY);
        return raw?.trim() ? raw.trim() : null;
    }
    catch {
        return null;
    }
}

function isAuthCallbackPath(pathname: string): boolean {
    const normalized = pathname.replace(/\/+$/, '') || '/';
    return normalized === routes.authCallback || normalized.endsWith(`${routes.authCallback}`);
}

export function reconcileDesktopAuthCallbackLocation(): boolean {
    if (!isTauriDesktopClient())
        return false;
    if (!isAuthCallbackPath(window.location.pathname))
        return false;
    const remembered = getRememberedDesktopAppOrigin();
    if (!remembered || window.location.origin === remembered)
        return false;
    const target = `${remembered}${routes.authCallback}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
    return true;
}
