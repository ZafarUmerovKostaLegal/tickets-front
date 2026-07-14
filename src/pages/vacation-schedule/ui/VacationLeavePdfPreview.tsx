import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchVacationLeaveRequestPdfBlob, type VacationLeaveRequestApi } from '@entities/vacation';
import './VacationDocLightbox.css';

type Props = {
    request: VacationLeaveRequestApi;
    onClose: () => void;
};

export function VacationLeavePdfPreview({ request, onClose }: Props) {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);
    const filename = `leave_request_${request.id}.pdf`;
    const title = `Заявка #${request.id} · PDF`;

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setUrl(null);
        void fetchVacationLeaveRequestPdfBlob(request.id)
            .then((blob) => {
                if (cancelled)
                    return;
                const pdfBlob = blob.type === 'application/pdf'
                    ? blob
                    : new Blob([blob], { type: 'application/pdf' });
                const objectUrl = URL.createObjectURL(pdfBlob);
                objectUrlRef.current = objectUrl;
                setUrl(objectUrl);
            })
            .catch((e: unknown) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Не удалось загрузить PDF');
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => {
            cancelled = true;
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
        };
    }, [request.id]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey, true);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    const handleDownload = () => {
        if (!url)
            return;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    return createPortal(
        <div
            className="vac-doc-lb"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
        >
            <div className="vac-doc-lb__frame vac-doc-lb__frame--pdf" onClick={(e) => e.stopPropagation()}>
                <div className="vac-doc-lb__head">
                    <span className="vac-doc-lb__title" title={title}>{title}</span>
                    <div className="vac-doc-lb__actions">
                        <button
                            type="button"
                            className="vac-doc-lb__btn"
                            onClick={handleDownload}
                            disabled={!url}
                            title="Скачать PDF"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Скачать
                        </button>
                        <button type="button" className="vac-doc-lb__close" onClick={onClose} aria-label="Закрыть">
                            ×
                        </button>
                    </div>
                </div>
                <div className="vac-doc-lb__body">
                    {loading && <div className="vac-doc-lb__msg">Загрузка PDF…</div>}
                    {error && <div className="vac-doc-lb__msg vac-doc-lb__msg--err">{error}</div>}
                    {!loading && !error && url && (
                        <iframe className="vac-doc-lb__iframe" src={`${url}#toolbar=1`} title={title} />
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
