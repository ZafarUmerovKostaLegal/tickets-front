import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { filesApi } from '@pages/file-manager/api/filesApi';

export type EditSaved = { documentId: string; fileName: string; path: string; size: number };
export type EditInfo = { documentId: string; fileName: string; path: string };
export type EditUploadResult = { documentId: string; fileName: string; ok: boolean; error?: string };

const SAVED_EVENT = 'kf-edit-saved';
const UPLOAD_EVENT = 'kosta:edit-uploaded';

let capability: Promise<boolean> | null = null;

export function canEditInOffice(): Promise<boolean> {
    if (!capability) {
        capability = (async () => {
            try {
                if (!isTauri())
                    return false;
                const caps = await invoke<{ editInOffice?: boolean }>('kf_capabilities');
                return Boolean(caps?.editInOffice);
            }
            catch {
                return false;
            }
        })();
    }
    return capability;
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(base64);
    const out = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i += 1)
        out[i] = binary.charCodeAt(i);
    return out;
}

const uploading = new Map<string, Promise<void>>();

async function uploadSaved(event: EditSaved): Promise<void> {
    const previous = uploading.get(event.documentId) ?? Promise.resolve();
    const next = previous.then(async () => {
        try {
            const bytes = base64ToBytes(await invoke<string>('kf_read_edit_file', { path: event.path }));
            const file = new File([bytes], event.fileName);
            await filesApi.checkin(event.documentId, file, 'Сохранено из Office (Kosta File)');
            await filesApi.checkout(event.documentId).catch(() => undefined);
            window.dispatchEvent(new CustomEvent<EditUploadResult>(UPLOAD_EVENT, {
                detail: { documentId: event.documentId, fileName: event.fileName, ok: true },
            }));
        }
        catch (error) {
            window.dispatchEvent(new CustomEvent<EditUploadResult>(UPLOAD_EVENT, {
                detail: {
                    documentId: event.documentId,
                    fileName: event.fileName,
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                },
            }));
        }
    });
    uploading.set(event.documentId, next);
    await next;
}

let listening: Promise<void> | null = null;

export function startEditSync(): Promise<void> {
    if (!listening) {
        listening = canEditInOffice().then(async (ok) => {
            if (!ok)
                return;
            await listen<EditSaved>(SAVED_EVENT, (event) => {
                void uploadSaved(event.payload);
            });
        });
    }
    return listening;
}

export function onEditUploaded(handler: (result: EditUploadResult) => void): () => void {
    const listener = (event: Event) => handler((event as CustomEvent<EditUploadResult>).detail);
    window.addEventListener(UPLOAD_EVENT, listener);
    return () => window.removeEventListener(UPLOAD_EVENT, listener);
}

export async function editInOffice(documentId: string, fileName: string): Promise<EditInfo> {
    await startEditSync();
    await filesApi.checkout(documentId);
    const blob = await filesApi.contentBlob(documentId);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return invoke<EditInfo>('kf_edit_open', {
        args: { documentId, fileName, bytesBase64: bytesToBase64(bytes) },
    });
}

export async function finishEditing(documentId: string): Promise<void> {
    await uploading.get(documentId);
    await invoke('kf_edit_close', { documentId });
    await filesApi.discardCheckout(documentId).catch(() => undefined);
}

export function listEdits(): Promise<EditInfo[]> {
    return invoke<EditInfo[]>('kf_edit_list').catch(() => []);
}
