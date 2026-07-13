import { isTauri } from '@tauri-apps/api/core';
import { isTauriMobileBuild } from './tauriPlatform';

export function isTauriDesktopClient(): boolean {
    if (typeof window === 'undefined')
        return false;
    try {
        return isTauri() && !isTauriMobileBuild();
    }
    catch {
        return false;
    }
}
