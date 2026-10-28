import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatHoursClockFromDecimalHours } from '@shared/lib/formatTrackingHours';
import { useI18n } from '@shared/i18n';
import './TimesheetModals.css';
export function TimesheetGrantUnlockConfirm({ workDateYmd, busy, onCancel, onConfirm }) {
    const { t } = useI18n();
    const titleId = useId();
    const cancelRef = useRef(null);
    useEffect(() => {
        const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, []);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (!busy)
                    onCancel();
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (!busy)
                    void onConfirm();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onCancel, onConfirm]);
    if (typeof document === 'undefined')
        return null;
    return createPortal(_jsx("div", { className: "tsp-cfm__overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, children: _jsxs("div", { className: "tsp-cfm__modal", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "tsp-cfm__head", children: [_jsx("div", { className: "tsp-cfm__ico tsp-cfm__ico--unlock", "aria-hidden": true, children: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }), _jsx("path", { d: "M9 12l2 2 4-4" })] }) }), _jsxs("div", { className: "tsp-cfm__head-txt", children: [_jsx("h3", { id: titleId, className: "tsp-cfm__title", children: t('timeTrackingPage.grantUnlockConfirm.title') }), _jsx("p", { className: "tsp-cfm__sub", children: t('timeTrackingPage.grantUnlockConfirm.sub') })] }), _jsx("button", { type: "button", className: "tsp-cfm__close", onClick: onCancel, disabled: busy, "aria-label": t('timeTrackingPage.close'), children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsx("div", { className: "tsp-cfm__grant-body", children: _jsxs("p", { className: "tsp-cfm__grant-body-p", children: [t('timeTrackingPage.grantUnlockConfirm.bodyPrefix'), " (", _jsx("strong", { children: workDateYmd }), "). ", t('timeTrackingPage.grantUnlockConfirm.bodySuffix')] }) }), _jsxs("div", { className: "tsp-cfm__foot", children: [_jsx("button", { ref: cancelRef, type: "button", className: "tsp-cfm__btn tsp-cfm__btn--ghost", onClick: onCancel, disabled: busy, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tsp-cfm__btn tsp-cfm__btn--primary", onClick: () => void onConfirm(), disabled: busy, children: t('timeTrackingPage.grantUnlockConfirm.confirm') })] })] }) }), document.body);
}
export function TimesheetDeleteConfirm({ entry, busy, onCancel, onConfirm }) {
    const { t } = useI18n();
    const cancelRef = useRef(null);
    useEffect(() => {
        const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, []);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (!busy)
                    onCancel();
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (!busy)
                    void onConfirm();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onCancel, onConfirm]);
    if (typeof document === 'undefined')
        return null;
    const hoursLabel = formatHoursClockFromDecimalHours(entry.hours);
    return createPortal(_jsx("div", { className: "tsp-cfm__overlay", role: "dialog", "aria-modal": "true", "aria-labelledby": "tsp-cfm-title", children: _jsxs("div", { className: "tsp-cfm__modal", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "tsp-cfm__head", children: [_jsx("div", { className: "tsp-cfm__ico", "aria-hidden": true, children: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M12 9v4M12 17h.01" }), _jsx("path", { d: "M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.7 3.86a2 2 0 00-3.4 0z" })] }) }), _jsxs("div", { className: "tsp-cfm__head-txt", children: [_jsx("h3", { id: "tsp-cfm-title", className: "tsp-cfm__title", children: t('timeTrackingPage.deleteConfirm.title') }), _jsx("p", { className: "tsp-cfm__sub", children: t('timeTrackingPage.deleteConfirm.sub') })] }), _jsx("button", { type: "button", className: "tsp-cfm__close", onClick: onCancel, disabled: busy, "aria-label": t('timeTrackingPage.close'), children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { className: "tsp-cfm__card", children: [_jsx("span", { className: "tsp-cfm__card-bar", style: { background: entry.color }, "aria-hidden": true }), _jsxs("div", { className: "tsp-cfm__card-txt", children: [_jsxs("p", { className: "tsp-cfm__card-proj", children: [_jsx("strong", { children: entry.project }), _jsxs("span", { className: "tsp-cfm__card-client", children: ["(", entry.client, ")"] })] }), entry.task ? _jsx("p", { className: "tsp-cfm__card-task", children: entry.task }) : null, entry.notes ? _jsx("p", { className: "tsp-cfm__card-notes", children: entry.notes }) : null] }), _jsx("div", { className: "tsp-cfm__card-h", children: hoursLabel })] }), _jsxs("div", { className: "tsp-cfm__foot", children: [_jsx("button", { ref: cancelRef, type: "button", className: "tsp-cfm__btn tsp-cfm__btn--ghost", onClick: onCancel, disabled: busy, children: t('timeTrackingPage.cancel') }), _jsx("button", { type: "button", className: "tsp-cfm__btn tsp-cfm__btn--danger", onClick: () => void onConfirm(), disabled: busy, children: busy ? t('timeTrackingPage.deleting') : t('timeTrackingPage.delete') })] })] }) }), document.body);
}
