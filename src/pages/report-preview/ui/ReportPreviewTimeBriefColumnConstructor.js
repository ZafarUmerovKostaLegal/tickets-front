import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadBriefColumnsRemember, saveBriefColumnsRemember, TIME_BRIEF_COLUMN_LABELS, TIME_BRIEF_COLUMN_ORDER_DEFAULT, } from '../lib/timeBriefReportColumns';
import { ReportPreviewColumnPickerDualPane } from './ReportPreviewColumnPickerDualPane';
function BriefColumnPickerContent(p) {
    const pool = TIME_BRIEF_COLUMN_ORDER_DEFAULT.filter((id) => (p.includeActionsColumn ? true : id !== 'actions'));
    const toolbar = p.toolbarSlot === 'inline' ? (_jsxs("div", { className: "tt-rp-brief-columns__head", children: [_jsx("h3", { className: "tt-rp-brief-columns__title", children: "\u041A\u043E\u043B\u043E\u043D\u043A\u0438 \u043E\u0442\u0447\u0451\u0442\u0430" }), _jsx("button", { type: "button", className: "tt-rp-brief-columns__all", onClick: () => p.onChange([...pool]), children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0441\u0435" })] })) : null;
    return (_jsxs(_Fragment, { children: [toolbar, _jsx(ReportPreviewColumnPickerDualPane, { pool: pool, labels: TIME_BRIEF_COLUMN_LABELS, activeOrderedIds: p.activeOrderedIds, onChange: p.onChange })] }));
}
export function ReportPreviewTimeBriefColumnConstructor(p) {
    return (_jsx("section", { className: "tt-rp-brief-columns", "aria-label": "\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440 \u043A\u043E\u043B\u043E\u043D\u043E\u043A \u043E\u0442\u0447\u0451\u0442\u0430", children: _jsx(BriefColumnPickerContent, { ...p, toolbarSlot: "inline" }) }));
}
export function ReportPreviewTimeBriefColumnsModal({ open, onClose, includeActionsColumn, activeOrderedIds, onChange, rememberEnabled, onRememberEnabledChange, }) {
    const uid = useId();
    const rememberId = `${uid}-remember`;
    const pool = TIME_BRIEF_COLUMN_ORDER_DEFAULT.filter((id) => (includeActionsColumn ? true : id !== 'actions'));
    const [localRemember, setLocalRemember] = useState(() => loadBriefColumnsRemember());
    const remember = rememberEnabled ?? localRemember;
    const setRemember = (next) => {
        if (onRememberEnabledChange)
            onRememberEnabledChange(next);
        else {
            setLocalRemember(next);
            saveBriefColumnsRemember(next);
        }
    };
    const includeAll = () => {
        onChange([...pool]);
    };
    useEffect(() => {
        if (!open)
            return;
        if (rememberEnabled == null)
            setLocalRemember(loadBriefColumnsRemember());
        const h = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', h);
        return () => { document.removeEventListener('keydown', h); };
    }, [open, onClose, rememberEnabled]);
    if (!open)
        return null;
    return createPortal(_jsx("div", { className: "tt-rp-brief-columns-modal-ov", role: "presentation", children: _jsxs("div", { className: "tt-rp-brief-columns-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-cols-title`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "tt-rp-brief-columns-modal__head", children: [_jsx("h2", { id: `${uid}-cols-title`, className: "tt-rp-brief-columns-modal__title", children: "\u041A\u043E\u043B\u043E\u043D\u043A\u0438 \u043E\u0442\u0447\u0451\u0442\u0430" }), _jsxs("div", { className: "tt-rp-brief-columns-modal__head-actions", children: [_jsx("button", { type: "button", className: "tt-rp-brief-columns__all tt-rp-brief-columns__all--modal", onClick: includeAll, children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0441\u0435" }), _jsx("button", { type: "button", className: "tt-rp-brief-columns-modal__x", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] })] }), _jsx("div", { className: "tt-rp-brief-columns-modal__body", children: _jsx(BriefColumnPickerContent, { includeActionsColumn: includeActionsColumn, activeOrderedIds: activeOrderedIds, onChange: onChange, toolbarSlot: "modal-header" }) }), _jsxs("div", { className: "tt-rp-brief-columns-modal__foot", children: [_jsxs("label", { className: "tt-rp-brief-columns-modal__remember", htmlFor: rememberId, children: [_jsx("input", { id: rememberId, type: "checkbox", checked: remember, onChange: (e) => setRemember(e.target.checked) }), _jsx("span", { children: "\u0417\u0430\u043F\u043E\u043C\u043D\u0438\u0442\u044C \u0434\u043B\u044F \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0445 \u043E\u0442\u0447\u0451\u0442\u043E\u0432" })] }), _jsx("button", { type: "button", className: "tt-rp-brief-columns-modal__done", onClick: onClose, children: "\u0413\u043E\u0442\u043E\u0432\u043E" })] })] }) }), document.body);
}
