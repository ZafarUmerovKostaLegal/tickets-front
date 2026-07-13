import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
    correspondenceErrorMessage,
    fetchCorrespondenceDocument,
    formatCorrRegisteredAt,
    openCorrespondenceAttachmentInNewTab,
    type CorrespondenceAttachment,
    type CorrespondenceDocument,
} from '@entities/correspondence';
import {
    CORR_COUNTERPARTY_COLUMN,
    CORR_STATUS_BADGE,
    CORR_TYPE_BADGE,
} from '../model/constants';

export type CorrespondenceDocumentCardModalProps = {
    open: boolean;
    documentId: string | null;
    onClose: () => void;
    onArchived?: () => void;
};

function formatBytes(bytes: number): string {
    if (bytes <= 0)
        return '—';
    if (bytes >= 1048576)
        return `${(bytes / 1048576).toFixed(1)} МБ`;
    return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function userLabel(name: string | null | undefined, email: string | null | undefined, id: number): string {
    return name?.trim() || email?.trim() || `User #${id}`;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="corr-card-modal__row">
            <dt className="corr-card-modal__label">{label}</dt>
            <dd className="corr-card-modal__value">{children}</dd>
        </div>
    );
}

function AttachmentRow({
    docId,
    file,
    onOpenError,
}: {
    docId: string;
    file: CorrespondenceAttachment;
    onOpenError: (msg: string) => void;
}) {
    const [opening, setOpening] = useState(false);

    const open = async () => {
        setOpening(true);
        try {
            await openCorrespondenceAttachmentInNewTab(docId, file.id);
        }
        catch (err) {
            onOpenError(err instanceof Error ? err.message : 'Не удалось открыть файл');
        }
        finally {
            setOpening(false);
        }
    };

    return (
        <li className="corr-card-modal__file">
            <div className="corr-card-modal__file-meta">
                <span className="corr-card-modal__file-name" title={file.fileName}>{file.fileName}</span>
                <span className="corr-card-modal__file-size">{formatBytes(file.sizeBytes)}</span>
            </div>
            <button
                type="button"
                className="corr-card-modal__file-btn"
                disabled={opening}
                onClick={() => void open()}
            >
                {opening ? 'Открытие…' : 'Открыть'}
            </button>
        </li>
    );
}

export function CorrespondenceDocumentCardModal({
    open,
    documentId,
    onClose,
}: CorrespondenceDocumentCardModalProps) {
    const titleId = useId();
    const [doc, setDoc] = useState<CorrespondenceDocument | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !documentId) {
            setDoc(null);
            setError(null);
            setFileError(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        setDoc(null);
        void fetchCorrespondenceDocument(documentId)
            .then((d) => {
                if (!cancelled)
                    setDoc(d);
            })
            .catch((err) => {
                if (!cancelled)
                    setError(correspondenceErrorMessage(err, 'Не удалось загрузить карточку'));
            })
            .finally(() => {
                if (!cancelled)
                    setLoading(false);
            });
        return () => { cancelled = true; };
    }, [open, documentId]);

    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open || !documentId)
        return null;

    const counterpartyLabel = doc ? CORR_COUNTERPARTY_COLUMN[doc.direction] : 'Контрагент';
    const typeBadge = doc ? CORR_TYPE_BADGE[doc.docType] : null;
    const statusBadge = doc ? CORR_STATUS_BADGE[doc.status] : null;
    const attachments = doc?.attachments ?? [];

    return createPortal(
        <div
            className="corr-modal corr-modal--enter"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget)
                    onClose();
            }}
        >
            <div
                className="corr-modal__panel corr-card-modal__panel"
                role="dialog"
                aria-modal
                aria-labelledby={titleId}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="corr-modal__head">
                    <div className="corr-card-modal__head-text">
                        <h2 id={titleId} className="corr-modal__title">Карточка документа</h2>
                        {doc ? (
                            <p className="corr-modal__lead corr-card-modal__lead">
                                <span className="corr-card-modal__mono">{doc.registryNumber}</span>
                                {' · '}
                                {doc.direction === 'incoming' ? 'Входящее' : 'Исходящее'}
                            </p>
                        ) : null}
                    </div>
                    <button type="button" className="corr-modal__close" onClick={onClose} aria-label="Закрыть">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </header>

                {loading ? (
                    <div className="corr-card-modal__loading" aria-busy="true">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="corr-card-modal__skel-row">
                                <span className="corr-skel__bone corr-card-modal__skel-label" />
                                <span className="corr-skel__bone corr-card-modal__skel-value" style={{ width: `${48 + (i % 3) * 14}%` }} />
                            </div>
                        ))}
                    </div>
                ) : null}

                {error ? <p className="corr-modal__err corr-card-modal__err" role="alert">{error}</p> : null}

                {doc && !loading ? (
                    <div className="corr-card-modal__body">
                        <dl className="corr-card-modal__grid">
                            <DetailRow label="Номер реестра">
                                <span className="corr-card-modal__mono">{doc.registryNumber}</span>
                            </DetailRow>
                            <DetailRow label={counterpartyLabel}>{doc.counterparty || '—'}</DetailRow>
                            {doc.direction === 'incoming' ? (
                                <DetailRow label="Партнёр">
                                    {doc.partnerUser
                                        ? userLabel(doc.partnerUser.displayName, doc.partnerUser.email, doc.partnerUser.id)
                                        : '—'}
                                </DetailRow>
                            ) : null}
                            <DetailRow label="Тема">{doc.subject || '—'}</DetailRow>
                            <DetailRow label="Тип">
                                {typeBadge ? <span className={typeBadge.className}>{typeBadge.label}</span> : '—'}
                            </DetailRow>
                            <DetailRow label="Статус">
                                {statusBadge ? <span className={statusBadge.className}>{statusBadge.label}</span> : '—'}
                            </DetailRow>
                            <DetailRow label="Дата регистрации">
                                {formatCorrRegisteredAt(doc.registeredAt)}
                            </DetailRow>
                            <DetailRow label="Ответственный">
                                {doc.responsibleUser
                                    ? userLabel(doc.responsibleUser.displayName, doc.responsibleUser.email, doc.responsibleUser.id)
                                    : '—'}
                            </DetailRow>
                            {doc.comment ? (
                                <DetailRow label="Комментарий">
                                    <span className="corr-card-modal__comment">{doc.comment}</span>
                                </DetailRow>
                            ) : null}
                        </dl>

                        {attachments.length > 0 ? (
                            <section className="corr-card-modal__files" aria-label="Вложения">
                                <h3 className="corr-card-modal__files-title">Вложения ({attachments.length})</h3>
                                <ul className="corr-card-modal__files-list">
                                    {attachments.map((file) => (
                                        <AttachmentRow
                                            key={file.id}
                                            docId={doc.id}
                                            file={file}
                                            onOpenError={setFileError}
                                        />
                                    ))}
                                </ul>
                            </section>
                        ) : (
                            <p className="corr-card-modal__no-files">Вложения отсутствуют</p>
                        )}

                        {fileError ? <p className="corr-modal__err" role="alert">{fileError}</p> : null}
                    </div>
                ) : null}

                <div className="corr-modal__actions corr-modal__actions--solo">
                    <button type="button" className="corr-modal__btn corr-modal__btn--primary" onClick={onClose}>
                        Закрыть
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
