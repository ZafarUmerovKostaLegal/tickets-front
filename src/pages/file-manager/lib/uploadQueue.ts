import { apiFetch } from '@shared/api';
import { cancelChunkedUpload, uploadInChunks, UploadError, type UploadResult, type UploadTarget } from './chunkedUpload';

/**
 * Background queue of large uploads. Lives at module level, so uploads keep going while the user moves
 * around the app; two files go at a time. Pausing keeps the server-side session (resume continues where
 * it stopped); closing the tab asks for confirmation while something is uploading.
 */

export type QueueStatus = 'queued' | 'uploading' | 'paused' | 'done' | 'error' | 'canceled';

export type UploadApi = 'files' | 'drive';

export type QueueItem = {
    id: string;
    /** files — matter documents (file manager), drive — «Диск». */
    api: UploadApi;
    file: File;
    target: UploadTarget;
    matterLabel: string;
    status: QueueStatus;
    sent: number;
    /** Bytes per second, smoothed. */
    speed: number;
    retrying: number;
    error: string;
    result: UploadResult | null;
};

const PARALLEL = 2;
export const filesSend = (path: string, init: RequestInit) => apiFetch(`/api/v1/files${path}`, { ...init, skipGetDedupe: true });
export const driveSend = (path: string, init: RequestInit) => apiFetch(`/api/v1/legal-hub/drive${path}`, { ...init, skipGetDedupe: true });
const sendFor = (api: UploadApi) => (api === 'drive' ? driveSend : filesSend);

let items: QueueItem[] = [];
const controllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();
const doneListeners = new Set<(item: QueueItem) => void>();

function emit(): void {
    items = [...items];
    listeners.forEach((listener) => listener());
}

function patch(id: string, change: Partial<QueueItem>): void {
    items = items.map((item) => (item.id === id ? { ...item, ...change } : item));
    listeners.forEach((listener) => listener());
}

export function subscribeQueue(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function queueSnapshot(): QueueItem[] {
    return items;
}

/** Called once per finished file (refresh the folder, open the document…). */
export function onUploadDone(listener: (item: QueueItem) => void): () => void {
    doneListeners.add(listener);
    return () => doneListeners.delete(listener);
}

export function isUploading(): boolean {
    return items.some((item) => item.status === 'uploading' || item.status === 'queued');
}

function pump(): void {
    const running = items.filter((item) => item.status === 'uploading').length;
    const next = items.filter((item) => item.status === 'queued').slice(0, Math.max(0, PARALLEL - running));
    next.forEach((item) => void run(item.id));
}

async function run(id: string): Promise<void> {
    const item = items.find((row) => row.id === id);
    if (!item)
        return;
    const controller = new AbortController();
    controllers.set(id, controller);
    patch(id, { status: 'uploading', error: '', retrying: 0 });
    let lastAt = performance.now();
    let lastSent = item.sent;
    try {
        const result = await uploadInChunks(item.file, item.target, sendFor(item.api), {
            signal: controller.signal,
            onRetry: (attempt) => patch(id, { retrying: attempt }),
            onProgress: (sent) => {
                const at = performance.now();
                const seconds = (at - lastAt) / 1000;
                const current = items.find((row) => row.id === id);
                let speed = current?.speed ?? 0;
                if (seconds > 0.2 && sent > lastSent) {
                    const instant = (sent - lastSent) / seconds;
                    speed = speed > 0 ? speed * 0.7 + instant * 0.3 : instant;
                    lastAt = at;
                    lastSent = sent;
                }
                patch(id, { sent, speed, retrying: 0 });
            },
        });
        patch(id, { status: 'done', sent: item.file.size, result, speed: 0 });
        const done = items.find((row) => row.id === id);
        if (done)
            doneListeners.forEach((listener) => listener(done));
    }
    catch (error) {
        const current = items.find((row) => row.id === id);
        if (controller.signal.aborted) {
            if (current && current.status === 'uploading')
                patch(id, { status: 'paused', speed: 0 });
        }
        else {
            patch(id, { status: 'error', speed: 0, error: error instanceof UploadError || error instanceof Error ? error.message : String(error) });
        }
    }
    finally {
        controllers.delete(id);
        pump();
    }
}

export function enqueueUploads(files: File[], target: UploadTarget, matterLabel = ''): void {
    enqueueUploadItems(files.map((file) => ({ file, target })), 'files', matterLabel);
}

/** Each file with its own target (Диск: relative path inside a dropped folder). */
export function enqueueUploadItems(rows: Array<{ file: File; target: UploadTarget }>, api: UploadApi, matterLabel = ''): void {
    for (const { file, target } of rows) {
        items.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            api,
            file,
            target,
            matterLabel,
            status: 'queued',
            sent: 0,
            speed: 0,
            retrying: 0,
            error: '',
            result: null,
        });
    }
    emit();
    pump();
}

export function pauseUpload(id: string): void {
    patch(id, { status: 'paused', speed: 0 });
    controllers.get(id)?.abort();
}

export function resumeUpload(id: string): void {
    patch(id, { status: 'queued', error: '' });
    pump();
}

export function cancelUpload(id: string): void {
    const item = items.find((row) => row.id === id);
    if (!item)
        return;
    patch(id, { status: 'canceled', speed: 0 });
    controllers.get(id)?.abort();
    void cancelChunkedUpload(item.file, item.target, sendFor(item.api));
}

export function clearFinished(): void {
    items = items.filter((item) => item.status === 'uploading' || item.status === 'queued' || item.status === 'paused' || item.status === 'error');
    emit();
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', (event) => {
        if (!isUploading())
            return;
        event.preventDefault();
        event.returnValue = '';
    });
}
