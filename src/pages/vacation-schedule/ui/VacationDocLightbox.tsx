import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchVacationManualEntryDocumentBlob } from '@entities/vacation';
import './VacationDocLightbox.css';

export type VacationDocLightboxTarget = {
    entryId: number;
    docId: number;
    filename: string;
    contentType?: string;
};

type Props = VacationDocLightboxTarget & {
    onClose: () => void;
};

type PreviewKind = 'image' | 'pdf' | 'text' | 'none';

function extOf(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function previewKind(filename: string, contentType?: string): PreviewKind {
    const ext = extOf(filename);
    const ct = (contentType ?? '').toLowerCase();
    if (ct.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'].includes(ext))
        return 'image';
    if (ct === 'application/pdf' || ext === 'pdf')
        return 'pdf';
    if (ct.startsWith('text/') || ext === 'txt')
        return 'text';
    return 'none';
}

export function VacationDocLightbox({ entryId, docId, filename, contentType, onClose }: Props) {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const blobRef = useRef<Blob | null>(null);
    const kind = useMemo(() => previewKind(filename, contentType), [filename, contentType]);

    useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;
        setLoading(true);
        setError(null);
        setUrl(null);
        void fetchVacationManualEntryDocumentBlob(entryId, docId)
            .then((blob) => {
                if (cancelled)
                    return;
                blobRef.current = blob;
                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            })
            .catch((e: unknown) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Не удалось загрузить документ');
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => {
            cancelled = true;
            if (objectUrl)
                URL.revokeObjectURL(objectUrl);
        };
    }, [entryId, docId]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    const handleDownload = () => {
        if (!url)
            return;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'document';
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    return createPortal(
        <div className="vac-doc-lb" role="dialog" aria-modal="true" aria-label={`Документ ${filename}`} onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <div className="vac-doc-lb__frame" onClick={(e) => e.stopPropagation()}>
                <div className="vac-doc-lb__head">
                    <span className="vac-doc-lb__title" title={filename}>{filename}</span>
                    <div className="vac-doc-lb__actions">
                        <button type="button" className="vac-doc-lb__btn" onClick={handleDownload} disabled={!url} title="Скачать">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Скачать
                        </button>
                        <button type="button" className="vac-doc-lb__close" onClick={onClose} aria-label="Закрыть">×</button>
                    </div>
                </div>
                <div className="vac-doc-lb__body">
                    {loading && <div className="vac-doc-lb__msg">Загрузка…</div>}
                    {error && <div className="vac-doc-lb__msg vac-doc-lb__msg--err">{error}</div>}
                    {!loading && !error && url && (
                        kind === 'image' ? (
                            <img className="vac-doc-lb__img" src={url} alt={filename} />
                        ) : kind === 'pdf' || kind === 'text' ? (
                            <iframe className="vac-doc-lb__iframe" src={url} title={filename} />
                        ) : (
                            <div className="vac-doc-lb__msg">
                                Предпросмотр для этого типа файла недоступен.
                                <br />
                                Используйте кнопку «Скачать», чтобы открыть документ.
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
