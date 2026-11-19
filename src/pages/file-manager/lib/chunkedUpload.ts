/**
 * Resumable chunked upload of large files (gigabytes) into a matter.
 *
 * The file is read slice by slice (`File.slice`), so the browser never holds it in memory. Each chunk is
 * retried with back-off; after a dropped connection the server tells where to continue. A small record in
 * localStorage lets the same file (name + size + date) resume after a page reload.
 */

export const CHUNKED_THRESHOLD = 40 * 1024 * 1024;

export type UploadTarget = {
    matterId: string;
    folderId: string | null;
    documentId?: string | null;
    comment?: string;
    allowDuplicate?: boolean;
};

export type UploadSession = { id: string; size: number; received: number; chunkSize: number };

export type UploadResult = {
    status: 'created' | 'version' | 'unchanged' | 'exists' | 'duplicate';
    document: { id: string; name: string; version?: number };
};

export type Send = (path: string, init: RequestInit) => Promise<Response>;

export class UploadError extends Error {
    readonly retryable: boolean;
    readonly status: number;

    constructor(message: string, retryable: boolean, status = 0) {
        super(message);
        this.retryable = retryable;
        this.status = status;
    }
}

const RESUME_KEY = 'fm.resumableUploads';
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000, 30000];

type ResumeRecord = { key: string; id: string; at: number };

export function fileKey(file: Pick<File, 'name' | 'size' | 'lastModified'>, target: UploadTarget): string {
    return [target.matterId, target.folderId ?? '', target.documentId ?? '', file.name, file.size, file.lastModified].join('|');
}

function readResume(): ResumeRecord[] {
    try {
        const raw = JSON.parse(localStorage.getItem(RESUME_KEY) ?? '[]') as unknown;
        return Array.isArray(raw) ? raw.filter((row): row is ResumeRecord => Boolean(row && typeof row === 'object' && 'key' in row && 'id' in row)) : [];
    }
    catch {
        return [];
    }
}

function writeResume(rows: ResumeRecord[]): void {
    try {
        const fresh = rows.filter((row) => Date.now() - row.at < 2 * 24 * 3600 * 1000).slice(-50);
        localStorage.setItem(RESUME_KEY, JSON.stringify(fresh));
    }
    catch {
        // private mode / quota — resuming after reload is a convenience only
    }
}

function remember(key: string, id: string): void {
    writeResume([...readResume().filter((row) => row.key !== key), { key, id, at: Date.now() }]);
}

function forget(key: string): void {
    writeResume(readResume().filter((row) => row.key !== key));
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
    });
}

async function detailOf(response: Response): Promise<{ message: string; received?: number }> {
    try {
        const body = await response.json() as { detail?: unknown };
        const detail = body.detail;
        if (typeof detail === 'string')
            return { message: detail };
        if (detail && typeof detail === 'object') {
            const row = detail as { message?: unknown; received?: unknown };
            return { message: String(row.message ?? ''), received: typeof row.received === 'number' ? row.received : undefined };
        }
    }
    catch {
        // not JSON
    }
    return { message: `HTTP ${response.status}` };
}

const retryableStatus = (status: number) => status === 408 || status === 429 || status >= 500 && status !== 507;

/** One request with retries for network errors and 5xx; 4xx are returned to the caller. */
async function withRetry(run: () => Promise<Response>, signal?: AbortSignal, onRetry?: (attempt: number) => void, backoff: readonly number[] = BACKOFF_MS): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
        try {
            const response = await run();
            if (!retryableStatus(response.status) || attempt >= backoff.length)
                return response;
        }
        catch (error) {
            if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError'))
                throw error;
            if (attempt >= backoff.length)
                throw new UploadError('Нет связи с сервером', true);
        }
        onRetry?.(attempt + 1);
        await wait(backoff[attempt]!, signal);
    }
}

export async function uploadInChunks(
    file: File,
    target: UploadTarget,
    send: Send,
    options: { signal?: AbortSignal; onProgress?: (sent: number, total: number) => void; onRetry?: (attempt: number) => void; backoff?: readonly number[] } = {},
): Promise<UploadResult> {
    const { signal, onProgress } = options;
    const retry = (run: () => Promise<Response>) => withRetry(run, signal, options.onRetry, options.backoff);
    const key = fileKey(file, target);
    let session: UploadSession | null = null;

    const known = readResume().find((row) => row.key === key);
    if (known) {
        const status = await retry(() => send(`/uploads/${encodeURIComponent(known.id)}`, { method: 'GET', signal }));
        if (status.ok)
            session = await status.json() as UploadSession;
        else
            forget(key);
    }
    if (!session) {
        const started = await retry(() => send(`/matters/${encodeURIComponent(target.matterId)}/uploads`, {
            method: 'POST',
            signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: file.name,
                size: file.size,
                contentType: file.type || 'application/octet-stream',
                folderId: target.folderId,
                documentId: target.documentId ?? null,
                comment: target.comment ?? '',
                allowDuplicate: Boolean(target.allowDuplicate),
            }),
        }));
        if (!started.ok) {
            const { message } = await detailOf(started);
            throw new UploadError(message, false, started.status);
        }
        session = await started.json() as UploadSession;
        remember(key, session.id);
    }

    const chunk = Math.max(256 * 1024, session.chunkSize || 8 * 1024 * 1024);
    let offset = session.received;
    onProgress?.(offset, file.size);
    while (offset < file.size) {
        const end = Math.min(file.size, offset + chunk);
        const at = offset;
        const response = await retry(() => send(`/uploads/${encodeURIComponent(session!.id)}?offset=${at}`, {
            method: 'PUT',
            signal,
            headers: { 'Content-Type': 'application/octet-stream' },
            body: file.slice(at, end),
        }));
        if (response.status === 409) {
            const { received } = await detailOf(response);
            if (typeof received === 'number') {
                offset = received;
                continue;
            }
        }
        if (response.status === 404) {
            forget(key);
            throw new UploadError('Загрузка устарела на сервере — начните заново', false, 404);
        }
        if (!response.ok) {
            const { message } = await detailOf(response);
            throw new UploadError(message, retryableStatus(response.status), response.status);
        }
        offset = (await response.json() as UploadSession).received;
        onProgress?.(offset, file.size);
    }

    const done = await retry(() => send(`/uploads/${encodeURIComponent(session!.id)}/complete`, { method: 'POST', signal }));
    if (!done.ok) {
        const { message } = await detailOf(done);
        throw new UploadError(message, false, done.status);
    }
    forget(key);
    const body = await done.json() as { results: UploadResult[] };
    return body.results[0]!;
}

export async function cancelChunkedUpload(file: File, target: UploadTarget, send: Send): Promise<void> {
    const key = fileKey(file, target);
    const known = readResume().find((row) => row.key === key);
    forget(key);
    if (known)
        await send(`/uploads/${encodeURIComponent(known.id)}`, { method: 'DELETE' }).catch(() => undefined);
}
