import { useEffect, useState } from 'react';
import { DocxEditor, useFonts } from '@docx-editor.dev/react';
import { defaultFonts } from '@docx-editor.dev/fonts';
import '@docx-editor.dev/core/styles/editor.css';
import '@docx-editor.dev/react/styles.css';

const fonts = defaultFonts();

export function DocxView({ bytes, title }: { bytes: Uint8Array; title: string }) {
    const loaded = useFonts(fonts);
    return (
        <div className="fm-pv__docx">
            <DocxEditor document={bytes} fonts={loaded} mode="view" locale="ru-RU" title={title} chrome={false} menu={false} navigation={false} />
        </div>
    );
}

type Sheet = { name: string; rows: string[][]; more: boolean };

const MAX_ROWS = 500;
const MAX_COLS = 40;

function cellText(value: unknown): string {
    if (value == null)
        return '';
    if (value instanceof Date)
        return value.toLocaleDateString();
    if (typeof value === 'object') {
        const v = value as { text?: unknown; result?: unknown; richText?: Array<{ text: string }>; hyperlink?: string };
        if (v.richText)
            return v.richText.map((part) => part.text).join('');
        if (v.text != null)
            return String(v.text);
        if (v.result != null)
            return cellText(v.result);
        return '';
    }
    return String(value);
}

export function XlsxView({ bytes, emptyText }: { bytes: Uint8Array; emptyText: string }) {
    const [sheets, setSheets] = useState<Sheet[] | null>(null);
    const [active, setActive] = useState(0);
    const [error, setError] = useState('');
    useEffect(() => {
        let alive = true;
        void (async () => {
            try {
                const { default: ExcelJS } = await import('exceljs');
                const book = new ExcelJS.Workbook();
                await book.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
                const out: Sheet[] = book.worksheets.map((sheet) => {
                    const rows: string[][] = [];
                    sheet.eachRow({ includeEmpty: false }, (row) => {
                        if (rows.length >= MAX_ROWS)
                            return;
                        const values = Array.isArray(row.values) ? row.values.slice(1, MAX_COLS + 1) : [];
                        rows.push(values.map(cellText));
                    });
                    return { name: sheet.name, rows, more: sheet.actualRowCount > MAX_ROWS };
                });
                if (alive)
                    setSheets(out);
            }
            catch (err) {
                if (alive)
                    setError(err instanceof Error ? err.message : String(err));
            }
        })();
        return () => {
            alive = false;
        };
    }, [bytes]);
    if (error)
        return <p className="fm-pv__note">{error}</p>;
    if (!sheets)
        return <div className="fm-pv__loading" aria-busy="true" />;
    const sheet = sheets[active];
    return (
        <div className="fm-pv__sheet">
            {sheets.length > 1 ? (
                <div className="fm-pv__tabs" role="tablist">
                    {sheets.map((item, index) => (
                        <button key={item.name} type="button" role="tab" aria-selected={index === active} className={index === active ? 'is-on' : ''} onClick={() => setActive(index)}>{item.name}</button>
                    ))}
                </div>
            ) : null}
            {sheet && sheet.rows.length ? (
                <div className="fm-pv__table-wrap">
                    <table className="fm-pv__table">
                        <tbody>
                            {sheet.rows.map((row, r) => (
                                <tr key={r}>
                                    <th scope="row">{r + 1}</th>
                                    {row.map((cell, c) => <td key={c}>{cell}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="fm-pv__note">{emptyText}</p>}
        </div>
    );
}
