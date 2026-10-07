import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './VacationScheduleImportModal.css';
export function VacationPayrollSettingsModal({ open, onClose, params, onSave }) {
    const prevOpenRef = useRef(false);
    useEffect(() => {
        prevOpenRef.current = open;
    }, [open]);
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
    const handleSubmit = (e) => {
        e.preventDefault();
        onClose();
    };
    return createPortal(_jsxs("div", { className: "vac-import-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "vac-payroll-modal-title", children: [_jsx("button", { type: "button", className: "vac-import-modal__backdrop", "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", onClick: onClose }), _jsxs("form", { className: "vac-import-modal__panel", onSubmit: handleSubmit, children: [_jsxs("header", { className: "vac-import-modal__header", children: [_jsx("h2", { id: "vac-payroll-modal-title", className: "vac-import-modal__title", children: "\u041F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u0432\u044B\u043F\u043B\u0430\u0442" }), _jsx("button", { type: "button", className: "vac-import-modal__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("div", { className: "vac-import-modal__body vac-vsg__payroll-fields vac-vsg__payroll-fields--modal", children: [_jsxs("label", { className: "vac-vsg__payroll-field", children: [_jsx("span", { children: "\u0421\u0440\u0435\u0434\u043D\u044F\u044F \u0437\u0430\u0440\u043F\u043B\u0430\u0442\u0430 / \u043C\u0435\u0441., \u20BD" }), _jsx("input", { type: "number", min: 0, step: 1000, className: "vac-vsg__payroll-input", value: params.avgMonthlySalary > 0 ? params.avgMonthlySalary : '', onChange: (e) => {
                                            const raw = e.target.value.trim();
                                            if (raw === '') {
                                                onSave({ avgMonthlySalary: 0 });
                                                return;
                                            }
                                            const v = Number.parseFloat(raw);
                                            onSave({ avgMonthlySalary: Number.isFinite(v) && v >= 0 ? v : 0 });
                                        }, placeholder: "0" })] }), _jsxs("label", { className: "vac-vsg__payroll-field", children: [_jsx("span", { children: "\u0421\u0440. \u043A\u0430\u043B. \u0434\u043D\u0435\u0439 \u0432 \u043C\u0435\u0441." }), _jsx("input", { type: "number", min: 1, max: 31, step: 0.1, className: "vac-vsg__payroll-input vac-vsg__payroll-input--narrow", value: params.avgCalendarDaysPerMonth, onChange: (e) => {
                                            const v = Number.parseFloat(e.target.value);
                                            onSave({
                                                avgCalendarDaysPerMonth: Number.isFinite(v) ? Math.min(31, Math.max(1, v)) : 29.3,
                                            });
                                        } })] }), _jsxs("label", { className: "vac-vsg__payroll-field", children: [_jsx("span", { children: "\u0421\u0442\u0430\u0432\u043A\u0430 \u0431\u043E\u043B\u044C\u043D\u0438\u0447\u043D\u043E\u0433\u043E (0\u20131)" }), _jsx("input", { type: "number", min: 0, max: 1, step: 0.05, className: "vac-vsg__payroll-input vac-vsg__payroll-input--narrow", value: params.sickLeavePayRate, onChange: (e) => {
                                            const v = Number.parseFloat(e.target.value);
                                            onSave({
                                                sickLeavePayRate: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6,
                                            });
                                        } })] }), _jsxs("label", { className: "vac-vsg__payroll-field", children: [_jsx("span", { children: "\u041A\u043E\u044D\u0444\u0444. \u043E\u0442\u043F\u0443\u0441\u043A\u0430 (0\u20132)" }), _jsx("input", { type: "number", min: 0, max: 2, step: 0.05, className: "vac-vsg__payroll-input vac-vsg__payroll-input--narrow", value: params.vacationPayRate, onChange: (e) => {
                                            const v = Number.parseFloat(e.target.value);
                                            onSave({
                                                vacationPayRate: Number.isFinite(v) ? Math.min(2, Math.max(0, v)) : 1,
                                            });
                                        } })] })] }), _jsx("p", { className: "vac-vsg__payroll-note", children: "\u041E\u0440\u0438\u0435\u043D\u0442\u0438\u0440: \u0441\u0440\u0435\u0434\u043D\u0435\u0434\u043D\u0435\u0432\u043D\u043E\u0439 = \u0437\u0430\u0440\u043F\u043B\u0430\u0442\u0430 / \u0441\u0440. \u0434\u043D\u0435\u0439 \u0432 \u043C\u0435\u0441\u044F\u0446\u0435. \u041D\u0435 \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442 \u043B\u0438\u043C\u0438\u0442\u044B \u0424\u0421\u0421, \u0441\u0442\u0430\u0436, \u041C\u0420\u041E\u0422 \u0438 \u043F\u0440." }), _jsxs("footer", { className: "vac-import-modal__footer", children: [_jsx("button", { type: "button", className: "vac-import-modal__btn vac-import-modal__btn--ghost", onClick: onClose, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" }), _jsx("button", { type: "submit", className: "vac-import-modal__btn vac-import-modal__btn--primary", children: "\u0413\u043E\u0442\u043E\u0432\u043E" })] })] })] }), document.body);
}
