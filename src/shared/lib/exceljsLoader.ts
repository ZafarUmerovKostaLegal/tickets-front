import type { Workbook } from 'exceljs';


export type ExcelJSLib = {
    Workbook: new () => Workbook;
};

let cache: ExcelJSLib | null = null;


export async function loadExcelJS(): Promise<ExcelJSLib> {
    if (cache != null) {
        return cache;
    }
    const raw = await import('exceljs');
    const lib = (raw as { default?: ExcelJSLib }).default ?? (raw as unknown as ExcelJSLib);
    if (!lib || typeof lib.Workbook !== 'function')
        throw new Error('ExcelJS не загрузился (ожидался экспорт Workbook).');
    cache = lib;
    return lib;
}
