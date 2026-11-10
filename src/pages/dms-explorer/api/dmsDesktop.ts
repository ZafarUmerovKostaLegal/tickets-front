import { invoke, isTauri } from '@tauri-apps/api/core';
import { isTauriDesktopClient } from '@shared/config';

export function canUseDmsDesktop(): boolean {
    return isTauriDesktopClient();
}

export async function openDmsExplorerWindow(): Promise<void> {
    if (!isTauri())
        throw new Error('DMS Explorer доступен только в desktop-приложении');
    await invoke('show_dms_explorer');
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        const slice = bytes.subarray(i, i + chunk);
        binary += String.fromCharCode(...slice);
    }
    return btoa(binary);
}

export async function writeTempFile(fileName: string, blob: Blob): Promise<string> {
    const buffer = new Uint8Array(await blob.arrayBuffer());
    return invoke<string>('dms_write_temp_file', {
        args: {
            fileName,
            bytesBase64: bytesToBase64(buffer),
        },
    });
}

export async function openPath(path: string): Promise<void> {
    await invoke('dms_open_path', { path });
}

export async function sendOutlookAttachment(path: string, subject?: string): Promise<void> {
    await invoke('dms_send_outlook_attachment', { path, subject: subject ?? null });
}

export async function openBlobInDesktopApp(fileName: string, blob: Blob): Promise<void> {
    const path = await writeTempFile(fileName, blob);
    await openPath(path);
}

export async function sendBlobViaOutlook(fileName: string, blob: Blob, subject?: string): Promise<void> {
    const path = await writeTempFile(fileName, blob);
    await sendOutlookAttachment(path, subject);
}
