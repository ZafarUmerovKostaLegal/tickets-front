import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { listPartners } from '@entities/user';
import { sortByRuLabel } from '@shared/lib/sortByRuLabel';
import { SearchableSelect } from '@shared/ui';
import { CORR_DOC_TYPE_OPTIONS } from '../model/constants';
import { CorrespondenceFileDrivePicker } from './CorrespondenceFileDrivePicker';
function partnerLabel(p) {
    return p.display_name?.trim() || p.email || `User #${p.id}`;
}
export function CorrespondenceRegisterIncomingModal({ open, onClose, onSubmit, submitPending = false, }) {
    const titleId = useId();
    const senderRef = useRef(null);
    const [partnerUserId, setPartnerUserId] = useState('');
    const [counterparty, setCounterparty] = useState('');
    const [subject, setSubject] = useState('');
    const [type, setType] = useState('letter');
    const [comment, setComment] = useState('');
    const [scanFiles, setScanFiles] = useState([]);
    const [errors, setErrors] = useState({});
    const [fileHint, setFileHint] = useState(null);
    const [partnerOptions, setPartnerOptions] = useState([]);
    const [partnersLoad, setPartnersLoad] = useState('idle');
    const [partnersLoadErr, setPartnersLoadErr] = useState(null);
    const sortedPartners = useMemo(() => sortByRuLabel(partnerOptions, partnerLabel), [partnerOptions]);
    useEffect(() => {
        if (!open)
            return;
        setPartnerUserId('');
        setCounterparty('');
        setSubject('');
        setType('letter');
        setComment('');
        setScanFiles([]);
        setErrors({});
        setFileHint(null);
        const t = window.setTimeout(() => senderRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
    }, [open]);
    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        setPartnersLoad('loading');
        setPartnersLoadErr(null);
        void listPartners()
            .then((rows) => {
            if (cancelled)
                return;
            setPartnerOptions(rows);
            setPartnersLoad('ok');
        })
            .catch((err) => {
            if (cancelled)
                return;
            setPartnerOptions([]);
            setPartnersLoad('error');
            setPartnersLoadErr(err instanceof Error ? err.message : 'Не удалось загрузить партнёров');
        });
        return () => { cancelled = true; };
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
        if (!partnerUserId.trim())
            next.partnerUserId = 'Выберите партнёра';
        if (!counterparty.trim())
            next.counterparty = 'Укажите отправителя';
        if (!subject.trim())
            next.subject = 'Укажите тему письма';
        if (scanFiles.length === 0)
            next.scanFiles = 'Загрузите фото или скан документа';
        return next;
    }, [counterparty, partnerUserId, scanFiles.length, subject]);
    const handleSubmit = useCallback(() => {
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0)
            return;
        const partner = partnerOptions.find((p) => String(p.id) === partnerUserId);
        if (!partner) {
            setErrors({ partnerUserId: 'Выберите партнёра из списка' });
            return;
        }
        onSubmit({
            partnerUserId: partner.id,
            partnerName: partnerLabel(partner),
            counterparty: counterparty.trim(),
            subject: subject.trim(),
            type,
            comment: comment.trim(),
            scanFiles: [...scanFiles],
        });
    }, [comment, counterparty, onSubmit, partnerOptions, partnerUserId, scanFiles, subject, type, validate]);
    if (!open || typeof document === 'undefined')
        return null;
    const canSubmit = partnerUserId.trim().length > 0
        && counterparty.trim().length > 0
        && subject.trim().length > 0
        && scanFiles.length > 0
        && !submitPending;
    return createPortal(_jsx("div", { className: "corr-modal", role: "presentation", onClick: onClose, children: _jsxs("div", { className: "corr-modal__panel corr-modal__panel--drive corr-modal__panel--fit", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "corr-modal__head", children: [_jsxs("div", { children: [_jsx("h2", { className: "corr-modal__title", id: titleId, children: "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0445\u043E\u0434\u044F\u0449\u0435\u0435 \u043F\u0438\u0441\u044C\u043C\u043E" }), _jsx("p", { className: "corr-modal__lead", children: "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430, \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u0435\u043B\u044F \u0438 \u043F\u0440\u0438\u043B\u043E\u0436\u0438\u0442\u0435 \u0441\u043A\u0430\u043D \u0438\u043B\u0438 \u0444\u043E\u0442\u043E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430. \u041C\u043E\u0436\u043D\u043E \u043F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u044C \u0444\u0430\u0439\u043B\u044B, \u043A\u0430\u043A \u0432 Google \u0414\u0438\u0441\u043A\u0435." })] }), _jsx("button", { type: "button", className: "corr-modal__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("path", { d: "M18 6 6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "corr-modal__form corr-modal__form--drive", children: [_jsxs("div", { className: "corr-modal__form-fields corr-modal__form-fields--incoming", children: [_jsxs("div", { className: `corr-modal__field${errors.partnerUserId ? ' corr-modal__field--err' : ''}`, children: [_jsxs("label", { className: "corr-modal__label", id: "corr-in-partner-label", children: ["\u041F\u0430\u0440\u0442\u043D\u0451\u0440 ", _jsx("span", { className: "corr-modal__req", "aria-hidden": true, children: "*" })] }), _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: 10120, className: "corr-modal__srch", buttonClassName: "corr-modal__srch-btn", buttonId: "corr-in-partner", "aria-labelledby": "corr-in-partner-label", "aria-invalid": Boolean(errors.partnerUserId), placeholder: partnersLoad === 'loading' ? 'Загрузка партнёров…' : 'Выберите партнёра', emptyListText: "\u041D\u0435\u0442 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: partnerUserId, items: sortedPartners, disabled: partnersLoad === 'loading' || submitPending || partnersLoad === 'error', getOptionValue: (p) => String(p.id), getOptionLabel: partnerLabel, getSearchText: (p) => `${partnerLabel(p)} ${p.email ?? ''}`.trim(), onSelect: (p) => {
                                                setPartnerUserId(String(p.id));
                                                setErrors((prev) => ({ ...prev, partnerUserId: undefined }));
                                            } }), partnersLoad === 'loading' ? _jsx("p", { className: "corr-modal__hint", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0441\u043F\u0438\u0441\u043A\u0430 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432\u2026" }) : null, partnersLoadErr ? _jsx("p", { className: "corr-modal__err", children: partnersLoadErr }) : null, errors.partnerUserId ? _jsx("p", { className: "corr-modal__err", children: errors.partnerUserId }) : null] }), _jsxs("div", { className: `corr-modal__field${errors.counterparty ? ' corr-modal__field--err' : ''}`, children: [_jsxs("label", { className: "corr-modal__label", htmlFor: "corr-in-sender", children: ["\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u0435\u043B\u044C ", _jsx("span", { className: "corr-modal__req", "aria-hidden": true, children: "*" })] }), _jsx("input", { id: "corr-in-sender", ref: senderRef, className: "corr-modal__input", value: counterparty, onChange: (e) => {
                                                setCounterparty(e.target.value);
                                                setErrors((prev) => ({ ...prev, counterparty: undefined }));
                                            }, placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u041E\u041E\u041E \u00AB\u0420\u043E\u043C\u0430\u0448\u043A\u0430\u00BB", autoComplete: "organization", disabled: submitPending }), errors.counterparty ? _jsx("p", { className: "corr-modal__err", children: errors.counterparty }) : null] }), _jsxs("div", { className: `corr-modal__field${errors.subject ? ' corr-modal__field--err' : ''}`, children: [_jsxs("label", { className: "corr-modal__label", htmlFor: "corr-in-subject", children: ["\u0422\u0435\u043C\u0430 ", _jsx("span", { className: "corr-modal__req", "aria-hidden": true, children: "*" })] }), _jsx("input", { id: "corr-in-subject", className: "corr-modal__input", value: subject, onChange: (e) => {
                                                setSubject(e.target.value);
                                                setErrors((prev) => ({ ...prev, subject: undefined }));
                                            }, placeholder: "\u041A\u0440\u0430\u0442\u043A\u043E \u043E \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0438", disabled: submitPending }), errors.subject ? _jsx("p", { className: "corr-modal__err", children: errors.subject }) : null] }), _jsxs("div", { className: "corr-modal__field", children: [_jsx("label", { className: "corr-modal__label", id: "corr-in-type-label", children: "\u0422\u0438\u043F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430" }), _jsx(SearchableSelect, { portalDropdown: true, portalZIndex: 10120, className: "corr-modal__srch", buttonClassName: "corr-modal__srch-btn", buttonId: "corr-in-type", "aria-labelledby": "corr-in-type-label", placeholder: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043F", value: type, items: CORR_DOC_TYPE_OPTIONS, disabled: submitPending, getOptionValue: (o) => o.key, getOptionLabel: (o) => o.label, getSearchText: (o) => o.label, onSelect: (o) => setType(o.key) })] }), _jsxs("div", { className: "corr-modal__field", children: [_jsx("label", { className: "corr-modal__label", htmlFor: "corr-in-comment", children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439" }), _jsx("textarea", { id: "corr-in-comment", className: "corr-modal__textarea", value: comment, onChange: (e) => setComment(e.target.value), placeholder: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E", disabled: submitPending })] })] }), _jsx(CorrespondenceFileDrivePicker, { files: scanFiles, onChange: (next) => {
                                setScanFiles(next);
                                setErrors((prev) => ({ ...prev, scanFiles: undefined }));
                            }, disabled: submitPending, error: errors.scanFiles, hint: fileHint, onHint: setFileHint, label: "\u0421\u043A\u0430\u043D \u0438\u043B\u0438 \u0444\u043E\u0442\u043E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", required: true, compact: true })] }), _jsxs("div", { className: "corr-modal__actions", children: [_jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--ghost", onClick: onClose, disabled: submitPending, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "corr-modal__btn corr-modal__btn--primary", disabled: !canSubmit, onClick: handleSubmit, children: submitPending ? 'Сохранение…' : 'Сохранить' })] })] }) }), document.body);
}
