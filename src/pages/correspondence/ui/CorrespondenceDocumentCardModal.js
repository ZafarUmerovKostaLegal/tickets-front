import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { acknowledgeIncomingCorrespondence, approveOutgoingCorrespondence, correspondenceErrorMessage, createCorrespondenceComment, downloadCorrespondenceAttachment, fetchCorrespondenceAttachmentPreviewBlob, fetchCorrespondenceDocument, formatCorrRegisteredAt, invalidateCorrespondencePartnerAttention, listCorrespondenceComments, rejectOutgoingCorrespondence, submitOutgoingForReview, uploadCorrespondenceAttachment, } from '@entities/correspondence';
import { useCurrentUser } from '@shared/hooks';
import { isPartnerOrgRole } from '@shared/lib/orgRoles';
import { showToast, useAppDialog } from '@shared/ui';
import { CORR_COUNTERPARTY_COLUMN, CORR_SCAN_MAX_BYTES, CORR_STATUS_BADGE, CORR_TYPE_BADGE, } from '../model/constants';
import { canDeleteCorrespondence } from '../model/permissions';
import { CorrespondenceRejectModal } from './CorrespondenceRejectModal';
import { OutgoingSubmitReviewModal } from './OutgoingSubmitReviewModal';
function formatBytes(bytes) {
    if (bytes <= 0)
        return '—';
    if (bytes >= 1048576)
        return `${(bytes / 1048576).toFixed(1)} МБ`;
    return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}
