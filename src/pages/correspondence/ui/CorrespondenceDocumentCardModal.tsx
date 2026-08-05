import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
    approveOutgoingCorrespondence,
    correspondenceErrorMessage,
    createCorrespondenceComment,
    downloadCorrespondenceAttachment,
    fetchCorrespondenceAttachmentBlob,
    fetchCorrespondenceDocument,
    formatCorrRegisteredAt,
    invalidateCorrespondencePartnerAttention,
    listCorrespondenceComments,
    rejectOutgoingCorrespondence,
    submitOutgoingForReview,
    type CorrespondenceAttachment,
    type CorrespondenceDocument,
    type CorrespondenceDocumentComment,
} from '@entities/correspondence';
import { useCurrentUser } from '@shared/hooks';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { useAppDialog } from '@shared/ui';
import {
    CORR_COUNTERPARTY_COLUMN,
    CORR_STATUS_BADGE,
    CORR_TYPE_BADGE,
} from '../model/constants';
import { CorrespondenceRejectModal } from './CorrespondenceRejectModal';
import { OutgoingSubmitReviewModal } from './OutgoingSubmitReviewModal';

export type CorrespondenceDocumentCardModalProps = {
    open: boolean;
    documentId: string | null;
    onClose: () => void;
    onArchived?: () => void;
    onChanged?: () => void;
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

function pickPrimaryAttachment(attachments: CorrespondenceAttachment[]): CorrespondenceAttachment | null {
    return attachments.find((a) => a.attachmentKind === 'scan')
        ?? attachments.find((a) => a.attachmentKind === 'attachment')
        ?? attachments[0]
        ?? null;
}

function resolvePreviewKind(file: CorrespondenceAttachment, contentType: string | null): 'pdf' | 'image' | 'other' {
    const ct = (contentType || file.contentType || '').toLowerCase();
    const name = file.fileName.toLowerCase();
    if (ct.includes('pdf') || name.endsWith('.pdf'))
        return 'pdf';
    if (ct.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name))
        return 'image';
    return 'other';
}

function userInitials(label: string): string {
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function formatCommentTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
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
    file,
    active,
    downloading,
    onSelect,
    onDownload,
}: {
    file: CorrespondenceAttachment;
    active: boolean;
    downloading: boolean;
    onSelect: () => void;
    onDownload: () => void;
}) {
    return (
        <li className={`corr-card-modal__file${active ? ' corr-card-modal__file--active' : ''}`}>
            <button type="button" className="corr-card-modal__file-select" onClick={onSelect} title="Показать предпросмотр">
                <span className="corr-card-modal__file-name" title={file.fileName}>{file.fileName}</span>
                <span className="corr-card-modal__file-size">{formatBytes(file.sizeBytes)}</span>
            </button>
            <button
                type="button"
                className="corr-card-modal__file-btn"
                disabled={downloading}
                onClick={onDownload}
            >
                {downloading ? '…' : 'Скачать'}
            </button>
        </li>
    );
}

