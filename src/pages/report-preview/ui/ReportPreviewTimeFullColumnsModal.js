import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { TIME_FULL_COLUMN_LABELS, TIME_FULL_COLUMN_ORDER_DEFAULT, } from '../lib/timeFullReportColumns';
import { ReportPreviewColumnPickerDualPane } from './ReportPreviewColumnPickerDualPane';
export function ReportPreviewTimeFullColumnsModal({ open, onClose, activeOrderedIds, onChange, }) {
    const uid = useId();
    const pool = TIME_FULL_COLUMN_ORDER_DEFAULT;
    const includeAll = () => {
        onChange([...pool]);
    };
    useEffect(() => {
        if (!open)
            return;
        const h = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', h);
        return () => { document.removeEventListener('keydown', h); };
    }, [open, onClose]);
    if (!open)
        return null;
    return createPortal(_jsx("div", { className: "tt-rp-brief-columns-modal-ov", role: "presentation", children: _jsxs("div", { className: "tt-rp-brief-columns-modal tt-rp-brief-columns-modal--full-cols", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-full-cols-title`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "tt-rp-brief-columns-modal__head", children: [_jsx("h2", { id: `${uid}-full-cols-title`, className: "tt-rp-brief-columns-modal__title", children: "\u041A\u043E\u043B\u043E\u043D\u043A\u0438 \u043F\u043E\u043B\u043D\u043E\u0433\u043E \u043E\u0442\u0447\u0451\u0442\u0430" }), _jsxs("div", { className: "tt-rp-brief-columns-modal__head-actions", children: [_jsx("button", { type: "button", className: "tt-rp-brief-columns__all tt-rp-brief-columns__all--modal", onClick: includeAll, children: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0432\u0441\u0435" }), _jsx("button", { type: "button", className: "tt-rp-brief-columns-modal__x", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] })] }), _jsx("div", { className: "tt-rp-brief-columns-modal__body", children: _jsx(ReportPreviewColumnPickerDualPane, { pool: pool, labels: TIME_FULL_COLUMN_LABELS, activeOrderedIds: activeOrderedIds, onChange: onChange }) }), _jsx("div", { className: "tt-rp-brief-columns-modal__foot", children: _jsx("button", { type: "button", className: "tt-rp-brief-columns-modal__done", onClick: onClose, children: "\u0413\u043E\u0442\u043E\u0432\u043E" }) })] }) }), document.body);
}