function userLabel(name, email, id) {
    return name?.trim() || email?.trim() || `User #${id}`;
}
function isPdfAttachment(file) {
    const ct = (file.contentType || '').toLowerCase();
    return ct.includes('pdf') || file.fileName.toLowerCase().endsWith('.pdf');
}
function pickPrimaryAttachment(attachments) {
    const signed = attachments.find((a) => a.attachmentKind === 'signed');
    if (signed)
        return signed;
    const pdf = attachments.find((a) => isPdfAttachment(a));
    if (pdf)
        return pdf;
    return attachments.find((a) => a.attachmentKind === 'scan')
        ?? attachments.find((a) => a.attachmentKind === 'attachment')
        ?? attachments[0]
        ?? null;
}
function resolvePreviewKind(file, contentType) {
    const ct = (contentType || file.contentType || '').toLowerCase();
    const name = file.fileName.toLowerCase();
    if (ct.includes('pdf') || name.endsWith('.pdf'))
        return 'pdf';
    if (ct.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name))
        return 'image';
    return 'other';
}
function userInitials(label) {
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}
function formatCommentTime(iso) {
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
function DetailRow({ label, children }) {
    return (_jsxs("div", { className: "corr-card-modal__row", children: [_jsx("dt", { className: "corr-card-modal__label", children: label }), _jsx("dd", { className: "corr-card-modal__value", children: children })] }));
}
function MetaPerson({ name, email, id }) {
    const label = userLabel(name, email, id);
    return (_jsxs("span", { className: "corr-card-modal__person", children: [_jsx("span", { className: "corr-card-modal__person-avatar", "aria-hidden": true, children: userInitials(label) }), _jsx("span", { className: "corr-card-modal__person-name", children: label })] }));
}
function AttachmentRow({ file, active, downloading, onSelect, onDownload, }) {
    return (_jsxs("li", { className: `corr-card-modal__file${active ? ' corr-card-modal__file--active' : ''}`, children: [_jsxs("button", { type: "button", className: "corr-card-modal__file-select", onClick: onSelect, title: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440", children: [_jsx("span", { className: "corr-card-modal__file-name", title: file.fileName, children: file.fileName }), _jsx("span", { className: "corr-card-modal__file-size", children: formatBytes(file.sizeBytes) })] }), _jsx("button", { type: "button", className: "corr-card-modal__file-btn", disabled: downloading, onClick: onDownload, children: downloading ? '…' : 'Скачать' })] }));
}
export function CorrespondenceDocumentCardModal({ open, documentId, onClose, onChanged, }) {
    const titleId = useId();
    const { user } = useCurrentUser();
    const { showAlert, showConfirm } = useAppDialog();
    const [doc, setDoc] = useState(null);
    const [loading, setLoading] = useState(false);
    const [acting, setActing] = useState(false);
    const [error, setError] = useState(null);
    const [fileError, setFileError] = useState(null);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [resubmitOpen, setResubmitOpen] = useState(false);
    const [activeFileId, setActiveFileId] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewKind, setPreviewKind] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState(null);
    const [commentDraft, setCommentDraft] = useState('');
    const [commentSending, setCommentSending] = useState(false);
    const [uploadingSigned, setUploadingSigned] = useState(false);
    const commentsFeedRef = useRef(null);
    const signedFileRef = useRef(null);
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
        let objectUrl = null;
        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewUrl((prev) => {
            if (prev)
                URL.revokeObjectURL(prev);
            return null;
        });
        setPreviewKind(null);
        void fetchCorrespondenceAttachmentPreviewBlob(documentId, file.id)
            .then(({ blob, contentType }) => {
            if (cancelled)
                return;
            const kind = resolvePreviewKind(file, contentType);
            const previewAsPdf = kind === 'pdf' || (contentType || '').toLowerCase().includes('pdf');
            const resolvedKind = previewAsPdf ? 'pdf' : kind;
            const typedBlob = resolvedKind === 'pdf'
                ? new Blob([blob], { type: 'application/pdf' })
                : blob;
            objectUrl = URL.createObjectURL(typedBlob);
            setPreviewKind(resolvedKind);
            setPreviewUrl(objectUrl);
        })
            .catch((err) => {
            if (!cancelled)
                setPreviewError(correspondenceErrorMessage(err, 'Не удалось загрузить предпросмотр'));
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
        const onKey = (e) => {
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
    const canPartnerAct = Boolean(doc
        && doc.direction === 'outgoing'
        && doc.status === 'pending_review'
        && uid != null
        && doc.partnerUserId === uid
        && isPartnerOrgRole(user?.role, user?.position));
    const canAcknowledgeIncoming = Boolean(doc
        && doc.direction === 'incoming'
        && (doc.status === 'new' || doc.status === 'progress')
        && uid != null
        && doc.partnerUserId === uid
        && isPartnerOrgRole(user?.role, user?.position));
    const canAuthorResubmit = Boolean(doc
        && doc.direction === 'outgoing'
        && doc.status === 'rejected'
        && uid != null
        && doc.responsibleUserId === uid);
    const canUploadSigned = Boolean(doc
        && doc.direction === 'outgoing'
        && doc.status === 'awaiting_signature'
        && uid != null
        && (doc.responsibleUserId === uid || canDeleteCorrespondence(user?.role, user?.position)));
    const refresh = async (next) => {
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
                title: 'Одобрено',
                message: `Письмо зарегистрировано как ${next.registryNumber}. Распечатайте, подпишите и загрузите скан в карточку.`,
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
    const handleAcknowledgeIncoming = async () => {
        if (!doc)
            return;
        const ok = await showConfirm({
            title: 'Отметить полученным?',
            message: 'Статус сменится на «Получено», документ исчезнет из очереди «Нужно посмотреть».',
        });
        if (!ok)
            return;
        setActing(true);
        try {
            const next = await acknowledgeIncomingCorrespondence(doc.id);
            await refresh(next);
            invalidateCorrespondencePartnerAttention();
            showToast({ message: 'Отмечено как полученное', variant: 'success' });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось отметить',
                message: correspondenceErrorMessage(err, 'Ошибка обновления статуса'),
            });
        }
        finally {
            setActing(false);
        }
    };
    const handleReject = async (comment) => {
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
    const handleResubmit = async (partnerUserId, _partnerName) => {
        if (!doc)
            return;
        setActing(true);
        try {
            const next = await submitOutgoingForReview(doc.id, partnerUserId);
            await refresh(next);
            invalidateCorrespondencePartnerAttention();
            setResubmitOpen(false);
            void showAlert({ title: 'Отправлено', message: 'Письмо снова отправлено на согласование партнёру.' });
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
    const handleDownload = async (file) => {
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
    const handleUploadSigned = async (file) => {
        if (!doc)
            return;
        if (file.size > CORR_SCAN_MAX_BYTES) {
            void showAlert({
                title: 'Файл слишком большой',
                message: `Максимум ${(CORR_SCAN_MAX_BYTES / (1024 * 1024)).toFixed(0)} МБ на файл.`,
            });
            return;
        }
        setUploadingSigned(true);
        setFileError(null);
        try {
            const next = await uploadCorrespondenceAttachment(doc.id, file, 'signed');
            await refresh(next);
            const signed = (next.attachments ?? []).find((a) => a.attachmentKind === 'signed');
            if (signed)
                setActiveFileId(signed.id);
            showToast({
                message: 'Подписанный скан загружен. Документ завершён.',
                variant: 'success',
            });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось загрузить',
                message: correspondenceErrorMessage(err, 'Ошибка загрузки подписанного скана'),
            });
        }
        finally {
            setUploadingSigned(false);
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
            onChanged?.();
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
    return createPortal(_jsxs("div", { className: "corr-modal corr-modal--enter corr-card-modal", role: "presentation", onMouseDown: (e) => {
            // Full-screen card — only close via explicit buttons, not backdrop click.
            if (e.target === e.currentTarget)
                e.preventDefault();
        }, children: [_jsxs("div", { className: "corr-modal__panel corr-card-modal__panel", role: "dialog", "aria-modal": true, "aria-labelledby": titleId, onMouseDown: (e) => e.stopPropagation(), children: [_jsxs("header", { className: "corr-modal__head corr-card-modal__head", children: [_jsxs("div", { className: "corr-card-modal__head-text", children: [_jsx("h2", { id: titleId, className: "corr-modal__title", children: "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430" }), doc ? (_jsxs("p", { className: "corr-modal__lead corr-card-modal__lead", children: [_jsx("span", { className: "corr-card-modal__mono", children: doc.registryNumber || CORR_STATUS_BADGE[doc.status]?.label || '—' }), ' · ', doc.direction === 'incoming' ? 'Входящее' : 'Исходящее', doc.subject ? ` · ${doc.subject}` : ''] })) : null] }), _jsx("button", { type: "button", className: "corr-modal__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", disabled: acting, children: _jsxs("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), loading ? (_jsxs("div", { className: "corr-card-modal__loading", "aria-busy": "true", children: [_jsx("div", { className: "corr-card-modal__preview corr-card-modal__preview--loading", children: _jsx("span", { className: "corr-skel__bone corr-card-modal__preview-skel" }) }), _jsx("div", { className: "corr-card-modal__side", children: Array.from({ length: 5 }).map((_, i) => (_jsxs("div", { className: "corr-card-modal__skel-row", children: [_jsx("span", { className: "corr-skel__bone corr-card-modal__skel-label" }), _jsx("span", { className: "corr-skel__bone corr-card-modal__skel-value", style: { width: `${48 + (i % 3) * 14}%` } })] }, i))) }), _jsxs("div", { className: "corr-card-modal__comments corr-card-modal__comments--loading", children: [_jsx("span", { className: "corr-skel__bone", style: { height: '1rem', width: '40%' } }), _jsx("span", { className: "corr-skel__bone", style: { height: '4rem', width: '100%' } }), _jsx("span", { className: "corr-skel__bone", style: { height: '4rem', width: '85%' } })] })] })) : null, error ? _jsx("p", { className: "corr-modal__err corr-card-modal__err", role: "alert", children: error }) : null, doc && !loading ? (_jsxs("div", { className: "corr-card-modal__layout", children: [_jsxs("section", { className: "corr-card-modal__preview", "aria-label": "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", children: [previewLoading ? (_jsx("div", { className: "corr-card-modal__preview-msg", role: "status", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u2026" })) : null, !previewLoading && previewError ? (_jsxs("div", { className: "corr-card-modal__preview-msg corr-card-modal__preview-msg--err", role: "alert", children: [_jsx("p", { children: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440." }), _jsx("p", { children: previewError === 'Internal Server Error'
                                                    ? 'Сервер не смог открыть файл. Скачайте документ и откройте его на компьютере.'
                                                    : previewError }), activeFile ? (_jsxs("button", { type: "button", className: "corr-modal__btn corr-modal__btn--primary", disabled: downloadingId === activeFile.id, onClick: () => void handleDownload(activeFile), children: ["\u0421\u043A\u0430\u0447\u0430\u0442\u044C ", activeFile.fileName] })) : null] })) : null, !previewLoading && !previewError && !activeFile ? (_jsx("div", { className: "corr-card-modal__preview-msg", children: "\u0412\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442" })) : null, !previewLoading && !previewError && previewUrl && previewKind === 'pdf' ? (_jsx("iframe", { className: "corr-card-modal__iframe", src: `${previewUrl}#toolbar=1`, title: previewTitle })) : null, !previewLoading && !previewError && previewUrl && previewKind === 'image' ? (_jsx("img", { className: "corr-card-modal__img", src: previewUrl, alt: previewTitle })) : null, !previewLoading && !previewError && previewUrl && previewKind === 'other' && activeFile ? (_jsxs("div", { className: "corr-card-modal__preview-msg", children: [_jsx("p", { children: "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u0434\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0442\u0438\u043F\u0430 \u0444\u0430\u0439\u043B\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D." }), _jsxs("button", { type: "button", className: "corr-modal__btn corr-modal__btn--primary", disabled: downloadingId === activeFile.id, onClick: () => void handleDownload(activeFile), children: ["\u0421\u043A\u0430\u0447\u0430\u0442\u044C ", activeFile.fileName] })] })) : null] }), _jsxs("aside", { className: "corr-card-modal__side", children: [_jsxs("section", { className: "corr-card-modal__meta", "aria-label": "\u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0435", children: [_jsxs("header", { className: "corr-card-modal__meta-head", children: [_jsx("span", { className: "corr-card-modal__meta-kicker", children: "\u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F" }), _jsxs("div", { className: "corr-card-modal__meta-chips", children: [typeBadge ? _jsx("span", { className: typeBadge.className, children: typeBadge.label }) : null, statusBadge ? _jsx("span", { className: statusBadge.className, children: statusBadge.label }) : null] })] }), _jsxs("div", { className: "corr-card-modal__meta-reg", children: [_jsx("span", { className: "corr-card-modal__meta-reg-label", children: "\u041D\u043E\u043C\u0435\u0440 \u0440\u0435\u0435\u0441\u0442\u0440\u0430" }), _jsx("span", { className: "corr-card-modal__meta-reg-value", children: doc.registryNumber || '—' })] }), _jsxs("dl", { className: "corr-card-modal__grid", children: [_jsx(DetailRow, { label: counterpartyLabel, children: doc.counterparty || '—' }), doc.partnerUser ? (_jsx(DetailRow, { label: "\u041F\u0430\u0440\u0442\u043D\u0451\u0440", children: _jsx(MetaPerson, { name: doc.partnerUser.displayName, email: doc.partnerUser.email, id: doc.partnerUser.id }) })) : null, _jsx(DetailRow, { label: "\u0422\u0435\u043C\u0430", children: doc.subject || '—' }), _jsx(DetailRow, { label: "\u0414\u0430\u0442\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438", children: formatCorrRegisteredAt(doc.registeredAt) }), _jsx(DetailRow, { label: "\u041E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439", children: doc.responsibleUser
                                                            ? (_jsx(MetaPerson, { name: doc.responsibleUser.displayName, email: doc.responsibleUser.email, id: doc.responsibleUser.id }))
                                                            : '—' }), doc.comment ? (_jsx(DetailRow, { label: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439", children: _jsx("span", { className: "corr-card-modal__note-text", children: doc.comment }) })) : null, doc.rejectionComment ? (_jsx(DetailRow, { label: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u043E\u0442\u043A\u0430\u0437\u0430", children: _jsx("span", { className: "corr-card-modal__note-text corr-card-modal__note-text--reject", children: doc.rejectionComment }) })) : null] })] }), canUploadSigned ? (_jsxs("section", { className: "corr-card-modal__sign", "aria-label": "\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0441\u043A\u0430\u043D\u0430", children: [_jsx("h3", { className: "corr-card-modal__files-title", children: "\u041F\u043E\u0434\u043F\u0438\u0441\u0430\u0442\u044C \u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C" }), _jsxs("ol", { className: "corr-card-modal__sign-steps", children: [_jsx("li", { children: "\u0421\u043A\u0430\u0447\u0430\u0439\u0442\u0435 \u0444\u0430\u0439\u043B \u043F\u0438\u0441\u044C\u043C\u0430" }), _jsx("li", { children: "\u0420\u0430\u0441\u043F\u0435\u0447\u0430\u0442\u0430\u0439\u0442\u0435 \u0438 \u043F\u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043F\u043E\u0434\u043F\u0438\u0441\u044C" }), _jsx("li", { children: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0441\u043A\u0430\u043D \u0438\u043B\u0438 \u0444\u043E\u0442\u043E \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u043D\u043E\u0433\u043E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430" })] }), _jsxs("div", { className: "corr-card-modal__sign-actions", children: [activeFile ? (_jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--ghost", disabled: acting || uploadingSigned || downloadingId === activeFile.id, onClick: () => void handleDownload(activeFile), children: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0434\u043B\u044F \u043F\u0435\u0447\u0430\u0442\u0438" })) : null, _jsx("input", { ref: signedFileRef, type: "file", accept: "application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp", hidden: true, onChange: (e) => {
                                                            const picked = e.target.files?.[0];
                                                            e.target.value = '';
                                                            if (picked)
                                                                void handleUploadSigned(picked);
                                                        } }), _jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--primary", disabled: acting || uploadingSigned, onClick: () => signedFileRef.current?.click(), children: uploadingSigned ? 'Загрузка…' : 'Загрузить подписанный скан' })] })] })) : null, attachments.length > 0 ? (_jsxs("section", { className: "corr-card-modal__files", "aria-label": "\u0412\u043B\u043E\u0436\u0435\u043D\u0438\u044F", children: [_jsxs("h3", { className: "corr-card-modal__files-title", children: ["\u0412\u043B\u043E\u0436\u0435\u043D\u0438\u044F (", attachments.length, ")"] }), _jsx("ul", { className: "corr-card-modal__files-list", children: attachments.map((file) => (_jsx(AttachmentRow, { file: file, active: file.id === activeFileId, downloading: downloadingId === file.id, onSelect: () => {
                                                        setFileError(null);
                                                        setActiveFileId(file.id);
                                                    }, onDownload: () => void handleDownload(file) }, file.id))) })] })) : (_jsx("p", { className: "corr-card-modal__no-files", children: "\u0412\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442" })), fileError ? _jsx("p", { className: "corr-modal__err", role: "alert", children: fileError }) : null] }), _jsxs("section", { className: "corr-card-modal__comments", "aria-label": "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438", children: [_jsxs("h3", { className: "corr-card-modal__comments-title", children: ["\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0438", comments.length > 0 ? ` (${comments.length})` : ''] }), _jsxs("div", { ref: commentsFeedRef, className: "corr-card-modal__comments-feed", children: [commentsLoading ? (_jsx("p", { className: "corr-card-modal__comments-empty", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" })) : null, !commentsLoading && comments.length === 0 ? (_jsx("p", { className: "corr-card-modal__comments-empty", children: "\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439. \u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u043F\u0435\u0440\u0432\u044B\u0439 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439." })) : null, !commentsLoading
                                                ? comments.map((cm) => {
                                                    const author = userLabel(cm.authorUser?.displayName, cm.authorUser?.email, cm.authorUserId);
                                                    const mine = uid != null && cm.authorUserId === uid;
                                                    return (_jsxs("article", { className: `corr-card-modal__comment${mine ? ' corr-card-modal__comment--mine' : ''}`, children: [_jsx("div", { className: "corr-card-modal__comment-avatar", "aria-hidden": true, title: author, children: userInitials(author) }), _jsxs("div", { className: "corr-card-modal__comment-body", children: [_jsx("p", { className: "corr-card-modal__comment-text", children: cm.body }), _jsxs("span", { className: "corr-card-modal__comment-meta", children: [author, ' · ', formatCommentTime(cm.createdAt)] })] })] }, cm.id));
                                                })
                                                : null] }), commentsError ? (_jsx("p", { className: "corr-modal__err corr-card-modal__comments-err", role: "alert", children: commentsError })) : null, _jsxs("div", { className: "corr-card-modal__comment-compose", children: [_jsx("textarea", { className: "corr-card-modal__comment-input", rows: 2, maxLength: 4000, placeholder: "\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439\u2026", value: commentDraft, disabled: commentSending || acting, onChange: (e) => setCommentDraft(e.target.value), onKeyDown: (e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        void handleSendComment();
                                                    }
                                                }, "aria-label": "\u0422\u0435\u043A\u0441\u0442 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u044F" }), _jsx("button", { type: "button", className: "corr-card-modal__comment-send", disabled: commentSending || !commentDraft.trim() || acting, onClick: () => void handleSendComment(), "aria-label": "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439", children: commentSending ? '…' : (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("line", { x1: "22", y1: "2", x2: "11", y2: "13" }), _jsx("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })] })) })] })] })] })) : null, _jsxs("div", { className: "corr-modal__actions", children: [canAcknowledgeIncoming ? (_jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--primary", disabled: acting, onClick: () => void handleAcknowledgeIncoming(), children: acting ? '…' : 'Отметить полученным' })) : null, canPartnerAct ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--ghost", disabled: acting, onClick: () => setRejectOpen(true), children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C" }), _jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--primary", disabled: acting, onClick: () => void handleApprove(), children: acting ? '…' : 'Подтвердить' })] })) : null, canAuthorResubmit ? (_jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--primary", disabled: acting, onClick: () => setResubmitOpen(true), children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E" })) : null, activeFile && previewUrl ? (_jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--ghost", disabled: downloadingId === activeFile.id, onClick: () => void handleDownload(activeFile), children: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u0430\u0439\u043B" })) : null, _jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--primary", onClick: onClose, disabled: acting, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" })] })] }), _jsx(CorrespondenceRejectModal, { open: rejectOpen, onClose: () => { if (!acting)
                    setRejectOpen(false); }, onConfirm: (comment) => { void handleReject(comment); }, submitPending: acting }), _jsx(OutgoingSubmitReviewModal, { open: resubmitOpen, nested: true, onClose: () => { if (!acting)
                    setResubmitOpen(false); }, onSubmit: (partnerUserId, partnerName) => { void handleResubmit(partnerUserId, partnerName); }, submitPending: acting })] }), document.body);
}
