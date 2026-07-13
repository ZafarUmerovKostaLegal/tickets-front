import { isTauri } from '@tauri-apps/api/core';
import { APP_WINDOW_TITLE } from '@shared/config/appBranding';
import { isTauriMobileBuild } from '@shared/config/tauriPlatform';

export function isDesktopApp(): boolean {
    return isTauri() && !isTauriMobileBuild();
}

export async function initDesktopShell(): Promise<void> {
    if (!isTauri())
        return;

    if (isTauriMobileBuild()) {
        document.documentElement.dataset.platform = 'mobile';
        document.body.classList.add('app-shell--mobile');
        return;
    }

    document.documentElement.dataset.platform = 'desktop';
    document.body.classList.add('app-shell--desktop');

    try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        await win.setTitle(APP_WINDOW_TITLE);
    }
    catch {

    }
}
