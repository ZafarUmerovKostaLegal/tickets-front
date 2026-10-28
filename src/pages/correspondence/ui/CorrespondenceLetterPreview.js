import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from 'react';
import { STATUS_META, MOCK_PARTNERS, IcoAlert, IcoCheck, IcoCross, IcoSend, IcoEdit, } from './CorrespondencePage';
import { mockLetterToCoverModel } from '../lib/correspondenceCoverLetterModel';
import { downloadOutgoingLetterPdf } from '../lib/buildOutgoingLetterPdf';
import { CorrespondenceLetterWorkspace } from './CorrespondenceLetterWorkspace';
import { useCorrespondenceDownloadQr } from '../lib/useCorrespondenceDownloadQr';
import './CorrespondenceLetterPreview.css';
function IcoPrint() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("polyline", { points: "6 9 6 2 18 2 18 9" }), _jsx("path", { d: "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" }), _jsx("rect", { x: "6", y: "14", width: "12", height: "8" })] }));
}
function IcoDownload() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }));
}
export function CorrespondenceLetterPreview({ letter, mode, loading, onBack, onSendToReview, onApprove, onReject, onEdit, }) {
    const sm = STATUS_META[letter.status];
    const coverModel = useMemo(() => mockLetterToCoverModel(letter), [letter]);
    const [pdfBusy, setPdfBusy] = useState(false);
    const downloadDocumentId = /^[0-9a-f-]{36}$/i.test(letter.id) ? letter.id : null;
    const { url: downloadQrUrl } = useCorrespondenceDownloadQr(downloadDocumentId, Boolean(downloadDocumentId));
    const canSendToReview = mode === 'employee' && (letter.status === 'draft' || letter.status === 'rejected');
    const canEdit = mode === 'employee' && (letter.status === 'draft' || letter.status === 'rejected');
    const canPartnerAct = mode === 'partner' && letter.status === 'pending_review';
    const handleDownloadPdf = useCallback(async () => {
        setPdfBusy(true);
        try {
            await downloadOutgoingLetterPdf(coverModel, {
                registryNumber: letter.registryNumber,
                subject: letter.subject,
                dateIso: letter.date,
                downloadQrUrl,
            });
        }
        catch {
            // keep silent; sheet remains available for print
        }
        finally {
            setPdfBusy(false);
        }
    }, [coverModel, downloadQrUrl, letter.date, letter.registryNumber, letter.subject]);
    const partnerObj = letter.partnerId
        ? MOCK_PARTNERS.find(p => p.id === letter.partnerId)
        : undefined;
    const statusNote = useMemo(() => {
        if (letter.status === 'pending_review') {
            return partnerObj
                ? `На согласовании у ${partnerObj.name}`
                : 'Ожидает согласования партнёра';
        }
        if (letter.status === 'rejected' && letter.rejectionReason) {
            return `Отклонено: ${letter.rejectionReason}`;
        }
        if (letter.status === 'approved') {
            return letter.partnerName
                ? `Подтверждено — ${letter.partnerName}`
                : 'Документ подтверждён';
        }
        return null;
    }, [letter, partnerObj]);
    const statusTone = letter.status === 'pending_review'
        ? 'pending'
        : letter.status === 'rejected'
            ? 'rejected'
            : letter.status === 'approved'
                ? 'approved'
                : null;
    return (_jsx(CorrespondenceLetterWorkspace, { letter: letter, coverModel: coverModel, loading: loading, navbarTab: "preview", onBack: onBack, downloadDocumentId: downloadDocumentId, statusNote: statusNote, statusTone: statusTone, statusIcon: letter.status === 'rejected' ? _jsx(IcoAlert, {}) : undefined, navbarActions: (_jsxs(_Fragment, { children: [_jsx("span", { className: `corr-n__badge ${sm.cls}`, children: sm.label }), canEdit && onEdit && (_jsxs("button", { type: "button", className: "corr-n__btn-secondary", onClick: onEdit, children: [_jsx(IcoEdit, {}), " ", _jsx("span", { children: "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C" })] })), canSendToReview && onSendToReview && (_jsxs("button", { type: "button", className: "corr-n__btn-primary", onClick: onSendToReview, children: [_jsx(IcoSend, {}), _jsx("span", { children: letter.status === 'rejected' ? 'Отправить повторно' : 'На согласование' })] })), canPartnerAct && onReject && (_jsxs("button", { type: "button", className: "corr-n__btn-danger", onClick: onReject, children: [_jsx(IcoCross, {}), " ", _jsx("span", { children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C" })] })), canPartnerAct && onApprove && (_jsxs("button", { type: "button", className: "corr-n__btn-success", onClick: onApprove, children: [_jsx(IcoCheck, {}), " ", _jsx("span", { children: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C" })] })), _jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-inv-preview__download-btn", onClick: () => window.print(), title: "\u041F\u0435\u0447\u0430\u0442\u044C", children: [_jsx(IcoPrint, {}), " \u041F\u0435\u0447\u0430\u0442\u044C"] }), _jsxs("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline tt-inv-preview__download-btn", title: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C PDF", disabled: pdfBusy, onClick: () => { void handleDownloadPdf(); }, children: [_jsx(IcoDownload, {}), " ", pdfBusy ? 'PDF…' : 'PDF'] })] })) }));
}