export function CorrespondenceDocumentCardModal({
    open,
    documentId,
    onClose,
    onChanged,
}: CorrespondenceDocumentCardModalProps) {
    const titleId = useId();
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const [doc, setDoc] = useState<CorrespondenceDocument | null>(null);
    const [loading, setLoading] = useState(false);
    const [acting, setActing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [resubmitOpen, setResubmitOpen] = useState(false);
    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewKind, setPreviewKind] = useState<'pdf' | 'image' | 'other' | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [comments, setComments] = useState<CorrespondenceDocumentComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState<string | null>(null);
    const [commentDraft, setCommentDraft] = useState('');
    const [commentSending, setCommentSending] = useState(false);
    const commentsFeedRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open || !documentId) {
            setDoc(null);
            setError(null);
            setFileError(null);
            setLoading(false);
            setRejectOpen(false);
            setResubmitOpen(false);
            setActiveFileId(null);
            setPreviewUrl(null);
            setPreviewKind(null);
            setPreviewError(null);
            setComments([]);
            setCommentsError(null);
            setCommentDraft('');
            setCommentSending(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        setDoc(null);
        setActiveFileId(null);
        setComments([]);
        setCommentsError(null);
        setCommentDraft('');
        void fetchCorrespondenceDocument(documentId)
            .then((d) => {
                if (cancelled)
                    return;
                setDoc(d);
                const primary = pickPrimaryAttachment(d.attachments ?? []);
                setActiveFileId(primary?.id ?? null);
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
        if (!open || !documentId) {
            setComments([]);
            setCommentsLoading(false);
            setCommentsError(null);
            return;
        }
        let cancelled = false;
        setCommentsLoading(true);
        setCommentsError(null);
        void listCorrespondenceComments(documentId)
            .then((items) => {
                if (!cancelled)
                    setComments(items);
            })
            .catch((err) => {
                if (!cancelled)
                    setCommentsError(correspondenceErrorMessage(err, 'Не удалось загрузить комментарии'));
            })
            .finally(() => {
                if (!cancelled)
                    setCommentsLoading(false);
            });
        return () => { cancelled = true; };
    }, [open, documentId]);

    useEffect(() => {
        const el = commentsFeedRef.current;
        if (!el)
            return;
        el.scrollTop = el.scrollHeight;
    }, [comments.length, commentsLoading]);

    useEffect(() => {
        if (!open || !documentId || !activeFileId || !doc) {
            setPreviewUrl((prev) => {
                if (prev)
                    URL.revokeObjectURL(prev);
                return null;
            });
            setPreviewKind(null);
            setPreviewError(null);
            setPreviewLoading(false);
            return;
        }
        const file = (doc.attachments ?? []).find((a) => a.id === activeFileId);
        if (!file)
            return;

        let cancelled = false;
        let objectUrl: string | null = null;
        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewUrl((prev) => {
            if (prev)
                URL.revokeObjectURL(prev);
            return null;
        });
        setPreviewKind(null);

        void fetchCorrespondenceAttachmentBlob(documentId, file.id)
            .then(({ blob, contentType }) => {
                if (cancelled)
                    return;
                const kind = resolvePreviewKind(file, contentType);
                const typedBlob = kind === 'pdf' && blob.type !== 'application/pdf'
                    ? new Blob([blob], { type: 'application/pdf' })
                    : blob;
                objectUrl = URL.createObjectURL(typedBlob);
                setPreviewKind(kind);
                setPreviewUrl(objectUrl);
            })
            .catch((err) => {
                if (!cancelled)
                    setPreviewError(err instanceof Error ? err.message : 'Не удалось загрузить файл');
            })
            .finally(() => {
                if (!cancelled)
                    setPreviewLoading(false);
            });

        return () => {
            cancelled = true;
            if (objectUrl)
                URL.revokeObjectURL(objectUrl);
        };
    }, [open, documentId, activeFileId, doc]);

    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !acting && !rejectOpen && !resubmitOpen) {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose, acting, rejectOpen, resubmitOpen]);

    if (!open || !documentId)
        return null;

    const counterpartyLabel = doc ? CORR_COUNTERPARTY_COLUMN[doc.direction] : 'Контрагент';
    const typeBadge = doc ? CORR_TYPE_BADGE[doc.docType] : null;
    const statusBadge = doc ? CORR_STATUS_BADGE[doc.status] : null;
    const attachments = doc?.attachments ?? [];
    const activeFile = attachments.find((a) => a.id === activeFileId) ?? null;
    const uid = user?.id != null ? Number(user.id) : null;
    const canPartnerAct = Boolean(
        doc
        && doc.direction === 'outgoing'
        && doc.status === 'pending_review'
        && uid != null
        && doc.partnerUserId === uid
        && isPartnerOrgRole(user?.role, user?.position),
    );
    const canAuthorResubmit = Boolean(
        doc
        && doc.direction === 'outgoing'
        && doc.status === 'rejected'
        && uid != null
        && doc.responsibleUserId === uid,
    );

    const refresh = async (next: CorrespondenceDocument) => {
        setDoc(next);
        onChanged?.();
    };

    const handleApprove = async () => {
        if (!doc)
            return;
        const ok = await showConfirm({
            title: 'Подтвердить письмо?',
            message: 'После подтверждения документ будет зарегистрирован в реестре исходящих.',
        });
        if (!ok)
            return;
        setActing(true);
        try {
            const next = await approveOutgoingCorrespondence(doc.id);
            await refresh(next);
            invalidateCorrespondencePartnerAttention();
            void showAlert({
                title: 'Зарегистрировано',
                message: `Письмо зарегистрировано как ${next.registryNumber}.`,
            });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось подтвердить',
                message: correspondenceErrorMessage(err, 'Ошибка подтверждения'),
            });
        }
        finally {
            setActing(false);
        }
    };

    const handleReject = async (comment: string) => {
        if (!doc)
            return;
        setActing(true);
        try {
            const next = await rejectOutgoingCorrespondence(doc.id, comment);
            await refresh(next);
            invalidateCorrespondencePartnerAttention();
            setRejectOpen(false);
            void showAlert({ title: 'Отклонено', message: 'Заявитель получит уведомление с комментарием.' });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось отклонить',
                message: correspondenceErrorMessage(err, 'Ошибка отклонения'),
            });
        }
        finally {
            setActing(false);
        }
    };

    const handleResubmit = async (partnerUserId: number, _partnerName: string) => {
        if (!doc)
            return;
        setActing(true);
        try {
            const next = await submitOutgoingForReview(doc.id, partnerUserId);
            await refresh(next);
            invalidateCorrespondencePartnerAttention();
            setResubmitOpen(false);
            void showAlert({ title: 'Отправлено', message: 'Письмо снова отправлено на проверку партнёру.' });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось отправить',
                message: correspondenceErrorMessage(err, 'Ошибка повторной отправки'),
            });
        }
        finally {
            setActing(false);
        }
    };

    const handleDownload = async (file: CorrespondenceAttachment) => {
        if (!doc)
            return;
        setDownloadingId(file.id);
        setFileError(null);
        try {
            await downloadCorrespondenceAttachment(doc.id, file.id, file.fileName);
        }
        catch (err) {
            setFileError(err instanceof Error ? err.message : 'Не удалось скачать файл');
        }
        finally {
            setDownloadingId(null);
        }
    };

    const handleSendComment = async () => {
        if (!doc || !documentId)
            return;
        const text = commentDraft.trim();
        if (!text || commentSending)
            return;
        setCommentSending(true);
        setCommentsError(null);
        try {
            const created = await createCorrespondenceComment(documentId, text);
            setComments((prev) => [...prev, created]);
            setCommentDraft('');
        }
        catch (err) {
            setCommentsError(correspondenceErrorMessage(err, 'Не удалось отправить комментарий'));
        }
        finally {
            setCommentSending(false);
        }
    };

    const previewTitle = activeFile
        ? activeFile.fileName
        : (doc?.registryNumber || doc?.subject || 'Документ');

    return createPortal(
        <div
            className="corr-modal corr-modal--enter corr-card-modal"
            role="presentation"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !acting)
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
                <header className="corr-modal__head corr-card-modal__head">
                    <div className="corr-card-modal__head-text">
                        <h2 id={titleId} className="corr-modal__title">Карточка документа</h2>
                        {doc ? (
                            <p className="corr-modal__lead corr-card-modal__lead">
                                <span className="corr-card-modal__mono">
                                    {doc.registryNumber || CORR_STATUS_BADGE[doc.status]?.label || '—'}
                                </span>
                                {' · '}
                                {doc.direction === 'incoming' ? 'Входящее' : 'Исходящее'}
                                {doc.subject ? ` · ${doc.subject}` : ''}
                            </p>
                        ) : null}
                    </div>
                    <button type="button" className="corr-modal__close" onClick={onClose} aria-label="Закрыть" disabled={acting}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </header>

                {loading ? (
                    <div className="corr-card-modal__loading" aria-busy="true">
                        <div className="corr-card-modal__preview corr-card-modal__preview--loading">
                            <span className="corr-skel__bone corr-card-modal__preview-skel" />
                        </div>
                        <div className="corr-card-modal__side">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="corr-card-modal__skel-row">
                                    <span className="corr-skel__bone corr-card-modal__skel-label" />
                                    <span className="corr-skel__bone corr-card-modal__skel-value" style={{ width: `${48 + (i % 3) * 14}%` }} />
                                </div>
                            ))}
                        </div>
                        <div className="corr-card-modal__comments corr-card-modal__comments--loading">
                            <span className="corr-skel__bone" style={{ height: '1rem', width: '40%' }} />
                            <span className="corr-skel__bone" style={{ height: '4rem', width: '100%' }} />
                            <span className="corr-skel__bone" style={{ height: '4rem', width: '85%' }} />
                        </div>
                    </div>
                ) : null}

                {error ? <p className="corr-modal__err corr-card-modal__err" role="alert">{error}</p> : null}

                {doc && !loading ? (
                    <div className="corr-card-modal__layout">
                        <section className="corr-card-modal__preview" aria-label="Предпросмотр документа">
                            {previewLoading ? (
                                <div className="corr-card-modal__preview-msg" role="status">Загрузка документа…</div>
                            ) : null}
                            {!previewLoading && previewError ? (
                                <div className="corr-card-modal__preview-msg corr-card-modal__preview-msg--err" role="alert">
                                    {previewError}
                                </div>
                            ) : null}
                            {!previewLoading && !previewError && !activeFile ? (
                                <div className="corr-card-modal__preview-msg">Вложения отсутствуют</div>
                            ) : null}
                            {!previewLoading && !previewError && previewUrl && previewKind === 'pdf' ? (
                                <iframe
                                    className="corr-card-modal__iframe"
                                    src={`${previewUrl}#toolbar=1`}
                                    title={previewTitle}
                                />
                            ) : null}
                            {!previewLoading && !previewError && previewUrl && previewKind === 'image' ? (
                                <img className="corr-card-modal__img" src={previewUrl} alt={previewTitle} />
                            ) : null}
                            {!previewLoading && !previewError && previewUrl && previewKind === 'other' && activeFile ? (
                                <div className="corr-card-modal__preview-msg">
                                    <p>Предпросмотр для этого типа файла недоступен.</p>
                                    <button
                                        type="button"
                                        className="corr-modal__btn corr-modal__btn--primary"
                                        disabled={downloadingId === activeFile.id}
                                        onClick={() => void handleDownload(activeFile)}
                                    >
                                        Скачать {activeFile.fileName}
                                    </button>
                                </div>
                            ) : null}
                        </section>

                        <aside className="corr-card-modal__side">
                            <dl className="corr-card-modal__grid">
                                <DetailRow label="Номер реестра">
                                    <span className="corr-card-modal__mono">{doc.registryNumber || '—'}</span>
                                </DetailRow>
                                <DetailRow label={counterpartyLabel}>{doc.counterparty || '—'}</DetailRow>
                                {doc.partnerUser ? (
                                    <DetailRow label="Партнёр">
                                        {userLabel(doc.partnerUser.displayName, doc.partnerUser.email, doc.partnerUser.id)}
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
                                        <span className="corr-card-modal__note-text">{doc.comment}</span>
                                    </DetailRow>
                                ) : null}
                                {doc.rejectionComment ? (
                                    <DetailRow label="Комментарий отказа">
                                        <span className="corr-card-modal__note-text">{doc.rejectionComment}</span>
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
                                                file={file}
                                                active={file.id === activeFileId}
                                                downloading={downloadingId === file.id}
                                                onSelect={() => {
                                                    setFileError(null);
                                                    setActiveFileId(file.id);
                                                }}
                                                onDownload={() => void handleDownload(file)}
                                            />
                                        ))}
                                    </ul>
                                </section>
                            ) : (
                                <p className="corr-card-modal__no-files">Вложения отсутствуют</p>
                            )}

                            {fileError ? <p className="corr-modal__err" role="alert">{fileError}</p> : null}
                        </aside>

                        <section className="corr-card-modal__comments" aria-label="Комментарии">
                            <h3 className="corr-card-modal__comments-title">
                                Комментарии
                                {comments.length > 0 ? ` (${comments.length})` : ''}
                            </h3>
                            <div ref={commentsFeedRef} className="corr-card-modal__comments-feed">
                                {commentsLoading ? (
                                    <p className="corr-card-modal__comments-empty">Загрузка…</p>
                                ) : null}
                                {!commentsLoading && comments.length === 0 ? (
                                    <p className="corr-card-modal__comments-empty">
                                        Пока нет сообщений. Напишите первый комментарий.
                                    </p>
                                ) : null}
                                {!commentsLoading
                                    ? comments.map((cm) => {
                                        const author = userLabel(
                                            cm.authorUser?.displayName,
                                            cm.authorUser?.email,
                                            cm.authorUserId,
                                        );
                                        const mine = uid != null && cm.authorUserId === uid;
                                        return (
                                            <article
                                                key={cm.id}
                                                className={`corr-card-modal__comment${mine ? ' corr-card-modal__comment--mine' : ''}`}
                                            >
                                                <div className="corr-card-modal__comment-avatar" aria-hidden title={author}>
                                                    {userInitials(author)}
                                                </div>
                                                <div className="corr-card-modal__comment-body">
                                                    <p className="corr-card-modal__comment-text">{cm.body}</p>
                                                    <span className="corr-card-modal__comment-meta">
                                                        {author}
                                                        {' · '}
                                                        {formatCommentTime(cm.createdAt)}
                                                    </span>
                                                </div>
                                            </article>
                                        );
                                    })
                                    : null}
                            </div>
                            {commentsError ? (
                                <p className="corr-modal__err corr-card-modal__comments-err" role="alert">{commentsError}</p>
                            ) : null}
                            <div className="corr-card-modal__comment-compose">
                                <textarea
                                    className="corr-card-modal__comment-input"
                                    rows={2}
                                    maxLength={4000}
                                    placeholder="Написать комментарий…"
                                    value={commentDraft}
                                    disabled={commentSending || acting}
                                    onChange={(e) => setCommentDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            void handleSendComment();
                                        }
                                    }}
                                    aria-label="Текст комментария"
                                />
                                <button
                                    type="button"
                                    className="corr-card-modal__comment-send"
                                    disabled={commentSending || !commentDraft.trim() || acting}
                                    onClick={() => void handleSendComment()}
                                    aria-label="Отправить комментарий"
                                >
                                    {commentSending ? '…' : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                            <line x1="22" y1="2" x2="11" y2="13"/>
                                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </section>
                    </div>
                ) : null}

                <div className="corr-modal__actions">
                    {canPartnerAct ? (
                        <>
                            <button
                                type="button"
                                className="corr-modal__btn corr-modal__btn--ghost"
                                disabled={acting}
                                onClick={() => setRejectOpen(true)}
                            >
                                Отклонить
                            </button>
                            <button
                                type="button"
                                className="corr-modal__btn corr-modal__btn--primary"
                                disabled={acting}
                                onClick={() => void handleApprove()}
                            >
                                {acting ? '…' : 'Подтвердить'}
                            </button>
                        </>
                    ) : null}
                    {canAuthorResubmit ? (
                        <button
                            type="button"
                            className="corr-modal__btn corr-modal__btn--primary"
                            disabled={acting}
                            onClick={() => setResubmitOpen(true)}
                        >
                            Отправить повторно
                        </button>
                    ) : null}
                    {activeFile && previewUrl ? (
                        <button
                            type="button"
                            className="corr-modal__btn corr-modal__btn--ghost"
                            disabled={downloadingId === activeFile.id}
                            onClick={() => void handleDownload(activeFile)}
                        >
                            Скачать файл
                        </button>
                    ) : null}
                    <button type="button" className="corr-modal__btn corr-modal__btn--primary" onClick={onClose} disabled={acting}>
                        Закрыть
                    </button>
                </div>
            </div>
            <CorrespondenceRejectModal
                open={rejectOpen}
                onClose={() => { if (!acting) setRejectOpen(false); }}
                onConfirm={(comment) => { void handleReject(comment); }}
                submitPending={acting}
            />
            <OutgoingSubmitReviewModal
                open={resubmitOpen}
                nested
                onClose={() => { if (!acting) setResubmitOpen(false); }}
                onSubmit={(partnerUserId, partnerName) => { void handleResubmit(partnerUserId, partnerName); }}
                submitPending={acting}
            />
        </div>,
        document.body,
    );
}
