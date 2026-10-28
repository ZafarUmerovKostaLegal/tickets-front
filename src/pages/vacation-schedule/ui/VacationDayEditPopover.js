import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { readFileAsBasisAttachment, vacationAbsenceBasisLimits } from '../lib/vacationAbsenceBasisStorage';
import { vacationKindSealUsesDarkInk } from '../lib/vacationScheduleModel';
import './VacationDayEditPopover.css';
function emptyBasis() {
    return { comment: '', attachments: [] };
}
export function VacationDayEditPopover({ open, x, y, legendItems, current, saving, cellKey, initialBasis, onPersistBasis, context, onPickKindCode, onClear, onClose, }) {
    const uid = useId();
    const ref = useRef(null);
    const fileInputRef = useRef(null);
    const draftRef = useRef(emptyBasis());
    const [basisDraft, setBasisDraft] = useState(() => (initialBasis
        ? {
            comment: initialBasis.comment,
            attachments: initialBasis.attachments.map((a) => ({ ...a })),
        }
        : emptyBasis()));
    const [basisNotice, setBasisNotice] = useState(null);
    draftRef.current = basisDraft;
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);
    if (!open)
        return null;
    const pad = 12;
    const maxW = 280;
    const left = Math.max(pad, Math.min(x, window.innerWidth - maxW - pad));
    const top = Math.max(pad, Math.min(y + 6, window.innerHeight - 420));
    const canEditBasis = Boolean(cellKey && current != null);
    const persistDraft = () => {
        if (!cellKey || !canEditBasis)
            return;
        const empty = !basisDraft.comment.trim() && basisDraft.attachments.length === 0;
        onPersistBasis(cellKey, empty ? null : basisDraft);
        setBasisNotice(empty ? 'Основание очищено' : 'Сохранено в этом браузере (до появления сервера)');
    };
    const onFiles = async (files) => {
        if (!files?.length || !canEditBasis)
            return;
        setBasisNotice(null);
        const attachments = [...draftRef.current.attachments];
        for (const f of Array.from(files)) {
            if (attachments.length >= vacationAbsenceBasisLimits.maxAttachments) {
                setBasisNotice(`Не больше ${vacationAbsenceBasisLimits.maxAttachments} файлов`);
                break;
            }
            const r = await readFileAsBasisAttachment(f);
            if (typeof r === 'string') {
                setBasisNotice(r);
                continue;
            }
            attachments.push(r);
        }
        setBasisDraft((d) => ({ ...d, attachments }));
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    };
    const removeAtt = (id) => {
        setBasisDraft((d) => ({
            ...d,
            attachments: d.attachments.filter((a) => a.id !== id),
        }));
    };
    return createPortal(_jsxs("div", { ref: ref, className: "vac-day-pop", style: { position: 'fixed', left, top, zIndex: 10050 }, role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-title ${uid}-basis-title`, children: [context && (_jsxs("div", { className: "vac-day-pop__context", children: [_jsx("span", { className: "vac-day-pop__ctx-date", children: context.dateLabel }), _jsx("span", { className: "vac-day-pop__ctx-name", children: context.employeeName })] })), _jsx("button", { type: "button", className: "vac-day-pop__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", title: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u2715" }), _jsx("div", { id: `${uid}-title`, className: "vac-day-pop__title", children: "\u0412\u0438\u0434 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F" }), _jsx("ul", { className: "vac-day-pop__list", children: legendItems.map((it) => {
                    const isCurrent = current?.kindCode === it.kindCode;
                    return (_jsx("li", { children: _jsxs("button", { type: "button", className: ['vac-day-pop__opt', isCurrent && 'vac-day-pop__opt--current'].filter(Boolean).join(' '), disabled: saving, onClick: () => onPickKindCode(it.kindCode), children: [_jsx("span", { className: ['vac-day-pop__swatch', vacationKindSealUsesDarkInk(it.kind) && 'vac-day-pop__swatch--dark-ink'].filter(Boolean).join(' '), style: { backgroundColor: it.color }, "aria-hidden": true, children: it.seal }), it.label] }) }, `${it.kindCode}-${it.kind}`));
                }) }), current != null && current.absenceDayId != null && (_jsx("button", { type: "button", className: "vac-day-pop__clear", disabled: saving, onClick: () => onClear(), children: "\u0421\u043D\u044F\u0442\u044C \u043E\u0442\u043C\u0435\u0442\u043A\u0443" })), _jsx("hr", { className: "vac-day-pop__divider" }), _jsx("div", { id: `${uid}-basis-title`, className: "vac-day-pop__title vac-day-pop__title--secondary", children: "\u041E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435 (\u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439, \u0444\u0430\u0439\u043B\u044B)" }), !canEditBasis ? (_jsx("p", { className: "vac-day-pop__basis-hint", children: "\u0427\u0442\u043E\u0431\u044B \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435, \u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0438\u0434 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u044F. \u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435." })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "vac-day-pop__basis-hint vac-day-pop__basis-hint--dim", children: ["\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u043E \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435 (\u0434\u043E API). \u041C\u0430\u043A\u0441. ", vacationAbsenceBasisLimits.maxAttachments, " \u0444\u0430\u0439\u043B\u043E\u0432, \u0434\u043E", ' ', Math.round(vacationAbsenceBasisLimits.maxFileBytes / 1024), " \u041A\u0411 \u043A\u0430\u0436\u0434\u044B\u0439."] }), _jsx("label", { className: "vac-day-pop__basis-label", htmlFor: `${uid}-comment`, children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439" }), _jsx("textarea", { id: `${uid}-comment`, className: "vac-day-pop__comment", rows: 3, disabled: saving, value: basisDraft.comment, onChange: (e) => setBasisDraft((d) => ({ ...d, comment: e.target.value })), placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0437\u0430\u044F\u0432\u043B\u0435\u043D\u0438\u0435, \u043F\u0440\u0438\u043A\u0430\u0437, \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435\u2026" }), _jsx("label", { className: "vac-day-pop__basis-label", htmlFor: `${uid}-files`, children: "\u0424\u0430\u0439\u043B\u044B (\u0444\u043E\u0442\u043E, \u0441\u043A\u0430\u043D, PDF)" }), _jsx("input", { ref: fileInputRef, id: `${uid}-files`, type: "file", className: "vac-day-pop__file-input", disabled: saving, multiple: true, accept: "image/*,.pdf,.doc,.docx", onChange: (e) => void onFiles(e.target.files) }), basisDraft.attachments.length > 0 && (_jsx("ul", { className: "vac-day-pop__att-list", children: basisDraft.attachments.map((a) => (_jsxs("li", { className: "vac-day-pop__att-item", children: [a.mimeType.startsWith('image/')
                                    ? (_jsx("img", { src: a.dataUrl, className: "vac-day-pop__att-thumb", alt: "" }))
                                    : (_jsx("span", { className: "vac-day-pop__att-file", "aria-hidden": true, children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: _jsx("path", { d: "M4 7.5V10a4 4 0 008 0V6.5a3 3 0 10-6 0V9a1.5 1.5 0 003 0V6", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }) }) })), _jsx("span", { className: "vac-day-pop__att-name", title: a.name, children: a.name }), _jsx("button", { type: "button", className: "vac-day-pop__att-remove", disabled: saving, onClick: () => removeAtt(a.id), "aria-label": `Удалить ${a.name}`, children: "\u2715" })] }, a.id))) })), _jsx("div", { className: "vac-day-pop__basis-actions", children: _jsx("button", { type: "button", className: "vac-day-pop__save-basis", disabled: saving, onClick: () => persistDraft(), children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435" }) }), basisNotice && (_jsx("p", { className: "vac-day-pop__basis-notice", role: "status", children: basisNotice }))] }))] }), document.body);
}
