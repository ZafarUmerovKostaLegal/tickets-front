import type { Workbook } from 'exceljs';


export type ExcelJSLib = {
    Workbook: new () => Workbook;
};

let cache: ExcelJSLib | null = null;


export async function loadExcelJS(): Promise<ExcelJSLib> {
    if (cache != null) {
        return cache;
    }
    const m = (await import('exceljs')) as { default: ExcelJSLib };
    cache = m.default;
    return m.default;
}
