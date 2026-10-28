import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { invalidateCorrespondencePartnerAttention } from '@entities/correspondence';
import { getCorrespondenceOutgoingUrl, routes } from '@shared/config';
import { useAppDialog } from '@shared/ui';
import { coverModelToMockLetter } from '../lib/correspondenceCoverLetterModel';
import { clearOutgoingLetterDraft, getOutgoingLetterDraftFiles, isOutgoingLetterDraftValid, readOutgoingLetterDraft, } from '../lib/outgoingLetterSession';
import { submitOutgoingLetterForReview } from '../lib/registerOutgoingLetter';
import { downloadOutgoingLetterPdf } from '../lib/buildOutgoingLetterPdf';
import { useCorrespondenceDownloadQr } from '../lib/useCorrespondenceDownloadQr';
import { CorrespondenceLetterWorkspace } from './CorrespondenceLetterWorkspace';
import { OutgoingSubmitReviewModal } from './OutgoingSubmitReviewModal';
import { IcoEdit } from './CorrespondencePage';
import './CorrespondenceLetterPreview.css';
import './CorrespondencePage.css';
function IcoSend() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("line", { x1: "22", y1: "2", x2: "11", y2: "13" }), _jsx("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })] }));
}
function IcoDownload() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }));
}
export function OutgoingLetterPreviewPage() {
    const navigate = useNavigate();
    const { showAlert } = useAppDialog();
    const [draft, setDraft] = useState(undefined);
    const [busy, setBusy] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);
    useEffect(() => {
        setDraft(readOutgoingLetterDraft());
    }, []);
    const downloadDocumentId = draft?.serverDocumentId && /^[0-9a-f-]{36}$/i.test(draft.serverDocumentId)
        ? draft.serverDocumentId
        : null;
    const { url: downloadQrUrl } = useCorrespondenceDownloadQr(downloadDocumentId, Boolean(downloadDocumentId));
    const files = useMemo(() => (draft ? getOutgoingLetterDraftFiles(draft.sessionId) : []), [draft]);
    const letter = useMemo(() => {
        if (!draft)
            return null;
        const attachments = draft.attachmentMeta.map((a) => ({
            id: a.id,
            name: a.name,
            size: a.sizeLabel,
        }));
        return coverModelToMockLetter(draft.coverModel, {
            id: draft.sessionId,
            docType: 'letter',
            subject: draft.subject.trim() || '(без темы)',
            date: draft.letterDateIso,
            status: 'draft',
            registryNumber: 'ИСХ-черновик',
            attachments,
        });
    }, [draft]);
    const goBackToEdit = useCallback(() => {
        navigate(routes.correspondenceOutgoingCreate);
    }, [navigate]);
    const goRegistry = useCallback(() => {
        navigate(getCorrespondenceOutgoingUrl());
    }, [navigate]);
    const openReviewModal = () => {
        if (!draft)
            return;
        const check = isOutgoingLetterDraftValid(draft.subject, draft.coverModel);
        if (!check.ok) {
            void showAlert({ title: 'Проверьте поля', message: check.message ?? 'Заполните обязательные поля.' });
            return;
        }
        setReviewOpen(true);
    };
    const handleDownloadPdf = async () => {
        if (!draft)
            return;
        setPdfBusy(true);
        try {
            await downloadOutgoingLetterPdf(draft.coverModel, {
                subject: draft.subject,
                dateIso: draft.letterDateIso,
                downloadQrUrl,
            });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось скачать PDF',
                message: err instanceof Error ? err.message : 'Ошибка формирования файла',
            });
        }
        finally {
            setPdfBusy(false);
        }
    };
    const handleSubmitReview = async (partnerUserId, partnerName) => {
        if (!draft)
            return;
        setBusy(true);
        try {
            await submitOutgoingLetterForReview({
                subject: draft.subject,
                coverModel: draft.coverModel,
                letterDateIso: draft.letterDateIso,
                partnerUserId,
                extraFiles: files,
                existingDocumentId: draft.serverDocumentId,
                downloadQrUrl,
            });
            clearOutgoingLetterDraft();
            setReviewOpen(false);
            invalidateCorrespondencePartnerAttention();
            void showAlert({
                title: 'Отправлено на согласование',
                message: `Письмо отправлено партнёру «${partnerName}». После одобрения распечатайте, подпишите и загрузите скан.`,
            });
            navigate(getCorrespondenceOutgoingUrl());
        }
        catch (err) {
            const message = err instanceof Error && err.message
                ? err.message
                : 'Не удалось отправить письмо на согласование.';
            void showAlert({ title: 'Не удалось сохранить', message });
        }
        finally {
            setBusy(false);
        }
    };
    if (draft === undefined)
        return null;
    if (!draft || !letter)
        return _jsx(Navigate, { to: routes.correspondenceOutgoingCreate, replace: true });
    return (_jsxs(_Fragment, { children: [_jsx(CorrespondenceLetterWorkspace, { letter: letter, coverModel: draft.coverModel, editable: false, navbarTab: "preview", onBack: goBackToEdit, downloadDocumentId: downloadDocumentId, toolbarSubject: (_jsx("span", { className: "tt-inv-preview__pdf-toolbar-export", title: draft.subject, children: draft.subject })), navbarActions: (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "corr-n__btn-secondary", onClick: goRegistry, disabled: busy || pdfBusy, children: "\u041A \u0440\u0435\u0435\u0441\u0442\u0440\u0443" }), _jsxs("button", { type: "button", className: "corr-n__btn-secondary", onClick: () => { void handleDownloadPdf(); }, disabled: busy || pdfBusy, children: [_jsx(IcoDownload, {}), ' ', pdfBusy ? 'PDF…' : 'Скачать PDF'] }), _jsxs("button", { type: "button", className: "corr-n__btn-secondary", onClick: goBackToEdit, disabled: busy || pdfBusy, children: [_jsx(IcoEdit, {}), ' ', "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C"] }), _jsxs("button", { type: "button", className: "corr-n__btn-primary", onClick: openReviewModal, disabled: busy || pdfBusy, children: [_jsx(IcoSend, {}), ' ', busy ? 'Отправка…' : 'На согласование'] })] })) }), _jsx(OutgoingSubmitReviewModal, { open: reviewOpen, onClose: () => { if (!busy)
                    setReviewOpen(false); }, onSubmit: (partnerUserId, partnerName) => { void handleSubmitReview(partnerUserId, partnerName); }, submitPending: busy })] }));
}
