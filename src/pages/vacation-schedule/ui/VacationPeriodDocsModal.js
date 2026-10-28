import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { listVacationManualEntries, } from '@entities/vacation';
import { VACATION_MONTH_NAMES } from '../lib/vacationScheduleModel';
import { VacationDocLightbox } from './VacationDocLightbox';
import './VacationEmployeeDetailModal.css';
function formatIsoDateRu(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m)
        return iso;
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12)
        return iso;
    return `${Number(m[3])} ${VACATION_MONTH_NAMES[mo - 1]} ${Number(m[1])}`;
}
function dateInRange(iso, from, to) {
    const d = iso.slice(0, 10);
    return d >= from.slice(0, 10) && d <= to.slice(0, 10);
}
export function VacationPeriodDocsModal({ open, onClose, employeeId, employeeName, dateIso, year }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [entries, setEntries] = useState([]);
    const [preview, setPreview] = useState(null);
    useEffect(() => {
        if (!open)
            return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        void listVacationManualEntries({ year, employeeId })
            .then((list) => {
            if (cancelled)
                return;
            setEntries(list.filter((en) => dateInRange(dateIso, en.date_from, en.date_to)));
        })
            .catch((e) => {
            if (!cancelled)
                setError(e instanceof Error ? e.message : 'Не удалось загрузить документы');
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [open, employeeId, dateIso, year]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);
    if (!open)
        return null;
    return createPortal(_jsxs("div", { className: "vac-emp-ov", role: "dialog", "aria-modal": "true", "aria-labelledby": "vac-period-docs-title", onClick: onClose, children: [_jsxs("div", { className: "vac-emp-card", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "vac-emp-card__head", children: [_jsxs("h2", { id: "vac-period-docs-title", className: "vac-emp-card__title", children: ["\u041E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F \u00B7 ", formatIsoDateRu(dateIso)] }), _jsx("button", { type: "button", className: "vac-emp-card__x", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("div", { className: "vac-emp-card__body", children: [_jsxs("p", { className: "vac-emp-card__meta", children: ["\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A: ", _jsx("strong", { children: employeeName })] }), error && _jsx("p", { className: "vac-emp-card__err", role: "alert", children: error }), !error && loading && _jsx("p", { className: "vac-emp-card__empty", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" }), !error && !loading && entries.length === 0 && (_jsx("p", { className: "vac-emp-card__empty", children: "\u0417\u0430 \u044D\u0442\u0443 \u0434\u0430\u0442\u0443 \u043D\u0435\u0442 \u0440\u0443\u0447\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438 \u0441 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043C\u0438-\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F\u043C\u0438." })), !error && !loading && entries.length > 0 && (_jsx("ul", { className: "vac-emp-card__entries", children: entries.map((en) => (_jsxs("li", { className: "vac-emp-entry", children: [_jsxs("div", { className: "vac-emp-entry__head", children: [_jsx("span", { className: "vac-emp-entry__kind", children: en.label_ru || en.kind }), _jsxs("span", { className: "vac-emp-entry__period", children: [formatIsoDateRu(en.date_from), " \u2014 ", formatIsoDateRu(en.date_to)] })] }), en.reason?.trim() && _jsx("p", { className: "vac-emp-entry__reason", children: en.reason }), en.created_by_name && _jsxs("p", { className: "vac-emp-entry__author", children: ["\u0412\u043D\u0451\u0441: ", en.created_by_name] }), _jsx("ul", { className: "vac-emp-entry__docs", children: en.documents.length === 0 ? (_jsx("li", { className: "vac-emp-entry__doc vac-emp-entry__doc--empty", children: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442" })) : en.documents.map((doc) => (_jsx("li", { className: "vac-emp-entry__doc", children: _jsxs("button", { type: "button", className: "vac-emp-entry__doc-name", title: `Предпросмотр ${doc.original_filename}`, onClick: () => setPreview({ entryId: en.id, docId: doc.id, filename: doc.original_filename, contentType: doc.content_type }), children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: [_jsx("path", { d: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }), _jsx("span", { children: doc.original_filename })] }) }, doc.id))) })] }, en.id))) }))] })] }), preview && (_jsx(VacationDocLightbox, { entryId: preview.entryId, docId: preview.docId, filename: preview.filename, contentType: preview.contentType, onClose: () => setPreview(null) }))] }), document.body);
}
