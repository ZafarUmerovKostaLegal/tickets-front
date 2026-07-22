import type { Workbook } from 'exceljs';
import {
    isLikelyStaleBundleError,
    reloadForStaleBundle,
    STALE_BUNDLE_USER_MESSAGE,
} from '@app/lib/staleBundleError';
import '../../bufferPolyfill';
import '../../processPolyfill';

export type ExcelJSLib = {
    Workbook: new () => Workbook;
};

let cache: ExcelJSLib | null = null;

export const EXCELJS_BROWSER_WRITE_OPTIONS = {
    zip: { type: 'arraybuffer' as const },
};

export async function loadExcelJS(): Promise<ExcelJSLib> {
    if (cache != null)
        return cache;
    try {
        const raw = await import('exceljs');
        const lib = (raw as { default?: ExcelJSLib }).default ?? (raw as unknown as ExcelJSLib);
        if (!lib || typeof lib.Workbook !== 'function')
            throw new Error('ExcelJS не загрузился (ожидался экспорт Workbook).');
        cache = lib;
        return lib;
    }
    catch (e) {
        if (isLikelyStaleBundleError(e)) {
            reloadForStaleBundle();
            // Hang while the page reloads so callers don't show a raw English error.
            await new Promise<never>(() => undefined);
        }
        throw e instanceof Error ? e : new Error(STALE_BUNDLE_USER_MESSAGE);
    }
}

function excelBufferByteLength(buffer: ArrayBuffer | Uint8Array | Buffer | null | undefined): number {
    if (buffer == null)
        return 0;
    if (buffer instanceof ArrayBuffer)
        return buffer.byteLength;
    return buffer.byteLength ?? buffer.length ?? 0;
}

export async function writeExcelWorkbookBuffer(wb: Workbook): Promise<ArrayBuffer | Uint8Array | Buffer> {
    await loadExcelJS();

    const buffer = await wb.xlsx.writeBuffer(EXCELJS_BROWSER_WRITE_OPTIONS as Parameters<Workbook['xlsx']['writeBuffer']>[0]) as ArrayBuffer | Uint8Array | Buffer | null;
    if (excelBufferByteLength(buffer) < 64)
        throw new Error('Excel export produced an empty or invalid file.');
    return buffer as ArrayBuffer | Uint8Array | Buffer;
}

export function excelWorkbookBufferToBlob(buffer: ArrayBuffer | Uint8Array | Buffer): Blob {
    if (excelBufferByteLength(buffer) < 64)
        throw new Error('Excel export produced an empty or invalid file.');
    return new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}
