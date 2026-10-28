import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { printVacationLeaveLetter } from '../lib/printVacationLeaveLetter';
import { VacationLeaveApplicationLetter } from './VacationLeaveApplicationLetter';
import './VacationDocLightbox.css';
export function VacationLeavePdfPreview({ request, onClose }) {
    const title = `Заявление · #${request.id}`;
    const letterWrapRef = useRef(null);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey, true);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.body.style.overflow = '';
        };
    }, [onClose]);
    return createPortal(_jsx("div", { className: "vac-doc-lb", role: "dialog", "aria-modal": "true", "aria-label": title, onClick: (e) => {
            e.stopPropagation();
            onClose();
        }, children: _jsxs("div", { className: "vac-doc-lb__frame vac-doc-lb__frame--pdf vac-doc-lb__frame--letter", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "vac-doc-lb__head", children: [_jsx("span", { className: "vac-doc-lb__title", title: title, children: title }), _jsxs("div", { className: "vac-doc-lb__actions", children: [_jsxs("button", { type: "button", className: "vac-doc-lb__btn", onClick: () => {
                                        const letter = letterWrapRef.current?.querySelector('.vac-leave-letter');
                                        if (letter instanceof HTMLElement)
                                            printVacationLeaveLetter(letter);
                                    }, title: "\u041F\u0435\u0447\u0430\u0442\u044C \u0438\u043B\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u0430\u043A PDF", children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }), "\u041F\u0435\u0447\u0430\u0442\u044C / PDF"] }), _jsx("button", { type: "button", className: "vac-doc-lb__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] })] }), _jsx("div", { className: "vac-doc-lb__body vac-doc-lb__body--letter", ref: letterWrapRef, children: _jsx(VacationLeaveApplicationLetter, { request: request }) })] }) }), document.body);
}
