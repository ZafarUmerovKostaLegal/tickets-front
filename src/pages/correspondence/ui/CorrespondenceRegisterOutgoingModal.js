import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SearchableSelect } from '@shared/ui';
import { CORR_DOC_TYPE_OPTIONS } from '../model/constants';
import { CorrespondenceFileDrivePicker } from './CorrespondenceFileDrivePicker';
export function CorrespondenceRegisterOutgoingModal({ open, onClose, onSubmit, submitPending = false, }) {
    const titleId = useId();
    const recipientRef = useRef(null);
    const [counterparty, setCounterparty] = useState('');
    const [subject, setSubject] = useState('');
    const [type, setType] = useState('letter');
    const [comment, setComment] = useState('');
    const [attachmentFiles, setAttachmentFiles] = useState([]);
    const [errors, setErrors] = useState({});
    const [fileHint, setFileHint] = useState(null);
    useEffect(() => {
        if (!open)
            return;
        setCounterparty('');
        setSubject('');
        setType('letter');
        setComment('');
        setAttachmentFiles([]);
        setErrors({});
        setFileHint(null);
        const t = window.setTimeout(() => recipientRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    const validate = useCallback(() => {
        const next = {};
        if (!counterparty.trim())
            next.counterparty = 'Укажите получателя';
        if (!subject.trim())
            next.subject = 'Укажите тему письма';
        return next;
    }, [counterparty, subject]);
    const handleSubmit = useCallback(() => {
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0)
            return;
        onSubmit({
            counterparty: counterparty.trim(),
            subject: subject.trim(),
            type,
            comment: comment.trim() || undefined,
            attachmentFiles: attachmentFiles.length > 0 ? [...attachmentFiles] : undefined,
        });
    }, [attachmentFiles, comment, counterparty, onSubmit, subject, type, validate]);
    if (!open || typeof document === 'undefined')
        return null;
    const canSubmit = counterparty.trim().length > 0 && subject.trim().length > 0 && !submitPending;
    return createPortal(_jsx("div", { className: "corr-modal", role: "presentation", onClick: onClose, children: _jsxs("div", { className: "corr-modal__panel corr-modal__panel--drive corr-modal__panel--fit", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "corr-modal__head", children: [_jsxs("div", { children: [_jsx("h2", { className: "corr-modal__title", id: titleId, children: "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0438\u0441\u0445\u043E\u0434\u044F\u0449\u0435\u0435" }), _jsx("p", { className: "corr-modal__lead", children: "\u0414\u043B\u044F \u0443\u0436\u0435 \u0433\u043E\u0442\u043E\u0432\u043E\u0433\u043E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430: \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u0435\u043B\u044F \u0438 \u0442\u0435\u043C\u0443. \u0427\u0442\u043E\u0431\u044B \u043D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u043F\u0438\u0441\u044C\u043C\u043E \u043D\u0430 \u0431\u043B\u0430\u043D\u043A\u0435, \u0437\u0430\u043A\u0440\u043E\u0439\u0442\u0435 \u043E\u043A\u043D\u043E \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u00AB\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u043F\u0438\u0441\u044C\u043C\u043E\u00BB." })] }), _jsx("button", { type: "button", className: "corr-modal__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("path", { d: "M18 6 6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "corr-modal__form corr-modal__form--drive", children: [_jsxs("div", { className: "corr-modal__form-fields corr-modal__form-fields--compact", children: [_jsxs("div", { className: `corr-modal__field${errors.counterparty ? ' corr-modal__field--err' : ''}`, children: [_jsxs("label", { className: "corr-modal__label", htmlFor: "corr-out-recipient", children: ["\u041F\u043E\u043B\u0443\u0447\u0430\u0442\u0435\u043B\u044C ", _jsx("span", { className: "corr-modal__req", "aria-hidden": true, children: "*" })] }), _jsx("input", { id: "corr-out-recipient", ref: recipientRef, className: "corr-modal__input", value: counterparty, onChange: (e) => {
                                                setCounterparty(e.target.value);
                                                setErrors((prev) => ({ ...prev, counterparty: undefined }));
                                            }, placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u041E\u041E\u041E \u00AB\u0420\u043E\u043C\u0430\u0448\u043A\u0430\u00BB", autoComplete: "organization", disabled: submitPending }), errors.counterparty ? _jsx("p", { className: "corr-modal__err", children: errors.counterparty }) : null] }), _jsxs("div", { className: `corr-modal__field${errors.subject ? ' corr-modal__field--err' : ''}`, children: [_jsxs("label", { className: "corr-modal__label", htmlFor: "corr-out-subject", children: ["\u0422\u0435\u043C\u0430 ", _jsx("span", { className: "corr-modal__req", "aria-hidden": true, children: "*" })] }), _jsx("input", { id: "corr-out-subject", className: "corr-modal__input", value: subject, onChange: (e) => {
                                                setSubject(e.target.value);
                                                setErrors((prev) => ({ ...prev, subject: undefined }));
                                            }, placeholder: "\u041A\u0440\u0430\u0442\u043A\u043E \u043E \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0438", disabled: submitPending }), errors.subject ? _jsx("p", { className: "corr-modal__err", children: errors.subject }) : null] }), _jsxs("div", { className: "corr-modal__field", children: [_jsx("label", { className: "corr-modal__label", id: "corr-out-type-label", children: "\u0422\u0438\u043F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430" }), _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: 10120, className: "corr-modal__srch", buttonClassName: "corr-modal__srch-btn", buttonId: "corr-out-type", "aria-labelledby": "corr-out-type-label", placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043F", value: type, items: CORR_DOC_TYPE_OPTIONS, disabled: submitPending, getOptionValue: (o) => o.key, getOptionLabel: (o) => o.label, getSearchText: (o) => o.label, onSelect: (o) => setType(o.key) })] }), _jsxs("div", { className: "corr-modal__field", children: [_jsx("label", { className: "corr-modal__label", htmlFor: "corr-out-comment", children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439" }), _jsx("textarea", { id: "corr-out-comment", className: "corr-modal__textarea", value: comment, onChange: (e) => setComment(e.target.value), placeholder: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E", disabled: submitPending })] })] }), _jsx(CorrespondenceFileDrivePicker, { files: attachmentFiles, onChange: setAttachmentFiles, disabled: submitPending, hint: fileHint, onHint: setFileHint, label: "\u0424\u0430\u0439\u043B \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", compact: true })] }), _jsxs("div", { className: "corr-modal__actions", children: [_jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--ghost", onClick: onClose, disabled: submitPending, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--primary", disabled: !canSubmit, onClick: handleSubmit, children: submitPending ? 'Сохранение…' : 'Зарегистрировать' })] })] }) }), document.body);
}
