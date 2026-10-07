import { isLikelyStaleBundleError, reloadForStaleBundle, STALE_BUNDLE_USER_MESSAGE, } from '@app/lib/staleBundleError';
import '../../bufferPolyfill';
import '../../processPolyfill';
let cache = null;
export const EXCELJS_BROWSER_WRITE_OPTIONS = {
    zip: { type: 'arraybuffer' },
};
export async function loadExcelJS() {
    if (cache != null)
        return cache;
    try {
        const raw = await import('exceljs');
        const lib = raw.default ?? raw;
        if (!lib || typeof lib.Workbook !== 'function')
            throw new Error('ExcelJS не загрузился (ожидался экспорт Workbook).');
        cache = lib;
        return lib;
    }
    catch (e) {
        if (isLikelyStaleBundleError(e)) {
            reloadForStaleBundle();
            // Hang while the page reloads so callers don't show a raw English error.
            await new Promise(() => undefined);
        }
        throw e instanceof Error ? e : new Error(STALE_BUNDLE_USER_MESSAGE);
    }
}
function excelBufferByteLength(buffer) {
    if (buffer == null)
        return 0;
    if (buffer instanceof ArrayBuffer)
        return buffer.byteLength;
    return buffer.byteLength ?? buffer.length ?? 0;
}
export async function writeExcelWorkbookBuffer(wb) {
    await loadExcelJS();
    const buffer = await wb.xlsx.writeBuffer(EXCELJS_BROWSER_WRITE_OPTIONS);
    if (excelBufferByteLength(buffer) < 64)
        throw new Error('Excel export produced an empty or invalid file.');
    return buffer;
}
export function excelWorkbookBufferToBlob(buffer) {
    if (excelBufferByteLength(buffer) < 64)
        throw new Error('Excel export produced an empty or invalid file.');
    return new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}
