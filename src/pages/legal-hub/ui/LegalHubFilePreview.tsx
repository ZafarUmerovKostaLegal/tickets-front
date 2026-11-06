import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@shared/i18n';
import { loadExcelJS } from '@shared/lib/exceljsLoader';
import { fetchLegalHubFileBlob } from './legalHubTaskApi';

class PreviewBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError(): { failed: boolean } {
        return { failed: true };
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

const LegalHubDocxPreview = lazy(async () => {
    const module = await import('./LegalHubDocxPreview');
    return { default: module.LegalHubDocxPreview };
});

type PreviewKind = 'image' | 'pdf' | 'text' | 'docx' | 'sheet' | 'none';

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif']);
const TEXT_EXT = new Set(['txt', 'csv', 'json', 'xml', 'md', 'log', 'html', 'htm']);
const SHEET_EXT = new Set(['xlsx', 'xls']);

function extensionOf(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function previewKind(name: string, type: string): PreviewKind {
    const ext = extensionOf(name);
    const contentType = type.toLowerCase();
    if (contentType.startsWith('image/') || IMAGE_EXT.has(ext))
        return 'image';
    if (contentType === 'application/pdf' || ext === 'pdf')
        return 'pdf';
    if (ext === 'docx' || contentType.includes('wordprocessingml'))
        return 'docx';
    if (SHEET_EXT.has(ext) || contentType.includes('spreadsheet') || contentType.includes('excel'))
        return 'sheet';
    if (contentType.startsWith('text/') || TEXT_EXT.has(ext))
        return 'text';
    return 'none';
}

function typedBlob(blob: Blob, name: string): Blob {
    if (blob.type && blob.type !== 'application/octet-stream')
        return blob;
    const ext = extensionOf(name);
    const type = ext === 'pdf'
        ? 'application/pdf'
        : IMAGE_EXT.has(ext)
            ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
            : TEXT_EXT.has(ext)
                ? 'text/plain'
                : '';
    return type ? new Blob([blob], { type }) : blob;
}

function cellText(value: unknown): string {
    if (value == null)
        return '';
    if (value instanceof Date)
        return value.toLocaleDateString();
    if (typeof value === 'object') {
        if ('result' in value && value.result != null)
            return cellText(value.result);
        if ('text' in value && value.text != null)
            return String(value.text);
        if ('richText' in value && Array.isArray(value.richText))
            return value.richText.map((part) => (part && typeof part === 'object' && 'text' in part ? String(part.text) : '')).join('');
    }
    return String(value);
}

function SheetPreview({ bytes, loadingLabel, onFail }: { bytes: ArrayBuffer; loadingLabel: string; onFail: () => void }) {
    const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>([]);
    const [active, setActive] = useState(0);
    const onFailRef = useRef(onFail);
    onFailRef.current = onFail;
    useEffect(() => {
        let cancelled = false;
        void loadExcelJS().then(async (excel) => {
            const book = new excel.Workbook();
            await book.xlsx.load(bytes);
            const next = book.worksheets.map((sheet) => {
                const rows: string[][] = [];
                const limit = Math.min(sheet.rowCount, 400);
                for (let index = 1; index <= limit; index += 1) {
                    const row = sheet.getRow(index);
                    const width = Math.min(row.cellCount, 30);
                    const cells: string[] = [];
                    for (let column = 1; column <= width; column += 1)
                        cells.push(cellText(row.getCell(column).value));
                    if (cells.some((cell) => cell.trim() !== ''))
                        rows.push(cells);
                }
                return { name: sheet.name, rows };
            });
            if (!cancelled)
                setSheets(next);
        }).catch(() => {
            if (!cancelled)
                onFailRef.current();
        });
        return () => {
            cancelled = true;
        };
    }, [bytes]);
    const sheet = sheets[active];
    if (!sheet)
        return <p>{loadingLabel}</p>;
    return (
        <div className="lh-preview__sheet">
            {sheets.length > 1 ? (
                <div className="lh-preview__tabs">
                    {sheets.map((item, index) => (
                        <button key={item.name} type="button" className={index === active ? 'is-on' : ''} onClick={() => setActive(index)}>{item.name}</button>
                    ))}
                </div>
            ) : null}
            <div className="lh-preview__table-wrap">
                <table>
                    <tbody>
                        {sheet.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function LegalHubFilePreview({ taskId = '', fileId = '', name, onClose, loadBlob }: {
    taskId?: string;
    fileId?: string;
    name: string;
    onClose: () => void;
    loadBlob?: () => Promise<Blob | null>;
}) {
    const { t } = useI18n();
    const [blob, setBlob] = useState<Blob | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [docx, setDocx] = useState<Uint8Array | null>(null);
    const [sheet, setSheet] = useState<ArrayBuffer | null>(null);
    const [failed, setFailed] = useState(false);
    const kind = useMemo(() => previewKind(name, blob?.type ?? ''), [name, blob]);

    useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;
        setFailed(false);
        setBlob(null);
        setUrl(null);
        setText('');
        setDocx(null);
        setSheet(null);
        void (loadBlob ?? (() => fetchLegalHubFileBlob(taskId, fileId)))().then(async (loaded) => {
            if (cancelled)
                return;
            if (loaded == null) {
                setFailed(true);
                return;
            }
            const typed = typedBlob(loaded, name);
            const nextKind = previewKind(name, typed.type);
            setBlob(typed);
            if (nextKind === 'text') {
                setText(await typed.text());
                return;
            }
            if (nextKind === 'docx') {
                setDocx(new Uint8Array(await typed.arrayBuffer()));
                return;
            }
            if (nextKind === 'sheet') {
                setSheet(await typed.arrayBuffer());
                return;
            }
            objectUrl = URL.createObjectURL(typed);
            setUrl(objectUrl);
        }).catch(() => {
            if (!cancelled)
                setFailed(true);
        });
        return () => {
            cancelled = true;
            if (objectUrl)
                URL.revokeObjectURL(objectUrl);
        };
    }, [taskId, fileId, name, loadBlob]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape')
                return;
            event.stopPropagation();
            onClose();
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    const download = () => {
        if (blob == null)
            return;
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = name;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    };
    const ready = kind === 'text' ? text !== '' || blob != null : kind === 'docx' ? docx != null : kind === 'sheet' ? sheet != null : url != null;
    const unsupported = blob != null && kind === 'none';

    return createPortal(
        <div className="lh-preview" role="dialog" aria-modal="true" aria-label={name} onMouseDown={onClose}>
            <div className="lh-preview__frame" onMouseDown={(event) => event.stopPropagation()}>
                <header className="lh-preview__head">
                    <strong title={name}>{name}</strong>
                    <div>
                        <button type="button" onClick={download} disabled={blob == null}>{t('legalHub.taskFileDownload')}</button>
                        <button type="button" className="lh-preview__close" aria-label={t('legalHub.taskDrawerClose')} onClick={onClose}>×</button>
                    </div>
                </header>
                <div className={`lh-preview__body${kind === 'pdf' ? ' is-pdf' : ''}`}>
                    {failed ? <p>{t('legalHub.taskFilePreviewFail')}</p> : null}
                    {!failed && !ready && !unsupported ? <p>{t('legalHub.taskFilePreviewLoading')}</p> : null}
                    {!failed && unsupported ? <p>{t('legalHub.taskFilePreviewNone')}</p> : null}
                    {!failed && kind === 'image' && url ? <img src={url} alt={name} /> : null}
                    {!failed && kind === 'pdf' && url ? <iframe src={url} title={name} /> : null}
                    {!failed && kind === 'text' && blob ? <pre>{text}</pre> : null}
                    {!failed && kind === 'docx' && docx ? (
                        <PreviewBoundary fallback={<p>{t('legalHub.taskFilePreviewNone')}</p>}>
                            <Suspense fallback={<p>{t('legalHub.taskFilePreviewLoading')}</p>}>
                                <LegalHubDocxPreview bytes={docx} title={name} />
                            </Suspense>
                        </PreviewBoundary>
                    ) : null}
                    {!failed && kind === 'sheet' && sheet ? <SheetPreview bytes={sheet} loadingLabel={t('legalHub.taskFilePreviewLoading')} onFail={() => setFailed(true)} /> : null}
                </div>
            </div>
        </div>,
        document.body,
    );
}
