import { loadExcelJS } from '@shared/lib/exceljsLoader';
const MAX_TEXT_CHARS = 120000;
const MAX_SHEETS = 4;
const MAX_ROWS = 100;
const MAX_COLS = 28;
function fileExt(fileName) {
    const i = fileName.lastIndexOf('.');
    return i >= 0 ? fileName.slice(i + 1).toLowerCase() : '';
}
function normalizeMime(contentType, blobType) {
    const raw = (contentType || blobType || '').split(';')[0].trim().toLowerCase();
    return raw;
}
function cellToString(cell) {
    const v = cell.value;
    if (v == null || v === '')
        return '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
        return String(v);
    if (v instanceof Date)
        return v.toISOString();
    if (typeof v === 'object') {
        if ('richText' in v && Array.isArray(v.richText)) {
            return v.richText.map(t => t.text).join('');
        }
        if ('text' in v && typeof v.text === 'string') {
            return v.text;
        }
        if ('formula' in v && 'result' in v) {
            const r = v.result;
            return r == null ? '' : String(r);
        }
    }
    return String(v);
}
async function parseXlsxSheets(blob) {
    const ExcelJS = await loadExcelJS();
    const ab = await blob.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(ab);
    const out = [];
    let sheetCount = 0;
    for (const ws of wb.worksheets) {
        if (sheetCount >= MAX_SHEETS)
            break;
        sheetCount++;
        const name = ws.name || `Лист ${sheetCount}`;
        const rows = [];
        const dim = Math.min(ws.rowCount || 0, MAX_ROWS);
        const used = dim > 0 ? dim : 1;
        for (let r = 1; r <= used; r++) {
            const row = ws.getRow(r);
            const cells = [];
            let lastNonEmpty = -1;
            for (let c = 1; c <= MAX_COLS; c++) {
                const val = cellToString(row.getCell(c));
                cells.push(val);
                if (val !== '')
                    lastNonEmpty = c - 1;
            }
            rows.push(lastNonEmpty >= 0 ? cells.slice(0, lastNonEmpty + 1) : cells.slice(0, 1));
        }
        out.push({ name, rows });
    }
    return out;
}
export async function buildAttachmentPreview(blob, fileName, contentType) {
    const ext = fileExt(fileName);
    const mime = normalizeMime(contentType, blob.type);
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
        const objectUrl = URL.createObjectURL(blob);
        return { model: { type: 'image', objectUrl }, objectUrl };
    }
    if (mime === 'application/pdf' || ext === 'pdf') {
        const objectUrl = URL.createObjectURL(blob);
        return { model: { type: 'pdf', objectUrl }, objectUrl };
    }
    if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(ext)) {
        const objectUrl = URL.createObjectURL(blob);
        return { model: { type: 'video', objectUrl }, objectUrl };
    }
    if (mime.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'ogg'].includes(ext)) {
        const objectUrl = URL.createObjectURL(blob);
        return { model: { type: 'audio', objectUrl }, objectUrl };
    }
    if (mime.startsWith('text/') ||
        ['txt', 'csv', 'log', 'md', 'json', 'xml', 'html', 'htm'].includes(ext)) {
        let text = await blob.text();
        if (text.length > MAX_TEXT_CHARS) {
            text = `${text.slice(0, MAX_TEXT_CHARS)}\n\n… (${fileName}: обрезано для превью)`;
        }
        return { model: { type: 'text', text }, objectUrl: null };
    }
    const isXlsx = ext === 'xlsx' ||
        ext === 'xlsm' ||
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (isXlsx) {
        try {
            const sheets = await parseXlsxSheets(blob);
            const truncatedNote = sheets.length >= MAX_SHEETS
                ? `Показаны первые ${MAX_SHEETS} листа, до ${MAX_ROWS} строк и ${MAX_COLS} колонок каждый.`
                : `До ${MAX_ROWS} строк и ${MAX_COLS} колонок на лист (для быстрого превью).`;
            return { model: { type: 'sheets', sheets, truncatedNote }, objectUrl: null };
        }
        catch {
            const objectUrl = URL.createObjectURL(blob);
            return {
                model: {
                    type: 'unsupported',
                    hint: 'Не удалось разобрать таблицу как Excel. Откройте файл в новой вкладке или в Excel.',
                    objectUrl,
                },
                objectUrl,
            };
        }
    }
    const objectUrl = URL.createObjectURL(blob);
    return {
        model: {
            type: 'unsupported',
            hint: `Предпросмотр для «.${ext || '?'}» (${mime || 'тип неизвестен'}) в браузере недоступен. Откройте файл в новой вкладке.`,
            objectUrl,
        },
        objectUrl,
    };
}
