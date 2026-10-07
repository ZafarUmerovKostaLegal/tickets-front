import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { EXPENSE_TYPES, PAYMENT_METHODS, STATUS_META } from '@entities/expenses/model/constants';
import { exportExpensesToExcel, DEFAULT_REPORT_CONFIG, } from '@entities/expenses/lib/exportExpenses';
const STATUS_OPTIONS = Object.keys(STATUS_META).map(s => ({
    value: s,
    label: STATUS_META[s].label,
}));
function ReportAllToggle({ id, label, checked, onToggle, }) {
    const labelId = `rep-all-${id}-label`;
    return (_jsxs("div", { className: "exp-form-switch-row rep-report-all-row", children: [_jsx("span", { id: labelId, className: "rep-report-all-text", children: label }), _jsx("button", { type: "button", role: "switch", "aria-labelledby": labelId, "aria-checked": checked, className: `exp-form-switch${checked ? ' exp-form-switch--on' : ''}`, onClick: () => onToggle(!checked), children: _jsx("span", { className: "exp-form-switch__thumb" }) })] }));
}
export function ExpensesReportModal({ isOpen, requests, onClose }) {
    const [config, setConfig] = useState(DEFAULT_REPORT_CONFIG);
    const [isLoading, setIsLoading] = useState(false);
    const [exportErr, setExportErr] = useState(null);
    const [allTypes, setAllTypes] = useState(true);
    const [allStatuses, setAllStatuses] = useState(true);
    const [allPayments, setAllPayments] = useState(true);
    useEffect(() => {
        if (isOpen) {
            setConfig(DEFAULT_REPORT_CONFIG);
            setAllTypes(true);
            setAllStatuses(true);
            setAllPayments(true);
            setIsLoading(false);
            setExportErr(null);
        }
    }, [isOpen]);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && isOpen)
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);
    useEffect(() => {
        if (isOpen)
            document.body.style.overflow = 'hidden';
        else
            document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);
    const set = useCallback((key, val) => {
        setConfig(prev => ({ ...prev, [key]: val }));
    }, []);
    const toggleType = useCallback((type) => {
        setConfig(prev => {
            const has = prev.selectedTypes.includes(type);
            return {
                ...prev,
                selectedTypes: has
                    ? prev.selectedTypes.filter(t => t !== type)
                    : [...prev.selectedTypes, type],
            };
        });
    }, []);
    const toggleStatus = useCallback((status) => {
        setConfig(prev => {
            const has = prev.selectedStatuses.includes(status);
            return {
                ...prev,
                selectedStatuses: has
                    ? prev.selectedStatuses.filter(s => s !== status)
                    : [...prev.selectedStatuses, status],
            };
        });
    }, []);
    const togglePayment = useCallback((method) => {
        setConfig(prev => {
            const has = prev.selectedPaymentMethods.includes(method);
            return {
                ...prev,
                selectedPaymentMethods: has
                    ? prev.selectedPaymentMethods.filter(m => m !== method)
                    : [...prev.selectedPaymentMethods, method],
            };
        });
    }, []);
    const handleAllTypes = useCallback((checked) => {
        setAllTypes(checked);
        if (checked)
            setConfig(prev => ({ ...prev, selectedTypes: [] }));
    }, []);
    const handleAllStatuses = useCallback((checked) => {
        setAllStatuses(checked);
        if (checked)
            setConfig(prev => ({ ...prev, selectedStatuses: [] }));
    }, []);
    const handleAllPayments = useCallback((checked) => {
        setAllPayments(checked);
        if (checked)
            setConfig(prev => ({ ...prev, selectedPaymentMethods: [] }));
    }, []);
    const handleGenerate = useCallback(async () => {
        setIsLoading(true);
        setExportErr(null);
        try {
            await exportExpensesToExcel(requests, config);
            onClose();
        }
        catch (err) {
            setExportErr(err instanceof Error ? err.message : 'Не удалось сформировать файл');
        }
        finally {
            setIsLoading(false);
        }
    }, [requests, config, onClose]);
    if (!isOpen)
        return null;
    const previewCount = requests.filter(r => {
        if (config.dateFrom && r.expenseDate < config.dateFrom)
            return false;
        if (config.dateTo && r.expenseDate > config.dateTo)
            return false;
        if (!allTypes && config.selectedTypes.length && !config.selectedTypes.includes(r.expenseType))
            return false;
        if (!allStatuses && config.selectedStatuses.length && !config.selectedStatuses.includes(r.status))
            return false;
        if (!allPayments && config.selectedPaymentMethods.length) {
            const pm = r.paymentMethod;
            if (pm == null || pm === '' || !config.selectedPaymentMethods.includes(pm))
                return false;
        }
        if (config.reimbursable === 'reimbursable' && !r.isReimbursable)
            return false;
        if (config.reimbursable === 'non_reimbursable' && r.isReimbursable)
            return false;
        return true;
    }).length;
    const modal = (_jsxs(_Fragment, { children: [_jsx("div", { className: "rep-overlay", "aria-hidden": true }), _jsxs("div", { className: "rep-modal", role: "dialog", "aria-modal": true, "aria-labelledby": "rep-modal-title", children: [_jsxs("div", { className: "rep-modal__hd", children: [_jsx("div", { className: "rep-modal__hd-icon", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), _jsx("line", { x1: "16", y1: "13", x2: "8", y2: "13" }), _jsx("line", { x1: "16", y1: "17", x2: "8", y2: "17" }), _jsx("polyline", { points: "10 9 9 9 8 9" })] }) }), _jsxs("div", { children: [_jsx("h2", { id: "rep-modal-title", className: "rep-modal__title", children: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043E\u0442\u0447\u0451\u0442 Excel" }), _jsx("p", { className: "rep-modal__sub", children: "\u0424\u0438\u043B\u044C\u0442\u0440\u044B, \u043A\u0430\u043A \u0432 \u0437\u0430\u044F\u0432\u043A\u0430\u0445: \u0434\u0430\u0442\u0430 \u0440\u0430\u0441\u0445\u043E\u0434\u0430, \u0442\u0438\u043F, \u0441\u0442\u0430\u0442\u0443\u0441, \u043E\u043F\u043B\u0430\u0442\u0430, \u0432\u043E\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u0435" })] }), _jsx("button", { type: "button", className: "rep-modal__close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { className: "rep-modal__body", children: [_jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043E\u0442\u0447\u0451\u0442\u0430" }), _jsx("input", { type: "text", className: "rep-input", value: config.title, onChange: e => set('title', e.target.value), placeholder: "\u041E\u0442\u0447\u0451\u0442 \u043F\u043E \u0440\u0430\u0441\u0445\u043E\u0434\u0430\u043C \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438" })] }), _jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u041F\u0435\u0440\u0438\u043E\u0434 (\u0434\u0430\u0442\u0430 \u0440\u0430\u0441\u0445\u043E\u0434\u0430)" }), _jsxs("div", { className: "rep-date-row", children: [_jsxs("div", { className: "rep-date-wrap", children: [_jsx("span", { className: "rep-date-label", children: "\u0421" }), _jsx("input", { type: "date", className: "rep-input rep-input--date", value: config.dateFrom, onChange: e => set('dateFrom', e.target.value) })] }), _jsxs("div", { className: "rep-date-wrap", children: [_jsx("span", { className: "rep-date-label", children: "\u041F\u043E" }), _jsx("input", { type: "date", className: "rep-input rep-input--date", value: config.dateTo, onChange: e => set('dateTo', e.target.value) })] })] }), _jsx("p", { className: "rep-field-hint", children: "\u041F\u0443\u0441\u0442\u043E\u0435 \u00AB\u0421\u00BB \u2014 \u0431\u0435\u0437 \u043D\u0438\u0436\u043D\u0435\u0439 \u0433\u0440\u0430\u043D\u0438\u0446\u044B; \u043F\u0443\u0441\u0442\u043E\u0435 \u00AB\u041F\u043E\u00BB \u2014 \u0431\u0435\u0437 \u0432\u0435\u0440\u0445\u043D\u0435\u0439. \u041E\u0431\u0430 \u043F\u0443\u0441\u0442\u044B\u0435 \u2014 \u0432\u0441\u0435 \u0434\u0430\u0442\u044B \u0440\u0430\u0441\u0445\u043E\u0434\u0430 \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430." })] }), _jsxs("div", { className: "rep-field rep-field--note", children: [_jsx("p", { className: "rep-label", style: { marginBottom: '0.35rem' }, children: "\u0421\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 \u0444\u0430\u0439\u043B\u0430" }), _jsxs("p", { className: "rep-field-hint", children: ["\u0412 \u0442\u0430\u0431\u043B\u0438\u0446\u0443 \u0432\u044B\u0433\u0440\u0443\u0436\u0430\u044E\u0442\u0441\u044F \u043F\u043E\u043B\u044F \u0437\u0430\u044F\u0432\u043A\u0438: \u0441\u0443\u043C\u043C\u0430 \u0432 ", _jsx("strong", { children: "UZS" }), ", \u043A\u0443\u0440\u0441 ", _jsx("strong", { children: "UZS/USD" }), ", \u044D\u043A\u0432\u0438\u0432\u0430\u043B\u0435\u043D\u0442 \u0432 ", _jsx("strong", { children: "USD" }), " (\u043A\u0430\u043A \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u0435), \u043F\u0440\u043E\u0435\u043A\u0442, \u043A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442, \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439, \u0441\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B \u0438 \u0441\u0442\u0430\u0442\u0443\u0441."] })] }), _jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u0422\u0438\u043F\u044B \u0440\u0430\u0441\u0445\u043E\u0434\u043E\u0432" }), _jsx(ReportAllToggle, { id: "types", label: "\u0412\u0441\u0435 \u0442\u0438\u043F\u044B", checked: allTypes, onToggle: handleAllTypes }), !allTypes && (_jsx("div", { className: "rep-check-grid rep-check-grid--wide", children: EXPENSE_TYPES.map(t => (_jsxs("label", { className: `rep-check${config.selectedTypes.includes(t.value) ? ' rep-check--on' : ''}`, children: [_jsx("input", { type: "checkbox", checked: config.selectedTypes.includes(t.value), onChange: () => toggleType(t.value) }), _jsx("span", { children: t.label })] }, t.value))) }))] }), _jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u0421\u0442\u0430\u0442\u0443\u0441\u044B \u0437\u0430\u044F\u0432\u043E\u043A" }), _jsx(ReportAllToggle, { id: "statuses", label: "\u0412\u0441\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044B", checked: allStatuses, onToggle: handleAllStatuses }), !allStatuses && (_jsx("div", { className: "rep-check-grid rep-check-grid--wide", children: STATUS_OPTIONS.map(s => (_jsxs("label", { className: `rep-check${config.selectedStatuses.includes(s.value) ? ' rep-check--on' : ''}`, children: [_jsx("input", { type: "checkbox", checked: config.selectedStatuses.includes(s.value), onChange: () => toggleStatus(s.value) }), _jsx("span", { className: `exp-status exp-status--${s.value}`, children: s.label })] }, s.value))) }))] }), _jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B" }), _jsx(ReportAllToggle, { id: "payments", label: "\u0412\u0441\u0435 \u0441\u043F\u043E\u0441\u043E\u0431\u044B", checked: allPayments, onToggle: handleAllPayments }), !allPayments && (_jsx("div", { className: "rep-check-grid rep-check-grid--wide", children: PAYMENT_METHODS.map(m => (_jsxs("label", { className: `rep-check${config.selectedPaymentMethods.includes(m.value) ? ' rep-check--on' : ''}`, children: [_jsx("input", { type: "checkbox", checked: config.selectedPaymentMethods.includes(m.value), onChange: () => togglePayment(m.value) }), _jsx("span", { children: m.label })] }, m.value))) })), _jsx("p", { className: "rep-field-hint", children: "\u0417\u0430\u044F\u0432\u043A\u0438 \u0431\u0435\u0437 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0433\u043E \u0441\u043F\u043E\u0441\u043E\u0431\u0430 \u043E\u043F\u043B\u0430\u0442\u044B \u043F\u043E\u043F\u0430\u0434\u0443\u0442 \u0432 \u043E\u0442\u0447\u0451\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438 \u0432\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u043E\u043C \u00AB\u0412\u0441\u0435 \u0441\u043F\u043E\u0441\u043E\u0431\u044B\u00BB." })] }), _jsxs("div", { className: "rep-field", children: [_jsx("label", { className: "rep-label", children: "\u0412\u043E\u0437\u043C\u0435\u0449\u0430\u0435\u043C\u043E\u0441\u0442\u044C" }), _jsx("div", { className: "rep-radio-row rep-radio-row--wide", children: [
                                            { value: 'all', label: 'Все' },
                                            { value: 'reimbursable', label: 'Возмещаемые' },
                                            { value: 'non_reimbursable', label: 'Невозмещаемые' },
                                        ].map(o => (_jsxs("label", { className: `rep-radio${config.reimbursable === o.value ? ' rep-radio--on' : ''}`, children: [_jsx("input", { type: "radio", name: "reimbursable", value: o.value, checked: config.reimbursable === o.value, onChange: () => set('reimbursable', o.value) }), o.label] }, o.value))) })] }), exportErr && (_jsx("p", { className: "rep-field-error", role: "alert", children: exportErr }))] }), _jsxs("div", { className: "rep-modal__ft", children: [_jsxs("div", { className: "rep-modal__preview", children: [_jsx("svg", { viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" }) }), "\u0412 \u043E\u0442\u0447\u0451\u0442 \u0432\u043E\u0439\u0434\u0451\u0442 ", _jsx("strong", { children: previewCount }), ' ', previewCount === 1 ? 'запись' : previewCount < 5 ? 'записи' : 'записей'] }), _jsxs("div", { className: "rep-modal__actions", children: [_jsx("button", { type: "button", className: "rep-btn rep-btn--ghost", onClick: onClose, disabled: isLoading, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "rep-btn rep-btn--primary", onClick: handleGenerate, disabled: isLoading || previewCount === 0, children: isLoading ? (_jsxs(_Fragment, { children: [_jsx("svg", { className: "rep-spinner", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" }) }), "\u0424\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435\u2026"] })) : (_jsxs(_Fragment, { children: [_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }), "\u0421\u043A\u0430\u0447\u0430\u0442\u044C Excel"] })) })] })] })] })] }));
    return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
