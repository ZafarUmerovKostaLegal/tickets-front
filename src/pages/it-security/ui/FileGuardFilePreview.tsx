import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AttachmentPreviewModel } from '@entities/expenses/lib/buildAttachmentPreview';

export type FileGuardPreviewState = {
    eventId: string;
    fileName: string;
    loading: boolean;
    error: string;
    model: AttachmentPreviewModel | null;
};

type FileGuardFilePreviewProps = {
    preview: FileGuardPreviewState | null;
    downloadError: string;
    onClose: () => void;
    onDownload: () => void;
};

export function FileGuardFilePreview({ preview, downloadError, onClose, onDownload }: FileGuardFilePreviewProps) {
    useEffect(() => {
        if (!preview)
            return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [preview, onClose]);

    if (!preview)
        return null;
    const { fileName, loading, error, model } = preview;
    return createPortal(
        <div className="its-preview" role="presentation" onClick={onClose}>
            <div
                className="its-preview__dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="its-preview-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="its-preview__head">
                    <h2 id="its-preview-title" className="its-preview__title">{fileName}</h2>
                    <button type="button" className="its-preview__close" onClick={onClose} aria-label="Закрыть просмотр">
                        ×
                    </button>
                </div>
                <div className="its-preview__body">
                    {loading ? <p className="its-preview__note">Открываем файл…</p> : null}
                    {!loading && error ? <p className="its-j__bad" role="alert">{error}</p> : null}
                    {!loading && !error && model?.type === 'image' ? (
                        <img src={model.objectUrl} alt="" className="its-preview__image" />
                    ) : null}
                    {!loading && !error && model?.type === 'pdf' ? (
                        <iframe title={fileName} src={model.objectUrl} className="its-preview__frame" />
                    ) : null}
                    {!loading && !error && model?.type === 'video' ? (
                        <video src={model.objectUrl} className="its-preview__media" controls />
                    ) : null}
                    {!loading && !error && model?.type === 'audio' ? (
                        <audio src={model.objectUrl} className="its-preview__audio" controls />
                    ) : null}
                    {!loading && !error && model?.type === 'text' ? (
                        <pre className="its-preview__text">{model.text}</pre>
                    ) : null}
                    {!loading && !error && model?.type === 'sheets' ? (
                        <div className="its-preview__sheets">
                            {model.truncatedNote ? <p className="its-preview__note">{model.truncatedNote}</p> : null}
                            {model.sheets.map((sheet) => (
                                <div key={sheet.name}>
                                    <p className="its-preview__sheet">{sheet.name}</p>
                                    <div className="its-preview__table-wrap">
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
                            ))}
                        </div>
                    ) : null}
                    {!loading && !error && model?.type === 'unsupported' ? (
                        <p className="its-preview__note">{model.hint}</p>
                    ) : null}
                </div>
                <div className="its-preview__foot">
                    {downloadError ? <span className="its-j__bad">{downloadError}</span> : null}
                    <button type="button" className="its-j__btn" onClick={onDownload} disabled={loading}>
                        Скачать файл
                    </button>
                    <button type="button" className="its-j__btn its-j__btn--accent" onClick={onClose}>
                        Закрыть
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
