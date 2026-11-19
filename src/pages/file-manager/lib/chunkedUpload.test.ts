import { beforeEach, describe, expect, it } from 'vitest';
import { uploadInChunks, UploadError, type Send } from './chunkedUpload';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => void memory.set(key, value),
        removeItem: (key: string) => void memory.delete(key),
        clear: () => memory.clear(),
    },
});

/** In-memory imitation of the file manager upload API, with injectable failures. */
function fakeServer(options: { chunkSize: number; dropEvery?: number; failStatus?: number }) {
    const sessions = new Map<string, { size: number; data: number[] }>();
    let calls = 0;
    let seq = 0;
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    const send: Send = async (path, init) => {
        calls += 1;
        if (init.signal?.aborted)
            throw new DOMException('Aborted', 'AbortError');
        const method = init.method ?? 'GET';
        if (options.dropEvery && method === 'PUT' && calls % options.dropEvery === 0)
            throw new TypeError('Failed to fetch');
        if (method === 'POST' && path.endsWith('/uploads')) {
            if (options.failStatus)
                return json({ detail: 'На сервере не хватает места' }, options.failStatus);
            const body = JSON.parse(String(init.body)) as { size: number };
            const id = `u${++seq}`;
            sessions.set(id, { size: body.size, data: [] });
            return json({ id, size: body.size, received: 0, chunkSize: options.chunkSize }, 201);
        }
        const match = /^\/uploads\/([^/?]+)(\/complete)?(?:\?offset=(\d+))?$/.exec(path);
        const row = match ? sessions.get(match[1]!) : undefined;
        if (!match || !row)
            return json({ detail: 'gone' }, 404);
        const out = () => ({ id: match[1], size: row.size, received: row.data.length, chunkSize: options.chunkSize });
        if (method === 'GET')
            return json(out());
        if (method === 'PUT') {
            const offset = Number(match[3]);
            if (offset > row.data.length)
                return json({ detail: { message: 'gap', received: row.data.length } }, 409);
            const bytes = [...new Uint8Array(await (init.body as Blob).arrayBuffer())];
            row.data.splice(offset, bytes.length, ...bytes);
            return json(out());
        }
        if (method === 'POST' && match[2])
            return json({ results: [{ status: 'created', document: { id: 'd1', name: 'big.bin' } }] });
        return json({ detail: 'unexpected' }, 400);
    };
    return { send, sessions };
}

const file = (size: number) => new File([new Uint8Array(size).map((_, i) => i % 251)], 'big.bin', { lastModified: 1 });
const target = { matterId: 'm1', folderId: null };

describe('uploadInChunks', () => {
    beforeEach(() => localStorage.clear());

    it('sends the file in chunks and survives dropped connections', async () => {
        const server = fakeServer({ chunkSize: 1000, dropEvery: 3 });
        const progress: number[] = [];
        const source = file(4500);
        const result = await uploadInChunks(source, target, server.send, { backoff: [0, 0, 0], onProgress: (sent) => progress.push(sent) });
        expect(result.status).toBe('created');
        const stored = [...server.sessions.values()][0]!;
        expect(stored.data).toEqual([...new Uint8Array(await source.arrayBuffer())]);
        expect(progress.at(-1)).toBe(4500);
    });

    it('resumes the same file after a reload from where the server stopped', async () => {
        const server = fakeServer({ chunkSize: 1000 });
        const source = file(3000);
        const controller = new AbortController();
        await expect(uploadInChunks(source, target, server.send, {
            signal: controller.signal,
            onProgress: (sent) => {
                if (sent >= 1000)
                    controller.abort();
            },
        })).rejects.toThrow();
        const sent: number[] = [];
        await uploadInChunks(source, target, server.send, { onProgress: (value) => sent.push(value) });
        expect(server.sessions.size).toBe(1);
        expect(sent[0]).toBeGreaterThanOrEqual(1000);
    });

    it('reports a clear error when the server refuses the file', async () => {
        const server = fakeServer({ chunkSize: 1000, failStatus: 507 });
        await expect(uploadInChunks(file(10), target, server.send, { backoff: [] })).rejects.toBeInstanceOf(UploadError);
    });
});

describe('uploadInChunks for Диск', () => {
    beforeEach(() => localStorage.clear());

    it('starts at the drive endpoint with parent and relative path, reads the drive reply', async () => {
        const seen: Array<{ path: string; body?: unknown }> = [];
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
        let received = 0;
        const send: Send = async (path, init) => {
            seen.push({ path, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
            if (path === '/uploads')
                return json({ id: 'd1', size: 1500, received: 0, chunkSize: 1000 }, 201);
            if (path.startsWith('/uploads/d1?offset=')) {
                received += (init.body as Blob).size;
                return json({ id: 'd1', size: 1500, received, chunkSize: 1000 });
            }
            if (path === '/uploads/d1/complete')
                return json({ file: { id: 'f9', name: 'Video.mp4' }, parentId: 'root' });
            return json({ detail: 'unexpected' }, 400);
        };
        const result = await uploadInChunks(file(1500), { matterId: '', folderId: 'root', startPath: '/uploads', extra: { parentId: 'root', path: 'Shoot/Video.mp4' } }, send);
        expect(seen[0]).toEqual({ path: '/uploads', body: { name: 'big.bin', size: 1500, contentType: 'application/octet-stream', parentId: 'root', path: 'Shoot/Video.mp4' } });
        expect(result).toEqual({ status: 'created', document: { id: 'f9', name: 'Video.mp4' } });
    });
});
