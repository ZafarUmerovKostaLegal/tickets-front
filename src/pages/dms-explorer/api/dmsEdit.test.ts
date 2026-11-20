/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners: Record<string, (event: { payload: unknown }) => void> = {};
const invoke = vi.fn();
const checkin = vi.fn();
const checkout = vi.fn();
const discardCheckout = vi.fn();
const contentBlob = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock('@tauri-apps/api/event', () => ({
    listen: async (name: string, handler: (event: { payload: unknown }) => void) => {
        listeners[name] = handler;
        return () => undefined;
    },
}));
vi.mock('@pages/file-manager/api/filesApi', () => ({
    filesApi: {
        checkin: (...args: unknown[]) => checkin(...args),
        checkout: (...args: unknown[]) => checkout(...args),
        discardCheckout: (...args: unknown[]) => discardCheckout(...args),
        contentBlob: (...args: unknown[]) => contentBlob(...args),
    },
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const readText = (file: File) => new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
});

describe('edit in Office', () => {
    beforeEach(() => {
        invoke.mockReset();
        checkin.mockReset().mockResolvedValue({});
        checkout.mockReset().mockResolvedValue({});
        discardCheckout.mockReset().mockResolvedValue({});
        contentBlob.mockReset().mockResolvedValue({ arrayBuffer: async () => new TextEncoder().encode('original').buffer });
        invoke.mockImplementation(async (command: string, args?: { args?: { documentId: string; fileName: string } }) => {
            if (command === 'kf_capabilities')
                return { editInOffice: true };
            if (command === 'kf_edit_open')
                return { documentId: args!.args!.documentId, fileName: args!.args!.fileName, path: 'C:/edit/d1/Contract.docx' };
            if (command === 'kf_read_edit_file')
                return btoa('edited in word');
            return null;
        });
    });

    it('checks out, opens the copy and uploads every save as a new version', async () => {
        const { editInOffice, onEditUploaded } = await import('./dmsEdit');
        const results: unknown[] = [];
        onEditUploaded((result) => results.push(result));

        const info = await editInOffice('d1', 'Contract.docx');
        expect(info.path).toBe('C:/edit/d1/Contract.docx');
        expect(checkout).toHaveBeenCalledWith('d1');
        const openArgs = invoke.mock.calls.find(([command]) => command === 'kf_edit_open')![1] as { args: { bytesBase64: string } };
        expect(atob(openArgs.args.bytesBase64)).toBe('original');

        listeners['kf-edit-saved']!({ payload: { documentId: 'd1', fileName: 'Contract.docx', path: 'C:/edit/d1/Contract.docx', size: 14 } });
        await flush();
        await flush();
        expect(checkin).toHaveBeenCalledTimes(1);
        const [docId, file] = checkin.mock.calls[0]!;
        expect(docId).toBe('d1');
        expect(await readText(file as File)).toBe('edited in word');
        expect(checkout).toHaveBeenCalledTimes(2);
        expect(results).toEqual([{ documentId: 'd1', fileName: 'Contract.docx', ok: true }]);
    });

    it('reports a failed upload and releases the lock when editing ends', async () => {
        const { finishEditing, onEditUploaded, startEditSync } = await import('./dmsEdit');
        await startEditSync();
        checkin.mockRejectedValueOnce(new Error('Документ взят: Iroda'));
        const results: Array<{ ok: boolean; error?: string }> = [];
        onEditUploaded((result) => results.push(result));
        listeners['kf-edit-saved']!({ payload: { documentId: 'd2', fileName: 'Memo.docx', path: 'C:/edit/d2/Memo.docx', size: 3 } });
        await flush();
        await flush();
        expect(results[0]).toMatchObject({ ok: false, error: 'Документ взят: Iroda' });

        await finishEditing('d2');
        expect(invoke).toHaveBeenCalledWith('kf_edit_close', { documentId: 'd2' });
        expect(discardCheckout).toHaveBeenCalledWith('d2');
    });
});
