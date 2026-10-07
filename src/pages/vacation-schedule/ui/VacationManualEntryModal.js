import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createVacationManualEntry, VACATION_MANUAL_ENTRY_ALLOWED_EXTENSIONS, VACATION_MANUAL_ENTRY_MAX_FILE_BYTES, VACATION_MANUAL_ENTRY_MAX_FILES, } from '@entities/vacation';
import { DatePicker, SearchableSelect, useAppToast } from '@shared/ui';
import { isVacationSystemRowId, vacationKindSealUsesDarkInk } from '../lib/vacationScheduleModel';
import { countCalendarDaysInclusive, ruDaysWord } from '../lib/leaveRequestDisplay';
import './VacationScheduleImportModal.css';
import './VacationAbsenceRequestModal.css';
import './VacationManualEntryModal.css';
const ALLOWED_EXT_SET = new Set(VACATION_MANUAL_ENTRY_ALLOWED_EXTENSIONS);
function fileExtension(name) {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} Б`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
export function VacationManualEntryModal({ open, onClose, year, employees, legendItems, presetEmployeeId, onSuccess }) {
    const uid = useId();
    const { pushToast } = useAppToast();
    const fileInputRef = useRef(null);
    const [employeeId, setEmployeeId] = useState('');
    const [kindCode, setKindCode] = useState(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [reason, setReason] = useState('');
    const [files, setFiles] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const employeeOptions = useMemo(() => {
        return employees
            .filter((e) => !e.systemOnly && !isVacationSystemRowId(e.id))
            .map((e) => ({ id: String(e.id), label: e.label, search: e.label.toLowerCase(), employeeId: e.id }))
            .sort((a, b) => a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' }));
    }, [employees]);
    const kindOptions = useMemo(() => {
        return legendItems
            .filter((it) => it.kindCode >= 1 && it.kindCode <= 5)
            .map((it) => ({
            kindCode: it.kindCode,
            kind: it.kind,
            label: it.label,
            color: it.color,
            seal: it.seal,
        }));
    }, [legendItems]);
    const dayCount = useMemo(() => countCalendarDaysInclusive(dateFrom, dateTo), [dateFrom, dateTo]);
    useEffect(() => {
        if (!open)
            return;
        setEmployeeId(presetEmployeeId != null ? String(presetEmployeeId) : '');
        setKindCode(null);
        setDateFrom('');
        setDateTo('');
        setReason('');
        setFiles([]);
        setError(null);
        setSubmitting(false);
    }, [open, presetEmployeeId]);
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !submitting)
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose, submitting]);
    const addFiles = useCallback((incoming) => {
        const list = Array.from(incoming);
        if (list.length === 0)
            return;
        setError(null);
        setFiles((prev) => {
            const next = [...prev];
            for (const f of list) {
                const ext = fileExtension(f.name);
                if (!ALLOWED_EXT_SET.has(ext)) {
                    setError(`Недопустимый тип файла «${f.name}». Разрешено: ${VACATION_MANUAL_ENTRY_ALLOWED_EXTENSIONS.join(', ')}.`);
                    continue;
                }
                if (f.size > VACATION_MANUAL_ENTRY_MAX_FILE_BYTES) {
                    setError(`Файл «${f.name}» больше ${formatBytes(VACATION_MANUAL_ENTRY_MAX_FILE_BYTES)}.`);
                    continue;
                }
                if (next.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified))
                    continue;
                if (next.length >= VACATION_MANUAL_ENTRY_MAX_FILES) {
                    setError(`Не более ${VACATION_MANUAL_ENTRY_MAX_FILES} файлов.`);
                    break;
                }
                next.push(f);
            }
            return next;
        });
    }, []);
    const removeFile = useCallback((idx) => {
        setFiles((prev) => prev.filter((_, i) => i !== idx));
    }, []);
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError(null);
        const empOpt = employeeOptions.find((o) => o.id === employeeId);
        if (!empOpt) {
            setError('Выберите сотрудника.');
            return;
        }
        if (kindCode == null) {
            setError('Выберите категорию.');
            return;
        }
        if (!dateFrom || !dateTo) {
            setError('Укажите период (с и по).');
            return;
        }
        if (dateTo < dateFrom) {
            setError('Дата окончания не может быть раньше даты начала.');
            return;
        }
        const fromYear = Number(dateFrom.slice(0, 4));
        const toYear = Number(dateTo.slice(0, 4));
        if (fromYear !== year || toYear !== year) {
            setError(`Период должен быть в пределах ${year} года.`);
            return;
        }
        if (files.length === 0) {
            setError('Приложите хотя бы один документ-основание.');
            return;
        }
        setSubmitting(true);
        try {
            await createVacationManualEntry({
                employeeId: empOpt.employeeId,
                kindCode,
                dateFrom: dateFrom.slice(0, 10),
                dateTo: dateTo.slice(0, 10),
                reason: reason.trim() || null,
                files,
            });
            pushToast({ variant: 'success', message: `Ручная запись для «${empOpt.label}» добавлена в график.` });
            onSuccess?.();
            onClose();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось создать запись.');
        }
        finally {
            setSubmitting(false);
        }
    }, [employeeOptions, employeeId, kindCode, dateFrom, dateTo, year, files, reason, pushToast, onSuccess, onClose]);
    if (!open)
        return null;
    const daysHint = dateFrom && dateTo
        ? dayCount > 0
            ? `Календарных ${ruDaysWord(dayCount)}: ${dayCount}`
            : 'Укажите корректный период'
        : 'Период в пределах одного года графика';
    return createPortal(_jsx("div", { className: "vac-imp-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": `${uid}-title`, children: _jsxs("form", { className: "vac-imp-modal__dialog vac-req-modal__dialog", onSubmit: handleSubmit, children: [_jsxs("div", { className: "vac-imp-modal__head", children: [_jsx("h2", { id: `${uid}-title`, className: "vac-imp-modal__title", children: "\u0420\u0443\u0447\u043D\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u0432 \u0433\u0440\u0430\u0444\u0438\u043A" }), _jsx("button", { type: "button", className: "vac-imp-modal__x", onClick: onClose, disabled: submitting, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsxs("div", { className: "vac-imp-modal__body vac-req-modal__body", children: [_jsxs("fieldset", { className: "vac-req-modal__section", children: [_jsx("legend", { className: "vac-req-modal__legend", children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A" }), _jsxs("label", { className: "vac-req-modal__field vac-req-modal__field--full", children: [_jsx("span", { children: "\u041A\u043E\u043C\u0443 \u0432\u043D\u043E\u0441\u0438\u043C" }), _jsx(SearchableSelect, { portalDropdown: true, className: "vac-req-modal__select", buttonClassName: "vac-req-modal__select-btn", "aria-label": "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A \u0433\u0440\u0430\u0444\u0438\u043A\u0430", placeholder: employeeOptions.length === 0 ? 'Нет сотрудников в графике' : 'Выберите сотрудника…', emptyListText: "\u041D\u0435\u0442 \u0432 \u0441\u043F\u0438\u0441\u043A\u0435", noMatchText: "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E", value: employeeId, items: employeeOptions, getOptionValue: (o) => o.id, getOptionLabel: (o) => o.label, getSearchText: (o) => o.search, disabled: employeeOptions.length === 0 || presetEmployeeId != null, onSelect: (o) => setEmployeeId(o.id) })] })] }), _jsxs("fieldset", { className: "vac-req-modal__section", children: [_jsx("legend", { className: "vac-req-modal__legend", children: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F" }), _jsx("div", { className: "vac-req-modal__categories", role: "radiogroup", "aria-label": "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F", children: kindOptions.map((item) => (_jsxs("label", { className: `vac-req-modal__cat${kindCode === item.kindCode ? ' vac-req-modal__cat--on' : ''}`, children: [_jsx("input", { type: "radio", name: `${uid}-kind`, value: item.kindCode, checked: kindCode === item.kindCode, onChange: () => setKindCode(item.kindCode) }), _jsx("span", { className: `vac-me__cat-dot${vacationKindSealUsesDarkInk(item.kind) ? ' vac-me__cat-dot--dark-ink' : ''}`, style: { background: item.color }, "aria-hidden": true, children: item.seal }), _jsx("span", { children: item.label })] }, item.kindCode))) })] }), _jsxs("fieldset", { className: "vac-req-modal__section", children: [_jsx("legend", { className: "vac-req-modal__legend", children: "\u041F\u0435\u0440\u0438\u043E\u0434" }), _jsxs("div", { className: "vac-req-modal__dates", children: [_jsxs("div", { className: "vac-req-modal__field", children: [_jsx("span", { id: `${uid}-from`, children: "\u0421" }), _jsx(DatePicker, { className: "vac-req-modal__date-picker", buttonClassName: "vac-req-modal__date-picker-btn", value: dateFrom, min: `${year}-01-01`, max: dateTo || `${year}-12-31`, onChange: (iso) => {
                                                        setDateFrom(iso);
                                                        if (dateTo && iso > dateTo)
                                                            setDateTo(iso);
                                                    }, portal: true, portalZIndex: 12600, emptyLabel: "\u0434\u0434.\u043C\u043C.\u0433\u0433\u0433\u0433", showChevron: false, iconAfterLabel: true, title: "\u0414\u0430\u0442\u0430 \u043D\u0430\u0447\u0430\u043B\u0430", "aria-labelledby": `${uid}-from` })] }), _jsxs("div", { className: "vac-req-modal__field", children: [_jsx("span", { id: `${uid}-to`, children: "\u041F\u043E" }), _jsx(DatePicker, { className: "vac-req-modal__date-picker", buttonClassName: "vac-req-modal__date-picker-btn", value: dateTo, min: dateFrom || `${year}-01-01`, max: `${year}-12-31`, onChange: (iso) => {
                                                        setDateTo(iso);
                                                        if (dateFrom && iso < dateFrom)
                                                            setDateFrom(iso);
                                                    }, portal: true, portalZIndex: 12600, emptyLabel: "\u0434\u0434.\u043C\u043C.\u0433\u0433\u0433\u0433", showChevron: false, iconAfterLabel: true, title: "\u0414\u0430\u0442\u0430 \u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u044F", "aria-labelledby": `${uid}-to` })] })] }), _jsx("p", { className: "vac-req-modal__days", "aria-live": "polite", children: daysHint })] }), _jsxs("fieldset", { className: "vac-req-modal__section", children: [_jsxs("legend", { className: "vac-req-modal__legend", children: ["\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B-\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F ", _jsx("span", { className: "vac-me__req", children: "*" })] }), _jsxs("div", { className: "vac-me__files", children: [_jsxs("button", { type: "button", className: "vac-me__add-files", onClick: () => fileInputRef.current?.click(), disabled: submitting || files.length >= VACATION_MANUAL_ENTRY_MAX_FILES, children: [_jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, children: _jsx("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }) }), "\u041F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u0444\u0430\u0439\u043B\u044B"] }), _jsx("input", { ref: fileInputRef, type: "file", multiple: true, hidden: true, accept: VACATION_MANUAL_ENTRY_ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(','), onChange: (e) => {
                                                if (e.target.files)
                                                    addFiles(e.target.files);
                                                e.target.value = '';
                                            } }), _jsxs("span", { className: "vac-me__files-hint", children: ["\u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u2265 1 \u0444\u0430\u0439\u043B\u0430. \u0414\u043E ", VACATION_MANUAL_ENTRY_MAX_FILES, " \u0448\u0442., \u0434\u043E ", formatBytes(VACATION_MANUAL_ENTRY_MAX_FILE_BYTES), " \u043A\u0430\u0436\u0434\u044B\u0439."] })] }), files.length > 0 && (_jsx("ul", { className: "vac-me__file-list", children: files.map((f, idx) => (_jsxs("li", { className: "vac-me__file", children: [_jsx("span", { className: "vac-me__file-name", title: f.name, children: f.name }), _jsx("span", { className: "vac-me__file-size", children: formatBytes(f.size) }), _jsx("button", { type: "button", className: "vac-me__file-del", onClick: () => removeFile(idx), disabled: submitting, "aria-label": `Убрать ${f.name}`, children: "\u00D7" })] }, `${f.name}-${f.size}-${f.lastModified}`))) }))] }), _jsxs("fieldset", { className: "vac-req-modal__section", children: [_jsx("legend", { className: "vac-req-modal__legend", children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)" }), _jsx("textarea", { className: "vac-req-modal__reason", value: reason, onChange: (e) => setReason(e.target.value), placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u043A\u043E\u043C\u0430\u043D\u0434\u0438\u0440\u043E\u0432\u043A\u0430 \u0432 \u0422\u0430\u0448\u043A\u0435\u043D\u0442 \u043F\u043E \u043F\u0440\u0438\u043A\u0430\u0437\u0443 \u2116\u2026", rows: 3, maxLength: 500, disabled: submitting })] }), _jsx("p", { className: "vac-req-modal__note", children: "\u0414\u043D\u0438 \u043F\u0435\u0440\u0438\u043E\u0434\u0430 \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0432 \u0433\u0440\u0430\u0444\u0438\u043A\u0435 \u0441 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u043E\u0439 \u043A \u044D\u0442\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438. \u0415\u0441\u043B\u0438 \u043D\u0430 \u0434\u0430\u0442\u0443 \u0443\u0436\u0435 \u0431\u044B\u043B\u0430 \u043E\u0442\u043C\u0435\u0442\u043A\u0430 \u2014 \u043E\u043D\u0430 \u0431\u0443\u0434\u0435\u0442 \u0437\u0430\u043C\u0435\u043D\u0435\u043D\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0435\u0439." }), error && (_jsx("p", { className: "vac-req-modal__error", role: "alert", children: error })), _jsxs("div", { className: "vac-imp-modal__actions", children: [_jsx("button", { type: "button", className: "vac-imp-modal__btn-secondary", onClick: onClose, disabled: submitting, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "submit", className: "vac-req-modal__submit", disabled: submitting, children: submitting ? 'Сохранение…' : 'Внести в график' })] })] })] }) }), document.body);
}
